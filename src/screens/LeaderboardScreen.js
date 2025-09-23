// // DEPRECATED: This screen has been replaced by CompetitionDetailsScreen rank tab
// // All leaderboard functionality moved to CompetitionDetailsScreen
// // This file is kept for reference but should not be used
// // Date deprecated: September 23, 2025

// /*
// //LeaderboardScreen.js

// import React, { useState, useEffect, useContext } from 'react';
// import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Image } from 'react-native';
// import { Header, Button } from '../components';
// import { Ionicons } from '@expo/vector-icons';
// import { StatusBar } from 'expo-status-bar';
// import { db } from '../firebase';
// import {
//   collection,
//   query,
//   where,
//   onSnapshot,
//   doc,
//   getDoc,
//   updateDoc,
//   writeBatch,
//   increment,
//   serverTimestamp,
// } from 'firebase/firestore';
// import { AuthContext } from '../contexts/AuthContext';
// import { 
//   getScoreVisibility, 
//   filterVisibleSubmissions, 
//   filterVisibleSubmissionsWithSelf,
//   calculateVisiblePoints,
//   calculateVisiblePointsWithSelf,
//   getVisibilityMessage,
//   getLastRevealDate,
//   formatRevealDate
// } from '../utils/scoreVisibility';

// const LeaderboardScreen = ({ route, navigation }) => {
//   const { competition } = route.params;
//   const { user } = useContext(AuthContext);
  
//   const [rankings, setRankings] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [refreshTimeout, setRefreshTimeout] = useState(null);
//   const [isCompleting, setIsCompleting] = useState(false);
//   const [visibility, setVisibility] = useState(null);

//   // NOTE: This screen is now only accessed directly from navigation menu or other specific paths
//   // Completed competitions from ActiveCompetitionsScreen now go directly to CompetitionDetails
//   // Remove automatic redirect to prevent double navigation
//   // useEffect(() => {
//   //   navigation.replace('CompetitionDetails', { 
//   //     competition,
//   //     initialTab: 'rank'
//   //   });
//   // }, []);

//   /* ---------------- refresh handler -------------------- */
//   const onRefresh = () => {
//     setRefreshing(true);
    
//     // Clear any existing timeout
//     if (refreshTimeout) {
//       clearTimeout(refreshTimeout);
//     }
    
//     // Set timeout fallback to stop refreshing after 3 seconds
//     const timeout = setTimeout(() => {
//       setRefreshing(false);
//     }, 3000);
    
//     setRefreshTimeout(timeout);
//   };

//   // Helper function to stop refreshing and clear timeout
//   const stopRefreshing = () => {
//     setRefreshing(false);
//     if (refreshTimeout) {
//       clearTimeout(refreshTimeout);
//       setRefreshTimeout(null);
//     }
//   };

//   // Calculate and update win/loss stats
//   const calculateAndUpdateStats = async () => {
//     try {
//       console.log('Calculating competition stats...');
      
//       // Get all submissions for this competition
//       const submissionsQuery = query(
//         collection(db, 'submissions'),
//         where('competitionId', '==', competition.id)
//       );
      
//       const snapshot = await new Promise((resolve, reject) => {
//         const unsubscribe = onSnapshot(
//           submissionsQuery,
//           (snap) => {
//             unsubscribe();
//             resolve(snap);
//           },
//           reject
//         );
//       });
      
//       // Calculate total points per user
//       const userPoints = {};
//       snapshot.docs.forEach(doc => {
//         const submission = doc.data();
//         const userId = submission.userId;
//         userPoints[userId] = (userPoints[userId] || 0) + (submission.points || 0);
//       });
      
//       // Sort users by points to determine rankings
//       const sortedRankings = Object.entries(userPoints)
//         .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
      
//       if (sortedRankings.length === 0) {
//         console.log('No submissions found for competition');
//         return { success: false, message: 'No submissions found' };
//       }
      
