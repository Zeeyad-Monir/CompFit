// CompetitionCreationScreen.js - FIXED VERSION

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Header, Button, FormInput, Dropdown, DatePicker } from '../components';
import { Ionicons } from '@expo/vector-icons';
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

// All activities can now use any of these units - ADDED "Custom" option
const workoutTypes = [
  'Walking','Running','Cycling','Cardio Session','Elliptical',
  'Weightlifting','Swimming','Rowing','Yoga','HIIT','Other','Custom',
];

// Universal units available for all activities
const universalUnits = [
  'Minute','Hour','Kilometre','Mile','Meter','Yard',
  'Step','Rep','Set','Calorie','Session','Class',
];

// Placeholder helper
const getPointsPlaceholder = unit => {
  const placeholders = {
    Minute: 'e.g., 10 minutes = 1 point',
    Hour: 'e.g., 1 hour = 5 points',
    Kilometre: 'e.g., 1 km = 1 point',
    Mile: 'e.g., 1 mile = 2 points',
    Meter: 'e.g., 100 meters = 1 point',
    Yard: 'e.g., 100 yards = 1 point',
    Step: 'e.g., 500 steps = 1 point',
    Rep: 'e.g., 10 reps = 1 point',
    Set: 'e.g., 1 set = 2 points',
    Calorie: 'e.g., 50 calories = 1 point',
    Session: 'e.g., 1 session = 10 points',
    Class: 'e.g., 1 class = 15 points',
  };
  return placeholders[unit] || 'Enter points value';
};
const getUnitsPlaceholder = unit => `e.g., 30 ${unit.toLowerCase()}`;

// Label helper
const getPointsLabel = unit => `Points per ${unit.toLowerCase()}`;
const getUnitsLabel  = unit => `Units required per point (${unit.toLowerCase()})`;

