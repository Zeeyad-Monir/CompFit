/**
 * AppNavigator.js – Main navigation for authenticated users
 * Creates a bottom tab navigation with a custom styled "+" button in the center
 * Handles navigation between Home, Create Competition, and Profile sections
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Import all screen components used in the authenticated app flow
import {
  ActiveCompetitionsScreen,    // Shows list of active competitions
  CompetitionCreationScreen,   // Form to create new competitions
  CompetitionDetailsScreen,    // Shows details of a specific competition
  LeaderboardScreen,           // Shows competition leaderboard
  SubmissionFormScreen,        // Form to submit workout results
  ProfileScreen,               // User profile and settings
  WorkoutDetailsScreen,        // Shows detailed view of a workout submission
} from '../screens';

// Create navigator instances
const Tab = createBottomTabNavigator();  // Bottom tab navigator
const Stack = createStackNavigator();    // Stack navigator for nested screens

/**
 * Home Stack Navigator
 * Contains all screens related to viewing and participating in competitions
 * Includes navigation flow: ActiveCompetitions → CompetitionDetails → Leaderboard/SubmissionForm/WorkoutDetails
 */
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Main screen showing all active competitions */}
    <Stack.Screen name="ActiveCompetitions" component={ActiveCompetitionsScreen} />
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
  </Stack.Navigator>
);

/**
 * Main App Navigator
 * Creates the bottom tab navigation with three main sections:
 * 1. Home (competition browsing and participation)
 * 2. Create (competition creation with custom styled button)
 * 3. Profile (user profile and settings)
 */
const AppNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,           // Hide default headers (screens handle their own)
      tabBarStyle: styles.tabBar,   // Custom styling for the tab bar
      tabBarShowLabel: false,       // Hide tab labels, show only icons
    }}
  >
    {/* Home Tab - Competition browsing and participation */}
    <Tab.Screen
      name="HomeStack"
      component={HomeStack}
      options={{
        tabBarIcon: ({ focused }) => (
          <Ionicons
            name="home"
            size={30}
            // Green when active, gray when inactive
            color={focused ? '#A4D65E' : '#777777'}
          />
        ),
      }}
    />

    {/* Create Tab - Competition creation with custom styled "+" button */}
    <Tab.Screen
      name="CreateStack"
      component={CreateStack}
      options={{
        tabBarIcon: () => (
          // Custom container for the elevated "+" button
          <View style={styles.addButtonContainer}>
            <View style={styles.addButton}>
              <Ionicons name="add" size={34} color="#FFFFFF" />
            </View>
          </View>
        ),
      }}
    />

    {/* Profile Tab - User profile and settings */}
    <Tab.Screen
      name="ProfileStack"
      component={ProfileStack}
      options={{
        tabBarIcon: ({ focused }) => (
          <Ionicons
            name="person"
            size={30}
            // Green when active, gray when inactive
            color={focused ? '#A4D65E' : '#777777'}
          />
        ),
      }}
    />
  </Tab.Navigator>
);

/**
 * Styles for the tab bar and custom "+" button
 */
const styles = StyleSheet.create({
  // Main tab bar styling
  tabBar: {
    height: 90,                   // Taller tab bar to accommodate custom button
    backgroundColor: '#192126',   // Dark background to match app theme
    borderTopWidth: 0,            // Remove default border
  },
  
  // Container for the custom "+" button
  addButtonContainer: {
    position: 'absolute',         // Position absolutely within tab bar
    bottom: 0,                    // Align to bottom of tab bar
    alignItems: 'center',         // Center horizontally
    justifyContent: 'center',     // Center vertically
    width: '100%',                // Full width of tab item
    height: '100%',               // Full height of tab item
  },
  
  // Styling for the circular "+" button
  addButton: {
    backgroundColor: '#A4D65E',   // Green background (app's primary color)
    width: 45,                    // Fixed width
    height: 45,                   // Fixed height (makes it circular)
    borderRadius: 50,             // Circular shape
    borderWidth: 2,               // Border around button
    borderColor: '#000',          // Black border
    alignItems: 'center',         // Center icon horizontally
    justifyContent: 'center',     // Center icon vertically
    bottom: -5,                   // Slightly elevate button above tab bar
  },
});

export default AppNavigator;