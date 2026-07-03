import React from 'react';
import { View } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

interface CardProps {
  elevated?: boolean;
  padded?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
  children?: React.ReactNode;
}

export function Card({ elevated = false, padded = true, style, children }: CardProps) {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={[styles.base, elevated ? styles.elevated : styles.bordered, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  base: {
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  padded: { padding: theme.spacing.md },
  bordered: {
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  elevated: { ...theme.shadows.card },
}));
