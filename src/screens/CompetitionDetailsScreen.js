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
  getDocs,
  writeBatch,
  updateDoc,
  arrayRemove,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import { 
  getScoreVisibility, 
  filterVisibleSubmissions,
  filterVisibleSubmissionsWithSelf,
  getVisibilityMessage 
} from '../utils/scoreVisibility';

const CompetitionDetailsScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState('me');
  const { competition } = route.params;
  const { user } = useContext(AuthContext);
  
  const [workouts, setWorkouts] = useState([]);
  const [users, setUsers] = useState({});
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Reset to 'me' tab when returning from submission
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset to 'me' tab when screen comes into focus
      setActiveTab('me');
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

  /* ---------------- leave competition handler ---------------- */
  const handleLeaveCompetition = () => {
    Alert.alert(
      'Leave Competition?',
      'Are you sure you want to leave this competition?\n\nThis action will:\n• Remove you from the competition\n• Delete all your workout submissions\n• Remove you from the leaderboard\n• Remove this competition from your active list\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave Competition',
          style: 'destructive',
          onPress: async () => {
            try {
              // Start batch operation for atomic updates
              const batch = writeBatch(db);
              
              // 1. Query all user's submissions for this competition
              const submissionsQuery = query(
                collection(db, 'submissions'),
                where('competitionId', '==', competition.id),
                where('userId', '==', user.uid)
              );
              
              const submissionsSnapshot = await getDocs(submissionsQuery);
              
              // 2. Delete all user's submissions in batch
              submissionsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
              });
              
              // 3. Remove user from competition participants
              const competitionRef = doc(db, 'competitions', competition.id);
              batch.update(competitionRef, {
                participants: arrayRemove(user.uid)
              });
              
              // 4. Commit all changes atomically
              await batch.commit();
              
              // 5. Show success and navigate back
              Alert.alert(
                'Success',
                'You have left the competition',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('ActiveCompetitions')
                  }
                ]
              );
            } catch (error) {
              console.error('Error leaving competition:', error);
              Alert.alert('Error', 'Failed to leave competition. Please try again.');
            }
          },
        },
      ]
    );
  };

  /* ---------------- calculate and update stats ---------------- */
  const calculateAndUpdateStats = async () => {
    try {
      console.log('Calculating competition stats...');
      
      // Get all submissions for this competition
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('competitionId', '==', competition.id)
      );
      
      const snapshot = await getDocs(submissionsQuery);
      
      // Calculate total points per user
      const userPoints = {};
      snapshot.docs.forEach(doc => {
        const submission = doc.data();
        const userId = submission.userId;
        userPoints[userId] = (userPoints[userId] || 0) + (submission.points || 0);
      });
      
      // Sort users by points to determine rankings
      const sortedRankings = Object.entries(userPoints)
        .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
      
      if (sortedRankings.length === 0) {
        console.log('No submissions found for competition');
        return { success: false, message: 'No submissions found' };
      }
      
      // Determine winner (highest points)
      const winnerId = sortedRankings[0][0];
      const winnerPoints = sortedRankings[0][1];
      
      // Get all participants except winner
      const participants = competition.participants || [];
      const losers = participants.filter(uid => uid !== winnerId);
      
      console.log(`Winner: ${winnerId} with ${winnerPoints} points`);
      console.log(`Losers: ${losers.length} participants`);
      
      // Update stats using batch write for atomicity
      const batch = writeBatch(db);
      
      // Update winner
      const winnerRef = doc(db, 'users', winnerId);
      batch.update(winnerRef, {
        wins: increment(1),
        lastUpdated: serverTimestamp(),
      });
      
      // Update losers
      losers.forEach(loserId => {
        // Only update if they actually participated (have submissions)
        if (userPoints[loserId] !== undefined) {
          const loserRef = doc(db, 'users', loserId);
          batch.update(loserRef, {
            losses: increment(1),
            lastUpdated: serverTimestamp(),
          });
        }
      });
      
      // Also update the competition with the calculated winner
      const competitionRef = doc(db, 'competitions', competition.id);
      batch.update(competitionRef, {
        winnerId: winnerId,
        winnerPoints: winnerPoints,
        completedAt: serverTimestamp(),
        finalRankings: sortedRankings.map(([userId, points], index) => ({
          userId,
          points,
          position: index + 1
        }))
      });
      
      await batch.commit();
      console.log('Stats updated successfully');
      
      return {
        success: true,
        winnerId,
        winnerPoints,
        totalParticipants: sortedRankings.length
      };
      
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { success: false, error: error.message };
    }
  };

  /* ---------------- end competition handler ---------------- */
  const handleEndCompetition = async () => {
    // Check if competition is already completed
    if (competition.status === 'completed') {
      Alert.alert('Info', 'This competition is already completed');
      return;
    }
    
    // Check if user is the owner
    if (competition.ownerId !== user.uid) {
      Alert.alert('Error', 'Only the competition owner can end it');
      return;
    }
    
    Alert.alert(
      'End Competition',
      'This will finalize the results and update win/loss records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            setIsCompleting(true);
            try {
              // First calculate and update stats
              const statsResult = await calculateAndUpdateStats();
              
              if (!statsResult.success) {
                if (statsResult.message === 'No submissions found') {
                  Alert.alert('Cannot End', 'No submissions found. At least one participant must submit a workout.');
                } else {
                  Alert.alert('Error', statsResult.error || 'Failed to calculate competition results');
                }
                setIsCompleting(false);
                return;
              }
              
              // Update competition status to completed
              await updateDoc(doc(db, 'competitions', competition.id), {
                status: 'completed'
              });
              
              // Get winner's username for the success message
              let winnerName = 'Unknown';
              try {
                const winnerDoc = await getDoc(doc(db, 'users', statsResult.winnerId));
                if (winnerDoc.exists()) {
                  winnerName = winnerDoc.data().username || 'Unknown';
                }
              } catch (error) {
                console.log('Could not fetch winner name:', error);
              }
              
              Alert.alert(
                'Competition Ended!', 
                `Winner: ${winnerName} with ${statsResult.winnerPoints} points!\n\nAll participant stats have been updated.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error ending competition:', error);
              Alert.alert('Error', 'Failed to end competition. Please try again.');
            } finally {
              setIsCompleting(false);
            }
          }
        }
      ]
    );
  };

  /* ---------------- navigation handlers ---------------- */
  const handleWorkoutPress = (workout, userName) => {
    navigation.navigate('WorkoutDetails', { 
      workout, 
      competition,
      userName 
    });
  };

  useEffect(() => {
    if (!competition?.id) {
      stopRefreshing();
      return;
    }

    // Calculate visibility status
    const visibilityStatus = getScoreVisibility(competition);
    setVisibility(visibilityStatus);

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
        const allSubmissions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Mark as notification if it's a new submission from someone else
          isNotification: doc.data().userId !== user.uid && 
                         doc.data().createdAt?.toDate() > new Date(Date.now() - 3600000) // Last hour
        }));
        
        // Filter submissions based on visibility rules, always showing user's own
        const visibleSubmissions = filterVisibleSubmissionsWithSelf(allSubmissions, competition, user.uid);
        
        // Always use filtered submissions - the filter handles showing user's own submissions
        setWorkouts(visibleSubmissions);
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

  // Filter workouts based on tab and search query
  const filteredWorkouts = useMemo(() => {
    let baseWorkouts = workouts;
    
    // Apply tab filter first
    if (activeTab === 'me') {
      // Me tab: only show current user's submissions
      baseWorkouts = workouts.filter(w => w.userId === user.uid);
    } else if (activeTab === 'others') {
      // Others tab: show only other users' submissions
      // During hidden period, these are already filtered at data layer
      baseWorkouts = workouts.filter(w => w.userId !== user.uid);
    }
    
    // Then apply search filter
    if (!searchQuery.trim()) {
      return baseWorkouts;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return baseWorkouts.filter(workout => {
      const userName = users[workout.userId]?.username || 'Unknown User';
      const activityType = workout.activityType || '';
      
      return userName.toLowerCase().includes(query) || 
             activityType.toLowerCase().includes(query);
    });
  }, [workouts, users, searchQuery, activeTab, user.uid]);

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

          {competition.dailyCap > 0 && (
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
          
          {competition.photoProofRequired && (
            <View style={styles.photoRequirementItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="camera" size={24} color="#4CAF50" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Photo Proof</Text>
                <Text style={styles.dateValue}>Required for all submissions</Text>
              </View>
            </View>
          )}
          
          {competition.invitationGracePeriod === false && (
            <View style={styles.gracePeriodItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="time" size={24} color="#FF9800" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Grace Period</Text>
                <Text style={styles.dateValue}>No late joins allowed</Text>
              </View>
            </View>
          )}
          
          {competition.leaderboardUpdateDays > 0 && (
            <View style={styles.leaderboardUpdateItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="eye-off" size={24} color="#3B82F6" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Leaderboard Updates</Text>
                <Text style={styles.dateValue}>
                  Every {competition.leaderboardUpdateDays} day{competition.leaderboardUpdateDays > 1 ? 's' : ''}
                </Text>
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
                  {/* Display activity limits if any exist */}
                  {(rule.maxSubmissionsPerDay || 
                    rule.maxPointsPerWeek || rule.perSubmissionCap) && (
                    <View style={styles.activityLimits}>
                      {rule.maxSubmissionsPerDay && (
                        <Text style={styles.activityLimit}>
                          • Max {rule.maxSubmissionsPerDay} submission{rule.maxSubmissionsPerDay !== 1 ? 's' : ''}/day
                        </Text>
                      )}
                      {rule.maxPointsPerWeek && (
                        <Text style={styles.activityLimit}>
                          • Max {rule.maxPointsPerWeek} pts/week
                        </Text>
                      )}
                      {rule.perSubmissionCap && (
                        <Text style={styles.activityLimit}>
                          • Max {rule.perSubmissionCap} pts per submission
                        </Text>
                      )}
                    </View>
                  )}
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

      {/* End Competition Section - Only show for owner if not completed */}
      {user.uid === competition.ownerId && competition.status !== 'completed' && (
        <>
          <View style={styles.sectionDivider} />
          
          <View style={styles.endCompetitionSection}>
            <TouchableOpacity 
              style={[
                styles.endCompetitionButton,
                isCompleting && styles.endingButton
              ]}
              onPress={handleEndCompetition}
              activeOpacity={0.8}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Text style={styles.endCompetitionText}>Calculating Results...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.endCompetitionText}>End Competition</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.endCompetitionWarning}>
              This will finalize results and update win/loss records
            </Text>
          </View>
        </>
      )}

      {/* Leave Competition Section - Only show if user is not the owner */}
      {user.uid !== competition.ownerId && (
        <>
          <View style={styles.sectionDivider} />
          
          <View style={styles.leaveCompetitionSection}>
            <TouchableOpacity 
              style={styles.leaveCompetitionButton}
              onPress={handleLeaveCompetition}
              activeOpacity={0.8}
            >
              <Ionicons name="exit-outline" size={24} color="#FF4444" />
              <Text style={styles.leaveCompetitionText}>Leave Competition</Text>
            </TouchableOpacity>
            <Text style={styles.leaveCompetitionWarning}>
              Leaving will permanently remove all your data from this competition
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Header 
        title={competition.name} 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()}
      />
      
      {/* Visibility Status Banner */}
      {visibility && visibility.isInHiddenPeriod && (
        <View style={styles.visibilityBanner}>
          <Ionicons name="eye-off" size={20} color="#FFF" />
          <Text style={styles.visibilityText}>
            {getVisibilityMessage(visibility)}
          </Text>
        </View>
      )}
      
      <View style={styles.tabContainer}>
        {/* Me Tab */}
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'me' && styles.activeTab]} 
          onPress={() => setActiveTab('me')}
        >
          <Text style={[styles.tabText, activeTab === 'me' && styles.activeTabText]}>Me</Text>
        </TouchableOpacity>
        
        {/* Others Tab */}
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'others' && styles.activeTab]} 
          onPress={() => setActiveTab('others')}
        >
          <Text style={[styles.tabText, activeTab === 'others' && styles.activeTabText]}>Others</Text>
        </TouchableOpacity>
        
        {/* Leaderboard Tab */}
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]} 
          onPress={() => {
            setActiveTab('leaderboard');
            navigation.navigate('Leaderboard', { competition });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Rank</Text>
        </TouchableOpacity>
        
        {/* Add Tab */}
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'add' && styles.activeTab]} 
          onPress={() => {
            navigation.navigate('SubmissionForm', { competition });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
        </TouchableOpacity>

        {/* Rules Tab */}
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'rules' && styles.activeTab]} 
          onPress={() => setActiveTab('rules')}
        >
          <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>Rules</Text>
        </TouchableOpacity>
      </View>
      
      {/* Visibility info banner for Others tab */}
      {activeTab === 'others' && visibility && visibility.isInHiddenPeriod && (
        <View style={styles.visibilityInfoBanner}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.visibilityInfoText}>
            New submissions hidden until next reveal
          </Text>
        </View>
      )}
      
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
                  <TouchableOpacity 
                    key={workout.id} 
                    style={styles.workoutCard}
                    onPress={() => handleWorkoutPress(workout, formatted.userName)}
                    activeOpacity={0.85}
                  >
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
                          
                          {/* Show points - already filtered at data layer */}
                          <View style={styles.detailItem}>
                            <Text style={styles.detailIcon}>★</Text>
                            <Text style={styles.detailText}>
                              {`${workout.points} Points`}
                            </Text>
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
  photoRequirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  gracePeriodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  leaderboardUpdateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  
  // Activity Limits Styles
  activityLimits: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  activityLimit: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  visibilityBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  visibilityInfoBanner: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  visibilityInfoText: {
    color: '#1976D2',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  
  // End Competition Styles  
  endCompetitionSection: {
    marginTop: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  endCompetitionButton: {
    flexDirection: 'row',
    backgroundColor: '#A4D65E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  endingButton: {
    backgroundColor: '#7A9B47',
    opacity: 0.8,
  },
  endCompetitionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  endCompetitionWarning: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // Leave Competition Styles
  leaveCompetitionSection: {
    marginTop: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  leaveCompetitionButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leaveCompetitionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
    marginLeft: 8,
  },
  leaveCompetitionWarning: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default CompetitionDetailsScreen;