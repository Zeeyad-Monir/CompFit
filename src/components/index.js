import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

export { default as Header } from './Header';
export { default as Button } from './Button';
export { default as FormInput } from './FormInput';
export { default as Dropdown } from './Dropdown';
export { default as DatePicker } from './DatePicker';
export { default as LeaderboardUpdatePicker } from './LeaderboardUpdatePicker';
export { default as ScoreDisplay, ScoreCard, InlineScore } from './ScoreDisplay';
export { default as SearchBar } from './SearchBar';
export { default as SmartKeyboardAwareScrollView } from './SmartKeyboardAwareScrollView';

export const CompetitionCard = ({ competition, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.competitionCard} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* <Image 
        source={require('../assets/workout-background.jpg')} 
        style={styles.cardBackground}
      /> */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{competition.name}</Text>
        <View style={styles.seeMoreContainer}>
          <Text style={styles.seeMoreText}>See more</Text>
          <Text style={styles.seeMoreArrow}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const WorkoutCard = ({ workout, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.workoutCard} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* <Image 
        source={require('../assets/workout-background.jpg')} 
        style={styles.cardBackground}
      /> */}
      <View style={styles.cardContent}>
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutType}>{workout.activityType}</Text>
          <View style={styles.workoutDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>•</Text>
              <Text style={styles.detailText}>{workout.duration} Minutes</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>♦</Text>
              <Text style={styles.detailText}>{workout.calories} Kcal</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>♦</Text>
              <Text style={styles.detailText}>{workout.points} Points</Text>
            </View>
          </View>
        </View>
        <View style={styles.userLabel}>
          <Text style={styles.userLabelText}>{workout.userName}'s Workout</Text>
        </View>
        {workout.isNotification && (
          <View style={styles.notificationIcon}>
            <Text style={styles.notificationText}>!</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  competitionCard: {
    height: 150,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
  },
  cardBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  seeMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeMoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#A4D65E',
  },
  seeMoreArrow: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginLeft: 5,
  },
  workoutCard: {
    height: 120,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
  },
  workoutInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  workoutType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginBottom: 10,
  },
  workoutDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
  },
  detailIcon: {
    fontSize: 16,
    color: 'white',
    marginRight: 5,
  },
  detailText: {
    fontSize: 14,
    color: 'white',
  },
  userLabel: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#A4D65E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  userLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  notificationIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A4D65E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
});
