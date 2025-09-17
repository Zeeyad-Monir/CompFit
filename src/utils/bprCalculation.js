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
  if (!competitions || competitions.length === 0) {
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
  // Combine user with friends for ranking
  const allUsers = [
    { id: userId, ...userBPR },
    ...friendsBPRData
  ];
  
  // Sort by BPR descending with tiebreakers
  allUsers.sort((a, b) => {
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
    
    // Final tiebreaker: User ID for consistency
    return a.id.localeCompare(b.id);
  });
  
  // Find user's position
  const userIndex = allUsers.findIndex(u => u.id === userId);
  const friendsRank = userIndex + 1;
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
      rank: idx + 1
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
  return firestoreCompetitions
    .map(comp => {
      // Find user's ranking in the competition
      const userRanking = comp.finalRankings?.find(r => r.userId === userId);
      if (!userRanking?.position) return null;
      
      return {
        competitionId: comp.id,
        finishRank: userRanking.position,
        fieldSize: comp.finalRankings?.length || comp.participants?.length || 0,
        endedAt: comp.completedAt?.toDate ? comp.completedAt.toDate() : new Date(comp.endDate),
        points: userRanking.points || 0
      };
    })
    .filter(comp => comp !== null); // Remove invalid competitions
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