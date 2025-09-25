import { StyleSheet } from 'react-native';

export const NavigationTheme = {
  colors: {
    background: '#FFFFFF',
    divider: 'rgba(0,0,0,0.08)',
    iconInactive: '#333333',
    iconActive: '#9BBA66',
    badgeRed: '#FF3B30',
    badgeText: '#FFFFFF',
  },
  dimensions: {
    barHeight: 45,
    topPadding: 14,
    bottomPadding: 0,
    iconSizeRegular: 29,
    centerButtonSize: 41,
    centerButtonStroke: 2.0,
    iconStroke: 2,
    plusLineStroke: 2,
    minTouchTarget: 43,
    hairlineWidth: StyleSheet.hairlineWidth,
  },
  shadow: {
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: -2 },
      shadowRadius: 10,
    },
    androidGradient: {
      height: 8,
      colors: ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0)'],
    },
  },
  animation: {
    colorTransitionMs: 150,
    pressScale: 0.96,
    pressDurationMs: 80,
    returnDurationMs: 80,
  },
  spacing: {
    horizontalPadding: 22,
    iconLabelGap: 4,
    safeAreaMinGap: 7,
  },
  typography: {
    labelSize: 11,
    labelWeight: '500',
    labelLetterSpacing: 0.2,
  },
};