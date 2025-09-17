import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');
const SIZE = screenWidth * 0.5;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AnimatedProgressRing({ wins, losses }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const circleRef = useRef(null);
  const textAnimValue = useRef(new Animated.Value(0)).current;
  const [displayedPercentage, setDisplayedPercentage] = useState(0);

  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

  useEffect(() => {
    // Reset to 0 and ensure it's visible
    setDisplayedPercentage(0);
    
    const targetPercentage = Math.round(winRate);
    console.log('Starting count animation from 0 to', targetPercentage);
    
    // Skip animation if target is 0
    if (targetPercentage === 0) {
      setDisplayedPercentage(0);
      // Still animate the ring
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: winRate,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(textAnimValue, {
          toValue: 1,
          duration: 1000,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    
    // Use requestAnimationFrame for smoother, more reliable animation
    const duration = 1300; // Slower for visibility (was 400ms)
    const startTime = Date.now();
    let animationFrame;
    
    const animateCount = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate current value with cubic ease-out
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(targetPercentage * easedProgress);
      
      setDisplayedPercentage(currentValue);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateCount);
      } else {
        // Ensure we end at the exact target
        setDisplayedPercentage(targetPercentage);
      }
    };
    
    // Start the counting after a small delay to ensure component is mounted
    const timeout = setTimeout(() => {
      animationFrame = requestAnimationFrame(animateCount);
    }, 50);
    
    // Animate the ring and text appearance
    Animated.parallel([
      // Ring animation
      Animated.timing(animatedValue, {
        toValue: winRate,
        duration: 1500,
        useNativeDriver: true,
      }),
      // Text scale/opacity animation
      Animated.timing(textAnimValue, {
        toValue: 1,
        duration: 1000,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Cleanup
    return () => {
      clearTimeout(timeout);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [winRate]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const scale = textAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const opacity = textAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Determine gradient colors based on win rate
  const getGradientColors = () => {
    if (winRate >= 70) return ['#10B981', '#34D399']; // Green
    if (winRate >= 50) return ['#F59E0B', '#FCD34D']; // Yellow
    return ['#EF4444', '#F87171']; // Red
  };

  const [startColor, endColor] = getGradientColors();

  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <Defs>
            <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={startColor} />
              <Stop offset="100%" stopColor={endColor} />
            </LinearGradient>
          </Defs>
          
          {/* Background Circle */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#F3F4F6"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          
          {/* Progress Circle */}
          <AnimatedCircle
            ref={circleRef}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="url(#gradient)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        
        <Animated.View 
          style={[
            styles.centerContent, 
            { 
              transform: [{ scale }],
              opacity
            }
          ]}
        >
          <Text style={styles.percentageText}>{displayedPercentage}%</Text>
          <Text style={styles.winRateLabel}>Win Rate</Text>
          <View style={styles.statsRow}>
            <Text style={styles.winText}>{wins}W</Text>
            <Text style={styles.separator}>·</Text>
            <Text style={styles.lossText}>{losses}L</Text>
          </View>
        </Animated.View>
      </View>
      
      {/* Performance Indicator */}
      <View style={styles.performanceIndicator}>
        <View style={[styles.performanceDot, { backgroundColor: startColor }]} />
        <Text style={styles.performanceText}>
          {winRate >= 70 ? 'Excellent' : winRate >= 50 ? 'Good' : 'Needs Improvement'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  ringContainer: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1A1E23',
    letterSpacing: -2,
  },
  winRateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  winText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  separator: {
    fontSize: 16,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  lossText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
  },
  performanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  performanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});