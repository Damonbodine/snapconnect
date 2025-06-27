// Actually connect and check current database state
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1YmZ5anpkZmdwb29jc3N3cmt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcxNDg1NCwiZXhwIjoyMDY2MjkwODU0fQ.vD50MaIr3sQaL1qMX4JufEe1ESQnUutd7FPLPS2DiKI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  console.log('🧪 Testing what values actually work...');
  
  // Try to insert a test record with different values to see what constraints exist
  const testValues = [
    { motivation_style: 'supportive', coaching_style: 'motivational' },
    { motivation_style: 'encouraging', coaching_style: 'motivational' }, 
    { motivation_style: 'competitive', coaching_style: 'firm' },
    { motivation_style: 'analytical', coaching_style: 'educational' }
  ];
  
  for (const values of testValues) {
    try {
      console.log(`\n🔍 Testing: motivation_style="${values.motivation_style}", coaching_style="${values.coaching_style}"`);
      
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: `test-${Date.now()}@example.com`,
          username: `testuser${Date.now()}`,
          fitness_level: 'beginner',
          goals: ['fitness'],
          dietary_preferences: [],
          workout_frequency: 3,
          motivation_style: values.motivation_style,
          coaching_style: values.coaching_style,
          is_mock_user: false
        })
        .select()
        .single();
        
      if (error) {
        console.log(`❌ FAILED: ${error.message}`);
        if (error.code === '23514') {
          console.log(`   🚫 Constraint violation - this value is NOT allowed`);
        }
      } else {
        console.log(`✅ SUCCESS: Values are allowed`);
        // Clean up - delete the test record
        await supabase.from('users').delete().eq('id', data.id);
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
    }
  }
  
  // Also check what values currently exist in the database
  console.log('\n📊 Current values in database:');
  const { data: existing } = await supabase
    .from('users')
    .select('motivation_style, coaching_style')
    .not('motivation_style', 'is', null)
    .limit(10);
    
  if (existing) {
    const motivationValues = [...new Set(existing.map(u => u.motivation_style))];
    const coachingValues = [...new Set(existing.map(u => u.coaching_style))];
    console.log('📝 Existing motivation_style values:', motivationValues);
    console.log('📝 Existing coaching_style values:', coachingValues);
  }
}

testInsert().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});