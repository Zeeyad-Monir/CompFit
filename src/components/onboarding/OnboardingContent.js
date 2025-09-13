import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingContent = ({
  title,
  description,
  onNext,
  onSkip,
  isLastStep,
  currentStep = 0,
  totalSteps = 6,
  contentPosition = 'center',
}) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset animation values
    slideAnim.setValue(30);
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

  // Calculate position based on contentPosition prop
  const getPositionStyle = () => {
    switch (contentPosition) {
      case 'center':
        // Center of screen for welcome
        return {
          position: 'absolute',
          top: (SCREEN_HEIGHT - 280) / 2,
          left: 0,
          right: 0,
        };
      case 'below':
        // Below the highlighted element (tabs or cards)
        return {
          position: 'absolute',
          top: 150, // Adjust based on typical element position
          left: 0,
          right: 0,
        };
      case 'middle':
        // Middle of screen for create button
        return {
          position: 'absolute',
          top: (SCREEN_HEIGHT - 280) / 2,
          left: 0,
          right: 0,
        };
      case 'above':
        // Above the highlighted element (for profile)
        return {
          position: 'absolute',
          bottom: 150,
          left: 0,
          right: 0,
        };
      default:
        return {
          position: 'absolute',
          top: (SCREEN_HEIGHT - 280) / 2,
          left: 0,
          right: 0,
        };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyle(),
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        
        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {[...Array(totalSteps)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        
        <View style={styles.buttonContainer}>
          {!isLastStep && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip Tutorial</Text>
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
              size={22} 
              color="#FFFFFF" 
              style={styles.icon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
    zIndex: 2,
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    color: '#444444',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#A4D65E',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  skipText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#A4D65E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#A4D65E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  icon: {
    marginLeft: 4,
  },
});

export default OnboardingContent;