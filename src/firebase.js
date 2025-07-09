// src/firebase.js
import { LogBox } from 'react-native';

// Suppress known Firebase Auth warning spamming your console
LogBox.ignoreLogs([
  '@firebase/auth',
]);

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBL63A9pOmlvkYNq8ZPxQKZXfCMTMefYsI",
  authDomain: "compfit-196e8.firebaseapp.com",
  projectId: "compfit-196e8",
  storageBucket: "compfit-196e8.appspot.com",
  messagingSenderId: "38275586051",
  appId: "1:38275586051:web:dfb065a4fa1c582f40d636",
  measurementId: "G-KJLD3B44PD",
};

// Initialize (or reuse) the Firebase App
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// Auth exports
export const auth = getAuth(app);
export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
};

// Firestore export
export const db = getFirestore(app);
