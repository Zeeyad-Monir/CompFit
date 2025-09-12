import React from 'react';
import { 
  View, 
  StyleSheet, 
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBarItem from './navigation/TabBarItem';
import TabBarDivider from './navigation/TabBarDivider';
import { NavigationTheme } from '../constants/navigationTheme';
import onboardingService from '../services/onboardingService';

const CustomBottomNavigation = ({ 
  state, 
  descriptors, 
  navigation,
  ...props 
}) => {
  const insets = useSafeAreaInsets();
  
  const effectiveBottomPadding = Math.max(
    insets.bottom + NavigationTheme.spacing.safeAreaMinGap,
    NavigationTheme.dimensions.bottomPadding
  );

  const totalHeight = NavigationTheme.dimensions.barHeight + effectiveBottomPadding;

  const getIconName = (routeName) => {
    switch (routeName) {
      case 'HomeStack':
        return 'home-outline';
      case 'CreateStack':
        return 'add';
      case 'ProfileStack':
        return 'person-outline';
      default:
        return 'help-outline';
    }
  };

  const getAccessibilityLabel = (routeName) => {
    switch (routeName) {
      case 'HomeStack':
        return 'Home tab';
      case 'CreateStack':
        return 'Add new item';
      case 'ProfileStack':
        return 'Profile tab';
      default:
        return routeName;
    }
  };

  return (
    <View 
      style={[
        styles.container,
        {
          height: totalHeight,
          paddingBottom: effectiveBottomPadding,
        },
        Platform.OS === 'ios' && NavigationTheme.shadow.ios,
      ]}
      onLayout={(e) => onboardingService.registerTarget('bottom-navigation', e)}
    >
      <TabBarDivider />
      
      <View style={styles.tabsContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isCenter = route.name === 'CreateStack';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            } else if (isFocused) {
              navigation.navigate(route.name, {
                screen: route.name === 'HomeStack' ? 'ActiveCompetitions' :
                        route.name === 'ProfileStack' ? 'Profile' :
                        'CompetitionCreation'
              });
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const getTabId = (routeName) => {
            switch (routeName) {
              case 'HomeStack':
                return 'home-tab';
              case 'CreateStack':
                return 'create-tab';
              case 'ProfileStack':
                return 'profile-tab';
              default:
                return null;
            }
          };

          return (
            <TabBarItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              isCenter={isCenter}
              icon={getIconName(route.name)}
              accessibilityLabel={getAccessibilityLabel(route.name)}
              onLayout={(e) => {
                const tabId = getTabId(route.name);
                if (tabId) {
                  onboardingService.registerTarget(tabId, e);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NavigationTheme.colors.background,
    overflow: 'visible',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: NavigationTheme.dimensions.topPadding,
    overflow: 'visible',
  },
});

export default CustomBottomNavigation;