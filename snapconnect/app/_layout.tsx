import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';

export default function RootLayout() {
  const { setUser, setSession, setLoading, clearAuthState } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('Session restoration error (expected for new users):', error.message);
        clearAuthState();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
      } else if (event === 'SIGNED_IN' && session) {
        setSession(session);
        setUser(session.user);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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