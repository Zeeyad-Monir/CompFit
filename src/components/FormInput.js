import React, { useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Platform, 
  InputAccessoryView, 
  TouchableOpacity, 
  Keyboard 
} from 'react-native';

const FormInput = ({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, editable }) => {
  const inputRef = useRef(null);
  const isNumericKeyboard = keyboardType === 'numeric' || keyboardType === 'decimal-pad';
  const accessoryViewID = isNumericKeyboard ? `${label?.replace(/\s+/g, '') || 'numeric'}-done` : null;

  const handleDone = () => {
    inputRef.current?.blur();
    // Small delay to ensure proper blur before keyboard dismiss
    setTimeout(() => {
      Keyboard.dismiss();
    }, 100);
  };

  return (
    <>
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType={keyboardType || 'default'}
          secureTextEntry={secureTextEntry}
          editable={editable}
          returnKeyType={isNumericKeyboard ? "done" : "default"}
          onSubmitEditing={isNumericKeyboard ? handleDone : undefined}
          inputAccessoryViewID={Platform.OS === 'ios' ? accessoryViewID : null}
        />
      </View>
      
      {Platform.OS === 'ios' && isNumericKeyboard && accessoryViewID && (
        <InputAccessoryView nativeID={accessoryViewID}>
          <View style={styles.accessoryView}>
            <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 17,
  },
  label: {
    fontSize: 17,
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
  accessoryView: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderTopWidth: 1,
    borderTopColor: '#C7C7CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 44,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -2,
  },
});

export default FormInput;