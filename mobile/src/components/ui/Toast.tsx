import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext).toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const counter = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }: { toasts: ToastState[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 12,
        left: 16,
        right: 16,
        gap: 8,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastState }) {
  const { styles } = useStyles(stylesheet);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(2800, withTiming(0, { duration: 400 })),
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const typeStyle = {
    success: styles.success,
    error: styles.error,
    info: styles.info,
    warning: styles.warning,
  }[toast.type];

  const icon = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }[toast.type];

  return (
    <Animated.View style={[styles.toast, typeStyle, animStyle]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
    </Animated.View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    ...theme.shadows.lifted,
  },
  success: { backgroundColor: theme.colors.success },
  error: { backgroundColor: theme.colors.error },
  info: { backgroundColor: theme.colors.info },
  warning: { backgroundColor: theme.colors.warning },
  icon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  message: {
    flex: 1,
    color: '#fff',
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
  },
}));

