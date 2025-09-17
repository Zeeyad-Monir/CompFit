import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useOnboarding } from '../components/onboarding/OnboardingController';
import onboardingService from '../services/onboardingService';

// Import new stats components
import AnimatedProgressRing from '../components/stats/AnimatedProgressRing';
import AchievementBadges from '../components/stats/AchievementBadges';
import GlassmorphicStatCard from '../components/stats/GlassmorphicStatCard';
import PerformanceTrend from '../components/stats/PerformanceTrend';
import CompetitiveRank from '../components/stats/CompetitiveRank';
import { 
  calculateBPR, 
  calculateFriendsRankings,
  transformCompetitionData 
} from '../utils/bprCalculation';

const screenWidth = Dimensions.get('window').width;

// Color tokens for the new design (matching ActiveCompetitionsScreen)
const colors = {
  nav: {
    activeGreen: '#B6DB78',  // New fresh green
    inactiveGray: '#B3B3B3', // New gray
    textDefault: '#111111'
  },
  background: '#FFFFFF'      // Pure white
};

export default function ProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { startOnboarding } = useOnboarding();

  // Tab state - check if we should open friends tab from navigation params
  const initialTab = route?.params?.tab === 'friends' ? 'friends' : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [measurementsReady, setMeasurementsReady] = useState(false);
  
  // Base width for the underline
  const baseUnderlineWidth = 60;
  
  // Calculate initial centered positions for tabs (2 columns)
  const calculateInitialTabX = (tabIndex) => {
    const columnWidth = (screenWidth - 48) / 2;  // 2 equal columns
    const columnCenter = columnWidth * tabIndex + columnWidth / 2;
    return columnCenter - baseUnderlineWidth / 2;
  };
  
  // Tab measurements for underline positioning
  const [tabMeasurements, setTabMeasurements] = useState({
    profile: { scale: 1.2, x: calculateInitialTabX(0) },
    friends: { scale: 1.2, x: calculateInitialTabX(1) }
  });

  // Animation refs for underline and press feedback
  const underlinePosition = React.useRef(new Animated.Value(calculateInitialTabX(initialTab === 'friends' ? 1 : 0))).current;
  const underlineScale = React.useRef(new Animated.Value(1.2)).current;
  const profileScale = React.useRef(new Animated.Value(1)).current;
  const friendsScale = React.useRef(new Animated.Value(1)).current;

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
        useNativeDriver: true,
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
    underlineScale.setValue(1.2);
  }, []);
  
  // Update tab when navigation params change
  useEffect(() => {
    if (route?.params?.tab === 'friends') {
      animateToTab('friends');
    }
  }, [route?.params?.tab]);

  // Profile state - with wins/losses that are READ-ONLY from Firestore
  const [profile, setProfile] = useState({
    username: '',
    handle: '',
    favouriteWorkout: '',
    wins: 0,
    losses: 0,
    totals: 0,
    friends: [],
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  // Friends state
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  
  // New state for competition stats
  const [currentStreak, setCurrentStreak] = useState(0);
  const [recentCompetitions, setRecentCompetitions] = useState([]);
  const [globalRank, setGlobalRank] = useState(null);
  
  // Friends ranking state for BPR
  const [friendsRankingData, setFriendsRankingData] = useState({
    friendsRank: null,
    totalFriends: 0,
    friendsPercentile: null,
    bprScore: null,
    isProvisional: true,
    friendsRankingList: []
  });

  /* ----- Real-time profile subscription with wins/losses ----- */
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);

    const unsub = onSnapshot(ref, 
      snap => {
        if (snap.exists()) {
          const userData = snap.data();
          setProfile({
            username: userData.username || '',
            handle: userData.handle || '',
            favouriteWorkout: userData.favouriteWorkout || '',
            wins: userData.wins || 0,
            losses: userData.losses || 0,
            totals: userData.totals || 0,
            friends: userData.friends || [],
            lastUpdated: userData.lastUpdated,
          });
          
          // Fetch friend details when friends array changes
          if (userData.friends?.length > 0) {
            fetchFriendsDetails(userData.friends);
          } else {
            setFriendsList([]);
          }
        } else {
          // Create initial user profile without wins/losses (backend will manage those)
          const initialData = {
            username: user.displayName || user.email.split('@')[0],
            handle: (user.displayName || user.email.split('@')[0]).replace(/\s+/g, '').toLowerCase(),
            favouriteWorkout: '',
            wins: 0,
            losses: 0,
            totals: 0,
            friends: [],
          };
          setDoc(ref, initialData)
            .then(() => console.log('User profile created'))
            .catch(error => console.error('Error creating user profile:', error));
        }
        setLoading(false);
      },
      error => {
        console.error('Error in profile subscription:', error);
        setLoading(false);
      }
    );

    // Monitor friend requests for removal notifications
    const requestsRef = collection(db, 'users', user.uid, 'friendRequests');
    const requestsUnsub = onSnapshot(requestsRef, 
      async (snapshot) => {
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();
          
          // Handle friend removal notifications
          if (requestData.type === 'friend_removed') {
            try {
              // Update the local profile state
              setProfile(prev => ({
                ...prev,
                friends: prev.friends.filter(id => id !== requestData.fromUserId)
              }));
              
              // Update in Firestore
              await updateDoc(doc(db, 'users', user.uid), {
                friends: arrayRemove(requestData.fromUserId),
              });
              
              // Delete the processed notification
              await deleteDoc(docSnap.ref);
            } catch (error) {
              console.error('Error processing friend removal:', error);
            }
          }
        }
      }
    );

    return () => {
      unsub();
      requestsUnsub();
    };
  }, [user]);

  /* ----- Friend requests subscription ----- */
  useEffect(() => {
    if (!user) return;
    
    const requestsRef = collection(db, 'users', user.uid, 'friendRequests');
    const unsub = onSnapshot(requestsRef, 
      async (snapshot) => {
        const requests = [];
        
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();
          
          // Skip friend removal notifications
          if (requestData.type === 'friend_removed') {
            continue;
          }
          
          // If this is an accepted request, automatically add to friends
          if (requestData.accepted) {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                friends: arrayUnion(requestData.fromUserId),
              });
              // Delete the processed request
              await deleteDoc(docSnap.ref);
              continue;
            } catch (error) {
              console.error('Error processing accepted request:', error);
            }
          }
          
          // Fetch sender's details for regular requests
          try {
            const senderDoc = await getDoc(doc(db, 'users', requestData.fromUserId));
            if (senderDoc.exists()) {
              requests.push({
                id: docSnap.id,
                ...requestData,
                senderData: senderDoc.data(),
              });
            }
          } catch (error) {
            console.error('Error fetching sender data:', error);
          }
        }
        
        setPendingRequests(requests);
      },
      error => {
        console.error('Error in friend requests subscription:', error);
      }
    );

    return unsub;
  }, [user]);

  /* ----- Sent requests subscription ----- */
  useEffect(() => {
    if (!user) return;
    
    const sentRequestsRef = collection(db, 'users', user.uid, 'sentRequests');
    const unsub = onSnapshot(sentRequestsRef, 
      async (snapshot) => {
        const requests = [];
        
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();
          
          try {
            const recipientDoc = await getDoc(doc(db, 'users', requestData.toUserId));
            if (recipientDoc.exists()) {
              const recipientData = recipientDoc.data();
              
              // Check if we're already friends
              if (profile.friends?.includes(requestData.toUserId)) {
                // Clean up the sent request
                await deleteDoc(docSnap.ref);
                continue;
              }
              
              requests.push({
                id: docSnap.id,
                ...requestData,
                recipientData: recipientData,
              });
            } else {
              // Recipient doesn't exist, clean up
              await deleteDoc(docSnap.ref);
            }
          } catch (error) {
            console.error('Error fetching recipient data:', error);
          }
        }
        
        setSentRequests(requests);
      },
      error => {
        console.error('Error in sent requests subscription:', error);
      }
    );

    return unsub;
  }, [user, profile.friends]);

  /* ----- Fetch friends details ----- */
  const fetchFriendsDetails = async (friendIds) => {
    if (!friendIds || friendIds.length === 0) {
      setFriendsList([]);
      return;
    }

    setLoadingFriends(true);
    try {
      const friendsData = [];
      for (const friendId of friendIds) {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          friendsData.push({
            id: friendId,
            ...friendDoc.data(),
          });
        }
      }
      setFriendsList(friendsData);
    } catch (error) {
      console.error('Error fetching friends details:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  /* ----- Profile edit handlers (only for favouriteWorkout) ----- */
  const startEdit = () => { 
    setDraft({ favouriteWorkout: profile.favouriteWorkout }); 
    setEditing(true); 
  };
  
  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    try {
      const ref = doc(db, 'users', user.uid);
      // Only update favourite workout - wins/losses are backend-managed
      await updateDoc(ref, {
        favouriteWorkout: draft.favouriteWorkout || ''
      });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => signOut(auth) }
      ]
    );
  };

  const handleViewTutorial = () => {
    Alert.alert(
      'View Tutorial',
      'Would you like to view the onboarding tutorial again?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Tutorial', 
          onPress: async () => {
            // Reset the user's onboarding status in Firestore
            if (user?.uid) {
              await onboardingService.resetOnboarding(user.uid);
            }
            // Force start onboarding, bypassing completion check
            startOnboarding(true);
          }
        }
      ]
    );
  };

  /* ----- Friends handlers ----- */
  const findUserByUsername = async (username) => {
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) return null;

    try {
      // Check username in usernames collection
      const usernameDoc = await getDoc(doc(db, 'usernames', trimmedUsername));
      
      if (!usernameDoc.exists()) {
        return null;
      }
      
      const { uid } = usernameDoc.data();
      
      // Fetch full user profile
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      return {
        id: uid,
        ...userDoc.data(),
      };
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  };

  const sendFriendRequest = async () => {
    const username = friendUsername.trim();
    if (!username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (username.toLowerCase() === profile.username.toLowerCase()) {
      Alert.alert('Error', "You can't send a friend request to yourself");
      return;
    }

    try {
      const targetUser = await findUserByUsername(username);
      if (!targetUser) {
        Alert.alert('User Not Found', `No user found with username "${username}"`);
        return;
      }

      // Check if already friends
      if (profile.friends?.includes(targetUser.id)) {
        Alert.alert('Already Friends', `You are already friends with ${targetUser.username}`);
        return;
      }

      // Check if request already sent
      let requestAlreadySent = false;
      try {
        const sentRequestsSnapshot = await getDocs(collection(db, 'users', user.uid, 'sentRequests'));
        requestAlreadySent = sentRequestsSnapshot.docs.some(doc => 
          doc.data().toUserId === targetUser.id
        );
      } catch (error) {
        console.log('Error checking sent requests:', error);
      }
      
      if (requestAlreadySent) {
        Alert.alert('Request Already Sent', `You have already sent a friend request to ${targetUser.username}`);
        return;
      }

      // Send friend request
      const friendRequestData = {
        fromUserId: user.uid,
        fromUsername: profile.username,
        timestamp: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'users', targetUser.id, 'friendRequests'), friendRequestData);

      // Store sent request
      const sentRequestData = {
        toUserId: targetUser.id,
        toUsername: targetUser.username,
        fromUserId: user.uid,
        timestamp: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'users', user.uid, 'sentRequests'), sentRequestData);

      setFriendUsername('');
      Alert.alert('Success', `Friend request sent to ${targetUser.username}!`);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const acceptFriendRequest = async (request) => {
    try {
      // Add to friends
      const myRef = doc(db, 'users', user.uid);
      await updateDoc(myRef, {
        friends: arrayUnion(request.fromUserId),
      });

      // Delete the request
      await deleteDoc(doc(db, 'users', user.uid, 'friendRequests', request.id));

      // Create reciprocal accepted request
      try {
        await addDoc(collection(db, 'users', request.fromUserId, 'friendRequests'), {
          fromUserId: user.uid,
          fromUsername: profile.username,
          timestamp: serverTimestamp(),
          accepted: true,
        });
      } catch (error) {
        console.log('Could not create reciprocal request:', error);
      }

      Alert.alert('Success', `You are now friends with ${request.senderData.username}!`);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.');
    }
  };

  const rejectFriendRequest = async (request) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'friendRequests', request.id));
      Alert.alert('Request Declined', `Friend request from ${request.senderData.username} has been declined.`);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', 'Failed to reject friend request. Please try again.');
    }
  };

  const cancelSentRequest = async (request) => {
    Alert.alert(
      'Cancel Request',
      `Are you sure you want to cancel your friend request to ${request.recipientData.username}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'sentRequests', request.id));
              Alert.alert('Request Cancelled', `Friend request to ${request.recipientData.username} has been cancelled.`);
            } catch (error) {
              console.error('Error cancelling sent request:', error);
              Alert.alert('Error', 'Failed to cancel friend request. Please try again.');
            }
          },
        },
      ]
    );
  };

  const removeFriend = (friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from friends list
              const myRef = doc(db, 'users', user.uid);
              await updateDoc(myRef, {
                friends: arrayRemove(friend.id),
              });

              // Notify friend of removal
              try {
                await addDoc(collection(db, 'users', friend.id, 'friendRequests'), {
                  fromUserId: user.uid,
                  fromUsername: profile.username,
                  timestamp: serverTimestamp(),
                  type: 'friend_removed',
                });
              } catch (error) {
                console.log('Could not notify friend of removal:', error);
              }

              Alert.alert('Success', `${friend.username} has been removed from your friends.`);
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (profile.friends?.length > 0) {
        await fetchFriendsDetails(profile.friends);
      }
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate win rate
  const getWinRate = () => {
    const total = profile.wins + profile.losses;
    if (total === 0) return 'N/A';
    const rate = (profile.wins / total) * 100;
    return `${Math.round(rate)}%`;
  };

  // Calculate current streak from recent competition results
  const calculateCurrentStreak = () => {
    if (recentCompetitions.length === 0) return 0;
    
    let streak = 0;
    // Count consecutive 1st place finishes from most recent competitions
    for (let i = recentCompetitions.length - 1; i >= 0; i--) {
      if (recentCompetitions[i].position === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  // Fetch recent competitions (real data from Firestore)
  const fetchRecentCompetitions = async () => {
    if (!user?.uid) return;
    
    try {
      // Query completed competitions where user participated
      // Note: May need to create composite index in Firebase Console if not exists
      const competitionsQuery = query(
        collection(db, 'competitions'),
        where('status', '==', 'completed'),
        where('participants', 'array-contains', user.uid),
        orderBy('endDate', 'desc'),  // Use endDate which should always exist
        limit(10)
      );
      
      const snapshot = await getDocs(competitionsQuery);
      const competitions = [];
      
      snapshot.docs.forEach(doc => {
        const comp = doc.data();
        
        // Find user's position from finalRankings - ONLY use real data
        const userRanking = comp.finalRankings?.find(r => r.userId === user.uid);
        
        // Skip this competition if no valid position data exists
        if (!userRanking?.position) {
          console.log(`Skipping competition ${comp.name || doc.id} - no valid position data for user`);
          return;
        }
        
        const position = userRanking.position;
        
        // Position 1 = win, anything else = loss
        const isWin = position === 1;
        
        competitions.push({
          date: comp.completedAt?.toDate ? comp.completedAt.toDate() : new Date(comp.endDate),
          result: isWin ? 'win' : 'loss',
          position: position,
          name: comp.name,
          points: userRanking.points || 0,
          fieldSize: comp.finalRankings?.length || comp.participants?.length || 2 // Add actual field size
        });
      });
      
      // Sort by date (oldest to newest for chart)
      competitions.sort((a, b) => a.date - b.date);
      
      setRecentCompetitions(competitions);
    } catch (error) {
      console.error('Error fetching recent competitions:', error);
      setRecentCompetitions([]);
    }
  };

  // Fetch recent competitions when user changes
  useEffect(() => {
    if (user?.uid) {
      fetchRecentCompetitions();
    }
  }, [user?.uid]);
  
  // Update streak when recent competitions change
  useEffect(() => {
    setCurrentStreak(calculateCurrentStreak());
  }, [recentCompetitions]);
  
  // Calculate friends rankings when competitions or friends list changes
  useEffect(() => {
    if (user?.uid && friendsList.length > 0) {
      calculateFriendsBPRRankings();
    } else if (friendsList.length === 0) {
      // Reset ranking data if no friends
      setFriendsRankingData({
        friendsRank: null,
        totalFriends: 0,
        friendsPercentile: null,
        bprScore: null,
        isProvisional: true,
        friendsRankingList: []
      });
    }
  }, [recentCompetitions, friendsList]);

  // Calculate BPR rankings for user and friends
  const calculateFriendsBPRRankings = async () => {
    if (!user?.uid || friendsList.length === 0) return;
    
    try {
      // Get all friend IDs
      const friendIds = friendsList.map(f => f.id);
      
      // Fetch competitions for all friends
      const friendsCompetitionsData = [];
      
      for (const friendId of friendIds) {
        try {
          // Query completed competitions where friend participated
          const friendCompsQuery = query(
            collection(db, 'competitions'),
            where('status', '==', 'completed'),
            where('participants', 'array-contains', friendId),
            orderBy('endDate', 'desc'),
            limit(40) // BPR MAX_HISTORY
          );
          
          const snapshot = await getDocs(friendCompsQuery);
          const friendComps = [];
          
          snapshot.docs.forEach(doc => {
            const comp = doc.data();
            const transformed = transformCompetitionData([{ ...comp, id: doc.id }], friendId);
            if (transformed.length > 0) {
              friendComps.push(...transformed);
            }
          });
          
          // Calculate BPR for this friend
          const friendBPR = calculateBPR(friendComps);
          
          friendsCompetitionsData.push({
            id: friendId,
            ...friendBPR
          });
        } catch (error) {
          console.log(`Error fetching competitions for friend ${friendId}:`, error);
          // Add default BPR data for friends with errors
          friendsCompetitionsData.push({
            id: friendId,
            bpr: 0.50,
            competitionsCount: 0,
            isProvisional: true,
            weightedAverage: 0.50,
            totalWeight: 0
          });
        }
      }
      
      // Transform user's recent competitions for BPR calculation
      const userCompetitionsForBPR = recentCompetitions.map(comp => ({
        competitionId: comp.name || 'unknown',
        finishRank: comp.position,
        fieldSize: comp.fieldSize || Math.max(comp.position + 1, 2), // Use actual field size when available
        endedAt: comp.date,
        points: comp.points
      }));
      
      // Calculate user's BPR
      const userBPR = calculateBPR(userCompetitionsForBPR);
      
      // Calculate rankings
      const rankings = calculateFriendsRankings(user.uid, userBPR, friendsCompetitionsData);
      
      // Prepare rankings list for display
      const rankingsList = rankings.rankings.map(userRank => ({
        rank: userRank.rank,
        name: userRank.id === user.uid ? 'You' : friendsList.find(f => f.id === userRank.id)?.username || 'Unknown',
        bpr: userRank.bpr,
        isCurrentUser: userRank.id === user.uid
      }));
      
      // Update state with ranking data
      setFriendsRankingData({
        friendsRank: rankings.friendsRank,
        totalFriends: rankings.totalFriends,
        friendsPercentile: rankings.friendsPercentile,
        bprScore: rankings.bprScore,
        isProvisional: rankings.isProvisional,
        friendsRankingList: rankingsList // Add the formatted list
      });
      
    } catch (error) {
      console.error('Error calculating friends BPR rankings:', error);
    }
  };
  
  // Format last updated time
  const getLastUpdatedText = () => {
    if (!profile.lastUpdated) return null;
    
    const date = profile.lastUpdated.toDate ? profile.lastUpdated.toDate() : new Date(profile.lastUpdated);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Updated just now';
    if (diffMins < 60) return `Updated ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `Updated ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return `Updated on ${date.toLocaleDateString()}`;
  };

  if (loading) return null;

  const renderProfileTab = () => (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.scrollViewContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            <Ionicons name="person-circle" size={60} color="#A4D65E" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.username}</Text>
            <Text style={styles.profileUsername}>@{profile.handle}</Text>
          </View>
        </View>
      </View>

      {/* Competition Stats - Revolutionary Design */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Competition Stats</Text>
        
        {/* Hero Win Rate Progress Ring */}
        <AnimatedProgressRing 
          percentage={getWinRate()} 
          wins={profile.wins}
          losses={profile.losses}
        />
        
        {/* Achievement Badges */}
        <AchievementBadges 
          wins={profile.wins}
          losses={profile.losses}
          totals={profile.wins + profile.losses}
          userId={user?.uid}
          currentStreak={currentStreak}
        />
        
        {/* Glassmorphic Stats Cards Grid */}
        <View style={styles.modernStatsGrid}>
          <GlassmorphicStatCard
            icon="trophy"
            iconColor="#F59E0B"
            value={profile.wins}
            label="Victories"
            gradient={['#FEF3C7', '#FDE68A']}
            delay={0}
          />
          <GlassmorphicStatCard
            icon="close-circle"
            iconColor="#EF4444"
            value={profile.losses}
            label="Defeats"
            gradient={['#FEE2E2', '#FECACA']}
            delay={100}
          />
          <GlassmorphicStatCard
            icon="flame"
            iconColor="#F97316"
            value={currentStreak}
            label="Streak"
            gradient={['#FED7AA', '#FDBA74']}
            delay={200}
          />
          <GlassmorphicStatCard
            icon="analytics"
            iconColor="#8B5CF6"
            value={profile.wins + profile.losses}
            label="Total"
            gradient={['#EDE9FE', '#DDD6FE']}
            delay={300}
          />
        </View>
        
        {/* Performance Trend Chart */}
        <PerformanceTrend 
          userId={user?.uid}
          recentMatches={recentCompetitions}
        />
        
        {/* Competitive Rank Display - Friends-based with BPR */}
        <CompetitiveRank
          friendsRank={friendsRankingData.friendsRank}
          totalFriends={friendsRankingData.totalFriends}
          friendsPercentile={friendsRankingData.friendsPercentile}
          bprScore={friendsRankingData.bprScore}
          isProvisional={friendsRankingData.isProvisional}
          friendsRankingList={friendsRankingData.friendsRankingList}
        />
        
        {profile.lastUpdated && (
          <Text style={styles.lastUpdatedText}>{getLastUpdatedText()}</Text>
        )}
      </View>

      {/* About You - Only favourite workout is editable */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.sectionTitle}>About You</Text>
          {!editing && (
            <TouchableOpacity onPress={startEdit}>
              <Ionicons name="pencil" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabelSmall}>Favourite Workout</Text>
            <View style={styles.statValueContainer}>
              {editing ? (
                <TextInput
                  style={[styles.statValue, styles.editableInput]}
                  value={draft.favouriteWorkout}
                  onChangeText={t => setDraft({ ...draft, favouriteWorkout: t })}
                  placeholder="Enter your favourite workout"
                  placeholderTextColor="#999"
                />
              ) : (
                <Text style={styles.statValue}>
                  {profile.favouriteWorkout || 'Not set'}
                </Text>
              )}
              <Ionicons name="fitness" size={24} color="#A4D65E" style={styles.statIcon} />
            </View>
          </View>

          {editing && (
            <View style={styles.editButtons}>
              <TouchableOpacity onPress={cancelEdit} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={[styles.editBtn, styles.saveBtn]}>
                <Text style={[styles.editBtnText, styles.saveBtnText]}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.accountOptions}>
          <TouchableOpacity 
            style={styles.accountOption} 
            onPress={() => navigation.navigate('ChangeCredentials')}
          >
            <View style={styles.accountOptionIcon}>
              <Ionicons name="key" size={24} color="#6B7280" />
            </View>
            <View style={styles.accountOptionContent}>
              <Text style={styles.accountOptionTitle}>Change Password/Email</Text>
              <Text style={styles.accountOptionSubtitle}>Update your account credentials</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {/* View Tutorial Again button */}
          <TouchableOpacity 
            style={styles.accountOption} 
            onPress={handleViewTutorial}
          >
            <View style={styles.accountOptionIcon}>
              <Ionicons name="school" size={24} color="#6B7280" />
            </View>
            <View style={styles.accountOptionContent}>
              <Text style={styles.accountOptionTitle}>View Tutorial Again</Text>
              <Text style={styles.accountOptionSubtitle}>Review the app onboarding guide</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.accountOption, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <View style={styles.accountOptionIcon}>
              <Ionicons name="log-out" size={24} color="#6B7280" />
            </View>
            <View style={styles.accountOptionContent}>
              <Text style={styles.accountOptionTitle}>Log out</Text>
              <Text style={styles.accountOptionSubtitle}>Securely sign off</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderFriendsTab = () => (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.scrollViewContent}
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
      {/* Add Friend Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Friend</Text>
        <View style={styles.addFriendContainer}>
          <Text style={styles.addFriendSubtext}>Search by username to send a friend request</Text>
          <View style={styles.addFriendRow}>
            <TextInput
              style={styles.addFriendInput}
              placeholder="Enter username"
              value={friendUsername}
              onChangeText={setFriendUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={sendFriendRequest} style={styles.addFriendButton}>
              <Ionicons name="person-add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests ({pendingRequests.length})</Text>
          <View style={styles.requestsContainer}>
            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestItem}>
                <View style={styles.requestUserInfo}>
                  <Ionicons name="person-circle" size={40} color="#A4D65E" />
                  <View style={styles.requestUserText}>
                    <Text style={styles.requestUsername}>{request.senderData.username}</Text>
                    <Text style={styles.requestSubtext}>wants to be friends</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton]}
                    onPress={() => acceptFriendRequest(request)}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.rejectButton]}
                    onPress={() => rejectFriendRequest(request)}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sent Requests ({sentRequests.length})</Text>
          <View style={styles.requestsContainer}>
            {sentRequests.map((request) => (
              <View key={request.id} style={styles.requestItem}>
                <View style={styles.requestUserInfo}>
                  <Ionicons name="person-circle" size={40} color="#A4D65E" />
                  <View style={styles.requestUserText}>
                    <Text style={styles.requestUsername}>{request.recipientData.username}</Text>
                    <Text style={styles.requestSubtext}>request pending</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.requestButton, styles.cancelButton]}
                  onPress={() => cancelSentRequest(request)}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Friends List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends ({friendsList.length})</Text>
        {loadingFriends ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading friends...</Text>
          </View>
        ) : friendsList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No friends yet</Text>
            <Text style={styles.emptySubtext}>Add friends to see them here</Text>
          </View>
        ) : (
          <View style={styles.friendsContainer}>
            {friendsList.map((friend) => (
              <View key={friend.id} style={styles.friendItem}>
                <View style={styles.friendUserInfo}>
                  <Ionicons name="person-circle" size={40} color="#A4D65E" />
                  <View style={styles.friendUserText}>
                    <Text style={styles.friendUsername}>{friend.username}</Text>
                    <Text style={styles.friendSubtext}>@{friend.handle}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeFriendButton}
                  onPress={() => removeFriend(friend)}
                >
                  <Ionicons name="person-remove" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
          {/* Tab row with 2 equal columns */}
          <View style={styles.tabRow}>
            {/* Profile Tab */}
            <Animated.View style={[styles.tabColumn, { transform: [{ scale: profileScale }] }]}>
              <TouchableOpacity
                style={styles.tabButton}
                onPressIn={() => handlePressIn(profileScale)}
                onPressOut={() => handlePressOut('profile', profileScale)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  const textWidth = width * 0.8;
                  const indicatorWidth = textWidth + 12;
                  const scale = indicatorWidth / baseUnderlineWidth;
                  const columnCenter = (screenWidth - 48) / 2 * 0 + (screenWidth - 48) / 4;
                  setTabMeasurements(prev => ({
                    ...prev,
                    profile: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                  }));
                  setMeasurementsReady(true);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'profile' }}
              >
                <Text style={[
                  styles.tabLabel,
                  { 
                    color: activeTab === 'profile' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                    fontSize: activeTab === 'profile' ? 23 : 21
                  }
                ]}>
                  Profile
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Friends Tab */}
            <Animated.View style={[styles.tabColumn, { transform: [{ scale: friendsScale }] }]}>
              <TouchableOpacity
                style={styles.tabButton}
                onPressIn={() => handlePressIn(friendsScale)}
                onPressOut={() => handlePressOut('friends', friendsScale)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  const textWidth = width * 0.8;
                  const indicatorWidth = textWidth + 12;
                  const scale = indicatorWidth / baseUnderlineWidth;
                  const columnCenter = (screenWidth - 48) / 2 * 1 + (screenWidth - 48) / 4;
                  setTabMeasurements(prev => ({
                    ...prev,
                    friends: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                  }));
                  setMeasurementsReady(true);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'friends' }}
              >
                <Text style={[
                  styles.tabLabel,
                  { 
                    color: activeTab === 'friends' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                    fontSize: activeTab === 'friends' ? 23 : 21
                  }
                ]}>
                  Friends
                </Text>
                {pendingRequests.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingRequests.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Animated underline indicator */}
          <Animated.View 
            style={[
              styles.underlineIndicator,
              {
                width: baseUnderlineWidth,
                opacity: measurementsReady ? 1 : 0,
                transform: [
                  { translateX: underlinePosition },
                  { scaleX: underlineScale }
                ]
              }
            ]}
          />
        </View>

        {/* Tab Content */}
        {activeTab === 'profile' ? renderProfileTab() : renderFriendsTab()}
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

  // New top navigation styles (matching ActiveCompetitionsScreen)
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
    position: 'relative',
  },

  tabLabel: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  underlineIndicator: {
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.nav.activeGreen,
    marginTop: 1,
  },

  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Common
  scrollView: { flex: 1, paddingHorizontal: 16 },
  scrollViewContent: { paddingBottom: 110 },
  section: { marginTop: 24 },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#1A1E23', 
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { color: '#6B7280', fontSize: 16 },

  // Profile Tab
  profileCard: { 
    backgroundColor: '#A4D65E', 
    borderRadius: 12, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  profileImageContainer: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16 
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#1A1E23' },
  profileUsername: { fontSize: 14, color: '#1A1E23', opacity: 0.8 },
  
  // Modern Stats Grid
  modernStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
  },
  
  // About You
  statsContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  statItem: { marginBottom: 16 },
  statLabelSmall: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  statValueContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '500', color: '#1A1E23', flex: 1 },
  editableInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#A4D65E',
    paddingVertical: 4,
  },
  statIcon: { marginLeft: 8 },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  editBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A4D65E',
  },
  saveBtn: {
    backgroundColor: '#A4D65E',
  },
  editBtnText: { color: '#A4D65E', fontWeight: '600' },
  saveBtnText: { color: '#FFFFFF' },
  
  // Account Options
  accountOptions: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  accountOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  accountOptionIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  accountOptionContent: { flex: 1 },
  accountOptionTitle: { fontSize: 16, fontWeight: '500', color: '#1A1E23' },
  accountOptionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Friends Tab
  addFriendContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  addFriendSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  addFriendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addFriendInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addFriendButton: {
    backgroundColor: '#A4D65E',
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  requestsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestUserText: {
    marginLeft: 12,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1E23',
  },
  requestSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#A4D65E',
  },
  rejectButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },

  friendsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  friendUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendUserText: {
    marginLeft: 12,
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1E23',
  },
  friendSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  removeFriendButton: {
    padding: 8,
  },

  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1E23',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});