import { Redirect } from 'expo-router';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { Theme } from '@/constants/theme';
import { Button } from '@/components/ui';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const profileError = useAuthStore((s) => s.profileError);
  const initialized = useAuthStore((s) => s.initialized);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  if (!initialized || (session && !profileReady)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Theme.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Could not load profile</Text>
        {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
        <Button style={styles.retryBtn} onPress={() => fetchProfile()} accessibilityLabel="Try again">
          Try Again
        </Button>
      </View>
    );
  }

  if (!profile.onboarding_complete) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.ink,
    padding: 28,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.text,
  },
  errorText: {
    fontSize: 13,
    color: Theme.textMut,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: { marginTop: 8 },
});
