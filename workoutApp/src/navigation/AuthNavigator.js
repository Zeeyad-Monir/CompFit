/**
 * AuthNavigator.js – Navigation for unauthenticated users
 * Handles navigation between authentication screens (Login, SignUp, ForgotPassword)
 * This navigator is shown when no user is authenticated
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import authentication screen components
import LoginScreen from '../screens/LoginScreen';               // User login form
import SignUpScreen from '../screens/SignUpScreen';             // User registration form
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'; // Password reset form

// Create stack navigator for authentication flow
const Stack = createNativeStackNavigator();

/**
 * Authentication Navigator Component
 * Creates a stack-based navigation flow for unauthenticated users
 * 
 * Navigation flow:
 * - Login (default) → SignUp → ForgotPassword
 * - Users can navigate between these screens until they authenticate
 * 
 * @returns {JSX.Element} Stack navigator with authentication screens
 */
export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Login Screen - Default screen for unauthenticated users */}
      <Stack.Screen name="Login" component={LoginScreen} />
      
      {/* Sign Up Screen - New user registration */}
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      
      {/* Forgot Password Screen - Password reset functionality */}
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}