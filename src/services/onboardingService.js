import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'user_onboarding_completed';
const ONBOARDING_VERSION_KEY = 'onboarding_version';
const CURRENT_VERSION = '1.0.0';

class OnboardingService {
  constructor() {
    this.targetMeasurements = new Map();
  }

  async hasCompletedOnboarding() {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      const version = await AsyncStorage.getItem(ONBOARDING_VERSION_KEY);
      
      // Check if completed and version matches
      return completed === 'true' && version === CURRENT_VERSION;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async completeOnboarding() {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      await AsyncStorage.setItem(ONBOARDING_VERSION_KEY, CURRENT_VERSION);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  async resetOnboarding() {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      await AsyncStorage.removeItem(ONBOARDING_VERSION_KEY);
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