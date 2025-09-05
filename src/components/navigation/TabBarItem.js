import React, { useRef, useCallback } from 'react';
import { 
  Pressable, 
  Animated, 
  View, 
  StyleSheet, 
  Platform,
  AccessibilityInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NavigationTheme } from '../../constants/navigationTheme';

const TabBarItem = ({ 
  route, 
  isFocused, 
  onPress, 
  onLongPress,
  isCenter = false,
  icon,
  accessibilityLabel,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: isFocused ? 1 : 0,
      duration: NavigationTheme.animation.colorTransitionMs,
      useNativeDriver: false,
    }).start();
  }, [isFocused, colorAnim]);

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: NavigationTheme.animation.pressScale,
      duration: NavigationTheme.animation.pressDurationMs,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: NavigationTheme.animation.returnDurationMs,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(
        isCenter 
          ? Haptics.ImpactFeedbackStyle.Medium 
          : Haptics.ImpactFeedbackStyle.Light
      );
    }
    
    if (isFocused) {
      AccessibilityInfo.announceForAccessibility(`${accessibilityLabel} selected`);
    }
    
    onPress();
  }, [isCenter, isFocused, accessibilityLabel, onPress]);

  const animatedColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      NavigationTheme.colors.iconInactive,
      NavigationTheme.colors.iconActive,
    ],
  });

  const renderIcon = () => {
    if (isCenter) {
      // Create an animated value for background color that transitions between transparent and green
      const animatedBackgroundColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', NavigationTheme.colors.iconActive],
      });
      
      // Icon color should be white when active (filled), animated color when inactive
      const centerIconColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [NavigationTheme.colors.iconInactive, '#FFFFFF'],
      });
      
      return (
        <Animated.View style={[
          styles.centerButton,
          { 
            borderColor: animatedColor,
            backgroundColor: animatedBackgroundColor
          }
        ]}>
          <Animated.Text style={{ color: centerIconColor }}>
            <Ionicons 
              name="add" 
              size={NavigationTheme.dimensions.centerButtonSize - 18}
            />
          </Animated.Text>
        </Animated.View>
      );
    }

    // For regular icons, switch between outline and filled versions
    const iconName = isFocused && icon.includes('-outline') 
      ? icon.replace('-outline', '') 
      : icon;

    return (
      <Animated.Text style={{ color: animatedColor }}>
        <Ionicons 
          name={iconName}
          size={NavigationTheme.dimensions.iconSizeRegular}
        />
      </Animated.Text>
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.container}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isFocused }}
      hitSlop={{ 
        top: 12, 
        bottom: 12, 
        left: NavigationTheme.spacing.horizontalPadding,
        right: NavigationTheme.spacing.horizontalPadding,
      }}
      android_ripple={
        Platform.OS === 'android' 
          ? {
              color: 'rgba(0, 0, 0, 0.08)',
              borderless: true,
              radius: NavigationTheme.dimensions.minTouchTarget / 2,
            }
          : undefined
      }
    >
      <Animated.View 
        style={[
          styles.iconContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {renderIcon()}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: NavigationTheme.dimensions.minTouchTarget,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: NavigationTheme.dimensions.centerButtonSize,
    height: NavigationTheme.dimensions.centerButtonSize,
    borderRadius: NavigationTheme.dimensions.centerButtonSize / 2,
    borderWidth: NavigationTheme.dimensions.centerButtonStroke,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default TabBarItem;