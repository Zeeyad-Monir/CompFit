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

const useDoneButton = (inputRef = null, sharedID = null) => {
  // Use shared ID if provided, otherwise create a unique one (for backward compatibility)
  const inputAccessoryViewID = useRef(
    sharedID || `DoneButton_${Math.random().toString(36).substr(2, 9)}`
  ).current;
  
  const handleDonePress = () => {
    // Add a small delay for physical keyboards on iOS to prevent animation conflicts
    if (Platform.OS === 'ios') {
      // First dismiss keyboard to start animation
      Keyboard.dismiss();
      
      // Then blur input after a small delay if ref provided
      if (inputRef?.current) {
        setTimeout(() => {
          inputRef.current.blur();
        }, 50);
      }
    } else {
      // Android: blur first then dismiss
      if (inputRef?.current) {
        inputRef.current.blur();
      }
      Keyboard.dismiss();
    }
  };

  const shouldShowDoneButton = Platform.OS === 'ios';

  // Only render accessoryView if no shared ID (to avoid duplicates)
  const accessoryView = (shouldShowDoneButton && !sharedID) ? (
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