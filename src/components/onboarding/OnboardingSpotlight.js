import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingSpotlight = ({ measurements, shape, padding = 10, radius = 30 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  if (!measurements) return null;

  const { x, y, width, height } = measurements;
  const spotlightX = x - padding;
  const spotlightY = y - padding;
  const spotlightWidth = width + padding * 2;
  const spotlightHeight = height + padding * 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Mask id="spotlight-mask">
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
            {shape === 'circle' ? (
              <Circle
                cx={x + width / 2}
                cy={y + height / 2}
                r={radius || Math.max(width, height) / 2 + padding}
                fill="black"
              />
            ) : (
              <Rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightWidth}
                height={spotlightHeight}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill="rgba(0, 0, 0, 0.85)"
          mask="url(#spotlight-mask)"
        />
      </Svg>
      
      {/* Glow effect around spotlight */}
      <Animated.View
        style={[
          styles.glowEffect,
          {
            left: spotlightX - 5,
            top: spotlightY - 5,
            width: spotlightWidth + 10,
            height: spotlightHeight + 10,
            borderRadius: shape === 'circle' ? (spotlightWidth + 10) / 2 : 17,
            transform: [{ scale: pulseAnim }],
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  glowEffect: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#B6DB78',
    shadowColor: '#B6DB78',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
});

export default OnboardingSpotlight;