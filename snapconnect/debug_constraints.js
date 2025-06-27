// Debug script to check database constraints
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1YmZ5anpkZmdwb29jc3N3cmt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcxNDg1NCwiZXhwIjoyMDY2MjkwODU0fQ.vD50MaIr3sQaL1qMX4JufEe1ESQnUutd7FPLPS2DiKI';

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