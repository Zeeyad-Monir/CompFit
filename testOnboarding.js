// Test script to reset onboarding for testing purposes
// Run this to clear the onboarding completion flag

import AsyncStorage from '@react-native-async-storage/async-storage';

const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem('user_onboarding_completed');
    await AsyncStorage.removeItem('onboarding_version');
    console.log('Onboarding reset successfully! The tutorial will show on next app launch.');
  } catch (error) {
    console.error('Error resetting onboarding:', error);
  }
};

// This can be called from within the app for testing
export default resetOnboarding;