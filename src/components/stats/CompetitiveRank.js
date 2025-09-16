import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const TIERS = [
  {
    name: 'Bronze',
    minWins: 0,
    maxWins: 4,
    color: '#B87333',
    gradient: ['#CD7F32', '#B87333'],
    icon: 'shield',
  },
  {
    name: 'Silver',
    minWins: 5,
    maxWins: 14,
    color: '#C0C0C0',
    gradient: ['#E5E5E5', '#C0C0C0'],
    icon: 'shield',
  },
  {
    name: 'Gold',
    minWins: 15,
    maxWins: 29,
    color: '#FFD700',
    gradient: ['#FFED4B', '#FFD700'],
    icon: 'shield',
  },
  {
    name: 'Platinum',
    minWins: 30,
    maxWins: 49,
    color: '#E5E4E2',
    gradient: ['#F4F4F4', '#E5E4E2'],
    icon: 'shield-checkmark',
  },
  {
    name: 'Diamond',
    minWins: 50,
    maxWins: Infinity,
    color: '#B9F2FF',
    gradient: ['#E0F7FF', '#B9F2FF'],
    icon: 'diamond',
  },
];

export default function CompetitiveRank({ wins, losses, globalRank }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const getTier = () => {
    return TIERS.find(tier => wins >= tier.minWins && wins <= tier.maxWins) || TIERS[0];
  };

  const getNextTier = () => {
    const currentTierIndex = TIERS.findIndex(tier => wins >= tier.minWins && wins <= tier.maxWins);
    return currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;
  };

  const tier = getTier();
  const nextTier = getNextTier();
  const progressToNext = nextTier 
    ? ((wins - tier.minWins) / (nextTier.minWins - tier.minWins)) * 100
    : 100;

  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  const percentile = calculatePercentile(winRate);

  useEffect(() => {
    // Entry animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Shimmer effect for tier badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  function calculatePercentile(winRate) {
    // Mock calculation - in real app would compare against all users
    if (winRate >= 80) return 95;
    if (winRate >= 70) return 85;
    if (winRate >= 60) return 75;
    if (winRate >= 50) return 60;
    if (winRate >= 40) return 45;
    return 30;
  }

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={tier.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Tier Badge */}
          <View style={styles.tierBadgeContainer}>
            <View style={styles.tierBadge}>
              <Ionicons name={tier.icon} size={40} color={tier.color} />
              <Animated.View 
                style={[
                  styles.shimmer,
                  { opacity: shimmerOpacity }
                ]}
              />
            </View>
            <Text style={styles.tierName}>{tier.name} Tier</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Top {percentile}%</Text>
              <Text style={styles.statLabel}>Percentile</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>#{globalRank || '---'}</Text>
              <Text style={styles.statLabel}>Global Rank</Text>
            </View>
          </View>

          {/* Progress to Next Tier */}
          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Progress to {nextTier.name}</Text>
                <Text style={styles.progressText}>
                  {wins}/{nextTier.minWins} wins
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <Animated.View 
                    style={[
                      styles.progressBarFill,
                      { 
                        width: `${progressToNext}%`,
                        backgroundColor: nextTier.color,
                      }
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.winsNeeded}>
                {nextTier.minWins - wins} more wins needed
              </Text>
            </View>
          )}

          {/* Decorative Elements */}
          <View style={styles.decorativePattern}>
            {[...Array(3)].map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.decorativeDot,
                  { 
                    opacity: 0.1 + i * 0.1,
                    transform: [{ scale: 1 - i * 0.2 }]
                  }
                ]}
              />
            ))}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  gradient: {
    borderRadius: 20,
  },
  content: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  tierBadgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tierBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  tierName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressSection: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  winsNeeded: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  decorativePattern: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 4,
  },
  decorativeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
  },
});