//LeaderboardScreen.js

import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Header, Button } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
// Functions import is handled through firebase.js
import { AuthContext } from '../contexts/AuthContext';

const LeaderboardScreen = ({ route, navigation }) => {
  const { competition } = route.params;
  const { user } = useContext(AuthContext);
  
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

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
  };

  // Helper function to stop refreshing and clear timeout
  const stopRefreshing = () => {
    setRefreshing(false);
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
  };

  // Handle completing the competition using Cloud Function
  const handleCompleteCompetition = async () => {
    // Check if competition is already completed
    if (competition.status === 'completed') {
      Alert.alert('Info', 'This competition is already completed');
      return;
    }
    
    // Check if user is the owner
    if (competition.ownerId !== user.uid) {
      Alert.alert('Error', 'Only the competition owner can complete it');
      return;
    }
    
    Alert.alert(
      'Complete Competition',
      'This will finalize the results and update win/loss records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            setIsCompleting(true);
            try {
              // Call the Cloud Function to complete the competition
              const { functions } = await import('../firebase');
              const completeCompetition = functions.httpsCallable('manuallyCompleteCompetition');
              
              const result = await completeCompetition({ 
                competitionId: competition.id 
              });
              
              if (result.data.success) {
                Alert.alert(
                  'Success', 
                  'Competition completed! Stats will update within 1-2 seconds.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              }
            } catch (error) {
              console.error('Error completing competition:', error);
              
              // Fallback to direct update if Cloud Function fails
              try {
                await updateDoc(doc(db, 'competitions', competition.id), {
                  status: 'completed'
                });
                Alert.alert(
                  'Success', 
                  'Competition completed! Stats will update shortly.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } catch (fallbackError) {
                Alert.alert('Error', 'Failed to complete competition. Please try again.');
              }
            } finally {
              setIsCompleting(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (!competition?.id) {
      stopRefreshing();
      return;
    }

    // Listen to submissions for this competition
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('competitionId', '==', competition.id)
    );

    const unsubscribe = onSnapshot(
      submissionsQuery, 
      async (snapshot) => {
        try {
          // Aggregate points by user
          const pointsByUser = {};
          
          snapshot.docs.forEach(doc => {
            const submission = doc.data();
            const userId = submission.userId;
            
            if (!pointsByUser[userId]) {
              pointsByUser[userId] = 0;
            }
            pointsByUser[userId] += submission.points || 0;
          });

          // Fetch user data for all participants
          const userDataPromises = competition.participants.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              const userData = userDoc.exists() ? userDoc.data() : {};
              
              return {
                id: uid,
                name: userData.username || 'Unknown User',
                points: pointsByUser[uid] || 0,
                isCurrentUser: uid === user.uid,
                wins: userData.wins || 0,
                losses: userData.losses || 0,
              };
            } catch (error) {
              console.error('Error fetching user:', error);
              return {
                id: uid,
                name: 'Unknown User',
                points: pointsByUser[uid] || 0,
                isCurrentUser: uid === user.uid,
                wins: 0,
                losses: 0,
              };
            }
          });

          const usersWithPoints = await Promise.all(userDataPromises);
          
          // Sort by points (descending) and assign positions
          const sortedRankings = usersWithPoints
            .sort((a, b) => b.points - a.points)
            .map((user, index) => ({
              ...user,
              position: index + 1,
            }));

          setRankings(sortedRankings);
          setLoading(false);
          stopRefreshing(); // Stop refresh spinner when data loads
        } catch (error) {
          console.error('Error processing leaderboard:', error);
          setLoading(false);
          stopRefreshing();
        }
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
  }, [competition?.id, competition?.participants, user.uid]);

  // Separate top 3 from the rest
  const topThree = rankings.slice(0, 3);
  const restOfRankings = rankings.slice(3);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header 
          title="Leaderboard" 
          showBackButton={true} 
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Leaderboard" 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()}
      />
      
      <View style={styles.podiumContainer}>
        <View style={styles.podiumIcon}>
          <Ionicons name="trophy" size={40} color="#A4D65E" />
        </View>
        
        {topThree.length > 0 && (
          <View style={styles.topThreeContainer}>
            {/* Reorder for podium display: 2nd, 1st, 3rd */}
            {[1, 0, 2].map(index => {
              const user = topThree[index];
              if (!user) return <View key={index} style={{ flex: 1 }} />;
              
              return (
                <View 
                  key={user.id} 
                  style={[
                    styles.topUserContainer, 
                    user.position === 1 && styles.firstPlaceContainer,
                    user.position === 2 && styles.secondPlaceContainer,
                    user.position === 3 && styles.thirdPlaceContainer,
                  ]}
                >
                  <View style={styles.userImageContainer}>
                    <Ionicons 
                      name="person-circle" 
                      size={user.position === 1 ? 70 : 60} 
                      color={user.position === 1 ? "#FFD700" : "#FFFFFF"} 
                    />
                    <View style={[
                      styles.positionBadge,
                      user.position === 1 && styles.firstPlaceBadge,
                      user.position === 2 && styles.secondPlaceBadge,
                      user.position === 3 && styles.thirdPlaceBadge,
                    ]}>
                      <Text style={styles.positionText}>{user.position}</Text>
                    </View>
                  </View>
                  <Text style={styles.userName}>{user.name}</Text>
                  <View style={styles.pointsContainer}>
                    <Ionicons name="star" size={14} color="#A4D65E" />
                    <Text style={styles.pointsText}>{user.points.toFixed(0)} pts</Text>
                  </View>
                  {/* Show user's total record */}
                  <Text style={styles.recordText}>
                    {user.wins}W - {user.losses}L
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Complete Competition Button - Only show for owner if not completed */}
      {competition.ownerId === user.uid && competition.status !== 'completed' && (
        <View style={styles.completeButtonContainer}>
          <TouchableOpacity 
            style={[styles.completeButton, isCompleting && styles.disabledButton]}
            onPress={handleCompleteCompetition}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Text style={styles.completeButtonText}>Completing...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Complete Competition</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Show completion status if already completed */}
      {competition.status === 'completed' && (
        <View style={styles.completedBanner}>
          <Ionicons name="trophy" size={20} color="#FFD700" />
          <Text style={styles.completedText}>Competition Completed</Text>
          {competition.winnerId && (
            <Text style={styles.winnerText}>
              Winner: {rankings.find(r => r.id === competition.winnerId)?.name || 'Unknown'}
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.rankingsContainer}>
        <Text style={styles.rankingsTitle}>Full Rankings</Text>
        <ScrollView 
          style={styles.rankingsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#A4D65E']} // Android
              tintColor="#A4D65E" // iOS
            />
          }
        >
          {rankings.length === 0 ? (
            <Text style={styles.emptyText}>No submissions yet. Be the first to earn points!</Text>
          ) : (
            rankings.map(user => (
              <View 
                key={user.id} 
                style={[
                  styles.rankingItem, 
                  user.isCurrentUser && styles.currentUserRanking
                ]}
              >
                <Text style={styles.rankingPosition}>{user.position}</Text>
                <View style={styles.rankingUserImageContainer}>
                  <Ionicons name="person-circle" size={36} color="#777" />
                </View>
                <View style={styles.rankingUserInfo}>
                  <Text style={[
                    styles.rankingUserName,
                    user.isCurrentUser && styles.currentUserText
                  ]}>
                    {user.isCurrentUser ? 'You' : user.name}
                  </Text>
                  <Text style={styles.userRecord}>
                    {user.wins}W - {user.losses}L
                  </Text>
                </View>
                <Text style={[
                  styles.rankingPoints,
                  user.isCurrentUser && styles.currentUserText
                ]}>
                  {user.points.toFixed(0)} pts
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
  },
  podiumContainer: {
    backgroundColor: '#1A1E23',
    paddingVertical: 20,
    alignItems: 'center',
  },
  podiumIcon: {
    marginBottom: 10,
  },
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '100%',
    paddingHorizontal: 20,
  },
  topUserContainer: {
    alignItems: 'center',
    marginHorizontal: 5,
    flex: 1,
  },
  firstPlaceContainer: {
    marginBottom: 0,
  },
  secondPlaceContainer: {
    marginBottom: 15,
  },
  thirdPlaceContainer: {
    marginBottom: 25,
  },
  userImageContainer: {
    position: 'relative',
    marginBottom: 5,
  },
  positionBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A4D65E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstPlaceBadge: {
    backgroundColor: '#FFD700',
  },
  secondPlaceBadge: {
    backgroundColor: '#C0C0C0',
  },
  thirdPlaceBadge: {
    backgroundColor: '#CD7F32',
  },
  positionText: {
    color: '#1A1E23',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    color: '#A4D65E',
    fontSize: 14,
    marginLeft: 4,
  },
  recordText: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  completeButtonContainer: {
    padding: 16,
    backgroundColor: '#1A1E23',
  },
  completeButton: {
    backgroundColor: '#A4D65E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  completedBanner: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  completedText: {
    color: '#F57C00',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  winnerText: {
    color: '#F57C00',
    fontSize: 14,
    marginLeft: 8,
  },
  rankingsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  rankingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 15,
  },
  rankingsList: {
    flex: 1,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  currentUserRanking: {
    backgroundColor: '#A4D65E',
  },
  rankingPosition: {
    width: 30,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  rankingUserImageContainer: {
    marginRight: 12,
  },
  rankingUserInfo: {
    flex: 1,
  },
  rankingUserName: {
    fontSize: 16,
    color: '#1A1E23',
    fontWeight: '500',
  },
  userRecord: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  rankingPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  currentUserText: {
    color: '#1A1E23',
  },
});