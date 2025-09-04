// CompetitionCreationScreen.js - IMPROVED VERSION
// Features dynamic tabs: Presets/Manual initially, then Friends/Rules after preset selection

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Header, Button, FormInput, Dropdown, DatePicker, LeaderboardUpdatePicker } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

// Competition Presets
const competitionPresets = [
  {
    id: 'cardio-challenge',
    name: '7-Day Cardio Challenge',
    description: 'A week-long cardio competition focusing on running, walking, and cycling',
    goal: 'Improve cardiovascular fitness and endurance through consistent cardio activities',
    duration: 7,
    dailyCap: 50,
    icon: 'heart',
    color: '#FF6B6B',
    activities: [
      { type: 'Running', unit: 'Kilometre', pointsPerUnit: 3, unitsPerPoint: 1 },
      { type: 'Walking', unit: 'Kilometre', pointsPerUnit: 1, unitsPerPoint: 1 },
      { type: 'Cycling', unit: 'Kilometre', pointsPerUnit: 1, unitsPerPoint: 2 },
    ],
    summary: 'Perfect for cardio enthusiasts! Earn points for running (3 pts/km), walking (1 pt/km), and cycling (1 pt/2km).',
    tips: [
      'Start with shorter distances and build up gradually',
      'Mix different activities to prevent boredom',
      'Track your heart rate during activities',
      'Stay hydrated and maintain proper form'
    ]
  },
  
  {
    id: 'strength-showdown',
    name: 'Strength Training Showdown',
    description: 'A 10-day strength-focused competition with weightlifting and bodyweight exercises',
    goal: 'Build muscle strength and power through structured resistance training',
    duration: 10,
    dailyCap: 40,
    icon: 'barbell',
    color: '#A4D65E',
    activities: [
      { type: 'Weightlifting', unit: 'Session', pointsPerUnit: 15, unitsPerPoint: 1 },
      { type: 'Calisthenics', unit: 'Session', pointsPerUnit: 12, unitsPerPoint: 1 },
      { type: 'Powerlifting', unit: 'Session', pointsPerUnit: 18, unitsPerPoint: 1 },
    ],
    summary: 'Build strength together! Earn points for weightlifting (15 pts), calisthenics (12 pts), and powerlifting (18 pts) sessions.',
    tips: [
      'Focus on proper form over heavy weights',
      'Allow adequate rest between sessions',
      'Progressive overload is key to gains',
      'Include both compound and isolation exercises'
    ]
  },

  {
    id: 'fitness-variety',
    name: 'Fitness Variety Pack',
    description: 'A 14-day mixed competition with various workout types',
    goal: 'Explore different fitness modalities and discover new favorite activities',
    duration: 14,
    dailyCap: 60,
    icon: 'fitness',
    color: '#8B5CF6',
    activities: [
      { type: 'HIIT', unit: 'Session', pointsPerUnit: 20, unitsPerPoint: 1 },
      { type: 'Yoga', unit: 'Session', pointsPerUnit: 10, unitsPerPoint: 1 },
      { type: 'Swimming', unit: 'Minute', pointsPerUnit: 1, unitsPerPoint: 2 },
      { type: 'Dance', unit: 'Minute', pointsPerUnit: 1, unitsPerPoint: 3 },
    ],
    summary: 'Mix it up! HIIT sessions (20 pts), yoga (10 pts), swimming (1 pt/2min), and dancing (1 pt/3min).',
    tips: [
      'Try a new activity each day',
      'Listen to your body and rest when needed',
      'Have fun and stay motivated',
      'Document your favorite new discoveries'
    ]
  },

  {
    id: 'step-counter',
    name: 'Step Counter Challenge',
    description: 'A simple 30-day step counting competition',
    goal: 'Increase daily movement and establish a consistent walking habit',
    duration: 30,
    dailyCap: 100,
    icon: 'walk',
    color: '#06B6D4',
    activities: [
      { type: 'Walking', unit: 'Step', pointsPerUnit: 1, unitsPerPoint: 100 },
      { type: 'Running', unit: 'Step', pointsPerUnit: 1, unitsPerPoint: 50 },
      { type: 'Hiking', unit: 'Step', pointsPerUnit: 1, unitsPerPoint: 75 },
    ],
    summary: 'Count every step! Walking (1 pt/100 steps), running (1 pt/50 steps), hiking (1 pt/75 steps).',
    tips: [
      'Aim for 10,000 steps daily as a baseline',
      'Take stairs instead of elevators',
      'Park farther away to add extra steps',
      'Use a step counter or smartphone app'
    ]
  },

  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'A 3-day intensive weekend competition',
    goal: 'Maximize fitness gains during weekend time with high-intensity activities',
    duration: 3,
    dailyCap: 80,
    icon: 'trophy',
    color: '#F59E0B',
    activities: [
      { type: 'CrossFit', unit: 'Session', pointsPerUnit: 25, unitsPerPoint: 1 },
      { type: 'Rock Climbing', unit: 'Session', pointsPerUnit: 20, unitsPerPoint: 1 },
      { type: 'Martial Arts', unit: 'Session', pointsPerUnit: 22, unitsPerPoint: 1 },
      { type: 'Cycling', unit: 'Kilometre', pointsPerUnit: 2, unitsPerPoint: 1 },
    ],
    summary: 'Intense weekend action! CrossFit (25 pts), rock climbing (20 pts), martial arts (22 pts), cycling (2 pts/km).',
    tips: [
      'Warm up thoroughly before intense activities',
      'Stay hydrated throughout the weekend',
      'Get adequate sleep between sessions',
      'Challenge yourself but stay safe'
    ]
  },
];

