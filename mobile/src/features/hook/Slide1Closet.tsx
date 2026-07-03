import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { Shirt, ShoppingBag, Glasses, Footprints, Watch } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { SlideProps } from './types';

/** Garment scatter: icon, position (fraction of slide), size, layer depth factor. */
const GARMENTS: {
  Icon: LucideIcon;
  x: number;
  y: number;
  size: number;
  factor: number;
  rotate: string;
}[] = [
  { Icon: Shirt, x: 0.12, y: 0.16, size: 96, factor: 0.4, rotate: '-12deg' },
  { Icon: ShoppingBag, x: 0.68, y: 0.12, size: 72, factor: 0.7, rotate: '8deg' },
  { Icon: Glasses, x: 0.72, y: 0.62, size: 64, factor: 0.4, rotate: '-6deg' },
  { Icon: Footprints, x: 0.1, y: 0.66, size: 80, factor: 1.0, rotate: '10deg' },
  { Icon: Watch, x: 0.44, y: 0.08, size: 56, factor: 1.0, rotate: '-4deg' },
];

function ParallaxGarment({
  progress,
  index,
  item,
  width,
  height,
  reduced,
}: {
  progress: SharedValue<number>;
  index: number;
  item: (typeof GARMENTS)[number];
  width: number;
  height: number;
  reduced: boolean;
}) {
  const { theme } = useStyles(stylesheet);
  const style = useAnimatedStyle(() => {
    // Pane already moves at 1x; add relative offset so net speed = factor.
    const extra = reduced ? 0 : (index - progress.value) * width * (item.factor - 1);
    return { transform: [{ translateX: extra }, { rotate: item.rotate }] };
  });
  const { Icon } = item;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: item.x * width, top: item.y * height, opacity: 0.55 },
        style,
      ]}
    >
      <Icon size={item.size} color={theme.colors.accentLight} strokeWidth={1.4} />
    </Animated.View>
  );
}

export function Slide1Closet({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: reduced ? 0 : interpolate(d, [0, 1], [0, 32], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={styles.container}>
      {GARMENTS.map((item, i) => (
        <ParallaxGarment
          key={i}
          progress={progress}
          index={index}
          item={item}
          width={width}
          height={height}
          reduced={reduced}
        />
      ))}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>Your closet. Digital.</Text>
        <Text style={styles.subline}>
          Every piece you own, photographed once, organized forever.
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
  },
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
