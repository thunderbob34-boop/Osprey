import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function OnboardingLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile?.onboarding_complete) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
