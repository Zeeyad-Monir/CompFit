//LeaderboardScreen.js

import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

const LeaderboardScreen = ({ route, navigation }) => {
  const { competition } = route.params;
  const { user } = useContext(AuthContext);
  
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);

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
              };
            } catch (error) {
              console.error('Error fetching user:', error);
              return {
                id: uid,
                name: 'Unknown User',
                points: pointsByUser[uid] || 0,
                isCurrentUser: uid === user.uid,
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
                </View>
              );
            })}
          </View>
        )}
      </View>
      
      <View style={styles.rankingsContainer}>
        <Text style={styles.rankingsTitle}>Rankings</Text>
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
            restOfRankings.map(user => (
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
                <Text style={[
                  styles.rankingUserName,
                  user.isCurrentUser && styles.currentUserText
                ]}>
                  {user.isCurrentUser ? 'You' : user.name}
                </Text>
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
  rankingUserName: {
    flex: 1,
    fontSize: 16,
    color: '#1A1E23',
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

export default LeaderboardScreen;