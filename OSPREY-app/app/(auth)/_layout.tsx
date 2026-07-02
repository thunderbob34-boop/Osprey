import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (session && profile?.onboarding_complete) {
    return <Redirect href="/(tabs)" />;
  }

  if (session && profile && !profile.onboarding_complete) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
