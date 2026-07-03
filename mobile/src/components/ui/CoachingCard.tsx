import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

interface Step {
  icon: string;
  text: string;
}

interface CoachingCardProps {
  emoji: string;
  title: string;
  subtitle?: string;
  steps: Step[];
  children?: React.ReactNode;
}

export function CoachingCard({ emoji, title, subtitle, steps, children }: CoachingCardProps) {
  const { styles } = useStyles(stylesheet);
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.steps}>
        {steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={styles.stepIcon}>{step.icon}</Text>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
      </View>
      {children}
    </Animated.View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  card: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emoji: { fontSize: 52, marginBottom: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xs,
  },
  steps: {
    width: '100%',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.sand,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNum: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xs,
    color: '#fff',
  },
  stepIcon: { fontSize: 18, flexShrink: 0 },
  stepText: {
    flex: 1,
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
    lineHeight: 18,
  },
}));
