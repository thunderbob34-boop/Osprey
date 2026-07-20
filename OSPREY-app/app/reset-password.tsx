import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Theme, Radius, StatusPalette } from '@/constants/theme';
import { Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

/** Pulls access/refresh tokens out of the `#access_token=...&type=recovery` hash
 * Supabase appends to the redirect link in the reset email. */
function parseRecoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const updatePassword = useAuthStore((s) => s.updatePassword);

  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let handled = false;

    // getInitialURL() only covers a cold start — tapping the reset-password
    // email link while the app is already warm/backgrounded routes here via
    // the 'url' event instead, and the recovery tokens in the hash were
    // never read in that case, so a perfectly valid link showed "invalid or
    // expired." Listening for both and using whichever resolves first with
    // real tokens covers both launch paths.
    async function tryEstablish(url: string | null) {
      if (cancelled || handled) return;
      const tokens = url ? parseRecoveryTokens(url) : null;
      if (!tokens) return;
      handled = true;
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (cancelled) return;
      if (setSessionError) {
        setError('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
      } else {
        setSessionReady(true);
      }
      setVerifying(false);
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      tryEstablish(url);
    });

    Linking.getInitialURL().then((url) => {
      if (cancelled || handled) return;
      if (url) {
        tryEstablish(url);
        return;
      }
      // No cold-start URL — give a concurrent 'url' event (the warm-app
      // path) a brief window to arrive before giving up.
      setTimeout(() => {
        if (!cancelled && !handled) {
          setError('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
          setVerifying(false);
        }
      }, 500);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  async function handleSave() {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await updatePassword(password);
    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    await signOut();
    Alert.alert('Password updated', 'Sign in with your new password.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Text style={styles.title}>Reset Password</Text>

        {verifying ? (
          <ActivityIndicator color={Theme.accent} style={{ marginTop: 24 }} />
        ) : sessionReady ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={Theme.textMut}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              accessibilityLabel="New password"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={Theme.textMut}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              accessibilityLabel="Confirm new password"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              style={styles.submitBtn}
              onPress={handleSave}
              disabled={saving}
              busy={saving}
              accessibilityLabel="Save password"
            >
              {saving ? <ActivityIndicator color={Theme.ink} /> : 'Save Password'}
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              style={styles.submitBtn}
              onPress={() => router.replace('/(auth)/sign-in')}
              accessibilityLabel="Back to sign in"
            >
              Back to Sign In
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitle: { fontSize: 13, color: Theme.textMut, marginBottom: 8, textAlign: 'center' },
  form: { gap: 12 },
  input: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Theme.text,
  },
  errorText: { color: StatusPalette.danger, fontSize: 13, textAlign: 'center' },
  submitBtn: { marginTop: 4, paddingVertical: 16 },
});
