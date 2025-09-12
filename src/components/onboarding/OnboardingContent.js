import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OnboardingContent = ({
  title,
  description,
  onNext,
  onSkip,
  isLastStep,
  targetMeasurements,
  position = 'below',
}) => {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset animation values
    slideAnim.setValue(50);
    fadeAnim.setValue(0);
    
    // Slide up animation
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [title]); // Re-animate on step change

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  // Calculate position based on target
  let topPosition = '50%';
  if (targetMeasurements && position !== 'center') {
    const { y, height } = targetMeasurements;
    if (position === 'above') {
      topPosition = y - 200; // Position above target
    } else if (position === 'below') {
      topPosition = y + height + 40; // Position below target
    }
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topPosition,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          <View style={styles.buttonContainer}>
            {!isLastStep && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextText}>
                {isLastStep ? "Let's Go!" : 'Next'}
              </Text>
              <Ionicons 
                name={isLastStep ? 'checkmark' : 'arrow-forward'} 
                size={20} 
                color="#FFFFFF" 
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    alignSelf: 'center',
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#444444',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#A4D65E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#A4D65E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  icon: {
    marginLeft: 4,
  },
});

export default OnboardingContent;