/**
 * ScoreDisplay Component
 * Reusable component for displaying scores with visibility logic
 * Automatically hides scores during hidden periods based on competition settings
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getScoreVisibility, formatTimeUntilReveal } from '../utils/scoreVisibility';

const ScoreDisplay = ({ 
  competition, 
  points, 
  userId = null,
  style = {},
  showIcon = true,
  size = 'medium',
  hideMessage = 'Hidden',
  emptyMessage = '0 pts',
  customFormatting = null
}) => {
  // Calculate visibility status
  const visibility = useMemo(() => {
    if (!competition) return null;
    return getScoreVisibility(competition);
  }, [competition]);

  // Determine text size based on size prop
  const fontSize = useMemo(() => {
    switch (size) {
      case 'small': return 14;
      case 'large': return 24;
      case 'xlarge': return 32;
      default: return 18;
    }
  }, [size]);

  const iconSize = useMemo(() => {
    switch (size) {
      case 'small': return 14;
      case 'large': return 24;
      case 'xlarge': return 28;
      default: return 18;
    }
  }, [size]);

  // Determine what to display
  const displayContent = useMemo(() => {
    // If no visibility info or scores are not hidden, show the actual points
    if (!visibility || !visibility.isInHiddenPeriod) {
      if (points === undefined || points === null) {
        return emptyMessage;
      }
      if (customFormatting) {
        return customFormatting(points);
      }
      return `${points} pts`;
    }

    // Scores are hidden
    return hideMessage;
  }, [visibility, points, emptyMessage, hideMessage, customFormatting]);

  // Determine text color
  const textColor = useMemo(() => {
    if (visibility?.isInHiddenPeriod) {
      return '#999999';
    }
    return style.color || '#1A1E23';
  }, [visibility, style.color]);

  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <Ionicons 
          name={visibility?.isInHiddenPeriod ? 'eye-off' : 'star'} 
          size={iconSize} 
          color={visibility?.isInHiddenPeriod ? '#999999' : '#FFD700'} 
          style={styles.icon}
        />
      )}
      <Text style={[
        styles.text, 
        { fontSize, color: textColor },
        style.textStyle
      ]}>
        {displayContent}
      </Text>
    </View>
  );
};

// Variant for displaying scores in a card format
export const ScoreCard = ({ 
  competition, 
  points, 
  title = 'Points',
  style = {},
  ...props 
}) => {
  const visibility = useMemo(() => {
    if (!competition) return null;
    return getScoreVisibility(competition);
  }, [competition]);

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>
        {visibility?.isInHiddenPeriod ? 'Points Hidden' : title}
      </Text>
      <ScoreDisplay 
        competition={competition}
        points={points}
        size="large"
        showIcon={false}
        {...props}
      />
      {visibility?.isInHiddenPeriod && (
        <Text style={styles.revealText}>
          Reveals in {formatTimeUntilReveal(visibility.daysUntilReveal)}
        </Text>
      )}
    </View>
  );
};

// Variant for inline score display
export const InlineScore = ({ competition, points, style = {}, ...props }) => {
  return (
    <ScoreDisplay 
      competition={competition}
      points={points}
      size="small"
      showIcon={true}
      style={[styles.inline, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  revealText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default ScoreDisplay;