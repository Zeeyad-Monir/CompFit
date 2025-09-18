/**
 * Bayesian Placement Rating (BPR) Calculation Module
 * 
 * This module implements a fair ranking system that:
 * - Rewards higher placements in larger fields
 * - Discounts stale results with recency weighting
 * - Penalizes small sample sizes to prevent one-off wins from dominating
 * - Applies inactivity decay for users who haven't competed recently
 */

// Configuration constants for BPR calculation
const BPR_CONFIG = {
  DECAY: 0.90,                    // Recency decay factor
  K: 5,                           // Prior strength (virtual competitions)
  mu0: 0.50,                      // Prior mean (neutral performance)
  MAX_HISTORY: 40,                // Maximum competitions to consider
  INACTIVE_AFTER_DAYS: 60,        // Days before inactivity decay starts
  INACTIVE_WEEKLY_FACTOR: 0.99    // Weekly decay factor for inactive users
};

/**
 * Calculate placement score from competition rank
 * @param {number} rank - User's finishing position (1 = first)
 * @param {number} fieldSize - Total number of participants
 * @returns {number} Normalized score between 0 and 1
 */
function calculatePlacementScore(rank, fieldSize) {
  if (fieldSize <= 1) return 0.5; // Edge case: solo competition
  return (fieldSize - rank) / (fieldSize - 1);
}

/**
 * Calculate size weight using logarithmic scaling
 * @param {number} fieldSize - Number of participants
 * @returns {number} Weight based on field size
 */
function calculateSizeWeight(fieldSize) {
  if (fieldSize <= 1) return 0.5;
  return Math.log2(Math.max(fieldSize, 2));
}

/**
 * Calculate BPR score for a single user
 * @param {Array} competitions - Array of competition records
 * @param {Date} now - Current date for recency/inactivity calculations
 * @returns {Object} BPR calculation result
 */
export function calculateBPR(competitions, now = new Date()) {
  console.log(`[BPR Calc Debug] Input competitions: ${competitions?.length || 0}`);
  
  if (!competitions || competitions.length === 0) {
    console.log('[BPR Calc Debug] No competitions - returning default BPR of 0.50');
    return {
      bpr: BPR_CONFIG.mu0,
      competitionsCount: 0,
      isProvisional: true,
      weightedAverage: BPR_CONFIG.mu0,
      totalWeight: 0
    };
  }

  // Sort competitions by date (most recent first) and limit to MAX_HISTORY
  const sortedComps = [...competitions]
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, BPR_CONFIG.MAX_HISTORY);

  let sumWeight = 0;
  let sumWeightedScore = 0;
  
  // Calculate weighted scores
  sortedComps.forEach((comp, index) => {
    const k = index + 1; // 1-indexed for recency calculation
    
    // Calculate placement score
    const s = calculatePlacementScore(comp.finishRank, comp.fieldSize);
    
    // Calculate weights
    const sizeWeight = calculateSizeWeight(comp.fieldSize);
    const recencyWeight = Math.pow(BPR_CONFIG.DECAY, k);
    const totalWeight = sizeWeight * recencyWeight;
    
    sumWeight += totalWeight;
    sumWeightedScore += totalWeight * s;
  });

  // Calculate weighted average
  const G = sortedComps.length;
  const weightedAverage = sumWeight > 0 ? sumWeightedScore / sumWeight : BPR_CONFIG.mu0;
  
  // Apply Bayesian shrinkage toward prior mean
  let bpr = (weightedAverage * G + BPR_CONFIG.mu0 * BPR_CONFIG.K) / (G + BPR_CONFIG.K);
  
  // Apply inactivity decay if applicable
  if (sortedComps.length > 0) {
    const mostRecent = sortedComps[0].endedAt;
    const daysInactive = Math.floor((now - mostRecent) / (1000 * 60 * 60 * 24));
    
    if (daysInactive > BPR_CONFIG.INACTIVE_AFTER_DAYS) {
      const weeksInactive = Math.floor((daysInactive - BPR_CONFIG.INACTIVE_AFTER_DAYS) / 7);
      bpr = bpr * Math.pow(BPR_CONFIG.INACTIVE_WEEKLY_FACTOR, weeksInactive);
      bpr = Math.max(bpr, BPR_CONFIG.mu0); // Don't decay below prior mean
    }
  }
  
  return {
    bpr: Math.round(bpr * 100) / 100, // Round to 2 decimal places
    competitionsCount: G,
    isProvisional: G < 3,
    weightedAverage: Math.round(weightedAverage * 100) / 100,
    totalWeight: Math.round(sumWeight * 100) / 100
  };
}

/**
 * Calculate recent form (W/L pattern) for last N competitions
 * @param {Array} competitions - Competition records
 * @param {number} count - Number of recent competitions to include
 * @returns {Array} Array of 'W' or 'L' strings
 */
export function getRecentForm(competitions, count = 5) {
  if (!competitions || competitions.length === 0) {
    return [];
  }
  
  return competitions
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, count)
    .map(comp => comp.finishRank === 1 ? 'W' : 'L')
    .reverse(); // Oldest to newest for display
}

/**
 * Calculate rankings for a group of friends
 * @param {string} userId - Current user's ID
 * @param {Object} userBPR - Current user's BPR data
 * @param {Array} friendsBPRData - Array of friends' BPR data with IDs
 * @returns {Object} Rankings data
 */
