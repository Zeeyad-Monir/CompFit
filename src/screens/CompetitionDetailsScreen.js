import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, Image, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { Header, Button, FormInput, DatePicker, SearchBar, SmartKeyboardAwareScrollView } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db } from '../firebase';
import useDoneButton from '../hooks/useDoneButton';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  updateDoc,
  arrayRemove,
  increment,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import { 
  getScoreVisibility, 
  filterVisibleSubmissions,
  filterVisibleSubmissionsWithSelf,
  getVisibilityMessage 
} from '../utils/scoreVisibility';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary, uploadMultipleToCloudinary } from '../utils/uploadImage';
import CompactPhotoGallery from '../components/CompactPhotoGallery';
import FullScreenPhotoViewer from '../components/FullScreenPhotoViewer';

const CompetitionDetailsScreen = ({ route, navigation }) => {
  const { competition, initialTab } = route.params;
  
  // Debug logging for competition rules
  console.log('=== COMPETITION DETAILS LOADED ===');
  console.log('Competition name:', competition?.name);
  console.log('Total rules:', competition?.rules?.length);
  competition?.rules?.forEach((rule, idx) => {
    console.log(`Rule ${idx}:`, {
      type: rule.type,
      minPace: rule.minPace,
      minPaceType: typeof rule.minPace,
      hasPace: rule.minPace !== null && rule.minPace !== undefined,
      paceUnit: rule.paceUnit
    });
  });
  console.log('Rules with pace:', competition?.rules?.filter(r => r.minPace !== null && r.minPace !== undefined)?.map(r => ({
    type: r.type,
    minPace: r.minPace,
    paceUnit: r.paceUnit
  })));
  
  // For completed competitions, default to 'rank' tab, otherwise use initialTab or 'me'
  const defaultTab = competition.status === 'completed' ? 'rank' : (initialTab || 'me');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { user } = useContext(AuthContext);
  
  const [workouts, setWorkouts] = useState([]);
  const [users, setUsers] = useState({});
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  
  // Add tab form state variables
  const [date, setDate] = useState(new Date());
  const [activityType, setActivityType] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [sessions, setSessions] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [steps, setSteps] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [pace, setPace] = useState('');
  const [notes, setNotes] = useState('');
  const [currentDayPoints, setCurrentDayPoints] = useState(0);
  const [loadingDayPoints, setLoadingDayPoints] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageUris, setSelectedImageUris] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [showFullScreenViewer, setShowFullScreenViewer] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  const MAX_PHOTOS = 3;
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [activityDailySubmissions, setActivityDailySubmissions] = useState(0);
  
  // Done button hook for notes input with ref
  const notesInputRef = React.useRef(null);
  const notesDoneButton = useDoneButton(notesInputRef);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [activityWeeklyPoints, setActivityWeeklyPoints] = useState(0);
  const [activityLimits, setActivityLimits] = useState(null);
  
  // Add keyboard event listeners for physical device support
  React.useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);
  
  // Handle notes input focus for physical devices
  const handleNotesFocus = React.useCallback(() => {
    // Add a delay to ensure keyboard animation completes on physical devices
    if (Platform.OS === 'ios') {
      setTimeout(() => {
        // The SmartKeyboardAwareScrollView will handle the scrolling automatically
        // Additional scroll adjustment can be added here if needed
      }, 100);
    }
  }, []);
  
  // Constants for activity display management
  const ACTIVITIES_PER_ROW = 3;
  const INITIAL_ROWS = 3;
  const INITIAL_ACTIVITIES_COUNT = ACTIVITIES_PER_ROW * INITIAL_ROWS;
  
  // Get activity types from competition rules
  const activityTypes = competition?.rules?.map(r => r.type) || [];
  
  // Add tab helper functions
  const getDisplayedActivities = () => {
    if (showAllActivities || activityTypes.length <= INITIAL_ACTIVITIES_COUNT) {
      return activityTypes;
    }
    return activityTypes.slice(0, INITIAL_ACTIVITIES_COUNT);
  };
  
  const shouldShowViewMoreButton = () => {
    return activityTypes.length > INITIAL_ACTIVITIES_COUNT && !showAllActivities;
  };
  
  const shouldShowViewLessButton = () => {
    return activityTypes.length > INITIAL_ACTIVITIES_COUNT && showAllActivities;
  };
  
  const getDayBounds = (selectedDate) => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    };
  };
  
  const fetchCurrentDayPoints = async () => {
    if (!user || !competition) return;
    
    setLoadingDayPoints(true);
    try {
      const { start, end } = getDayBounds(date);
      
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('competitionId', '==', competition.id),
        where('userId', '==', user.uid),
        where('date', '>=', start),
        where('date', '<=', end)
      );
      
      const snapshot = await getDocs(submissionsQuery);
      const totalPoints = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().points || 0);
      }, 0);
      
      setCurrentDayPoints(totalPoints);
    } catch (error) {
      console.error('Error fetching daily points:', error);
      setCurrentDayPoints(0);
    } finally {
      setLoadingDayPoints(false);
    }
  };
  
  const isDateWithinCompetition = (selectedDate) => {
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    return selectedDate >= startDate && selectedDate <= endDate;
  };
  
  const handleDateChange = (selectedDate) => {
    if (!isDateWithinCompetition(selectedDate)) {
      Alert.alert(
        'Invalid Date',
        'Please select a date within the competition period.',
        [{ text: 'OK' }]
      );
      return;
    }
    setDate(selectedDate);
  };
  
  const getRule = () => competition.rules.find(r => r.type === activityType) || {};
  
  const getValueForUnit = () => {
    const rule = getRule();
    const { unit } = rule;
    
    switch (unit) {
      case 'Kilometre':
      case 'Mile':
      case 'Meter':
      case 'Yard':
        return parseFloat(distance) || 0;
      case 'Hour':
        return (parseFloat(duration) || 0) / 60;
      case 'Minute':
        return parseFloat(duration) || 0;
      case 'Calorie':
        return parseFloat(calories) || 0;
      case 'Session':
      case 'Class':
        return parseFloat(sessions) || 0;
      case 'Rep':
        return parseFloat(reps) || 0;
      case 'Set':
        return parseFloat(sets) || 0;
      case 'Step':
        return parseFloat(steps) || 0;
      default:
        return parseFloat(customValue) || 0;
    }
  };
  
  const calculatePoints = () => {
    const rule = getRule();
    const { pointsPerUnit = 0, unitsPerPoint = 1 } = rule;
    const value = getValueForUnit();
    
    const pointsEarned = Math.floor(value / unitsPerPoint) * pointsPerUnit;
    return pointsEarned;
  };
  
  const wouldExceedDailyCap = () => {
    if (!competition.dailyCap) return false;
    const newPoints = calculatePoints();
    return (currentDayPoints + newPoints) > competition.dailyCap;
  };
  
  const getFinalPoints = () => {
    const newPoints = calculatePoints();
    if (!competition.dailyCap) return newPoints;
    
    const remainingCap = competition.dailyCap - currentDayPoints;
    return Math.min(newPoints, remainingCap);
  };
  
  const getRemainingDailyPoints = () => {
    if (!competition.dailyCap) return null;
    return Math.max(0, competition.dailyCap - currentDayPoints);
  };
  
  const isInLeaderboardDelayPeriod = () => {
    if (!competition.leaderboardUpdateDays || competition.leaderboardUpdateDays === 0) {
      return false;
    }
    
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    const currentPeriod = Math.floor(daysSinceStart / competition.leaderboardUpdateDays);
    const nextUpdateDay = (currentPeriod + 1) * competition.leaderboardUpdateDays;
    const daysUntilUpdate = nextUpdateDay - daysSinceStart;
    
    return daysUntilUpdate > 0;
  };
  
  const isActivityDailyLimitReached = () => {
    if (!activityLimits) return false;
    
    if (activityLimits.maxSubmissionsPerDay && 
        activityDailySubmissions >= activityLimits.maxSubmissionsPerDay) {
      return true;
    }
    
    return false;
  };
  
  const wouldExceedWeeklyCap = (newPoints) => {
    if (!activityLimits?.maxPointsPerWeek) return false;
    return (activityWeeklyPoints + newPoints) > activityLimits.maxPointsPerWeek;
  };
  
  const applyPerSubmissionCap = (calculatedPoints) => {
    if (!activityLimits?.perSubmissionCap) return calculatedPoints;
    return Math.min(calculatedPoints, activityLimits.perSubmissionCap);
  };
  
  const getFinalPointsWithActivityLimits = () => {
    let points = calculatePoints();
    
    points = applyPerSubmissionCap(points);
    
    if (activityLimits?.maxPointsPerWeek) {
      const remainingWeekly = activityLimits.maxPointsPerWeek - activityWeeklyPoints;
      points = Math.min(points, Math.max(0, remainingWeekly));
    }
    
    if (competition.dailyCap) {
      const remainingDaily = competition.dailyCap - currentDayPoints;
      points = Math.min(points, Math.max(0, remainingDaily));
    }
    
    return points;
  };
  
  const shouldShowField = (field) => {
    const { unit } = getRule();
    
    // Show pace field when pace is required (IN ADDITION to other fields)
    if (field === 'pace') {
      return activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined;
    }
    
    // Regular logic for all other fields
    switch (field) {
      case 'duration':
        return ['Minute', 'Hour'].includes(unit);
      case 'distance':
        return ['Kilometre', 'Mile', 'Meter', 'Yard'].includes(unit);
      case 'calories':
        return unit === 'Calorie';
      case 'sessions':
        return ['Session', 'Class'].includes(unit);
      case 'reps':
        return unit === 'Rep';
      case 'sets':
        return unit === 'Set';
      case 'steps':
        return unit === 'Step';
      case 'customValue':
        return !['Minute', 'Hour', 'Kilometre', 'Mile', 'Meter', 'Yard', 'Calorie', 'Session', 'Class', 'Rep', 'Set', 'Step'].includes(unit);
      default:
        return false;
    }
  };
  
  const getFieldLabel = (field) => {
    const { unit } = getRule();
    
    switch (field) {
      case 'pace':
        if (activityLimits && activityLimits.paceUnit) {
          const unitLabels = {
            'min/km': 'Pace (min/km)',
            'min/mile': 'Pace (min/mile)',
            'km/h': 'Speed (km/h)',
            'mph': 'Speed (mph)',
            'm/min': 'Speed (m/min)'
          };
          return unitLabels[activityLimits.paceUnit] || 'Pace';
        }
        return 'Pace';
      case 'duration':
        return unit === 'Hour' ? 'Duration (hours)' : 'Duration (minutes)';
      case 'distance':
        const distanceLabels = {
          'Kilometre': 'Distance (km)',
          'Mile': 'Distance (miles)',
          'Meter': 'Distance (meters)',
          'Yard': 'Distance (yards)'
        };
        return distanceLabels[unit] || 'Distance';
      case 'calories':
        return 'Calories Burned';
      case 'sessions':
        return unit === 'Class' ? 'Number of Classes' : 'Number of Sessions';
      case 'reps':
        return 'Number of Reps';
      case 'sets':
        return 'Number of Sets';
      case 'steps':
        return 'Number of Steps';
      case 'customValue':
        return `${unit} Count`;
      default:
        return 'Value';
    }
  };
  
  const getFieldPlaceholder = (field) => {
    const { unit } = getRule();
    
    switch (field) {
      case 'pace':
        if (activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined) {
          // Use the actual minimum pace as the placeholder
          return activityLimits.minPace.toString();
        }
        return '0';
      case 'duration':
        return unit === 'Hour' ? '1.5' : '30';
      case 'distance':
        return '5.0';
      case 'calories':
        return '250';
      case 'sessions':
        return '1';
      case 'reps':
        return '10';
      case 'sets':
        return '3';
      case 'steps':
        return '1000';
      case 'customValue':
        return '1';
      default:
        return '0';
    }
  };
  
  // calculatePace function removed - now using direct pace input
  
  const validateSubmission = () => {
    if (isActivityDailyLimitReached()) {
      const limit = activityLimits.maxSubmissionsPerDay;
      const message = limit === 1 
        ? `You can only submit ${activityType} once per day`
        : `You've reached the maximum ${limit} submissions per day for ${activityType}`;
      Alert.alert('Limit Reached', message);
      return false;
    }
    
    const rule = getRule();
    const { unit } = rule;
    
    if (shouldShowField('duration') && (!duration || duration === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('duration').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('distance') && (!distance || distance === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('distance').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('calories') && (!calories || calories === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('calories').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('sessions') && (!sessions || sessions === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('sessions').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('reps') && (!reps || reps === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('reps').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('sets') && (!sets || sets === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('sets').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('steps') && (!steps || steps === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('steps').toLowerCase()}`);
      return false;
    }
    
    if (shouldShowField('customValue') && (!customValue || customValue === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('customValue').toLowerCase()}`);
      return false;
    }
    
    // Validate pace field if shown
    if (shouldShowField('pace') && (!pace || pace === '0')) {
      Alert.alert('Validation Error', `Please enter your ${getFieldLabel('pace').toLowerCase()}`);
      return false;
    }
    
    if (competition.photoProofRequired && selectedImageUris.length === 0) {
      Alert.alert('Photo Required', 'This competition requires at least one photo with every submission');
      return false;
    }
    
    // Check pace requirement if applicable
    if (activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined) {
      const enteredPace = parseFloat(pace);
      if (enteredPace && !isNaN(enteredPace)) {
        const isSpeedUnit = ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit);
        
        if (isSpeedUnit) {
          // For speed units: higher is better, so entered must be >= minimum
          if (enteredPace < activityLimits.minPace) {
            Alert.alert('Too Slow', 
              `Minimum speed required: ${activityLimits.minPace} ${activityLimits.paceUnit}. Your speed: ${enteredPace} ${activityLimits.paceUnit}`
            );
            return false;
          }
        } else {
          // For time units: lower is better, so entered must be <= minimum
          if (enteredPace > activityLimits.minPace) {
            Alert.alert('Too Slow', 
              `Maximum time allowed: ${activityLimits.minPace} ${activityLimits.paceUnit}. Your time: ${enteredPace} ${activityLimits.paceUnit}`
            );
            return false;
          }
        }
      }
    }
    
    return true;
  };
  
  const pickImage = async () => {
    try {
      setImageUploadError(null);
      
      // Check if we've reached the max photo limit
      if (selectedImageUris.length >= MAX_PHOTOS) {
        Alert.alert(
          'Photo Limit Reached',
          `You can attach a maximum of ${MAX_PHOTOS} photos per submission.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to attach photos!',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - selectedImageUris.length,
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Validate file sizes (5MB limit per photo)
        const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
        const oversizedImages = [];
        const validImages = [];
        
        for (const asset of result.assets) {
          if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
            oversizedImages.push({
              uri: asset.uri,
              sizeMB: (asset.fileSize / (1024 * 1024)).toFixed(2)
            });
          } else {
            validImages.push(asset.uri);
          }
        }
        
        if (oversizedImages.length > 0) {
          const message = oversizedImages.length === 1
            ? `1 photo exceeds the 5MB size limit (${oversizedImages[0].sizeMB}MB) and was not added.`
            : `${oversizedImages.length} photos exceed the 5MB size limit and were not added.`;
          Alert.alert('File Size Limit', message);
        }
        
        if (validImages.length > 0) {
          const combinedUris = [...selectedImageUris, ...validImages].slice(0, MAX_PHOTOS);
          setSelectedImageUris(combinedUris);
          console.log(`${validImages.length} valid images added, total: ${combinedUris.length}`);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };
  
  const removeImage = (index) => {
    const updatedUris = selectedImageUris.filter((_, i) => i !== index);
    setSelectedImageUris(updatedUris);
    if (updatedUris.length === 0) {
      setImageUploadError(null);
    }
  };
  
  const handlePhotoPress = (index) => {
    setFullScreenInitialIndex(index);
    setShowFullScreenViewer(true);
  };
  
  const submitWorkout = async (points, rule, photoUrls) => {
    try {
      const submissionData = {
        competitionId: competition.id,
        userId: user.uid,
        activityType,
        duration: parseFloat(duration) || 0,
        distance: parseFloat(distance) || 0,
        calories: parseFloat(calories) || 0,
        sessions: parseFloat(sessions) || 0,
        reps: parseFloat(reps) || 0,
        sets: parseFloat(sets) || 0,
        steps: parseFloat(steps) || 0,
        customValue: parseFloat(customValue) || 0,
        pace: parseFloat(pace) || 0,
        unit: rule.unit,
        points,
        notes,
        date: date.toISOString(),
        createdAt: serverTimestamp(),
      };
      
      if (photoUrls && photoUrls.length > 0) {
        submissionData.photoUrls = photoUrls; // New array field
        submissionData.photoUrl = photoUrls[0]; // Keep backward compatibility
      }
      
      await addDoc(collection(db,'submissions'), submissionData);
      
      // Reset form fields
      setDuration('');
      setDistance('');
      setCalories('');
      setSessions('');
      setReps('');
      setSets('');
      setSteps('');
      setCustomValue('');
      setPace('');
      setNotes('');
      setSelectedImageUris([]);
      setDate(new Date());
      
      // Switch to Me tab to show the new submission
      setActiveTab('me');
      
      const successMessage = photoUrls && photoUrls.length > 0
        ? `Workout submitted with ${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''}! You earned ${points.toFixed(1)} points.`
        : `Workout submitted! You earned ${points.toFixed(1)} points.`;
      
      Alert.alert(
        'Success!',
        successMessage,
        [{ text:'OK' }]
      );
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };
  
  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    
    if (!validateSubmission()) {
      return;
    }
    
    if (!isDateWithinCompetition(date)) {
      Alert.alert('Validation Error','Workout date must be within the competition period');
      return;
    }
    
    setIsSubmitting(true);
    
    const points = getFinalPointsWithActivityLimits();
    const rule = getRule();
    
    try {
      let photoUrls = [];
      
      if (selectedImageUris.length > 0) {
        try {
          setIsUploadingImage(true);
          setImageUploadError(null);
          console.log(`Uploading ${selectedImageUris.length} photos to Cloudinary...`);
          
          photoUrls = await uploadMultipleToCloudinary(
            selectedImageUris,
            (progress) => {
              console.log(`Upload progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
            }
          );
          
          console.log('All photos uploaded successfully:', photoUrls);
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          setImageUploadError(uploadError.message);
          setIsUploadingImage(false);
          setIsSubmitting(false);
          
          Alert.alert(
            'Photo Upload Failed',
            'Failed to upload photos. Do you want to submit without photos?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsSubmitting(false);
                }
              },
              {
                text: 'Submit Without Photos',
                onPress: async () => {
                  try {
                    await submitWorkout(points, rule, []);
                  } catch (error) {
                    // Error handling is already done in submitWorkout
                  }
                }
              }
            ]
          );
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      await submitWorkout(points, rule, photoUrls);
      
    } catch(e) {
      console.error(e);
      Alert.alert('Error','Failed to submit workout. Please try again.');
      setIsSubmitting(false);
    }
  };

  
  // Initialize activity type when competition changes
  useEffect(() => {
    if (activityTypes.length > 0 && !activityTypes.includes(activityType)) {
      setActivityType(activityTypes[0]);
    }
  }, [competition]);
  
  // Fetch current day's points whenever date changes
  useEffect(() => {
    if (activeTab === 'add') {
      fetchCurrentDayPoints();
    }
  }, [date, user, competition, activeTab]);
  
  // Get activity-specific limits from competition rules
  useEffect(() => {
    if (activityType && competition?.rules) {
      const rule = competition.rules.find(r => r.type === activityType);
      if (rule) {
        setActivityLimits({
          maxSubmissionsPerDay: rule.maxSubmissionsPerDay || null,
          maxPointsPerWeek: rule.maxPointsPerWeek || null,
          perSubmissionCap: rule.perSubmissionCap || null,
          // Include pace fields - properly handle 0 and falsy values
          minPace: rule.minPace !== null && rule.minPace !== undefined ? rule.minPace : null,
          paceUnit: rule.paceUnit || 'min/km'
        });
      } else {
        setActivityLimits(null);
      }
    }
  }, [activityType, competition]);
  
  // Query activity-specific daily submissions
  useEffect(() => {
    if (!user || !competition || !activityType || !date || activeTab !== 'add') return;
    
    const { start, end } = getDayBounds(date);
    
    const q = query(
      collection(db, 'submissions'),
      where('competitionId', '==', competition.id),
      where('userId', '==', user.uid),
      where('activityType', '==', activityType),
      where('date', '>=', start),
      where('date', '<=', end)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivityDailySubmissions(snapshot.size);
    });
    
    return () => unsubscribe();
  }, [user, competition, activityType, date, activeTab]);
  
  // Query activity-specific weekly points
  useEffect(() => {
    if (!user || !competition || !activityType || activeTab !== 'add') return;
    
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, 'submissions'),
      where('competitionId', '==', competition.id),
      where('userId', '==', user.uid),
      where('activityType', '==', activityType),
      where('date', '>=', weekStart.toISOString())
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const totalPoints = snapshot.docs.reduce((sum, doc) => sum + (doc.data().points || 0), 0);
      setActivityWeeklyPoints(totalPoints);
    });
    
    return () => unsubscribe();
  }, [user, competition, activityType, date, activeTab]);

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
    
    // Force re-fetch of users and workouts
    fetchUsers();
    fetchParticipants();
  };

  // Helper function to stop refreshing and clear timeout
  const stopRefreshing = () => {
    setRefreshing(false);
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const userMap = {};
      for (const uid of competition.participants || []) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            userMap[uid] = userDoc.data();
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
      setUsers(userMap);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const participantsList = [];
      for (const uid of competition.participants || []) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            participantsList.push({
              id: uid,
              ...userDoc.data()
            });
          }
        } catch (error) {
          console.error('Error fetching participant:', error);
        }
      }
      // Sort alphabetically by username
      participantsList.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
      setParticipants(participantsList);
    } catch (error) {
      console.error('Error in fetchParticipants:', error);
    }
  };

  /* ---------------- delete workout handler ---------------- */
  const handleDeleteWorkout = (workout) => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'submissions', workout.id));
              Alert.alert('Success', 'Activity deleted successfully');
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete activity. Please try again.');
            }
          },
        },
      ]
    );
  };

  /* ---------------- leave competition handler ---------------- */
  const handleLeaveCompetition = () => {
    Alert.alert(
      'Leave Competition?',
      'Are you sure you want to leave this competition?\n\nThis action will:\n• Remove you from the competition\n• Delete all your workout submissions\n• Remove you from the leaderboard\n• Remove this competition from your active list\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave Competition',
          style: 'destructive',
          onPress: async () => {
            try {
              // Start batch operation for atomic updates
              const batch = writeBatch(db);
              
              // 1. Query all user's submissions for this competition
              const submissionsQuery = query(
                collection(db, 'submissions'),
                where('competitionId', '==', competition.id),
                where('userId', '==', user.uid)
              );
              
              const submissionsSnapshot = await getDocs(submissionsQuery);
              
              // 2. Delete all user's submissions in batch
              submissionsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
              });
              
              // 3. Remove user from competition participants
              const competitionRef = doc(db, 'competitions', competition.id);
              batch.update(competitionRef, {
                participants: arrayRemove(user.uid)
              });
              
              // 4. Commit all changes atomically
              await batch.commit();
              
              // 5. Show success and navigate back
              Alert.alert(
                'Success',
                'You have left the competition',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('ActiveCompetitions')
                  }
                ]
              );
            } catch (error) {
              console.error('Error leaving competition:', error);
              Alert.alert('Error', 'Failed to leave competition. Please try again.');
            }
          },
        },
      ]
    );
  };

  /* ---------------- calculate and update stats ---------------- */
  const calculateAndUpdateStats = async () => {
    try {
      console.log('Calculating competition stats...');
      
      // Get all submissions for this competition
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('competitionId', '==', competition.id)
      );
      
      const snapshot = await getDocs(submissionsQuery);
      
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
      
      if (sortedRankings.length === 0) {
        console.log('No submissions found for competition');
        return { success: false, message: 'No submissions found' };
      }
      
      // Determine winner (highest points)
      const winnerId = sortedRankings[0][0];
      const winnerPoints = sortedRankings[0][1];
      
      // Get all participants except winner
      const participants = competition.participants || [];
      const losers = participants.filter(uid => uid !== winnerId);
      
      console.log(`Winner: ${winnerId} with ${winnerPoints} points`);
      console.log(`Losers: ${losers.length} participants`);
      
      // Update stats using batch write for atomicity
      const batch = writeBatch(db);
      
      // Update winner
      const winnerRef = doc(db, 'users', winnerId);
      batch.update(winnerRef, {
        wins: increment(1),
        lastUpdated: serverTimestamp(),
      });
      
      // Update losers
      losers.forEach(loserId => {
        // Only update if they actually participated (have submissions)
        if (userPoints[loserId] !== undefined) {
          const loserRef = doc(db, 'users', loserId);
          batch.update(loserRef, {
            losses: increment(1),
            lastUpdated: serverTimestamp(),
          });
        }
      });
      
      // Also update the competition with the calculated winner
      const competitionRef = doc(db, 'competitions', competition.id);
      batch.update(competitionRef, {
        winnerId: winnerId,
        winnerPoints: winnerPoints,
        completedAt: serverTimestamp(),
        finalRankings: sortedRankings.map(([userId, points], index) => ({
          userId,
          points,
          position: index + 1
        }))
      });
      
      await batch.commit();
      console.log('Stats updated successfully');
      
      return {
        success: true,
        winnerId,
        winnerPoints,
        totalParticipants: sortedRankings.length
      };
      
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { success: false, error: error.message };
    }
  };

  /* ---------------- end competition handler ---------------- */
  const handleEndCompetition = async () => {
    // Check if competition is already completed
    if (competition.status === 'completed') {
      Alert.alert('Info', 'This competition is already completed');
      return;
    }
    
    // Check if user is the owner
    if (competition.ownerId !== user.uid) {
      Alert.alert('Error', 'Only the competition owner can end it');
      return;
    }
    
    Alert.alert(
      'End Competition',
      'This will finalize the results and update win/loss records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            setIsCompleting(true);
            try {
              // First calculate and update stats
              const statsResult = await calculateAndUpdateStats();
              
              if (!statsResult.success) {
                if (statsResult.message === 'No submissions found') {
                  Alert.alert('Cannot End', 'No submissions found. At least one participant must submit a workout.');
                } else {
                  Alert.alert('Error', statsResult.error || 'Failed to calculate competition results');
                }
                setIsCompleting(false);
                return;
              }
              
              // Update competition status to completed
              await updateDoc(doc(db, 'competitions', competition.id), {
                status: 'completed'
              });
              
              // Get winner's username for the success message
              let winnerName = 'Unknown';
              try {
                const winnerDoc = await getDoc(doc(db, 'users', statsResult.winnerId));
                if (winnerDoc.exists()) {
                  winnerName = winnerDoc.data().username || 'Unknown';
                }
              } catch (error) {
                console.log('Could not fetch winner name:', error);
              }
              
              Alert.alert(
                'Competition Ended!', 
                `Winner: ${winnerName} with ${statsResult.winnerPoints} points!\n\nAll participant stats have been updated.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error ending competition:', error);
              Alert.alert('Error', 'Failed to end competition. Please try again.');
            } finally {
              setIsCompleting(false);
            }
          }
        }
      ]
    );
  };

  /* ---------------- navigation handlers ---------------- */
  const handleWorkoutPress = (workout, userName) => {
    navigation.navigate('WorkoutDetails', { 
      workout, 
      competition,
      userName 
    });
  };

  useEffect(() => {
    if (!competition?.id) {
      stopRefreshing();
      return;
    }

    // Calculate visibility status
    const visibilityStatus = getScoreVisibility(competition);
    setVisibility(visibilityStatus);

    // Fetch user data for all participants
    fetchUsers();
    fetchParticipants();

    // Listen to submissions for this competition
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('competitionId', '==', competition.id)
      // Temporarily removed orderBy until index is created
      // orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      submissionsQuery, 
      (snapshot) => {
        const allSubmissions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Mark as notification if it's a new submission from someone else
          isNotification: doc.data().userId !== user.uid && 
                         doc.data().createdAt?.toDate() > new Date(Date.now() - 3600000) // Last hour
        }));
        
        // Filter submissions based on visibility rules, always showing user's own
        const visibleSubmissions = filterVisibleSubmissionsWithSelf(allSubmissions, competition, user.uid);
        
        // Always use filtered submissions - the filter handles showing user's own submissions
        setWorkouts(visibleSubmissions);
        setLoading(false);
        stopRefreshing(); // Stop refresh spinner when data loads
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
  }, [competition?.id, user.uid]);

  // Fetch rankings data when rank tab is active
  useEffect(() => {
    if (activeTab === 'rank' && competition?.id) {
      setRankingsLoading(true);
      
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('competitionId', '==', competition.id)
      );

      const unsubscribe = onSnapshot(
        submissionsQuery, 
        async (snapshot) => {
          try {
            const allSubmissions = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            const visibleSubmissions = filterVisibleSubmissionsWithSelf(allSubmissions, competition, user.uid);
            
            const pointsByUser = {};
            visibleSubmissions.forEach(submission => {
              const userId = submission.userId;
              if (!pointsByUser[userId]) {
                pointsByUser[userId] = 0;
              }
              pointsByUser[userId] += submission.points || 0;
            });

            const userDataPromises = competition.participants.map(async (uid) => {
              try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                
                return {
                  id: uid,
                  name: userData.username || 'Unknown User',
                  points: pointsByUser[uid] || 0,
                  isCurrentUser: uid === user.uid,
                  avatarUrl: userData.profilePicture || userData.photoURL || userData.photoUrl || userData.avatarUrl || null,
                };
              } catch (error) {
                return {
                  id: uid,
                  name: 'Unknown User',
                  points: pointsByUser[uid] || 0,
                  isCurrentUser: uid === user.uid,
                  avatarUrl: null,
                };
              }
            });

            const usersWithPoints = await Promise.all(userDataPromises);
            
            const sortedRankings = usersWithPoints
              .sort((a, b) => b.points - a.points)
              .map((user, index) => ({
                ...user,
                position: index + 1,
              }));

            setRankings(sortedRankings);
            setRankingsLoading(false);
          } catch (error) {
            console.error('Error processing leaderboard:', error);
            setRankingsLoading(false);
          }
        },
        (error) => {
          console.error('Error fetching rankings:', error);
          setRankingsLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [activeTab, competition?.id, competition?.participants, user.uid]);

  // Get the primary value and unit for display based on the workout's unit type
  const getPrimaryValueAndUnit = (workout) => {
    const { unit } = workout;
    
    switch (unit) {
      case 'Kilometre':
        return { value: workout.distance || 0, displayUnit: 'km' };
      case 'Mile':
        return { value: workout.distance || 0, displayUnit: 'miles' };
      case 'Meter':
        return { value: workout.distance || 0, displayUnit: 'm' };
      case 'Yard':
        return { value: workout.distance || 0, displayUnit: 'yards' };
      case 'Hour':
        return { value: workout.duration || 0, displayUnit: 'hours' };
      case 'Minute':
        return { value: workout.duration || 0, displayUnit: 'min' };
      case 'Calorie':
        return { value: workout.calories || 0, displayUnit: 'cal' };
      case 'Session':
        return { value: workout.sessions || 0, displayUnit: 'sessions' };
      case 'Class':
        return { value: workout.sessions || 0, displayUnit: 'classes' };
      case 'Rep':
        return { value: workout.reps || 0, displayUnit: 'reps' };
      case 'Set':
        return { value: workout.sets || 0, displayUnit: 'sets' };
      case 'Step':
        return { value: workout.steps || 0, displayUnit: 'steps' };
      default:
        // For custom units, use the custom value and the unit name
        return { value: workout.customValue || 0, displayUnit: unit.toLowerCase() };
    }
  };

  // Format workout display with proper unit handling
  const formatWorkoutDisplay = (workout) => {
    const userName = users[workout.userId]?.username || 'Unknown User';
    const primaryValue = getPrimaryValueAndUnit(workout);
    
    return {
      ...workout,
      userName,
      primaryValue,
      // Just show the activity type as the title
      activityTitle: workout.activityType,
    };
  };

  // Filter workouts based on tab and search query
  const filteredWorkouts = useMemo(() => {
    let baseWorkouts = workouts;
    
    // Apply tab filter first
    if (activeTab === 'me') {
      // Me tab: only show current user's submissions
      baseWorkouts = workouts.filter(w => w.userId === user.uid);
    } else if (activeTab === 'others') {
      // Others tab: show only other users' submissions
      // During hidden period, these are already filtered at data layer
      baseWorkouts = workouts.filter(w => w.userId !== user.uid);
    }
    
    // Then apply search filter
    if (!searchQuery.trim()) {
      return baseWorkouts;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return baseWorkouts.filter(workout => {
      const userName = users[workout.userId]?.username || 'Unknown User';
      const activityType = workout.activityType || '';
      
      return userName.toLowerCase().includes(query) || 
             activityType.toLowerCase().includes(query);
    });
  }, [workouts, users, searchQuery, activeTab, user.uid]);

  // Format competition dates
  const formatCompetitionDates = () => {
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    
    const formatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    return {
      start: startDate.toLocaleDateString('en-US', formatOptions),
      end: endDate.toLocaleDateString('en-US', formatOptions)
    };
  };

  // Render Rules Tab Content
  const renderRulesTab = () => (
    <ScrollView 
      style={styles.rulesContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#A4D65E']} // Android
          tintColor="#A4D65E" // iOS
        />
      }
    >
      {/* Description Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Description</Text>
        <View style={styles.rulesSectionContent}>
          <Text style={styles.descriptionText}>
            {competition.description || 'No description provided.'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Competition Dates Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Competition Dates</Text>
        <View style={styles.rulesSectionContent}>
          <View style={styles.dateItem}>
            <View style={styles.dateIcon}>
              <Ionicons name="play-circle" size={24} color="#4CAF50" />
            </View>
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{formatCompetitionDates().start}</Text>
            </View>
          </View>
          
          <View style={styles.dateItem}>
            <View style={styles.dateIcon}>
              <Ionicons name="stop-circle" size={24} color="#FF6B6B" />
            </View>
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>{formatCompetitionDates().end}</Text>
            </View>
          </View>

          {competition.dailyCap > 0 && (
            <View style={styles.dailyCapItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="speedometer" size={24} color="#FF9800" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Daily Point Limit</Text>
                <Text style={styles.dateValue}>{competition.dailyCap} points per day</Text>
              </View>
            </View>
          )}
          
          {competition.photoProofRequired && (
            <View style={styles.photoRequirementItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="camera" size={24} color="#4CAF50" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Photo Proof</Text>
                <Text style={styles.dateValue}>Required for all submissions</Text>
              </View>
            </View>
          )}
          
          {competition.invitationGracePeriod === false && (
            <View style={styles.gracePeriodItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="time" size={24} color="#FF9800" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Grace Period</Text>
                <Text style={styles.dateValue}>No late joins allowed</Text>
              </View>
            </View>
          )}
          
          {competition.leaderboardUpdateDays > 0 && (
            <View style={styles.leaderboardUpdateItem}>
              <View style={styles.dateIcon}>
                <Ionicons name="eye-off" size={24} color="#3B82F6" />
              </View>
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Leaderboard Updates</Text>
                <Text style={styles.dateValue}>
                  Every {competition.leaderboardUpdateDays} day{competition.leaderboardUpdateDays > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Activity Scoring Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>Activity Scoring</Text>
        <View style={styles.rulesSectionContent}>
          {competition.rules && competition.rules.length > 0 ? (
            competition.rules.map((rule, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="fitness" size={24} color="#A4D65E" />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityType}>{rule.type}</Text>
                  <Text style={styles.activityScoring}>
                    {rule.unitsPerPoint} {rule.unit.toLowerCase()}{rule.unitsPerPoint !== 1 ? 's' : ''} = {rule.pointsPerUnit} point{rule.pointsPerUnit !== 1 ? 's' : ''}
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
                          • Min pace: {rule.minPace} {rule.paceUnit}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No activity rules defined.</Text>
          )}
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Participants Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesSectionTitle}>
          Participants ({participants.length})
        </Text>
        <View style={styles.rulesSectionContent}>
          {participants.length > 0 ? (
            participants.map((participant) => (
              <View key={participant.id} style={styles.participantItem}>
                <View style={styles.participantAvatar}>
                  {participant.profilePicture ? (
                    <Image 
                      source={{ uri: participant.profilePicture }}
                      style={styles.participantAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person-circle" size={40} color="#A4D65E" />
                  )}
                </View>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.username || 'Unknown User'}
                  </Text>
                  <Text style={styles.participantHandle}>
                    @{participant.handle || participant.username || 'unknown'}
                  </Text>
                </View>
                {participant.id === competition.ownerId && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerText}>Owner</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No participants found.</Text>
          )}
        </View>
      </View>

      {/* End Competition Section - Only show for owner if not completed */}
      {user.uid === competition.ownerId && competition.status !== 'completed' && (
        <>
          <View style={styles.sectionDivider} />
          
          <View style={styles.endCompetitionSection}>
            <TouchableOpacity 
              style={[
                styles.endCompetitionButton,
                isCompleting && styles.endingButton
              ]}
              onPress={handleEndCompetition}
              activeOpacity={0.8}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Text style={styles.endCompetitionText}>Calculating Results...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.endCompetitionText}>End Competition</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.endCompetitionWarning}>
              This will finalize results and update win/loss records
            </Text>
          </View>
        </>
      )}

      {/* Leave Competition Section - Only show if user is not the owner */}
      {user.uid !== competition.ownerId && (
        <>
          <View style={styles.sectionDivider} />
          
          <View style={styles.leaveCompetitionSection}>
            <TouchableOpacity 
              style={styles.leaveCompetitionButton}
              onPress={handleLeaveCompetition}
              activeOpacity={0.8}
            >
              <Ionicons name="exit-outline" size={24} color="#FF4444" />
              <Text style={styles.leaveCompetitionText}>Leave Competition</Text>
            </TouchableOpacity>
            <Text style={styles.leaveCompetitionWarning}>
              Leaving will permanently remove all your data from this competition
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  // Render Rank Tab Content
  const renderRankTab = () => {
    // Separate top 3 from the rest
    const topThree = rankings.slice(0, 3);
    const restOfRankings = rankings.slice(3);

    if (rankingsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      );
    }

    return (
      <View style={styles.rankContainer}>
        {/* Visibility banner for Rank tab */}
        {visibility && visibility.isInHiddenPeriod && (
          <View style={styles.visibilityBanner}>
            <Ionicons name="eye-off" size={20} color="#007AFF" />
            <Text style={styles.visibilityText}>
              {getVisibilityMessage(visibility)} • {visibility.nextRevealDate ? 
                visibility.nextRevealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
            </Text>
          </View>
        )}
        {/* Podium Container for Top 3 */}
        <View style={styles.podiumContainer}>
          {topThree.length > 0 && (
            <View style={styles.topThreeContainer}>
              {/* Reorder for podium display: 2nd, 1st, 3rd */}
              {[1, 0, 2].map(index => {
                const user = topThree[index];
                if (!user) return <View key={index} style={styles.topUserColumn} />;
                
                const isFirst = user.position === 1;
                const avatarSize = isFirst ? 96 : 80;
                const hasPhoto = !!user.avatarUrl;
                // Lighter medal backgrounds for placeholders
                const medalBg = user.position === 1
                  ? '#FFF4CC' // light gold
                  : user.position === 2
                  ? '#ECEFF4' // light silver
                  : user.position === 3
                  ? '#F3E0D3' // light bronze
                  : '#F5F5F5';
                
                return (
                  <View 
                    key={user.id} 
                    style={[
                      styles.topUserColumn,
                      isFirst && styles.firstPlaceOffset,
                      !isFirst && styles.secondThirdPlaceOffset,
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.topUserTouchable}
                      activeOpacity={0.7}
                    >
                      {/* Removed crown/trophy above first place as requested */}
                      
                      {/* Avatar with ring */}
                      <View style={[
                        styles.avatarContainer,
                        { width: avatarSize, height: avatarSize }
                      ]}>
                        <View style={[
                          styles.avatarRing,
                          { width: avatarSize, height: avatarSize }
                        ]}>
                          <View style={[styles.avatarInner, { backgroundColor: hasPhoto ? '#F5F5F5' : medalBg }]}>
                            {hasPhoto ? (
                              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                            ) : (
                              <Ionicons name="person" size={isFirst ? 48 : 40} color="#777" />
                            )}
                          </View>
                        </View>
                        
                        {/* Rank badge */}
                        <View style={[
                          styles.rankBadge,
                          user.position === 1 && styles.goldBadge,
                          user.position === 2 && styles.silverBadge,
                          user.position === 3 && styles.bronzeBadge
                        ]}>
                          <Text style={styles.rankBadgeText}>{user.position}</Text>
                        </View>
                      </View>
                      
                      {/* User name */}
                      <Text style={[
                        styles.podiumUserName,
                        user.isCurrentUser && styles.currentUserText
                      ]} numberOfLines={1} ellipsizeMode="tail">
                        {user.isCurrentUser ? 'You' : user.name}
                      </Text>
                      
                      {/* Points with star */}
                      <View style={styles.podiumPointsContainer}>
                        <Ionicons name="star" size={14} color="#A4E64F" />
                        <Text style={styles.podiumPointsText}>
                          {`${user.points.toFixed(0)} pts`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          {/* Dynamic bars for Top 3 (relative to their points) */}
          {topThree.length > 0 && (
            <View style={styles.topThreeBarsRow}>
              {(() => {
                const order = [1, 0, 2]; // 2nd, 1st, 3rd to match podium layout
                const maxPoints = Math.max(...topThree.map(u => u?.points || 0));
                const maxBarHeight = 94; // px (15% shorter)
                const minBarHeight = 28; // ensures visibility even with 0 pts
                return order.map((idx, i) => {
                  const user = topThree[idx];
                  if (!user) return <View key={i} style={styles.barSpacer} />;
                  const ratio = maxPoints > 0 ? user.points / maxPoints : 0;
                  const isFirst = user.position === 1;
                  const height = Math.max(minBarHeight, Math.round(ratio * maxBarHeight));
                  return (
                    <View key={user.id} style={styles.barWrapper}>
                      <View
                        style={[
                          styles.podiumBar,
                          isFirst ? styles.podiumBarFirst : styles.podiumBarOther,
                          { height }
                        ]}
                      />
                    </View>
                  );
                });
              })()}
            </View>
          )}
        </View>

        {/* Rankings List */}
        <View style={styles.rankingsContainer}>
          <Text style={styles.rankingsTitle}>Rankings</Text>
          <View style={styles.rankingsBackground}>
            <ScrollView 
              style={styles.rankingsList}
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
              {rankings.length === 0 ? (
                <Text style={styles.emptyText}>No submissions yet. Be the first to earn points!</Text>
              ) : (
                restOfRankings.map((user, index) => (
                  <View 
                    key={user.id} 
                    style={[
                      styles.rankingItem, 
                      user.isCurrentUser && styles.currentUserRanking,
                      index === restOfRankings.length - 1 && styles.lastRankingItem
                    ]}
                  >
                    <View style={[
                      styles.rankingPositionBadge,
                      user.position === 1 && styles.goldBadge,
                      user.position === 2 && styles.silverBadge,
                      user.position === 3 && styles.bronzeBadge
                    ]}>
                      <Text style={styles.rankingPositionText}>{user.position}</Text>
                    </View>
                    <View style={styles.rankingUserImageContainer}>
                      {user.avatarUrl ? (
                        <Image 
                          source={{ uri: user.avatarUrl }} 
                          style={styles.rankingUserImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person-circle" size={36} color="#777" />
                      )}
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
                      {`${user.points.toFixed(0)} pts`}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };
  
  // Render Add Tab Content
  const renderAddTab = () => {
    const competitionStartDate = new Date(competition.startDate);
    const competitionEndDate = new Date(competition.endDate);
    
    return (
      <SmartKeyboardAwareScrollView 
        style={styles.addContainer}
        contentContainerStyle={styles.addScrollContent}
        extraScrollHeight={Platform.OS === 'ios' ? 140 : 100}
        extraHeight={Platform.OS === 'ios' ? 160 : 130}
        enableAutomaticScroll={true}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        viewIsInsideTabBar={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#A4D65E']}
            tintColor="#A4D65E"
          />
        }
      >
        {/* Date Picker with Competition Period Info */}
        <View style={styles.dateSection}>
          <DatePicker 
            label="Workout Date" 
            date={date} 
            onDateChange={handleDateChange}
            mode="date"
            minimumDate={competitionStartDate}
            maximumDate={competitionEndDate}
          />
          <Text style={styles.dateRangeText}>
            Competition Period: {competitionStartDate.toLocaleDateString()} - {competitionEndDate.toLocaleDateString()}
          </Text>
        </View>

        {/* Activity Type with View more functionality */}
        <Text style={styles.label}>Activity Type</Text>
        <View style={styles.activityTypesContainer}>
          {getDisplayedActivities().map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.activityTypeButton,
                activityType === type && styles.selectedActivityType
              ]}
              onPress={() => setActivityType(type)}
              disabled={isSubmitting}
            >
              <Text style={[
                styles.activityTypeText,
                activityType === type && styles.selectedActivityTypeText
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* View More Button */}
          {shouldShowViewMoreButton() && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => setShowAllActivities(true)}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              <Ionicons name="chevron-down" size={20} color="#A4D65E" />
              <Text style={styles.viewMoreText}>
                View more ({activityTypes.length - INITIAL_ACTIVITIES_COUNT} more)
              </Text>
            </TouchableOpacity>
          )}
          
          {/* View Less Button */}
          {shouldShowViewLessButton() && (
            <TouchableOpacity
              style={styles.viewLessButton}
              onPress={() => setShowAllActivities(false)}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              <Ionicons name="chevron-up" size={20} color="#A4D65E" />
              <Text style={styles.viewLessText}>View less</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dynamic input fields based on the competition's unit requirements */}
        <View style={styles.inputFieldsContainer}>
          {/* Duration field - for time-based units */}
          {shouldShowField('duration') && (
            <FormInput
              label={getFieldLabel('duration')}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('duration')}
              editable={!isSubmitting}
            />
          )}

          {/* Distance field - for distance-based units */}
          {shouldShowField('distance') && (
            <FormInput
              label={getFieldLabel('distance')}
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('distance')}
              editable={!isSubmitting}
            />
          )}

          {/* Calories field - for calorie-based units */}
          {shouldShowField('calories') && (
            <FormInput
              label={getFieldLabel('calories')}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('calories')}
              editable={!isSubmitting}
            />
          )}

          {/* Sessions field - for session/class-based units */}
          {shouldShowField('sessions') && (
            <FormInput
              label={getFieldLabel('sessions')}
              value={sessions}
              onChangeText={setSessions}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('sessions')}
              editable={!isSubmitting}
            />
          )}

          {/* Reps field - for rep-based units */}
          {shouldShowField('reps') && (
            <FormInput
              label={getFieldLabel('reps')}
              value={reps}
              onChangeText={setReps}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('reps')}
              editable={!isSubmitting}
            />
          )}

          {/* Sets field - for set-based units */}
          {shouldShowField('sets') && (
            <FormInput
              label={getFieldLabel('sets')}
              value={sets}
              onChangeText={setSets}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('sets')}
              editable={!isSubmitting}
            />
          )}

          {/* Steps field - for step-based units */}
          {shouldShowField('steps') && (
            <FormInput
              label={getFieldLabel('steps')}
              value={steps}
              onChangeText={setSteps}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('steps')}
              editable={!isSubmitting}
            />
          )}

          {/* Custom value field - for custom units */}
          {shouldShowField('customValue') && (
            <FormInput
              label={getFieldLabel('customValue')}
              value={customValue}
              onChangeText={setCustomValue}
              keyboardType="numeric"
              placeholder={getFieldPlaceholder('customValue')}
              editable={!isSubmitting}
            />
          )}

          {/* Pace field - for pace-required activities (additional requirement) */}
          {shouldShowField('pace') && (
            <FormInput
              label={getFieldLabel('pace')}
              value={pace}
              onChangeText={setPace}
              keyboardType="decimal-pad"
              placeholder={getFieldPlaceholder('pace')}
              editable={!isSubmitting}
            />
          )}
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          ref={notesInputRef}
          style={styles.textArea}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          onFocus={handleNotesFocus}
          placeholder="Add any additional details..."
          placeholderTextColor="#999"
          editable={!isSubmitting}
          inputAccessoryViewID={notesDoneButton.inputAccessoryViewID}
          // iOS physical device optimizations
          blurOnSubmit={Platform.OS === 'android'}
          returnKeyType="default"
          enablesReturnKeyAutomatically={true}
          textAlignVertical="top"
          autoCorrect={false}
          scrollEnabled={Platform.OS === 'ios'}
          spellCheck={true}
          keyboardType="default"
        />

        {/* Points Preview with correct unit display */}
        {activityType && (
          <View style={styles.pointsPreview}>
            <View>
              <Text style={styles.pointsLabel}>Points Earned:</Text>
              <Text style={styles.pointsFormula}>
                ({getRule().unit} ÷ {getRule().unitsPerPoint} × {getRule().pointsPerUnit})
              </Text>
            </View>
            <Text style={styles.pointsValue}>{calculatePoints().toFixed(1)}</Text>
          </View>
        )}

        {/* Daily Cap Warning for Points */}
        {competition.dailyCap && wouldExceedDailyCap() && (
          <View style={styles.pointsWarning}>
            <Text style={styles.pointsWarningText}>
              Only {getFinalPointsWithActivityLimits().toFixed(1)} points will count due to limits.
            </Text>
          </View>
        )}

        {/* Activity-Specific Limits Info */}
        {activityType && activityLimits && (activityLimits.maxSubmissionsPerDay || 
          activityLimits.maxPointsPerWeek || activityLimits.perSubmissionCap) && (
          <View style={styles.activityLimitsInfo}>
            <View style={styles.limitHeader}>
              <Text style={styles.limitTitle}>Activity Limits for {activityType}</Text>
              <Ionicons name="information-circle" size={20} color="#6B7280" />
            </View>
            
            {/* Max submissions per day */}
            {activityLimits.maxSubmissionsPerDay && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Daily Submissions:</Text>
                <Text style={[
                  styles.limitValue,
                  isActivityDailyLimitReached() && styles.limitReached
                ]}>
                  {activityDailySubmissions} / {activityLimits.maxSubmissionsPerDay}
                </Text>
              </View>
            )}
            
            {/* Weekly points cap */}
            {activityLimits.maxPointsPerWeek && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Weekly Points:</Text>
                <Text style={[
                  styles.limitValue,
                  activityWeeklyPoints >= activityLimits.maxPointsPerWeek && styles.limitReached
                ]}>
                  {activityWeeklyPoints.toFixed(1)} / {activityLimits.maxPointsPerWeek}
                </Text>
              </View>
            )}
            
            {/* Per-submission cap */}
            {activityLimits.perSubmissionCap && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Max per submission:</Text>
                <Text style={styles.limitValue}>{activityLimits.perSubmissionCap} pts</Text>
              </View>
            )}
            
            {/* Pace requirement */}
            {activityLimits.minPace !== null && activityLimits.minPace !== undefined && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>
                  {['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit) ? 'Minimum speed:' : 'Maximum time:'}
                </Text>
                <Text style={styles.limitValue}>
                  {activityLimits.minPace} {activityLimits.paceUnit}
                </Text>
              </View>
            )}
            
            {/* Current pace display - show entered pace with validation */}
            {activityLimits.minPace !== null && activityLimits.minPace !== undefined && pace && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Your entered pace:</Text>
                <Text style={[
                  styles.limitValue,
                  (() => {
                    const enteredPace = parseFloat(pace);
                    if (!enteredPace || isNaN(enteredPace)) return false;
                    const isSpeedUnit = ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit);
                    return isSpeedUnit 
                      ? enteredPace < activityLimits.minPace && styles.limitReached
                      : enteredPace > activityLimits.minPace && styles.limitReached;
                  })()
                ]}>
                  {pace} {activityLimits.paceUnit}
                  {(() => {
                    const enteredPace = parseFloat(pace);
                    if (!enteredPace || isNaN(enteredPace)) return '';
                    const isSpeedUnit = ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit);
                    return isSpeedUnit
                      ? (enteredPace < activityLimits.minPace ? ' ❌' : ' ✅')
                      : (enteredPace > activityLimits.minPace ? ' ❌' : ' ✅');
                  })()}
                </Text>
              </View>
            )}
            
            {/* Warning if limits affect current submission */}
            {(wouldExceedWeeklyCap(calculatePoints()) || 
              (activityLimits.perSubmissionCap && calculatePoints() > activityLimits.perSubmissionCap)) && (
              <Text style={styles.limitWarning}>
                ⚠️ Points will be capped due to activity limits
              </Text>
            )}
          </View>
        )}

        {/* Daily Cap Information */}
        {competition.dailyCap && (
          <View style={[
            styles.dailyCapInfo,
            wouldExceedDailyCap() && styles.dailyCapWarning
          ]}>
            <View style={styles.dailyCapHeader}>
              <Text style={[
                styles.dailyCapTitle,
                wouldExceedDailyCap() && styles.dailyCapWarningText
              ]}>
                Daily Progress
              </Text>
              {loadingDayPoints && (
                <Text style={styles.loadingText}>Loading...</Text>
              )}
            </View>
            <Text style={[
              styles.dailyCapText,
              wouldExceedDailyCap() && styles.dailyCapWarningText
            ]}>
              {`${currentDayPoints} / ${competition.dailyCap} points used today`}
              {isInLeaderboardDelayPeriod() && ' (your submissions only)'}
            </Text>
            {wouldExceedDailyCap() && (
              <Text style={styles.warningText}>
                ⚠️ This submission would exceed your daily limit!
              </Text>
            )}
            {getRemainingDailyPoints() !== null && getRemainingDailyPoints() > 0 && (
              <Text style={styles.remainingText}>
                {getRemainingDailyPoints()} points remaining today
              </Text>
            )}
            {isInLeaderboardDelayPeriod() && (
              <Text style={styles.delayPeriodText}>
                Scores hidden during delay period
              </Text>
            )}
          </View>
        )}

        {/* Photo Evidence Section - now supports multiple photos */}
        <Text style={styles.label}>
          Add Photo Evidence {competition.photoProofRequired ? '(Required)' : '(Optional)'}
          {selectedImageUris.length > 0 ? ` (${selectedImageUris.length}/${MAX_PHOTOS})` : ''}
        </Text>
        {competition.photoProofRequired && (
          <Text style={styles.photoRequiredText}>
            ⚠️ Photo proof is required for this competition (up to {MAX_PHOTOS} photos)
          </Text>
        )}
        
        {selectedImageUris.length > 0 ? (
          // Show photo gallery when images are selected
          <View style={styles.photoGalleryContainer}>
            <CompactPhotoGallery
              photos={selectedImageUris}
              onPhotoPress={handlePhotoPress}
              onRemovePhoto={removeImage}
              showRemoveButton={true}
              showIndicator={true}
            />
            {selectedImageUris.length < MAX_PHOTOS && (
              <TouchableOpacity 
                style={[styles.addMorePhotosButton, isSubmitting && styles.disabledButton]}
                onPress={pickImage}
                disabled={isSubmitting}
              >
                <Ionicons name="add-circle-outline" size={24} color="#A4D65E"/>
                <Text style={styles.addMorePhotosText}>
                  Add More Photos ({MAX_PHOTOS - selectedImageUris.length} remaining)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Show attach photo button when no images are selected
          <TouchableOpacity 
            style={[styles.addPhotoButton, isSubmitting && styles.disabledButton]}
            onPress={pickImage}
            disabled={isSubmitting}
          >
            <Ionicons name="camera" size={40} color="#A4D65E"/>
            <Text style={styles.addPhotoText}>Attach Photos from Gallery (up to {MAX_PHOTOS})</Text>
          </TouchableOpacity>
        )}

        {/* Full Screen Photo Viewer */}
        <FullScreenPhotoViewer
          visible={showFullScreenViewer}
          photos={selectedImageUris}
          initialIndex={fullScreenInitialIndex}
          onClose={() => setShowFullScreenViewer(false)}
        />

        {/* Show upload error if any */}
        {imageUploadError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              <Ionicons name="alert-circle" size={16} color="#FF6B6B"/> {imageUploadError}
            </Text>
          </View>
        )}

        {/* Submit button with loading states */}
        <Button 
          title={
            isUploadingImage 
              ? "Uploading Photo..." 
              : isSubmitting 
                ? "Submitting..." 
                : "Submit Workout"
          }
          onPress={handleSubmit} 
          style={[
            styles.submitButton,
            (isSubmitting || isUploadingImage) && styles.disabledButton
          ]}
          disabled={loadingDayPoints || isSubmitting || isUploadingImage}
        />

        {/* Show loading indicator when uploading */}
        {isUploadingImage && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A4D65E" />
            <Text style={styles.uploadingText}>Uploading photo to cloud...</Text>
          </View>
        )}
      </SmartKeyboardAwareScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title="" 
        backgroundColor="#FFFFFF"
      />
      <StatusBar style="dark" />
      
      
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#A4D65E" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.tabContainer, competition.status === 'completed' && styles.completedTabContainer]}>
        {competition.status === 'completed' ? (
          // Completed competition - only show Rank and Rules tabs
          <>
            {/* Rank Tab */}
            <TouchableOpacity 
              style={[styles.completedTab, activeTab === 'rank' && styles.activeTab]} 
              onPress={() => setActiveTab('rank')}
            >
              <Text style={[styles.tabText, activeTab === 'rank' && styles.activeTabText]}>Rank</Text>
            </TouchableOpacity>
            
            {/* Rules Tab */}
            <TouchableOpacity 
              style={[styles.completedTab, activeTab === 'rules' && styles.activeTab]} 
              onPress={() => setActiveTab('rules')}
            >
              <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>Rules</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Active competition - show all tabs
          <>
            {/* Me Tab */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'me' && styles.activeTab]} 
              onPress={() => setActiveTab('me')}
            >
              <Text style={[styles.tabText, activeTab === 'me' && styles.activeTabText]}>Me</Text>
            </TouchableOpacity>
            
            {/* Others Tab */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'others' && styles.activeTab]} 
              onPress={() => setActiveTab('others')}
            >
              <Text style={[styles.tabText, activeTab === 'others' && styles.activeTabText]}>Others</Text>
            </TouchableOpacity>
            
            {/* Rank Tab */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'rank' && styles.activeTab]} 
              onPress={() => setActiveTab('rank')}
            >
              <Text style={[styles.tabText, activeTab === 'rank' && styles.activeTabText]}>Rank</Text>
            </TouchableOpacity>
            
            {/* Add Tab */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'add' && styles.activeTab]} 
              onPress={() => setActiveTab('add')}
            >
              <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
            </TouchableOpacity>

            {/* Rules Tab */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'rules' && styles.activeTab]} 
              onPress={() => setActiveTab('rules')}
            >
              <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>Rules</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Visibility info banner for Others tab */}
      {activeTab === 'others' && visibility && visibility.isInHiddenPeriod && (
        <View style={styles.visibilityInfoBanner}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.visibilityInfoText}>
            New submissions hidden until next reveal • {visibility.nextRevealDate ? 
              visibility.nextRevealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </Text>
        </View>
      )}
      
      {activeTab === 'rules' ? (
        renderRulesTab()
      ) : activeTab === 'rank' ? (
        renderRankTab()
      ) : activeTab === 'add' && competition.status !== 'completed' ? (
        renderAddTab()
      ) : competition.status !== 'completed' && (activeTab === 'me' || activeTab === 'others') ? (
        <>
          {/* Search bar - Only show for active competitions */}
          <SearchBar
            placeholder="search by competitor or activity"
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchContainer}
          />

          <ScrollView 
            style={styles.workoutsContainer}
            contentContainerStyle={styles.workoutsScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#A4D65E']} // Android
                tintColor="#A4D65E" // iOS
              />
            }
          >
            {loading ? (
              <Text style={styles.loadingText}>Loading workouts...</Text>
            ) : filteredWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'No workouts match your search.' : 'No workouts yet. Be the first to add one!'}
              </Text>
            ) : (
              filteredWorkouts.map(workout => {
                const formatted = formatWorkoutDisplay(workout);
                const isUserWorkout = workout.userId === user.uid;
                
                return (
                  <TouchableOpacity 
                    key={workout.id} 
                    style={styles.workoutCard}
                    onPress={() => handleWorkoutPress(workout, formatted.userName)}
                    activeOpacity={0.85}
                  >
                    {/* REMOVED: Heart icon background - no more cardBackground with heart */}
                    
                    <View style={styles.cardContent}>
                      <View style={styles.workoutInfo}>
                        {/* Show just the activity type as the title */}
                        <Text style={styles.workoutType}>{formatted.activityTitle}</Text>
                        <View style={styles.workoutDetails}>
                          {/* Show the primary unit value based on the workout's unit type */}
                          <View style={styles.detailItem}>
                            <Text style={styles.detailIcon}>•</Text>
                            <Text style={styles.detailText}>
                              {formatted.primaryValue.value} {formatted.primaryValue.displayUnit}
                            </Text>
                          </View>
                          
                          {/* Show points - already filtered at data layer */}
                          <View style={styles.detailItem}>
                            <Text style={styles.detailIcon}>★</Text>
                            <Text style={styles.detailText}>
                              {`${workout.points} Points`}
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      {/* MOVED: User label repositioned to bottom right */}
                      <View style={styles.userLabel}>
                        <Text style={styles.userLabelText}>{formatted.userName}'s Workout</Text>
                      </View>
                      
                      {/* Delete Button - Only for user's own workouts */}
                      {isUserWorkout && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation(); // Prevent card press
                            handleDeleteWorkout(workout);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                      
                      {workout.isNotification && (
                        <View style={styles.notificationIcon}>
                          <Text style={styles.notificationText}>!</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      ) : null}
      
      {/* Done button accessory for notes input */}
      {notesDoneButton.accessoryView}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#333',
    padding: 5,
    borderRadius: 25,
    marginHorizontal: 16,
    marginVertical: 16,

  },
  completedTabContainer: {
    // Same styling, tabs will adapt to fill space
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  completedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#1A1E23',
  },
  tabText: {
    color: '#777',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#A4D65E',
  },
  searchContainer: {
    // Consistent styling with ActiveCompetitionsScreen
    backgroundColor: '#EAEAEA',  // Keep this screen's distinct background color
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    // Note: height, borderRadius, and fontSize are now handled by SearchBar defaults
  },
  // searchIcon and searchInput styles removed - now handled by SearchBar component
  workoutsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  workoutsScrollContent: {
    paddingBottom: 120,
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
  workoutCard: {
    height: 120,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    padding: 15,
  },
  workoutInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  workoutType: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginBottom: 10,
  },
  workoutDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 15,
    marginBottom: 0,
  },
  detailIcon: {
    fontSize: 16,
    color: 'white',
    marginRight: 5,
  },
  detailText: {
    fontSize: 14,
    color: 'white',
  },
  // REPOSITIONED: User label moved to bottom right
  userLabel: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#A4D65E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  userLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  notificationIcon: {
    position: 'absolute',
    bottom: 10,
    left: 10, // Moved to left since user label is now on the right
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A4D65E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  // Delete button positioning updated since user label moved
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#888888',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  // Rules Tab Styles
  rulesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  rulesSection: {
    marginBottom: 24,
  },
  rulesSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 12,
  },
  rulesSectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  
  // Description Styles
  descriptionText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
  },
  
  // Date Styles
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyCapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  photoRequirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  gracePeriodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  leaderboardUpdateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '400',
    color: '#6B7280',
  },
  dateValue: {
    fontSize: 16,
    color: '#1A1E23',
    fontWeight: '600',
    marginTop: 2,
  },
  
  // Activity Styles
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  activityScoring: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Participant Styles
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  participantAvatar: {
    marginRight: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
  },
  participantHandle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
    marginLeft: 4,
  },
  
  // No Data Styles
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  
  // Activity Limits Styles
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
  visibilityBanner: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  visibilityText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  visibilityInfoBanner: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  visibilityInfoText: {
    color: '#1976D2',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  
  // End Competition Styles  
  endCompetitionSection: {
    marginTop: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  endCompetitionButton: {
    flexDirection: 'row',
    backgroundColor: '#A4D65E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  endingButton: {
    backgroundColor: '#7A9B47',
    opacity: 0.8,
  },
  endCompetitionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  endCompetitionWarning: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // Leave Competition Styles
  leaveCompetitionSection: {
    marginTop: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  leaveCompetitionButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leaveCompetitionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
    marginLeft: 8,
  },
  leaveCompetitionWarning: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // Rank Tab Styles
  rankContainer: {
    flex: 1,
  },
  podiumContainer: {
    minHeight: 310,
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: 'center',
  },
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 12,
  },
  topUserColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  firstPlaceOffset: {
    marginTop: 0,
  },
  secondThirdPlaceOffset: {
    marginTop: 22,
  },
  topUserTouchable: {
    alignItems: 'center',
    minHeight: 44,
  },
  crownContainer: {
    position: 'absolute',
    top: -45,
    zIndex: 1,
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarRing: {
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#A4E64F',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  rankBadge: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A4E64F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  rankBadgeText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  goldBadge: {
    backgroundColor: '#FFF4CC',
    borderWidth: 2,
    borderColor: '#A4E64F',
  },
  silverBadge: {
    backgroundColor: '#ECEFF4',
    borderWidth: 2,
    borderColor: '#A4E64F',
  },
  bronzeBadge: {
    backgroundColor: '#F3E0D3',
    borderWidth: 2,
    borderColor: '#A4E64F',
  },
  podiumUserName: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  podiumPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
   
  },
  podiumPointsText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  topThreeBarsRow: {
    width: '100%',
    paddingTop: 6,
    paddingBottom: 2,
    marginBottom: 2,
    paddingHorizontal: 12, // match topThreeContainer for alignment
    flexDirection: 'row',
    justifyContent: 'center', // mirror topThreeContainer
    alignItems: 'flex-end',
    height: 102, // 15% shorter than previous 120
    marginTop: 8, // minimal consistent spacing from points
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4, // mirror topUserColumn padding
  },
  barSpacer: {
    flex: 1,
  },
  podiumBar: {
    width: 64,
    borderRadius: 16,
    backgroundColor: '#A4E64F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  podiumBarFirst: {
    width: 76,
    backgroundColor: '#A4D65E',
  },
  podiumBarOther: {
    width: 60,
    backgroundColor: '#B9E87A',
  },
  rankingsContainer: {
    flex: 1,
    marginTop: -8, // move rankings up ~15px
  },
  rankingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 15,
    paddingHorizontal: 16,
  },
  rankingsBackground: {
    backgroundColor: '#F3F9F0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: 200,
  },
  rankingsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserRanking: {
    backgroundColor: '#A4D65E',
    shadowColor: '#000',
  },
  lastRankingItem: {
    marginBottom: 0,
  },
  rankingPositionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankingPositionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  rankingUserImageContainer: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  rankingUserImage: {
    width: '100%',
    height: '100%',
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
    color: '#A4D65E',
    fontWeight: '700',
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
  },
  
  // Add Tab Styles
  addContainer: { 
    flex: 1, 
    paddingHorizontal: 16, 
  },
  addScrollContent: { 
    paddingBottom: 120, 
  },
  dateSection: { 
    marginBottom: 11, 
    marginTop: 11,
  },
  dateRangeText: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 4, 
    textAlign: 'center' 
  },
  label: { 
    fontSize: 18,
    fontWeight: '400', 
    color: '#1A1E23', 
    marginBottom: 10, 
    marginTop: 17 
  },
  activityTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 11, 
  },
  activityTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  selectedActivityType: {
    backgroundColor: '#A4D65E',
    borderColor: '#A4D65E'
  },
  activityTypeText: {
    fontSize: 15.4,
    fontWeight: '475',
    color: '#1A1E23'
  },
  selectedActivityTypeText: {
    color: '#FFF'
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 5,
    marginTop: 10,
    marginBottom: 50,
    borderWidth: 2,
    borderColor: '#A4D65E',
    borderStyle: 'dashed',
    width: '100%',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#A4D65E',
    fontWeight: '600',
    marginLeft: 6,
  },
  viewLessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A4D65E',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 5,
    marginTop: 10,
    marginBottom: 50,
    width: '100%',
  },
  viewLessText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 0,
  },
  inputFieldsContainer: {
    marginTop: 8
  },
  textArea: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1E23',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  pointsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#A4D65E',
    borderRadius: 8,
    padding: 16,
    marginTop: 21
  },
  pointsLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23'
  },
  pointsFormula: {
    fontSize: 14,
    color: '#1A1E23',
    opacity: 0.7
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1E23'
  },
  pointsWarning: {
    backgroundColor: '#FFF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B'
  },
  pointsWarningText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '500',
    textAlign: 'center'
  },
  dailyCapInfo: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 16,
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#A4D65E'
  },
  dailyCapWarning: {
    backgroundColor: '#FFF2F2',
    borderColor: '#FF6B6B'
  },
  dailyCapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  dailyCapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23'
  },
  dailyCapText: {
    fontSize: 14,
    color: '#1A1E23',
    marginBottom: 4
  },
  dailyCapWarningText: {
    color: '#D32F2F'
  },
  warningText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '500',
    marginTop: 4
  },
  remainingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  delayPeriodText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    fontStyle: 'italic'
  },
  loadingText: {
    fontSize: 12,
    color: '#666'
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 11,
    borderWidth: 2,
    borderColor: '#A4D65E',
    borderStyle: 'dashed'
  },
  addPhotoText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1A1E23'
  },
  submitButton: {
    marginTop: 21,
    marginBottom: 21
  },
  imagePreviewContainer: {
    marginVertical: 11,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 2,
  },
  imageSelectedText: {
    fontSize: 14,
    color: '#A4D65E',
    fontWeight: '600',
    marginTop: 5,
  },
  errorContainer: {
    backgroundColor: '#FFF2F2',
    borderRadius: 8,
    padding: 10,
    marginVertical: 11,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  uploadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  activityLimitsInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  limitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  limitLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  limitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1E23',
  },
  limitReached: {
    color: '#EF4444',
  },
  limitWarning: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  photoRequiredText: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  
  // New styles for multiple photo support
  photoGalleryContainer: {
    marginVertical: 11,
  },
  addMorePhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    marginTop: 11,
    borderWidth: 1,
    borderColor: '#A4D65E',
  },
  addMorePhotosText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#A4D65E',
    fontWeight: '600',
  },
  
  // Back Button Styles
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 7,
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
});

export default CompetitionDetailsScreen;
