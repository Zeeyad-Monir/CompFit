import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import RecreatedBottomNav from './elements/RecreatedBottomNav';
import RecreatedCompetitionTabs from './elements/RecreatedCompetitionTabs';
import RecreatedCompetitionCard from './elements/RecreatedCompetitionCard';
import RecreatedCreateButton from './elements/RecreatedCreateButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingElementDisplay = ({ stepId, elementType, highlightArea }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Reset animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepId]);

  const renderElement = () => {
    switch (elementType) {
      case 'bottom-nav':
        return (
          <RecreatedBottomNav 
            highlightTab={highlightArea}
            animated={true}
          />
        );

      case 'competition-tabs':
        return (
          <RecreatedCompetitionTabs
            activeTab={highlightArea || 'active'}
            animated={true}
          />
        );

      case 'competition-card':
        return (
          <RecreatedCompetitionCard
            highlightButton={highlightArea}
            animated={true}
          />
        );

      case 'create-button':
        return (
          <RecreatedCreateButton
            animated={true}
            showPresets={highlightArea === 'with-presets'}
          />
        );

      case 'competition-card-submit':
        return (
          <RecreatedCompetitionCard
            highlightButton="submit"
            animated={true}
          />
        );

      case 'competition-card-leaderboard':
        return (
          <RecreatedCompetitionCard
            highlightButton="leaderboard"
            animated={true}
          />
        );

      case 'profile-nav':
        return (
          <RecreatedBottomNav 
            highlightTab="profile"
            animated={true}
          />
        );

      default:
        return (
          <RecreatedBottomNav 
            highlightTab="home"
            animated={true}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.elementContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {renderElement()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  elementContainer: {
    width: '100%',
    alignItems: 'center',
  },
});

export default OnboardingElementDisplay;