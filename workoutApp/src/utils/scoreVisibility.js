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
  
  // Progressive reveal: current cycle is always hidden, previous cycles are visible
  // This creates a continuous cycling pattern throughout the competition
  const shouldShowScores = currentCycle > 0;  // Keep for compatibility with existing code
  const isInHiddenPeriod = true;  // Always consider current cycle as hidden for filtering
  
  // Calculate next reveal date (start of next cycle)
  const daysUntilReveal = leaderboardUpdateDays - daysIntoCycle;
  const nextCycleStart = (currentCycle + 1) * leaderboardUpdateDays;
  let nextRevealDate = new Date(start.getTime() + nextCycleStart * 24 * 60 * 60 * 1000);
  
  // Cap next reveal date at competition end
  if (nextRevealDate > end) {
    nextRevealDate = new Date(end);
  }
  
  // Update message to reflect cycling behavior
  const message = currentCycle === 0 
    ? `Scores hidden for ${daysUntilReveal} more day${daysUntilReveal !== 1 ? 's' : ''}`
    : `Showing scores through cycle ${currentCycle} • Next update in ${daysUntilReveal} day${daysUntilReveal !== 1 ? 's' : ''}`;
  
  return {
    shouldShowScores,
    nextRevealDate,
    currentCycle,
    daysUntilReveal,
    daysIntoCycle,
    isInHiddenPeriod,
    message
  };
};

/**
 * Gets the date when scores were last revealed
 * @param {Object} competition - The competition object
 * @returns {Date|null} The last reveal date, or null if no reveal yet
 */
export const getLastRevealDate = (competition) => {
  const { leaderboardUpdateDays, startDate } = competition;
  
  // If live updates, always current
  if (!leaderboardUpdateDays || leaderboardUpdateDays === 0) {
    return null;
  }
  
  const now = new Date();
  const start = new Date(startDate);
  
  // If competition hasn't started, no reveal yet
  if (now < start) {
    return null;
  }
  
  const daysSinceStart = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const currentCycle = Math.floor(daysSinceStart / leaderboardUpdateDays);
  
  // If in cycle 0, no reveal yet
  if (currentCycle === 0) {
    return null;
  }
  
  // Last reveal was at the start of current cycle
  const lastRevealDate = new Date(start);
  lastRevealDate.setDate(lastRevealDate.getDate() + currentCycle * leaderboardUpdateDays);
  
  return lastRevealDate;
};

/**
 * Formats a date for display with relative time
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatRevealDate = (date) => {
  if (!date) return 'Not yet';
  
  const now = new Date();
  const diff = date - now;
  const absDiff = Math.abs(diff);
  
  // If less than a day away
  if (absDiff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(absDiff / (1000 * 60));
      return diff > 0 ? `in ${minutes} minutes` : `${minutes} minutes ago`;
    }
    return diff > 0 ? `in ${hours} hours` : `${hours} hours ago`;
  }
  
  // Format as date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
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
  
  // Cutoff is at the START of current cycle
  // This reveals all previous cycles, hides current cycle
  // During cycle 0 (days 0-n): cutoff = start date (show nothing except user's own)
  // During cycle 1 (days n-2n): cutoff = start + n days (show cycle 0)
  // During cycle 2 (days 2n-3n): cutoff = start + 2n days (show cycles 0-1)
  const cutoffDate = new Date(start);
  cutoffDate.setDate(cutoffDate.getDate() + currentCycle * leaderboardUpdateDays);
  
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