//       // Determine winner (highest points)
//       const winnerId = sortedRankings[0][0];
//       const winnerPoints = sortedRankings[0][1];
      
//       // Get all participants except winner
//       const participants = competition.participants || [];
//       const losers = participants.filter(uid => uid !== winnerId);
      
//       console.log(`Winner: ${winnerId} with ${winnerPoints} points`);
//       console.log(`Losers: ${losers.length} participants`);
      
//       // Update stats using batch write for atomicity
//       const batch = writeBatch(db);
      
//       // Update winner
//       const winnerRef = doc(db, 'users', winnerId);
//       batch.update(winnerRef, {
//         wins: increment(1),
//         lastUpdated: serverTimestamp(),
//       });
      
//       // Update losers
//       losers.forEach(loserId => {
//         // Only update if they actually participated (have submissions)
//         if (userPoints[loserId] !== undefined) {
//           const loserRef = doc(db, 'users', loserId);
//           batch.update(loserRef, {
//             losses: increment(1),
//             lastUpdated: serverTimestamp(),
//           });
//         }
//       });
      
//       // Also update the competition with the calculated winner
//       const competitionRef = doc(db, 'competitions', competition.id);
//       batch.update(competitionRef, {
//         winnerId: winnerId,
//         winnerPoints: winnerPoints,
//         completedAt: serverTimestamp(),
//         finalRankings: sortedRankings.map(([userId, points], index) => ({
//           userId,
//           points,
//           position: index + 1
//         }))
//       });
      
//       await batch.commit();
//       console.log('Stats updated successfully');
      
//       return {
//         success: true,
//         winnerId,
//         winnerPoints,
//         totalParticipants: sortedRankings.length
//       };
      
//     } catch (error) {
//       console.error('Error calculating stats:', error);
//       return { success: false, error: error.message };
//     }
//   };

//   // Handle completing the competition with stats update
//   const handleCompleteCompetition = async () => {
//     // Check if competition is already completed
//     if (competition.status === 'completed') {
//       Alert.alert('Info', 'This competition is already completed');
//       return;
//     }
    
//     // Check if user is the owner
//     if (competition.ownerId !== user.uid) {
//       Alert.alert('Error', 'Only the competition owner can complete it');
//       return;
//     }
    
//     Alert.alert(
//       'Complete Competition',
//       'This will finalize the results and update win/loss records. Continue?',
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Complete',
//           style: 'destructive',
//           onPress: async () => {
//             setIsCompleting(true);
//             try {
//               // First calculate and update stats
//               const statsResult = await calculateAndUpdateStats();
              
//               if (!statsResult.success) {
//                 if (statsResult.message === 'No submissions found') {
//                   Alert.alert('Cannot Complete', 'No submissions found. At least one participant must submit a workout.');
//                 } else {
//                   Alert.alert('Error', statsResult.error || 'Failed to calculate competition results');
//                 }
//                 setIsCompleting(false);
//                 return;
//               }
              
//               // Update competition status to completed
//               await updateDoc(doc(db, 'competitions', competition.id), {
//                 status: 'completed'
//               });
              
//               // Get winner's username for the success message
//               let winnerName = 'Unknown';
//               try {
//                 const winnerDoc = await getDoc(doc(db, 'users', statsResult.winnerId));
//                 if (winnerDoc.exists()) {
//                   winnerName = winnerDoc.data().username || 'Unknown';
//                 }
//               } catch (error) {
//                 console.log('Could not fetch winner name:', error);
//               }
              
//               Alert.alert(
//                 'Competition Completed!', 
//                 `Winner: ${winnerName} with ${statsResult.winnerPoints} points!\n\nAll participant stats have been updated.`,
//                 [{ text: 'OK', onPress: () => navigation.goBack() }]
//               );
//             } catch (error) {
//               console.error('Error completing competition:', error);
//               Alert.alert('Error', 'Failed to complete competition. Please try again.');
//             } finally {
//               setIsCompleting(false);
//             }
//           }
//         }
//       ]
//     );
//   };

