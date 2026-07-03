import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { Sparkles } from 'lucide-react-native';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';

const CHAT: { role: 'user' | 'stylist'; text: string }[] = [
  { role: 'user', text: 'Dinner date tonight. What do I wear?' },
  { role: 'stylist', text: 'Your black slip dress + the cropped denim jacket. Rain later — flats, not heels.' },
  { role: 'user', text: 'Show me on me.' },
];

function TypingDot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const { styles } = useStyles(stylesheet);
  const t = useSharedValue(0.4);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 400 }), -1, true));
    return () => cancelAnimation(t);
  }, [delay, reduced, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View style={[styles.typingDot, style]} />;
}

export function Slide3Stylist({ progress, index }: SlideProps) {
  const { styles, theme } = useStyles(stylesheet);
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [shown, setShown] = useState(false);

  // Bubbles animate in the first time the slide becomes active, then stay.
  useEffect(() => {
    if (active) setShown(true);
  }, [active]);

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return { opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP) };
  });

  const enter = (i: number) =>
    reduced ? FadeIn.duration(150) : FadeInDown.delay(200 + i * 350).springify().damping(20).stiffness(300);

  return (
    <View style={styles.container}>
      <View style={styles.chat}>
        {shown &&
          CHAT.map((msg, i) => (
            <Animated.View
              key={i}
              entering={enter(i)}
              style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.stylistBubble]}
            >
              {msg.role === 'stylist' && (
                <Sparkles size={14} color={theme.colors.accent} strokeWidth={2} />
              )}
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>
                {msg.text}
              </Text>
            </Animated.View>
          ))}
        {shown && (
          <Animated.View entering={enter(CHAT.length)} style={[styles.bubble, styles.stylistBubble]}>
            <TypingDot delay={0} reduced={reduced} />
            <TypingDot delay={130} reduced={reduced} />
            <TypingDot delay={260} reduced={reduced} />
          </Animated.View>
        )}
      </View>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>A stylist who knows you.</Text>
        <Text style={styles.subline}>
          Outfit advice from your actual wardrobe, weather included.
        </Text>
      </Animated.View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  chat: { gap: theme.spacing.sm },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '85%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    ...theme.shadows.soft,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
  stylistBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface },
  bubbleText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  userText: { color: theme.colors.white },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.muted,
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
