import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import useDoneButton from '../hooks/useDoneButton';

const FormInput = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  keyboardType, 
  secureTextEntry,
  onFocus,
  onBlur,
  scrollToInput,
  multiline,
  numberOfLines,
  style,
  inputStyle,
  ...props 
}) => {
  const { inputAccessoryViewID, accessoryView } = useDoneButton();
  const inputRef = useRef(null);
  
  const handleFocus = (event) => {
    // Small delay to let keyboard start opening for smoother transition
    setTimeout(() => {
      // Call custom focus handler if provided
      if (onFocus) onFocus(event);
      
      // Trigger smart scroll if handler provided
      if (scrollToInput && inputRef.current) {
        scrollToInput(inputRef.current);
      }
    }, 100); // Slight delay for smoother animation coordination
  };
  
  const handleBlur = (event) => {
    if (onBlur) onBlur(event);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={inputRef}
        style={[
          styles.input, 
          multiline && styles.multilineInput,
          inputStyle
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        inputAccessoryViewID={inputAccessoryViewID}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      
      {accessoryView}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: '400',
    color: '#1A1E23',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1E23',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
  },
});

export default FormInput;
