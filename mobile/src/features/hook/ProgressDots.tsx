import React from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

function Dot({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const { styles } = useStyles(stylesheet);
  const style = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      width: interpolate(d, [0, 1], [24, 8], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function ProgressDots({
  progress,
  count,
  activeIndex,
  onAccessibilityAction,
}: {
  progress: SharedValue<number>;
  count: number;
  activeIndex: number;
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
}) {
  const { styles } = useStyles(stylesheet);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Intro slides"
      accessibilityValue={{ min: 0, max: count - 1, now: activeIndex }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} progress={progress} index={i} />
      ))}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  row: { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
  dot: {
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
  },
}));
