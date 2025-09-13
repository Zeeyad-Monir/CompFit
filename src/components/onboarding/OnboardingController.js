import React, { createContext, useState, useContext, useEffect } from 'react';
import { Dimensions } from 'react-native';
import onboardingService from '../../services/onboardingService';
import { ONBOARDING_STEPS } from './onboardingSteps';
import { AuthContext } from '../../contexts/AuthContext';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetMeasurements, setTargetMeasurements] = useState({});

  const startOnboarding = async (forceStart = false) => {
    // Don't start if already active
    if (isActive) {
      console.log('Onboarding already active, skipping start');
      return;
    }

    // Check if user is authenticated
    if (!user?.uid) {
      console.log('No authenticated user, skipping onboarding');
      return;
    }
    
    // If forceStart is true, start regardless of completion status
    if (forceStart) {
      console.log('Manually starting onboarding tutorial');
      setIsActive(true);
      setCurrentStep(0);
      return;
    }
    
    // Otherwise check completion status as normal
    const hasCompleted = await onboardingService.hasCompletedOnboarding(user.uid);
    if (!hasCompleted) {
      console.log('Starting onboarding tutorial for user');
      setIsActive(true);
      setCurrentStep(0);
    } else {
      console.log('User has already completed onboarding');
    }
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = async () => {
    if (!user?.uid) {
      console.log('No authenticated user, cannot skip onboarding');
      return;
    }
    console.log('User skipped onboarding');
    await onboardingService.completeOnboarding(user.uid); // Mark as complete even when skipped
    setIsActive(false);
    setCurrentStep(0);
  };

  const completeOnboarding = async () => {
    if (!user?.uid) {
      console.log('No authenticated user, cannot complete onboarding');
      return;
    }
    console.log('User completed onboarding');
    await onboardingService.completeOnboarding(user.uid);
    setIsActive(false);
    setCurrentStep(0);
  };

  const registerTarget = (id, measurements) => {
    setTargetMeasurements(prev => ({
      ...prev,
      [id]: measurements
    }));
  };

  const getTargetMeasurements = (id) => {
    return targetMeasurements[id] || null;
  };

  const value = {
    isActive,
    currentStep,
    totalSteps: ONBOARDING_STEPS.length,
    currentStepData: ONBOARDING_STEPS[currentStep],
    startOnboarding,
    nextStep,
    previousStep,
    skipOnboarding,
    registerTarget,
    getTargetMeasurements,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};