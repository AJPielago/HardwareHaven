import React from 'react';
import { Image, StyleSheet } from 'react-native';

import shopLogo from '../../../assets/shop_logo.png';

export default function BrandMark({ compact = false }) {
  return (
    <Image
      source={shopLogo}
      style={[styles.logoImage, compact && styles.logoImageCompact]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logoImage: {
    width: 280,
    height: 280,
  },
  logoImageCompact: {
    width: 190,
    height: 190,
  },
});
