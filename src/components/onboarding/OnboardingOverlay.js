import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useOnboarding } from './OnboardingController';
import OnboardingContent from './OnboardingContent';
import { ONBOARDING_STEPS } from './onboardingSteps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingOverlay = () => {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    skipOnboarding,
  } = useOnboarding();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  if (!isActive || !currentStepData) {
    return null;
  }

  return (
    <Modal
      visible={isActive}
      transparent={true}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        {/* Dark background */}
        <View style={styles.backdrop} />

        {/* Single card container */}
        <OnboardingContent
          steps={ONBOARDING_STEPS}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onSkip={skipOnboarding}
        />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
});

export default OnboardingOverlay;