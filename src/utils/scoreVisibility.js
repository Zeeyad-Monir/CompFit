/**
 * Utility functions for managing cyclic score reveal system
 * Handles the logic for hiding/showing scores based on competition settings
 */

/**
 * Determines if scores should be visible based on the cyclic reveal schedule
 * @param {Object} competition - The competition object with leaderboardUpdateDays, startDate, endDate
 * @returns {Object} Visibility status and timing information
 */
export const getScoreVisibility = (competition) => {
  const {
    leaderboardUpdateDays,
    startDate,
    endDate
  } = competition;
  
  // If live updates (0 days), always show scores
  if (!leaderboardUpdateDays || leaderboardUpdateDays === 0) {
    return { 
      shouldShowScores: true, 
      nextRevealDate: null, 
      currentCycle: null,
      daysUntilReveal: 0,
      isInHiddenPeriod: false,
      message: 'Live updates enabled'
    };
  }
  
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // If competition hasn't started yet
  if (now < start) {
    return {
      shouldShowScores: false,
      nextRevealDate: new Date(start.getTime() + leaderboardUpdateDays * 24 * 60 * 60 * 1000),
      currentCycle: -1,
      daysUntilReveal: leaderboardUpdateDays,
      isInHiddenPeriod: true,
      message: 'Competition not started'
    };
  }
  
  // If competition ended, always show all scores
  if (now >= end) {
    return { 
      shouldShowScores: true, 
      nextRevealDate: null, 
      currentCycle: null,
      daysUntilReveal: 0,
      isInHiddenPeriod: false,
      message: 'Competition ended - all scores visible'
    };
  }
  
  // Calculate milliseconds since start
  const msSinceStart = now - start;
  const daysSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60 * 24));
  
  // Calculate current cycle (0-indexed)
  const currentCycle = Math.floor(daysSinceStart / leaderboardUpdateDays);
  
  // Calculate days into current cycle
  const daysIntoCycle = daysSinceStart % leaderboardUpdateDays;
  
  // Scores are revealed on the first day of each new cycle (except cycle 0)
  // During cycle 0 (first period), scores are hidden
  // At the start of cycle 1, scores from cycle 0 are revealed
  // Then hidden again until start of cycle 2, etc.
  const shouldShowScores = currentCycle > 0;
  
  // Calculate next reveal date
  let nextRevealDate;
  let daysUntilReveal;
  
  if (currentCycle === 0) {
    // In first cycle, next reveal is at start of cycle 1
    daysUntilReveal = leaderboardUpdateDays - daysIntoCycle;
    nextRevealDate = new Date(start.getTime() + leaderboardUpdateDays * 24 * 60 * 60 * 1000);
  } else {
    // In subsequent cycles, next reveal is at start of next cycle
    daysUntilReveal = leaderboardUpdateDays - daysIntoCycle;
    nextRevealDate = new Date(now.getTime() + daysUntilReveal * 24 * 60 * 60 * 1000);
  }
  
  // Cap next reveal date at competition end
  if (nextRevealDate > end) {
    nextRevealDate = new Date(end);
    daysUntilReveal = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }
  
  return {
    shouldShowScores,
    nextRevealDate,
    currentCycle,
    daysUntilReveal,
    daysIntoCycle,
    isInHiddenPeriod: !shouldShowScores,
    message: shouldShowScores 
      ? `Scores visible (Cycle ${currentCycle + 1})` 
      : `Scores hidden for ${daysUntilReveal} more day${daysUntilReveal !== 1 ? 's' : ''}`
  };
};

/**
 * Gets the cutoff date for which submissions should be included in visible scores
 * @param {Object} competition - The competition object
 * @returns {Date|null} The date before which submissions should be counted, or null for live updates
 */
