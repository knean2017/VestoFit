import { UnistylesRegistry } from 'react-native-unistyles';
import { lightTheme, darkTheme } from './index';

// Cast needed because lightTheme and darkTheme have literal color types that
// don't match the looser UnistylesThemes interface declaration
UnistylesRegistry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .addThemes({ light: lightTheme as any, dark: darkTheme as any })
  .addConfig({ adaptiveThemes: true });
