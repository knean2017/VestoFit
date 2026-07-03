import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  labelStyle,
}: ButtonProps) {
  const { styles } = useStyles(stylesheet);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 20, stiffness: 300 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }

  async function handlePress() {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <AnimatedTouchable
      activeOpacity={0.85}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[`variant_${variant}` as keyof typeof styles] as ViewStyle,
        styles[`size_${size}` as keyof typeof styles] as ViewStyle,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        animStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : undefined}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            styles[`labelVariant_${variant}` as keyof typeof styles] as TextStyle,
            styles[`labelSize_${size}` as keyof typeof styles] as TextStyle,
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedTouchable>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  variant_primary: {
    backgroundColor: theme.colors.accent,
  },
  variant_secondary: {
    backgroundColor: theme.colors.sand,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: theme.colors.error,
  },

  // Sizes
  size_sm: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    minHeight: 48,
  },
  size_lg: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    minHeight: 56,
  },

  // Labels
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
  },
  labelVariant_primary: { color: theme.colors.white },
  labelVariant_secondary: { color: theme.colors.ink },
  labelVariant_ghost: { color: theme.colors.accent },
  labelVariant_danger: { color: theme.colors.white },
  labelSize_sm: { fontSize: theme.typography.sizes.sm },
  labelSize_md: { fontSize: theme.typography.sizes.md },
  labelSize_lg: { fontSize: theme.typography.sizes.lg },
}));

