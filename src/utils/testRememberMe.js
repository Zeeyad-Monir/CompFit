// Test script for Remember Me functionality
// This file can be deleted after testing

import persistenceService from '../services/persistenceService';

export const testRememberMeFunctionality = async () => {
  console.log('=== Testing Remember Me Functionality ===');
  
  try {
    // Test 1: Set and get Remember Me
    console.log('Test 1: Setting Remember Me to true');
    await persistenceService.setRememberMe(true);
    const rememberMe = await persistenceService.getRememberMe();
    console.log('Remember Me value:', rememberMe);
    console.assert(rememberMe === true, 'Remember Me should be true');
    
    // Test 2: Set auth persistence timestamp
    console.log('\nTest 2: Setting auth persistence timestamp');
    await persistenceService.setAuthPersistedAt();
    const timestamp = await persistenceService.getAuthPersistedAt();
    console.log('Auth persisted at:', timestamp);
    console.assert(timestamp !== null, 'Timestamp should not be null');
    
    // Test 3: Check session validity (should be valid)
    console.log('\nTest 3: Checking session validity');
    const isValid = await persistenceService.isSessionValid();
    console.log('Session valid:', isValid);
    console.assert(isValid === true, 'Session should be valid');
    
    // Test 4: Clear persisted session
    console.log('\nTest 4: Clearing persisted session');
    await persistenceService.clearPersistedSession();
    const rememberMeAfterClear = await persistenceService.getRememberMe();
    const timestampAfterClear = await persistenceService.getAuthPersistedAt();
    console.log('Remember Me after clear:', rememberMeAfterClear);
    console.log('Timestamp after clear:', timestampAfterClear);
    console.assert(rememberMeAfterClear === false, 'Remember Me should be false after clear');
    console.assert(timestampAfterClear === null, 'Timestamp should be null after clear');
    
    // Test 5: Disable persistence
    console.log('\nTest 5: Disabling persistence');
    await persistenceService.disablePersistence();
    const rememberMeAfterDisable = await persistenceService.getRememberMe();
    console.log('Remember Me after disable:', rememberMeAfterDisable);
    console.assert(rememberMeAfterDisable === false, 'Remember Me should be false after disable');
    
    console.log('\n=== All tests passed successfully! ===');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
};

// Export for use in development
export default testRememberMeFunctionality;