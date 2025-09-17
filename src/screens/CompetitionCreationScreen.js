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
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FormInput, Dropdown, DatePicker, LeaderboardUpdatePicker } from '../components';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  saveDraft, 
  loadDrafts, 
  loadDraft, 
  deleteDraft, 
  draftWithNameExists,
  formatDraftDate 
} from '../utils/competitionDrafts';

const screenWidth = Dimensions.get('window').width;

// Color tokens for the new design (matching ProfileScreen)
const colors = {
  nav: {
    activeGreen: '#B6DB78',  // New fresh green
    inactiveGray: '#B3B3B3', // New gray
    textDefault: '#111111'
  },
  background: '#FFFFFF'      // Pure white
};

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

export default function CompetitionCreationScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);

  // Tab state - dynamic based on preset selection
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [activeTab, setActiveTab] = useState('presets'); // 'presets', 'manual', 'drafts', 'schedule', 'friends', 'rules'
  
  // Track which activity cards have expanded "More" sections
  const [expandedCards, setExpandedCards] = useState({});
  
  // Preset-specific date/time state
  const [presetStartDate, setPresetStartDate] = useState(null);
  const [presetStartTime, setPresetStartTime] = useState(null);
  const [presetEndDate, setPresetEndDate] = useState(null);
  const [presetEndTime, setPresetEndTime] = useState(null);
  
  // Animation state for tab navigation (matching ProfileScreen)
  const [measurementsReady, setMeasurementsReady] = useState(false);
  
  // Base width for the underline
  const baseUnderlineWidth = 60;
  
  // Calculate initial centered positions for tabs (2 or 3 columns)
  const calculateInitialTabX = (tabIndex, numColumns = 2) => {
    const columnWidth = (screenWidth - 48) / numColumns;
    const columnCenter = columnWidth * tabIndex + columnWidth / 2;
    return columnCenter - baseUnderlineWidth / 2;
  };
  
  // Tab measurements for underline positioning
  const [tabMeasurements, setTabMeasurements] = useState({
    presets: { scale: 1.2, x: calculateInitialTabX(0, 3) },
    manual: { scale: 1.2, x: calculateInitialTabX(1, 3) },
    drafts: { scale: 1.2, x: calculateInitialTabX(2, 3) },
    schedule: { scale: 1.2, x: calculateInitialTabX(0, 3) },
    friends: { scale: 1.2, x: calculateInitialTabX(1, 3) },
    rules: { scale: 1.2, x: calculateInitialTabX(2, 3) }
  });

  // Animation refs for underline and press feedback
  const underlinePosition = React.useRef(new Animated.Value(calculateInitialTabX(0))).current;
  const underlineScale = React.useRef(new Animated.Value(1.2)).current;
  const presetsScale = React.useRef(new Animated.Value(1)).current;
  const manualScale = React.useRef(new Animated.Value(1)).current;
  const draftsScale = React.useRef(new Animated.Value(1)).current;
  const scheduleScale = React.useRef(new Animated.Value(1)).current;
  const friendsScale = React.useRef(new Animated.Value(1)).current;
  const rulesScale = React.useRef(new Animated.Value(1)).current;
  
  // ScrollView ref for resetting position
  const scrollViewRef = React.useRef(null);

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

  // Handle scroll reset and smooth scroll to top
  React.useLayoutEffect(() => {
    // Check for reset and scrollToTop params
    const resetRequested = route?.params?.reset;
    const scrollToTopRequested = route?.params?.scrollToTop;
    
    // Handle instant reset when coming from other tabs
    if (resetRequested) {
      // Ensure we're on presets tab
      if (activeTab !== 'presets') {
        setActiveTab('presets');
        // Set underline position immediately
        underlinePosition.setValue(tabMeasurements.presets.x);
        underlineScale.setValue(tabMeasurements.presets.scale);
      }
      
      // Instant scroll to top
      Promise.resolve().then(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
      
      // Clear the reset param after handling
      navigation.setParams({ reset: undefined });
    }
    
    // Handle smooth scroll when already on create tab
    if (scrollToTopRequested) {
      // Ensure we're on presets tab
      if (activeTab !== 'presets') {
        setActiveTab('presets');
        // Set underline position immediately
        underlinePosition.setValue(tabMeasurements.presets.x);
        underlineScale.setValue(tabMeasurements.presets.scale);
      }
      
      // Smooth animated scroll to top
      Promise.resolve().then(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });
      
      // Clear the scrollToTop param after handling
      navigation.setParams({ scrollToTop: undefined });
    }
  }, [route?.params?.reset, route?.params?.scrollToTop, activeTab, tabMeasurements, navigation]);

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
  const [nameWarning, setNameWarning] = useState(false);
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
  
  // Draft state
  const [drafts, setDrafts] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  
  // Handler for competition name with 18-character limit
  const handleNameChange = (text) => {
    if (text.length <= 14) {
      setName(text);
      setNameWarning(false);
    } else {
      setNameWarning(true);
      // Don't update name if over 18 characters
    }
  };
  
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

  // Load drafts when component mounts or activeTab changes to drafts
  useEffect(() => {
    if (activeTab === 'drafts') {
      fetchDrafts();
    }
  }, [activeTab]);

  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const loadedDrafts = await loadDrafts();
      setDrafts(loadedDrafts);
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter a competition name before saving to drafts');
      return;
    }

    const draftData = {
      name: name.trim(),
      description: description.trim(),
      startDate: startDate.toISOString(),
      startTime: startTime.toISOString(),
      endDate: endDate.toISOString(),
      endTime: endTime.toISOString(),
      dailyCap,
      photoProofRequired,
      invitationGracePeriod,
      leaderboardUpdateDays,
      activities: activities.map(a => ({ ...a })),
      invitedFriends: invitedFriends.map(f => ({ ...f }))
    };

    try {
      await saveDraft(draftData, currentDraftId);
      
      // Reset form to fresh state after save
      const initialValues = getInitialFormValues();
      setName(initialValues.name); 
      setNameWarning(false); 
      setDesc(initialValues.description);
      setStart(initialValues.startDate); 
      setStartTime(initialValues.startTime);
      setEnd(initialValues.endDate); 
      setEndTime(initialValues.endTime);
      setDailyCap(initialValues.dailyCap); 
      setPhotoProofRequired(initialValues.photoProofRequired);
      setInvitationGracePeriod(initialValues.invitationGracePeriod);
      setLeaderboardUpdateDays(initialValues.leaderboardUpdateDays);
      setActs(initialValues.activities);
      setInviteUsername(initialValues.inviteUsername); 
      setInvitedFriends(initialValues.invitedFriends);
      setExpandedCards({});
      setCurrentDraftId(null); // Clear draft ID after save
      
      Alert.alert(
        'Success', 
        'Competition saved to drafts!',
        [{ text: 'OK', onPress: () => animateToTab('drafts') }]
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  const handleLoadDraft = async (draft) => {
    try {
      // Load the draft data into the form
      setName(draft.name || '');
      setDesc(draft.description || '');
      setStart(new Date(draft.startDate));
      setStartTime(new Date(draft.startTime));
      setEnd(new Date(draft.endDate));
      setEndTime(new Date(draft.endTime));
      setDailyCap(draft.dailyCap || '');
      setPhotoProofRequired(draft.photoProofRequired || false);
      setInvitationGracePeriod(draft.invitationGracePeriod !== undefined ? draft.invitationGracePeriod : true);
      setLeaderboardUpdateDays(draft.leaderboardUpdateDays || 0);
      setActs(draft.activities || []);
      setInvitedFriends(draft.invitedFriends || []);
      
      // Set the current draft ID for updates
      setCurrentDraftId(draft.id);
      
      // Switch to manual tab
      animateToTab('manual');
    } catch (error) {
      console.error('Error loading draft:', error);
      Alert.alert('Error', 'Failed to load draft. Please try again.');
    }
  };

  const handleDeleteDraft = async (draftId) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedDrafts = await deleteDraft(draftId);
              setDrafts(updatedDrafts);
              
              // Clear currentDraftId if we're deleting the draft being edited
              if (currentDraftId === draftId) {
                setCurrentDraftId(null);
              }
            } catch (error) {
              console.error('Error deleting draft:', error);
              Alert.alert('Error', 'Failed to delete draft.');
            }
          }
        }
      ]
    );
  };

  // Function to reset all form values
  const resetForm = () => {
    const initialValues = getInitialFormValues();
    setName(initialValues.name); setNameWarning(false); setDesc(initialValues.description);
    setStart(initialValues.startDate); setStartTime(initialValues.startTime);
    setEnd(initialValues.endDate); setEndTime(initialValues.endTime);
    setDailyCap(initialValues.dailyCap); setPhotoProofRequired(initialValues.photoProofRequired); 
    setInvitationGracePeriod(initialValues.invitationGracePeriod);
    setLeaderboardUpdateDays(initialValues.leaderboardUpdateDays);
    setActs(initialValues.activities);
    setInviteUsername(initialValues.inviteUsername); setInvitedFriends(initialValues.invitedFriends);
    setSelectedPreset(null); animateToTab('presets');
    setExpandedCards({}); // Reset expanded cards state
    setCurrentDraftId(null); // Reset draft ID
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
    
    // Initialize dates for the preset
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + preset.duration);
    endDate.setHours(23, 59, 59, 999);
    
    setPresetStartDate(startDate);
    setPresetStartTime(startDate);
    setPresetEndDate(endDate);
    setPresetEndTime(endDate);
    
    animateToTab('schedule'); // Switch to schedule tab after selection
  };

  const goBackToPresets = () => {
    setSelectedPreset(null);
    setPresetStartDate(null);
    setPresetStartTime(null);
    setPresetEndDate(null);
    setPresetEndTime(null);
    animateToTab('presets'); // Animate back to presets tab
    setInvitedFriends([]); // Clear invited friends when going back
  };
  
  // Preset date/time handlers
  const handlePresetStartDateChange = (selectedDate) => {
    setPresetStartDate(selectedDate);
    const updatedStartTime = new Date(selectedDate);
    updatedStartTime.setHours(presetStartTime.getHours(), presetStartTime.getMinutes());
    setPresetStartTime(updatedStartTime);
    
    // Auto-adjust end date based on preset duration
    const newEndDate = new Date(selectedDate);
    newEndDate.setDate(newEndDate.getDate() + selectedPreset.duration);
    newEndDate.setHours(presetEndTime.getHours(), presetEndTime.getMinutes());
    setPresetEndDate(newEndDate);
    setPresetEndTime(newEndDate);
  };

  const handlePresetStartTimeChange = (selectedTime) => {
    setPresetStartTime(selectedTime);
    const updatedStartDate = new Date(presetStartDate);
    updatedStartDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setPresetStartDate(updatedStartDate);
  };

  const handlePresetEndDateChange = (selectedDate) => {
    setPresetEndDate(selectedDate);
    const updatedEndTime = new Date(selectedDate);
    updatedEndTime.setHours(presetEndTime.getHours(), presetEndTime.getMinutes());
    setPresetEndTime(updatedEndTime);
  };

  const handlePresetEndTimeChange = (selectedTime) => {
    setPresetEndTime(selectedTime);
    const updatedEndDate = new Date(presetEndDate);
    updatedEndDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setPresetEndDate(updatedEndDate);
  };

  const getPresetCombinedStartDateTime = () => {
    const combined = new Date(presetStartDate);
    combined.setHours(presetStartTime.getHours(), presetStartTime.getMinutes(), 0, 0);
    return combined;
  };

  const getPresetCombinedEndDateTime = () => {
    const combined = new Date(presetEndDate);
    combined.setHours(presetEndTime.getHours(), presetEndTime.getMinutes(), 59, 999);
    return combined;
  };

  // Helper function to calculate actual duration based on user-selected dates
  const getActualPresetDuration = () => {
    if (!presetStartDate || !presetEndDate) {
      return selectedPreset?.duration || 0;
    }
    const start = new Date(presetStartDate);
    const end = new Date(presetEndDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const createPresetCompetition = async () => {
    if (!selectedPreset) return;

    try {
      const startDateTime = getPresetCombinedStartDateTime();
      const endDateTime = getPresetCombinedEndDateTime();
      
      // Validate dates
      if (endDateTime <= startDateTime) {
        Alert.alert('Validation', 'End date/time must be after start date/time');
        return;
      }

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
    <ScrollView 
      ref={scrollViewRef}
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
            <Text style={styles.presetDescription} numberOfLines={2} ellipsizeMode="tail">
              {preset.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderScheduleTab = () => (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.presetHeader}>
          <TouchableOpacity onPress={goBackToPresets} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#A4D65E" />
            <Text style={styles.backButtonText}>Back to Presets</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={[styles.presetIcon, { backgroundColor: selectedPreset?.color }]}>
              <Ionicons name={selectedPreset?.icon} size={24} color="#FFFFFF" />
            </View>
            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleName}>{selectedPreset?.name}</Text>
              <Text style={styles.scheduleDuration}>
                {selectedPreset?.duration} days • {selectedPreset?.dailyCap} points/day limit
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Set Competition Schedule</Text>
          <Text style={styles.sectionSubtext}>Choose when your competition starts and ends</Text>
          
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeField}>
              <DatePicker 
                label="Start Date" 
                date={presetStartDate} 
                onDateChange={handlePresetStartDateChange}
                mode="date"
                minimumDate={new Date()}
              />
            </View>
            <View style={styles.dateTimeField}>
              <DatePicker 
                label="Start Time" 
                date={presetStartTime} 
                onDateChange={handlePresetStartTimeChange}
                mode="time"
              />
            </View>
          </View>
          
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeField}>
              <DatePicker 
                label="End Date" 
                date={presetEndDate} 
                onDateChange={handlePresetEndDateChange}
                mode="date"
                minimumDate={presetStartDate}
              />
            </View>
            <View style={styles.dateTimeField}>
              <DatePicker 
                label="End Time" 
                date={presetEndTime} 
                onDateChange={handlePresetEndTimeChange}
                mode="time"
              />
            </View>
          </View>
          
          <View style={styles.durationPreview}>
            <Text style={styles.durationText}>
              Duration: {Math.ceil((getPresetCombinedEndDateTime() - getPresetCombinedStartDateTime()) / (1000 * 60 * 60 * 24))} days
            </Text>
            <Text style={styles.durationSubtext}>
              Recommended duration: {selectedPreset?.duration} days
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => animateToTab('friends')}
        >
          <Text style={styles.createButtonText}>Continue to Invite Friends</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFriendsTab = () => (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
                            <View style={styles.friendAvatar}>
                              {friend.profilePicture ? (
                                <Image 
                                  source={{ uri: friend.profilePicture }}
                                  style={styles.friendAvatarImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Ionicons name="person-circle" size={36} color="#A4D65E" />
                              )}
                            </View>
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
                  <View style={styles.participantAvatar}>
                    {f.profilePicture ? (
                      <Image 
                        source={{ uri: f.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person-circle" size={40} color="#A4D65E"/>
                    )}
                  </View>
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
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
                {getActualPresetDuration()} days • {selectedPreset?.dailyCap} points/day limit
              </Text>
            </View>
          </View>
          
          <Text style={styles.rulesDescription}>{selectedPreset?.description}</Text>
          
          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>Goal</Text>
            <Text style={styles.rulesSectionContent}>{selectedPreset?.goal}</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>Activities & Points</Text>
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
            <Text style={styles.rulesSectionTitle}>Tips for Success</Text>
            {selectedPreset?.tips.map((tip, idx) => (
              <View key={idx} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>Competition Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{getActualPresetDuration()} days</Text>
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
                <Text style={styles.detailValue}>{selectedPreset?.dailyCap * getActualPresetDuration()}</Text>
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

  const renderDraftsTab = () => (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Drafts</Text>
        <Text style={styles.sectionSubtext}>Continue working on your saved competition drafts</Text>
        
        {loadingDrafts ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading drafts...</Text>
          </View>
        ) : drafts.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="document-outline" size={48} color="#B3B3B3" />
            <Text style={styles.emptyStateText}>No saved drafts</Text>
            <Text style={styles.emptyStateSubtext}>
              Save your competition as a draft from the Manual tab to continue editing later
            </Text>
          </View>
        ) : (
          drafts.map(draft => (
            <TouchableOpacity
              key={draft.id}
              style={styles.draftCard}
              onPress={() => handleLoadDraft(draft)}
              activeOpacity={0.7}
            >
              <View style={styles.draftCardContent}>
                <View style={styles.draftCardHeader}>
                  <View style={styles.draftCardIcon}>
                    <Ionicons name="document-text" size={24} color="#A4D65E" />
                  </View>
                  <View style={styles.draftCardInfo}>
                    <Text style={styles.draftCardName} numberOfLines={1}>
                      {draft.name}
                    </Text>
                    <Text style={styles.draftCardDate}>
                      Last saved {formatDraftDate(draft.updatedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.draftDeleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteDraft(draft.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
                {draft.description && (
                  <Text style={styles.draftCardDescription} numberOfLines={2}>
                    {draft.description}
                  </Text>
                )}
                <View style={styles.draftCardDetails}>
                  <View style={styles.draftCardDetailItem}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.draftCardDetailText}>
                      {Math.ceil((new Date(draft.endDate) - new Date(draft.startDate)) / (1000 * 60 * 60 * 24))} days
                    </Text>
                  </View>
                  <View style={styles.draftCardDetailItem}>
                    <Ionicons name="fitness-outline" size={14} color="#6B7280" />
                    <Text style={styles.draftCardDetailText}>
                      {draft.activities?.length || 0} activities
                    </Text>
                  </View>
                  <View style={styles.draftCardDetailItem}>
                    <Ionicons name="people-outline" size={14} color="#6B7280" />
                    <Text style={styles.draftCardDetailText}>
                      {draft.invitedFriends?.length || 0} invited
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
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
      <View style={styles.competitionDetailsHeader}>
        <Text style={styles.sectionTitle}>Competition Details</Text>
        <TouchableOpacity style={styles.saveDraftButton} onPress={handleSaveDraft}>
          <Text style={styles.saveDraftButtonText}>
            {currentDraftId ? 'Update Draft' : 'Save to Drafts'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.nameInputContainer}>
        <Text style={styles.label}>Competition Name</Text>
        <View style={styles.nameInputWrapper}>
          <TextInput
            style={[
              styles.nameInput,
              nameWarning && styles.nameInputWarning
            ]}
            value={name}
            onChangeText={handleNameChange}
            placeholder="Enter competition name"
            placeholderTextColor="#999"
            maxLength={14}
          />
          <View style={styles.nameInputFeedback}>
            {nameWarning && (
              <Ionicons name="warning" size={20} color="#FF6B6B" />
            )}
            <Text style={[
              styles.characterCount,
              name.length === 14 && styles.characterCountMax
            ]}>
              {name.length}/14
            </Text>
          </View>
        </View>
        {nameWarning && (
          <Text style={styles.warningText}>
            Maximum 14 characters allowed
          </Text>
        )}
      </View>
      
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
                    label="Daily Points limit"
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
                    label="Max points per week"
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
                    label="Max points per entry"
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
                        <View style={styles.friendAvatar}>
                          {friend.profilePicture ? (
                            <Image 
                              source={{ uri: friend.profilePicture }}
                              style={styles.friendAvatarImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="person-circle" size={36} color="#A4D65E" />
                          )}
                        </View>
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
              <View style={styles.participantAvatar}>
                {f.profilePicture ? (
                  <Image 
                    source={{ uri: f.profilePicture }}
                    style={styles.participantAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person-circle" size={40} color="#A4D65E"/>
                )}
              </View>
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
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <StatusBar style="dark" translucent={false} />
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCapsule} />
        </View>

        {/* Dynamic Tab Navigation - ProfileScreen Style */}
        <View style={styles.topNavContainer}>
        {/* Tab row with 3 equal columns for main tabs */}
        <View style={styles.tabRow}>
          {showPresetTabs ? (
            <>
              {/* Presets Tab */}
              <Animated.View style={[styles.tabColumn, { transform: [{ scale: presetsScale }] }]}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPressIn={() => handlePressIn(presetsScale)}
                  onPressOut={() => handlePressOut('presets', presetsScale)}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    const textWidth = width * 0.8;
                    const indicatorWidth = textWidth + 12;
                    const scale = indicatorWidth / baseUnderlineWidth;
                    const columnCenter = (screenWidth - 48) / 3 * 0 + (screenWidth - 48) / 6;
                    setTabMeasurements(prev => ({
                      ...prev,
                      presets: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                    }));
                    setMeasurementsReady(true);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'presets' }}
                >
                  <Text style={[
                    styles.tabLabel,
                    { 
                      color: activeTab === 'presets' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                      fontSize: activeTab === 'presets' ? 23 : 21
                    }
                  ]}>
                    Preset
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Manual Tab */}
              <Animated.View style={[styles.tabColumn, { transform: [{ scale: manualScale }] }]}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPressIn={() => handlePressIn(manualScale)}
                  onPressOut={() => handlePressOut('manual', manualScale)}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    const textWidth = width * 0.8;
                    const indicatorWidth = textWidth + 12;
                    const scale = indicatorWidth / baseUnderlineWidth;
                    const columnCenter = (screenWidth - 48) / 3 * 1 + (screenWidth - 48) / 6;
                    setTabMeasurements(prev => ({
                      ...prev,
                      manual: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                    }));
                    setMeasurementsReady(true);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'manual' }}
                >
                  <Text style={[
                    styles.tabLabel,
                    { 
                      color: activeTab === 'manual' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                      fontSize: activeTab === 'manual' ? 23 : 21
                    }
                  ]}>
                    Manual
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Drafts Tab */}
              <Animated.View style={[styles.tabColumn, { transform: [{ scale: draftsScale }] }]}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPressIn={() => handlePressIn(draftsScale)}
                  onPressOut={() => handlePressOut('drafts', draftsScale)}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    const textWidth = width * 0.8;
                    const indicatorWidth = textWidth + 12;
                    const scale = indicatorWidth / baseUnderlineWidth;
                    const columnCenter = (screenWidth - 48) / 3 * 2 + (screenWidth - 48) / 6;
                    setTabMeasurements(prev => ({
                      ...prev,
                      drafts: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                    }));
                    setMeasurementsReady(true);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'drafts' }}
                >
                  <Text style={[
                    styles.tabLabel,
                    { 
                      color: activeTab === 'drafts' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                      fontSize: activeTab === 'drafts' ? 23 : 21
                    }
                  ]}>
                    Drafts
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          ) : (
            <>
              {/* Schedule Tab */}
              <Animated.View style={[styles.tabColumn, { transform: [{ scale: scheduleScale }] }]}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPressIn={() => handlePressIn(scheduleScale)}
                  onPressOut={() => handlePressOut('schedule', scheduleScale)}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    const textWidth = width * 0.8;
                    const indicatorWidth = textWidth + 12;
                    const scale = indicatorWidth / baseUnderlineWidth;
                    const columnCenter = (screenWidth - 48) / 3 * 0 + (screenWidth - 48) / 6;
                    setTabMeasurements(prev => ({
                      ...prev,
                      schedule: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                    }));
                    setMeasurementsReady(true);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'schedule' }}
                >
                  <Text style={[
                    styles.tabLabel,
                    { 
                      color: activeTab === 'schedule' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                      fontSize: activeTab === 'schedule' ? 22.5 : 21
                    }
                  ]}>
                    Schedule
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
                    const columnCenter = (screenWidth - 48) / 3 * 1 + (screenWidth - 48) / 6;
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
                </TouchableOpacity>
              </Animated.View>

              {/* Rules Tab */}
              <Animated.View style={[styles.tabColumn, { transform: [{ scale: rulesScale }] }]}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPressIn={() => handlePressIn(rulesScale)}
                  onPressOut={() => handlePressOut('rules', rulesScale)}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    const textWidth = width * 0.8;
                    const indicatorWidth = textWidth + 12;
                    const scale = indicatorWidth / baseUnderlineWidth;
                    const columnCenter = (screenWidth - 48) / 3 * 2 + (screenWidth - 48) / 6;
                    setTabMeasurements(prev => ({
                      ...prev,
                      rules: { scale: Math.min(Math.max(scale, 0.6), 2.3), x: columnCenter - baseUnderlineWidth / 2 }
                    }));
                    setMeasurementsReady(true);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'rules' }}
                >
                  <Text style={[
                    styles.tabLabel,
                    { 
                      color: activeTab === 'rules' ? colors.nav.activeGreen : colors.nav.inactiveGray,
                      fontSize: activeTab === 'rules' ? 23 : 21
                    }
                  ]}>
                    Rules
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
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
      {activeTab === 'presets' && renderPresetsTab()}
      {activeTab === 'manual' && renderManualTab()}
      {activeTab === 'drafts' && renderDraftsTab()}
      {activeTab === 'schedule' && renderScheduleTab()}
      {activeTab === 'friends' && renderFriendsTab()}
      {activeTab === 'rules' && renderRulesTab()}

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  header: {
    height: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  headerCapsule: {
    // Placeholder div, no specific styling needed
  },
  
  // New top navigation styles (matching ProfileScreen)
  topNavContainer: {
    paddingHorizontal: 24,
    paddingTop: 1,   // Minimal spacing - just 1px from header (matching ProfileScreen)
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

  // Common
  scrollView: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 100 },
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
    borderColor: '#A4D65E',
    height: 132,
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
    lineHeight: 20,
  },

  // Schedule Tab
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  scheduleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  scheduleDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  durationSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
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
  participantAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  participantAvatarImage: { width: '100%', height: '100%' },
  createCompetitionButton: { marginTop: 20, marginBottom: 20 },
  
  // Friends list styles
  friendsListTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1E23', marginTop: 16, marginBottom: 8 },
  friendsListContainer: { backgroundColor: '#FFF', borderRadius: 8, marginBottom: 16, maxHeight: 200, borderWidth: 1, borderColor: '#E5E7EB' },
  friendsScrollView: { maxHeight: 180 },
  friendListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  friendInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  friendName: { fontSize: 16, color: '#1A1E23', fontWeight: '500', marginLeft: 12 },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  friendAvatarImage: { width: '100%', height: '100%' },
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
  
  // Name input specific styles
  nameInputContainer: { 
    marginBottom: 16 
  },
  nameInputWrapper: { 
    position: 'relative' 
  },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1E23',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingRight: 60, // Space for character count
  },
  nameInputWarning: {
    borderColor: '#FF6B6B',
  },
  nameInputFeedback: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  characterCountMax: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },
  
  // Competition Details Header with Save to Drafts button
  competitionDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,  // Added spacing from nav bar
    marginBottom: 16,
  },
  saveDraftButton: {
    backgroundColor: '#A4D65E',  // Solid green background for visibility
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 7.5,  // Center with sectionTitle text
  },
  saveDraftButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',  // White text on green background
  },
  
  // Draft Card Styles
  draftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  draftCardContent: {
    padding: 16,
  },
  draftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  draftCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  draftCardInfo: {
    flex: 1,
  },
  draftCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 2,
  },
  draftCardDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  draftDeleteButton: {
    padding: 8,
  },
  draftCardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  draftCardDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  draftCardDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  draftCardDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1E23',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  
  // Loading Container
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  
});