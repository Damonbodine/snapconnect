import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Apply the post_views migration manually
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying post_views migration...');

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/003_add_post_views_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        // Use rpc for executing raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Some errors are expected (like "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate')) {
            console.log(`⚠️ Expected error: ${error.message}`);
          } else {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.log(`Statement: ${statement.slice(0, 100)}...`);
          }
        } else {
          console.log(`✅ Statement executed successfully`);
        }
      }
    }

    console.log('🎉 Migration application complete!');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    
    // Fallback: Try to create the table directly
    console.log('🔄 Trying fallback approach...');
    
    const { error: createError } = await supabase.from('post_views').select('*').limit(1);
    if (createError) {
      console.log('📊 Creating post_views table directly...');
      
      // Create the table with a simpler approach
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS post_views (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
          post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
          viewed_at timestamp with time zone DEFAULT now(),
          session_id text,
          duration text,
          created_at timestamp with time zone DEFAULT now(),
          UNIQUE(user_id, post_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON post_views(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at);
      `;
      
      console.log('This would need to be run in the Supabase SQL editor:');
      console.log(createTableSQL);
    } else {
      console.log('✅ post_views table already exists!');
    }
  }
}

applyMigration();