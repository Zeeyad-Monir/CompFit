import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationTheme } from '../../constants/navigationTheme';

const TabBarDivider = () => {
  return (
    <>
      <View style={styles.hairline} />
      
      {Platform.OS === 'android' && (
        <LinearGradient
          colors={NavigationTheme.shadow.androidGradient.colors}
          style={styles.androidShadow}
          pointerEvents="none"
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NavigationTheme.dimensions.hairlineWidth,
    backgroundColor: NavigationTheme.colors.divider,
    zIndex: 2,
  },
  androidShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NavigationTheme.shadow.androidGradient.height,
    zIndex: 1,
  },
});

export default TabBarDivider;