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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OnboardingContent = ({
  steps,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevStep = useRef(0);

  useEffect(() => {
    if (currentStep !== prevStep.current) {
      // Animate content slide
      Animated.spring(slideAnim, {
        toValue: -currentStep * 280, // Width of content area
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
      prevStep.current = currentStep;
    }
  }, [currentStep]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Sliding content area */}
        <View style={styles.contentWindow}>
          <Animated.View 
            style={[
              styles.contentTrack,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Render all step contents horizontally */}
            {steps.map((step, index) => (
              <View key={step.id} style={styles.contentItem}>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
        
        {/* Static progress dots */}
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
        
        {/* Static buttons */}
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
              size={22} 
              color="#FFFFFF" 
              style={styles.icon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 2,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  contentWindow: {
    width: 280, // Card width minus padding
    height: 120, // Fixed height for content
    overflow: 'hidden',
    marginBottom: 4, // Minimal spacing
  },
  contentTrack: {
    flexDirection: 'row',
  },
  contentItem: {
    width: 280, // Same as contentWindow
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 20,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
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