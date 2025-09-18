import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_STORAGE_KEY = '@competition_drafts';

// Generate unique ID for drafts
const generateDraftId = () => {
  return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Save or update a draft
export const saveDraft = async (draftData, existingId = null) => {
  try {
    const drafts = await loadDrafts();
    const timestamp = Date.now();
    
    if (existingId) {
      // Update existing draft
      const index = drafts.findIndex(d => d.id === existingId);
      if (index !== -1) {
        drafts[index] = {
          ...draftData,
          id: existingId,
          createdAt: drafts[index].createdAt,
          updatedAt: timestamp
        };
      }
    } else {
      // Create new draft
      const newDraft = {
        ...draftData,
        id: generateDraftId(),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      drafts.push(newDraft);
    }
    
    await AsyncStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return drafts;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
};

// Load all drafts
export const loadDrafts = async () => {
  try {
    const draftsJson = await AsyncStorage.getItem(DRAFTS_STORAGE_KEY);
    if (draftsJson) {
      return JSON.parse(draftsJson);
    }
    return [];
  } catch (error) {
    console.error('Error loading drafts:', error);
    return [];
  }
};

// Load a specific draft
export const loadDraft = async (draftId) => {
  try {
    const drafts = await loadDrafts();
    return drafts.find(d => d.id === draftId) || null;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
};

// Delete a draft
export const deleteDraft = async (draftId) => {
  try {
    const drafts = await loadDrafts();
    const filteredDrafts = drafts.filter(d => d.id !== draftId);
    await AsyncStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(filteredDrafts));
    return filteredDrafts;
  } catch (error) {
    console.error('Error deleting draft:', error);
    throw error;
  }
};

// Check if a draft with the same name exists
export const draftWithNameExists = async (name, excludeId = null) => {
  try {
    const drafts = await loadDrafts();
    return drafts.some(d => d.name === name && d.id !== excludeId);
  } catch (error) {
    console.error('Error checking draft name:', error);
    return false;
  }
};

// Format date for display
export const formatDraftDate = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffDays > 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};