// Import gesture handler for React Navigation to work properly
import 'react-native-gesture-handler';
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator   from './src/navigation/AppNavigator';
import AuthNavigator  from './src/navigation/AuthNavigator';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';

/**
 * Main App component that sets up the entire application structure
 * This component wraps the entire app with authentication and navigation providers
 * @returns {JSX.Element} The main app component
 */
export default function App() {
  return (
    // AuthProvider wraps the entire app to provide authentication context
    <AuthProvider>
      {/* NavigationContainer enables navigation throughout the app */}
      <NavigationContainer>
        <Root />
      </NavigationContainer>
    </AuthProvider>
  );
}

/**
 * Root component that handles conditional rendering based on authentication state
 * This component decides whether to show the authenticated or unauthenticated experience
 * @returns {JSX.Element} Either AppNavigator (for authenticated users) or AuthNavigator (for unauthenticated users)
 */
function Root() {
  // Get the current user from the authentication context
  const { user } = useContext(AuthContext);
  
  // If user is authenticated, show the main app navigator
  // Otherwise, show the authentication navigator (login/signup screens)
  return user ? <AppNavigator /> : <AuthNavigator />;
}