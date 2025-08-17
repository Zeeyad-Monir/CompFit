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

// Export auth functions (v8 style)
export const onAuthStateChanged = (callback) => auth.onAuthStateChanged(callback);
export const createUserWithEmailAndPassword = (email, password) => 
  auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (email, password) => 
  auth.signInWithEmailAndPassword(email, password);
export const signOut = () => auth.signOut();
export const sendPasswordResetEmail = (email) => auth.sendPasswordResetEmail(email);
export const updateProfile = (user, profile) => user.updateProfile(profile);

// Export functions helpers
export const getFunctions = () => functions;
export const httpsCallable = (name) => functions.httpsCallable(name);

export default firebase;