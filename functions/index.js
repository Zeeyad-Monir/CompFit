const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to update user win/loss stats when a competition completes
 * Triggers when a competition document is updated
 */
exports.updateUserStats = functions.firestore
  .document('competitions/{competitionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check for idempotency - only process when status changes to 'completed'
    // and stats haven't been processed yet (no winnerId)
    if (before.status === 'completed' || after.status !== 'completed') {
      console.log('Competition not newly completed, skipping stats update');
      return null;
    }
    
    // Additional check for idempotency
    if (after.winnerId && after.finalRankings) {
      console.log('Competition already has results, skipping');
      return null;
    }
    
    const competitionId = context.params.competitionId;
    
    try {
      console.log(`Processing newly completed competition: ${competitionId}`);
      
      // Get all submissions for this competition
      const submissionsSnapshot = await db.collection('submissions')
        .where('competitionId', '==', competitionId)
        .get();
      
      // Calculate total points per user
      const userPoints = {};
      submissionsSnapshot.forEach(doc => {
        const submission = doc.data();
        const userId = submission.userId;
        const points = submission.points || 0;
        userPoints[userId] = (userPoints[userId] || 0) + points;
      });
      
      // Include all participants, even those with no submissions (0 points)
      const participants = after.participants || [];
      participants.forEach(userId => {
        if (!(userId in userPoints)) {
          userPoints[userId] = 0;
        }
      });
      
      // Sort users by points to determine rankings
      const rankings = Object.entries(userPoints)
        .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
      
      if (rankings.length === 0) {
        console.log('No participants in competition');
        return null;
      }
      
      // Determine winner (highest points)
      const winnerId = rankings[0][0];
      const winnerPoints = rankings[0][1];
      
      console.log(`Winner: ${winnerId} with ${winnerPoints} points`);
      console.log(`Total participants: ${rankings.length}`);
      
      // Use batch write for atomic updates
      const batch = db.batch();
      
      // Update winner's stats
      if (winnerId) {
        const winnerRef = db.collection('users').doc(winnerId);
        batch.update(winnerRef, {
          wins: admin.firestore.FieldValue.increment(1),
          totals: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Update losers' stats (everyone except the winner)
      for (let i = 1; i < rankings.length; i++) {
        const loserId = rankings[i][0];
        if (loserId) {
          const loserRef = db.collection('users').doc(loserId);
          batch.update(loserRef, {
            losses: admin.firestore.FieldValue.increment(1),
            totals: admin.firestore.FieldValue.increment(1),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      // Update competition with final results
      batch.update(change.after.ref, {
        winnerId: winnerId,
        winnerPoints: winnerPoints,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        finalRankings: rankings.map(([userId, points], index) => ({
          userId,
          points,
          position: index + 1
        }))
      });
      
      await batch.commit();
      console.log(`Successfully updated stats for ${rankings.length} users`);
      
      return { success: true, winnerId, participantCount: rankings.length };
      
    } catch (error) {
      console.error('Error updating user stats:', error);
      // Don't throw error to prevent retries on permanent failures
      return null;
    }
  });

/**
 * Scheduled function to automatically complete expired competitions
 * Runs every hour to check for competitions that have ended
 */
exports.completeExpiredCompetitions = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = new Date();
    
    try {
      console.log('Checking for expired competitions...');
      
      // Find competitions that should be completed
      const competitionsSnapshot = await db.collection('competitions')
        .where('status', '!=', 'completed')
        .get();
      
      const batch = db.batch();
      let count = 0;
      
      for (const doc of competitionsSnapshot.docs) {
        const competition = doc.data();
        const endDate = new Date(competition.endDate);
        
        // Check if competition has ended
        if (endDate < now) {
          console.log(`Marking competition ${doc.id} as completed`);
          batch.update(doc.ref, {
            status: 'completed'
          });
          count++;
        }
      }
      
      if (count > 0) {
        await batch.commit();
        console.log(`Marked ${count} competitions as completed`);
      } else {
        console.log('No expired competitions found');
      }
      
      return null;
      
    } catch (error) {
      console.error('Error completing expired competitions:', error);
      return null;
    }
  });

/**
 * HTTP callable function to manually complete a competition
 * Can be called from the client by the competition owner
 */
exports.manuallyCompleteCompetition = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { competitionId } = data;
  const userId = context.auth.uid;
  
  if (!competitionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Competition ID is required');
  }
  
  try {
    // Get competition details
    const competitionRef = db.collection('competitions').doc(competitionId);
    const competitionDoc = await competitionRef.get();
    
    if (!competitionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Competition not found');
    }
    
    const competition = competitionDoc.data();
    
    // Check if user is the owner
    if (competition.ownerId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only competition owner can complete it');
    }
    
    // Check if already completed
    if (competition.status === 'completed') {
      throw new functions.https.HttpsError('already-exists', 'Competition is already completed');
    }
    
    // Update status to completed - this will trigger the updateUserStats function
    await competitionRef.update({
      status: 'completed'
    });
    
    console.log(`Competition ${competitionId} manually completed by owner ${userId}`);
    
    return { 
      success: true, 
      message: 'Competition completed successfully. Stats will update shortly.' 
    };
    
  } catch (error) {
    console.error('Error manually completing competition:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to complete competition');
  }
});