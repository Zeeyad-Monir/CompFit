import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const LeaderboardUpdatePicker = ({ 
  value = 0, 
  onChange, 
  competitionDays = 7,
  label = "Leaderboard Update Frequency",
  helper = "Delay score reveals to reduce competition anxiety"
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  // Generate options based on competition duration
  const getOptions = () => {
    const options = [{ label: 'Live Updates', value: 0 }];
    const maxDays = Math.min(competitionDays, 30);
    
    for (let i = 1; i <= maxDays; i++) {
      options.push({
        label: `Every ${i} day${i > 1 ? 's' : ''}`,
        value: i
      });
    }
    return options;
  };

  const handleOpen = () => {
    setTempValue(value); // Reset temp to current value
    setShowPicker(true);
  };

  const handleCancel = () => {
    setTempValue(value); // Reset temp value
    setShowPicker(false);
  };

  const handleDone = () => {
    if (tempValue <= competitionDays) {
      onChange(tempValue); // Apply the change
    }
    setShowPicker(false);
  };

  const getDisplayText = () => {
    if (value === 0) return 'Live Updates';
    return `Every ${value} day${value > 1 ? 's' : ''}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.label}>{label}</Text>
          {helper && <Text style={styles.helper}>{helper}</Text>}
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={handleOpen}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{getDisplayText()}</Text>
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {value > 0 && (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={styles.noticeText}>
            Scores and submissions will be hidden for {value} day{value > 1 ? 's' : ''} at a time
          </Text>
        </View>
      )}

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <TouchableOpacity 
            style={styles.pickerContainer}
            activeOpacity={1}
          >
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Update Frequency</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={tempValue}
              onValueChange={(itemValue) => setTempValue(itemValue)}
              style={styles.picker}
            >
              {getOptions().map(option => (
                <Picker.Item 
                  key={option.value} 
                  label={option.label} 
                  value={option.value} 
                />
              ))}
            </Picker>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1E23',
    marginBottom: 4,
  },
  helper: {
    fontSize: 13,
    color: '#6B7280',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 14,
    color: '#1A1E23',
    marginRight: 4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  noticeText: {
    fontSize: 12,
    color: '#1E40AF',
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1E23',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  doneText: {
    fontSize: 16,
    color: '#A4D65E',
    fontWeight: '600',
  },
  picker: {
    height: 200,
  },
});

export default LeaderboardUpdatePicker;