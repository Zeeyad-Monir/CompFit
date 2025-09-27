// Global styling constants for consistent UI across the app

import { StyleSheet } from 'react-native';

// Standard bottom spacing for all screens
// This ensures consistent white space between the last content element and screen bottom
export const BOTTOM_SPACING = 80;

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