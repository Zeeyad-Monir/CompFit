/**
 * Firebase configuration and initialization file
 * This file sets up Firebase services (Authentication and Firestore) for the workout app
 */

// Import React Native's LogBox to suppress console warnings
import { LogBox } from 'react-native';

// Suppress known Firebase Auth warning messages that spam the console
// This helps keep the development console clean by filtering out non-critical Firebase warnings
LogBox.ignoreLogs([
  '@firebase/auth',
]);

// Import Firebase app initialization functions
import { initializeApp, getApps, getApp } from 'firebase/app';

// Import Firebase Authentication functions
import {
  getAuth,                        // Get authentication instance
  onAuthStateChanged,             // Listen for authentication state changes
  createUserWithEmailAndPassword, // Create new user account
  signInWithEmailAndPassword,     // Sign in existing user
  signOut,                        // Sign out current user
} from 'firebase/auth';

// Import Firestore database function
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase project configuration
 * Contains all the necessary keys and identifiers for connecting to the Firebase project
 * This configuration is obtained from the Firebase Console
 */
const firebaseConfig = {
  apiKey: "AIzaSyBL63A9pOmlvkYNq8ZPxQKZXfCMTMefYsI",           // API key for Firebase services
  authDomain: "compfit-196e8.firebaseapp.com",                // Authentication domain
  projectId: "compfit-196e8",                                  // Firestore project ID
  storageBucket: "compfit-196e8.appspot.com",                 // Cloud Storage bucket
  messagingSenderId: "38275586051",                           // Cloud Messaging sender ID
  appId: "1:38275586051:web:dfb065a4fa1c582f40d636",          // App ID
  measurementId: "G-KJLD3B44PD",                              // Google Analytics measurement ID
};

/**
 * Initialize Firebase app with singleton pattern
 * This ensures only one Firebase app instance exists throughout the application
 * If an app is already initialized, it reuses the existing instance
 */
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)  // Initialize new Firebase app if none exists
  : getApp();                      // Get existing Firebase app instance

/**
 * Firebase Authentication instance
 * Used for user authentication operations throughout the app
 */
export const auth = getAuth(app);

/**
 * Export authentication functions for use in other components
 * These functions handle user authentication operations
 */
export {
  onAuthStateChanged,             // Monitor authentication state changes
  createUserWithEmailAndPassword, // Register new users
  signInWithEmailAndPassword,     // Sign in existing users
  signOut,                        // Sign out current user
};

/**
 * Firestore database instance
 * Used for storing and retrieving app data (competitions, user profiles, etc.)
 */
export const db = getFirestore(app);
