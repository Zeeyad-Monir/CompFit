import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingMask = ({ highlightBounds, fadeOpacity = 0.85 }) => {
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate in the mask
    Animated.parallel([
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(animatedScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlightBounds]);

  // If no highlight bounds, just show full dark overlay
  if (!highlightBounds || highlightBounds === 'none') {
    return (
      <Animated.View 
        style={[
          styles.fullOverlay,
          {
            opacity: animatedOpacity,
            backgroundColor: `rgba(0, 0, 0, ${fadeOpacity})`,
          }
        ]}
        pointerEvents="none"
      />
    );
  }

  // Calculate highlight position
  let highlightStyle = {};
  
  if (highlightBounds.centerX) {
    // Center horizontally
    highlightStyle.left = (SCREEN_WIDTH - highlightBounds.width) / 2;
  } else if (highlightBounds.left !== undefined) {
    highlightStyle.left = highlightBounds.left;
  }

  if (highlightBounds.right !== undefined) {
    highlightStyle.right = highlightBounds.right;
  }

  if (highlightBounds.top !== undefined) {
    highlightStyle.top = highlightBounds.top;
  }

  if (highlightBounds.bottom !== undefined) {
    highlightStyle.bottom = highlightBounds.bottom;
  }

  if (highlightBounds.width !== undefined) {
    highlightStyle.width = highlightBounds.width;
  }

  if (highlightBounds.height !== undefined) {
    highlightStyle.height = highlightBounds.height;
  }

  // For full width highlights (like tabs)
  if (highlightBounds.fullWidth) {
    highlightStyle.left = highlightBounds.left || 0;
    highlightStyle.right = highlightBounds.right || 0;
  }

  const borderRadius = highlightBounds.borderRadius || 0;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top overlay */}
      {highlightBounds.top !== undefined && (
        <Animated.View 
          style={[
            styles.overlaySection,
            {
              height: highlightBounds.top,
              opacity: animatedOpacity,
              backgroundColor: `rgba(0, 0, 0, ${fadeOpacity})`,
            }
          ]}
          pointerEvents="none"
        />
      )}

      {/* Middle row with left, highlight, and right */}
      <View style={styles.middleRow} pointerEvents="box-none">
        {/* Left overlay */}
        {highlightStyle.left !== undefined && highlightStyle.left > 0 && (
          <Animated.View 
            style={[
              styles.overlaySection,
              {
                width: highlightStyle.left,
                opacity: animatedOpacity,
                backgroundColor: `rgba(0, 0, 0, ${fadeOpacity})`,
              }
            ]}
            pointerEvents="none"
          />
        )}

        {/* Highlight area (transparent) */}
        <Animated.View 
          style={[
            {
              ...highlightStyle,
              borderRadius,
              transform: [{ scale: animatedScale }],
            }
          ]}
          pointerEvents="box-none"
        />

        {/* Right overlay */}
        {highlightStyle.right !== undefined && (
          <Animated.View 
            style={[
              styles.overlaySection,
              {
                flex: 1,
                opacity: animatedOpacity,
                backgroundColor: `rgba(0, 0, 0, ${fadeOpacity})`,
              }
            ]}
            pointerEvents="none"
          />
        )}
      </View>

      {/* Bottom overlay */}
      <Animated.View 
        style={[
          styles.overlaySection,
          {
            flex: 1,
            opacity: animatedOpacity,
            backgroundColor: `rgba(0, 0, 0, ${fadeOpacity})`,
          }
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  middleRow: {
    flexDirection: 'row',
  },
});

export default OnboardingMask;