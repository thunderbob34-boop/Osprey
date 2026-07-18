import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

type TabIconBaseName = 'home' | 'fitness' | 'create' | 'bar-chart' | 'settings';

function TabIcon({ baseName, color, focused }: { baseName: TabIconBaseName; color: string; focused: boolean }) {
  const name = (focused ? baseName : `${baseName}-outline`) as ComponentProps<typeof Ionicons>['name'];
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const insets = useSafeAreaInsets();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profileReady) {
    return null;
  }

  if (profile && !profile.onboarding_complete) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Theme.ink,
          borderTopColor: Theme.line,
          borderTopWidth: 1,
          paddingTop: 8,
          // Scales to the device's actual home-indicator inset (0 on an SE,
          // ~34 on notched/Dynamic Island phones) instead of a fixed 24 that
          // was either too tight or too loose depending on the device.
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor: Theme.accent,
        tabBarInactiveTintColor: Theme.textMut,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon baseName="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused }) => <TabIcon baseName="fitness" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color, focused }) => <TabIcon baseName="create" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => <TabIcon baseName="bar-chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <TabIcon baseName="settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
