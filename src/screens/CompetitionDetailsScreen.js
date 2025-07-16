import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { Header, Button } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

const CompetitionDetailsScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState('all');
  const { competition } = route.params;
  const { user } = useContext(AuthContext);
  
  const [workouts, setWorkouts] = useState([]);
  const [users, setUsers] = useState({});
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset to 'all' tab when returning from submission
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset to 'all' tab when screen comes into focus
      setActiveTab('all');
    });

    return unsubscribe;
  }, [navigation]);

  /* ---------------- refresh handler -------------------- */
  const onRefresh = () => {
    setRefreshing(true);
    
    // Clear any existing timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    // Set timeout fallback to stop refreshing after 3 seconds
    const timeout = setTimeout(() => {
      setRefreshing(false);
    }, 3000);
    
    setRefreshTimeout(timeout);
    
    // Force re-fetch of users and workouts
    fetchUsers();
    fetchParticipants();
  };

  // Helper function to stop refreshing and clear timeout
  const stopRefreshing = () => {
    setRefreshing(false);
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const userMap = {};
      for (const uid of competition.participants || []) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            userMap[uid] = userDoc.data();
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
      setUsers(userMap);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const participantsList = [];
      for (const uid of competition.participants || []) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            participantsList.push({
              id: uid,
              ...userDoc.data()
            });
          }
        } catch (error) {
          console.error('Error fetching participant:', error);
        }
      }
      // Sort alphabetically by username
      participantsList.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
      setParticipants(participantsList);
    } catch (error) {
      console.error('Error in fetchParticipants:', error);
    }
  };

  /* ---------------- delete workout handler ---------------- */
  const handleDeleteWorkout = (workout) => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'submissions', workout.id));
              Alert.alert('Success', 'Activity deleted successfully');
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete activity. Please try again.');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!competition?.id) {
      stopRefreshing();
      return;
    }

    // Fetch user data for all participants
    fetchUsers();
    fetchParticipants();

    // Listen to submissions for this competition
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('competitionId', '==', competition.id)
      // Temporarily removed orderBy until index is created
      // orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      submissionsQuery, 
      (snapshot) => {
        const submissionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Mark as notification if it's a new submission from someone else
          isNotification: doc.data().userId !== user.uid && 
                         doc.data().createdAt?.toDate() > new Date(Date.now() - 3600000) // Last hour
        }));
        setWorkouts(submissionsData);
        setLoading(false);
        stopRefreshing(); // Stop refresh spinner when data loads
      },
      (error) => {
        console.error('Error fetching submissions:', error);
        setLoading(false);
        stopRefreshing(); // Stop refresh spinner on error
      }
    );

    return () => {
      unsubscribe();
      // Clear timeout on cleanup
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [competition?.id, user.uid]);

  // Get the primary value and unit for display based on the workout's unit type
  const getPrimaryValueAndUnit = (workout) => {
    const { unit } = workout;
    
    switch (unit) {
      case 'Kilometre':
        return { value: workout.distance || 0, displayUnit: 'km' };
      case 'Mile':
        return { value: workout.distance || 0, displayUnit: 'miles' };
      case 'Meter':
        return { value: workout.distance || 0, displayUnit: 'm' };
      case 'Yard':
        return { value: workout.distance || 0, displayUnit: 'yards' };
      case 'Hour':
        return { value: workout.duration || 0, displayUnit: 'hours' };
      case 'Minute':
        return { value: workout.duration || 0, displayUnit: 'min' };
      case 'Calorie':
        return { value: workout.calories || 0, displayUnit: 'cal' };
      case 'Session':
        return { value: workout.sessions || 0, displayUnit: 'sessions' };
      case 'Class':
        return { value: workout.sessions || 0, displayUnit: 'classes' };
      case 'Rep':
        return { value: workout.reps || 0, displayUnit: 'reps' };
      case 'Set':
        return { value: workout.sets || 0, displayUnit: 'sets' };
      case 'Step':
        return { value: workout.steps || 0, displayUnit: 'steps' };
      default:
        // For custom units, use the custom value and the unit name
        return { value: workout.customValue || 0, displayUnit: unit.toLowerCase() };
    }
  };

  // Format workout display with proper unit handling
  const formatWorkoutDisplay = (workout) => {
    const userName = users[workout.userId]?.username || 'Unknown User';
    const primaryValue = getPrimaryValueAndUnit(workout);
    
    return {
      ...workout,
      userName,
      primaryValue,
      // Just show the activity type as the title
      activityTitle: workout.activityType,
    };
  };

  // Filter workouts based on search query
  const filteredWorkouts = useMemo(() => {
    if (!searchQuery.trim()) {
      return workouts;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return workouts.filter(workout => {
      const userName = users[workout.userId]?.username || 'Unknown User';
      const activityType = workout.activityType || '';
      
      return userName.toLowerCase().includes(query) || 
             activityType.toLowerCase().includes(query);
    });
  }, [workouts, users, searchQuery]);

  // Format competition dates
  const formatCompetitionDates = () => {
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    
    const formatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    return {
      start: startDate.toLocaleDateString('en-US', formatOptions),
      end: endDate.toLocaleDateString('en-US', formatOptions)
    };
  };

  // Render Rules Tab Content
  const renderRulesTab = () => (
    <ScrollView 
      style={styles.rulesContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#A4D65E']} // Android
          tintColor="#A4D65E" // iOS
        />
      }
    >
      {/* Back Arrow */}
      <TouchableOpacity 
        style={styles.backToAllButton}
        onPress={() => setActiveTab('all')}
      >
        <Ionicons name="arrow-back" size={20} color="#A4D65E" />
        <Text style={styles.backToAllText}>Back to All</Text>
      </TouchableOpacity>

      {/* Description Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Description</Text>
        <View style={styles.rulesSectionContent}>
          <Text style={styles.descriptionText}>
            {competition.description || 'No description provided.'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Competition Dates Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Competition Dates</Text>
        <View style={styles.rulesSectionContent}>
          <View style={styles.dateItem}>
            <View style={styles.dateIcon}>
              <Ionicons name="play-circle" size={24} color="#4CAF50" />
            </View>
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{formatCompetitionDates().start}</Text>
            </View>
          </View>
          
          <View style={styles.dateItem}>
            <View style={styles.dateIcon}>
              <Ionicons name="stop-circle" size={24} color="#FF6B6B" />
            </View>
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>{formatCompetitionDates().end}</Text>
            </View>
          </View>

          {competition.dailyCap && (
            <View style={styles.dailyCapItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="speedometer" size={24} color="#FF9800" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Daily Point Limit</Text>
                <Text style={styles.dateValue}>{competition.dailyCap} points per day</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Activity Scoring Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Activity Scoring</Text>
        <View style={styles.rulesSectionContent}>
          {competition.rules && competition.rules.length > 0 ? (
            competition.rules.map((rule, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="fitness" size={24} color="#A4D65E" />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityType}>{rule.type}</Text>
                  <Text style={styles.activityScoring}>
                    {rule.unitsPerPoint} {rule.unit.toLowerCase()}{rule.unitsPerPoint !== 1 ? 's' : ''} = {rule.pointsPerUnit} point{rule.pointsPerUnit !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No activity rules defined.</Text>
          )}
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Participants Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>
          Participants ({participants.length})
        </Text>
        <View style={styles.rulesSectionContent}>
          {participants.length > 0 ? (
            participants.map((participant) => (
              <View key={participant.id} style={styles.participantItem}>
                <View style={styles.participantAvatar}>
                  <Ionicons name="person-circle" size={40} color="#A4D65E" />
                </View>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.username || 'Unknown User'}
                  </Text>
                  <Text style={styles.participantHandle}>
                    @{participant.handle || participant.username || 'unknown'}
                  </Text>
                </View>
                {participant.id === competition.ownerId && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerText}>Owner</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No participants found.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Header 
        title={competition.name} 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()}
      />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]} 
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]} 
          onPress={() => {
            setActiveTab('leaderboard');
            navigation.navigate('Leaderboard', { competition });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Leaderboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'add' && styles.activeTab]} 
          onPress={() => {
            navigation.navigate('SubmissionForm', { competition });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'rules' && styles.activeTab]} 
          onPress={() => setActiveTab('rules')}
        >
          <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>Rules</Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'rules' ? (
        renderRulesTab()
      ) : (
        <>
          {/* Search bar - Only show in All tab */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="search by competitor or activity"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>

          <ScrollView 
            style={styles.workoutsContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#A4D65E']} // Android
                tintColor="#A4D65E" // iOS
              />
            }
          >
            {loading ? (
              <Text style={styles.loadingText}>Loading workouts...</Text>
            ) : filteredWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'No workouts match your search.' : 'No workouts yet. Be the first to add one!'}
              </Text>
            ) : (
              filteredWorkouts.map(workout => {
                const formatted = formatWorkoutDisplay(workout);
                const isUserWorkout = workout.userId === user.uid;
                
                return (
                  <TouchableOpacity key={workout.id} style={styles.workoutCard}>
                    {/* REMOVED: Heart icon background - no more cardBackground with heart */}
                    
                    <View style={styles.cardContent}>
                      <View style={styles.workoutInfo}>
                        {/* Show just the activity type as the title */}
                        <Text style={styles.workoutType}>{formatted.activityTitle}</Text>
                        <View style={styles.workoutDetails}>
                          {/* Show the primary unit value based on the workout's unit type */}
                          <View style={styles.detailItem}>
                            <Text style={styles.detailIcon}>•</Text>
                            <Text style={styles.detailText}>
                              {formatted.primaryValue.value} {formatted.primaryValue.displayUnit}
                            </Text>
                          </View>
                          
                          {/* Always show points */}
                          <View style={styles.detailItem}>
                            <Text style={styles.detailIcon}>★</Text>
                            <Text style={styles.detailText}>{workout.points} Points</Text>
                          </View>
                        </View>
                      </View>
                      
                      {/* MOVED: User label repositioned to bottom right */}
                      <View style={styles.userLabel}>
                        <Text style={styles.userLabelText}>{formatted.userName}'s Workout</Text>
                      </View>
                      
                      {/* Delete Button - Only for user's own workouts */}
                      {isUserWorkout && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation(); // Prevent card press
                            handleDeleteWorkout(workout);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                      
                      {workout.isNotification && (
                        <View style={styles.notificationIcon}>
                          <Text style={styles.notificationText}>!</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#333',
    padding: 5,
    borderRadius: 25,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#1A1E23',
  },
  tabText: {
    color: '#777',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#A4D65E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 52,
  },
  searchIcon: { 
    marginRight: 10 
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#333' 
  },
  workoutsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
  },
  workoutCard: {
    height: 120,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    padding: 15,
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
  // REPOSITIONED: User label moved to bottom right
  userLabel: {
    position: 'absolute',
    bottom: 10,
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
    left: 10, // Moved to left since user label is now on the right
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
  // Delete button positioning updated since user label moved
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#888888',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  // Rules Tab Styles
  rulesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  backToAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  backToAllText: {
    color: '#A4D65E',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  rulesSection: {
    marginBottom: 24,
  },
  rulesSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 12,
  },
  rulesSectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  
  // Description Styles
  descriptionText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
  },
  
  // Date Styles
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyCapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 16,
    color: '#1A1E23',
    fontWeight: '600',
    marginTop: 2,
  },
  
  // Activity Styles
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  activityScoring: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Participant Styles
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  participantAvatar: {
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  participantHandle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
    marginLeft: 4,
  },
  
  // No Data Styles
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});

export default CompetitionDetailsScreen;