//   useEffect(() => {
//     if (!competition?.id) {
//       stopRefreshing();
//       return;
//     }

//     // Calculate visibility status
//     const visibilityStatus = getScoreVisibility(competition);
//     setVisibility(visibilityStatus);

//     // Listen to submissions for this competition
//     const submissionsQuery = query(
//       collection(db, 'submissions'),
//       where('competitionId', '==', competition.id)
//     );

//     const unsubscribe = onSnapshot(
//       submissionsQuery, 
//       async (snapshot) => {
//         try {
//           // Get all submissions
//           const allSubmissions = snapshot.docs.map(doc => ({
//             id: doc.id,
//             ...doc.data()
//           }));
          
//           // Filter submissions based on visibility rules, always showing user's own
//           const visibleSubmissions = filterVisibleSubmissionsWithSelf(allSubmissions, competition, user.uid);
          
//           // Aggregate points by user (only from visible submissions)
//           const pointsByUser = {};
          
//           visibleSubmissions.forEach(submission => {
//             const userId = submission.userId;
            
//             if (!pointsByUser[userId]) {
//               pointsByUser[userId] = 0;
//             }
//             pointsByUser[userId] += submission.points || 0;
//           });

//           // Fetch user data for all participants
//           const userDataPromises = competition.participants.map(async (uid) => {
//             try {
//               const userDoc = await getDoc(doc(db, 'users', uid));
//               const userData = userDoc.exists() ? userDoc.data() : {};
              
//               return {
//                 id: uid,
//                 name: userData.username || 'Unknown User',
//                 points: pointsByUser[uid] || 0,
//                 isCurrentUser: uid === user.uid,
//                 profilePicture: userData.profilePicture || null,
//               };
//             } catch (error) {
//               console.error('Error fetching user:', error);
//               return {
//                 id: uid,
//                 name: 'Unknown User',
//                 points: pointsByUser[uid] || 0,
//                 isCurrentUser: uid === user.uid,
//                 profilePicture: null,
//               };
//             }
//           });

//           const usersWithPoints = await Promise.all(userDataPromises);
          
//           // Sort by points (descending) and assign positions
//           const sortedRankings = usersWithPoints
//             .sort((a, b) => b.points - a.points)
//             .map((user, index) => ({
//               ...user,
//               position: index + 1,
//             }));

//           setRankings(sortedRankings);
//           setLoading(false);
//           stopRefreshing(); // Stop refresh spinner when data loads
//         } catch (error) {
//           console.error('Error processing leaderboard:', error);
//           setLoading(false);
//           stopRefreshing();
//         }
//       },
//       (error) => {
//         console.error('Error fetching submissions:', error);
//         setLoading(false);
//         stopRefreshing(); // Stop refresh spinner on error
//       }
//     );

//     return () => {
//       unsubscribe();
//       // Clear timeout on cleanup
//       if (refreshTimeout) {
//         clearTimeout(refreshTimeout);
//       }
//     };
//   }, [competition?.id, competition?.participants, user.uid]);

//   // Separate top 3 from the rest
//   const topThree = rankings.slice(0, 3);
//   const restOfRankings = rankings.slice(3);

//   if (loading) {
//     return (
//       <View style={styles.container}>
//         <Header 
//           title="" 
//           backgroundColor="#FFFFFF"
//         />
//         <View style={styles.loadingContainer}>
//           <Text style={styles.loadingText}>Loading rankings...</Text>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <Header 
//         title="" 
//         backgroundColor="#FFFFFF"
//       />
//       <StatusBar style="dark" />
      
