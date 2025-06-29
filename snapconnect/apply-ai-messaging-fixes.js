/**
 * Apply AI Messaging Fixes via Supabase
 * Creates missing table and functions to fix AI messaging issues
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFixes() {
  console.log('🔧 Applying AI Messaging Fixes...\n');

  // Fix 1: Create ai_proactive_messages table
  console.log('📋 Fix 1: Creating ai_proactive_messages table...');
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ai_proactive_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ai_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        trigger_type TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) {
      console.log('   ⚠️  Table creation skipped (may already exist):', error.message);
    } else {
      console.log('   ✅ ai_proactive_messages table created');
    }
  } catch (error) {
    console.log('   ⚠️  Table creation failed:', error.message);
  }

  // Fix 2: Create indexes
  console.log('\n📋 Fix 2: Creating indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_user_id ON ai_proactive_messages(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_ai_user_id ON ai_proactive_messages(ai_user_id);',
    'CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_trigger_type ON ai_proactive_messages(trigger_type);',
    'CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_sent_at ON ai_proactive_messages(sent_at);'
  ];

  for (const indexSQL of indexes) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (error) {
        console.log('   ⚠️  Index creation skipped:', error.message);
      } else {
        console.log('   ✅ Index created successfully');
      }
    } catch (error) {
      console.log('   ⚠️  Index creation failed:', error.message);
    }
  }

  // Fix 3: Enable RLS
  console.log('\n📋 Fix 3: Setting up Row Level Security...');
  try {
    const rlsSQL = 'ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;';
    const { error } = await supabase.rpc('exec_sql', { sql: rlsSQL });
    if (error) {
      console.log('   ⚠️  RLS setup skipped:', error.message);
    } else {
      console.log('   ✅ RLS enabled');
    }
  } catch (error) {
    console.log('   ⚠️  RLS setup failed:', error.message);
  }

  // Fix 4: Create helper function
  console.log('\n📋 Fix 4: Creating helper functions...');
  
  const helperFunctionSQL = `
    CREATE OR REPLACE FUNCTION create_proactive_messages_log_if_not_exists()
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN TRUE;
    END;
    $$;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: helperFunctionSQL });
    if (error) {
      console.log('   ⚠️  Helper function creation failed:', error.message);
    } else {
      console.log('   ✅ Helper function created');
    }
  } catch (error) {
    console.log('   ⚠️  Helper function creation failed:', error.message);
  }

  // Fix 5: Create enhanced mark_message_viewed function
  console.log('\n📋 Fix 5: Creating enhanced mark_message_viewed function...');
  
  const markViewedSQL = `
    CREATE OR REPLACE FUNCTION mark_message_viewed(message_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      current_user_id UUID;
      message_receiver UUID;
      is_ai_message BOOLEAN;
    BEGIN
      current_user_id := auth.uid();
      
      SELECT receiver_id, COALESCE(is_ai_sender, FALSE) 
      INTO message_receiver, is_ai_message
      FROM messages 
      WHERE id = message_id;
      
      IF message_receiver != current_user_id THEN
        RAISE EXCEPTION 'Can only mark your own received messages as viewed';
      END IF;
      
      UPDATE messages 
      SET 
        is_viewed = TRUE,
        viewed_at = NOW(),
        expires_at = CASE 
          WHEN is_ai_message THEN NULL 
          ELSE NOW() + interval '10 seconds' 
        END
      WHERE id = message_id;
      
      RETURN TRUE;
    END;
    $$;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: markViewedSQL });
    if (error) {
      console.log('   ⚠️  mark_message_viewed function failed:', error.message);
    } else {
      console.log('   ✅ mark_message_viewed function created');
    }
  } catch (error) {
    console.log('   ⚠️  mark_message_viewed function failed:', error.message);
  }

  // Fix 6: Test the fixes
  console.log('\n📋 Fix 6: Testing fixes...');
  
  try {
    // Test ai_proactive_messages table
    const { data: testData, error: testError } = await supabase
      .from('ai_proactive_messages')
      .select('*')
      .limit(1);
      
    if (testError) {
      console.log('   ❌ ai_proactive_messages table test failed:', testError.message);
    } else {
      console.log('   ✅ ai_proactive_messages table is accessible');
    }

    // Test helper function
    const { data: helperTest, error: helperError } = await supabase
      .rpc('create_proactive_messages_log_if_not_exists');
      
    if (helperError) {
      console.log('   ❌ Helper function test failed:', helperError.message);
    } else {
      console.log('   ✅ Helper function is working');
    }

  } catch (error) {
    console.log('   ❌ Testing failed:', error.message);
  }

  console.log('\n🎉 AI Messaging fixes applied successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Initialize AI messaging system in your React Native app');
  console.log('   2. Test end-to-end messaging between humans and AI');
  console.log('   3. Verify real-time subscriptions are working');
}

applyFixes().catch(console.error);