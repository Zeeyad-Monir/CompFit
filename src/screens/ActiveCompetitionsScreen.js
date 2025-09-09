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
  Easing,
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

// Color tokens for the new design
const colors = {
  nav: {
    activeGreen: '#B6DB78',  // New fresh green
    inactiveGray: '#B3B3B3', // New gray
    textDefault: '#111111'
  },
  field: {
    bg: '#F1EFEF',           // New field bg
    placeholder: '#BEBEBE'    // New placeholder
  },
  icon: {
    gray: '#B3B3B3'          // New icon color
  },
  background: '#FFFFFF'      // Pure white
};

export default function ActiveCompetitionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  /* ---------------- tab state ------------------ */
  const [activeTab, setActiveTab] = useState('active');
  const [measurementsReady, setMeasurementsReady] = useState(false);
  
  // Base width for the underline
  const baseUnderlineWidth = 60;
  
  // Calculate initial centered positions for tabs
  const calculateInitialTabX = (tabIndex) => {
    const columnWidth = (screenWidth - 48) / 3;  // 3 equal columns
    const columnCenter = columnWidth * tabIndex + columnWidth / 2;
    return columnCenter - baseUnderlineWidth / 2;
  };
  
  // Tab measurements for underline positioning
  const [tabMeasurements, setTabMeasurements] = useState({
    active: { scale: 1.2, x: calculateInitialTabX(0) },      // Larger to match actual measured width
    invites: { scale: 1.3, x: calculateInitialTabX(1) },     // Larger to match actual measured width
    completed: { scale: 1.35, x: calculateInitialTabX(2) }   // Larger to match actual measured width
  });

  // Animation refs for underline and press feedback
  const underlinePosition = React.useRef(new Animated.Value(calculateInitialTabX(0))).current;
  const underlineScale = React.useRef(new Animated.Value(1.2)).current;  // Match corrected Active tab scale
  const activeScale = React.useRef(new Animated.Value(1)).current;
  const invitesScale = React.useRef(new Animated.Value(1)).current;
  const completedScale = React.useRef(new Animated.Value(1)).current;

  // Animate to new tab
  const animateToTab = (newTab) => {
    // Get measurements for the target tab
    const targetMeasurement = tabMeasurements[newTab];
    
    // Animate underline position and scale only
    Animated.parallel([
      Animated.timing(underlinePosition, {
        toValue: targetMeasurement.x,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(underlineScale, {
        toValue: targetMeasurement.scale,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,  // Now we can use native driver for scale!
      })
    ]).start();
    
    setActiveTab(newTab);
  };
  
  // Press feedback handlers
  const handlePressIn = (scaleAnim) => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (tab, scaleAnim) => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 80,
      useNativeDriver: true,
    }).start();
    animateToTab(tab);
  };

  // Set initial underline scale to match the active tab
  React.useEffect(() => {
    underlineScale.setValue(1.2);  // Use the corrected Active scale directly
  }, []);

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

  const getCompetitionBadgeStatus = (competition) => {
    // Check if competition hasn't started yet
    if (isCompetitionUpcoming(competition)) {
      return 'Pending';
    }
    
    // Check if there are pending invitations
    if (competition.pendingParticipants && competition.pendingParticipants.length > 0) {
      return 'Pending';
    }
    
    // Check if competition is active
    if (isCompetitionActive(competition)) {
      return 'Active';
    }
    
    return null; // For completed/cancelled, we don't show a badge
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
      activeCompetitions
        .filter(c =>
          c.name?.toLowerCase().includes(queryText.toLowerCase().trim()) &&
          !isCompetitionCompleted(c)
        )
        .sort((a, b) => {
          const endDateA = new Date(a.endDate);
          const endDateB = new Date(b.endDate);
          
          // Primary sort by end date (earliest/soonest first)
          if (endDateA.getTime() !== endDateB.getTime()) {
            return endDateA - endDateB;
          }
          
          // Secondary sort by name if end dates are the same
          return a.name.localeCompare(b.name);
        }),
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
          // Get the badge status to determine which date to show
          const badgeStatus = getCompetitionBadgeStatus(comp);
          // Show start date for pending status, end date for active/completed
          const showStartDate = badgeStatus === 'Pending';
          const dateToShow = showStartDate ? new Date(comp.startDate) : new Date(comp.endDate);
          const formattedDate = dateToShow.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          const dateLabel = showStartDate ? 'Starts' : 'Ends';
          
          return (
            <TouchableOpacity
              key={comp.id}
              style={[styles.card, styles.activeCard]}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              <Text 
                style={[styles.cardTitle, styles.cardTitleTwoLine]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {comp.name}
              </Text>
              
              {/* Status Badge */}
              {(() => {
                const status = getCompetitionBadgeStatus(comp);
                if (status) {
                  return (
                    <View style={[
                      styles.statusBadge,
                      status === 'Active' ? styles.statusBadgeActive : styles.statusBadgePending
                    ]}>
                      <Text style={styles.statusBadgeText}>{status}</Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Always show date directly under title with tight spacing */}
              <Text style={[styles.metaText, styles.metaTextTight]}>{dateLabel}: {formattedDate}</Text>

              {comp.status === 'cancelled' && (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledText}>CANCELLED</Text>
                </View>
              )}
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
              style={styles.completedCard}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              <Text 
                style={[styles.cardTitle, styles.cardTitleTwoLine]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {comp.name}
              </Text>
              {comp.status === 'cancelled' && (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledText}>CANCELLED</Text>
                </View>
              )}
              <Text style={styles.endedDateText}>Ended: {formattedDate}</Text>
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <StatusBar style="dark" translucent={false} />
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerCapsule} />
        </View>

        <View style={styles.topNavContainer}>
          {/* Tab row with 3 equal columns */}
          <View style={styles.tabRow}>
            {/* Active Tab */}
            <Animated.View style={[styles.tabColumn, { transform: [{ scale: activeScale }] }]}>
              <TouchableOpacity
                style={styles.tabButton}
                onPressIn={() => handlePressIn(activeScale)}
                onPressOut={() => handlePressOut('active', activeScale)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  const textWidth = width * 0.8;
                  const indicatorWidth = textWidth + 12;
                  const scale = indicatorWidth / baseUnderlineWidth;
                  const columnCenter = (screenWidth - 48) / 3 * 0 + (screenWidth - 48) / 6;
                  setTabMeasurements(prev => ({
                    ...prev,
                    active: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                  }));
                  setMeasurementsReady(true);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'active' }}
              >
                <Text style={[
                  styles.tabLabel,
                  { 
                    color: activeTab === 'active' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                    fontSize: activeTab === 'active' ? 23 : 21  // 10% larger when active
                  }
                ]}>
                  Active
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Invites Tab */}
            <Animated.View style={[styles.tabColumn, { transform: [{ scale: invitesScale }] }]}>
              <TouchableOpacity
                style={styles.tabButton}
                onPressIn={() => handlePressIn(invitesScale)}
                onPressOut={() => handlePressOut('invites', invitesScale)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  const textWidth = width * 0.8;
                  const indicatorWidth = textWidth + 12;
                  const scale = indicatorWidth / baseUnderlineWidth;
                  const columnCenter = (screenWidth - 48) / 3 * 1 + (screenWidth - 48) / 6;
                  setTabMeasurements(prev => ({
                    ...prev,
                    invites: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                  }));
                  setMeasurementsReady(true);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'invites' }}
              >
                <Text style={[
                  styles.tabLabel,
                  { 
                    color: activeTab === 'invites' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                    fontSize: activeTab === 'invites' ? 23 : 21  // 10% larger when active
                  }
                ]}>
                  Invites
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Results Tab */}
            <Animated.View style={[styles.tabColumn, { transform: [{ scale: completedScale }] }]}>
              <TouchableOpacity
                style={styles.tabButton}
                onPressIn={() => handlePressIn(completedScale)}
                onPressOut={() => handlePressOut('completed', completedScale)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  const textWidth = width * 0.8;
                  const indicatorWidth = textWidth + 12;
                  const scale = indicatorWidth / baseUnderlineWidth;
                  const columnCenter = (screenWidth - 48) / 3 * 2 + (screenWidth - 48) / 6;
                  setTabMeasurements(prev => ({
                    ...prev,
                    completed: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                  }));
                  setMeasurementsReady(true);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'completed' }}
              >
                <Text style={[
                  styles.tabLabel,
                  { 
                    color: activeTab === 'completed' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                    fontSize: activeTab === 'completed' ? 23 : 21  // 10% larger when active
                  }
                ]}>
                  Results
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Animated underline indicator */}
          <Animated.View 
            style={[
              styles.underlineIndicator,
              {
                width: baseUnderlineWidth,  // Fixed base width
                opacity: measurementsReady ? 1 : 0,  // Hide until measurements ready
                transform: [
                  { translateX: underlinePosition },
                  { scaleX: underlineScale }  // Scale instead of width
                ]
              }
            ]}
          />
        </View>

        <View style={styles.searchFieldWrapper}>
          <View style={styles.searchField}>
            <Ionicons 
              name="search" 
              size={22} 
              color={colors.icon.gray} 
              style={styles.searchIcon} 
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Name of competition"
              placeholderTextColor={colors.field.placeholder}
              value={queryText}
              onChangeText={setQueryText}
              returnKeyType="search"
            />
          </View>
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
    backgroundColor: colors.background 
  },

  header: {
    height: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // New top navigation styles
  topNavContainer: {
    paddingHorizontal: 24,
    paddingTop: 1,   // Minimal spacing - just 1px from header
    backgroundColor: colors.background,
  },

  tabRow: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'flex-end',
  },

  tabColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  tabLabel: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  underlineIndicator: {
    height: 7,           // Reduced another 15% from 8px (was 12px originally)
    borderRadius: 999,
    backgroundColor: colors.nav.activeGreen,
    marginTop: 1,        // Moved 50% closer (from 2px) - minimal gap
    // Width is now controlled by baseUnderlineWidth constant and scale transform
  },

  // Search field styles
  searchFieldWrapper: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 20,
  },

  searchField: {
    height: 55,
    backgroundColor: colors.field.bg,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 56,
    paddingRight: 20,
    position: 'relative',
  },

  searchIcon: {
    position: 'absolute',
    left: 20,
    zIndex: 1,
  },

  searchInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '400',
    color: colors.nav.textDefault,
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
    position: 'relative',  // For absolute positioning of badge
  },

  // Fixed height for Active tab cards to ensure consistency
  activeCard: {
    height: 120,
  },

  completedCard: {
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 22,  // Reduced by 2px to compensate for border
    paddingTop: 20,         // Reduced by 2px to compensate for border
    paddingBottom: 20,      // Reduced by 2px to compensate for border
    marginBottom: 24,
    position: 'relative',
    height: 120,            // Match Active cards height
    
    // Add green border matching tab bar
    borderWidth: 3, // +10% from 2
    borderColor: '#B6DB78',  // Tab bar active green
  },

  cardTitle: { 
    fontSize: 22,     // Reverted to original size
    lineHeight: 34,   // Reverted to original line height
    fontWeight: '700', 
    color: '#FFFFFF',
    paddingRight: 74,  // Updated for smaller badge (52 + 14 + 8 margin)
  },

  // Clamp title to 2 lines without forcing extra space
  cardTitleTwoLine: {
    // numberOfLines enforces the max; avoid minHeight so metadata tucks right under
  },

  metaText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#B8C0C7',
    marginTop: 6,
  },

  // Tighter spacing for Active card date under title
  metaTextTight: {
    marginTop: 4,
  },

  endedDateText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.nav.activeGreen, // Match top tab bar active green
    marginTop: 6,
  },

  actionLinkContainer: {
    marginTop: 14,
  },

  actionLink: {
    fontSize: 17,  // Increased by 15%
    lineHeight: 25,  // Proportionally adjusted
    fontWeight: '600',
    color: '#93D13C',
  },

  // Status Badge Styles
  statusBadge: {
    position: 'absolute',
    top: 18,
    right: 14,    // Moved 20% closer to edge (18 * 0.8 = 14.4)
    minWidth: 52,    // Further 10% reduction (58 * 0.9 = 52.2)
    minHeight: 26,   // Further 10% reduction (29 * 0.9 = 26.1)
    paddingVertical: 5,    // Further 10% reduction (6 * 0.9 = 5.4)
    paddingHorizontal: 10, // Further 10% reduction (13 * 0.9 = 11.7)
    borderRadius: 999, // Fully rounded pill shape
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    
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

  statusBadgeActive: {
    backgroundColor: '#8DC63F', // Bright lime green
  },

  statusBadgePending: {
    backgroundColor: '#E6952B', // Warm orange
  },

  statusBadgeText: {
    fontSize: 12,    // Further 10% reduction (13 * 0.9 = 11.7)
    lineHeight: 13,  // Further 10% reduction (14 * 0.9 = 12.6)
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
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
