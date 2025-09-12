import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OnboardingProgress = ({ currentStep, totalSteps }) => {
  const animatedValues = useRef(
    Array(totalSteps).fill(0).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    animatedValues.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index <= currentStep ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  }, [currentStep]);

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        {Array(totalSteps).fill(0).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: animatedValues[index],
                transform: [
                  {
                    scale: animatedValues[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.dotInner,
                index === currentStep && styles.activeDot,
              ]}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    width: SCREEN_WIDTH,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    marginHorizontal: 6,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#B6DB78',
  },
});

export default OnboardingProgress;