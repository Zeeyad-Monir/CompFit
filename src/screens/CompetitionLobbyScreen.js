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
  ActivityIndicator,
  Image,
} from 'react-native';
import { Header } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOTTOM_SPACING, COMPETITION_LOBBY_BOTTOM_SPACING } from '../styles/globalStyles';

export default function CompetitionLobbyScreen({ route, navigation }) {
  const { competition: initialCompetition, skipLobby, isPendingInvite } = route.params;
  const { user } = useContext(AuthContext);
  
  const [competition, setCompetition] = useState(initialCompetition);
  const [participants, setParticipants] = useState([]);
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState('');
  const [showTransitionState, setShowTransitionState] = useState(false);
  const [hasEnteredCompetition, setHasEnteredCompetition] = useState(false);
  const [checkingTransitionState, setCheckingTransitionState] = useState(skipLobby ? true : false);

  // Check if user has already seen the transition for this competition
  useEffect(() => {
    const checkHasEntered = async () => {
      if (!competition?.id || !user?.uid) return;
      
      // Only set checking state if we're potentially showing transition
      if (skipLobby) {
        setCheckingTransitionState(true);
      }
      
      const key = `competition_entered_${competition.id}_${user.uid}`;
      try {
        const hasEntered = await AsyncStorage.getItem(key);
        if (hasEntered === 'true') {
          setHasEnteredCompetition(true);
          
          // If navigating directly to an active competition, skip to CompetitionDetails
          if (skipLobby) {
            navigation.replace('CompetitionDetails', { competition });
            return; // Exit early
          }
        } else {
          // Check if we should show transition immediately
          const now = new Date();
          const startDate = new Date(competition.startDate);
          const hasStarted = now >= startDate;
          const pending = competition.pendingParticipants || [];
          
          // If competition started and no pending users, show transition
          if (hasStarted && (pending.length === 0 || competition.gracePeriodHandled) && skipLobby) {
            setShowTransitionState(true);
            setCountdownTimer('Competition Live!');
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking transition state:', error);
      } finally {
        setCheckingTransitionState(false); // Always clear checking state
      }
    };
    
    checkHasEntered();
  }, [competition?.id, user?.uid, skipLobby]);

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
    
    // If grace period is disabled, no grace period exists
    if (competition?.invitationGracePeriod === false) return false;
    
    const now = new Date();
    const gracePeriodEnd = getGracePeriodEndTime();
    return gracePeriodEnd && now < gracePeriodEnd;
  };

  // Check if grace period has expired
  const hasGracePeriodExpired = () => {
    if (!hasCompetitionStarted()) return false;
    
    // If grace period is disabled, it's immediately "expired" when competition starts
    if (competition?.invitationGracePeriod === false) return true;
    
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
      if (!competition?.gracePeriodHandled && !hasEnteredCompetition && !checkingTransitionState) {
        setShowTransitionState(true);
        setCountdownTimer('Competition Live!');
      }
      return;
    }
    
    // In grace period - show countdown (only if grace period is enabled)
    if (isInGracePeriod()) {
      const remaining = formatGracePeriodRemaining();
      setCountdownTimer(`Grace period: ${remaining}`);
      return;
    }
    
    // Grace period expired or disabled - initiate auto-removal
    if (hasGracePeriodExpired()) {
      // If grace period is disabled, show different message
      const message = competition?.invitationGracePeriod === false 
        ? 'No grace period - removing pending invites...'
        : 'Starting competition...';
        
      if (competition.ownerId === user?.uid && !competition.gracePeriodHandled) {
        setCountdownTimer(message);
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
    
    // Don't set up countdown while checking transition state
    if (checkingTransitionState && skipLobby) {
      return;
    }
    
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
              if (!hasEnteredCompetition && !checkingTransitionState) {
                setShowTransitionState(true);
                setCountdownTimer('Competition Live!');
              }
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
  }, [competition?.id, checkingTransitionState, skipLobby]);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Data will refresh via the listener
  };

  // Handle accept invitation
  const handleAcceptInvite = async () => {
    try {
      await updateDoc(doc(db, 'competitions', competition.id), {
        participants: arrayUnion(user.uid),
        pendingParticipants: arrayRemove(user.uid),
      });
      Alert.alert('Success', 'You have joined the competition!', [
        { text: 'OK', onPress: () => navigation.navigate('ActiveCompetitions') }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation');
      console.error(error);
    }
  };

  // Handle decline invitation
  const handleDeclineInvite = () => {
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
              await updateDoc(doc(db, 'competitions', competition.id), {
                pendingParticipants: arrayRemove(user.uid),
              });
              Alert.alert('Success', 'Invitation declined', [
                { text: 'OK', onPress: () => navigation.navigate('ActiveCompetitions') }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to decline invitation');
              console.error(error);
            }
          },
        },
      ]
    );
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

  // Handle entering the competition after transition
  const handleEnterCompetition = async () => {
    try {
      // Save that user has seen the transition for this competition
      const key = `competition_entered_${competition.id}_${user.uid}`;
      await AsyncStorage.setItem(key, 'true');
      setHasEnteredCompetition(true);
      navigation.replace('CompetitionDetails', { competition });
    } catch (error) {
      console.error('Error saving transition state:', error);
      // Still navigate even if saving fails
      navigation.replace('CompetitionDetails', { competition });
    }
  };

  const isOwner = competition.ownerId === user?.uid;

  // If we're checking transition state and might skip, don't show anything to prevent flash
  if (checkingTransitionState && skipLobby) {
    return null; // Return nothing to prevent flash
  }

  return (
    <View style={styles.container}>
      <Header 
        title="" 
        backgroundColor="#FFFFFF"
      />
      <StatusBar style="dark" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#A4D65E']}
            tintColor="#A4D65E"
          />
        }
      >
        {!showTransitionState ? (
          <>
            {/* Back Button */}
            <View style={styles.backButtonContainer}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={20} color="#A4D65E" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            </View>

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
            {competition.dailyCap > 0 && (
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

            {/* Leaderboard Update Frequency */}
            {competition.leaderboardUpdateDays > 0 && (
              <View style={styles.ruleItem}>
                <View style={styles.ruleIcon}>
                  <Ionicons name="eye-off" size={20} color="#3B82F6" />
                </View>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleTitle}>Leaderboard Updates</Text>
                  <Text style={styles.ruleValue}>
                    Scores revealed every {competition.leaderboardUpdateDays} day{competition.leaderboardUpdateDays > 1 ? 's' : ''}
                  </Text>
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
                    {/* Display activity limits if any exist */}
                    {(rule.maxSubmissionsPerDay || 
                      rule.maxPointsPerWeek || 
                      rule.perSubmissionCap ||
                      (rule.minPace !== null && rule.minPace !== undefined)) && (
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
                        {(rule.minPace !== null && rule.minPace !== undefined) && (
                          <Text style={styles.activityLimit}>
                            • Min pace: {rule.minPace} {rule.paceUnit || 'min/km'}
                          </Text>
                        )}
                      </View>
                    )}
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
                  <View style={styles.participantAvatar}>
                    {participant.profilePicture ? (
                      <Image 
                        source={{ uri: participant.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person-circle" size={36} color="#A4D65E" />
                    )}
                  </View>
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
                  <View style={[styles.participantAvatar, styles.pendingAvatar]}>
                    {participant.profilePicture ? (
                      <Image 
                        source={{ uri: participant.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person-circle-outline" size={36} color="#999" />
                    )}
                  </View>
                  <View style={styles.participantText}>
                    <Text style={[styles.participantName, styles.pendingName]}>
                      {participant.username}
                    </Text>
                    <Text style={[
                      styles.pendingStatus,
                      isInGracePeriod() ? styles.gracePeriodStatus : null
                    ]}>
                      {(() => {
                        if (!hasCompetitionStarted()) {
                          // Before competition starts
                          return competition?.invitationGracePeriod === false 
                            ? 'Must accept before start' 
                            : 'Invitation pending';
                        }
                        if (isInGracePeriod()) return `${formatGracePeriodRemaining()} to respond`;
                        return 'Response required';
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

        {/* Accept/Decline Buttons - Only for pending invites */}
        {isPendingInvite && (
          <View style={styles.inviteActionContainer}>
            <TouchableOpacity 
              style={styles.acceptInviteButton}
              onPress={handleAcceptInvite}
            >
              <Ionicons name="checkmark-circle" size={20} color="#1A1E23" />
              <Text style={styles.acceptInviteButtonText}>Accept Invitation</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.declineInviteButton}
              onPress={handleDeclineInvite}
            >
              <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
              <Text style={styles.declineInviteButtonText}>Decline Invitation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* End Competition Button - Only for Owner */}
        {isOwner && !isPendingInvite && (
          <TouchableOpacity 
            style={styles.endCompetitionButton}
            onPress={handleEndCompetition}
          >
            <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
            <Text style={styles.endCompetitionButtonText}>End Competition</Text>
          </TouchableOpacity>
        )}

        {/* Leave Competition Button */}
        {!isOwner && !isPendingInvite && (
          <TouchableOpacity 
            style={styles.leaveButton}
            onPress={handleLeaveCompetition}
          >
            <Ionicons name="exit-outline" size={20} color="#FF6B6B" />
            <Text style={styles.leaveButtonText}>Leave Competition</Text>
          </TouchableOpacity>
        )}
          </>
        ) : (
          <>
            {/* Back Button */}
            <View style={styles.backButtonContainer}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={20} color="#A4D65E" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            </View>

            {/* Competition Live Transition Screen */}
            <View style={styles.liveHeader}>
              <Ionicons name="rocket" size={32} color="#A4D65E" />
              <Text style={styles.liveTitle}>Competition is Live!</Text>
              <Text style={styles.liveSubtitle}>All participants are confirmed</Text>
            </View>
            {/* Competition Details Card */}
            <View style={styles.titleCard}>
              <Text style={styles.competitionName}>{competition.name}</Text>
              <Text style={styles.competitionDescription}>{competition.description}</Text>
            </View>

            {/* Confirmed Participants Section */}
            <View style={styles.confirmedSection}>
              <Text style={styles.sectionTitle}>
                Confirmed Participants ({participants.length})
              </Text>
              <View style={styles.participantsList}>
                {participants.map((participant) => (
                  <View key={participant.id} style={styles.participantCard}>
                    <View style={styles.participantInfo}>
                      <View style={styles.participantAvatar}>
                        {participant.profilePicture ? (
                          <Image 
                            source={{ uri: participant.profilePicture }}
                            style={styles.participantAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons name="person-circle" size={36} color="#A4D65E" />
                        )}
                      </View>
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
              </View>
            </View>

            {/* Competition Rules Summary */}
            <View style={styles.rulesSection}>
              <Text style={styles.rulesSectionTitle}>Competition Rules</Text>
              <View style={styles.rulesSectionContent}>
                {/* Daily Cap */}
                {competition.dailyCap > 0 && (
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
                
                {/* Leaderboard Updates */}
                {competition.leaderboardUpdateDays > 0 && (
                  <View style={styles.ruleItem}>
                    <View style={styles.ruleIcon}>
                      <Ionicons name="eye-off" size={20} color="#3B82F6" />
                    </View>
                    <View style={styles.ruleInfo}>
                      <Text style={styles.ruleTitle}>Leaderboard Updates</Text>
                      <Text style={styles.ruleValue}>
                        Every {competition.leaderboardUpdateDays} day{competition.leaderboardUpdateDays > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                )}
                
                {/* Activity Scoring */}
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
                        {/* Display activity limits if any exist */}
                        {(rule.maxSubmissionsPerDay || 
                          rule.maxPointsPerWeek || 
                          rule.perSubmissionCap ||
                          (rule.minPace !== null && rule.minPace !== undefined)) && (
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
                            {(rule.minPace !== null && rule.minPace !== undefined) && (
                              <Text style={styles.activityLimit}>
                                • Min pace: {rule.minPace} {rule.paceUnit || 'min/km'}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Enter Competition Button */}
            <TouchableOpacity 
              style={styles.enterCompetitionButton}
              onPress={handleEnterCompetition}
            >
              <Text style={styles.enterButtonText}>Enter Competition</Text>
              <Ionicons name="arrow-forward" size={24} color="#1A1E23" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: COMPETITION_LOBBY_BOTTOM_SPACING,
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
    textAlign: 'center',
    marginBottom: 8,
  },
  competitionDescription: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 22,
  },
  
  // Back Button
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#A4D65E',
    marginLeft: 4,
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
    marginBottom: 24,
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
  activityPace: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
    fontStyle: 'italic',
  },
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
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  pendingAvatar: {
    opacity: 0.7,
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
    marginBottom: 0,
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
    marginBottom: 0,
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
  
  // Invitation Action Buttons
  inviteActionContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  acceptInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A4D65E',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptInviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginLeft: 8,
  },
  declineInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  declineInviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  
  // Live Competition Transition Styles
  liveHeader: {
    backgroundColor: '#1A1E23',
    padding: 30,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  liveTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginTop: 12,
  },
  liveSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 8,
  },
  confirmedSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rulesSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rulesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 16,
  },
  rulesSectionContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  enterCompetitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A4D65E',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 0,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  enterButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
