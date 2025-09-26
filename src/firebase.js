/**
 * Firebase v8 Compat Configuration - More stable for Expo/React Native
 */

import { LogBox } from 'react-native';

// Suppress Firebase warnings
LogBox.ignoreLogs([
  '@firebase/auth',
  'Setting a timer for a long period of time',
  'AsyncStorage has been extracted from react-native',
]);

// Import Firebase v8 compat
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBL63A9pOmlvkYNq8ZPxQKZXfCMTMefYsI",
  authDomain: "compfit-196e8.firebaseapp.com",
  projectId: "compfit-196e8",
  storageBucket: "compfit-196e8.appspot.com",
  messagingSenderId: "38275586051",
  appId: "1:38275586051:web:dfb065a4fa1c582f40d636",
  measurementId: "G-KJLD3B44PD",
};

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get Firebase services
export const auth = firebase.auth();
export const db = firebase.firestore();
export const functions = firebase.functions();

// Set up React Native persistence (AsyncStorage is used automatically)
// Firebase Auth in React Native automatically persists auth state
// We'll manage "remember me" at the app level

// Import persistence service
import persistenceService from './services/persistenceService';

// Export auth functions (v8 style)
export const onAuthStateChanged = (callback) => auth.onAuthStateChanged(callback);
export const createUserWithEmailAndPassword = (email, password) => 
  auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (email, password) => 
  auth.signInWithEmailAndPassword(email, password);

// Custom sign in with remember me support
export const signInWithRememberMe = async (email, password, rememberMe) => {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  
  // Handle remember me preference
  if (rememberMe) {
    await persistenceService.enablePersistence();
  } else {
    await persistenceService.disablePersistence();
  }
  
  return userCredential;
};

export const signOut = async () => {
  await persistenceService.clearPersistedSession();
  return auth.signOut();
};
export const sendPasswordResetEmail = (email) => auth.sendPasswordResetEmail(email);
export const updateProfile = (user, profile) => user.updateProfile(profile);
export const updateEmail = (user, email) => user.updateEmail(email);
export const reauthenticateWithCredential = (user, credential) => 
  user.reauthenticateWithCredential(credential);
export const EmailAuthProvider = firebase.auth.EmailAuthProvider;
export const sendEmailVerification = (user) => user.sendEmailVerification();
export const verifyBeforeUpdateEmail = (user, newEmail) => {
  // Check if the method exists in this Firebase version
  if (user.verifyBeforeUpdateEmail && typeof user.verifyBeforeUpdateEmail === 'function') {
    return user.verifyBeforeUpdateEmail(newEmail);
  }
  
  // Fallback: Try updateEmail + sendEmailVerification
  // This might still be blocked by Firebase security settings
  return user.updateEmail(newEmail)
    .then(() => user.sendEmailVerification())
    .catch((error) => {
      if (error.code === 'auth/operation-not-allowed') {
        // Firebase is blocking this, need alternative approach
        throw new Error('Email verification is required before update. Please use alternative method.');
      }
      throw error;
    });
};
export const reload = (user) => user.reload();
export const getCurrentUser = () => auth.currentUser;

// Export functions helpers
export const getFunctions = () => functions;
export const httpsCallable = (name) => functions.httpsCallable(name);

export default firebase;