//       {/* Navigation Tabs */}
//       <View style={styles.tabContainer}>
//         {/* Me Tab */}
//         <TouchableOpacity 
//           style={styles.tab} 
//           onPress={() => {
//             navigation.navigate('CompetitionDetails', { 
//               competition,
//               initialTab: 'me'
//             });
//           }}
//         >
//           <Text style={styles.tabText}>Me</Text>
//         </TouchableOpacity>
        
//         {/* Others Tab */}
//         <TouchableOpacity 
//           style={styles.tab} 
//           onPress={() => {
//             navigation.navigate('CompetitionDetails', { 
//               competition,
//               initialTab: 'others'
//             });
//           }}
//         >
//           <Text style={styles.tabText}>Others</Text>
//         </TouchableOpacity>
        
//         {/* Rank Tab - Active */}
//         <TouchableOpacity 
//           style={[styles.tab, styles.activeTab]} 
//         >
//           <Text style={[styles.tabText, styles.activeTabText]}>Rank</Text>
//         </TouchableOpacity>
        
//         {/* Add Tab */}
//         <TouchableOpacity 
//           style={styles.tab} 
//           onPress={() => {
//             navigation.navigate('SubmissionForm', { competition });
//           }}
//         >
//           <Text style={styles.tabText}>Add</Text>
//         </TouchableOpacity>

//         {/* Rules Tab */}
//         <TouchableOpacity 
//           style={styles.tab} 
//           onPress={() => {
//             navigation.navigate('CompetitionDetails', { 
//               competition,
//               initialTab: 'rules'
//             });
//           }}
//         >
//           <Text style={styles.tabText}>Rules</Text>
//         </TouchableOpacity>
//       </View>
      
//       {/* Visibility Status Banner */}
//       {visibility && visibility.isInHiddenPeriod && (
//         <View style={styles.visibilityBanner}>
//           <Ionicons name="eye-off" size={20} color="#FFF" />
//           <View style={styles.visibilityTextContainer}>
//             <Text style={styles.visibilityText}>
//               Current cycle scores hidden • Showing accumulated points through cycle {visibility.currentCycle}
//             </Text>
//             <View style={styles.timestampRow}>
//               <Text style={styles.timestampText}>
//                 Last updated: {formatRevealDate(getLastRevealDate(competition))}
//               </Text>
//               <Text style={styles.timestampText}>
//                 Next reveal: {formatRevealDate(visibility.nextRevealDate)}
//               </Text>
//             </View>
//           </View>
//         </View>
//       )}
      
//       <View style={styles.podiumContainer}>
//         {topThree.length > 0 && (
//           <View style={styles.topThreeContainer}>
//             {/* Reorder for podium display: 2nd, 1st, 3rd */}
//             {[1, 0, 2].map(index => {
//               const user = topThree[index];
//               if (!user) return <View key={index} style={styles.topUserColumn} />;
              
//               const isFirst = user.position === 1;
//               const avatarSize = isFirst ? 96 : 80;
              
//               return (
//                 <View 
//                   key={user.id} 
//                   style={[
//                     styles.topUserColumn,
//                     isFirst && styles.firstPlaceOffset,
//                   ]}
//                 >
//                   <TouchableOpacity 
//                     style={styles.topUserTouchable}
//                     activeOpacity={0.7}
//                   >
//                     {/* Crown for 1st place */}
//                     {isFirst && (
//                       <View style={styles.crownContainer}>
//                         <Ionicons 
//                           name="trophy" 
//                           size={30} 
//                           color="#A4E64F" 
//                         />
//                       </View>
//                     )}
                    
//                     {/* Avatar with ring */}
//                     <View style={[
//                       styles.avatarContainer,
//                       { width: avatarSize, height: avatarSize }
//                     ]}>
//                       <View style={[
//                         styles.avatarRing,
//                         { width: avatarSize, height: avatarSize }
//                       ]}>
//                         <View style={styles.avatarInner}>
//                           <Ionicons 
//                             name="person" 
//                             size={isFirst ? 48 : 40} 
//                             color="#999" 
//                           />
//                         </View>
//                       </View>
                      
