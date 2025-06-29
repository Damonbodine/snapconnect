import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import { appInitializationService } from '../src/services/appInitialization';

export default function RootLayout() {
  console.log('🔥 RootLayout component rendering!');
  const { setUser, setSession, setLoading, clearAuthState } = useAuthStore();

  useEffect(() => {
    // Get initial session
    console.log('🔐 Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔐 Session check result:', { hasSession: !!session, hasUser: !!session?.user, error: error?.message });
      
      if (error) {
        console.log('Session restoration error (expected for new users):', error.message);
        clearAuthState();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Initialize AI messaging system if user is signed in
      if (session?.user) {
        console.log('🔐 User found in initial session, initializing AI messaging...');
        console.log('🔐 User ID:', session.user.id.substring(0, 8) + '...');
        initializeAIMessaging();
      } else {
        console.log('🔐 No user in initial session, AI messaging will wait for sign-in');
      }
    }).catch((error) => {
      console.log('Session initialization error (expected for new users):', error.message);
      clearAuthState();
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.email?.substring(0, 3) + '***' || 'null');
      
      if (event === 'SIGNED_OUT') {
        clearAuthState();
        // Cleanup AI messaging when user signs out
        appInitializationService.cleanup();
      } else if (event === 'SIGNED_IN' && session) {
        setSession(session);
        setUser(session.user);
        // Initialize AI messaging when user signs in
        console.log('🔐 User signed in, initializing AI messaging...');
        initializeAIMessaging();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize AI messaging system
  const initializeAIMessaging = async () => {
    try {
      console.log('🤖 Initializing complete app services including AI messaging...');
      await appInitializationService.initializeApp();
      console.log('✅ App services initialized - AI messaging ready!');
      
      // Log the status to verify it's working
      const status = appInitializationService.getSystemStatus();
      console.log('🔍 System status:', status);
    } catch (error) {
      console.error('❌ Failed to initialize app services:', error);
      console.error('❌ Error details:', error.message);
      // Don't throw - allow app to continue without AI messaging
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor="#0F0F0F" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F0F' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}