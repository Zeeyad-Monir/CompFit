import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Header = ({ title, showBackButton, showProfileIcon, onBackPress, backgroundColor }) => {
  return (
    <View style={[styles.header, backgroundColor && { backgroundColor }]}>
      <View style={styles.leftContainer}>
        {showBackButton && (
          <TouchableOpacity 
            onPress={onBackPress} 
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.rightContainer}>
        {showProfileIcon && (
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#1A1E23',
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed from 'center' to 'flex-start'
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 15, // Add top padding to position elements properly
  },
  leftContainer: {
    width: 40,
    justifyContent: 'center', // Center the back button within its container
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center', // Center the profile button within its container
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1, // Take up remaining space
    lineHeight: 24, // Ensure proper vertical alignment
  },
  backButton: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Header;