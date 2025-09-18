/**
 * AppNavigator.js – Main navigation for authenticated users
 * Creates a bottom tab navigation with a custom styled "+" button in the center
 * Handles navigation between Home, Create Competition, and Profile sections
 */

import React, { useEffect, useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import CustomBottomNavigation from '../components/CustomBottomNavigation';
import { useOnboarding } from '../components/onboarding/OnboardingController';
import onboardingService from '../services/onboardingService';
import { AuthContext } from '../contexts/AuthContext';

// Import all screen components used in the authenticated app flow
import {
  ActiveCompetitionsScreen,    // Shows list of active competitions
  CompetitionCreationScreen,   // Form to create new competitions
  CompetitionDetailsScreen,    // Shows details of a specific competition
  LeaderboardScreen,           // Shows competition leaderboard
  SubmissionFormScreen,        // Form to submit workout results
  ProfileScreen,               // User profile and settings
  WorkoutDetailsScreen,        // Shows detailed view of a workout submission
  CompetitionLobbyScreen,      // Competition lobby for upcoming competitions
  ChangeCredentialsScreen,     // Change password/email screen
} from '../screens';

// Create navigator instances
const Tab = createBottomTabNavigator();  // Bottom tab navigator
const Stack = createStackNavigator();    // Stack navigator for nested screens

/**
 * Home Stack Navigator
 * Contains all screens related to viewing and participating in competitions
 * Includes navigation flow: ActiveCompetitions → CompetitionDetails → Leaderboard/SubmissionForm/WorkoutDetails
 */
// In src/navigation/AppNavigator.js, the HomeStack should look like this:

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Main screen showing all active competitions */}
    <Stack.Screen name="ActiveCompetitions" component={ActiveCompetitionsScreen} />
    {/* Competition lobby for upcoming competitions */}
    <Stack.Screen name="CompetitionLobby" component={CompetitionLobbyScreen} />
    {/* Individual competition details view */}
    <Stack.Screen name="CompetitionDetails" component={CompetitionDetailsScreen} />
    {/* Competition leaderboard view */}
    <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
    {/* Form to submit workout results */}
    <Stack.Screen name="SubmissionForm" component={SubmissionFormScreen} />
    {/* Detailed view of a workout submission */}
    <Stack.Screen name="WorkoutDetails" component={WorkoutDetailsScreen} />
  </Stack.Navigator>
);

/**
 * Create Stack Navigator
 * Contains screens for creating new competitions
 * Currently only has the creation form, but could be extended with preview/confirmation screens
 */
const CreateStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Competition creation form */}
    <Stack.Screen name="CompetitionCreation" component={CompetitionCreationScreen} />
  </Stack.Navigator>
);

/**
 * Profile Stack Navigator
 * Contains screens related to user profile and settings
 * Currently only has the main profile screen, but could be extended with settings, edit profile, etc.
 */
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* User profile and settings screen */}
    <Stack.Screen name="Profile" component={ProfileScreen} />
    {/* Change password/email screen */}
    <Stack.Screen name="ChangeCredentials" component={ChangeCredentialsScreen} />
  </Stack.Navigator>
);

/**
 * Main App Navigator
 * Creates the bottom tab navigation with three main sections:
 * 1. Home (competition browsing and participation)
 * 2. Create (competition creation with custom styled button)
 * 3. Profile (user profile and settings)
 */
const AppNavigator = () => {
  const { startOnboarding } = useOnboarding();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    // Check and start onboarding for users who haven't seen it
    const initOnboarding = async () => {
      if (!user?.uid) {
        console.log('No authenticated user, skipping onboarding check');
        return;
      }
      
      const hasCompleted = await onboardingService.hasCompletedOnboarding(user.uid);
      if (!hasCompleted) {
        // Delay to ensure navigation and all components are ready
        setTimeout(() => {
          console.log('Starting onboarding for user:', user.uid);
          startOnboarding();
        }, 1000);
      }
    };
    initOnboarding();
  }, [user]); // Re-run when user changes

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,           // Hide default headers (screens handle their own)
        tabBarShowLabel: false,       // Hide tab labels, show only icons
      }}
      
    >
      {/* Home Tab - Competition browsing and participation */}
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
      />

      {/* Create Tab - Competition creation with custom styled "+" button */}
      <Tab.Screen
        name="CreateStack"
        component={CreateStack}
      />

      {/* Profile Tab - User profile and settings */}
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;