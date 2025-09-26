import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RememberMeCheckbox({ checked, onChange, disabled = false }) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="Remember me for 30 days"
      accessibilityHint="When checked, you will remain signed in for up to 30 days"
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        Remember me for 30 days
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#C4C4C4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#93C31D',
    borderColor: '#93C31D',
  },
  label: {
    fontSize: 14,
    color: '#6C6658',
    fontWeight: '500',
  },
  labelDisabled: {
    opacity: 0.6,
  },
});