import { useState } from 'react';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';

/** React state that is true while the pager is snapped to slide `index`. */
export function useActiveSlide(progress: SharedValue<number>, index: number): boolean {
  const [active, setActive] = useState(index === 0);
  useAnimatedReaction(
    () => Math.round(progress.value) === index,
    (isActive, prev) => {
      if (isActive !== prev) runOnJS(setActive)(isActive);
    },
  );
  return active;
}