// Comprehensive list of workout types organized alphabetically (except Custom first)
const workoutTypes = [
  'Custom', 'Aerobics', 'Archery', 'Backpacking', 'Badminton', 'Ballroom Dancing', 'Barre', 'Baseball', 'Basketball', 'Bodybuilding', 'Bouldering', 'Bowling', 'Boxing', 'Brazilian Jiu-Jitsu', 'Calisthenics', 'Camping Activities', 'Canoeing', 'Capoeira', 'Cardio Session', 'Cheerleading', 'Cricket', 'CrossFit', 'Cross-country Skiing', 'Cycling', 'Dance', 'Dance Fitness', 'Dog Walking', 'Dumbbell Training', 'Elliptical', 'Fencing', 'Figure Skating', 'Foam Rolling', 'Football', 'Frisbee', 'Gardening', 'Golf', 'Gymnastics', 'HIIT', 'Hiking', 'Hip Hop Dancing', 'Hockey', 'Horseback Riding', 'Hot Yoga', 'House Cleaning', 'Ice Hockey', 'Ice Skating', 'Jet Skiing', 'Jogging', 'Judo', 'Jump Rope', 'Karate', 'Kayaking', 'Kettlebell', 'Lacrosse', 'Manual Labor', 'Martial Arts', 'Massage Therapy', 'Meditation', 'MMA', 'Mountain Biking', 'Mountain Climbing', 'Muay Thai', 'Parkour', 'Physical Therapy', 'Pilates', 'Pole Dancing', 'Powerlifting', 'Racquetball', 'Rehabilitation', 'Resistance Training', 'Restorative Yoga', 'Rock Climbing', 'Rock Wall Climbing', 'Rowing', 'Rugby', 'Running', 'Sailing', 'Skateboarding', 'Skiing', 'Sledding', 'Snowboarding', 'Snowshoeing', 'Soccer', 'Softball', 'Spin Class', 'Sprinting', 'Squash', 'Stair Climbing', 'Stand-up Paddleboarding', 'Step Aerobics', 'Stretching', 'Stretching Session', 'Surfing', 'Swimming', 'Table Tennis', 'Tai Chi', 'Taekwondo', 'Tennis', 'Track and Field', 'Trail Running', 'Treadmill', 'Ultimate Frisbee', 'Volleyball', 'Walking', 'Water Aerobics', 'Water Skiing', 'Weightlifting', 'Wrestling', 'Yard Work', 'Yoga', 'Zumba'
];

// Universal units available for all activities
const universalUnits = [
  'Custom', 'Calorie', 'Class', 'Hour', 'Kilometre', 'Meter', 'Mile', 'Minute', 'Rep', 'Session', 'Set', 'Step', 'Yard',
];

// Helper functions
const getPointsPlaceholder = unit => {
  const placeholders = {
    Minute: 'e.g., 10 minutes = 1 point', Hour: 'e.g., 1 hour = 5 points', Kilometre: 'e.g., 1 km = 1 point',
    Mile: 'e.g., 1 mile = 2 points', Meter: 'e.g., 100 meters = 1 point', Yard: 'e.g., 100 yards = 1 point',
    Step: 'e.g., 500 steps = 1 point', Rep: 'e.g., 10 reps = 1 point', Set: 'e.g., 1 set = 2 points',
    Calorie: 'e.g., 50 calories = 1 point', Session: 'e.g., 1 session = 10 points', Class: 'e.g., 1 class = 15 points',
    Custom: 'Enter points value',
  };
  return placeholders[unit] || 'Enter points value';
};

const getUnitsPlaceholder = unit => unit === 'Custom' ? 'e.g., 30 custom-units' : `e.g., 30 ${unit.toLowerCase()}`;
const getPointsLabel = unit => unit === 'Custom' ? 'Points per custom unit' : `Points per ${unit.toLowerCase()}`;
const getUnitsLabel = unit => unit === 'Custom' ? 'Custom units required per point' : `Units required per point (${unit.toLowerCase()})`;

