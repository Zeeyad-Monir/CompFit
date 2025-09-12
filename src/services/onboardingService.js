import AsyncStorage from '@react-native-async-storage/async-storage';

// Using v1 suffix ensures existing users will see it once
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed_v1';

class OnboardingService {
  constructor() {
    this.targetMeasurements = new Map();
  }

  async hasCompletedOnboarding() {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async completeOnboarding() {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      console.log('Onboarding marked as completed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  async resetOnboarding() {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      console.log('Onboarding reset - will show on next app launch');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }

  registerTarget(id, layout) {
    const { x, y, width, height } = layout.nativeEvent.layout;
    this.targetMeasurements.set(id, { x, y, width, height });
  }

  getTargetMeasurements(id) {
    return this.targetMeasurements.get(id);
  }

  clearTargets() {
    this.targetMeasurements.clear();
  }
}

export default new OnboardingService();