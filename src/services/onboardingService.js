import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

class OnboardingService {

  async hasCompletedOnboarding(userId) {
    if (!userId) {
      console.log('No userId provided, returning false');
      return false;
    }
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // If field doesn't exist (existing users), default to false so they see tutorial once
        return userData.hasCompletedOnboarding === true;
      }
      return false;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async completeOnboarding(userId) {
    if (!userId) {
      console.log('No userId provided, cannot complete onboarding');
      return;
    }
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        hasCompletedOnboarding: true
      });
      console.log('Onboarding marked as completed for user:', userId);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // If document doesn't exist, create it with the field
      try {
        await setDoc(doc(db, 'users', userId), {
          hasCompletedOnboarding: true
        }, { merge: true });
      } catch (setError) {
        console.error('Error setting onboarding complete:', setError);
      }
    }
  }

  async resetOnboarding(userId) {
    if (!userId) {
      console.log('No userId provided, cannot reset onboarding');
      return;
    }
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        hasCompletedOnboarding: false
      });
      console.log('Onboarding reset for user:', userId);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }
}

export default new OnboardingService();