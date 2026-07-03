import React, { useState } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { markHookSeen } from '../../src/lib/firstLaunch';
import { ProgressDots } from '../../src/features/hook/ProgressDots';
import { Slide1Closet } from '../../src/features/hook/Slide1Closet';
import { Slide2TryOn } from '../../src/features/hook/Slide2TryOn';
import { Slide3Stylist } from '../../src/features/hook/Slide3Stylist';
import { Slide4CTA } from '../../src/features/hook/Slide4CTA';

const SLIDE_COUNT = 4;
const SPRING = { damping: 20, stiffness: 300 };
const SLIDES = [Slide1Closet, Slide2TryOn, Slide3Stylist, Slide4CTA];

/** One slide pane, absolutely positioned, translated by pager progress. */
function SlidePane({
  progress,
  index,
  width,
  children,
}: {
  progress: SharedValue<number>;
  index: number;
  width: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - progress.value) * width }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width }, style]}>
      {children}
    </Animated.View>
  );
}

export default function HookScreen() {
  const { styles } = useStyles(stylesheet);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (rounded, prev) => {
      if (rounded !== prev) runOnJS(setActiveIndex)(rounded);
    },
  );

  function snapTick() {
    Haptics.selectionAsync();
  }

  async function skip() {
    await markHookSeen();
    router.replace('/(auth)/login');
  }

  function goToSlide(target: number) {
    const clamped = Math.min(Math.max(target, 0), SLIDE_COUNT - 1);
    progress.value = withSpring(clamped, SPRING);
  }

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    switch (event.nativeEvent.actionName) {
      case 'increment':
        goToSlide(activeIndex + 1);
        break;
      case 'decrement':
        goToSlide(activeIndex - 1);
        break;
      default:
        break;
    }
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((e) => {
      const raw = startProgress.value - e.translationX / width;
      // Soft overscroll of 0.15 slide at each edge.
      progress.value = Math.min(Math.max(raw, -0.15), SLIDE_COUNT - 1 + 0.15);
    })
    .onEnd((e) => {
      const startIndex = Math.round(startProgress.value);
      const fling = -e.velocityX / width;
      const target = Math.round(progress.value + fling * 0.2);
      const clamped = Math.min(Math.max(target, 0), SLIDE_COUNT - 1);
      progress.value = withSpring(clamped, SPRING);
      if (clamped !== startIndex) {
        runOnJS(snapTick)();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        {SLIDES.map((Slide, i) => (
          <SlidePane key={i} progress={progress} index={i} width={width}>
            <Slide progress={progress} index={i} />
          </SlidePane>
        ))}

        <Pressable
          testID="hook-skip"
          onPress={skip}
          style={[styles.skip, { top: insets.top + 12 }]}
          hitSlop={12}
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>

        <View style={[styles.dots, { bottom: insets.bottom + 24 }]}>
          <ProgressDots
            progress={progress}
            count={SLIDE_COUNT}
            activeIndex={activeIndex}
            onAccessibilityAction={onAccessibilityAction}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  skip: {
    position: 'absolute',
    right: theme.spacing.lg,
    zIndex: 10,
    paddingVertical: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
  },
  skipLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
  },
  dots: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
}));
