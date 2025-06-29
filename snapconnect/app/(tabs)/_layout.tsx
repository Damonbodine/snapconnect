import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1F1F1F',
          borderTopColor: '#374151',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#EC4899',
        tabBarInactiveTintColor: '#6B7280',
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="clique"
        options={{
          title: 'Clique',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>👥</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 24 }}>📸</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💪</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>👤</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🤖</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null, // This hides the tab from navigation
        }}
      />
    </Tabs>
  );
}