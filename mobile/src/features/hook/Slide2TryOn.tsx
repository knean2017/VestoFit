import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';

// Static assets must use require() in React Native (Metro bundler)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BEFORE = require('../../../assets/demo/morph-before.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AFTER = require('../../../assets/demo/morph-after.png');

export function Slide2TryOn({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [imageFailed, setImageFailed] = useState(false);

  // 0 = before visible, 1 = after visible. Loops while slide is active.
  const fade = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (active && !reduced) {
      fade.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
    } else {
      cancelAnimation(fade);
      if (reduced) fade.value = 1; // static "after" image
    }
    return () => cancelAnimation(fade);
  }, [active, reduced, fade]);

  const afterStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return { opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP) };
  });

  return (
    <View style={styles.container}>
      {!imageFailed && (
        <View style={styles.frame}>
          <Image
            source={BEFORE}
            style={styles.photo}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
          <Animated.View style={[styles.photoOverlay, afterStyle]}>
            <Image
              source={AFTER}
              style={styles.photo}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          </Animated.View>
        </View>
      )}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>Try it on. Before you buy.</Text>
        <Text style={styles.subline}>
          AI renders any garment on your own photo in seconds.
        </Text>
      </Animated.View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  frame: {
    width: 220,
    height: 293, // 3:4
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.sand,
    ...theme.shadows.lifted,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
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
}));
