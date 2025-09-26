// WorkoutDetailsScreen.js - Enhanced with Comment Section

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Keyboard,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, SmartKeyboardAwareScrollView } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../contexts/AuthContext';
import { getScoreVisibility, getVisibilityMessage, getScoreCutoffDate } from '../utils/scoreVisibility';
import { db } from '../firebase';
import useDoneButton from '../hooks/useDoneButton';
import SwipeablePhotoGallery from '../components/SwipeablePhotoGallery';
import FullScreenPhotoViewer from '../components/FullScreenPhotoViewer';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  doc, 
  getDoc, 
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const { width: screenWidth } = Dimensions.get('window');

export default function WorkoutDetailsScreen({ route, navigation }) {
  const { workout, competition, userName } = route.params;
  const { user } = useContext(AuthContext);
  const scrollViewRef = useRef(null);
  const commentInputRef = useRef(null);
  
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showImageOverlay, setShowImageOverlay] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [showFullScreenViewer, setShowFullScreenViewer] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  
  // Get photos array - support both old single photo and new multiple photos
  const getPhotos = () => {
    if (workout.photoUrls && workout.photoUrls.length > 0) {
      return workout.photoUrls;
    } else if (workout.photoUrl) {
      return [workout.photoUrl];
    }
    return [];
  };
  
  const photos = getPhotos();
  
  // Handle photo press to open full screen viewer
  const handlePhotoPress = (index) => {
    setFullScreenInitialIndex(index);
    setShowFullScreenViewer(true);
  };
  
  // Comment-related state
  const [comments, setComments] = useState([]);
  const [visibility, setVisibility] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [userProfiles, setUserProfiles] = useState({});
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [workoutUserProfile, setWorkoutUserProfile] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Done button hook for comment input with ref
  const commentDoneButton = useDoneButton(commentInputRef);

  // Calculate visibility status
  useEffect(() => {
    if (competition) {
      const visibilityStatus = getScoreVisibility(competition);
      setVisibility(visibilityStatus);
    }
  }, [competition]);

  // Fetch workout owner's profile for display
  useEffect(() => {
    if (workout?.userId) {
      fetchUserProfile(workout.userId).then(profile => {
        setWorkoutUserProfile(profile);
      });
    }
  }, [workout?.userId]);

  // Keyboard event listeners for physical device support
  useEffect(() => {
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

  // Check if this is the current user's workout
  const isOwnWorkout = workout.userId === user?.uid;

  // Check if this specific workout's score should be visible
  const shouldShowWorkoutScore = () => {
    // Always show score for own workout
    if (workout.userId === user?.uid) {
      return true;
    }
    
    // If competition ended, show all scores
    if (competition.status === 'completed') {
      return true;
    }
    
    // If live updates (no delay), show all scores
    if (!competition.leaderboardUpdateDays || competition.leaderboardUpdateDays === 0) {
      return true;
    }
    
    // Check if this workout was submitted before the cutoff date
    const cutoffDate = getScoreCutoffDate(competition);
    if (!cutoffDate) {
      return true; // No cutoff means show all
    }
    
    // Get the workout submission date
    const workoutDate = workout.createdAt?.toDate ? 
      workout.createdAt.toDate() : 
      new Date(workout.createdAt);
    
    // Show score if workout was submitted before cutoff (in a revealed cycle)
    return workoutDate <= cutoffDate;
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format comment timestamp
  const formatCommentTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Fetch user profiles for comments
  const fetchUserProfile = async (userId) => {
    if (userProfiles[userId]) return userProfiles[userId];
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfiles(prev => ({
          ...prev,
          [userId]: userData
        }));
        return userData;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  };

  // Load comments
  useEffect(() => {
    if (!workout?.id) return;

    setLoadingComments(true);
    
    // Create comments subcollection reference
    const commentsRef = collection(db, 'submissions', workout.id, 'comments');
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        const commentsData = [];
        
        for (const docSnap of snapshot.docs) {
          const comment = {
            id: docSnap.id,
            ...docSnap.data()
          };
          
          // Fetch user data for each comment
          if (comment.userId) {
            await fetchUserProfile(comment.userId);
          }
          
          commentsData.push(comment);
        }
        
        setComments(commentsData);
        setLoadingComments(false);
      },
      (error) => {
        console.error('Error fetching comments:', error);
        setLoadingComments(false);
      }
    );

    return () => unsubscribe();
  }, [workout?.id]);

  // Handle deleting a comment
  const handleDeleteComment = (commentId) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingCommentId(commentId);
            try {
              const commentRef = doc(db, 'submissions', workout.id, 'comments', commentId);
              await deleteDoc(commentRef);
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
            } finally {
              setDeletingCommentId(null);
            }
          },
        },
      ]
    );
  };

  // Handle comment input focus for physical devices
  const handleCommentFocus = React.useCallback(() => {
    // Reduced delay for snappier response
    setTimeout(() => {
      if (scrollViewRef.current && Platform.OS === 'ios') {
        // Scroll to comment section when focused
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 203);
  }, []);

  // Handle posting a comment
  const handlePostComment = async () => {
    const trimmedComment = commentText.trim();
    
    if (!trimmedComment) {
      return;
    }
    
    if (!user) {
      Alert.alert('Error', 'You must be logged in to post comments');
      return;
    }
    
    setIsPostingComment(true);
    Keyboard.dismiss();
    
    try {
      const commentsRef = collection(db, 'submissions', workout.id, 'comments');
      
      await addDoc(commentsRef, {
        userId: user.uid,
        text: trimmedComment,
        createdAt: serverTimestamp(),
      });
      
      setCommentText('');
      
      // Scroll to bottom after a short delay to ensure new comment is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Comments will refresh automatically via the listener
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Get the display value and unit based on the workout's unit type
  const getMetricDisplay = () => {
    const { unit } = workout;
    
    switch (unit) {
      case 'Kilometre':
        return { label: 'Distance', value: workout.distance, displayUnit: 'km', icon: 'navigate' };
      case 'Mile':
        return { label: 'Distance', value: workout.distance, displayUnit: 'miles', icon: 'navigate' };
      case 'Meter':
        return { label: 'Distance', value: workout.distance, displayUnit: 'meters', icon: 'navigate' };
      case 'Yard':
        return { label: 'Distance', value: workout.distance, displayUnit: 'yards', icon: 'navigate' };
      case 'Hour':
        return { label: 'Duration', value: workout.duration, displayUnit: 'hours', icon: 'time' };
      case 'Minute':
        return { label: 'Duration', value: workout.duration, displayUnit: 'minutes', icon: 'time' };
      case 'Calorie':
        return { label: 'Calories', value: workout.calories, displayUnit: 'cal', icon: 'flame' };
      case 'Session':
        return { label: 'Sessions', value: workout.sessions, displayUnit: 'sessions', icon: 'refresh' };
      case 'Class':
        return { label: 'Classes', value: workout.sessions, displayUnit: 'classes', icon: 'school' };
      case 'Rep':
        return { label: 'Reps', value: workout.reps, displayUnit: 'reps', icon: 'repeat' };
      case 'Set':
        return { label: 'Sets', value: workout.sets, displayUnit: 'sets', icon: 'layers' };
      case 'Step':
        return { label: 'Steps', value: workout.steps, displayUnit: 'steps', icon: 'walk' };
      default:
        return { label: unit, value: workout.customValue, displayUnit: unit.toLowerCase(), icon: 'fitness' };
    }
  };

  // Get pace display information if available
  const getPaceDisplay = () => {
    if (!workout.pace || workout.pace === 0) return null;
    
    // Find the rule for this workout's activity type
    const rule = competition?.rules?.find(r => r.type === workout.activityType);
    if (!rule || !rule.minPace) return null;
    
    const paceUnit = rule.paceUnit || 'min/km';
    const isSpeedUnit = ['km/h', 'mph', 'm/min'].includes(paceUnit);
    
    return {
      label: isSpeedUnit ? 'Speed' : 'Pace',
      value: workout.pace,
      unit: paceUnit,
      icon: isSpeedUnit ? 'speedometer' : 'timer',
      isSpeed: isSpeedUnit
    };
  };

  // Handle workout deletion
  const handleDeleteWorkout = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteDoc(doc(db, 'submissions', workout.id));
              Alert.alert('Success', 'Workout deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Image Overlay Component
  const ImageOverlay = () => {
    if (!showImageOverlay || !workout.photoUrl) return null;
    
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate maximum container dimensions (85% width, 70% height)
    const maxWidth = screenWidth * 0.85;
    const maxHeight = screenHeight * 0.70;
    
    // Calculate actual image dimensions based on aspect ratio
    let imageWidth = maxWidth;
    let imageHeight = maxWidth / imageAspectRatio;
    
    // If height exceeds max, scale based on height instead
    if (imageHeight > maxHeight) {
      imageHeight = maxHeight;
      imageWidth = maxHeight * imageAspectRatio;
    }
    
    return (
      <Modal
        visible={showImageOverlay}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageOverlay(false)}
      >
        <TouchableOpacity 
          style={styles.overlayContainer} 
          activeOpacity={1}
          onPress={() => setShowImageOverlay(false)}
        >
          <View 
            style={[
              styles.overlayImageWrapper,
              {
                width: imageWidth,
                height: imageHeight,
              }
            ]}
          >
            <Image
              source={{ uri: workout.photoUrl }}
              style={styles.overlayImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.overlayCloseButton}
              onPress={() => setShowImageOverlay(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const metric = getMetricDisplay();
  const paceInfo = getPaceDisplay();

  return (
    <View style={styles.container}>
      {/* ImageOverlay replaced by FullScreenPhotoViewer */}
      <Header 
        title="" 
        backgroundColor="#F8F8F8"
      />
      <StatusBar style="dark" />
      
      <View style={{ flex: 1 }}>
        <SmartKeyboardAwareScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          extraScrollHeight={130}
          enableAutomaticScroll={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#A4D65E']}
              tintColor="#A4D65E"
            />
          }
        >
        {/* Photo Section - now supports multiple photos */}
        {photos.length > 0 ? (
          <View style={styles.photoContainer}>
            <SwipeablePhotoGallery
              photos={photos}
              onPhotoPress={handlePhotoPress}
              showRemoveButton={false}
              height={300}
              showIndicator={true}
              containerStyle={styles.galleryContainer}
            />
          </View>
        ) : (
          <View style={styles.noPhotoContainer}>
            <Ionicons name="image-outline" size={60} color="#999" />
            <Text style={styles.noPhotoText}>No photos submitted</Text>
          </View>
        )}
        
        {/* Full Screen Photo Viewer */}
        <FullScreenPhotoViewer
          visible={showFullScreenViewer}
          photos={photos}
          initialIndex={fullScreenInitialIndex}
          onClose={() => setShowFullScreenViewer(false)}
        />

        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={20} color="#A4D65E" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* User Info Section */}
        <View style={styles.userInfoSection}>
          <View style={styles.userInfoContainer}>
            <LinearGradient
              colors={['#A4D65E', '#B6DB78']}
              style={styles.userAvatarGradient}
            >
              <View style={styles.userAvatar}>
                {workoutUserProfile?.profilePicture ? (
                  <Image 
                    source={{ uri: workoutUserProfile.profilePicture }}
                    style={styles.userAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person-circle" size={75} color="#A4D65E" />
                )}
              </View>
            </LinearGradient>
            <Text style={styles.userName}>{userName || 'Unknown User'}</Text>
          </View>
        </View>

        {/* Activity Type Card */}
        <View style={styles.activityCard}>
          {/* Delete button for own workout */}
          {isOwnWorkout && (
            <TouchableOpacity 
              style={styles.activityDeleteButton}
              onPress={handleDeleteWorkout}
              disabled={isDeleting}
            >
              <View style={styles.deleteButtonCircle}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FF6B6B" />
                ) : (
                  <Ionicons name="close" size={15} color="#FF6B6B" />
                )}
              </View>
            </TouchableOpacity>
          )}
          <View style={styles.activityHeader}>
            <Ionicons name="fitness" size={32} color="#A4D65E" />
            <Text style={styles.activityType}>{workout.activityType}</Text>
          </View>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatDate(workout.date)}</Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatTime(workout.date)}</Text>
            </View>
          </View>
        </View>

        {/* Metrics Section */}
        <View style={styles.metricsContainer}>
          <Text style={styles.sectionTitle}>Performance</Text>
          
          <View style={styles.metricsCard}>
            {/* Main Metric */}
            <View style={[
              styles.mainMetricSection, 
              paceInfo && styles.mainMetricSectionWithPace
            ]}>
              <View style={styles.metricHeader}>
                <Ionicons name={metric.icon} size={paceInfo ? 18 : 20} color="#A4D65E" />
                <Text style={[styles.metricLabel, paceInfo && styles.metricLabelSmall]}>
                  {metric.label}
                </Text>
              </View>
              <View style={styles.metricValueColumn}>
                <Text style={[styles.metricValue, paceInfo && styles.metricValueWithPace]}>
                  {metric.value}
                </Text>
                <Text style={[styles.metricUnit, paceInfo && styles.metricUnitWithPace]}>
                  {metric.displayUnit}
                </Text>
              </View>
            </View>
            
            {/* First Divider */}
            <View style={styles.metricDivider} />
            
            {/* Pace Section - Only if pace exists */}
            {paceInfo && (
              <>
                <View style={styles.paceSection}>
                  <View style={styles.metricHeader}>
                    <Ionicons name={paceInfo.icon} size={18} color="#4A90E2" />
                    <Text style={styles.paceLabel}>{paceInfo.label}</Text>
                  </View>
                  <View style={styles.paceValueColumn}>
                    <Text style={styles.paceValue}>{paceInfo.value}</Text>
                    <Text style={styles.paceUnit}>{paceInfo.unit}</Text>
                  </View>
                </View>
                
                {/* Second Divider */}
                <View style={styles.metricDivider} />
              </>
            )}
            
            {/* Points Section */}
            <View style={[
              styles.pointsSection,
              paceInfo && styles.pointsSectionWithPace
            ]}>
              <View style={styles.metricHeader}>
                <Ionicons name="star" size={paceInfo ? 18 : 20} color="#FFD700" />
                <Text style={[
                  styles.pointsLabel,
                  paceInfo && styles.metricLabelSmall
                ]}>
                  {shouldShowWorkoutScore() ? 'Points' : 'Points'}
                </Text>
              </View>
              <View style={styles.pointsValueContainer}>
                <Text style={[
                  styles.pointsValue,
                  paceInfo && styles.pointsValueWithPace
                ]}>
                  {shouldShowWorkoutScore() ? workout.points : '---'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        {workout.notes && workout.notes.trim() !== '' && (
          <View style={styles.notesContainer}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{workout.notes}</Text>
            </View>
          </View>
        )}

        {/* Comments Section */}
        <View style={styles.commentsContainer}>
          <Text style={styles.sectionTitle}>Comments</Text>
          
          {/* Comments List */}
          {loadingComments ? (
            <View style={styles.commentsLoadingContainer}>
              <ActivityIndicator size="small" color="#A4D65E" />
              <Text style={styles.commentsLoadingText}>Loading comments...</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noCommentsContainer}>
              <Ionicons name="chatbubble-outline" size={40} color="#C0C0C0" />
              <Text style={styles.noCommentsText}>No comments yet</Text>
              <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
            </View>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => {
                const commentUser = userProfiles[comment.userId];
                const isOwnComment = comment.userId === user?.uid;
                
                return (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserInfo}>
                        <View style={styles.commentUserAvatar}>
                          {commentUser?.profilePicture ? (
                            <Image 
                              source={{ uri: commentUser.profilePicture }}
                              style={styles.commentUserAvatarImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="person-circle" size={36} color="#A4D65E" />
                          )}
                        </View>
                        <View style={styles.commentUserText}>
                          <Text style={styles.commentUserName}>
                            {commentUser?.username || 'Unknown User'}
                            {isOwnComment && <Text style={styles.youBadge}> (You)</Text>}
                          </Text>
                          <Text style={styles.commentTimestamp}>
                            {formatCommentTime(comment.createdAt)}
                          </Text>
                        </View>
                      </View>
                      {/* Delete button for own comments */}
                      {isOwnComment && (
                        <TouchableOpacity
                          style={styles.commentDeleteButton}
                          onPress={() => handleDeleteComment(comment.id)}
                          disabled={deletingCommentId === comment.id}
                        >
                          {deletingCommentId === comment.id ? (
                            <ActivityIndicator size="small" color="#FF6B6B" />
                          ) : (
                            <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Comment Input Box - Now part of the comments section */}
          <SafeAreaView edges={Platform.OS === 'ios' ? ['bottom'] : []}>
            <View style={styles.commentInputSection}>
              <View style={styles.commentInputWrapper}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput}
                  placeholder="Write a comment..."
                  placeholderTextColor="#999"
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={handleCommentFocus}
                  multiline
                  maxLength={500}
                  editable={!isPostingComment}
                  inputAccessoryViewID={commentDoneButton.inputAccessoryViewID}
                  // iOS physical device optimizations
                  blurOnSubmit={false}
                  returnKeyType="default"
                  enablesReturnKeyAutomatically={true}
                  textAlignVertical="top"
                  autoCorrect={false}
                  spellCheck={true}
                  keyboardType="default"
                  scrollEnabled={false}
                />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  (!commentText.trim() || isPostingComment) && styles.commentSubmitButtonDisabled
                ]}
                onPress={handlePostComment}
                disabled={!commentText.trim() || isPostingComment}
              >
                {isPostingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.commentSubmitText}>Comment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </SafeAreaView>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: Platform.OS === 'ios' ? 49 : 73 }} />
        </SmartKeyboardAwareScrollView>
        
        {/* Done button accessory for comment input */}
        {commentDoneButton.accessoryView}
      </View>
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
  
  // Photo Section
  photoContainer: {
    width: screenWidth,
    backgroundColor: '#F8F8F8',
    position: 'relative',
  },
  galleryContainer: {
    marginBottom: 0,
  },
  workoutPhoto: {
    width: '100%',
    height: '100%',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A1E23',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    color: '#A4D65E',
    marginTop: 10,
    fontSize: 14,
  },
  noPhotoContainer: {
    width: screenWidth,
    height: screenWidth * 0.5,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: '#999',
    fontSize: 16,
    marginTop: 10,
  },
  
  // User Info Section
  userInfoSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  userAvatarGradient: {
    width: 81,
    height: 81,
    borderRadius: 41,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatar: {
    width: 75,
    height: 75,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1E23',
  },
  
  // Activity Card
  activityCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  activityDeleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  deleteButtonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityType: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginLeft: 12,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  
  // Metrics Section
  metricsContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1E23',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mainMetricSection: {
    flex: 1,
    paddingRight: 16,
    alignItems: 'center',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValueColumn: {
    alignItems: 'center',
    marginTop: 8,
  },
  metricValue: {
    fontSize: 38,
    fontWeight: '600',
    color: '#A4D65E',  // Changed to signature green
    letterSpacing: -1,
  },
  metricUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999',
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 0,
    alignSelf: 'stretch',
  },
  pointsSection: {
    flex: 1,
    paddingLeft: 16,
    alignItems: 'center',
  },
  pointsValueContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pointsValue: {
    fontSize: 38,
    fontWeight: '600',
    color: '#FFD700',  // Changed to gold to match pointsValueWithPace
    letterSpacing: -1,
  },
  
  // Notes Section
  notesContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notesText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
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

  // Comments Section
  commentsContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  commentsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  commentsLoadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  noCommentsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noCommentsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  commentsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  commentCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  commentUserAvatarImage: {
    width: '100%',
    height: '100%',
  },
  commentUserText: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1E23',
  },
  youBadge: {
    fontSize: 12,
    color: '#A4D65E',
    fontWeight: 'normal',
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  commentText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginLeft: 46,
  },
  commentDeleteButton: {
    padding: 8,
    marginRight: -4,
  },

  // Comment Input Section (now part of scrollable content)
  commentInputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1E23',
    maxHeight: 100,
    minHeight: 36,
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 10,
  },
  commentSubmitButton: {
    backgroundColor: '#A4D65E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 85,
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#C0C0C0',
    opacity: 0.6,
  },
  commentSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  visibilityBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Image Overlay Styles
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayImageWrapper: {
    position: 'relative',
    // Width and height will be set dynamically
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  overlayCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Three-column layout styles for when pace is displayed
  mainMetricSectionWithPace: {
    flex: 1,
    paddingRight: 12,
    alignItems: 'center',
  },
  paceSection: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pointsSectionWithPace: {
    flex: 1,
    paddingLeft: 12,
    alignItems: 'center',
  },
  
  // Consistent smaller sizes for all three columns when pace is shown
  metricLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 6,
  },
  metricValueWithPace: {
    fontSize: 28,  // Reduced from 38
    fontWeight: '700',
    color: '#A4D65E',  // Changed to signature green
    letterSpacing: -0.5,
  },
  metricUnitWithPace: {
    fontSize: 13,  // Reduced from 16
    fontWeight: '500',
    color: '#999999',
    marginTop: 2,
  },
  
  // Pace-specific styles
  paceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 6,
  },
  paceValueColumn: {
    alignItems: 'center',
    marginTop: 8,
  },
  paceValue: {
    fontSize: 28,  // Same as metricValueWithPace
    fontWeight: '700',
    color: '#4A90E2',  // Blue for pace
    letterSpacing: -0.5,
  },
  paceUnit: {
    fontSize: 13,  // Same as metricUnitWithPace
    fontWeight: '500',
    color: '#999999',
    marginTop: 2,
  },
  
  // Points with pace
  pointsValueWithPace: {
    fontSize: 28,  // Reduced from 38, matching others
    fontWeight: '700',
    color: '#FFD700',  // Keep gold color
    letterSpacing: -0.5,
  },
});