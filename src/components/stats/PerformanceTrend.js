import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 48;
const CHART_HEIGHT = 120;

export default function PerformanceTrend({ userId, recentMatches = [] }) {
  const [chartData, setChartData] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pathAnim = useRef(new Animated.Value(0)).current;

  // Helper function to convert position number to ordinal
  const getPositionOrdinal = (position) => {
    if (!position || position < 1) return 'N/A';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = position % 100;
    return position + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // Helper function to interpolate between two colors
  const interpolateColor = (color1, color2, factor) => {
    // factor is 0-1, where 0 = color1 and 1 = color2
    const hex2rgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgb2hex = (r, g, b) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };
    
    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    
    return rgb2hex(r, g, b);
  };

  // Function to get color based on position relative to worst
  const getPositionColor = (position, worstPosition) => {
    if (position === 1) return '#10B981'; // Solid green ONLY for 1st place
    
    // If this is the worst position, return solid red
    if (position === worstPosition) return '#EF4444';
    
    // For positions between 1st and worst, interpolate from yellow to orange-red
    // If worst is 2nd (only 1st and 2nd exist), return red for 2nd
    if (worstPosition === 2) return '#EF4444';
    
    // Calculate relative position between 2nd and worst
    // 2nd position = 0 (yellow), position just before worst = closer to 1 (orange-red)
    const factor = (position - 2) / (worstPosition - 2);
    
    // Interpolate from yellow to orange-red (not full red, as worst gets that)
    return interpolateColor('#FFC107', '#FF6B6B', factor);
  };

  useEffect(() => {
    // Use real competition data only
    setChartData(recentMatches);

    // Only animate if there's data
    if (recentMatches.length > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pathAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Still fade in the empty state
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [recentMatches]);

  const createPath = () => {
    if (chartData.length === 0) return { path: '', points: [] };
    if (chartData.length === 1) {
      // For single competition, worst position is itself
      const worstPosition = chartData[0].position;
      const color = getPositionColor(chartData[0].position, worstPosition);
      return { 
        path: '', 
        points: [{
          x: 20 + (CHART_WIDTH - 40) / 2, // Center the single point
          y: 20 + ((chartData[0].position <= 5 ? chartData[0].position - 1 : 5) * ((CHART_HEIGHT - 40) / 5)),
          color: color,
          ...chartData[0]
        }] 
      };
    }

    const padding = 20;
    const chartAreaWidth = CHART_WIDTH - padding * 2;
    const chartAreaHeight = CHART_HEIGHT - padding * 2;
    const stepX = chartAreaWidth / (chartData.length - 1);
    
    // Find the worst position in the dataset for color scaling
    const worstPosition = Math.max(...chartData.map(d => d.position));
    
    // Find if there are any positions beyond 5th place
    const positionsBeyond5 = chartData.filter(d => d.position > 5).map(d => d.position);
    const highestBadPosition = positionsBeyond5.length > 0 ? Math.max(...positionsBeyond5) : null;
    
    // Create effective positions for scaling (1-5, plus one extra slot if needed)
    const effectiveMaxPosition = highestBadPosition ? 6 : 5;
    
    // Normalize positions to y coordinates with colors
    const points = chartData.map((item, index) => {
      let yPosition;
      if (item.position <= 5) {
        // Positions 1-5 are evenly spaced
        yPosition = padding + ((item.position - 1) * (chartAreaHeight / (effectiveMaxPosition - 1)));
      } else {
        // Any position > 5 goes to the bottom position
        yPosition = padding + chartAreaHeight;
      }
      
      // Calculate color based on position relative to worst
      const color = getPositionColor(item.position, worstPosition);
      
      return {
        x: padding + index * stepX,
        y: yPosition,
        color: color,
        ...item,
      };
    });

    // Create smooth curve path
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const xMid = (points[i].x + points[i - 1].x) / 2;
      const yMid = (points[i].y + points[i - 1].y) / 2;
      const cp1x = (xMid + points[i - 1].x) / 2;
      const cp2x = (xMid + points[i].x) / 2;
      
      path += ` Q ${cp1x}, ${points[i - 1].y}, ${xMid}, ${yMid}`;
      path += ` Q ${cp2x}, ${points[i].y}, ${points[i].x}, ${points[i].y}`;
    }

    return { path, points };
  };

  const { path, points } = createPath();

  const getStreakInfo = () => {
    if (chartData.length === 0) return { best: 0, previous: 'N/A' };
    
    let bestStreak = 0;
    let currentStreak = 0;
    
    // Find the best (longest) consecutive 1st place streak
    for (const match of chartData) {
      if (match.position === 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    // Get position from most recent competition
    const lastMatch = chartData[chartData.length - 1];
    const previousPosition = lastMatch ? getPositionOrdinal(lastMatch.position) : 'N/A';
    
    return { best: bestStreak, previous: previousPosition };
  };

  const { best: bestStreak, previous: previousPosition } = getStreakInfo();
  const recentForm = chartData.slice(-5);

  // Find if there are any positions beyond 5th place
  const positionsBeyond5 = chartData.filter(d => d.position > 5).map(d => d.position);
  const highestBadPosition = positionsBeyond5.length > 0 ? Math.max(...positionsBeyond5) : null;
  
  // Generate position labels: always 1-5, plus the worst position if > 5
  let positionLabels = ['1st', '2nd', '3rd', '4th', '5th'];
  if (highestBadPosition) {
    positionLabels.push(getPositionOrdinal(highestBadPosition));
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Performance Trend</Text>
        <Text style={styles.subtitle}>
          {chartData.length > 0 
            ? `Last ${chartData.length} Competition${chartData.length > 1 ? 's' : ''}`
            : 'No competitions yet'}
        </Text>
      </View>

      {chartData.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Complete competitions to see your performance trend</Text>
        </View>
      ) : chartData.length === 1 ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Complete more competitions to see trends</Text>
          <Text style={styles.singleCompText}>
            {chartData[0].position === 1 ? '🏆' : '❌'} {chartData[0].name || 'Competition'} - Position #{chartData[0].position}
          </Text>
        </View>
      ) : (
        <>
      <View style={styles.chartContainer}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {points?.length > 0 ? (
                points.map((point, index) => (
                  <Stop 
                    key={index}
                    offset={`${(index / Math.max(1, points.length - 1)) * 100}%`} 
                    stopColor={point.color} 
                  />
                ))
              ) : (
                <>
                  <Stop offset="0%" stopColor="#10B981" />
                  <Stop offset="100%" stopColor="#EF4444" />
                </>
              )}
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {positionLabels.map((label, index) => {
            const effectiveMaxPosition = positionLabels.length;
            const yPos = 20 + (index * ((CHART_HEIGHT - 40) / (effectiveMaxPosition - 1)));
            
            return (
              <Line
                key={label}
                x1={20}
                x2={CHART_WIDTH - 20}
                y1={yPos}
                y2={yPos}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Main path */}
          {path && (
            <Path
              d={path}
              stroke="url(#lineGradient)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {points?.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="6"
              fill={point.color}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          ))}
        </Svg>

        {/* Position labels */}
        <View style={styles.positionLabels}>
          {positionLabels.map((label, index) => (
            <Text key={label} style={styles.positionLabel}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* Recent Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Last 5</Text>
        <View style={styles.formDots}>
          {recentForm.map((match, index) => (
            <View
              key={index}
              style={[
                styles.formDot,
                { backgroundColor: match.position === 1 ? '#10B981' : '#EF4444' }
              ]}
            >
              <Text style={styles.formDotText}>
                {match.position === 1 ? 'W' : 'L'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Streak Info */}
      <View style={styles.streakContainer}>
        <View style={styles.streakItem}>
          <Ionicons name="flame" size={20} color="#F59E0B" />
          <Text style={styles.streakLabel}>Best Streak</Text>
          <Text style={styles.streakValue}>{bestStreak}</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Ionicons name="podium" size={20} color="#F59E0B" />
          <Text style={styles.streakLabel}>Previous</Text>
          <Text style={styles.streakValue}>{previousPosition}</Text>
        </View>
      </View>
      </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  chartContainer: {
    position: 'relative',
  },
  positionLabels: {
    position: 'absolute',
    left: 0,
    top: 15,
    bottom: 15,
    width: 20,
    justifyContent: 'space-between',
  },
  positionLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  formContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  formDots: {
    flexDirection: 'row',
    gap: 8,
  },
  formDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  streakContainer: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  streakItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  streakDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  streakLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  singleCompText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
});