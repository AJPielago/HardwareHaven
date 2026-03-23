import { Platform } from 'react-native';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { MD3LightTheme } from 'react-native-paper';

export const brand = {
  name: 'Hardware Haven',
  year: '2026',
  colors: {
    primary: '#FF6A13',
    primaryDeep: '#D8570A',
    navy: '#051954',
    navySoft: '#123E78',
    background: '#F3F6FC',
    surface: '#FFFFFF',
    surfaceAlt: '#EAF0FC',
    text: '#102447',
    textMuted: '#5D6C86',
    border: '#C7D4EA',
    success: '#1B9D56',
    danger: '#CE3448',
    warning: '#E8A22F',
  },
};

const fontFamilies = Platform.select({
  ios: {
    regular: 'Avenir Next',
    medium: 'Avenir Next Demi Bold',
    bold: 'Avenir Next Bold',
  },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    bold: 'sans-serif-condensed',
  },
  web: {
    regular: 'Trebuchet MS, Segoe UI, sans-serif',
    medium: 'Trebuchet MS, Segoe UI, sans-serif',
    bold: 'Trebuchet MS, Segoe UI, sans-serif',
  },
  default: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    bold: 'sans-serif',
  },
});

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFE3D2',
    onPrimaryContainer: brand.colors.navy,
    secondary: brand.colors.navySoft,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#DCE9FF',
    onSecondaryContainer: brand.colors.navy,
    tertiary: '#3A76D2',
    background: brand.colors.background,
    surface: brand.colors.surface,
    surfaceVariant: brand.colors.surfaceAlt,
    error: brand.colors.danger,
    onSurface: brand.colors.text,
    onSurfaceVariant: brand.colors.textMuted,
    outline: brand.colors.border,
  },
  fonts: {
    ...MD3LightTheme.fonts,
    bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontFamily: fontFamilies.regular },
    bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontFamily: fontFamilies.regular },
    bodySmall: { ...MD3LightTheme.fonts.bodySmall, fontFamily: fontFamilies.regular },
    titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontFamily: fontFamilies.bold },
    titleMedium: { ...MD3LightTheme.fonts.titleMedium, fontFamily: fontFamilies.medium },
    titleSmall: { ...MD3LightTheme.fonts.titleSmall, fontFamily: fontFamilies.medium },
    labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontFamily: fontFamilies.medium },
    labelMedium: { ...MD3LightTheme.fonts.labelMedium, fontFamily: fontFamilies.medium },
    labelSmall: { ...MD3LightTheme.fonts.labelSmall, fontFamily: fontFamilies.medium },
  },
};

export const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: brand.colors.primary,
    background: brand.colors.background,
    card: brand.colors.surface,
    text: brand.colors.text,
    border: brand.colors.border,
    notification: brand.colors.primary,
  },
};
