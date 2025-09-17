// Import gesture handler for React Navigation to work properly
import 'react-native-gesture-handler';
import React, { useContext, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator   from './src/navigation/AppNavigator';
import AuthNavigator  from './src/navigation/AuthNavigator';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import notificationService from './src/services/notificationService';
import { OnboardingProvider } from './src/components/onboarding/OnboardingController';
import OnboardingOverlay from './src/components/onboarding/OnboardingOverlay';

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
      {/* NavigationContainer enables navigation throughout the app */}
      <NavigationContainer ref={navigationRef}>
        {/* OnboardingProvider manages the tutorial state */}
        <OnboardingProvider navigationRef={navigationRef}>
          <RootNavigator navigationRef={navigationRef} />
          {/* Onboarding overlay that appears for new users */}
          <OnboardingOverlay />
        </OnboardingProvider>
      </NavigationContainer>
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
  
  // If user is authenticated, show the main app navigator
  // Otherwise, show the authentication navigator (login/signup screens)
  return user ? <AppNavigator /> : <AuthNavigator />;
}