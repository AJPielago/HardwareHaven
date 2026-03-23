import { Dimensions, Platform, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';

// Get window width directly on web
const getWindowWidth = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth || 1024; // Fallback to desktop width
  }
  return Dimensions.get('window').width || 400;
};

// Dynamic hook for responsive values
export function useResponsive() {
  const [width, setWidth] = useState(() => getWindowWidth());

  useEffect(() => {
    // Update width immediately on mount
    setWidth(getWindowWidth());

    const handleResize = () => {
      setWidth(getWindowWidth());
    };

    // Listen to both native and web resize events
    const subscription = Dimensions.addEventListener('change', handleResize);
    
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      subscription?.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  return { width, isWeb, isDesktop, isTablet, isMobile };
}

// Static values for initial render
export const isWeb = Platform.OS === 'web';
export const isDesktop = isWeb && (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
export const isTablet = !isDesktop && (typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
export const isMobile = !isDesktop && !isTablet;

export const responsiveStyles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isDesktop && {
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  content: {
    padding: isDesktop ? 24 : 16,
  },
  card: {
    ...(isDesktop && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  grid: {
    flexDirection: isDesktop ? 'row' : 'column',
    flexWrap: isDesktop ? 'wrap' : 'nowrap',
    justifyContent: isDesktop ? 'space-between' : 'flex-start',
  },
  gridItem: {
    ...(isDesktop && {
      width: '48%',
    }),
    ...(isTablet && {
      width: '100%',
    }),
  },
});

export const getResponsiveValue = (mobile, tablet, desktop) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};