//                       {/* Rank badge */}
//                       <View style={styles.rankBadge}>
//                         <Text style={styles.rankBadgeText}>{user.position}</Text>
//                       </View>
//                     </View>
                    
//                     {/* User name */}
//                     <Text style={styles.podiumUserName} numberOfLines={1} ellipsizeMode="tail">
//                       {user.name}
//                     </Text>
                    
//                     {/* Points with star */}
//                     <View style={styles.podiumPointsContainer}>
//                       <Ionicons name="star" size={14} color="#A4E64F" />
//                       <Text style={styles.podiumPointsText}>
//                         {`${user.points.toFixed(0)} pts`}
//                       </Text>
//                     </View>
//                   </TouchableOpacity>
//                 </View>
//               );
//             })}
//           </View>
//         )}
//       </View>

//       {/* Show completion status if already completed */}
//       {competition.status === 'completed' && (
//         <View style={styles.completedBanner}>
//           <Ionicons name="trophy" size={20} color="#FFD700" />
//           <Text style={styles.completedText}>Competition Completed</Text>
//           {competition.winnerId && rankings.length > 0 && (
//             <Text style={styles.winnerText}>
//               Winner: {rankings.find(r => r.id === competition.winnerId)?.name}
//             </Text>
//           )}
//         </View>
//       )}
      