export const getScoreCutoffDate = (competition) => {
  const { leaderboardUpdateDays, startDate, endDate } = competition;
  
  // If live updates, no cutoff needed
  if (!leaderboardUpdateDays || leaderboardUpdateDays === 0) {
    return null;
  }
  
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // If competition ended, include everything
  if (now >= end) {
    return end;
  }
  
  // If competition hasn't started, no submissions yet
  if (now < start) {
    return start;
  }
  
  const daysSinceStart = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const currentCycle = Math.floor(daysSinceStart / leaderboardUpdateDays);
  
  if (currentCycle === 0) {
    // In first cycle, no scores shown yet
    return start;
  }
  
  // Calculate the end of the last completed cycle
  const lastCompletedCycle = currentCycle - 1;
  const cutoffDate = new Date(start);
  cutoffDate.setDate(cutoffDate.getDate() + (lastCompletedCycle + 1) * leaderboardUpdateDays);
  
  return cutoffDate;
};

/**
 * Filters submissions based on the visibility cutoff date
 * @param {Array} submissions - Array of submission objects with createdAt timestamps
 * @param {Object} competition - The competition object
 * @returns {Array} Filtered submissions that should be visible
 */
export const filterVisibleSubmissions = (submissions, competition) => {
  const cutoffDate = getScoreCutoffDate(competition);
  
  // If no cutoff (live updates or competition ended), show all
  if (!cutoffDate) {
    return submissions;
  }
  
  // Filter submissions to only those before the cutoff
  return submissions.filter(submission => {
    const submissionDate = submission.createdAt?.toDate ? 
      submission.createdAt.toDate() : 
      new Date(submission.createdAt);
    return submissionDate <= cutoffDate;
  });
};

/**
 * Calculates visible points for a user based on filtered submissions
 * @param {Array} submissions - All submissions for a user
 * @param {Object} competition - The competition object
 * @returns {number} Total visible points
 */
export const calculateVisiblePoints = (submissions, competition) => {
  const visibleSubmissions = filterVisibleSubmissions(submissions, competition);
  return visibleSubmissions.reduce((total, sub) => total + (sub.points || 0), 0);
};

/**
 * Formats the time until next reveal in a user-friendly way
 * @param {number} daysUntilReveal - Number of days until next reveal
 * @returns {string} Formatted string
 */
export const formatTimeUntilReveal = (daysUntilReveal) => {
  if (daysUntilReveal === 0) {
    return 'Revealing soon';
  } else if (daysUntilReveal === 1) {
    return '1 day remaining';
  } else {
    return `${daysUntilReveal} days remaining`;
  }
};

/**
 * Gets a display message for the current visibility state
 * @param {Object} visibility - The visibility object from getScoreVisibility
 * @returns {string} User-friendly message
 */
export const getVisibilityMessage = (visibility) => {
  if (!visibility.isInHiddenPeriod) {
    return visibility.message;
  }
  
  return `Scores hidden • ${formatTimeUntilReveal(visibility.daysUntilReveal)}`;
};

/**
 * Filters submissions based on visibility rules, but always shows user's own submissions
 * @param {Array} submissions - Array of submission objects with createdAt timestamps
 * @param {Object} competition - The competition object
 * @param {string} currentUserId - The ID of the current user
 * @returns {Array} Filtered submissions that should be visible
 */
export const filterVisibleSubmissionsWithSelf = (submissions, competition, currentUserId) => {
  const cutoffDate = getScoreCutoffDate(competition);
  
  // If no cutoff (live updates or competition ended), show all
  if (!cutoffDate) {
    return submissions;
  }
  
  // Filter submissions - always include user's own
  return submissions.filter(submission => {
    // Always show current user's own submissions
    if (submission.userId === currentUserId) {
      return true;
    }
    
    // For others, apply the visibility rules
    const submissionDate = submission.createdAt?.toDate ? 
      submission.createdAt.toDate() : 
      new Date(submission.createdAt);
    return submissionDate <= cutoffDate;
  });
};

/**
 * Calculates visible points for a user based on filtered submissions with self always visible
 * @param {Array} submissions - All submissions for a user
 * @param {Object} competition - The competition object
 * @param {string} currentUserId - The ID of the current user
 * @returns {number} Total visible points
 */
export const calculateVisiblePointsWithSelf = (submissions, competition, currentUserId) => {
  const visibleSubmissions = filterVisibleSubmissionsWithSelf(submissions, competition, currentUserId);
  return visibleSubmissions.reduce((total, sub) => total + (sub.points || 0), 0);
};