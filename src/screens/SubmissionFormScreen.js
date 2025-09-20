// SubmissionFormScreen.js - UPDATED with Photo Attachment Feature


// ADD THESE DEBUG LINES RIGHT AFTER THE IMPORTS:
console.log('=== DEBUG: uploadToCloudinary Import ===');
console.log('Type of uploadToCloudinary:', typeof uploadToCloudinary);
console.log('uploadToCloudinary function:', uploadToCloudinary);
console.log('========================================');








// SubmissionFormScreen.js - CORRECTED IMPORTS

import React, { useState, useContext, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Image, ActivityIndicator
} from 'react-native';
import { Header, Button, FormInput, DatePicker } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';  // KEEP ONLY THIS ONE
import { uploadToCloudinary, uploadMultipleToCloudinary } from '../utils/uploadImage';
import { getScoreVisibility, filterVisibleSubmissionsWithSelf } from '../utils/scoreVisibility';
import SwipeablePhotoGallery from '../components/SwipeablePhotoGallery';
import FullScreenPhotoViewer from '../components/FullScreenPhotoViewer';

// Remove any duplicate ImagePicker import that might be elsewhere in the file

export default function SubmissionFormScreen({ route, navigation }) {
  const { competition } = route.params;
  const { user } = useContext(AuthContext);

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
  const [notes, setNotes] = useState('');
  const [currentDayPoints, setCurrentDayPoints] = useState(0);
  const [loadingDayPoints, setLoadingDayPoints] = useState(false);
  
  // State to prevent double submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NEW: Photo-related state - now supports multiple photos
  const [selectedImageUris, setSelectedImageUris] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [showFullScreenViewer, setShowFullScreenViewer] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  const MAX_PHOTOS = 3;
  
  // State for managing activity display
  const [showAllActivities, setShowAllActivities] = useState(false);
  
  // NEW: Activity-specific limits state
  const [activityDailySubmissions, setActivityDailySubmissions] = useState(0);
  const [activityWeeklyPoints, setActivityWeeklyPoints] = useState(0);
  const [activityLimits, setActivityLimits] = useState(null);

  // Grab types
  const activityTypes = competition?.rules?.map(r=>r.type)||[];
  
  // Constants for activity display management
  const ACTIVITIES_PER_ROW = 3;
  const INITIAL_ROWS = 3;
  const INITIAL_ACTIVITIES_COUNT = ACTIVITIES_PER_ROW * INITIAL_ROWS; // 9 activities

  // Get activities to display based on showAllActivities state
  const getDisplayedActivities = () => {
    if (showAllActivities || activityTypes.length <= INITIAL_ACTIVITIES_COUNT) {
      return activityTypes;
    }
    return activityTypes.slice(0, INITIAL_ACTIVITIES_COUNT);
  };

  // Check if we need to show the "View more" button
  const shouldShowViewMoreButton = () => {
    return activityTypes.length > INITIAL_ACTIVITIES_COUNT && !showAllActivities;
  };

  // Check if we need to show the "View less" button
  const shouldShowViewLessButton = () => {
    return activityTypes.length > INITIAL_ACTIVITIES_COUNT && showAllActivities;
  };

  useEffect(()=>{
    if (activityTypes.length>0 && !activityTypes.includes(activityType)) {
      setActivityType(activityTypes[0]);
    }
  },[competition]);

  // Fetch current day's points whenever date changes
  useEffect(() => {
    fetchCurrentDayPoints();
  }, [date, user, competition]);

  // Get activity-specific limits from competition rules
  useEffect(() => {
    if (activityType && competition?.rules) {
      const rule = competition.rules.find(r => r.type === activityType);
      
      // Enhanced debug logging
      console.log('=== ACTIVITY SELECTED ===');
      console.log('Activity:', activityType);
      console.log('Rule found:', rule);
      console.log('minPace value:', rule?.minPace);
      console.log('minPace type:', typeof rule?.minPace);
      console.log('Has pace requirement?', rule?.minPace !== null && rule?.minPace !== undefined);
      console.log('Should show duration field?', shouldShowField('duration'));
      console.log('Should show distance field?', shouldShowField('distance'));
      
      if (rule) {
        const limits = {
          maxSubmissionsPerDay: rule.maxSubmissionsPerDay || null,
          maxPointsPerWeek: rule.maxPointsPerWeek || null,
          perSubmissionCap: rule.perSubmissionCap || null,
          // Include pace fields in activity limits - properly handle 0 and falsy values
          minPace: rule.minPace !== null && rule.minPace !== undefined ? rule.minPace : null,
          paceUnit: rule.paceUnit || 'min/km'
        };
        console.log('Setting activity limits:', limits);
        setActivityLimits(limits);
      } else {
        setActivityLimits(null);
      }
    }
  }, [activityType, competition]);

  // Query activity-specific daily submissions
  useEffect(() => {
    if (!user || !competition || !activityType || !date) return;

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
  }, [user, competition, activityType, date]);

  // Query activity-specific weekly points
  useEffect(() => {
    if (!user || !competition || !activityType) return;

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
  }, [user, competition, activityType, date]);

  // Helper function to get start and end of day in ISO format
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

  // Fetch user's submissions for the selected date
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

  // Check if date is within competition period
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

  // helper: find rule for selected activity
  const getRule = () => competition.rules.find(r=>r.type===activityType) || {};

  // Get the correct value based on the unit type
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
        return (parseFloat(duration) || 0) / 60; // Convert minutes to hours
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
        // For custom units or any other unit
        return parseFloat(customValue) || 0;
    }
  };

  // Calculate points with proper unit handling
  const calculatePoints = () => {
    const rule = getRule();
    const { pointsPerUnit = 0, unitsPerPoint = 1 } = rule;
    const value = getValueForUnit();

    const pointsEarned = Math.floor(value / unitsPerPoint) * pointsPerUnit;
    return pointsEarned;
  };

  // Check if submission would exceed daily cap
  const wouldExceedDailyCap = () => {
    if (!competition.dailyCap) return false;
    const newPoints = calculatePoints();
    return (currentDayPoints + newPoints) > competition.dailyCap;
  };

  // Get final points considering daily cap
  const getFinalPoints = () => {
    const newPoints = calculatePoints();
    if (!competition.dailyCap) return newPoints;
    
    const remainingCap = competition.dailyCap - currentDayPoints;
    return Math.min(newPoints, remainingCap);
  };

  // Get points available for today
  const getRemainingDailyPoints = () => {
    if (!competition.dailyCap) return null;
    return Math.max(0, competition.dailyCap - currentDayPoints);
  };

  // Check if we're in a leaderboard delay period
  const isInLeaderboardDelayPeriod = () => {
    if (!competition.leaderboardUpdateDays || competition.leaderboardUpdateDays === 0) {
      return false; // Live updates, no delay
    }
    
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    // We're in a delay period if the current period hasn't completed yet
    const currentPeriod = Math.floor(daysSinceStart / competition.leaderboardUpdateDays);
    const nextUpdateDay = (currentPeriod + 1) * competition.leaderboardUpdateDays;
    const daysUntilUpdate = nextUpdateDay - daysSinceStart;
    
    return daysUntilUpdate > 0;
  };

  // Check if activity daily submission limit is reached
  const isActivityDailyLimitReached = () => {
    if (!activityLimits) return false;
    
    if (activityLimits.maxSubmissionsPerDay && 
        activityDailySubmissions >= activityLimits.maxSubmissionsPerDay) {
      return true;
    }
    
    return false;
  };

  // Check if activity weekly points cap would be exceeded
  const wouldExceedWeeklyCap = (newPoints) => {
    if (!activityLimits?.maxPointsPerWeek) return false;
    return (activityWeeklyPoints + newPoints) > activityLimits.maxPointsPerWeek;
  };

  // Apply per-submission cap if needed
  const applyPerSubmissionCap = (calculatedPoints) => {
    if (!activityLimits?.perSubmissionCap) return calculatedPoints;
    return Math.min(calculatedPoints, activityLimits.perSubmissionCap);
  };

  // Get final points with all caps applied
  const getFinalPointsWithActivityLimits = () => {
    let points = calculatePoints();
    
    // Apply per-submission cap first
    points = applyPerSubmissionCap(points);
    
    // Apply weekly cap if needed
    if (activityLimits?.maxPointsPerWeek) {
      const remainingWeekly = activityLimits.maxPointsPerWeek - activityWeeklyPoints;
      points = Math.min(points, Math.max(0, remainingWeekly));
    }
    
    // Apply daily cap (existing logic)
    if (competition.dailyCap) {
      const remainingDaily = competition.dailyCap - currentDayPoints;
      points = Math.min(points, Math.max(0, remainingDaily));
    }
    
    return points;
  };

  // Determine which input fields to show based on the unit
  const shouldShowField = (field) => {
    const rule = getRule();
    const { unit } = rule;
    
    // If pace is required, show both duration and distance
    if (activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined) {
      console.log(`[shouldShowField] Pace required! Field: ${field}, minPace: ${activityLimits.minPace}`);
      if (field === 'duration' || field === 'distance') {
        return true;
      }
    }
    
    // Regular logic for non-pace activities
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

  // Get appropriate labels for input fields
  const getFieldLabel = (field) => {
    const rule = getRule();
    const { unit } = rule;
    
    // Special labels when pace is required
    if (activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined) {
      if (field === 'duration') return 'Duration (minutes)';
      if (field === 'distance') return 'Distance (km)';
    }
    
    // Regular labels
    switch (field) {
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

  // Get appropriate placeholder for input fields
  const getFieldPlaceholder = (field) => {
    const { unit } = getRule();
    
    switch (field) {
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

  // Calculate pace from duration and distance
  const calculatePace = () => {
    if (!activityLimits || activityLimits.minPace === null || activityLimits.minPace === undefined) return null;
    
    const dist = parseFloat(distance) || 0;
    const dur = parseFloat(duration) || 0;
    
    if (dist === 0 || dur === 0) return null;
    
    // Convert to the required unit for comparison
    switch (activityLimits.paceUnit) {
      case 'min/km':
        return dur / dist; // minutes per km
      case 'min/mile':
        return dur / (dist * 0.621371); // convert km to miles
      case 'km/h':
        return (dist / dur) * 60; // km per hour
      case 'mph':
        return ((dist * 0.621371) / dur) * 60; // miles per hour
      case 'm/min':
        return (dist * 1000) / dur; // meters per minute
      case 'min/100m':
        return (dur / dist) * 0.1; // for swimming
      default:
        return dur / dist;
    }
  };

  // Validation to ensure required fields are filled
  const validateSubmission = () => {
    // Check activity daily limit first
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
    
    // Always require duration for time-based activities
    if (shouldShowField('duration') && (!duration || duration === '0')) {
      Alert.alert('Validation Error', `Please enter the ${getFieldLabel('duration').toLowerCase()}`);
      return false;
    }
    
    // Require the primary measurement field based on unit
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
    
    // Check if photo is required
    if (competition.photoProofRequired && selectedImageUris.length === 0) {
      Alert.alert('Photo Required', 'This competition requires at least one photo with every submission');
      return false;
    }
    
    // Check pace requirement if applicable
    if (activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined) {
      const actualPace = calculatePace();
      if (actualPace !== null) {
        // For speed units (km/h, mph, m/min), higher is better
        const isSpeedUnit = ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit);
        
        if (isSpeedUnit) {
          if (actualPace < activityLimits.minPace) {
            Alert.alert('Pace Too Slow', 
              `Minimum required pace is ${activityLimits.minPace} ${activityLimits.paceUnit}. Your pace: ${actualPace.toFixed(2)} ${activityLimits.paceUnit}`
            );
            return false;
          }
        } else {
          // For time units (min/km, min/mile), lower is better
          if (actualPace > activityLimits.minPace) {
            Alert.alert('Pace Too Slow', 
              `Maximum allowed time is ${activityLimits.minPace} ${activityLimits.paceUnit}. Your pace: ${actualPace.toFixed(2)} ${activityLimits.paceUnit}`
            );
            return false;
          }
        }
      }
    }
    
    return true;
  };

  // NEW: Handle image selection from camera roll - now supports multiple
  const pickImage = async () => {
    try {
      // Clear any previous errors
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
      
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to attach photos!',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker with multiple selection
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - selectedImageUris.length,
        quality: 0.7, // Compress to 70% quality to reduce upload size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Validate file sizes (5MB limit per photo)
        const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
        const oversizedImages = [];
        const validImages = [];
        
        for (const asset of result.assets) {
          // Check if fileSize is available (it might not be on all platforms)
          if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
            oversizedImages.push({
              uri: asset.uri,
              sizeMB: (asset.fileSize / (1024 * 1024)).toFixed(2)
            });
          } else {
            validImages.push(asset.uri);
          }
        }
        
        // If there are oversized images, show warning
        if (oversizedImages.length > 0) {
          const message = oversizedImages.length === 1
            ? `1 photo exceeds the 5MB size limit (${oversizedImages[0].sizeMB}MB) and was not added.`
            : `${oversizedImages.length} photos exceed the 5MB size limit and were not added.`;
          
          Alert.alert('File Size Limit', message);
        }
        
        // Add valid photos to existing selection (up to max)
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

  // NEW: Remove selected image by index
  const removeImage = (index) => {
    const updatedUris = selectedImageUris.filter((_, i) => i !== index);
    setSelectedImageUris(updatedUris);
    if (updatedUris.length === 0) {
      setImageUploadError(null);
    }
  };

  // Handle photo press to open full screen viewer
  const handlePhotoPress = (index) => {
    setFullScreenInitialIndex(index);
    setShowFullScreenViewer(true);
  };

  // UPDATED: Handle submit with photo upload
  const handleSubmit = async () => {
    // Prevent double submissions
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

    // Set submitting state to prevent double taps
    setIsSubmitting(true);

    // Allow submission but use capped points with all activity limits
    const points = getFinalPointsWithActivityLimits();
    const rule = getRule();
    
    try {
      let photoUrls = [];
      
      // NEW: Upload photos if selected (multiple)
      if (selectedImageUris.length > 0) {
        try {
          setIsUploadingImage(true);
          setImageUploadError(null);
          console.log(`Uploading ${selectedImageUris.length} photos to Cloudinary...`);
          
          // Upload all photos in parallel with progress tracking
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
          
          // Ask user if they want to continue without photos
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
                  // Continue with submission without photos
                  await submitWorkout(points, rule, []);
                }
              }
            ]
          );
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      // Submit workout with or without photos
      await submitWorkout(points, rule, photoUrls);
      
    } catch(e) {
      console.error(e);
      Alert.alert('Error','Failed to submit workout. Please try again.');
      // Re-enable the button if there was an error
      setIsSubmitting(false);
    }
  };

  // NEW: Separate function to handle workout submission
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
        unit: rule.unit,
        points,
        notes,
        date: date.toISOString(),
        createdAt: serverTimestamp(),
      };
      
      // Add photo URLs if available (supporting both single and multiple)
      if (photoUrls && photoUrls.length > 0) {
        submissionData.photoUrls = photoUrls; // New array field
        submissionData.photoUrl = photoUrls[0]; // Keep backward compatibility
      }
      
      await addDoc(collection(db,'submissions'), submissionData);
      
      const successMessage = photoUrls && photoUrls.length > 0
        ? `Workout submitted with ${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''}! You earned ${points.toFixed(1)} points.`
        : `Workout submitted! You earned ${points.toFixed(1)} points.`;
      
      Alert.alert(
        'Success!',
        successMessage,
        [{ text:'OK', onPress: ()=>navigation.goBack() }]
      );
    } catch (error) {
      throw error;
    }
  };

  const competitionStartDate = new Date(competition.startDate);
  const competitionEndDate = new Date(competition.endDate);

  return (
    <View style={styles.container}>
      <Header title="" backgroundColor="#F8F8F8" />
      <StatusBar style="dark" />
      <ScrollView 
        style={styles.formContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          {getDisplayedActivities().map(type=>(
            <TouchableOpacity
              key={type}
              style={[
                styles.activityTypeButton,
                activityType===type&&styles.selectedActivityType
              ]}
              onPress={()=>setActivityType(type)}
              disabled={isSubmitting} // Disable activity selection while submitting
            >
              <Ionicons
                name="fitness"
                size={24}
                color={activityType===type?'#FFF':'#1A1E23'}
              />
              <Text style={[
                styles.activityTypeText,
                activityType===type&&styles.selectedActivityTypeText
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
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional details..."
          placeholderTextColor="#999"
          editable={!isSubmitting}
        />

        {/* Points Preview with correct unit display */}
        <View style={styles.pointsPreview}>
          <View>
            <Text style={styles.pointsLabel}>Points Earned:</Text>
            <Text style={styles.pointsFormula}>
              ({getRule().unit} ÷ {getRule().unitsPerPoint} × {getRule().pointsPerUnit})
            </Text>
          </View>
          <Text style={styles.pointsValue}>{calculatePoints().toFixed(1)}</Text>
        </View>

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
          activityLimits.maxPointsPerWeek || activityLimits.perSubmissionCap ||
          (activityLimits.minPace !== null && activityLimits.minPace !== undefined)) && (
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
            {activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Minimum pace:</Text>
                <Text style={styles.limitValue}>
                  {activityLimits.minPace} {activityLimits.paceUnit}
                </Text>
              </View>
            )}
            
            {/* Current pace calculation - only show when pace is required AND user has entered values */}
            {activityLimits && activityLimits.minPace !== null && activityLimits.minPace !== undefined && 
             duration && distance && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Your current pace:</Text>
                <Text style={[
                  styles.limitValue,
                  calculatePace() && (
                    ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit)
                      ? calculatePace() < activityLimits.minPace && styles.limitReached
                      : calculatePace() > activityLimits.minPace && styles.limitReached
                  )
                ]}>
                  {calculatePace() ? `${calculatePace().toFixed(2)} ${activityLimits.paceUnit}` : 'Enter values above'}
                  {calculatePace() && (
                    ['km/h', 'mph', 'm/min'].includes(activityLimits.paceUnit)
                      ? (calculatePace() < activityLimits.minPace ? ' ❌' : ' ✅')
                      : (calculatePace() > activityLimits.minPace ? ' ❌' : ' ✅')
                  )}
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
                📊 Scores hidden during delay period
              </Text>
            )}
          </View>
        )}

        {/* NEW: Photo Evidence Section - now supports multiple photos */}
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
            <SwipeablePhotoGallery
              photos={selectedImageUris}
              onPhotoPress={handlePhotoPress}
              onRemovePhoto={removeImage}
              showRemoveButton={true}
              height={250}
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
              ? `Uploading ${selectedImageUris.length} Photo${selectedImageUris.length > 1 ? 's' : ''}...`
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
            <Text style={styles.uploadingText}>
              Uploading {selectedImageUris.length} photo{selectedImageUris.length > 1 ? 's' : ''} to cloud...
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       {flex:1,backgroundColor:'#FFFFFF'},
  formContainer:   {flex:1,padding:16},
  scrollContent:   {paddingBottom:40},
  dateSection:     {marginBottom:16},
  dateRangeText:   {fontSize:12,color:'#666',marginTop:4,textAlign:'center'},
  label:           {fontSize:16,color:'#1A1E23',marginBottom:8,marginTop:16},
  activityTypesContainer:{flexDirection:'row',flexWrap:'wrap',marginHorizontal:-5},
  activityTypeButton:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:20,paddingVertical:8,paddingHorizontal:12,marginHorizontal:5,marginBottom:10,borderWidth:1,borderColor:'#E5E7EB'},
  selectedActivityType:{backgroundColor:'#A4D65E',borderColor:'#A4D65E'},
  activityTypeText:{fontSize:14,color:'#1A1E23',marginLeft:5},
  selectedActivityTypeText:{color:'#FFF'},
  
  // Styles for View More/Less buttons
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
  
  inputFieldsContainer: {marginTop: 8},
  row:             {flexDirection:'row',justifyContent:'space-between',gap:10},
  halfField:       {flex:1},
  textArea:        {backgroundColor:'#FFF',borderRadius:8,padding:12,fontSize:16,color:'#1A1E23',minHeight:100,borderWidth:1,borderColor:'#E5E7EB'},
  pointsPreview:   {flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#A4D65E',borderRadius:8,padding:16,marginTop:20},
  pointsLabel:     {fontSize:18,fontWeight:'bold',color:'#1A1E23'},
  pointsFormula:   {fontSize:14,color:'#1A1E23',opacity:0.7},
  pointsValue:     {fontSize:24,fontWeight:'bold',color:'#1A1E23'},
  pointsWarning:   {backgroundColor:'#FFF2F2',borderRadius:8,padding:12,marginTop:8,borderWidth:1,borderColor:'#FF6B6B'},
  pointsWarningText:{fontSize:14,color:'#D32F2F',fontWeight:'500',textAlign:'center'},
  dailyCapInfo:    {backgroundColor:'#E8F5E8',borderRadius:8,padding:16,marginTop:12,borderWidth:1,borderColor:'#A4D65E'},
  dailyCapWarning: {backgroundColor:'#FFF2F2',borderColor:'#FF6B6B'},
  dailyCapHeader:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},
  dailyCapTitle:   {fontSize:16,fontWeight:'bold',color:'#1A1E23'},
  dailyCapText:    {fontSize:14,color:'#1A1E23',marginBottom:4},
  dailyCapWarningText:{color:'#D32F2F'},
  warningText:     {fontSize:14,color:'#D32F2F',fontWeight:'500',marginTop:4},
  remainingText:   {fontSize:12,color:'#666',fontStyle:'italic'},
  delayPeriodText: {fontSize:12,color:'#3B82F6',marginTop:4,fontStyle:'italic'},
  loadingText:     {fontSize:12,color:'#666'},
  disabledButton:  {backgroundColor:'#CCCCCC',opacity:0.6},
  addPhotoButton:  {flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderRadius:8,padding:12,marginVertical:10,borderWidth:2,borderColor:'#A4D65E',borderStyle:'dashed'},
  addPhotoText:    {marginLeft:8,fontSize:16,color:'#1A1E23'},
  submitButton:    {marginTop:20,marginBottom:20},
  
  // NEW: Photo-related styles
  imagePreviewContainer: {
    marginVertical: 10,
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
    marginVertical: 10,
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
  
  // Activity Limits Styles
  activityLimitsInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
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
  
  // Pace Display Styles
  paceDisplay: {
    backgroundColor: '#F9FAF9',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  paceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1E23',
  },
  paceTooSlow: {
    color: '#FF6B6B',
  },
  paceWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // Photo Required Styles
  photoRequiredText: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  
  // New styles for multiple photo support
  photoGalleryContainer: {
    marginVertical: 10,
  },
  addMorePhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A4D65E',
  },
  addMorePhotosText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#A4D65E',
    fontWeight: '600',
  },
});