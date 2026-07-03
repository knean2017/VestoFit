import React from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { MessageCircle, Shirt, ShoppingBag, Sparkles, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

const ICONS: Record<string, LucideIcon> = {
  wardrobe: Shirt,
  studio: Sparkles,
  stylist: MessageCircle,
  shop: ShoppingBag,
  profile: User,
};

const SPRING = { damping: 20, stiffness: 300 };

function TabIcon({ Icon, focused, color }: { Icon: LucideIcon; focused: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.12 : 1, SPRING) }],
  }));
  return (
    <Animated.View style={style}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
    </Animated.View>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const tabWidth = useSharedValue(0);

  function onLayout(e: LayoutChangeEvent) {
    tabWidth.value = e.nativeEvent.layout.width / state.routes.length;
  }

  const pillStyle = useAnimatedStyle(() => ({
    width: Math.max(tabWidth.value - 24, 0),
    transform: [{ translateX: withSpring(state.index * tabWidth.value + 12, SPRING) }],
  }));

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.pill, pillStyle]} />
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const Icon = ICONS[route.name] ?? User;
        const label = options.title ?? route.name;

        function onPress() {
          Haptics.selectionAsync();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.tab}
          >
            <TabIcon
              Icon={Icon}
              focused={focused}
              color={focused ? theme.colors.tabActive : theme.colors.tabInactive}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: theme.colors.tabBarBorder,
    paddingTop: 8,
  },
  pill: {
    position: 'absolute',
    top: 6,
    height: 52,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.accent,
    opacity: 0.12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: 10,
    color: theme.colors.tabInactive,
  },
  labelActive: { color: theme.colors.tabActive },
}));
