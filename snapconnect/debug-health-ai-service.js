/**
 * Debug Health AI Service
 * Comprehensive logging to identify the "map of undefined" error
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Mock the health context structure
function createMockHealthContext(userProfile) {
  console.log('🔍 Creating mock health context from user profile:');
  console.log('   User profile keys:', Object.keys(userProfile || {}));
  
  const healthContext = {
    profile: {
      fitness_level: userProfile?.fitness_level || 'intermediate',
      goals: userProfile?.goals || ['general_fitness'],
      current_activity_level: userProfile?.current_activity_level || 'lightly_active',
      workout_frequency: userProfile?.workout_frequency || 3,
      workout_intensity: userProfile?.workout_intensity || 'moderate',
      preferred_workout_duration: userProfile?.preferred_workout_duration || 30,
      biggest_fitness_challenge: userProfile?.biggest_fitness_challenge,
      primary_motivation: userProfile?.primary_motivation,
      injuries_limitations: userProfile?.injuries_limitations,
      dietary_preferences: userProfile?.dietary_preferences || [],
      full_name: userProfile?.full_name,
      age: userProfile?.age,
      location: userProfile?.city
    },
    currentStats: {
      energy_level: userProfile?.energy_level || 5,
      stress_level: userProfile?.stress_level || 3,
      current_weight_kg: userProfile?.current_weight_kg,
      target_weight_kg: userProfile?.target_weight_kg,
      height_cm: userProfile?.height_cm
    },
    preferences: {
      coaching_style: userProfile?.coaching_style || 'motivational',
      motivation_style: userProfile?.motivation_style || 'encouraging',
      feedback_frequency: userProfile?.feedback_frequency || 'daily',
      accountability_preference: userProfile?.accountability_preference || 'app_only'
    },
    // Health AI Service specific fields that might be missing
    todaysSteps: 5000,
    stepGoalProgress: 75,
    currentStreak: 3,
    bestStreak: 7,
    averageSleepHours: 7.5,
    sleepQuality: 8,
    energyLevel: userProfile?.energy_level || 5,
    activityLevel: 'moderate',
    recoveryScore: 7,
    daysSinceRest: 1,
    recentWorkouts: [], // This might be undefined causing the error
    fitnessLevel: userProfile?.fitness_level || 'intermediate',
    userGoals: {
      primary: Array.isArray(userProfile?.goals) ? userProfile.goals[0] : 'general_fitness'
    },
    preferredWorkoutTypes: ['walking', 'strength'], // This might be undefined
    availableTime: userProfile?.preferred_workout_duration || 30,
    restingHeartRate: 70,
    lastWorkoutIntensity: 'moderate',
    stepTrends: 'increasing',
    workoutFrequencyTrend: 'consistent'
  };

  console.log('✅ Mock health context created:');
  console.log('   - recentWorkouts:', healthContext.recentWorkouts);
  console.log('   - preferredWorkoutTypes:', healthContext.preferredWorkoutTypes);
  console.log('   - userGoals:', healthContext.userGoals);
  
  return healthContext;
}

async function debugHealthAIService() {
  console.log('🔬 Starting Health AI Service Debug Session...\n');

  try {
    // Get a test user
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@test.com')
      .single();

    if (userError || !testUser) {
      console.log('❌ Could not find test user. Using minimal mock data.');
      var userProfile = { fitness_level: 'intermediate', goals: ['general_fitness'] };
    } else {
      console.log('✅ Found test user:', testUser.email);
      var userProfile = testUser;
    }

    // Create health context
    const healthContext = createMockHealthContext(userProfile);

    // Test different message types that are failing
    const testCases = [
      {
        messageType: 'motivation',
        userMessage: 'I need some motivation today',
        description: 'Motivation message test'
      },
      {
        messageType: 'advice', 
        userMessage: 'What workout should I do?',
        description: 'Advice message test'
      },
      {
        messageType: 'celebration',
        userMessage: 'I completed my workout!',
        description: 'Celebration message test'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      console.log(`   Message type: ${testCase.messageType}`);
      console.log(`   User message: "${testCase.userMessage}"`);

      try {
        // Simulate the health coaching request
        const request = {
          healthContext,
          messageType: testCase.messageType,
          userMessage: testCase.userMessage,
          maxTokens: 150,
          temperature: 0.8,
          additionalContext: 'Test context for debugging'
        };

        console.log('📋 Health coaching request:');
        console.log('   - healthContext keys:', Object.keys(request.healthContext));
        console.log('   - recentWorkouts type:', typeof request.healthContext.recentWorkouts);
        console.log('   - recentWorkouts value:', request.healthContext.recentWorkouts);
        console.log('   - preferredWorkoutTypes type:', typeof request.healthContext.preferredWorkoutTypes);
        console.log('   - preferredWorkoutTypes value:', request.healthContext.preferredWorkoutTypes);

        // Test the prompt building function that's likely causing the error
        console.log('\n🔍 Testing prompt building logic...');
        
        // Simulate the problematic lines from buildHealthCoachingPrompt
        console.log('Testing line 219 equivalent:');
        const recentWorkoutsString = request.healthContext.recentWorkouts?.map ? 
          request.healthContext.recentWorkouts.map(w => w.type).join(', ') : 'None';
        console.log('   ✅ recentWorkouts string:', recentWorkoutsString);

        console.log('Testing line 224 equivalent:');
        const preferredWorkoutsString = Array.isArray(request.healthContext.preferredWorkoutTypes) ?
          request.healthContext.preferredWorkoutTypes.join(', ') : 'Not specified';
        console.log('   ✅ preferredWorkouts string:', preferredWorkoutsString);

        console.log('Testing line 311 equivalent:');
        const recentWorkoutsDetailed = request.healthContext.recentWorkouts?.slice ? 
          request.healthContext.recentWorkouts.slice(0, 3).map(w => 
            `${w.type} (${w.duration}min, ${w.intensity || 'unknown'} intensity)`
          ).join(', ') : 'None this week';
        console.log('   ✅ recentWorkouts detailed:', recentWorkoutsDetailed);

        console.log(`✅ ${testCase.description} - prompt building successful`);

      } catch (error) {
        console.error(`❌ ${testCase.description} failed:`, error.message);
        console.error('   Full error:', error);
        
        // Analyze the specific error
        if (error.message.includes("Cannot read property 'map' of undefined")) {
          console.log('\n🔍 MAP ERROR ANALYSIS:');
          console.log('   - healthContext.recentWorkouts:', request.healthContext.recentWorkouts);
          console.log('   - typeof recentWorkouts:', typeof request.healthContext.recentWorkouts);
          console.log('   - is array?:', Array.isArray(request.healthContext.recentWorkouts));
          console.log('   - has map?:', request.healthContext.recentWorkouts?.map !== undefined);
          
          console.log('   - healthContext.preferredWorkoutTypes:', request.healthContext.preferredWorkoutTypes);
          console.log('   - typeof preferredWorkoutTypes:', typeof request.healthContext.preferredWorkoutTypes);
          console.log('   - is array?:', Array.isArray(request.healthContext.preferredWorkoutTypes));
          console.log('   - has join?:', request.healthContext.preferredWorkoutTypes?.join !== undefined);
        }
      }
    }

    console.log('\n📊 Debug Summary:');
    console.log('- All test cases completed');
    console.log('- Check above for specific failures');
    console.log('- Look for "MAP ERROR ANALYSIS" sections for detailed breakdowns');

  } catch (error) {
    console.error('❌ Debug session failed:', error);
  }
}

debugHealthAIService().catch(console.error);