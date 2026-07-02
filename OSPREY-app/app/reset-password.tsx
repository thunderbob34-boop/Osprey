import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';

// Supabase's password-reset email links to redirectTo (osprey://reset-password)
// with either `?code=...` (PKCE) or a `#access_token=...&refresh_token=...`
// hash fragment (implicit flow — the default when no flowType is configured,
// which is the case here), depending on project config. Expo Router's
// useLocalSearchParams only sees query params, not hash fragments, so this
// screen parses the raw deep-link URL itself to catch either shape.
// Must split on '#' BEFORE '?': a hash-only URL like
// "osprey://reset-password#access_token=...&refresh_token=..." has no '?'
// at all, so splitting on '?' first throws the token params away entirely.
function parseAuthParams(url: string): { code?: string; accessToken?: string; refreshToken?: string } {
  const hashIndex = url.indexOf('#');
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const queryPart = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  const params = new URLSearchParams(queryPart);
  new URLSearchParams(hashPart).forEach((v, k) => params.set(k, v));

  return {
    code: params.get('code') ?? undefined,
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
  };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword, loading } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'ready' | 'invalid'>('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let handled = false;

    async function handleUrl(url: string | null) {
      if (!url || handled) return;
      const { code, accessToken, refreshToken } = parseAuthParams(url);
      if (!code && !(accessToken && refreshToken)) return; // not a recovery link — keep waiting
      handled = true;
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
          if (error) throw error;
        }
        setStatus('ready');
      } catch {
        setStatus('invalid');
      }
    }

    // Cold start: the app was launched by tapping the reset link.
    ExpoLinking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      } else if (!handled) {
        setStatus('invalid');
      }
    });

    // Warm start: the app was already running when the link was tapped.
    const subscription = ExpoLinking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  async function handleSetPassword() {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const { error } = await updatePassword(password);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => router.replace('/'), 1500);
      return () => clearTimeout(timer);
    }
  }, [done, router]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.brandBlock}>
          <Text style={styles.osprey}>OSPREY</Text>
        </View>

        {status === 'verifying' ? (
          <ActivityIndicator color={Colors.teal} />
        ) : status === 'invalid' ? (
          <View style={styles.form}>
            <Text style={styles.messageText}>
              This reset link is invalid or has expired. Request a new one from the sign-in screen.
            </Text>
            <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace('/')}>
              <Text style={styles.submitBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : done ? (
          <Text style={styles.messageText}>Password updated. Taking you back in…</Text>
        ) : (
          <View style={styles.form}>
            <Text style={styles.messageText}>Choose a new password.</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Set Password</Text>}
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
  brandBlock: { alignItems: 'center', marginBottom: 32 },
  osprey: { fontSize: 32, fontWeight: '900', color: Colors.teal, letterSpacing: 4 },
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
  messageText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
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
