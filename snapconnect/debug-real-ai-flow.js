/**
 * Debug Real AI Flow
 * Test the actual AI response generation that's failing in the logs
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugRealAIFlow() {
  console.log('🔬 Testing Real AI Response Generation Flow...\n');

  try {
    // Get test user and AI user
    const { data: testUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@test.com')
      .single();

    const { data: aiUsers } = await supabase.rpc('get_ai_users');
    const aiUser = aiUsers[0]; // Mike

    console.log('✅ Test setup:');
    console.log(`   Human: ${testUser.full_name} (${testUser.email})`);
    console.log(`   AI: ${aiUser.full_name} (@${aiUser.username})`);

    // Simulate the exact same flow as aiChatService.generateAIResponse
    console.log('\n🔍 Step 1: Simulating user profile fetch...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', testUser.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      return;
    }

    console.log('✅ User profile fetched. Keys:', Object.keys(userProfile));

    // Simulate the exact healthContext creation from aiChatService.ts lines 152-185
    console.log('\n🔍 Step 2: Creating health context exactly like aiChatService...');
    
    const healthContext = userProfile ? {
      profile: {
        fitness_level: userProfile.fitness_level || 'intermediate',
        goals: userProfile.goals || ['general_fitness'],
        current_activity_level: userProfile.current_activity_level || 'lightly_active',
        workout_frequency: userProfile.workout_frequency || 3,
        workout_intensity: userProfile.workout_intensity || 'moderate',
        preferred_workout_duration: userProfile.preferred_workout_duration || 30,
        biggest_fitness_challenge: userProfile.biggest_fitness_challenge,
        primary_motivation: userProfile.primary_motivation,
        injuries_limitations: userProfile.injuries_limitations,
        dietary_preferences: userProfile.dietary_preferences || [],
        full_name: userProfile.full_name,
        age: userProfile.age,
        location: userProfile.city
      },
      currentStats: {
        energy_level: userProfile.energy_level || 5,
        stress_level: userProfile.stress_level || 3,
        current_weight_kg: userProfile.current_weight_kg,
        target_weight_kg: userProfile.target_weight_kg,
        height_cm: userProfile.height_cm
      },
      preferences: {
        coaching_style: userProfile.coaching_style || 'motivational',
        motivation_style: userProfile.motivation_style || 'encouraging',
        feedback_frequency: userProfile.feedback_frequency || 'daily',
        accountability_preference: userProfile.accountability_preference || 'app_only'
      }
    } : {
      profile: { fitness_level: 'intermediate', goals: ['general_fitness'] },
      currentStats: { energy_level: 5, stress_level: 3 },
      preferences: { coaching_style: 'motivational' }
    };

    console.log('✅ Health context created (from aiChatService)');
    console.log('   Profile keys:', Object.keys(healthContext.profile));
    console.log('   CurrentStats keys:', Object.keys(healthContext.currentStats));
    console.log('   Preferences keys:', Object.keys(healthContext.preferences));

    // Now simulate the healthAIService.generateHealthCoachingMessage call
    console.log('\n🔍 Step 3: Testing health coaching request...');
    
    const healthCoachingRequest = {
      healthContext,
      messageType: 'motivation',
      userMessage: 'Hey Mike! I need some motivation today',
      additionalContext: 'Enhanced context from AI chat service',
      maxTokens: 150,
      temperature: 0.8,
    };

    console.log('📋 Health coaching request created:');
    console.log('   - messageType:', healthCoachingRequest.messageType);
    console.log('   - healthContext keys:', Object.keys(healthCoachingRequest.healthContext));

    // Here's where the error happens - let's check what properties are missing
    console.log('\n🔍 Step 4: Checking for properties that health AI service expects...');
    
    // These are the properties that healthAIService.buildHealthCoachingPrompt expects
    const expectedProperties = [
      'todaysSteps',
      'stepGoalProgress', 
      'currentStreak',
      'bestStreak',
      'averageSleepHours',
      'sleepQuality',
      'energyLevel',
      'activityLevel',
      'recoveryScore',
      'daysSinceRest',
      'recentWorkouts',  // This is likely undefined and causing .map() error
      'fitnessLevel',
      'userGoals',
      'preferredWorkoutTypes'  // This might also be undefined
    ];

    console.log('❌ Missing properties in healthContext:');
    for (const prop of expectedProperties) {
      const value = healthCoachingRequest.healthContext[prop];
      const type = typeof value;
      const isArray = Array.isArray(value);
      
      if (value === undefined) {
        console.log(`   ⚠️  ${prop}: undefined`);
      } else {
        console.log(`   ✅ ${prop}: ${type}${isArray ? ' (array)' : ''} = ${JSON.stringify(value)}`);
      }
    }

    // Test the specific problematic lines
    console.log('\n🔍 Step 5: Testing the exact lines that are failing...');
    
    try {
      console.log('Testing recentWorkouts.map() (line 219):');
      const recentWorkoutsTest = healthCoachingRequest.healthContext.recentWorkouts;
      console.log('   - recentWorkouts value:', recentWorkoutsTest);
      console.log('   - type:', typeof recentWorkoutsTest);
      console.log('   - is array:', Array.isArray(recentWorkoutsTest));
      
      if (recentWorkoutsTest && recentWorkoutsTest.map) {
        const result = recentWorkoutsTest.map(w => w.type).join(', ');
        console.log('   ✅ map() successful:', result);
      } else {
        console.log('   ❌ This will cause the "map of undefined" error!');
      }
    } catch (error) {
      console.error('   ❌ Error testing recentWorkouts.map():', error.message);
    }

    try {
      console.log('\nTesting preferredWorkoutTypes.join() (line 224):');
      const preferredWorkoutTypesTest = healthCoachingRequest.healthContext.preferredWorkoutTypes;
      console.log('   - preferredWorkoutTypes value:', preferredWorkoutTypesTest);
      console.log('   - type:', typeof preferredWorkoutTypesTest);
      console.log('   - is array:', Array.isArray(preferredWorkoutTypesTest));
      
      if (preferredWorkoutTypesTest && preferredWorkoutTypesTest.join) {
        const result = preferredWorkoutTypesTest.join(', ');
        console.log('   ✅ join() successful:', result);
      } else {
        console.log('   ❌ This will cause a join error!');
      }
    } catch (error) {
      console.error('   ❌ Error testing preferredWorkoutTypes.join():', error.message);
    }

    console.log('\n📊 ROOT CAUSE ANALYSIS:');
    console.log('The healthContext created by aiChatService is missing properties that');
    console.log('healthAIService expects. The health AI service expects a different');
    console.log('structure than what aiChatService provides.');
    console.log('\n🔧 SOLUTION NEEDED:');
    console.log('Either:');
    console.log('1. Fix aiChatService to provide complete healthContext');
    console.log('2. Fix healthAIService to handle missing properties gracefully');
    console.log('3. Create a mapping layer between the two services');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugRealAIFlow().catch(console.error);