export function calculateFriendsRankings(userId, userBPR, friendsBPRData) {
  // Combine user with friends for ranking - they should already have consistent ranks
  const allUsers = [
    userBPR,
    ...friendsBPRData
  ];
  
  // Use the pre-calculated ranks (from ProfileScreen where all data was processed consistently)
  // Sort by the rank property that was already assigned
  allUsers.sort((a, b) => {
    // Use existing rank if available
    if (a.rank !== undefined && b.rank !== undefined) {
      return a.rank - b.rank;
    }
    
    // Fallback to BPR-based sorting with consistent tiebreakers
    // Primary: Higher BPR wins
    if (a.bpr !== b.bpr) {
      return b.bpr - a.bpr;
    }
    
    // Tiebreaker 1: More competitions wins
    if (a.competitionsCount !== b.competitionsCount) {
      return b.competitionsCount - a.competitionsCount;
    }
    
    // Tiebreaker 2: Higher weighted average (unshrunk performance)
    if (a.weightedAverage !== b.weightedAverage) {
      return b.weightedAverage - a.weightedAverage;
    }
    
    // Final tiebreaker: User ID for consistency (ensures same ordering on all devices)
    return a.id.localeCompare(b.id);
  });
  
  // Find user's position using the consistent ranking
  const userRankData = allUsers.find(u => u.id === userId);
  const friendsRank = userRankData ? userRankData.rank : allUsers.findIndex(u => u.id === userId) + 1;
  const totalFriends = allUsers.length;
  
  // Calculate percentile (0 to 100)
  let friendsPercentile = 0;
  if (totalFriends > 1) {
    const usersBehind = totalFriends - friendsRank;
    friendsPercentile = Math.round((usersBehind / (totalFriends - 1)) * 100);
  }
  
  return {
    friendsRank,
    totalFriends,
    friendsPercentile,
    bprScore: userBPR.bpr,
    isProvisional: userBPR.isProvisional,
    competitionsCount: userBPR.competitionsCount,
    rankings: allUsers.map((user, idx) => ({
      ...user,
      rank: user.rank !== undefined ? user.rank : idx + 1
    }))
  };
}

/**
 * Transform competition data from Firestore format
 * @param {Array} firestoreCompetitions - Raw competition data from Firestore
 * @param {string} userId - User ID to find rankings for
 * @returns {Array} Transformed competition records for BPR calculation
 */
export function transformCompetitionData(firestoreCompetitions, userId) {
  console.log(`[Transform Debug] Processing ${firestoreCompetitions.length} competitions for user ${userId}`);
  
  const transformed = firestoreCompetitions
    .map((comp, index) => {
      // Log structure of first competition for debugging
      if (index === 0) {
        console.log('[Transform Debug] Competition structure:', {
          id: comp.id,
          hasFinalRankings: !!comp.finalRankings,
          finalRankingsLength: comp.finalRankings?.length,
          firstRanking: comp.finalRankings?.[0],
          hasParticipants: !!comp.participants,
          participantsIncludesUser: comp.participants?.includes(userId)
        });
      }
      
      // Find user's ranking in the competition
      const userRanking = comp.finalRankings?.find(r => {
        // Handle different possible field names for user ID
        return r.userId === userId || r.uid === userId || r.id === userId;
      });
      
      if (!userRanking) {
        // User didn't finish this competition or isn't in final rankings
        return null;
      }
      
      // Get position from various possible field names
      const position = userRanking.position || userRanking.rank || userRanking.place;
      if (!position) {
        console.log(`[Transform Debug] No position found for user in comp ${comp.id}`);
        return null;
      }
      
      // Determine the date - handle various field names and formats
      let endedAt;
      if (comp.completedAt) {
        endedAt = comp.completedAt.toDate ? comp.completedAt.toDate() : new Date(comp.completedAt);
      } else if (comp.endDate) {
        endedAt = comp.endDate.toDate ? comp.endDate.toDate() : new Date(comp.endDate);
      } else if (comp.endedAt) {
        endedAt = comp.endedAt.toDate ? comp.endedAt.toDate() : new Date(comp.endedAt);
      } else {
        endedAt = new Date(); // Fallback to now
      }
      
      return {
        competitionId: comp.id,
        finishRank: position,
        fieldSize: comp.finalRankings?.length || comp.participants?.length || 2,
        endedAt: endedAt,
        points: userRanking.points || userRanking.score || 0
      };
    })
    .filter(comp => comp !== null); // Remove invalid competitions
    
  console.log(`[Transform Debug] Successfully transformed ${transformed.length} competitions for user ${userId}`);
  return transformed;
}

/**
 * Get debug info for BPR calculation (useful for tooltips)
 * @param {Object} bprResult - Result from calculateBPR
 * @returns {Object} Human-readable debug information
 */
export function getBPRDebugInfo(bprResult) {
  const { bpr, competitionsCount, isProvisional, weightedAverage } = bprResult;
  
  return {
    score: bpr,
    competitions: competitionsCount,
    status: isProvisional ? 'Provisional (needs 3+ competitions)' : 'Established',
    rawPerformance: weightedAverage,
    description: `BPR: ${bpr} based on ${competitionsCount} competition${competitionsCount !== 1 ? 's' : ''}. ` +
                `Raw performance: ${weightedAverage}. ` +
                `${isProvisional ? 'Provisional ranking - compete in more events for accuracy.' : ''}`
  };
}

// Export configuration for testing/tuning
export { BPR_CONFIG };