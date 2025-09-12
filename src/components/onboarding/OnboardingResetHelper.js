// Developer helper component to reset onboarding for testing
// Can be integrated into ProfileScreen for easy testing

import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import onboardingService from '../../services/onboardingService';

const OnboardingResetHelper = ({ children, style }) => {
  const [tapCount, setTapCount] = useState(0);
  const [resetTimeout, setResetTimeout] = useState(null);

  const handleTap = () => {
    // Clear previous timeout
    if (resetTimeout) {
      clearTimeout(resetTimeout);
    }

    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // Triple tap to reset onboarding
    if (newTapCount >= 3) {
      Alert.alert(
        'Developer Options',
        'Reset onboarding tutorial?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Reset',
            onPress: async () => {
              await onboardingService.resetOnboarding();
              Alert.alert('Success', 'Onboarding will show on next app restart');
            },
          },
        ]
      );
      setTapCount(0);
    } else {
      // Reset tap count after 1 second
      const timeout = setTimeout(() => {
        setTapCount(0);
      }, 1000);
      setResetTimeout(timeout);
    }
  };

  return (
    <TouchableOpacity onPress={handleTap} style={style} activeOpacity={1}>
      {children}
    </TouchableOpacity>
  );
};

export default OnboardingResetHelper;