export default function CompetitionCreationScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  // Helper function to get initial form values
  const getInitialFormValues = () => {
    const now = new Date();
    return {
      name: '',
      description: '',
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0), // 9 AM today
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59), // 11:59 PM next week
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59),
      dailyCap: '',
      activities: [
        { type: 'Walking', unit: 'Minute', points: '1', unitsPerPoint: '1', customName: '' }
      ],
      inviteUsername: '',
      invitedFriends: []
    };
  };

  /* ---------- form state ---------- */
  const [name, setName] = useState('');
  const [description, setDesc] = useState('');
  
  // Initialize dates with proper times
  const now = new Date();
  const [startDate, setStart] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0)); // 9 AM today
  const [startTime, setStartTime] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0));
  const [endDate, setEnd] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59)); // 11:59 PM next week
  const [endTime, setEndTime] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59));
  
  const [dailyCap, setDailyCap] = useState('');
  // Each activity now has: type, unit, pointsPerUnit, unitsPerPoint, customName
  const [activities, setActs] = useState([
    { type: 'Walking', unit: 'Minute', points: '1', unitsPerPoint: '1', customName: '' }
  ]);

  const [inviteUsername, setInviteUsername] = useState('');
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  /* ---------- NEW: Helper functions for activity management ---------- */
  
  // Get available activity types (excluding already selected ones, except Custom)
  const getAvailableActivityTypes = (currentIndex) => {
    const selectedTypes = activities
      .map((act, idx) => idx !== currentIndex ? act.type : null)
      .filter(type => type && type !== 'Custom');
    
    return workoutTypes.filter(type => 
      type === 'Custom' || !selectedTypes.includes(type)
    );
  };

  // Get display name for activity (custom name if Custom, otherwise type)
  const getActivityDisplayName = (activity) => {
    if (activity.type === 'Custom' && activity.customName) {
      return activity.customName;
    }
    return activity.type;
  };

  // Validate custom activity name
  const validateCustomActivityName = (name, currentIndex) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    // Check if name is already used by another custom activity
    const existingCustomNames = activities
      .map((act, idx) => idx !== currentIndex && act.type === 'Custom' ? act.customName : null)
      .filter(name => name);
    
    return !existingCustomNames.includes(trimmedName);
  };

  /* ---------- fetch user's friends ---------- */
  useEffect(() => {
    const fetchUserFriends = async () => {
      if (!user) return;
      
      setLoadingFriends(true);
      try {
        // Get user's profile to access friends array
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const friendIds = userData.friends || [];
          
          if (friendIds.length > 0) {
            // Fetch details for each friend
            const friendsData = [];
            for (const friendId of friendIds) {
              const friendDoc = await getDoc(doc(db, 'users', friendId));
              if (friendDoc.exists()) {
                friendsData.push({
                  uid: friendId,
                  ...friendDoc.data(),
                });
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
    setName(initialValues.name);
    setDesc(initialValues.description);
    setStart(initialValues.startDate);
    setStartTime(initialValues.startTime);
    setEnd(initialValues.endDate);
    setEndTime(initialValues.endTime);
    setDailyCap(initialValues.dailyCap);
    setActs(initialValues.activities);
    setInviteUsername(initialValues.inviteUsername);
    setInvitedFriends(initialValues.invitedFriends);
  };

  /* ---------- date/time helpers ---------- */
  const handleStartDateChange = (selectedDate) => {
    setStart(selectedDate);
    // Update time part while keeping the date
    const updatedStartTime = new Date(selectedDate);
    updatedStartTime.setHours(startTime.getHours(), startTime.getMinutes());
    setStartTime(updatedStartTime);
  };

  const handleStartTimeChange = (selectedTime) => {
    setStartTime(selectedTime);
    // Update the start date with new time
    const updatedStartDate = new Date(startDate);
    updatedStartDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setStart(updatedStartDate);
  };

  const handleEndDateChange = (selectedDate) => {
    setEnd(selectedDate);
    // Update time part while keeping the date
    const updatedEndTime = new Date(selectedDate);
    updatedEndTime.setHours(endTime.getHours(), endTime.getMinutes());
    setEndTime(updatedEndTime);
  };

  const handleEndTimeChange = (selectedTime) => {
    setEndTime(selectedTime);
    // Update the end date with new time
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

  /* ---------- UPDATED: activity helpers ---------- */
  const updateAct = (idx, patch) =>
    setActs(a => a.map((row,i) => i===idx ? {...row,...patch} : row));

  // UPDATED: Handle activity type change with validation
  const handleActivityTypeChange = (idx, newType) => {
    const updates = { type: newType };
    
    // If changing to Custom, initialize customName
    if (newType === 'Custom') {
      updates.customName = '';
    } else {
      // If changing from Custom to something else, clear customName
      updates.customName = '';
    }
    
    updateAct(idx, updates);
  };

  // UPDATED: Handle custom name change with validation
  const handleCustomNameChange = (idx, newName) => {
    updateAct(idx, { customName: newName });
  };

  // UPDATED: Add activity with better default selection
  const addActivity = () => {
    const availableTypes = getAvailableActivityTypes(-1);
    const defaultType = availableTypes.length > 0 ? availableTypes[0] : 'Custom';
    
    setActs([...activities, { 
      type: defaultType, 
      unit: 'Minute', 
      points: '1', 
      unitsPerPoint: '1',
      customName: ''
    }]);
  };

  const removeAct = idx =>
    setActs(a => a.filter((_,i) => i!==idx));

  // Updated function to find user by username instead of email
  const findUserByUsername = async username => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;
    
    try {
      // First try to find user directly in users collection
      const q = query(collection(db,'users'), where('username','==',trimmedUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        return { 
          uid: snap.docs[0].id, 
          username: userData.username,
          email: userData.email 
        };
      }
      
      // Then try the username lookup collection
      const usernameDoc = await getDoc(doc(db,'usernames',trimmedUsername));
      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;
        const userDoc = await getDoc(doc(db,'users',uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return { 
            uid, 
            username: userData.username,
            email: userData.email 
          };
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
    
    // Basic username validation
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
      uid: friend.uid,
      username: friend.username,
      email: friend.email,
    }]);
    
    Alert.alert('Success', `${friend.username} has been invited!`);
  };
  
  const removeInvite = uid =>
    setInvitedFriends(f => f.filter(x => x.uid !== uid));

  /* ---------- UPDATED: create competition with validation ---------- */
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
    
    // UPDATED: Validate activities including custom names
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      
      if (!activity.points || parseFloat(activity.points) <= 0 || 
          !activity.unitsPerPoint || parseFloat(activity.unitsPerPoint) <= 0) {
        Alert.alert('Validation','Please set valid points & units-per-point for all activities');
        return;
      }
      
      // Validate custom activities have names
      if (activity.type === 'Custom') {
        if (!activity.customName || !activity.customName.trim()) {
          Alert.alert('Validation', 'Please provide a name for all custom activities');
          return;
        }
        
        if (!validateCustomActivityName(activity.customName, i)) {
          Alert.alert('Validation', 'Custom activity names must be unique');
          return;
        }
      }
    }
    
    try {
      // UPDATED: Create rules with proper activity names
      const rules = activities.map(a => ({
        type: a.type === 'Custom' ? a.customName.trim() : a.type,
        unit: a.unit,
        pointsPerUnit: Number(a.points),
        unitsPerPoint: Number(a.unitsPerPoint),
        isCustom: a.type === 'Custom',
      }));

      await addDoc(collection(db,'competitions'), {
        name: name.trim(),
        description: description.trim(),
        startDate: finalStartDateTime.toISOString(),
        endDate: finalEndDateTime.toISOString(),
        ownerId: user.uid,
        participants: [user.uid],
        pendingParticipants: invitedFriends.map(f=>f.uid),
        rules: rules,
        dailyCap: dailyCap ? Number(dailyCap) : null,
        bonuses: [],
        createdAt: serverTimestamp(),
      });
      
      // Reset all form values after successful creation
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

  /* ---------- UI ---------- */
  return (
    <View style={styles.container}>
      <Header title="Create Competition" showBackButton onBackPress={navigation.goBack}/>
      <ScrollView 
        style={styles.formContainer} 
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
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
                containerStyle={{zIndex:z+2}}
              />
              
              {/* UPDATED: Show custom name input for Custom activities */}
              {act.type === 'Custom' && (
                <FormInput
                  label="Custom Activity Name"
                  value={act.customName}
                  onChangeText={name => handleCustomNameChange(idx, name)}
                  placeholder="Enter custom activity name"
                  style={styles.customNameInput}
                />
              )}
              
              <Dropdown
                label="Measurement Unit"
                selectedValue={act.unit}
                onValueChange={unit=>updateAct(idx,{unit, unitsPerPoint:'1'})}
                items={universalUnits}
                containerStyle={{zIndex:z+1}}
              />

              <FormInput
                label={getPointsLabel(act.unit)}
                keyboardType="numeric"
                value={act.points}
                onChangeText={p=>updateAct(idx,{points:p})}
                placeholder={getPointsPlaceholder(act.unit)}
              />

              <FormInput
                label={getUnitsLabel(act.unit)}
                keyboardType="numeric"
                value={act.unitsPerPoint}
                onChangeText={u=>updateAct(idx,{unitsPerPoint:u})}
                placeholder={getUnitsPlaceholder(act.unit)}
              />

              {activities.length>1 && (
                <TouchableOpacity onPress={()=>removeAct(idx)} style={styles.trashBtn}>
                  <Ionicons name="trash" size={20} color="#FF6B6B"/>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* UPDATED: Only show add button if there are available activity types */}
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

        {/* Invite Friends from Friends List */}
        {userFriends.length > 0 && (
          <>
            <Text style={styles.friendsListTitle}>Invite Friends</Text>
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

        <Button title="Create Competition" onPress={handleCreate} style={styles.createButton}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        {flex:1,backgroundColor:'#F8F8F8'},
  formContainer:    {flex:1,padding:16},
  scrollContent:    {paddingBottom:40},
  sectionTitle:     {fontSize:18,fontWeight:'bold',color:'#1A1E23',marginTop:20,marginBottom:8},
  sectionSubtext:   {fontSize:14,color:'#666',marginBottom:15},
  dateTimeRow:      {flexDirection:'row',justifyContent:'space-between',gap:10},
  dateTimeField:    {flex:1},
  durationPreview:  {backgroundColor:'#E8F5E8',borderRadius:8,padding:12,marginBottom:16},
  durationText:     {fontSize:14,color:'#1A1E23',textAlign:'center',fontWeight:'500'},
  label:            {fontSize:16,color:'#1A1E23',marginBottom:8,marginTop:16},
  textArea:         {backgroundColor:'#FFF',borderRadius:8,padding:12,fontSize:16,color:'#1A1E23',minHeight:120,borderWidth:1,borderColor:'#E5E7EB'},
  activityCard:     {backgroundColor:'#FFF',borderRadius:8,padding:12,marginBottom:16,borderWidth:1,borderColor:'#E5E7EB'},
  customNameInput:  {marginTop:8}, // NEW: Style for custom name input
  trashBtn:         {alignSelf:'flex-end',marginTop:4},
  addBtn:           {flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderRadius:8,padding:10,marginBottom:20,borderStyle:'dashed',borderWidth:1,borderColor:'#A4D65E'},
  addText:          {marginLeft:8,color:'#1A1E23',fontWeight:'600'},
  inviteRow:        {flexDirection:'row',alignItems:'center',marginBottom:16},
  inputInvite:      {backgroundColor:'#FFF',borderRadius:8,padding:12,borderWidth:1,borderColor:'#E5E7EB'},
  invitedTitle:     {fontSize:16,fontWeight:'bold',color:'#1A1E23',marginTop:8,marginBottom:12},
  participant:      {flexDirection:'row',alignItems:'center',marginVertical:8,backgroundColor:'#FFF',borderRadius:8,padding:12},
  participantInfo:  {flex:1,marginLeft:12},
  participantName:  {fontSize:16,color:'#1A1E23',fontWeight:'500'},
  participantEmail: {fontSize:14,color:'#666',marginTop:2},
  createButton:     {marginTop:20,marginBottom:20},
  
  // Friends list styles
  friendsListTitle: {fontSize:16,fontWeight:'bold',color:'#1A1E23',marginTop:16,marginBottom:8},
  friendsListContainer: {backgroundColor:'#FFF',borderRadius:8,marginBottom:16,maxHeight:200,borderWidth:1,borderColor:'#E5E7EB'},
  loadingContainer: {padding:20,alignItems:'center'},
  loadingText: {fontSize:14,color:'#666'},
  friendsScrollView: {maxHeight:180},
  friendListItem: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12,borderBottomWidth:1,borderBottomColor:'#F3F4F6'},
  friendInfo: {flexDirection:'row',alignItems:'center',flex:1},
  friendName: {fontSize:16,color:'#1A1E23',fontWeight:'500',marginLeft:12},
  inviteFriendButton: {backgroundColor:'#A4D65E',paddingHorizontal:16,paddingVertical:8,borderRadius:6},
  invitedFriendButton: {backgroundColor:'#E5E7EB'},
  inviteFriendButtonText: {fontSize:14,fontWeight:'600',color:'#FFFFFF'},
  invitedFriendButtonText: {color:'#6B7280'},
});

