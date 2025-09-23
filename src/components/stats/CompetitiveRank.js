import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  ScrollView,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * CompetitiveRank Component - Friends-based ranking display using BPR
 * Shows user's ranking among friends with Bayesian Placement Rating
 */
export default function CompetitiveRank({ 
  friendsRank,
  totalFriends,
  friendsPercentile,
  bprScore,
  isProvisional,
  friendsRankingList = []
}) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const standingsHeight = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  const [showStandings, setShowStandings] = useState(false);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);

  // Calculate gradient colors based on percentile among friends
  const getGradientColors = () => {
    if (!friendsPercentile && friendsPercentile !== 0) return ['#E5E7EB', '#9CA3AF']; // Gray for no data
    
    // Higher percentile = better (more friends behind you)
    if (friendsPercentile >= 80) {
      return ['#86EFAC', '#22C55E']; // Green - top 20%
    } else if (friendsPercentile >= 60) {
      return ['#BEF264', '#84CC16']; // Lime - top 40%  
    } else if (friendsPercentile >= 40) {
      return ['#FDE047', '#EAB308']; // Yellow - top 60%
    } else if (friendsPercentile >= 20) {
      return ['#FDBA74', '#F97316']; // Orange - top 80%
    } else {
      return ['#FCA5A5', '#EF4444']; // Red - bottom 20%
    }
  };

  // Get rank suffix (1st, 2nd, 3rd, etc.)
  const getRankSuffix = (rank) => {
    if (!rank) return '';
    const lastDigit = rank % 10;
    const lastTwoDigits = rank % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }
    
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Format BPR score display
  const formatBPRScore = () => {
    if (!bprScore && bprScore !== 0) return '---';
    return bprScore.toFixed(2);
  };

  // Get performance description based on rank position
  const getPerformanceText = () => {
    if (!friendsRank || !totalFriends) return 'No ranking data';
    
    if (friendsRank === 1) return 'Leading the Pack';
    if (friendsRank === 2) return 'Close Second';
    if (friendsRank === 3) return 'Podium Finisher';
    
    const topPercentage = 100 - friendsPercentile;
    if (topPercentage <= 25) return 'Top Performer';
    if (topPercentage <= 50) return 'Strong Competitor';
    if (topPercentage <= 75) return 'Solid Contender';
    return 'Building Momentum';
  };

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation for top performers
    if (friendsPercentile >= 80) { // Top 20%
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [friendsPercentile]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // Toggle standings dropdown
  const toggleStandings = () => {
    const isClosing = showStandings;
    const toValue = isClosing ? 0 : 207; // Increased by 10% from 188
    
    // Use timing instead of spring for smoother animation
    Animated.timing(standingsHeight, {
      toValue,
      duration: isClosing ? 250 : 300,  // Slightly faster when closing
      easing: isClosing 
        ? Easing.bezier(0.4, 0.0, 0.6, 1)  // Ease-in for closing
        : Easing.bezier(0.0, 0.0, 0.2, 1),  // Ease-out for opening
      useNativeDriver: false,
    }).start((finished) => {
      // Update state AFTER animation completes to prevent flicker
      if (finished && isClosing) {
        setShowStandings(false);
      }
    });
    
    // For opening, update state immediately
    if (!isClosing) {
      setShowStandings(true);
    }
  };
  
  // Toggle info overlay
  const toggleInfoOverlay = () => {
    const toValue = showInfoOverlay ? 0 : 1;
    
    if (!showInfoOverlay) {
      setShowInfoOverlay(true);
    }
    
    Animated.timing(overlayOpacity, {
      toValue,
      duration: 200,
      easing: Easing.bezier(0.0, 0.0, 0.2, 1),
      useNativeDriver: true,
    }).start((finished) => {
      if (finished && toValue === 0) {
        setShowInfoOverlay(false);
      }
    });
  };

  // Handle case where no friends data is available
  if (!totalFriends || totalFriends === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noDataCard}>
          <Ionicons name="people-outline" size={48} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>Add Friends to Compare Rankings</Text>
          <Text style={styles.noDataSubtext}>
            Your competitive ranking will appear here once you have friends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Header with title and info */}
          <View style={styles.header}>
            <Text style={styles.title}>Friends Ranking</Text>
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={toggleInfoOverlay}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={23} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {/* BPR Score Display */}
          <View style={styles.bprContainer}>
            <Animated.View 
              style={[
                styles.bprCircle,
                { 
                  transform: [
                    { scale: pulseAnim },
                    { rotate: spin }
                  ] 
                }
              ]}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                style={styles.bprCircleGradient}
              >
                <Text style={styles.rankScore}>
                  {friendsRank ? `${friendsRank}${getRankSuffix(friendsRank)}` : '---'}
                </Text>
                <Text style={styles.rankLabel}>of {totalFriends} friends</Text>
              </LinearGradient>
            </Animated.View>
            
            {/* Provisional Badge */}
            {isProvisional && (
              <View style={styles.provisionalBadge}>
                <Ionicons name="timer-outline" size={12} color="#F59E0B" />
                <Text style={styles.provisionalText}>Provisional</Text>
              </View>
            )}
          </View>
          
          {/* Performance Text */}
          <Text style={styles.performanceText}>{getPerformanceText()}</Text>
          
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={styles.statValueContainer}>
                <Text style={styles.statValue}>
                  {formatBPRScore()}
                </Text>
              </View>
              <Text style={styles.statLabel}>BPR Score</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <View style={styles.statValueContainer}>
                <Text style={styles.statValue}>
                  {friendsPercentile !== null && friendsPercentile !== undefined 
                    ? `Top ${Math.max(1, 100 - friendsPercentile)}%` 
                    : '---'}
                </Text>
              </View>
              <Text style={styles.statLabel}>Among Friends</Text>
            </View>
          </View>
          
          {/* See standings toggle */}
          {friendsRankingList.length > 0 && (
            <TouchableOpacity 
              style={styles.standingsToggle}
              onPress={toggleStandings}
              activeOpacity={0.7}
            >
              <Text style={styles.standingsToggleText}>
                {showStandings ? '\u2191 Hide standings' : '\u2193 See standings'}
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Expandable Standings Container */}
          <Animated.View style={[styles.standingsContainer, { height: standingsHeight }]}>
            <ScrollView 
              style={styles.standingsList}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.standingsContent}
            >
              {friendsRankingList.map((friend) => (
                <View 
                  key={friend.rank}
                  style={[
                    styles.standingRow,
                    friend.isCurrentUser && styles.standingRowHighlighted
                  ]}
                >
                  <Text style={[
                    styles.standingRank,
                    friend.isCurrentUser && styles.standingTextHighlighted
                  ]}>
                    {friend.rank}{getRankSuffix(friend.rank)}
                  </Text>
                  
                  <View style={styles.standingProfilePic}>
                    {friend.profilePicture ? (
                      <Image 
                        source={{ uri: friend.profilePicture }}
                        style={styles.standingProfileImage}
                      />
                    ) : (
                      <View style={styles.standingProfilePlaceholder}>
                        <Ionicons 
                          name="person-circle" 
                          size={35} 
                          color={friend.isCurrentUser ? '#22C55E' : '#9CA3AF'} 
                        />
                      </View>
                    )}
                  </View>
                  
                  <Text style={[
                    styles.standingName,
                    friend.isCurrentUser && styles.standingTextHighlighted
                  ]}>
                    {friend.name}
                  </Text>
                  
                  <Text style={[
                    styles.standingScore,
                    friend.isCurrentUser && styles.standingTextHighlighted
                  ]}>
                    {friend.bpr.toFixed(2)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
          
          {/* Info Overlay */}
          {showInfoOverlay && (
            <Animated.View 
              style={[
                styles.infoOverlay,
                { opacity: overlayOpacity }
              ]}
            >
              <TouchableOpacity 
                style={styles.infoOverlayBackground}
                activeOpacity={1}
                onPress={toggleInfoOverlay}
              />
              <Animated.View 
                style={[
                  styles.infoCard,
                  {
                    transform: [{
                      scale: overlayOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      })
                    }]
                  }
                ]}
              >
                <TouchableOpacity 
                  style={styles.infoCloseButton}
                  onPress={toggleInfoOverlay}
                >
                  <Ionicons name="close-circle" size={24} color="#6B7280" />
                </TouchableOpacity>
                
                <Text style={styles.infoTitle}>How BPR Works</Text>
                
                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <Ionicons name="trophy" size={20} color="#F59E0B" />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>Better placement</Text>: Higher score
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="people" size={20} color="#8B5CF6" />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>Bigger competitions</Text>: Count more
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={20} color="#3B82F6" />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>Recent results</Text>: Matter most
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="trending-up" size={20} color="#10B981" />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>More competitions</Text>: Stable rank
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.infoFooter}>
                  Your BPR score (0-1) determines your rank among friends
                </Text>
              </Animated.View>
            </Animated.View>
          )}
          
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
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  infoButton: {
    padding: 4,
  },
  bprContainer: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  bprCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bprCircleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankScore: {
    fontSize: 35,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -1,
  },
  rankLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  provisionalBadge: {
    position: 'absolute',
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  provisionalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  performanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  statContext: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noDataCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  standingsToggle: {
    paddingTop: 16,     // Increased from 8 for more space above
    paddingBottom: 8,   // Keep bottom padding the same
    alignItems: 'center',
  },
  standingsToggleText: {
    fontSize: 17,  // Decreased by 10% from 19
    color: '#6B7280',
    fontWeight: '600',
  },
  standingsContainer: {
    overflow: 'hidden',
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  standingsList: {
    maxHeight: 193, // Increased by 10% from 175
  },
  standingsContent: {
    paddingVertical: 4,
  },
  standingRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 15,  // Increased to accommodate larger content
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  standingRowHighlighted: {
    backgroundColor: '#F0FDF4', // Light green background
  },
  standingRank: {
    fontSize: 17,  // Decreased by 5%
    fontWeight: '700',
    color: '#6B7280',
    width: 50,  // Increased to accommodate larger text
    marginRight: 12,  // Space between rank and profile picture
  },
  standingName: {
    flex: 1,
    fontSize: 17,  // Decreased by 5%
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 10,  // Space after profile picture
  },
  standingScore: {
    fontSize: 17,  // Decreased by 5%
    fontWeight: '600',
    color: '#6B7280',
  },
  standingTextHighlighted: {
    color: '#22C55E', // Green for current user
    fontWeight: '700',
  },
  infoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  infoOverlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  infoCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  infoBold: {
    fontWeight: '600',
    color: '#1F2937',
  },
  infoFooter: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  standingProfilePic: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  standingProfileImage: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  standingProfilePlaceholder: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});