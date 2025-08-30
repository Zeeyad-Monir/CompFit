// src/screens/CompetitionLobbyScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Header } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove, serverTimestamp } from 'firebase/firestore';

export default function CompetitionLobbyScreen({ route, navigation }) {
  const { competition: initialCompetition } = route.params;
  const { user } = useContext(AuthContext);
  
  const [competition, setCompetition] = useState(initialCompetition);
  const [participants, setParticipants] = useState([]);
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState('');

  // Check if competition has started
  const hasCompetitionStarted = () => {
    const now = new Date();
    const startDate = new Date(competition.startDate);
    return now >= startDate;
  };

  // Check if all invitations have been resolved (accepted or declined)
  const allInvitationsResolved = () => {
    // Use both state and competition object to ensure accuracy
    const pending = pendingParticipants || competition?.pendingParticipants || [];
    return pending.length === 0;
  };

  // Check if competition can start (considering grace period)
  const canCompetitionStart = () => {
    if (!hasCompetitionStarted()) return false;
    
    // All invitations resolved - can start
    if (allInvitationsResolved()) return true;
    
    // Grace period expired with pending invites - trigger auto-removal
    if (hasGracePeriodExpired()) return true;
    
    // Still in grace period - wait
    return false;
  };

  // ==================== GRACE PERIOD LOGIC ====================
  const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Calculate grace period end time
  const getGracePeriodEndTime = () => {
    if (!competition?.startDate) return null;
    const startDate = new Date(competition.startDate);
    return new Date(startDate.getTime() + GRACE_PERIOD_MS);
  };

  // Check if currently in grace period
  const isInGracePeriod = () => {
    if (!hasCompetitionStarted()) return false;
    if (allInvitationsResolved()) return false;
    
    const now = new Date();
    const gracePeriodEnd = getGracePeriodEndTime();
    return gracePeriodEnd && now < gracePeriodEnd;
  };

  // Check if grace period has expired
  const hasGracePeriodExpired = () => {
    if (!hasCompetitionStarted()) return false;
    
    const now = new Date();
    const gracePeriodEnd = getGracePeriodEndTime();
    return gracePeriodEnd && now >= gracePeriodEnd;
  };

  // Get remaining time in grace period (milliseconds)
  const getGracePeriodRemainingMs = () => {
    const gracePeriodEnd = getGracePeriodEndTime();
    if (!gracePeriodEnd) return 0;
    
    const now = new Date();
    const remaining = gracePeriodEnd - now;
    return Math.max(0, remaining);
  };

  // Format remaining time for display
  const formatGracePeriodRemaining = () => {
    const ms = getGracePeriodRemainingMs();
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours >= 20) return `${hours} hours`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes} minutes`;
    return 'Expiring soon';
  };

  // Format dates
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate and display countdown
  const updateCountdown = () => {
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const timeUntilStart = startDate - now;
    
    // SCENARIO 1: Before start time
    if (timeUntilStart > 0) {
      const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
      
      let countdown = '';
      if (days > 0) {
        countdown = `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
      } else if (hours > 0) {
        countdown = `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else {
        countdown = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
      
      setCountdownTimer(countdown);
      return;
    }
    
    // SCENARIO 2: After start time
    const pending = competition?.pendingParticipants || pendingParticipants || [];
    
    // No pending - ready to start
    if (pending.length === 0) {
      if (!competition?.gracePeriodHandled) {
        navigation.replace('CompetitionDetails', { competition });
      }
      return;
    }
    
    // In grace period - show countdown
    if (isInGracePeriod()) {
      const remaining = formatGracePeriodRemaining();
      setCountdownTimer(`Grace period: ${remaining}`);
      return;
    }
    
    // Grace period expired - initiate auto-removal
    if (hasGracePeriodExpired()) {
      if (competition.ownerId === user?.uid && !competition.gracePeriodHandled) {
        setCountdownTimer('Starting competition...');
        performAutoRemoval();
      } else {
        setCountdownTimer('Waiting for host...');
      }
      return;
    }
    
    setCountdownTimer('Processing...');
  };

  // Handle automatic removal of pending participants after grace period
  const performAutoRemoval = async () => {
    // Safety checks
    if (!competition?.id) return;
    if (!hasGracePeriodExpired()) return;
    if (competition.gracePeriodHandled) return; // Already processed
    
    // Only owner performs the removal
    if (competition.ownerId !== user?.uid) {
      console.log('Non-owner waiting for auto-removal...');
      return;
    }
    
    const pendingUsers = competition.pendingParticipants || [];
    if (pendingUsers.length === 0) return;
    
    console.log(`Grace period expired. Auto-removing ${pendingUsers.length} pending participants.`);
    
    try {
      // Perform the auto-removal
      await updateDoc(doc(db, 'competitions', competition.id), {
        pendingParticipants: [],
        gracePeriodHandled: true,
        gracePeriodExpiredAt: serverTimestamp(),
        autoRemovedUsers: pendingUsers,
      });
      
      console.log('Auto-removal successful');
    } catch (error) {
      console.error('Auto-removal failed:', error);
      Alert.alert(
        'Grace Period Expired',
        'Failed to automatically start the competition. Please try manually.',
        [{ text: 'OK' }]
      );
    }
  };

  // Fetch participant details
  const fetchParticipantDetails = async (userIds, isPending = false) => {
    const users = [];
    for (const userId of userIds) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          users.push({
            id: userId,
            ...userDoc.data(),
            status: isPending ? 'pending' : 'accepted'
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    }
    return users;
  };

  // Load competition data
  useEffect(() => {
    if (!competition?.id) return;
    
    // Don't check here - wait for Firebase data to load
    let hasCheckedStart = false;

    // Listen to competition updates
    const unsubscribe = onSnapshot(
      doc(db, 'competitions', competition.id),
      async (snapshot) => {
        if (snapshot.exists()) {
          const updatedCompetition = { id: snapshot.id, ...snapshot.data() };
          
          // Check if competition was cancelled
          if (updatedCompetition.status === 'cancelled') {
            // Navigate away if competition was cancelled
            const isCompetitionOwner = updatedCompetition.ownerId === user?.uid;
            Alert.alert(
              'Competition Cancelled',
              isCompetitionOwner 
                ? 'You have ended this competition.' 
                : 'The host has cancelled this competition.',
              [{ text: 'OK', onPress: () => navigation.navigate('ActiveCompetitions') }]
            );
            return;
          }
          
          setCompetition(updatedCompetition);
          
          // Fetch participant details
          const acceptedUsers = await fetchParticipantDetails(updatedCompetition.participants || []);
          const pendingUsers = await fetchParticipantDetails(updatedCompetition.pendingParticipants || [], true);
          
          setParticipants(acceptedUsers);
          setPendingParticipants(pendingUsers);
          setLoading(false);
          setRefreshing(false);
          
          // Check competition start conditions
          if (!hasCheckedStart) {
            const now = new Date();
            const startDate = new Date(updatedCompetition.startDate);
            const hasStarted = now >= startDate;
            const pending = updatedCompetition.pendingParticipants || [];
            
            // CASE 1: Ready to start (no pending or grace handled)
            if (hasStarted && (pending.length === 0 || updatedCompetition.gracePeriodHandled)) {
              hasCheckedStart = true;
              navigation.replace('CompetitionDetails', { competition: updatedCompetition });
              return;
            }
            
            // CASE 2: Check for grace period expiration
            if (hasStarted && pending.length > 0 && !updatedCompetition.gracePeriodHandled) {
              const gracePeriodEnd = new Date(startDate.getTime() + GRACE_PERIOD_MS);
              
              if (now >= gracePeriodEnd) {
                // Grace period expired - owner should handle
                if (updatedCompetition.ownerId === user?.uid) {
                  console.log('Grace period expired - initiating auto-removal');
                  performAutoRemoval();
                }
              }
            }
          }
        }
      },
      (error) => {
        console.error('Error fetching competition:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // Set up dynamic interval based on state
    updateCountdown();
    
    // Determine interval based on state
    let intervalTime = 60000; // Default: 1 minute
    if (isInGracePeriod()) {
      // During grace period: update every minute
      intervalTime = 60000;
    } else if (hasCompetitionStarted() && !allInvitationsResolved()) {
      // Waiting to start: check frequently
      intervalTime = 5000;
    }
    
    const interval = setInterval(updateCountdown, intervalTime);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [competition?.id]);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Data will refresh via the listener
  };

  // Handle leave competition
  const handleLeaveCompetition = () => {
    Alert.alert(
      'Leave Competition',
      'Are you sure you want to leave this competition before it starts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'competitions', competition.id), {
                participants: arrayRemove(user.uid),
              });
              navigation.navigate('ActiveCompetitions');
            } catch (error) {
              Alert.alert('Error', 'Failed to leave competition');
            }
          },
        },
      ]
    );
  };

  // Handle end competition (owner only)
  const handleEndCompetition = () => {
    Alert.alert(
      'End Competition',
      'Are you sure you want to end this competition? This will:\n\n• Cancel the competition permanently\n• Remove all participants\n• Decline all pending invitations\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Competition',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update competition to cancelled status
              await updateDoc(doc(db, 'competitions', competition.id), {
                status: 'cancelled',
                participants: [],
                pendingParticipants: [],
                cancelledAt: serverTimestamp(),
                cancelledBy: user.uid,
              });
              
              Alert.alert('Competition Ended', 'The competition has been cancelled.', [
                { text: 'OK', onPress: () => navigation.navigate('ActiveCompetitions') }
              ]);
            } catch (error) {
              console.error('Error ending competition:', error);
              Alert.alert('Error', 'Failed to end competition. Please try again.');
            }
          },
        },
      ]
    );
  };

  const isOwner = competition.ownerId === user?.uid;

  return (
    <View style={styles.container}>
      <Header 
        title="Competition Lobby" 
        showBackButton={true} 
        onBackPress={() => {
          // Try to go back, but fallback to ActiveCompetitions if can't
          if (navigation.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('ActiveCompetitions');
          }
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#A4D65E']}
            tintColor="#A4D65E"
          />
        }
      >
        {/* Competition Title Card */}
        <View style={styles.titleCard}>
          <Text style={styles.competitionName}>{competition.name}</Text>
          <Text style={styles.competitionDescription}>{competition.description}</Text>
        </View>

        {/* Competition Status Warning */}
        {hasCompetitionStarted() && !allInvitationsResolved() && (
          <View style={[
            styles.warningCard,
            isInGracePeriod() ? styles.gracePeriodCard : null
          ]}>
            <View style={styles.warningHeader}>
              <Ionicons 
                name={isInGracePeriod() ? "timer-outline" : "warning"} 
                size={24} 
                color={isInGracePeriod() ? "#007AFF" : "#FFA500"} 
              />
              <Text style={[
                styles.warningTitle,
                isInGracePeriod() ? styles.gracePeriodTitle : null
              ]}>
                {isInGracePeriod() 
                  ? "Grace Period Active" 
                  : "Waiting for Participants"}
              </Text>
            </View>
            
            <Text style={[
              styles.warningText,
              isInGracePeriod() ? styles.gracePeriodText : null
            ]}>
              {isInGracePeriod() 
                ? `Participants have ${formatGracePeriodRemaining()} to respond. After this time, pending invitations will be automatically declined and the competition will start.`
                : "The competition cannot start until all participants respond to their invitations."}
            </Text>
            
            <View style={styles.warningStats}>
              <Text style={[
                styles.warningSubtext,
                isInGracePeriod() ? styles.gracePeriodSubtext : null
              ]}>
                {pendingParticipants.length} pending • {participants.length} accepted
              </Text>
            </View>
          </View>
        )}

        {/* Countdown Timer */}
        <View style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <Ionicons 
              name={hasCompetitionStarted() && !allInvitationsResolved() ? "time" : "hourglass"} 
              size={24} 
              color={hasCompetitionStarted() && !allInvitationsResolved() ? "#FFA500" : "#A4D65E"} 
            />
            <Text style={styles.countdownLabel}>
              {hasCompetitionStarted() && !allInvitationsResolved() 
                ? "Competition Status" 
                : "Competition Starts In"}
            </Text>
          </View>
          <Text style={[
            styles.countdownTimer,
            hasCompetitionStarted() && !allInvitationsResolved() && styles.countdownTimerWaiting
          ]}>
            {countdownTimer}
          </Text>
        </View>

        {/* Competition Dates */}
        <View style={styles.datesCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Ionicons name="play-circle" size={20} color="#4CAF50" />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Start</Text>
                <Text style={styles.dateValue}>{formatDateTime(competition.startDate)}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.dateDivider} />
          
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Ionicons name="stop-circle" size={20} color="#FF6B6B" />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>End</Text>
                <Text style={styles.dateValue}>{formatDateTime(competition.endDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rules Dropdown */}
        <TouchableOpacity
          style={styles.rulesDropdown}
          onPress={() => setRulesExpanded(!rulesExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.rulesDropdownHeader}>
            <View style={styles.rulesDropdownTitle}>
              <Ionicons name="document-text" size={20} color="#A4D65E" />
              <Text style={styles.rulesDropdownText}>Competition Rules</Text>
            </View>
            <Ionicons 
              name={rulesExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </View>
        </TouchableOpacity>

        {rulesExpanded && (
          <View style={styles.rulesContent}>
            {/* Daily Cap */}
            {competition.dailyCap && (
              <View style={styles.ruleItem}>
                <View style={styles.ruleIcon}>
                  <Ionicons name="speedometer" size={20} color="#FF9800" />
                </View>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleTitle}>Daily Point Limit</Text>
                  <Text style={styles.ruleValue}>{competition.dailyCap} points per day</Text>
                </View>
              </View>
            )}

            {/* Activity Rules */}
            <View style={styles.activitiesSection}>
              <Text style={styles.activitiesSectionTitle}>Activity Scoring</Text>
              {competition.rules?.map((rule, index) => (
                <View key={index} style={styles.activityRule}>
                  <Ionicons name="fitness" size={18} color="#A4D65E" />
                  <View style={styles.activityRuleInfo}>
                    <Text style={styles.activityType}>{rule.type}</Text>
                    <Text style={styles.activityScoring}>
                      {rule.unitsPerPoint} {rule.unit.toLowerCase()} = {rule.pointsPerUnit} point{rule.pointsPerUnit !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Participants Section */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>
            Participants ({participants.length} joined, {pendingParticipants.length} pending)
          </Text>
          
          {/* Accepted Participants */}
          <View style={styles.participantsList}>
            {participants.map((participant) => (
              <View key={participant.id} style={styles.participantCard}>
                <View style={styles.participantInfo}>
                  <Ionicons name="person-circle" size={36} color="#A4D65E" />
                  <View style={styles.participantText}>
                    <Text style={styles.participantName}>
                      {participant.username}
                      {participant.id === competition.ownerId && (
                        <Text style={styles.ownerBadge}> (Host)</Text>
                      )}
                      {participant.id === user?.uid && (
                        <Text style={styles.youBadge}> (You)</Text>
                      )}
                    </Text>
                    <Text style={styles.participantStatus}>Ready to compete</Text>
                  </View>
                </View>
                <View style={styles.statusIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                </View>
              </View>
            ))}

            {/* Pending Participants */}
            {pendingParticipants.map((participant) => (
              <View key={participant.id} style={[styles.participantCard, styles.pendingCard]}>
                <View style={styles.participantInfo}>
                  <Ionicons name="person-circle-outline" size={36} color="#999" />
                  <View style={styles.participantText}>
                    <Text style={[styles.participantName, styles.pendingName]}>
                      {participant.username}
                    </Text>
                    <Text style={[
                      styles.pendingStatus,
                      isInGracePeriod() ? styles.gracePeriodStatus : null
                    ]}>
                      {(() => {
                        if (!hasCompetitionStarted()) return 'Invitation pending';
                        if (isInGracePeriod()) return `⏱️ ${formatGracePeriodRemaining()} to respond`;
                        return '⚠️ Response required';
                      })()}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusIndicator}>
                  <Ionicons name="time" size={24} color="#FFA500" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* End Competition Button - Only for Owner */}
        {isOwner && (
          <TouchableOpacity 
            style={styles.endCompetitionButton}
            onPress={handleEndCompetition}
          >
            <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
            <Text style={styles.endCompetitionButtonText}>End Competition</Text>
          </TouchableOpacity>
        )}

        {/* Leave Competition Button */}
        {!isOwner && (
          <TouchableOpacity 
            style={styles.leaveButton}
            onPress={handleLeaveCompetition}
          >
            <Ionicons name="exit-outline" size={20} color="#FF6B6B" />
            <Text style={styles.leaveButtonText}>Leave Competition</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  
  // Title Card
  titleCard: {
    backgroundColor: '#1A1E23',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  competitionName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginBottom: 8,
  },
  competitionDescription: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 22,
  },
  
  // Warning Card
  warningCard: {
    backgroundColor: '#FFF9E6',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFA500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFA500',
    marginTop: 4,
  },
  
  // Grace Period Styles
  gracePeriodCard: {
    backgroundColor: '#E8F4FF',
    borderColor: '#007AFF',
  },
  gracePeriodTitle: {
    color: '#007AFF',
    fontWeight: '600',
  },
  gracePeriodText: {
    color: '#333',
    lineHeight: 20,
  },
  gracePeriodSubtext: {
    color: '#007AFF',
    fontWeight: '500',
  },
  gracePeriodStatus: {
    color: '#007AFF',
    fontWeight: '500',
  },
  warningStats: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Countdown Card
  countdownCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  countdownTimer: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  countdownTimerWaiting: {
    fontSize: 18,
    color: '#FFA500',
  },
  
  // Dates Card
  datesCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateRow: {
    paddingVertical: 4,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInfo: {
    marginLeft: 12,
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
  },
  dateValue: {
    fontSize: 15,
    color: '#1A1E23',
    fontWeight: '500',
    marginTop: 2,
  },
  dateDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  
  // Rules Dropdown
  rulesDropdown: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rulesDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rulesDropdownTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rulesDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginLeft: 8,
  },
  rulesContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF2E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  ruleTitle: {
    fontSize: 14,
    color: '#666',
  },
  ruleValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  activitiesSection: {
    marginTop: 4,
  },
  activitiesSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 12,
  },
  activityRule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  activityRuleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  activityType: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1E23',
  },
  activityScoring: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  
  // Participants Section
  participantsSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 12,
  },
  participantsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pendingCard: {
    backgroundColor: '#FAFAFA',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantText: {
    marginLeft: 12,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1E23',
  },
  pendingName: {
    color: '#999',
  },
  participantStatus: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 2,
  },
  pendingStatus: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  ownerBadge: {
    color: '#FF9800',
    fontWeight: '600',
  },
  youBadge: {
    color: '#A4D65E',
    fontWeight: '600',
  },
  statusIndicator: {
    marginLeft: 8,
  },
  
  // Leave Button
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2F2',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 8,
  },
  
  // End Competition Button
  endCompetitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE5E5',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  endCompetitionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
});