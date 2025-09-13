import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const screenWidth = Dimensions.get('window').width;

// Exact colors from ActiveCompetitionsScreen
const colors = {
  nav: {
    activeGreen: '#B6DB78',  // Tab bar active green
    inactiveGray: '#B3B3B3', // Tab bar inactive gray
    textDefault: '#111111'
  },
  background: '#FFFFFF'
};

const RecreatedCompetitionTabs = ({ activeTab = 'active', animated = false }) => {
  const baseUnderlineWidth = 60;
  
  // Calculate tab positions
  const calculateTabX = (tabIndex) => {
    const columnWidth = (screenWidth - 48) / 3;  // 3 equal columns with padding
    const columnCenter = columnWidth * tabIndex + columnWidth / 2;
    return columnCenter - baseUnderlineWidth / 2;
  };
  
  const underlinePosition = useRef(new Animated.Value(calculateTabX(0))).current;
  const underlineScale = useRef(new Animated.Value(1.2)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Tab scales for different text widths
  const tabScales = {
    'active': 1.2,
    'invites': 1.3,
    'completed': 1.35
  };

  useEffect(() => {
    // Animate underline position
    const positions = {
      'active': calculateTabX(0),
      'invites': calculateTabX(1),
      'completed': calculateTabX(2),
    };
    
    Animated.parallel([
      Animated.timing(underlinePosition, {
        toValue: positions[activeTab] || calculateTabX(0),
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(underlineScale, {
        toValue: tabScales[activeTab] || 1.2,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation for emphasis
    if (animated) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeTab, animated]);

  return (
    <Animated.View style={[
      styles.container,
      animated && { transform: [{ scale: pulseAnim }] }
    ]}>
      <View style={styles.tabRow}>
        {/* Active Tab */}
        <View style={styles.tabColumn}>
          <View style={styles.tabButton}>
            <Text style={[
              styles.tabLabel,
              { 
                color: activeTab === 'active' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                fontSize: activeTab === 'active' ? 23 : 21  // 10% larger when active
              }
            ]}>
              Active
            </Text>
          </View>
        </View>
        
        {/* Invites Tab */}
        <View style={styles.tabColumn}>
          <View style={styles.tabButton}>
            <Text style={[
              styles.tabLabel,
              { 
                color: activeTab === 'invites' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                fontSize: activeTab === 'invites' ? 23 : 21  // 10% larger when active
              }
            ]}>
              Invites
            </Text>
            {/* Invite badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </View>
        </View>
        
        {/* Completed Tab */}
        <View style={styles.tabColumn}>
          <View style={styles.tabButton}>
            <Text style={[
              styles.tabLabel,
              { 
                color: activeTab === 'completed' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                fontSize: activeTab === 'completed' ? 23 : 21  // 10% larger when active
              }
            ]}>
              Completed
            </Text>
          </View>
        </View>
      </View>
      
      {/* Animated underline */}
      <Animated.View 
        style={[
          styles.underlineIndicator,
          {
            width: baseUnderlineWidth,
            transform: [
              { translateX: underlinePosition },
              { scaleX: underlineScale }
            ]
          }
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 1,
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'flex-end',
  },
  tabColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  underlineIndicator: {
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.nav.activeGreen,
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default RecreatedCompetitionTabs;