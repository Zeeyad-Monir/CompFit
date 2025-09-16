import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACHIEVEMENTS = [
  {
    id: 'first_win',
    name: 'First Victory',
    icon: 'trophy',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    requirement: (stats) => stats.wins >= 1,
    description: 'Win your first competition',
  },
  {
    id: 'win_streak_3',
    name: 'On Fire',
    icon: 'flame',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    requirement: (stats) => stats.currentStreak >= 3,
    description: '3 wins in a row',
  },
  {
    id: 'win_streak_5',
    name: 'Unstoppable',
    icon: 'rocket',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    requirement: (stats) => stats.currentStreak >= 5,
    description: '5 wins in a row',
  },
  {
    id: 'veteran_10',
    name: 'Veteran',
    icon: 'medal',
    color: '#10B981',
    bgColor: '#D1FAE5',
    requirement: (stats) => stats.totals >= 10,
    description: 'Compete in 10 competitions',
  },
  {
    id: 'champion',
    name: 'Champion',
    icon: 'crown',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    requirement: (stats) => stats.wins >= 10,
    description: 'Win 10 competitions',
  },
  {
    id: 'perfect_record',
    name: 'Perfect',
    icon: 'star',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    requirement: (stats) => stats.wins >= 5 && stats.losses === 0,
    description: '5+ wins, 0 losses',
  },
  {
    id: 'comeback_king',
    name: 'Comeback',
    icon: 'trending-up',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
    requirement: (stats) => stats.comebackWin === true,
    description: 'Win after 3 losses',
  },
  {
    id: 'consistent',
    name: 'Consistent',
    icon: 'checkmark-circle',
    color: '#10B981',
    bgColor: '#D1FAE5',
    requirement: (stats) => stats.wins >= 5 && stats.wins / (stats.wins + stats.losses) >= 0.6,
    description: '60%+ win rate (5+ games)',
  },
];

export default function AchievementBadges({ wins, losses, totals, userId, currentStreak = 0 }) {
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const animatedValues = useRef({});

  useEffect(() => {
    loadAndCheckAchievements();
  }, [wins, losses, totals]);

  const loadAndCheckAchievements = async () => {
    try {
      // Load previously unlocked achievements
      const stored = await AsyncStorage.getItem(`achievements_${userId}`);
      const previouslyUnlocked = stored ? JSON.parse(stored) : [];
      
      const stats = {
        wins,
        losses,
        totals,
        currentStreak,
        comebackWin: false, // This would need to be tracked separately
      };
      
      // Check which achievements are now unlocked
      const currentlyUnlocked = ACHIEVEMENTS.filter(achievement => 
        achievement.requirement(stats)
      ).map(a => a.id);
      
      // Find newly unlocked achievements
      const newUnlocks = currentlyUnlocked.filter(
        id => !previouslyUnlocked.includes(id)
      );
      
      if (newUnlocks.length > 0) {
        // Save new unlocks
        await AsyncStorage.setItem(
          `achievements_${userId}`,
          JSON.stringify(currentlyUnlocked)
        );
        
        // Animate new unlocks
        setNewlyUnlocked(newUnlocks);
        setTimeout(() => setNewlyUnlocked([]), 3000);
      }
      
      setUnlockedAchievements(currentlyUnlocked);
      
      // Initialize animations for each achievement
      currentlyUnlocked.forEach(id => {
        if (!animatedValues.current[id]) {
          animatedValues.current[id] = new Animated.Value(0);
          Animated.spring(animatedValues.current[id], {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      });
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  };

  const renderBadge = (achievement, isUnlocked, isNew) => {
    const scale = animatedValues.current[achievement.id] || new Animated.Value(isUnlocked ? 1 : 0);
    
    return (
      <Animated.View
        key={achievement.id}
        style={[
          styles.badgeContainer,
          isNew && styles.newBadge,
          {
            transform: [{ scale: isUnlocked ? scale : 1 }],
            opacity: isUnlocked ? 1 : 0.7,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.badge,
            { backgroundColor: isUnlocked ? achievement.bgColor : '#E5E7EB' },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.badgeIconContainer}>
            <Ionicons
              name={achievement.icon}
              size={28}
              color={isUnlocked ? achievement.color : '#6B7280'}
            />
            {isNew && (
              <View style={styles.newIndicator}>
                <Text style={styles.newText}>NEW!</Text>
              </View>
            )}
          </View>
          <Text style={[
            styles.badgeName,
            { color: isUnlocked ? '#1F2937' : '#4B5563' }
          ]}>
            {achievement.name}
          </Text>
          <Text 
            style={[
              styles.badgeDescription,
              { color: isUnlocked ? '#6B7280' : '#9CA3AF' }
            ]}
            numberOfLines={3}
          >
            {achievement.description}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const unlockedCount = unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Achievements</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{unlockedCount}/{totalCount}</Text>
        </View>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ACHIEVEMENTS.map(achievement => 
          renderBadge(
            achievement,
            unlockedAchievements.includes(achievement.id),
            newlyUnlocked.includes(achievement.id)
          )
        )}
      </ScrollView>
      
      {unlockedCount === totalCount && (
        <View style={styles.completionBanner}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
          <Text style={styles.completionText}>All Achievements Unlocked!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  counter: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  badgeContainer: {
    marginHorizontal: 6,
  },
  newBadge: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    width: 110,
    height: 140,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  badgeIconContainer: {
    position: 'relative',
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  newIndicator: {
    position: 'absolute',
    top: -8,
    right: -16,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
    height: 18,
    lineHeight: 18,
  },
  badgeDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    height: 42,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  completionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
});