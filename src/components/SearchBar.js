import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SearchBar component with clear button functionality
 * Modern search input with magnifying glass icon and clear "X" button
 * @param {string} placeholder - Placeholder text for the search input
 * @param {string} value - Current search text value
 * @param {function} onChangeText - Callback when text changes
 * @param {object} style - Additional container styles (DEPRECATED - use containerStyle)
 * @param {object} containerStyle - Container styles
 * @param {object} inputStyle - Additional input styles
 * @param {number} iconSize - Size of the search icon
 * @param {number} clearIconSize - Size of the clear icon
 */
const SearchBar = ({ 
  placeholder = "Search", 
  value = "", 
  onChangeText, 
  style,
  containerStyle,
  inputStyle,
  iconSize = 22,
  clearIconSize = 18,
  ...props 
}) => {
  // Animation for clear button opacity
  const clearButtonOpacity = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  // Animate clear button visibility based on text presence
  React.useEffect(() => {
    Animated.timing(clearButtonOpacity, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  return (
    <View style={[styles.searchContainer, containerStyle || style]}>
      <Ionicons 
        name="search" 
        size={iconSize} 
        color="#999" 
        style={styles.searchIcon} 
      />
      
      <TextInput
        style={[styles.searchInput, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never" // We're implementing our own clear button
        {...props}
      />
      
      {/* Clear button with animation */}
      <Animated.View 
        style={[
          styles.clearButtonContainer,
          { opacity: clearButtonOpacity }
        ]}
        pointerEvents={value ? 'auto' : 'none'}
      >
        <TouchableOpacity
          onPress={handleClear}
          activeOpacity={0.7}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="close-circle" 
            size={clearIconSize} 
            color="#B3B3B3" 
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1EFEF',
    borderRadius: 32,  // Updated to match original ActiveCompetitionsScreen
    height: 55,  // Updated to match original ActiveCompetitionsScreen
    paddingLeft: 20,
    paddingRight: 8,
    position: 'relative',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,  // Updated to match original ActiveCompetitionsScreen
    fontWeight: '400',
    color: '#111111',
    paddingRight: 5, // Add some padding to prevent text from going under clear button
  },
  clearButtonContainer: {
    position: 'absolute',
    right: 8,
    height: '100%',
    justifyContent: 'center',
  },
  clearButton: {
    padding: 8, // Adequate touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SearchBar;