// Global styling constants for consistent UI across the app

import { StyleSheet } from 'react-native';

// Standard bottom spacing for all screens
// This ensures consistent white space between the last content element and screen bottom
export const BOTTOM_SPACING = 80;

// Specific bottom spacing for competition-related screens (active, invites, results)
// Provides extra scroll room for competition cards and action buttons
export const COMPETITION_SCREEN_BOTTOM_SPACING = 100;

// Reusable scroll content styles
export const globalStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: BOTTOM_SPACING,
  },
  
  scrollContentWithHorizontalPadding: {
    paddingHorizontal: 16,
    paddingBottom: BOTTOM_SPACING,
  },
});

// Export individual constant for flexibility
export default {
  BOTTOM_SPACING,
  globalStyles,
};