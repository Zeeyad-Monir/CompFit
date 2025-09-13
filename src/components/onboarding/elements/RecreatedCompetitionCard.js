import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RecreatedCompetitionCard = ({ highlightButton = null, animated = false, showAsCompleted = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      // Card entrance animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        from: 0.9,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();

      // Button highlight animation
      if (highlightButton) {
        Animated.sequence([
          Animated.timing(buttonScaleAnim, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(buttonScaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [animated, highlightButton]);

  // For submit step, show as active card
  // For leaderboard step, show as completed card with green border
  const isCompletedStyle = showAsCompleted || highlightButton === 'leaderboard';

  return (
    <Animated.View style={[
      isCompletedStyle ? styles.completedCard : styles.card,
      animated && { transform: [{ scale: scaleAnim }] }
    ]}>
      {/* Status Badge */}
      <View style={styles.statusBadgeActive}>
        <Text style={styles.statusBadgeText}>Active</Text>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        December Fitness Challenge
      </Text>
      
      {/* Meta text */}
      <Text style={[styles.metaText, styles.metaTextTight]}>
        Created by Alex • 5 friends competing
      </Text>

      {/* Action Link or Buttons */}
      {highlightButton === 'submit' ? (
        <View style={styles.actionLinkContainer}>
          <TouchableOpacity>
            <Animated.Text 
              style={[
                styles.actionLink, 
                { transform: [{ scale: buttonScaleAnim }] }
              ]}
            >
              Submit Today's Activity →
            </Animated.Text>
          </TouchableOpacity>
        </View>
      ) : highlightButton === 'leaderboard' ? (
        <View style={styles.actionLinkContainer}>
          <TouchableOpacity>
            <Animated.Text 
              style={[
                styles.actionLink, 
                { transform: [{ scale: buttonScaleAnim }] }
              ]}
            >
              View Leaderboard →
            </Animated.Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionLinkContainer}>
          <Text style={styles.actionLink}>
            Submit Today's Activity →
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 22,
    marginBottom: 24,
    position: 'relative',
    height: 120,
    width: '85%',
    alignSelf: 'center',
  },
  completedCard: {
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 22,  // Reduced by 2px to compensate for border
    paddingTop: 20,         // Reduced by 2px to compensate for border
    paddingBottom: 20,      // Reduced by 2px to compensate for border
    marginBottom: 24,
    position: 'relative',
    height: 120,
    width: '85%',
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#B6DB78',  // Tab bar active green
  },
  cardTitle: { 
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '700', 
    color: '#FFFFFF',
    paddingRight: 74,  // Space for badge
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#B8C0C7',
    marginTop: 6,
  },
  metaTextTight: {
    marginTop: 4,
  },
  actionLinkContainer: {
    marginTop: 14,
  },
  actionLink: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    color: '#93D13C',
  },
  statusBadgeActive: {
    position: 'absolute',
    top: 18,
    right: 14,
    minWidth: 52,
    minHeight: 26,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999, // Fully rounded pill shape
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: '#8DC63F', // Bright lime green
    
    // Shadow for depth
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    
    // Inner highlight for visual depth
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default RecreatedCompetitionCard;