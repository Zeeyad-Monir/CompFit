// SubmissionFormScreen.js - FINAL VERSION with proper unit handling and double-tap prevention

import React, { useState, useContext, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert
} from 'react-native';
import { Header, Button, FormInput, DatePicker } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';

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
  
  // NEW: State to prevent double submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for managing activity display
  const [showAllActivities, setShowAllActivities] = useState(false);

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

  // Determine which input fields to show based on the unit
  const shouldShowField = (field) => {
    const { unit } = getRule();
    
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
    const { unit } = getRule();
    
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

  // Validation to ensure required fields are filled
  const validateSubmission = () => {
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
    
    return true;
  };

  // FIXED: Handle submit with double-tap prevention
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

    // Allow submission but use capped points
    const points = getFinalPoints();
    const rule = getRule();
    
    try {
      await addDoc(collection(db,'submissions'),{
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
      });
      
      Alert.alert(
        'Success!',
        `Workout submitted! You earned ${points.toFixed(1)} points.`,
        [{ text:'OK', onPress: ()=>navigation.goBack() }]
      );
    } catch(e) {
      console.error(e);
      Alert.alert('Error','Failed to submit workout. Please try again.');
      // Re-enable the button if there was an error
      setIsSubmitting(false);
    }
    // Note: We don't reset isSubmitting on success because we navigate away
  };

  const competitionStartDate = new Date(competition.startDate);
  const competitionEndDate = new Date(competition.endDate);

  return (
    <View style={styles.container}>
      <Header title="Add Workout" showBackButton onBackPress={()=>navigation.goBack()}/>
      <ScrollView 
        style={styles.formContainer}
        contentContainerStyle={styles.scrollContent}
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
              Only {getFinalPoints().toFixed(1)} points will count toward your daily limit.
            </Text>
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
              {currentDayPoints} / {competition.dailyCap} points used today
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
          </View>
        )}

        {/* Photo Evidence (optional) */}
        <Text style={styles.label}>Add Photo Evidence (Optional)</Text>
        <TouchableOpacity 
          style={[styles.addPhotoButton, isSubmitting && styles.disabledButton]}
          disabled={isSubmitting}
        >
          <Ionicons name="camera" size={40} color="#A4D65E"/>
          <Text style={styles.addPhotoText}>Take Photo</Text>
        </TouchableOpacity>

        {/* FIXED: Submit button with double-tap prevention */}
        <Button 
          title={isSubmitting ? "Submitting..." : "Submit Workout"}
          onPress={handleSubmit} 
          style={[
            styles.submitButton,
            isSubmitting && styles.disabledButton
          ]}
          disabled={loadingDayPoints || isSubmitting}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       {flex:1,backgroundColor:'#F8F8F8'},
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
  loadingText:     {fontSize:12,color:'#666'},
  disabledButton:  {backgroundColor:'#CCCCCC',opacity:0.6},
  addPhotoButton:  {flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderRadius:8,padding:12,marginVertical:10},
  addPhotoText:    {marginLeft:8,fontSize:16,color:'#1A1E23'},
  submitButton:    {marginTop:20,marginBottom:20},
});
