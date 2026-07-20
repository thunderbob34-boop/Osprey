import React, { useEffect, useRef, useState } from 'react';
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
  Linking,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/constants/links';

// Initialize WebBrowser only if available (not in dev builds without native modules)
try {
  const WebBrowser = require('expo-web-browser');
  if (WebBrowser?.maybeCompleteAuthSession) {
    WebBrowser.maybeCompleteAuthSession();
  }
} catch {
  // Module not available — continue without it
}

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const { signIn, signUp, signInWithApple, signInWithGoogle, sendPasswordReset, loading } =
    useAuthStore();
  const passwordRef = useRef<TextInput>(null);

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
          <Text style={styles.tagline}>Your coach in your corner.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Theme.textMut}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              accessibilityLabel="Your name"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Theme.textMut}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            accessibilityLabel="Email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={Theme.textMut}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel="Password"
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.showPasswordBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Theme.textMut} />
            </TouchableOpacity>
          </View>

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
                {resetSending ? 'Sending…' : 'Forgot password?'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={Theme.ink} />
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
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {mode === 'signup' ? (
            <Text style={styles.legalText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_OF_USE_URL).catch(() => undefined)}>
                Terms of Use
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}>
                Privacy Policy
              </Text>
              .
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.ink,
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
    color: Theme.accent,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: Theme.textMut,
    marginTop: 6,
    fontStyle: 'italic',
  },
  form: {
    gap: 12,
  },
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
  errorText: {
    color: StatusPalette.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  showPasswordBtn: {
    position: 'absolute',
    right: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPassword: {
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Theme.accent,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.ink,
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    color: Theme.textMut,
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
    backgroundColor: Theme.line,
  },
  dividerText: {
    fontSize: 12,
    color: Theme.textMut,
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
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  legalText: {
    fontSize: 11,
    color: Theme.textMut,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  legalLink: {
    color: Theme.accent,
    fontWeight: '600',
  },
});
