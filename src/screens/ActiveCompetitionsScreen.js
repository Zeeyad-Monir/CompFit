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
            <View key={comp.id} style={styles.inviteCard}>
              <Ionicons
                name="mail"
                size={90}
                color="rgba(255,255,255,0.08)"
                style={styles.bgIcon}
              />

              <View style={styles.inviteContent}>
                <Text style={styles.cardTitle}>{comp.name}</Text>
                <Text style={styles.inviteText}>You've been invited to join!</Text>
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
            </View>
          ))}
        </>
      )}

      {/* Active Competitions */}
      {filteredActive.length > 0 ? (
        filteredActive.map(comp => {
          const status = getCompetitionStatus(comp);
          
          return (
            <TouchableOpacity
              key={comp.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              <Ionicons
                name="fitness"
                size={90}
                color="rgba(255,255,255,0.08)"
                style={styles.bgIcon}
              />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {comp.name}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    status === 'active' && styles.activeBadge,
                    status === 'upcoming' && styles.upcomingBadge,
                  ]}>
                    <Text style={styles.statusText}>
                      {getCompetitionStatusText(comp)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.timeRemainingText}>
                  {getTimeRemaining(comp)}
                </Text>

                <View style={styles.seeMoreRow}>
                  <Text style={styles.seeMoreText}>See more</Text>
                  <Text style={styles.seeMoreArrow}>›</Text>
                </View>
              </View>
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
          return (
            <TouchableOpacity
              key={comp.id}
              style={[styles.card, styles.completedCard]}
              activeOpacity={0.85}
              onPress={() => handleCompetitionPress(comp)}
            >
              {/* Centered Trophy Background Icon */}
              <View style={styles.completedTrophyBackground}>
                <Ionicons
                  name="trophy"
                  size={64}
                  color="rgba(164, 214, 94, 0.2)"
                />
              </View>

              {/* Leave Competition Button */}
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card press
                  handleLeaveCompetition(comp);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, styles.completedCardTitle]}>
                    {comp.name}
                  </Text>
                </View>

                <Text style={[styles.timeRemainingText, styles.completedTimeText]}>
                  {getTimeRemaining(comp)}
                </Text>

                <View style={styles.viewResultsContainer}>
                  <Button
                    title="View Results"
                    style={styles.viewResultsButton}
                    textStyle={styles.viewResultsButtonText}
                    onPress={() => navigation.navigate('Leaderboard', { competition: comp })}
                  />
                </View>
              </View>
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#192126' }}>
        <StatusBar style="light" translucent={false} />
      </SafeAreaView>

      {/* Main content */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
        {/* Custom Header with Prominent Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CompFit</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.activeTabStyle]}
            onPress={() => setActiveTab('active')}
          >
            <Ionicons 
              name="fitness" 
              size={20} 
              color={activeTab === 'active' ? '#A4D65E' : '#6B7280'} 
            />
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTabStyle]}
            onPress={() => setActiveTab('completed')}
          >
            <Ionicons 
              name="trophy" 
              size={20} 
              color={activeTab === 'completed' ? '#A4D65E' : '#6B7280'} 
            />
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="name of competition"
            placeholderTextColor="#999"
            value={queryText}
            onChangeText={setQueryText}
            returnKeyType="search"
          />
        </View>

        {/* Tab content */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 150 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#A4D65E']} // Android
              tintColor="#A4D65E" // iOS
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
  root: { flex: 1, backgroundColor: '#F8F8F8' },

  // Custom Header
  header: {
    height: 60,
    backgroundColor: '#192126',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#A4D65E',
    letterSpacing: -0.5,
  },

  // Tab Navigation (matching ProfileScreen style)
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeTabStyle: {
    backgroundColor: '#F0F9E8',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#A4D65E',
    fontWeight: '600',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 52,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },

  scroll: { flex: 1, paddingHorizontal: 16 },

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
    borderRadius: 16,
    minHeight: 180,
    marginBottom: 24,
    overflow: 'hidden',
  },

  completedCard: {
    backgroundColor: '#262626',
    borderWidth: 2,
    borderColor: '#A4D65E',
  },

  inviteCard: {
    backgroundColor: '#A4D65E',
    borderRadius: 16,
    minHeight: 160,
    marginBottom: 24,
    overflow: 'hidden',
  },

  bgIcon: { position: 'absolute', right: 12, bottom: 12 },

  cardContent: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'space-between' 
  },
  
  inviteContent: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'space-between' 
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  cardTitle: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },

  completedCardTitle: {
    color: '#A4D65E',
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  activeBadge: {
    backgroundColor: '#4CAF50',
  },

  upcomingBadge: {
    backgroundColor: '#FF9800',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  timeRemainingText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 12,
  },

  completedTimeText: {
    color: '#A4D65E',
  },

  completedTrophyBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewResultsContainer: {
    alignItems: 'center',
    marginTop: 8,
  },

  viewResultsButton: {
    backgroundColor: '#A4D65E',
    paddingHorizontal: 24,
    paddingVertical: 8,
    minWidth: 120,
  },

  viewResultsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  leaveButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  inviteText: { 
    fontSize: 16, 
    color: '#1A1E23', 
    marginTop: 8,
    marginBottom: 16,
  },

  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },

  inviteButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },

  acceptButton: {
    backgroundColor: '#1A1E23',
  },

  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1A1E23',
  },

  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  declineButtonText: {
    color: '#1A1E23',
    fontWeight: '600',
    fontSize: 16,
  },

  seeMoreRow: { flexDirection: 'row', alignItems: 'center' },
  seeMoreText: { fontSize: 16, fontWeight: '700', color: '#A4D65E' },
  seeMoreArrow: { fontSize: 20, fontWeight: '700', color: '#A4D65E', marginLeft: 4 },
});