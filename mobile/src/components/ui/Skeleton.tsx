import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

// ── Base block ────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const { styles } = useStyles(stylesheet);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => { opacity.value = 1; };
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.base, { width: width as number, height, borderRadius }, animStyle, style]}
    />
  );
}

// ── Wardrobe grid (2-col, 6 cards) ───────────────────────────────────────────

export function WardrobeSkeleton() {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.wardrobeGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.wardrobeCard}>
          <Skeleton height={0} style={styles.wardrobeImg} borderRadius={0} />
          <View style={styles.wardrobeMeta}>
            <Skeleton width="60%" height={12} borderRadius={6} />
            <Skeleton width={28} height={28} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Stylist chat bubbles ──────────────────────────────────────────────────────

const BUBBLES: Array<{ align: 'left' | 'right'; w: `${number}%` }> = [
  { align: 'left', w: '70%' },
  { align: 'right', w: '55%' },
  { align: 'left', w: '80%' },
  { align: 'right', w: '45%' },
];

export function StylistSkeleton() {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.stylistList}>
      {BUBBLES.map((b, i) => (
        <View key={i} style={[styles.bubbleRow, b.align === 'right' && styles.bubbleRight]}>
          <Skeleton width={b.w} height={44} borderRadius={16} />
        </View>
      ))}
    </View>
  );
}

// ── Shop product cards ────────────────────────────────────────────────────────

export function ShopSkeleton() {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.shopList}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={styles.shopCard}>
          <Skeleton width={88} height={110} borderRadius={12} style={styles.shopImg} />
          <View style={styles.shopText}>
            <Skeleton width="80%" height={13} borderRadius={6} />
            <Skeleton width="50%" height={13} borderRadius={6} style={styles.shopLine2} />
            <Skeleton width="35%" height={13} borderRadius={6} style={styles.shopLine3} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const stylesheet = createStyleSheet((theme) => ({
  base: {
    backgroundColor: theme.colors.stone,
  },

  // Wardrobe
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  wardrobeCard: {
    width: '47.5%',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.soft,
  },
  wardrobeImg: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: theme.colors.stone,
  },
  wardrobeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },

  // Stylist
  stylistList: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  bubbleRow: {
    alignSelf: 'flex-start',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },

  // Shop
  shopList: {
    gap: theme.spacing.md,
  },
  shopCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  shopImg: {
    flexShrink: 0,
  },
  shopText: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },
  shopLine2: {
    marginTop: 8,
  },
  shopLine3: {
    marginTop: 8,
  },
}));
