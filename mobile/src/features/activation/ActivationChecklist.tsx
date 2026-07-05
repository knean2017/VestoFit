import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';

import { useActivation } from './useActivation';

const HIDE_KEY = 'fitme.activation.hidden';

export function ActivationChecklist() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const reduced = useReducedMotion();
  const { loading, steps, done } = useActivation();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === '1'));
  }, []);

  useEffect(() => {
    if (!loading && done) void AsyncStorage.setItem(HIDE_KEY, '1');
  }, [loading, done]);

  if (loading || done || hidden) return null;

  const completed = steps.filter((s) => s.complete).length;
  const next = steps.find((s) => !s.complete);

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(250)}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Get set up ({completed}/{steps.length})</Text>
          <Text style={styles.subtitle}>Four quick steps to your first try-on.</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Dismiss setup checklist"
          hitSlop={8}
          onPress={() => {
            void AsyncStorage.setItem(HIDE_KEY, '1');
            setHidden(true);
          }}
        >
          <X size={18} color={theme.colors.muted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(completed / steps.length) * 100}%` }]} />
      </View>

      <View style={styles.list}>
        {steps.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={styles.step}
            onPress={() => router.push(s.href as never)}
          >
            <View style={[styles.dot, s.complete ? styles.dotDone : styles.dotTodo]}>
              {s.complete && <Check size={11} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={[styles.stepLabel, s.complete && styles.stepLabelDone]}>
              {s.label}
            </Text>
            {s === next && <Text style={styles.nextBadge}>NEXT</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
    marginTop: 2,
  },
  track: {
    height: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.sand,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
  },
  list: { gap: 2 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: 6,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.colors.accent },
  dotTodo: { borderWidth: 1, borderColor: theme.colors.line },
  stepLabel: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  stepLabelDone: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  nextBadge: {
    marginLeft: 'auto',
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.accent,
  },
}));
