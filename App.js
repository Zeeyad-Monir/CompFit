// Import gesture handler for React Navigation to work properly
import 'react-native-gesture-handler';
import React, { useContext, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import AppNavigator   from './src/navigation/AppNavigator';
import AuthNavigator  from './src/navigation/AuthNavigator';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import notificationService from './src/services/notificationService';
import { OnboardingProvider } from './src/components/onboarding/OnboardingController';
import OnboardingOverlay from './src/components/onboarding/OnboardingOverlay';

/**
 * Creates initial navigation state that always starts at home screen
 * Only used when user is authenticated - ensures consistent starting point
 */
const getInitialNavigationState = () => ({
  index: 0,
  routes: [{
    name: 'HomeStack',
    state: {
      index: 0,
      routes: [{
        name: 'ActiveCompetitions'
      }]
    }
  }]
});

/**
 * Main App component that sets up the entire application structure
 * This component wraps the entire app with authentication and navigation providers
 * @returns {JSX.Element} The main app component
 */
// In src/App.js, update the Root component section:

export default function App() {
  const navigationRef = useRef();

  return (
    // AuthProvider wraps the entire app to provide authentication context
    <AuthProvider>
      {/* OnboardingProvider manages the tutorial state */}
      <OnboardingProvider navigationRef={navigationRef}>
        <RootNavigator navigationRef={navigationRef} />
        {/* Onboarding overlay that appears for new users */}
        <OnboardingOverlay />
      </OnboardingProvider>
    </AuthProvider>
  );
}

/**
 * RootNavigator component that handles conditional rendering based on authentication state
 * This component decides whether to show the authenticated or unauthenticated experience
 * @returns {JSX.Element} Either AppNavigator (for authenticated users) or AuthNavigator (for unauthenticated users)
 */
function RootNavigator({ navigationRef }) {
  // Get the current user from the authentication context
  const { user } = useContext(AuthContext);
  
  // Set up push notifications when user is authenticated
  useEffect(() => {
    if (user) {
      // Register for push notifications and save token
      notificationService.registerForPushNotificationsAsync(user.uid);
      
      // Setup notification listeners for handling notification taps
      if (navigationRef.current) {
        notificationService.setupNotificationListeners(navigationRef.current);
      }
    }
    
    // Cleanup listeners on unmount
    return () => {
      notificationService.removeNotificationListeners();
    };
  }, [user, navigationRef]);
  
  // Return NavigationContainer with appropriate key and initial state
  return (
    <NavigationContainer 
      ref={navigationRef}
      key={user ? `authenticated-${user.uid}` : 'unauthenticated'}
      initialState={user ? getInitialNavigationState() : undefined}
    >
      {/* If user is authenticated, show the main app navigator */}
      {/* Otherwise, show the authentication navigator (login/signup screens) */}
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}