import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F0F0F' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="fitness-level" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="dietary-preferences" />
      <Stack.Screen name="workout-frequency" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}