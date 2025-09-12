import React, { createContext, useState, useContext, useEffect } from 'react';
import { Dimensions } from 'react-native';
import onboardingService from '../../services/onboardingService';
import { ONBOARDING_STEPS } from './onboardingSteps';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetMeasurements, setTargetMeasurements] = useState({});

  const startOnboarding = async () => {
    const hasCompleted = await onboardingService.hasCompletedOnboarding();
    if (!hasCompleted) {
      setIsActive(true);
      setCurrentStep(0);
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

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    await onboardingService.completeOnboarding();
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