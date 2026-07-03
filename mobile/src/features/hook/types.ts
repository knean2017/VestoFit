import type { SharedValue } from 'react-native-reanimated';

export type SlideProps = {
  /** Pager position, 0..3, fractional mid-swipe. Drives all slide animation. */
  progress: SharedValue<number>;
  /** This slide's own index. */
  index: number;
};
