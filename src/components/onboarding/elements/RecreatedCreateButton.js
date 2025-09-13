import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Exact dimensions from NavigationTheme
const NavigationTheme = {
  colors: {
    iconInactive: '#333333',
    iconActive: '#9BBA66',
  },
  dimensions: {
    centerButtonSize: 46,
    centerButtonStroke: 2.0,
  },
};

const RecreatedCreateButton = ({ animated = false, showPresets = false }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      // Button entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);
    }
  }, [animated]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.button,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: spin },
            ],
            opacity: fadeAnim,
          },
        ]}
      >
        <Ionicons 
          name="add" 
          size={NavigationTheme.dimensions.centerButtonSize - 18}
          color="#FFFFFF"
        />
      </Animated.View>
      
      <Animated.Text style={[styles.label, { opacity: fadeAnim }]}>
        Create Competition
      </Animated.Text>

      {showPresets && (
        <Animated.View style={[styles.presetsContainer, { opacity: fadeAnim }]}>
          <View style={styles.presetCard}>
            <View style={styles.presetIconContainer}>
              <Ionicons name="flash" size={28} color="#93D13C" />
            </View>
            <Text style={styles.presetTitle}>Quick Start</Text>
            <Text style={styles.presetDescription}>7-day challenge</Text>
          </View>
          <View style={styles.presetCard}>
            <View style={styles.presetIconContainer}>
              <Ionicons name="calendar" size={28} color="#93D13C" />
            </View>
            <Text style={styles.presetTitle}>Monthly</Text>
            <Text style={styles.presetDescription}>30-day challenge</Text>
          </View>
          <View style={styles.presetCard}>
            <View style={styles.presetIconContainer}>
              <Ionicons name="settings" size={28} color="#93D13C" />
            </View>
            <Text style={styles.presetTitle}>Custom</Text>
            <Text style={styles.presetDescription}>Your rules</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  button: {
    width: NavigationTheme.dimensions.centerButtonSize,
    height: NavigationTheme.dimensions.centerButtonSize,
    borderRadius: NavigationTheme.dimensions.centerButtonSize / 2,
    backgroundColor: NavigationTheme.colors.iconActive,
    borderWidth: NavigationTheme.dimensions.centerButtonStroke,
    borderColor: NavigationTheme.colors.iconActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 32,
  },
  presetsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  presetCard: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#93D13C',
  },
  presetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(147, 211, 60, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  presetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 11,
    color: '#B8C0C7',
    fontWeight: '500',
  },
});

export default RecreatedCreateButton;