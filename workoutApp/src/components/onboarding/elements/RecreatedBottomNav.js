import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import the actual navigation theme for exact colors
const NavigationTheme = {
  colors: {
    background: '#FFFFFF',
    divider: 'rgba(0,0,0,0.08)',
    iconInactive: '#333333',
    iconActive: '#9BBA66',
  },
  dimensions: {
    barHeight: 50,
    topPadding: 16,
    iconSizeRegular: 32,
    centerButtonSize: 46,
    centerButtonStroke: 2.0,
    minTouchTarget: 48,
  },
  shadow: {
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: -2 },
      shadowRadius: 10,
    },
  },
};

const RecreatedBottomNav = ({ highlightTab = 'home', animated = false }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (animated && highlightTab) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [highlightTab, animated]);

  const getIconStyle = (tab) => {
    const isHighlighted = highlightTab === tab;
    return {
      transform: isHighlighted && animated ? [{ scale: scaleAnim }] : [],
    };
  };

  const getIconColor = (tab) => {
    return highlightTab === tab 
      ? NavigationTheme.colors.iconActive 
      : NavigationTheme.colors.iconInactive;
  };

  const getIconName = (tab) => {
    const isFocused = highlightTab === tab;
    if (tab === 'home') {
      return isFocused ? 'home' : 'home-outline';
    } else if (tab === 'profile') {
      return isFocused ? 'person' : 'person-outline';
    }
    return 'add';
  };

  const renderCenterButton = () => {
    const isFocused = highlightTab === 'create';
    
    return (
      <Animated.View style={[styles.createTabContainer, getIconStyle('create')]}>
        <View style={[
          styles.createTab,
          {
            backgroundColor: isFocused ? NavigationTheme.colors.iconActive : 'transparent',
            borderColor: isFocused 
              ? NavigationTheme.colors.iconActive 
              : NavigationTheme.colors.iconInactive,
          }
        ]}>
          <Ionicons 
            name="add" 
            size={NavigationTheme.dimensions.centerButtonSize - 18}
            color={isFocused ? '#FFFFFF' : NavigationTheme.colors.iconInactive}
          />
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[
      styles.container,
      Platform.OS === 'ios' && NavigationTheme.shadow.ios,
    ]}>
      {/* Divider line at top */}
      <View style={styles.divider} />
      
      <View style={styles.tabBar}>
        {/* Home Tab */}
        <Animated.View style={[styles.tab, getIconStyle('home')]}>
          <Ionicons 
            name={getIconName('home')}
            size={NavigationTheme.dimensions.iconSizeRegular}
            color={getIconColor('home')}
          />
        </Animated.View>

        {/* Create Tab - Special styling */}
        {renderCenterButton()}

        {/* Profile Tab */}
        <Animated.View style={[styles.tab, getIconStyle('profile')]}>
          <Ionicons 
            name={getIconName('profile')}
            size={NavigationTheme.dimensions.iconSizeRegular}
            color={getIconColor('profile')}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: NavigationTheme.colors.background,
    width: '100%',
    paddingBottom: 20, // For safe area in onboarding context
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: NavigationTheme.colors.divider,
    width: '100%',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: NavigationTheme.dimensions.topPadding,
    height: NavigationTheme.dimensions.barHeight + NavigationTheme.dimensions.topPadding,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: NavigationTheme.dimensions.minTouchTarget,
  },
  createTabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTab: {
    width: NavigationTheme.dimensions.centerButtonSize,
    height: NavigationTheme.dimensions.centerButtonSize,
    borderRadius: NavigationTheme.dimensions.centerButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: NavigationTheme.dimensions.centerButtonStroke,
  },
});

export default RecreatedBottomNav;