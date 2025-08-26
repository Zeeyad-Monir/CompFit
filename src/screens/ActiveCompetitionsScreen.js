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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Header, Button } from '../components';
import { Ionicons } from '@expo/vector-icons';

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
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

export default function ActiveCompetitionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  /* ---------------- tab state ------------------ */
  const [activeTab, setActiveTab] = useState('active');

  /* ---------------- live Firestore data ---------------- */
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [removedCompetitions, setRemovedCompetitions] = useState(new Set()); // Track locally removed competitions
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);

  /* ---------------- refresh handler -------------------- */
  const onRefresh = () => {
    setRefreshing(true);
    // Clear removed competitions cache on refresh
    setRemovedCompetitions(new Set());
    
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
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          // Filter out competitions where user is not in participants (unless they're the owner)
          .filter(comp => comp.ownerId === user.uid || comp.participants?.includes(user.uid))
          // Also filter out locally removed competitions
          .filter(comp => !removedCompetitions.has(comp.id));
        setActiveCompetitions(data);
        setLoading(false);
        stopRefreshing(); // Stop refresh spinner when data loads
      },
      (error) => {
        console.error('Error fetching active competitions:', error);
        setLoading(false);
        stopRefreshing(); // Stop refresh spinner on error
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
      // Clear timeout on cleanup
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [user, removedCompetitions]); // Add removedCompetitions to dependency array

  /* ---------------- competition status helpers ---------- */
  const isCompetitionCompleted = (competition) => {
    const now = new Date();
    const endDate = new Date(competition.endDate);
    return now > endDate;
  };

  const isCompetitionActive = (competition) => {
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    return now >= startDate && now <= endDate;
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
              // Immediately remove from local state for instant UI update
              setRemovedCompetitions(prev => new Set([...prev, competition.id]));
              
              const compRef = doc(db, 'competitions', competition.id);
              
              // Handle both owner and participant cases
              if (competition.ownerId === user.uid) {
                // If user is the owner, remove them from both owner and participants
                await updateDoc(compRef, {
                  participants: arrayRemove(user.uid),
                  ownerId: null, // Or you could transfer ownership, but for now we'll just remove them
                });
              } else {
                // If user is just a participant, remove them from participants
                await updateDoc(compRef, {
                  participants: arrayRemove(user.uid),
                });
              }
              
              Alert.alert('Success', 'You have left the competition');
            } catch (error) {
              // If there's an error, restore the competition to the UI
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
  const handleCompetitionPress = (competition) => {
    const status = getCompetitionStatus(competition);
    
    if (status === 'completed') {
      // Navigate directly to leaderboard for completed competitions
      navigation.navigate('Leaderboard', { competition });
    } else {
      // Navigate to competition details for active/upcoming competitions
      navigation.navigate('CompetitionDetails', { competition });
    }
  };

  /* ---------------- render tab content ---------------- */
  const renderActiveTab = () => (
    <>
      {/* Pending Invitations Section */}
      {filteredPending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {filteredPending.map(comp => (
            <View key={comp.id} style={styles.card}>
              <Text style={styles.cardTitle}>{comp.name}</Text>
              <Text style={styles.metaText}>You've been invited to join!</Text>
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={[styles.inviteButton, styles.acceptButton]}
                  onPress={() => handleAcceptInvite(comp.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteButton, styles.declineButton]}
                  onPress={() => handleDeclineInvite(comp.id)}
                >
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

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
          No active competitions yet — create one or wait for an invite!
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
              <Text style={styles.metaText}>Ended: {formattedDate}</Text>
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

  return (
    <>
      {/* Paint the status‑bar / notch area solid black */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#1C2125' }}>
        <StatusBar style="light" translucent={false} />
      </SafeAreaView>

      {/* Main content */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
        {/* Dark header band */}
        <View style={styles.header}>
          <View style={styles.headerCapsule} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.activeTabStyle]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTabStyle]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
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

        {/* Tab content */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#93D13C']} // Android
              tintColor="#93D13C" // iOS
            />
          }
        >
          {loading && (
            <Text style={styles.loadingText}>Loading competitions…</Text>
          )}

          {!loading && activeTab === 'active' && renderActiveTab()}
          {!loading && activeTab === 'completed' && renderCompletedTab()}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

/* ───────────── styles ───────────── */
const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F8F9F8' 
  },

  // Dark header band
  header: {
    height: 0,
    backgroundColor: '#1C2125',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // headerCapsule: {
  //   width: '62%',
  //   height: 44,
  //   borderRadius: 22,
  //   backgroundColor: '#55585A',
  // },

  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F3F3',
    marginHorizontal: 24,
    marginTop: 16,
    height: 64,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    
  },
  activeTabStyle: {
    backgroundColor: '#F3F9EA',
  },
  tabText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#CACCCF',
  },
  activeTabText: {
    color: '#93D13C',
  },

  // Search field
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

  // Scroll and content
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

  // Competition cards
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

  actionLinkContainer: {
    marginTop: 14,
  },

  actionLink: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#93D13C',
  },

  // Invite actions
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
});