// src/screens/ActiveCompetitionsScreen.js
import React, { useState, useMemo, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Header, Button } from '../components';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  or,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;

export default function ActiveCompetitionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  /* ---------------- tab state ------------------ */
  const [activeTab, setActiveTab] = useState('active');
  const tabAnimation = React.useRef(new Animated.Value(0)).current;

  // Tab index mapping
  const getTabIndex = (tab) => {
    switch(tab) {
      case 'active': return 0;
      case 'invites': return 1;
      case 'completed': return 2;
      default: return 0;
    }
  };

  // Animate to new tab position
  const animateToTab = (newTab) => {
    const newIndex = getTabIndex(newTab);
    Animated.spring(tabAnimation, {
      toValue: newIndex,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
    setActiveTab(newTab);
  };

  /* ---------------- live Firestore data ---------------- */
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [removedCompetitions, setRemovedCompetitions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [processedCompetitions, setProcessedCompetitions] = useState(new Set());

  /* ---------------- refresh handler -------------------- */
  const onRefresh = () => {
    setRefreshing(true);
    setRemovedCompetitions(new Set());
    setProcessedCompetitions(new Set()); // Reset processed competitions on refresh
    
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    const timeout = setTimeout(() => {
      setRefreshing(false);
    }, 3000);
    
    setRefreshTimeout(timeout);
  };

  const stopRefreshing = () => {
    setRefreshing(false);
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
  };

  // Auto-complete expired competitions (only for competitions user owns)
  const checkAndCompleteExpiredCompetitions = async (competitions) => {
    const now = new Date();
    
    // Filter to only competitions that:
    // 1. Are expired
    // 2. User is the owner
    // 3. Haven't been processed yet
    // 4. Aren't already completed
    const expiredOwnedCompetitions = competitions.filter(comp => {
      const endDate = new Date(comp.endDate);
      return now > endDate && 
             comp.ownerId === user.uid && // Only process if user is owner
             comp.status !== 'completed' && 
             !processedCompetitions.has(comp.id);
    });

    for (const competition of expiredOwnedCompetitions) {
      try {
        console.log(`Auto-completing expired competition: ${competition.name}`);
        
        // Mark as processed to avoid multiple attempts
        setProcessedCompetitions(prev => new Set([...prev, competition.id]));
        
        // Get all submissions for this competition
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('competitionId', '==', competition.id)
        );
        
        const snapshot = await new Promise((resolve, reject) => {
          const unsubscribe = onSnapshot(
            submissionsQuery,
            (snap) => {
              unsubscribe();
              resolve(snap);
            },
            reject
          );
        });
        
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
        
        if (sortedRankings.length > 0) {
          // Determine winner
          const winnerId = sortedRankings[0][0];
          const winnerPoints = sortedRankings[0][1];
          
          // Update the competition document
          await updateDoc(doc(db, 'competitions', competition.id), {
            status: 'completed',
            winnerId: winnerId,
            winnerPoints: winnerPoints,
            completedAt: serverTimestamp(),
            autoCompleted: true,
            finalRankings: sortedRankings.map(([userId, points], index) => ({
              userId,
              points,
              position: index + 1
            }))
          });
          
          console.log(`Auto-completed competition: ${competition.name} - Winner: ${winnerId}`);
        } else {
          // No submissions, just mark as completed
          await updateDoc(doc(db, 'competitions', competition.id), {
            status: 'completed',
            completedAt: serverTimestamp(),
            autoCompleted: true,
            noSubmissions: true
          });
          
          console.log(`Auto-completed competition: ${competition.name} - No submissions`);
        }
      } catch (error) {
        console.error(`Error auto-completing competition ${competition.name}:`, error);
        // Remove from processed set so it can be retried
        setProcessedCompetitions(prev => {
          const newSet = new Set(prev);
          newSet.delete(competition.id);
          return newSet;
        });
      }
    }
  };

  // Update user's own stats based on completed competitions
  const updateUserOwnStats = async () => {
    if (!user) return;
    
    try {
      // Query all completed competitions where user participated
      const completedQuery = query(
        collection(db, 'competitions'),
        where('status', '==', 'completed'),
        where('participants', 'array-contains', user.uid)
      );
      
      const snapshot = await new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(
          completedQuery,
          (snap) => {
            unsubscribe();
            resolve(snap);
          },
          reject
        );
      });
      
      // Count wins and losses
      let wins = 0;
      let losses = 0;
      
      snapshot.docs.forEach(doc => {
        const competition = doc.data();
        if (competition.winnerId === user.uid) {
          wins++;
        } else if (competition.winnerId && competition.finalRankings) {
          // Check if user participated (had submissions)
          const userRanking = competition.finalRankings.find(r => r.userId === user.uid);
          if (userRanking) {
            losses++;
          }
        }
      });
      
      // Update user's own document with calculated stats
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const currentData = userDoc.data();
        // Only update if stats have changed
        if (currentData.wins !== wins || currentData.losses !== losses) {
          await updateDoc(userRef, {
            wins: wins,
            losses: losses,
            lastUpdated: serverTimestamp(),
          });
          console.log(`Updated user stats: ${wins} wins, ${losses} losses`);
        }
      }
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      stopRefreshing();
      return;
    }

    // Active competitions where user is owner OR is in participants array
    const activeQuery = query(
      collection(db, 'competitions'),
      or(
        where('ownerId', '==', user.uid),
        where('participants', 'array-contains', user.uid)
      )
    );

    // Pending invitations where user is in pendingParticipants array
    const pendingQuery = query(
      collection(db, 'competitions'),
      where('pendingParticipants', 'array-contains', user.uid)
    );

    const activeUnsub = onSnapshot(
      activeQuery, 
      async (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(comp => comp.ownerId === user.uid || comp.participants?.includes(user.uid))
          .filter(comp => !removedCompetitions.has(comp.id));
        
        setActiveCompetitions(data);
        setLoading(false);
        stopRefreshing();
        
        // Check for expired competitions and auto-complete them
        await checkAndCompleteExpiredCompetitions(data);
        
        // Update user's own stats based on completed competitions
        await updateUserOwnStats();
      },
      (error) => {
        console.error('Error fetching active competitions:', error);
        setLoading(false);
        stopRefreshing();
      }
    );

    const pendingUnsub = onSnapshot(
      pendingQuery, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPendingInvitations(data);
      },
      (error) => {
        console.error('Error fetching pending invitations:', error);
      }
    );

    return () => {
      activeUnsub();
      pendingUnsub();
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [user, removedCompetitions]);

  /* ---------------- competition status helpers ---------- */
  const isCompetitionCancelled = (competition) => {
    return competition.status === 'cancelled';
  };

  const isCompetitionCompleted = (competition) => {
    const now = new Date();
    const endDate = new Date(competition.endDate);
    return now > endDate || competition.status === 'completed' || competition.status === 'cancelled';
  };

  const isCompetitionActive = (competition) => {
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    return now >= startDate && now <= endDate && competition.status !== 'completed' && competition.status !== 'cancelled';
  };

  const isCompetitionUpcoming = (competition) => {
    const now = new Date();
    const startDate = new Date(competition.startDate);
    return now < startDate;
  };

  const getCompetitionStatus = (competition) => {
    if (isCompetitionCompleted(competition)) return 'completed';
    if (isCompetitionActive(competition)) return 'active';
    if (isCompetitionUpcoming(competition)) return 'upcoming';
    return 'unknown';
  };

  const getCompetitionStatusText = (competition) => {
    const status = getCompetitionStatus(competition);
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'active':
        return 'Active';
      case 'upcoming':
        return 'Starting Soon';
      default:
        return '';
    }
  };

  const getTimeRemaining = (competition) => {
    const now = new Date();
    const endDate = new Date(competition.endDate);
    const startDate = new Date(competition.startDate);
    
    if (isCompetitionCompleted(competition)) {
      return 'Completed';
    }
    
    if (isCompetitionUpcoming(competition)) {
      const diff = startDate - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
    }
    
    if (isCompetitionActive(competition)) {
      const diff = endDate - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        return `${days} day${days !== 1 ? 's' : ''} left`;
      } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} left`;
      } else {
        return 'Ending soon';
      }
    }
    
    return '';
  };

  /* ---------------- search filter ---------------------- */
  const [queryText, setQueryText] = useState('');

  const filteredActive = useMemo(
    () =>
      activeCompetitions.filter(c =>
        c.name?.toLowerCase().includes(queryText.toLowerCase().trim()) &&
        !isCompetitionCompleted(c)
      ),
    [queryText, activeCompetitions]
  );

  const filteredCompleted = useMemo(
    () =>
      activeCompetitions.filter(c =>
        c.name?.toLowerCase().includes(queryText.toLowerCase().trim()) &&
        isCompetitionCompleted(c)
      ),
    [queryText, activeCompetitions]
  );

  const filteredPending = useMemo(
    () =>
      pendingInvitations.filter(c =>
        c.name?.toLowerCase().includes(queryText.toLowerCase().trim())
      ),
    [queryText, pendingInvitations]
  );

  /* ---------------- invitation handlers ---------------- */
  const handleAcceptInvite = async (competitionId) => {
    try {
      const compRef = doc(db, 'competitions', competitionId);
      await updateDoc(compRef, {
        participants: arrayUnion(user.uid),
        pendingParticipants: arrayRemove(user.uid),
      });
      Alert.alert('Success', 'You have joined the competition!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation');
      console.error(error);
    }
  };

  const handleDeclineInvite = async (competitionId) => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              const compRef = doc(db, 'competitions', competitionId);
              await updateDoc(compRef, {
                pendingParticipants: arrayRemove(user.uid),
              });
              Alert.alert('Success', 'Invitation declined');
            } catch (error) {
              Alert.alert('Error', 'Failed to decline invitation');
              console.error(error);
            }
          },
        },
      ]
    );
  };

  /* ---------------- leave competition handler ---------- */
  const handleLeaveCompetition = (competition) => {
    Alert.alert(
      'Leave Competition',
      'Are you sure you want to leave this competition?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovedCompetitions(prev => new Set([...prev, competition.id]));
              
              const compRef = doc(db, 'competitions', competition.id);
              
              if (competition.ownerId === user.uid) {
                await updateDoc(compRef, {
                  participants: arrayRemove(user.uid),
                  ownerId: null,
                });
              } else {
                await updateDoc(compRef, {
                  participants: arrayRemove(user.uid),
                });
              }
              
              Alert.alert('Success', 'You have left the competition');
            } catch (error) {
              setRemovedCompetitions(prev => {
                const newSet = new Set(prev);
                newSet.delete(competition.id);
                return newSet;
              });
              Alert.alert('Error', 'Failed to leave competition');
              console.error(error);
            }
          },
        },
      ]
    );
  };

  /* ---------------- navigation handlers ---------------- */
  const handlePendingInvitePress = (competition) => {
    // Navigate to lobby with special flag for pending invites
    navigation.navigate('CompetitionLobby', { 
      competition, 
      isPendingInvite: true 
    });
  };

 // In src/screens/ActiveCompetitionsScreen.js, update the handleCompetitionPress function:

const handleCompetitionPress = async (competition) => {
  // Check if cancelled first
  if (competition.status === 'cancelled') {
    Alert.alert(
      'Competition Cancelled',
      'This competition has been cancelled by the host.',
      [{ text: 'OK' }]
    );
    return;
  }
  
  const status = getCompetitionStatus(competition);
  
  if (status === 'completed') {
    navigation.navigate('Leaderboard', { competition });
  } else if (status === 'upcoming') {
    // Navigate to lobby for competitions that haven't started
    navigation.navigate('CompetitionLobby', { competition });
  } else {
    // For active competitions, check if user has already entered
    const key = `competition_entered_${competition.id}_${user.uid}`;
    try {
      const hasEntered = await AsyncStorage.getItem(key);
      
      if (hasEntered === 'true') {
        // User has already seen transition, go directly to CompetitionDetails
        navigation.navigate('CompetitionDetails', { competition });
      } else {
        // First time entering or pending invitations exist
        const hasPendingInvitations = competition.pendingParticipants && 
                                      competition.pendingParticipants.length > 0;
        
        if (hasPendingInvitations) {
          // Still has unresolved invitations, go to lobby
          navigation.navigate('CompetitionLobby', { competition });
        } else {
          // All invitations resolved, show transition screen
          navigation.navigate('CompetitionLobby', { competition, skipLobby: true });
        }
      }
    } catch (error) {
      // If error reading storage, fall back to lobby
      console.error('Error checking competition entry status:', error);
      navigation.navigate('CompetitionLobby', { competition, skipLobby: true });
    }
  }
};

  /* ---------------- render tab content ---------------- */
  const renderActiveTab = () => (
    <>
      {/* Active Competitions */}
      {filteredActive.length > 0 ? (
        filteredActive.map(comp => {
          const endDate = new Date(comp.endDate);
          const formattedDate = endDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          
          return (
            <TouchableOpacity
              key={comp.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              <Text style={styles.cardTitle}>{comp.name}</Text>
              {comp.status === 'cancelled' && (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledText}>CANCELLED</Text>
                </View>
              )}
              <Text style={styles.metaText}>Ends: {formattedDate}</Text>
              <TouchableOpacity 
                style={styles.actionLinkContainer}
                onPress={() => handleCompetitionPress(comp)}
              >
                <Text style={styles.actionLink}>View More {'>'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.emptyText}>
          No active competitions yet — create one to get started!
        </Text>
      )}
    </>
  );

  const renderCompletedTab = () => (
    <>
      {filteredCompleted.length > 0 ? (
        filteredCompleted.map(comp => {
          const endDate = new Date(comp.endDate);
          const formattedDate = endDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          
          return (
            <TouchableOpacity
              key={comp.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              <Text style={styles.cardTitle}>{comp.name}</Text>
              {comp.status === 'cancelled' && (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledText}>CANCELLED</Text>
                </View>
              )}
              <Text style={styles.metaText}>Ended: {formattedDate}</Text>
              {comp.winnerId && comp.status !== 'cancelled' && (
                <Text style={styles.winnerText}>Winner determined ✓</Text>
              )}
              <TouchableOpacity 
                style={styles.actionLinkContainer}
                onPress={() => navigation.navigate('Leaderboard', { competition: comp })}
              >
                <Text style={styles.actionLink}>View Results {'>'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.emptyText}>
          No completed competitions yet.
        </Text>
      )}
    </>
  );

  const renderInvitesTab = () => (
    <>
      {filteredPending.length > 0 ? (
        filteredPending.map(comp => (
          <TouchableOpacity
            key={comp.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => handlePendingInvitePress(comp)}
          >
            <Text style={styles.cardTitle}>{comp.name}</Text>
            <Text style={styles.metaText}>You've been invited to join!</Text>
            <TouchableOpacity 
              style={styles.actionLinkContainer}
              onPress={() => handlePendingInvitePress(comp)}
            >
              <Text style={styles.actionLink}>View Details {'>'}</Text>
            </TouchableOpacity>
            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[styles.inviteButton, styles.acceptButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAcceptInvite(comp.id);
                }}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteButton, styles.declineButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeclineInvite(comp.id);
                }}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.emptyText}>
          No pending invitations.
        </Text>
      )}
    </>
  );

  return (
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#1C2125' }}>
        <StatusBar style="light" translucent={false} />
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerCapsule} />
        </View>

        <View style={styles.tabContainer}>
          {/* Animated sliding background */}
          <Animated.View 
            style={[
              styles.tabSlider,
              {
                transform: [{
                  translateX: tabAnimation.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, (screenWidth - 48 - 8) / 3, (screenWidth - 48 - 8) * 2 / 3],
                  })
                }]
              }
            ]}
          />
          
          <TouchableOpacity
            style={styles.tab}
            onPress={() => animateToTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => animateToTab('invites')}
          >
            <Text style={[styles.tabText, activeTab === 'invites' && styles.activeTabText]}>
              Invites
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => animateToTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Results
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9EA5AC" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Name of competition"
            placeholderTextColor="#9EA5AC"
            value={queryText}
            onChangeText={setQueryText}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#93D13C']}
              tintColor="#93D13C"
            />
          }
        >
          {loading && (
            <Text style={styles.loadingText}>Loading competitions…</Text>
          )}

          {!loading && activeTab === 'active' && renderActiveTab()}
          {!loading && activeTab === 'invites' && renderInvitesTab()}
          {!loading && activeTab === 'completed' && renderCompletedTab()}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F8F9F8' 
  },

  header: {
    height: 1,
    backgroundColor: '#1C2125',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F3F3',
    marginHorizontal: 24,
    marginTop: 16,
    height: 64,
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabSlider: {
    position: 'absolute',
    width: (Dimensions.get('window').width - 48 - 8) / 3,
    height: 56,
    backgroundColor: '#F3F9EA',
    borderRadius: 14,
    top: 4,
    left: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    zIndex: 1,
  },
  activeTabStyle: {
    // Removed backgroundColor - now handled by animated slider
  },
  tabText: {
    fontSize: 21,
    fontWeight: '700',
    color: '#CACCCF',
  },
  activeTabText: {
    color: '#93D13C',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEEEE',
    borderRadius: 20,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    height: 56,
  },
  searchIcon: { 
    marginRight: 10 
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: '500',
    color: '#333' 
  },

  scroll: { 
    flex: 1, 
    paddingHorizontal: 24 
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1E23',
    marginBottom: 16,
    marginTop: 8,
  },

  card: {
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 22,
    marginBottom: 24,
  },

  cardTitle: { 
    fontSize: 23, 
    lineHeight: 34,
    fontWeight: '700', 
    color: '#FFFFFF',
  },

  metaText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#B8C0C7',
    marginTop: 6,
  },

  winnerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#93D13C',
    marginTop: 4,
  },

  actionLinkContainer: {
    marginTop: 14,
  },

  actionLink: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#93D13C',
  },

  inviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },

  inviteButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  acceptButton: {
    backgroundColor: '#93D13C',
  },

  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#93D13C',
  },

  acceptButtonText: {
    color: '#262626',
    fontWeight: '600',
    fontSize: 16,
  },

  declineButtonText: {
    color: '#93D13C',
    fontWeight: '600',
    fontSize: 16,
  },
  
  // Cancelled indicator styles
  cancelledBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  cancelledText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});