import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { api } from '../../src/lib/api';
import { setToken } from '../../src/lib/auth';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useToast } from '../../src/components/ui/Toast';

export default function RegisterScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'Enter a valid email';
    if (password.length < 8) e.password = 'Password must be 8+ characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.register(email.trim().toLowerCase(), password);
      await setToken(res.access_token);
      router.replace('/(onboard)');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>VestoFit</Text>
          <Text style={styles.tagline}>Your AI fashion studio</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Create account</Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            error={errors.email}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            secureToggle
            placeholder="8+ characters"
            error={errors.password}
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            secureToggle
            placeholder="Repeat password"
            returnKeyType="done"
            onSubmitEditing={submit}
            error={errors.confirm}
          />

          <Button label="Create account" onPress={submit} loading={loading} fullWidth />

          <Text style={styles.foot}>
            Already have an account?{' '}
            <Link href="/(auth)/login" style={{ color: theme.colors.accent, fontWeight: '700' }}>
              Sign in
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  header: { alignItems: 'center', gap: theme.spacing.xs },
  wordmark: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.display,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
  },
  form: { gap: theme.spacing.md },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
    marginBottom: theme.spacing.xs,
  },
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
}));
