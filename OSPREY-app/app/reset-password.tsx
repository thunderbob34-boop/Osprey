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
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/colors';
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
    let resolved = false;

    async function tryUrl(url: string | null): Promise<boolean> {
      const tokens = url ? parseRecoveryTokens(url) : null;
      if (!tokens || cancelled || resolved) return false;
      resolved = true;
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (cancelled) return true;
      if (setSessionError) {
        setError('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
      } else {
        setSessionReady(true);
      }
      setVerifying(false);
      return true;
    }

    // Linking.getInitialURL() only returns the URL that cold-launched the
    // app. If OSPREY was already running/backgrounded when the reset link
    // was tapped (the app resumes rather than cold-launching), the tokens
    // arrive via the 'url' event instead — subscribe to both so a warm
    // start doesn't strand the user on "invalid or expired link".
    const subscription = Linking.addEventListener('url', ({ url }) => {
      tryUrl(url);
    });

    Linking.getInitialURL().then(async (url) => {
      const handled = await tryUrl(url);
      if (!handled && !cancelled && !resolved) {
        // Give the 'url' event a brief window in case it fires just after
        // mount (warm start) before giving up.
        setTimeout(() => {
          if (!cancelled && !resolved) {
            setError('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
            setVerifying(false);
          }
        }, 1500);
      }
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
          <ActivityIndicator color={Colors.teal} style={{ marginTop: 24 }} />
        ) : sessionReady ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              accessibilityLabel="New password"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              accessibilityLabel="Confirm new password"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save password"
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>Save Password</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => router.replace('/(auth)/sign-in')}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.submitBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginBottom: 8, textAlign: 'center' },
  form: { gap: 12 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  errorText: { color: Colors.red, fontSize: 13, textAlign: 'center' },
  submitBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
