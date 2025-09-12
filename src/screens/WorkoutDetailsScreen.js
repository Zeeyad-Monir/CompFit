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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  RefreshControl,
  Modal,
} from 'react-native';
import { Header } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../contexts/AuthContext';
import { getScoreVisibility, getVisibilityMessage } from '../utils/scoreVisibility';
import { db } from '../firebase';
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
  
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showImageOverlay, setShowImageOverlay] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  
  // Comment-related state
  const [comments, setComments] = useState([]);
  const [visibility, setVisibility] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [userProfiles, setUserProfiles] = useState({});
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  // Calculate visibility status
  useEffect(() => {
    if (competition) {
      const visibilityStatus = getScoreVisibility(competition);
      setVisibility(visibilityStatus);
    }
  }, [competition]);

  // Check if this is the current user's workout
  const isOwnWorkout = workout.userId === user?.uid;

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

  return (
    <View style={styles.container}>
      <ImageOverlay />
      <Header 
        title="" 
        backgroundColor="#F8F8F8"
      />
      <StatusBar style="dark" />
      
      {/* Visibility Status Banner */}
      {visibility && visibility.isInHiddenPeriod && (
        <View style={styles.visibilityBanner}>
          <Ionicons name="eye-off" size={20} color="#FFF" />
          <Text style={styles.visibilityText}>
            {getVisibilityMessage(visibility)}
          </Text>
        </View>
      )}
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
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
        {/* Photo Section */}
        {workout.photoUrl ? (
          <View style={styles.photoContainer}>
            {imageLoading && !imageError && (
              <View style={styles.imageLoadingContainer}>
                <ActivityIndicator size="large" color="#A4D65E" />
                <Text style={styles.loadingText}>Loading photo...</Text>
              </View>
            )}
            {!imageError ? (
              <TouchableOpacity 
                activeOpacity={0.95}
                onPress={() => setShowImageOverlay(true)}
              >
                <Image
                  source={{ uri: workout.photoUrl }}
                  style={styles.workoutPhoto}
                  onLoad={(e) => {
                    setImageLoading(false);
                    // Calculate and store aspect ratio
                    const { width, height } = e.nativeEvent.source;
                    setImageAspectRatio(width / height);
                  }}
                  onError={() => {
                    setImageLoading(false);
                    setImageError(true);
                  }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Ionicons name="image-outline" size={60} color="#999" />
                <Text style={styles.noPhotoText}>Failed to load photo</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noPhotoContainer}>
            <Ionicons name="image-outline" size={60} color="#999" />
            <Text style={styles.noPhotoText}>No photo submitted</Text>
          </View>
        )}

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

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={48} color="#A4D65E" />
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{userName || 'Unknown User'}</Text>
              <Text style={styles.userSubtext}>
                {isOwnWorkout ? 'Your workout' : `${userName}'s workout`}
              </Text>
            </View>
          </View>
          {isOwnWorkout && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteWorkout}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF6B6B" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Activity Type Card */}
        <View style={styles.activityCard}>
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

        {/* Metrics Card */}
        <View style={styles.metricsContainer}>
          <Text style={styles.sectionTitle}>Workout Metrics</Text>
          
          {/* Primary Metric */}
          <View style={styles.primaryMetricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name={metric.icon} size={40} color="#A4D65E" />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.displayUnit}</Text>
              </View>
            </View>
          </View>

          {/* Points Earned */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsIconContainer}>
              <Ionicons name="star" size={32} color="#FFD700" />
            </View>
            <View style={styles.pointsContent}>
              <Text style={styles.pointsLabel}>
                {visibility?.isInHiddenPeriod && workout.userId !== user.uid ? 'Points Hidden' : 'Points Earned'}
              </Text>
              <Text style={styles.pointsValue}>
                {visibility?.isInHiddenPeriod && workout.userId !== user.uid ? '---' : workout.points}
              </Text>
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
                        <Ionicons name="person-circle" size={36} color="#A4D65E" />
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
          <View style={styles.commentInputSection}>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                editable={!isPostingComment}
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
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    height: screenWidth * 0.75,
    backgroundColor: '#000',
    position: 'relative',
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
  
  // User Card
  userCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userTextContainer: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1E23',
  },
  userSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 12,
  },
  primaryMetricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F9E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  metricContent: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  metricUnit: {
    fontSize: 18,
    color: '#666',
    marginLeft: 8,
  },
  
  // Points Card
  pointsCard: {
    backgroundColor: '#1A1E23',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pointsContent: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#A4D65E',
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
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
});