import React, { useState } from 'react';
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
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

type Mode = 'signin' | 'signup' | 'reset';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, loading, resetPasswordForEmail } = useAuthStore();

  async function handleSubmit() {
    setError('');

    if (mode === 'reset') {
      if (!email) {
        setError('Enter your email to reset your password.');
        return;
      }
      const { error } = await resetPasswordForEmail(email);
      if (error) setError(error);
      else setResetSent(true);
      return;
    }

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
          {mode === 'reset' && resetSent ? (
            <>
              <Text style={styles.resetSentText}>
                If an account exists for {email}, a password reset link is on its way. Check your inbox.
              </Text>
              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => {
                  setMode('signin');
                  setResetSent(false);
                  setError('');
                }}
              >
                <Text style={styles.switchModeText}>Back to sign in</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
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
              />
              {mode !== 'reset' && (
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              )}

              {mode === 'signin' && (
                <TouchableOpacity
                  onPress={() => {
                    setMode('reset');
                    setError('');
                  }}
                  style={styles.forgotPasswordLink}
                >
                  <Text style={styles.switchModeText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => {
                  setMode(mode === 'signup' ? 'signin' : mode === 'reset' ? 'signin' : 'signup');
                  setError('');
                }}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'signup'
                    ? 'Already have an account? Sign in'
                    : mode === 'reset'
                      ? 'Back to sign in'
                      : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </>
          )}
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
  forgotPasswordLink: {
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  resetSentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});
