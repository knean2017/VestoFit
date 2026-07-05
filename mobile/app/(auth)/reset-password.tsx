import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { api } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useToast } from '../../src/components/ui/Toast';

export default function ResetPasswordScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});

  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);

  function validate() {
    const e: typeof errors = {};
    if (!token.trim()) e.token = 'Paste the code from your email';
    if (password.length < 8) e.password = 'Password must be 8+ characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.resetPassword(token.trim(), password);
      toast('success', 'Password updated — sign in with it now');
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enter(0)} style={styles.header}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Paste the reset code from your email</Text>
        </Animated.View>

        <View style={styles.form}>
          <Animated.View entering={enter(1)}>
            <Input
              label="Reset code"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste code"
              error={errors.token}
            />
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
              placeholder="8+ characters"
              error={errors.password}
            />
          </Animated.View>
          <Animated.View entering={enter(3)}>
            <Input
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              secureToggle
              returnKeyType="done"
              onSubmitEditing={submit}
              error={errors.confirm}
            />
          </Animated.View>
          <Animated.View entering={enter(4)}>
            <Button label="Reset password" onPress={submit} loading={loading} fullWidth />
          </Animated.View>
          <Animated.View entering={enter(5)}>
            <Text style={styles.foot}>
              <Link href="/(auth)/login" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                ← Back to sign in
              </Link>
            </Text>
          </Animated.View>
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
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
}));
