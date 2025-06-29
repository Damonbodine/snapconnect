// Debug script to check database constraints
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
  try {
    console.log('🔍 Checking database constraints...');
    
    // Use RPC to run raw SQL queries
    const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint 
        WHERE conrelid = 'users'::regclass 
          AND (conname LIKE '%motivation_style%' OR conname LIKE '%coaching_style%');
      `
    });
      
    if (constraintError) {
      console.error('❌ Error querying constraints:', constraintError);
    } else {
      console.log('✅ Current constraints:', constraints);
    }
    
    // Check what values are being rejected
    const { data: samples, error: sampleError } = await supabase
      .from('users')
      .select('motivation_style, coaching_style')
      .limit(5);
      
    if (sampleError) {
      console.error('❌ Error querying sample data:', sampleError);
    } else {
      console.log('✅ Sample user data:', samples);
    }
    
  } catch (err) {
    console.error('❌ Script error:', err);
  }
}

checkConstraints().then(() => {
  console.log('✅ Debug complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});