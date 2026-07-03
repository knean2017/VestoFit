import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';
import { markHookSeen } from '../../lib/firstLaunch';
import { Button } from '../../components/ui/Button';

export function Slide4CTA({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (active) setShown(true);
  }, [active]);

  async function go(route: '/(auth)/register' | '/(auth)/login') {
    await markHookSeen();
    router.replace(route);
  }

  const enter = (i: number) =>
    reduced ? FadeIn.duration(150) : ZoomIn.delay(i * 120).springify().damping(20).stiffness(300);

  return (
    <View style={styles.container}>
      {shown && (
        <>
          <Animated.View entering={enter(0)} style={styles.textBlock}>
            <Text style={styles.wordmark}>VestoFit</Text>
            <Text style={styles.headline}>Your turn.</Text>
            <Text style={styles.subline}>
              One photo. Your whole wardrobe, styled and rendered on you.
            </Text>
          </Animated.View>
          <Animated.View entering={enter(1)} style={styles.actions}>
            <Button label="Get started" onPress={() => go('/(auth)/register')} fullWidth />
            <Button
              label="I have an account"
              variant="ghost"
              onPress={() => go('/(auth)/login')}
              fullWidth
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xxl,
  },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  wordmark: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.display,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: { gap: theme.spacing.sm },
}));
