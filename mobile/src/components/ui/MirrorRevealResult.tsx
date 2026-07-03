import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface Props {
  uri: string;
  aspectRatio?: number;
}

/**
 * Reveals a result image with a 3D mirror-flip animation — starts nearly edge-on
 * (like a mirror facing away) and springs to face the viewer. A brief reflection
 * flash runs once the flip lands, mimicking a mirror clearing.
 */
export function MirrorRevealResult({ uri, aspectRatio = 3 / 4 }: Props) {
  const rotY = useSharedValue(-88);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    rotY.value = withSpring(0, { damping: 16, stiffness: 90 }, (finished) => {
      if (!finished) return;
      // Brief white flash simulating a mirror clearing
      flashOpacity.value = withSequence(
        withTiming(0.28, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${rotY.value}deg` }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <Animated.View style={[{ width: '100%', aspectRatio, overflow: 'hidden', borderRadius: 16 }, flipStyle]}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      {/* Reflection flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', inset: 0, backgroundColor: '#fff' } as object,
          flashStyle,
        ]}
      />
    </Animated.View>
  );
}
