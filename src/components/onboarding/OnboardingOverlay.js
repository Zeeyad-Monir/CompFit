import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useOnboarding } from './OnboardingController';
import OnboardingSpotlight from './OnboardingSpotlight';
import OnboardingContent from './OnboardingContent';
import OnboardingProgress from './OnboardingProgress';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingOverlay = () => {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    skipOnboarding,
    getTargetMeasurements,
  } = useOnboarding();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isActive) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive]);

  if (!isActive || !currentStepData) {
    return null;
  }

  const targetMeasurements = getTargetMeasurements(currentStepData.targetId);

  return (
    <Modal
      visible={isActive}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        {/* Dark backdrop with blur */}
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark">
          <View style={styles.backdrop} />
        </BlurView>

        {/* Spotlight cutout */}
        {targetMeasurements && (
          <OnboardingSpotlight
            measurements={targetMeasurements}
            shape={currentStepData.spotlightShape}
            padding={currentStepData.spotlightPadding}
            radius={currentStepData.spotlightRadius}
          />
        )}

        {/* Content card */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <OnboardingContent
            title={currentStepData.title}
            description={currentStepData.description}
            onNext={nextStep}
            onSkip={skipOnboarding}
            isLastStep={currentStep === totalSteps - 1}
            targetMeasurements={targetMeasurements}
            position={currentStepData.position}
          />
        </Animated.View>

        {/* Progress indicator */}
        <OnboardingProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    alignItems: 'center',
  },
});

export default OnboardingOverlay;