//       <View style={styles.rankingsContainer}>
//         <Text style={styles.rankingsTitle}>Rankings</Text>
//         <ScrollView 
//           style={styles.rankingsList}
//           showsVerticalScrollIndicator={false}
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={onRefresh}
//               colors={['#A4D65E']} // Android
//               tintColor="#A4D65E" // iOS
//             />
//           }
//         >
//           {rankings.length === 0 ? (
//             <Text style={styles.emptyText}>No submissions yet. Be the first to earn points!</Text>
//           ) : (
//             restOfRankings.map(user => (
//               <View 
//                 key={user.id} 
//                 style={[
//                   styles.rankingItem, 
//                   user.isCurrentUser && styles.currentUserRanking
//                 ]}
//               >
//                 <Text style={styles.rankingPosition}>{user.position}</Text>
//                 <View style={styles.rankingUserImageContainer}>
//                   {user.profilePicture ? (
//                     <Image 
//                       source={{ uri: user.profilePicture }}
//                       style={styles.rankingUserImage}
//                       resizeMode="cover"
//                     />
//                   ) : (
//                     <Ionicons name="person-circle" size={36} color="#777" />
//                   )}
//                 </View>
//                 <Text style={[
//                   styles.rankingUserName,
//                   user.isCurrentUser && styles.currentUserText
//                 ]}>
//                   {user.isCurrentUser ? 'You' : user.name}
//                 </Text>
//                 <Text style={[
//                   styles.rankingPoints,
//                   user.isCurrentUser && styles.currentUserText
//                 ]}>
//                   {`${user.points.toFixed(0)} pts`}
//                 </Text>
//               </View>
//             ))
//           )}
//         </ScrollView>
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   tabContainer: {
//     flexDirection: 'row',
//     backgroundColor: '#333',
//     padding: 5,
//     borderRadius: 25,
//     marginHorizontal: 16,
//     marginVertical: 16,
//   },
//   tab: {
//     flex: 1,
//     paddingVertical: 10,
//     alignItems: 'center',
//     borderRadius: 20,
//   },
//   activeTab: {
//     backgroundColor: '#1A1E23',
//   },
//   tabText: {
//     color: '#777',
//     fontWeight: 'bold',
//   },
//   activeTabText: {
//     color: '#A4D65E',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   loadingText: {
//     fontSize: 16,
//     color: '#666',
//   },
//   emptyText: {
//     textAlign: 'center',
//     color: '#666',
//     marginTop: 20,
//     fontSize: 16,
//   },
//   podiumContainer: {
//     height: 260,
//     paddingTop: 24,
//     paddingBottom: 20,
//     alignItems: 'center',
//   },
//   topThreeContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'flex-end',
//     width: '100%',
//     paddingHorizontal: 12,
//   },
//   topUserColumn: {
//     flex: 1,
//     alignItems: 'center',
//     paddingHorizontal: 4,
//   },
//   firstPlaceOffset: {
//     marginTop: -12,
//   },
//   topUserTouchable: {
//     alignItems: 'center',
//     minHeight: 44,
//   },
//   crownContainer: {
//     position: 'absolute',
//     top: -15,
//     zIndex: 1,
//     width: 44,
//     height: 30,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   avatarContainer: {
//     position: 'relative',
//     marginBottom: 8,
//   },
//   avatarRing: {
//     borderRadius: 100,
//     borderWidth: 4,
//     borderColor: '#A4E64F',
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#FFFFFF',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 5,
//   },
//   avatarInner: {
//     width: '100%',
//     height: '100%',
//     borderRadius: 100,
//     backgroundColor: '#F5F5F5',
//     justifyContent: 'center',
//     alignItems: 'center',
//     overflow: 'hidden',
//   },
//   rankBadge: {
//     position: 'absolute',
//     bottom: -6,
//     alignSelf: 'center',
//     width: 28,
//     height: 28,
//     borderRadius: 14,
//     backgroundColor: '#A4E64F',
//     justifyContent: 'center',
//     alignItems: 'center',
//     zIndex: 2,
//   },
//   rankBadgeText: {
//     color: '#222',
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   podiumUserName: {
//     color: '#222',
//     fontSize: 16,
//     fontWeight: '600',
//     marginTop: 8,
//     marginBottom: 4,
//     paddingHorizontal: 8,
//     textAlign: 'center',
//   },
//   podiumPointsContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   podiumPointsText: {
//     color: '#666',
//     fontSize: 14,
//     fontWeight: '500',
//     marginLeft: 4,
//   },
//   completedBanner: {
//     backgroundColor: '#FFF8E1',
//     padding: 12,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     flexWrap: 'wrap',
//   },
//   completedText: {
//     color: '#F57C00',
//     fontSize: 16,
//     fontWeight: '600',
//     marginLeft: 8,
//   },
//   winnerText: {
//     color: '#F57C00',
//     fontSize: 14,
//     fontWeight: '500',
//     width: '100%',
//     textAlign: 'center',
//     marginTop: 4,
//   },
//   rankingsContainer: {
//     flex: 1,
//     paddingHorizontal: 16,
//     paddingTop: 20,
//   },
//   rankingsTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#1A1E23',
//     marginBottom: 15,
//   },
//   rankingsList: {
//     flex: 1,
//   },
//   rankingItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#FFFFFF',
//     borderRadius: 10,
//     padding: 12,
//     marginBottom: 10,
//   },
//   currentUserRanking: {
//     backgroundColor: '#A4D65E',
//   },
//   rankingPosition: {
//     width: 30,
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#1A1E23',
//   },
//   rankingUserImageContainer: {
//     marginRight: 12,
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     overflow: 'hidden',
//   },
//   rankingUserImage: {
//     width: '100%',
//     height: '100%',
//   },
//   rankingUserName: {
//     flex: 1,
//     fontSize: 16,
//     color: '#1A1E23',
//   },
//   rankingPoints: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#1A1E23',
//   },
//   currentUserText: {
//     color: '#1A1E23',
//   },
//   visibilityBanner: {
//     backgroundColor: '#FF9800',
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   visibilityText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   visibilityTextContainer: {
//     flex: 1,
//     marginLeft: 8,
//   },
//   timestampRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 4,
//   },
//   timestampText: {
//     color: '#FFFFFF',
//     fontSize: 12,
//     opacity: 0.9,
//   },
// });

// export default LeaderboardScreen;
