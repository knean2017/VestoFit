import React, { useState } from 'react';
import {
  TextInput,
  Text,
  View,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureToggle?: boolean;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  secureToggle,
  secureTextEntry,
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}: InputProps) {
  const { styles, theme } = useStyles(stylesheet);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, focused && styles.rowFocused, error ? styles.rowError : null]}>
        <TextInput
          {...rest}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, style]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        />
        {secureToggle ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{hidden ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  wrapper: { gap: 6 },
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    minHeight: 50,
  },
  rowFocused: {
    borderColor: theme.colors.accent,
  },
  rowError: {
    borderColor: theme.colors.error,
  },
  input: {
    flex: 1,
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
    paddingVertical: theme.spacing.sm,
  },
  eyeBtn: { padding: 4 },
  eyeText: { fontSize: 16 },
  error: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
  },
}));
