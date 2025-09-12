import { useContext } from 'react';
import { useOnboarding as useOnboardingContext } from '../components/onboarding/OnboardingController';

export const useOnboarding = () => {
  return useOnboardingContext();
};