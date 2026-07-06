import React, { useEffect, useState } from 'react';
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
  Alert,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const { signIn, signUp, signInWithApple, signInWithGoogle, sendPasswordReset, loading } =
    useAuthStore();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  async function handleApple() {
    setError('');
    const { error } = await signInWithApple();
    if (error) setError(error);
  }

  async function handleGoogle() {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  }

  async function handleForgotPassword() {
    setError('');
    if (!email) {
      setError('Enter your email above, then tap "Forgot password?" again.');
      return;
    }
    setResetSending(true);
    const { error } = await sendPasswordReset(email);
    setResetSending(false);
    if (error) {
      setError(error);
      return;
    }
    Alert.alert(
      'Check your email',
      `We sent a password reset link to ${email}. Follow it to set a new password.`,
    );
  }

  async function handleSubmit() {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'signup') {
      if (!displayName) {
        setError('What should Ozzie call you?');
        return;
      }
      const { error } = await signUp(email, password, displayName);
      if (error) setError(error);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Ozzie wordmark */}
        <View style={styles.brandBlock}>
          <Text style={styles.osprey}>OSPREY</Text>
          <Text style={styles.tagline}>Your coach, your hype man, your guy.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              accessibilityLabel="Your name"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            accessibilityLabel="Email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel="Password"
          />

          {mode === 'signin' ? (
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
              disabled={resetSending}
              accessibilityRole="button"
              accessibilityLabel="Forgot password?"
              accessibilityState={{ disabled: resetSending, busy: resetSending }}
            >
              <Text style={styles.forgotPasswordText}>
                {resetSending ? 'Sending...' : 'Forgot password?'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          >
            <Text style={styles.switchModeText}>
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          {/* ── Social sign-in ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleApple}
            />
          ) : null}

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text style={styles.googleBtnG}>G</Text>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  osprey: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.teal,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  form: {
    gap: 12,
  },
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
  errorText: {
    color: Colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
  forgotPassword: {
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.teal,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  appleBtn: {
    height: 50,
    width: '100%',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 50,
  },
  googleBtnG: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
});
