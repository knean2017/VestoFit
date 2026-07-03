import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active = false, onPress }: ChipProps) {
  const { styles } = useStyles(stylesheet);

  async function handlePress() {
    await Haptics.selectionAsync();
    onPress?.();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[styles.base, active && styles.active]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  base: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs + 2,
    borderRadius: theme.radii.full,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  active: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
  },
  labelActive: { color: theme.colors.white },
}));
