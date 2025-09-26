import React, { useRef } from 'react';
import { 
  Platform, 
  InputAccessoryView, 
  View, 
  TouchableOpacity, 
  Text, 
  Keyboard, 
  StyleSheet 
} from 'react-native';

const useDoneButton = (inputRef = null) => {
  const inputAccessoryViewID = useRef(`DoneButton_${Math.random().toString(36).substr(2, 9)}`).current;
  
  const handleDonePress = () => {
    // Blur the input first if ref provided (helps on physical devices)
    if (inputRef?.current) {
      inputRef.current.blur();
    }
    // Then dismiss keyboard as backup
    Keyboard.dismiss();
  };

  const shouldShowDoneButton = Platform.OS === 'ios';

  const accessoryView = shouldShowDoneButton ? (
    <InputAccessoryView nativeID={inputAccessoryViewID}>
      <View style={styles.doneButtonContainer}>
        <TouchableOpacity onPress={handleDonePress} style={styles.doneButton}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  ) : null;

  return {
    inputAccessoryViewID: shouldShowDoneButton ? inputAccessoryViewID : undefined,
    accessoryView
  };
};

const styles = StyleSheet.create({
  doneButtonContainer: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#A4D65E',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default useDoneButton;