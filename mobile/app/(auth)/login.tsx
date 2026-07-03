import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { api } from '../../src/lib/api';
import { setToken } from '../../src/lib/auth';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useToast } from '../../src/components/ui/Toast';

export default function LoginScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);

  function validate() {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'Enter a valid email';
    if (password.length < 6) e.password = 'Password must be 6+ characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.login(email.trim().toLowerCase(), password);
      await setToken(res.access_token);
      router.replace('/(tabs)/wardrobe');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Login failed');
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
        <Animated.View entering={enter(0)} style={styles.header}>
          <Text style={styles.wordmark}>VestoFit</Text>
          <Text style={styles.tagline}>Your AI fashion studio</Text>
        </Animated.View>

        <View style={styles.form}>
          <Animated.View entering={enter(1)}>
            <Text style={styles.title}>Welcome back</Text>
          </Animated.View>

          <Animated.View entering={enter(2)}>
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
          </Animated.View>
          <Animated.View entering={enter(3)}>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
              placeholder="••••••••"
              returnKeyType="done"
              onSubmitEditing={submit}
              error={errors.password}
            />
          </Animated.View>

          <Animated.View entering={enter(4)}>
            <Button label="Sign in" onPress={submit} loading={loading} fullWidth />
          </Animated.View>

          <Animated.View entering={enter(5)}>
            <Text style={styles.foot}>
              Don&apos;t have an account?{' '}
              <Link href="/(auth)/register" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                Sign up
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