export default function CompetitionCreationScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  // Tab state - dynamic based on preset selection
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [activeTab, setActiveTab] = useState('presets'); // 'presets', 'manual', 'friends', 'rules'
  
  // Track which activity cards have expanded "More" sections
  const [expandedCards, setExpandedCards] = useState({});

  // Helper function to get initial form values
  const getInitialFormValues = () => {
    const now = new Date();
    return {
      name: '', description: '',
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59),
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59),
      dailyCap: '',
      photoProofRequired: false,
      invitationGracePeriod: true,  // Default to allowing grace period
      leaderboardUpdateDays: 0,  // Default to live updates
      activities: [{ 
        type: 'Walking', unit: 'Minute', points: '1', unitsPerPoint: '1', 
        customType: '', customUnit: '',
        // NEW FIELDS for activity-specific limits
        maxSubmissionsPerDay: null,
        maxPointsPerWeek: null,
        perSubmissionCap: null
      }],
      inviteUsername: '', invitedFriends: []
    };
  };

  // Manual form state
  const [name, setName] = useState('');
  const [description, setDesc] = useState('');
  const now = new Date();
  const [startDate, setStart] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0));
  const [startTime, setStartTime] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0));
  const [endDate, setEnd] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59));
  const [endTime, setEndTime] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59));
  const [dailyCap, setDailyCap] = useState('');
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [invitationGracePeriod, setInvitationGracePeriod] = useState(true); // Default ON
  const [leaderboardUpdateDays, setLeaderboardUpdateDays] = useState(0); // 0 means live updates
  const [activities, setActs] = useState([
    { 
      type: 'Walking', unit: 'Minute', points: '1', unitsPerPoint: '1', 
      customType: '', customUnit: '',
      // NEW FIELDS for activity-specific limits
      maxSubmissionsPerDay: null,
      maxPointsPerWeek: null,
      perSubmissionCap: null
    }
  ]);

  // Shared state for both tabs
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  
  // Toggle expansion state for a card
  const toggleCardExpansion = (index) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  /* ---------- DUPLICATE PREVENTION LOGIC ---------- */
  const getAvailableActivityTypes = (currentIndex) => {
    const selectedTypes = activities
      .map((act, idx) => idx !== currentIndex ? act.type : null)
      .filter(type => type && type !== 'Custom');
    
    return workoutTypes.filter(type => 
      type === 'Custom' || !selectedTypes.includes(type)
    );
  };

  const getActivityDisplayName = (activity) => {
    if (activity.type === 'Custom' && activity.customType) {
      return activity.customType;
    }
    return activity.type;
  };

  const getUnitDisplayName = (activity) => {
    if (activity.unit === 'Custom' && activity.customUnit) {
      return activity.customUnit;
    }
    return activity.unit;
  };

  const validateCustomActivityName = (name, currentIndex) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    const existingCustomNames = activities
      .map((act, idx) => idx !== currentIndex && act.type === 'Custom' ? act.customType : null)
      .filter(name => name);
    
    return !existingCustomNames.includes(trimmedName);
  };

  const getFinalActivityType = (activity) => {
    if (activity.type === 'Custom' && activity.customType) {
      return activity.customType;
    }
    return activity.type;
  };

  const getFinalUnitType = (activity) => {
    if (activity.unit === 'Custom' && activity.customUnit) {
      return activity.customUnit;
    }
    return activity.unit;
  };

  /* ---------- fetch user's friends ---------- */
  useEffect(() => {
    const fetchUserFriends = async () => {
      if (!user) return;
      
      setLoadingFriends(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const friendIds = userData.friends || [];
          
          if (friendIds.length > 0) {
            const friendsData = [];
            for (const friendId of friendIds) {
              const friendDoc = await getDoc(doc(db, 'users', friendId));
              if (friendDoc.exists()) {
                friendsData.push({ uid: friendId, ...friendDoc.data() });
              }
            }
            setUserFriends(friendsData);
          } else {
            setUserFriends([]);
          }
        }
      } catch (error) {
        console.error('Error fetching user friends:', error);
        setUserFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchUserFriends();
  }, [user]);

  // Function to reset all form values
  const resetForm = () => {
    const initialValues = getInitialFormValues();
    setName(initialValues.name); setDesc(initialValues.description);
    setStart(initialValues.startDate); setStartTime(initialValues.startTime);
    setEnd(initialValues.endDate); setEndTime(initialValues.endTime);
    setDailyCap(initialValues.dailyCap); setPhotoProofRequired(initialValues.photoProofRequired); 
    setInvitationGracePeriod(initialValues.invitationGracePeriod);
    setLeaderboardUpdateDays(initialValues.leaderboardUpdateDays);
    setActs(initialValues.activities);
    setInviteUsername(initialValues.inviteUsername); setInvitedFriends(initialValues.invitedFriends);
    setSelectedPreset(null); setActiveTab('presets');
    setExpandedCards({}); // Reset expanded cards state
  };

  /* ---------- leaderboard helpers ---------- */
  const getCompetitionDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };


  /* ---------- date/time helpers ---------- */
  const handleStartDateChange = (selectedDate) => {
    setStart(selectedDate);
    const updatedStartTime = new Date(selectedDate);
    updatedStartTime.setHours(startTime.getHours(), startTime.getMinutes());
    setStartTime(updatedStartTime);
  };

  const handleStartTimeChange = (selectedTime) => {
    setStartTime(selectedTime);
    const updatedStartDate = new Date(startDate);
    updatedStartDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setStart(updatedStartDate);
  };

  const handleEndDateChange = (selectedDate) => {
    setEnd(selectedDate);
    const updatedEndTime = new Date(selectedDate);
    updatedEndTime.setHours(endTime.getHours(), endTime.getMinutes());
    setEndTime(updatedEndTime);
  };

  const handleEndTimeChange = (selectedTime) => {
    setEndTime(selectedTime);
    const updatedEndDate = new Date(endDate);
    updatedEndDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setEnd(updatedEndDate);
  };

  const getCombinedStartDateTime = () => {
    const combined = new Date(startDate);
    combined.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    return combined;
  };

  const getCombinedEndDateTime = () => {
    const combined = new Date(endDate);
    combined.setHours(endTime.getHours(), endTime.getMinutes(), 59, 999);
    return combined;
  };

  /* ---------- activity helpers ---------- */
  const updateAct = (idx, patch) =>
    setActs(a => a.map((row,i) => i===idx ? {...row,...patch} : row));

  const handleActivityTypeChange = (idx, newType) => {
    const updates = { type: newType };
    if (newType === 'Custom') {
      updates.customType = activities[idx].customType || '';
    } else {
      updates.customType = '';
    }
    updateAct(idx, updates);
  };

  const handleCustomTypeChange = (idx, newCustomType) => {
    updateAct(idx, { customType: newCustomType });
  };

  const handleUnitChange = (idx, newUnit) => {
    const updates = { unit: newUnit, unitsPerPoint: '1' };
    if (newUnit === 'Custom') {
      updates.customUnit = activities[idx].customUnit || '';
    } else {
      updates.customUnit = '';
    }
    updateAct(idx, updates);
  };

  const handleCustomUnitChange = (idx, newCustomUnit) => {
    updateAct(idx, { customUnit: newCustomUnit });
  };

  const addActivity = () => {
    const availableTypes = getAvailableActivityTypes(-1);
    const defaultType = availableTypes.length > 0 ? availableTypes[0] : 'Custom';
    
    setActs([...activities, { 
      type: defaultType, unit: 'Minute', points: '1', unitsPerPoint: '1',
      customType: '', customUnit: '',
      // NEW FIELDS for activity-specific limits
      maxSubmissionsPerDay: null,
      maxPointsPerWeek: null,
      perSubmissionCap: null
    }]);
  };

  const removeAct = idx => setActs(a => a.filter((_,i) => i!==idx));

  /* ---------- friends helpers ---------- */
  const findUserByUsername = async username => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;
    
    try {
      const q = query(collection(db,'users'), where('username','==',trimmedUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        return { uid: snap.docs[0].id, username: userData.username, email: userData.email };
      }
      
      const usernameDoc = await getDoc(doc(db,'usernames',trimmedUsername));
      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;
        const userDoc = await getDoc(doc(db,'users',uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return { uid, username: userData.username, email: userData.email };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      return null;
    }
  };

  const addInvite = async () => {
    const username = inviteUsername.trim();
    if (!username) return;
    
    if (username.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, and underscores');
      return;
    }
    
    try {
      const friend = await findUserByUsername(username);
      if (!friend) {
        Alert.alert('User Not Found', `No user found with username "${username}"`);
        return;
      }
      
      if (friend.uid === user.uid) {
        Alert.alert('Invalid Invitation', "You can't invite yourself!");
        return;
      }
      
      if (invitedFriends.find(f => f.uid === friend.uid)) {
        Alert.alert('Already Invited', `${friend.username} is already invited`);
        return;
      }
      
      setInvitedFriends([...invitedFriends, friend]);
      setInviteUsername('');
      Alert.alert('Success', `${friend.username} has been invited!`);
    } catch(e) {
      console.error('Error adding invite:', e);
      Alert.alert('Invite Error', 'Failed to add invitation. Please try again.');
    }
  };

  const inviteFriendFromList = (friend) => {
    if (!!invitedFriends.find(f => f.uid === friend.uid)) {
      Alert.alert('Already Invited', `${friend.username} is already invited`);
      return;
    }
    
    setInvitedFriends([...invitedFriends, {
      uid: friend.uid, username: friend.username, email: friend.email,
    }]);
    
    Alert.alert('Success', `${friend.username} has been invited!`);
  };
  
  const removeInvite = uid => setInvitedFriends(f => f.filter(x => x.uid !== uid));

  /* ---------- preset helpers ---------- */
  const selectPreset = (preset) => {
    setSelectedPreset(preset);
    setActiveTab('friends'); // Switch to friends tab after selection
  };

  const goBackToPresets = () => {
    setSelectedPreset(null);
    setActiveTab('presets');
    setInvitedFriends([]); // Clear invited friends when going back
  };

  const createPresetCompetition = async () => {
    if (!selectedPreset) return;

    try {
      const now = new Date();
      const startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      const endDateTime = new Date(startDateTime);
      endDateTime.setDate(endDateTime.getDate() + selectedPreset.duration);
      endDateTime.setHours(23, 59, 59, 999);

      const rules = selectedPreset.activities.map(a => ({
        type: a.type, unit: a.unit, pointsPerUnit: a.pointsPerUnit,
        unitsPerPoint: a.unitsPerPoint, isCustomActivity: false, isCustomUnit: false,
        // Default limit fields for presets (no individual limits)
        maxSubmissionsPerDay: null,
        maxPointsPerWeek: null,
        perSubmissionCap: null
      }));

      await addDoc(collection(db,'competitions'), {
        name: selectedPreset.name, description: selectedPreset.description,
        startDate: startDateTime.toISOString(), endDate: endDateTime.toISOString(),
        ownerId: user.uid, participants: [user.uid],
        pendingParticipants: invitedFriends.map(f=>f.uid),
        rules: rules, 
        dailyCap: selectedPreset.dailyCap, 
        photoProofRequired: false,  // Presets don't require photos by default
        invitationGracePeriod: true,  // Presets allow grace period by default
        leaderboardUpdateDays: 0,  // Presets use live updates by default
        bonuses: [],
        createdAt: serverTimestamp(),
      });
      
      resetForm();
      
      Alert.alert(
        'Success!', 
        `Competition "${selectedPreset.name}" created successfully!${invitedFriends.length > 0 ? ` Invitations sent to ${invitedFriends.length} friend${invitedFriends.length === 1 ? '' : 's'}.` : ''}`,
        [{ text: 'OK', onPress: () => navigation.navigate('HomeStack') }]
      );
    } catch(e) {
      console.error('Error creating preset competition:', e);
      Alert.alert('Error', 'Failed to create competition. Please try again.');
    }
  };

  /* ---------- manual create competition ---------- */
  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Validation','Competition name is required');
      return;
    }
    
    const finalStartDateTime = getCombinedStartDateTime();
    const finalEndDateTime = getCombinedEndDateTime();
    
    if (finalEndDateTime <= finalStartDateTime) {
      Alert.alert('Validation','End date/time must be after start date/time');
      return;
    }
    
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      
      if (!activity.points || parseFloat(activity.points) <= 0 || 
          !activity.unitsPerPoint || parseFloat(activity.unitsPerPoint) <= 0) {
        Alert.alert('Validation','Please set valid points & units-per-point for all activities');
        return;
      }
      
      // Validate new limit fields
      if (activity.maxSubmissionsPerDay && activity.maxSubmissionsPerDay < 1) {
        Alert.alert('Validation', `Invalid max submissions per day for ${getActivityDisplayName(activity)}`);
        return;
      }
      if (activity.maxPointsPerWeek && activity.maxPointsPerWeek <= 0) {
        Alert.alert('Validation', `Invalid weekly points cap for ${getActivityDisplayName(activity)}`);
        return;
      }
      if (activity.perSubmissionCap && activity.perSubmissionCap <= 0) {
        Alert.alert('Validation', `Invalid per-submission cap for ${getActivityDisplayName(activity)}`);
        return;
      }
      
      if (activity.type === 'Custom') {
        if (!activity.customType || !activity.customType.trim()) {
          Alert.alert('Validation', 'Please provide a name for all custom activities');
          return;
        }
        
        if (!validateCustomActivityName(activity.customType, i)) {
          Alert.alert('Validation', 'Custom activity names must be unique');
          return;
        }
      }

      if (activity.unit === 'Custom' && (!activity.customUnit || !activity.customUnit.trim())) {
        Alert.alert('Validation','Please enter a custom unit name or choose a different measurement unit');
        return;
      }
    }
    
    try {
      const rules = activities.map(a => ({
        type: getFinalActivityType(a), unit: getFinalUnitType(a),
        pointsPerUnit: Number(a.points), unitsPerPoint: Number(a.unitsPerPoint),
        isCustomActivity: a.type === 'Custom', isCustomUnit: a.unit === 'Custom',
        // NEW FIELDS for activity-specific limits
        maxSubmissionsPerDay: a.maxSubmissionsPerDay || null,
        maxPointsPerWeek: a.maxPointsPerWeek || null,
        perSubmissionCap: a.perSubmissionCap || null
      }));

      await addDoc(collection(db,'competitions'), {
        name: name.trim(), description: description.trim(),
        startDate: finalStartDateTime.toISOString(), endDate: finalEndDateTime.toISOString(),
        ownerId: user.uid, participants: [user.uid],
        pendingParticipants: invitedFriends.map(f=>f.uid),
        rules: rules, 
        dailyCap: dailyCap ? Number(dailyCap) : null, 
        photoProofRequired: photoProofRequired,
        invitationGracePeriod: invitationGracePeriod,
        leaderboardUpdateDays: leaderboardUpdateDays,
        bonuses: [],
        createdAt: serverTimestamp(),
      });
      
      resetForm();
      
      Alert.alert(
        'Success!', 
        `Competition "${name.trim()}" created successfully!${invitedFriends.length > 0 ? ` Invitations sent to ${invitedFriends.length} friend${invitedFriends.length === 1 ? '' : 's'}.` : ''}`,
        [{ text: 'OK', onPress: () => navigation.navigate('HomeStack') }]
      );
    } catch(e) {
      console.error('Error creating competition:', e);
      Alert.alert('Error', 'Failed to create competition. Please try again.');
    }
  };

  /* ---------- RENDER FUNCTIONS ---------- */
  
  const renderPresetsTab = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Start Templates</Text>
        <Text style={styles.sectionSubtext}>Choose from pre-configured competitions to get started quickly</Text>
        
        {competitionPresets.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={styles.presetCard}
            onPress={() => selectPreset(preset)}
            activeOpacity={0.8}
          >
            <View style={styles.presetHeader}>
              <View style={[styles.presetIcon, { backgroundColor: preset.color }]}>
                <Ionicons name={preset.icon} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.presetInfo}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetDuration}>{preset.duration} days • {preset.dailyCap} pts/day limit</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </View>
            <Text style={styles.presetDescription}>{preset.description}</Text>
            <Text style={styles.presetSummary}>{preset.summary}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderFriendsTab = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.presetHeader}>
          <TouchableOpacity onPress={goBackToPresets} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#A4D65E" />
            <Text style={styles.backButtonText}>Back to Presets</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Invite Friends</Text>
        <Text style={styles.sectionSubtext}>Add friends to your {selectedPreset?.name}</Text>
        
        <View style={styles.inviteContainer}>
          <View style={styles.inviteRow}>
            <TextInput
              style={[styles.inputInvite,{flex:1}]}
              placeholder="Friend's username"
              value={inviteUsername}
              onChangeText={setInviteUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={addInvite} style={{marginLeft:8}}>
              <Ionicons name="add-circle" size={32} color="#A4D65E"/>
            </TouchableOpacity>
          </View>

          {userFriends.length > 0 && (
            <>
              <Text style={styles.friendsListTitle}>Your Friends</Text>
              <View style={styles.friendsListContainer}>
                {loadingFriends ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading friends...</Text>
                  </View>
                ) : (
                  <ScrollView 
                    style={styles.friendsScrollView}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    {userFriends.map((friend) => {
                      const isAlreadyInvited = !!invitedFriends.find(f => f.uid === friend.uid);
                      return (
                        <View key={friend.uid} style={styles.friendListItem}>
                          <View style={styles.friendInfo}>
                            <Ionicons name="person-circle" size={36} color="#A4D65E" />
                            <Text style={styles.friendName}>{friend.username}</Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.inviteFriendButton,
                              isAlreadyInvited && styles.invitedFriendButton
                            ]}
                            onPress={() => inviteFriendFromList(friend)}
                            disabled={isAlreadyInvited}
                          >
                            <Text style={[
                              styles.inviteFriendButtonText,
                              isAlreadyInvited && styles.invitedFriendButtonText
                            ]}>
                              {isAlreadyInvited ? 'Invited' : 'Invite'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </>
          )}

          {invitedFriends.length > 0 && (
            <>
              <Text style={styles.invitedTitle}>Invited Friends ({invitedFriends.length})</Text>
              {invitedFriends.map(f=>(
                <View key={f.uid} style={styles.participant}>
                  <Ionicons name="person-circle" size={40} color="#A4D65E"/>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{f.username}</Text>
                    <Text style={styles.participantEmail}>{f.email}</Text>
                  </View>
                  <TouchableOpacity onPress={()=>removeInvite(f.uid)}>
                    <Ionicons name="close-circle" size={24} color="#FF6B6B"/>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        <TouchableOpacity 
          style={styles.createButton} 
          onPress={createPresetCompetition}
        >
          <Text style={styles.createButtonText}>Create Competition</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderRulesTab = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.presetHeader}>
          <TouchableOpacity onPress={goBackToPresets} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#A4D65E" />
            <Text style={styles.backButtonText}>Back to Presets</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <View style={[styles.presetIcon, { backgroundColor: selectedPreset?.color }]}>
              <Ionicons name={selectedPreset?.icon} size={32} color="#FFFFFF" />
            </View>
            <View style={styles.rulesInfo}>
              <Text style={styles.rulesName}>{selectedPreset?.name}</Text>
              <Text style={styles.rulesDuration}>
                {selectedPreset?.duration} days • {selectedPreset?.dailyCap} points/day limit
              </Text>
            </View>
          </View>
          
          <Text style={styles.rulesDescription}>{selectedPreset?.description}</Text>
          
          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>🎯 Goal</Text>
            <Text style={styles.rulesSectionContent}>{selectedPreset?.goal}</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>🏃 Activities & Points</Text>
            {selectedPreset?.activities.map((activity, idx) => (
              <View key={idx} style={styles.activityRule}>
                <View style={styles.activityRuleHeader}>
                  <Text style={styles.activityRuleName}>{activity.type}</Text>
                  <Text style={styles.activityRulePoints}>{activity.pointsPerUnit} pts</Text>
                </View>
                <Text style={styles.activityRuleDetail}>
                  {activity.unitsPerPoint} {activity.unit.toLowerCase()} = {activity.pointsPerUnit} point{activity.pointsPerUnit !== 1 ? 's' : ''}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>💡 Tips for Success</Text>
            {selectedPreset?.tips.map((tip, idx) => (
              <View key={idx} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>📊 Competition Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{selectedPreset?.duration} days</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Daily Limit</Text>
                <Text style={styles.detailValue}>{selectedPreset?.dailyCap} points</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Activities</Text>
                <Text style={styles.detailValue}>{selectedPreset?.activities.length} types</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Max Points</Text>
                <Text style={styles.detailValue}>{selectedPreset?.dailyCap * selectedPreset?.duration}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.createButton} 
          onPress={createPresetCompetition}
        >
          <Text style={styles.createButtonText}>Create Competition</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderManualTab = () => (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Competition Details</Text>
      <FormInput label="Competition Name" value={name} onChangeText={setName}/>
      
      <Text style={styles.sectionTitle}>Schedule</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <DatePicker 
            label="Start Date" 
            date={startDate} 
            onDateChange={handleStartDateChange}
            mode="date"
            minimumDate={new Date()}
          />
        </View>
        <View style={styles.dateTimeField}>
          <DatePicker 
            label="Start Time" 
            date={startTime} 
            onDateChange={handleStartTimeChange}
            mode="time"
          />
        </View>
      </View>
      
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <DatePicker 
            label="End Date" 
            date={endDate} 
            onDateChange={handleEndDateChange}
            mode="date"
            minimumDate={startDate}
          />
        </View>
        <View style={styles.dateTimeField}>
          <DatePicker 
            label="End Time" 
            date={endTime} 
            onDateChange={handleEndTimeChange}
            mode="time"
          />
        </View>
      </View>
      
      <View style={styles.durationPreview}>
        <Text style={styles.durationText}>
          Duration: {Math.ceil((getCombinedEndDateTime() - getCombinedStartDateTime()) / (1000 * 60 * 60 * 24))} days
        </Text>
      </View>
      
      <Text style={styles.label}>Description</Text>
      <TextInput style={styles.textArea} multiline value={description} onChangeText={setDesc} placeholder="Describe your competition..."/>

      <Text style={styles.sectionTitle}>Activity Rules</Text>
      <Text style={styles.sectionSubtext}>Set up custom point & unit thresholds</Text>
      {activities.map((act,idx) => {
        const z = 1000 - idx*10;
        const availableTypes = getAvailableActivityTypes(idx);
        
        return (
          <View key={`activity-${idx}`} style={[styles.activityCard,{zIndex:z}]}>
            <Dropdown
              label="Activity Type"
              selectedValue={act.type}
              onValueChange={val=>handleActivityTypeChange(idx, val)}
              items={availableTypes}
              priorityItems={['Custom']}
              containerStyle={{zIndex:z+3}}
            />
            
            {act.type === 'Custom' && (
              <View style={styles.customActivityContainer}>
                <FormInput
                  label="Custom Activity Name"
                  value={act.customType}
                  onChangeText={customType=>handleCustomTypeChange(idx, customType)}
                  placeholder="Enter your custom activity"
                />
                <Text style={styles.customActivityHint}>
                  Examples: Rock Climbing, Parkour, Martial Arts, etc.
                </Text>
              </View>
            )}

            <Dropdown
              label="Measurement Unit"
              selectedValue={act.unit}
              onValueChange={unit=>handleUnitChange(idx, unit)}
              items={universalUnits}
              priorityItems={['Custom']}
              containerStyle={{zIndex:z+1}}
            />

            {act.unit === 'Custom' && (
              <View style={styles.customActivityContainer}>
                <FormInput
                  label="Custom Unit Name"
                  value={act.customUnit}
                  onChangeText={customUnit=>handleCustomUnitChange(idx, customUnit)}
                  placeholder="Enter your custom unit"
                />
                <Text style={styles.customActivityHint}>
                  Examples: Laps, Rounds, Lengths, Flights, etc.
                </Text>
              </View>
            )}

            <FormInput
              label={getPointsLabel(getUnitDisplayName(act))}
              keyboardType="numeric"
              value={act.points}
              onChangeText={p=>updateAct(idx,{points:p})}
              placeholder={getPointsPlaceholder(getUnitDisplayName(act))}
            />

            <FormInput
              label={getUnitsLabel(getUnitDisplayName(act))}
              keyboardType="numeric"
              value={act.unitsPerPoint}
              onChangeText={u=>updateAct(idx,{unitsPerPoint:u})}
              placeholder={getUnitsPlaceholder(getUnitDisplayName(act))}
            />

            <View style={styles.activitySummary}>
              <Text style={styles.activitySummaryText}>
                {getActivityDisplayName(act)} • {act.unitsPerPoint} {getUnitDisplayName(act).toLowerCase()} = {act.points} point{act.points !== '1' ? 's' : ''}
              </Text>
            </View>

            {/* MORE SECTION - Collapsible advanced settings */}
            <TouchableOpacity 
              style={styles.moreSectionHeader}
              onPress={() => toggleCardExpansion(idx)}
              activeOpacity={0.7}
            >
              <View style={styles.moreSectionTitleContainer}>
                <Text style={styles.moreSectionTitle}>More settings</Text>
                <Text style={styles.moreSectionSubtitle}>Optional limits for fairness and balance</Text>
              </View>
              <Ionicons 
                name={expandedCards[idx] ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#6B7280" 
              />
            </TouchableOpacity>

            {expandedCards[idx] && (
              <View style={styles.moreSectionContent}>
                {/* Max Submissions Per Day */}
                <View style={styles.limitControl}>
                  <FormInput
                    label="Max submissions per day"
                    keyboardType="numeric"
                    value={act.maxSubmissionsPerDay?.toString() || ''}
                    onChangeText={(value) => {
                      const updated = [...activities];
                      updated[idx] = {
                        ...updated[idx],
                        maxSubmissionsPerDay: value ? parseInt(value) : null
                      };
                      setActs(updated);
                    }}
                    placeholder="Unlimited"
                  />
                  <Text style={styles.limitHelper}>
                    Leave empty for unlimited daily submissions (use "1" for once per day)
                  </Text>
                </View>

                {/* Max Points Per Week */}
                <View style={styles.limitControl}>
                  <FormInput
                    label="Max points per week for this activity"
                    keyboardType="numeric"
                    value={act.maxPointsPerWeek?.toString() || ''}
                    onChangeText={(value) => {
                      const updated = [...activities];
                      updated[idx] = {
                        ...updated[idx],
                        maxPointsPerWeek: value ? parseFloat(value) : null
                      };
                      setActs(updated);
                    }}
                    placeholder="Unlimited"
                  />
                  <Text style={styles.limitHelper}>
                    Total weekly points cap for {getActivityDisplayName(act)}
                  </Text>
                </View>

                {/* Per-Submission Point Cap */}
                <View style={styles.limitControl}>
                  <FormInput
                    label="Per-submission point cap"
                    keyboardType="numeric"
                    value={act.perSubmissionCap?.toString() || ''}
                    onChangeText={(value) => {
                      const updated = [...activities];
                      updated[idx] = {
                        ...updated[idx],
                        perSubmissionCap: value ? parseFloat(value) : null
                      };
                      setActs(updated);
                    }}
                    placeholder="Unlimited"
                  />
                  <Text style={styles.limitHelper}>
                    Maximum points per single submission
                  </Text>
                </View>
              </View>
            )}

            {activities.length>1 && (
              <TouchableOpacity onPress={()=>removeAct(idx)} style={styles.trashBtn}>
                <Ionicons name="trash" size={20} color="#FF6B6B"/>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {getAvailableActivityTypes(-1).length > 0 && (
        <TouchableOpacity style={styles.addBtn} onPress={addActivity}>
          <Ionicons name="add-circle" size={40} color="#A4D65E"/>
          <Text style={styles.addText}>Add Activity Rule</Text>
        </TouchableOpacity>
      )}

      <FormInput
        label="Daily Point Limit (optional)"
        value={dailyCap}
        onChangeText={setDailyCap}
        keyboardType="numeric"
        placeholder="Leave blank for unlimited"
      />

      {/* Leaderboard Update Frequency */}
      <LeaderboardUpdatePicker
        value={leaderboardUpdateDays}
        onChange={setLeaderboardUpdateDays}
        competitionDays={getCompetitionDays()}
      />

      {/* Photo Proof Requirement */}
      <View style={styles.photoProofSection}>
        <View style={styles.photoProofHeader}>
          <View style={styles.photoProofInfo}>
            <Text style={styles.photoProofLabel}>Photo Proof Required</Text>
            <Text style={styles.photoProofHelper}>
              Participants must attach a photo with every submission
            </Text>
          </View>
          <Switch
            value={photoProofRequired}
            onValueChange={setPhotoProofRequired}
            trackColor={{ false: "#E5E7EB", true: "#C7E89F" }}
            thumbColor={photoProofRequired ? "#A4D65E" : "#9CA3AF"}
          />
        </View>
      </View>

      {/* 24 Hour Invitation Grace Period */}
      <View style={styles.gracePeriodSection}>
        <View style={styles.gracePeriodHeader}>
          <View style={styles.gracePeriodInfo}>
            <Text style={styles.gracePeriodLabel}>24 Hour Invitation Grace Period</Text>
            <Text style={styles.gracePeriodHelper}>
              Allow pending invites to join within 24 hours after competition starts
            </Text>
          </View>
          <Switch
            value={invitationGracePeriod}
            onValueChange={setInvitationGracePeriod}
            trackColor={{ false: "#E5E7EB", true: "#C7E89F" }}
            thumbColor={invitationGracePeriod ? "#A4D65E" : "#9CA3AF"}
          />
        </View>
        {!invitationGracePeriod && (
          <View style={styles.gracePeriodWarning}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={styles.gracePeriodWarningText}>
              Pending invitations will be cancelled when competition starts
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Invite Participants</Text>
      <Text style={styles.sectionSubtext}>Invite friends by their registered username</Text>
      <View style={styles.inviteRow}>
        <TextInput
          style={[styles.inputInvite,{flex:1}]}
          placeholder="Friend's username"
          value={inviteUsername}
          onChangeText={setInviteUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={addInvite} style={{marginLeft:8}}>
          <Ionicons name="add-circle" size={32} color="#A4D65E"/>
        </TouchableOpacity>
      </View>

      {userFriends.length > 0 && (
        <>
          <Text style={styles.friendsListTitle}>Your Friends</Text>
          <View style={styles.friendsListContainer}>
            {loadingFriends ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.friendsScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {userFriends.map((friend) => {
                  const isAlreadyInvited = !!invitedFriends.find(f => f.uid === friend.uid);
                  return (
                    <View key={friend.uid} style={styles.friendListItem}>
                      <View style={styles.friendInfo}>
                        <Ionicons name="person-circle" size={36} color="#A4D65E" />
                        <Text style={styles.friendName}>{friend.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.inviteFriendButton,
                          isAlreadyInvited && styles.invitedFriendButton
                        ]}
                        onPress={() => inviteFriendFromList(friend)}
                        disabled={isAlreadyInvited}
                      >
                        <Text style={[
                          styles.inviteFriendButtonText,
                          isAlreadyInvited && styles.invitedFriendButtonText
                        ]}>
                          {isAlreadyInvited ? 'Invited' : 'Invite'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </>
      )}

      {invitedFriends.length > 0 && (
        <>
          <Text style={styles.invitedTitle}>Invited Friends ({invitedFriends.length})</Text>
          {invitedFriends.map(f=>(
            <View key={f.uid} style={styles.participant}>
              <Ionicons name="person-circle" size={40} color="#A4D65E"/>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{f.username}</Text>
                <Text style={styles.participantEmail}>{f.email}</Text>
              </View>
              <TouchableOpacity onPress={()=>removeInvite(f.uid)}>
                <Ionicons name="close-circle" size={24} color="#FF6B6B"/>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <Button title="Create Competition" onPress={handleCreate} style={styles.createCompetitionButton}/>
    </ScrollView>
  );

  // Determine which tabs to show
  const showPresetTabs = !selectedPreset;
  const showFriendsRulesTabs = !!selectedPreset;

  return (
    <View style={styles.container}>
      <Header title="" backgroundColor="#F8F8F8" />
      <StatusBar style="dark" />

      {/* Dynamic Tab Navigation */}
      <View style={styles.tabContainer}>
        {showPresetTabs ? (
          <>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'presets' && styles.activeTab]}
              onPress={() => setActiveTab('presets')}
            >
              <Ionicons 
                name="flash" 
                size={20} 
                color={activeTab === 'presets' ? '#A4D65E' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === 'presets' && styles.activeTabText]}>
                Presets
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'manual' && styles.activeTab]}
              onPress={() => setActiveTab('manual')}
            >
              <Ionicons 
                name="settings" 
                size={20} 
                color={activeTab === 'manual' ? '#A4D65E' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>
                Manual
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Ionicons 
                name="people" 
                size={20} 
                color={activeTab === 'friends' ? '#A4D65E' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Friends
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'rules' && styles.activeTab]}
              onPress={() => setActiveTab('rules')}
            >
              <Ionicons 
                name="document-text" 
                size={20} 
                color={activeTab === 'rules' ? '#A4D65E' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>
                Rules
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tab Content */}
      {activeTab === 'presets' && renderPresetsTab()}
      {activeTab === 'manual' && renderManualTab()}
      {activeTab === 'friends' && renderFriendsTab()}
      {activeTab === 'rules' && renderRulesTab()}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  
  // Tab Navigation (copied from ProfileScreen)
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
    position: 'relative',
  },
  activeTab: {
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

  // Common
  scrollView: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 40 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1E23', marginBottom: 10, marginTop: 15  },
  sectionSubtext: { fontSize: 14, color: '#666', marginBottom: 15 },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#666' },

  // Back button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A4D65E',
    marginLeft: 4,
  },

  // Presets Tab
  presetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  presetDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  presetDescription: {
    fontSize: 14,
    color: '#1A1E23',
    marginBottom: 8,
  },
  presetSummary: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Rules Tab
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rulesInfo: {
    flex: 1,
  },
  rulesName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  rulesDuration: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  rulesDescription: {
    fontSize: 16,
    color: '#1A1E23',
    marginBottom: 24,
    lineHeight: 24,
  },
  rulesSection: {
    marginBottom: 24,
  },
  rulesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 12,
  },
  rulesSectionContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  activityRule: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityRuleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityRuleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  activityRulePoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#A4D65E',
  },
  activityRuleDetail: {
    fontSize: 14,
    color: '#6B7280',
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: '#A4D65E',
    marginRight: 8,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    minWidth: '45%',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },

  // Create button
  createButton: {
    backgroundColor: '#A4D65E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Invite Section
  inviteContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },

  // Manual Tab (existing styles)
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dateTimeField: { flex: 1 },
  durationPreview: { backgroundColor: '#E8F5E8', borderRadius: 8, padding: 12, marginBottom: 16 },
  durationText: { fontSize: 14, color: '#1A1E23', textAlign: 'center', fontWeight: '500' },
  label: { fontSize: 16, color: '#1A1E23', marginBottom: 8, marginTop: 16 },
  textArea: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, fontSize: 16, color: '#1A1E23', minHeight: 120, borderWidth: 1, borderColor: '#E5E7EB' },
  activityCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  customActivityContainer: { marginTop: 8, marginBottom: 8 },
  customActivityHint: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  activitySummary: { backgroundColor: '#F0F9E8', borderRadius: 6, padding: 8, marginTop: 8 },
  activitySummaryText: { fontSize: 14, color: '#1A1E23', textAlign: 'center', fontWeight: '500' },
  trashBtn: { alignSelf: 'flex-end', marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 8, padding: 10, marginBottom: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#A4D65E' },
  addText: { marginLeft: 8, color: '#1A1E23', fontWeight: '600' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  inputInvite: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  invitedTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1E23', marginTop: 8, marginBottom: 12 },
  participant: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, backgroundColor: '#FFF', borderRadius: 8, padding: 12 },
  participantInfo: { flex: 1, marginLeft: 12 },
  participantName: { fontSize: 16, color: '#1A1E23', fontWeight: '500' },
  participantEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  createCompetitionButton: { marginTop: 20, marginBottom: 20 },
  
  // Friends list styles
  friendsListTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1E23', marginTop: 16, marginBottom: 8 },
  friendsListContainer: { backgroundColor: '#FFF', borderRadius: 8, marginBottom: 16, maxHeight: 200, borderWidth: 1, borderColor: '#E5E7EB' },
  friendsScrollView: { maxHeight: 180 },
  friendListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  friendInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  friendName: { fontSize: 16, color: '#1A1E23', fontWeight: '500', marginLeft: 12 },
  inviteFriendButton: { backgroundColor: '#A4D65E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  invitedFriendButton: { backgroundColor: '#E5E7EB' },
  inviteFriendButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  invitedFriendButtonText: { color: '#6B7280' },
  
  // More Section Styles
  moreSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  moreSectionTitleContainer: {
    flex: 1,
  },
  moreSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 2,
  },
  moreSectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  moreSectionContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  limitControl: {
    marginBottom: 12,
  },
  limitLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1E23',
    marginBottom: 2,
  },
  limitHelper: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Photo Proof Styles
  photoProofSection: {
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoProofHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoProofInfo: {
    flex: 1,
    marginRight: 12,
  },
  photoProofLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 4,
  },
  photoProofHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  // Grace Period Styles
  gracePeriodSection: {
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gracePeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gracePeriodInfo: {
    flex: 1,
    marginRight: 12,
  },
  gracePeriodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 4,
  },
  gracePeriodHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  gracePeriodWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  gracePeriodWarningText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  
});