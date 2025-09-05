import { StyleSheet } from 'react-native';

export const NavigationTheme = {
  colors: {
    background: '#11171B',
    divider: 'rgba(255,255,255,0.10)',
    iconInactive: 'rgba(255,255,255,0.70)',
    iconActive: '#AEEA4D',
    badgeRed: '#FF3B30',
    badgeText: '#FFFFFF',
  },
  dimensions: {
    barHeight: 64,
    topPadding: 8,
    bottomPadding: 10,
    iconSizeRegular: 28,
    centerButtonSize: 40,
    centerButtonStroke: 2.5,
    iconStroke: 2,
    plusLineStroke: 2,
    minTouchTarget: 48,
    hairlineWidth: StyleSheet.hairlineWidth,
  },
  shadow: {
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: -2 },
      shadowRadius: 8,
    },
    androidGradient: {
      height: 8,
      colors: ['rgba(0,0,0,0.18)', 'rgba(0,0,0,0)'],
    },
  },
  animation: {
    colorTransitionMs: 150,
    pressScale: 0.96,
    pressDurationMs: 80,
    returnDurationMs: 80,
  },
  spacing: {
    horizontalPadding: 24,
    iconLabelGap: 4,
    safeAreaMinGap: 8,
  },
  typography: {
    labelSize: 11,
    labelWeight: '500',
    labelLetterSpacing: 0.2,
  },
};