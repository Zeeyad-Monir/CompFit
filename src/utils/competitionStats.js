const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Function to update user win/loss stats when competition completes
exports.updateUserStats = functions.firestore
  .document('competitions/{competitionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only process if competition just completed
    if (before.status !== 'completed' && after.status === 'completed') {
      const competitionId = context.params.competitionId;
      
      try {
        console.log(`Processing completed competition: ${competitionId}`);
        
        // Get all submissions for this competition
        const submissionsSnapshot = await db.collection('submissions')
          .where('competitionId', '==', competitionId)
          .get();
        
        // Calculate total points per user
        const userPoints = {};
        submissionsSnapshot.forEach(doc => {
          const submission = doc.data();
          const userId = submission.userId;
          userPoints[userId] = (userPoints[userId] || 0) + (submission.points || 0);
        });
        
        // Sort users by points to determine rankings
        const rankings = Object.entries(userPoints)
          .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
        
        if (rankings.length === 0) {
          console.log('No submissions found for competition');
          return;
        }
        
        // Determine winner (highest points)
        const winnerId = rankings[0][0];
        const winnerPoints = rankings[0][1];
        
        // Get all participants except winner
        const participants = after.participants || [];
        const losers = participants.filter(uid => uid !== winnerId);
        
        // Update stats using batch write for atomicity
        const batch = db.batch();
        
        // Update winner
        const winnerRef = db.collection('users').doc(winnerId);
        batch.update(winnerRef, {
          wins: admin.firestore.FieldValue.increment(1),
          totals: admin.firestore.FieldValue.increment(1)
        });
        
        // Update losers
        losers.forEach(loserId => {
          const loserRef = db.collection('users').doc(loserId);
          batch.update(loserRef, {
            losses: admin.firestore.FieldValue.increment(1),
            totals: admin.firestore.FieldValue.increment(1)
          });
        });
        
        // Also update the competition with the calculated winner
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
        console.log(`Updated stats: Winner ${winnerId} with ${winnerPoints} points, ${losers.length} losers`);
        
      } catch (error) {
        console.error('Error updating user stats:', error);
      }
    }
  });

// Scheduled function to mark expired competitions as completed
exports.completeExpiredCompetitions = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = new Date();
    
    try {
      const expiredCompetitions = await db.collection('competitions')
        .where('status', '!=', 'completed')
        .where('endDate', '<=', now.toISOString())
        .get();
      
      if (expiredCompetitions.empty) {
        console.log('No expired competitions to complete');
        return;
      }
      
      const batch = db.batch();
      
      expiredCompetitions.forEach(doc => {
        batch.update(doc.ref, {
          status: 'completed'
        });
      });
      
      await batch.commit();
      console.log(`Marked ${expiredCompetitions.size} competitions as completed`);
      
    } catch (error) {
      console.error('Error completing expired competitions:', error);
    }
  });

// Manual function to complete a competition (callable from client)
exports.manuallyCompleteCompetition = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { competitionId } = data;
  const userId = context.auth.uid;
  
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
    
    // Update status to completed
    await competitionRef.update({
      status: 'completed'
    });
    
    return { success: true, message: 'Competition completed successfully' };
    
  } catch (error) {
    console.error('Error manually completing competition:', error);
    throw new functions.https.HttpsError('internal', 'Failed to complete competition');
  }
});