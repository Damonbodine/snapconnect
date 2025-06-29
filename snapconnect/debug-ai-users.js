const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debugAIUsers() {
  console.log('🔍 Debugging AI Users...');
  
  try {
    // Check if get_ai_users function exists and works
    console.log('\n1. Testing get_ai_users function:');
    const { data: aiUsersFromFunction, error: functionError } = await supabase.rpc('get_ai_users');
    
    if (functionError) {
      console.error('❌ get_ai_users function error:', functionError);
    } else {
      console.log('✅ get_ai_users function works:', aiUsersFromFunction?.length || 0, 'users found');
      if (aiUsersFromFunction && aiUsersFromFunction.length > 0) {
        console.log('   First AI user sample:', {
          id: aiUsersFromFunction[0].user_id,
          username: aiUsersFromFunction[0].username,
          full_name: aiUsersFromFunction[0].full_name,
        });
      }
    }
    
    // Check direct users table query
    console.log('\n2. Direct users table query:');
    const { data: directUsers, error: directError } = await supabase
      .from('users')
      .select('id, username, full_name, is_mock_user, personality_traits')
      .eq('is_mock_user', true)
      .limit(5);
    
    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      console.log('✅ Direct query works:', directUsers?.length || 0, 'AI users found');
      if (directUsers && directUsers.length > 0) {
        console.log('   Sample AI users:');
        directUsers.forEach((user, i) => {
          console.log(`   ${i + 1}. ${user.username} (${user.full_name}) - ID: ${user.id}`);
        });
      }
    }
    
    // Check specific AI user by ID (from your logs)
    console.log('\n3. Checking specific AI user from your chat logs:');
    const aiUserId = 'bb09fa6c-79b7-4d2b-88c3-f74ff3f85826'; // From your logs
    const { data: specificUser, error: specificError } = await supabase
      .from('users')
      .select('*')
      .eq('id', aiUserId)
      .single();
    
    if (specificError) {
      console.error('❌ Specific user query error:', specificError);
    } else {
      console.log('✅ Found specific AI user:', {
        id: specificUser.id,
        username: specificUser.username,
        full_name: specificUser.full_name,
        is_mock_user: specificUser.is_mock_user,
        has_personality: !!specificUser.personality_traits,
      });
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugAIUsers();