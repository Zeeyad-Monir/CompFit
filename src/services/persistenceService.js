import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = 'rememberMe';
const AUTH_PERSISTED_AT_KEY = 'authPersistedAt';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

class PersistenceService {
  async setRememberMe(value) {
    try {
      await SecureStore.setItemAsync(REMEMBER_ME_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to set remember me:', error);
    }
  }

  async getRememberMe() {
    try {
      const value = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Failed to get remember me:', error);
      return false;
    }
  }

  async setAuthPersistedAt() {
    try {
      const timestamp = new Date().toISOString();
      await SecureStore.setItemAsync(AUTH_PERSISTED_AT_KEY, timestamp);
    } catch (error) {
      console.error('Failed to set auth persistence timestamp:', error);
    }
  }

  async getAuthPersistedAt() {
    try {
      const timestamp = await SecureStore.getItemAsync(AUTH_PERSISTED_AT_KEY);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('Failed to get auth persistence timestamp:', error);
      return null;
    }
  }

  async isSessionValid() {
    try {
      const rememberMe = await this.getRememberMe();
      if (!rememberMe) {
        return false;
      }

      const persistedAt = await this.getAuthPersistedAt();
      if (!persistedAt) {
        return false;
      }

      const now = new Date();
      const timeDiff = now - persistedAt;
      
      // Check for time skew (timestamp in future by more than 24 hours)
      if (timeDiff < -86400000) {
        console.warn('Detected time skew, clearing persisted session');
        await this.clearPersistedSession();
        return false;
      }

      // Check if session is within 30 days
      return timeDiff < THIRTY_DAYS_MS;
    } catch (error) {
      console.error('Failed to validate session:', error);
      return false;
    }
  }

  async clearPersistedSession() {
    try {
      await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
      await SecureStore.deleteItemAsync(AUTH_PERSISTED_AT_KEY);
      // Clear Firebase Auth persistence from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const firebaseKeys = keys.filter(key => 
        key.includes('firebase:authUser') || 
        key.includes('firebase:redirectUser')
      );
      if (firebaseKeys.length > 0) {
        await AsyncStorage.multiRemove(firebaseKeys);
      }
    } catch (error) {
      console.error('Failed to clear persisted session:', error);
    }
  }

  async enablePersistence() {
    try {
      await this.setRememberMe(true);
      await this.setAuthPersistedAt();
    } catch (error) {
      console.error('Failed to enable persistence:', error);
    }
  }

  async disablePersistence() {
    try {
      await this.setRememberMe(false);
      await SecureStore.deleteItemAsync(AUTH_PERSISTED_AT_KEY);
    } catch (error) {
      console.error('Failed to disable persistence:', error);
    }
  }
}

export default new PersistenceService();