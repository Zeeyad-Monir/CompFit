import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

/**
 * Props
 *  - label           (string)  field label shown above the button
 *  - selectedValue   (string)  currently‑selected item
 *  - onValueChange   (fn)      callback(newValue)
 *  - items           (string[]) list of selectable items
 *  - containerStyle  (object)  optional extra style (e.g., zIndex layering)
 *  - priorityItems   (string[]) items to show at the top (e.g., ["Custom"])
 */
const Dropdown = ({
  label,
  selectedValue,
  onValueChange,
  items,
  containerStyle,
  priorityItems = [],
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempSelection, setTempSelection] = useState(selectedValue);
  const slideAnim = useRef(new Animated.Value(320)).current; // Initial position below screen

  // Organize items: priority items first, then the rest
  const organizedItems = useMemo(() => {
    if (!priorityItems.length) return items;
    
    const priority = priorityItems.filter(item => items.includes(item));
    const remaining = items.filter(item => !priorityItems.includes(item));
    return [...priority, ...remaining];
  }, [items, priorityItems]);

  // Update temp selection when selectedValue changes
  useEffect(() => {
    setTempSelection(selectedValue);
  }, [selectedValue]);

  const showDropdownPicker = () => {
    setTempSelection(selectedValue);
    setShowPicker(true);
    // Animate slide up
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideDropdownPicker = () => {
    // Animate slide down
    Animated.timing(slideAnim, {
      toValue: 320,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowPicker(false);
    });
  };

  const handleDone = () => {
    onValueChange(tempSelection);
    hideDropdownPicker();
  };

  const handleCancel = () => {
    setTempSelection(selectedValue);
    hideDropdownPicker();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={showDropdownPicker}
        activeOpacity={0.8}
      >
        <Text style={styles.selectedText}>{selectedValue}</Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color="#A4D65E"
        />
      </TouchableOpacity>

      {Platform.OS === 'ios' && showPicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showPicker}
          onRequestClose={hideDropdownPicker}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalContent, {
              transform: [{ translateY: slideAnim }]
            }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={tempSelection}
                  onValueChange={setTempSelection}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {organizedItems.map((item, index) => (
                    <Picker.Item
                      key={`${item}-${index}`}
                      label={item}
                      value={item}
                    />
                  ))}
                </Picker>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showPicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showPicker}
          onRequestClose={hideDropdownPicker}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalContent, {
              transform: [{ translateY: slideAnim }]
            }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={tempSelection}
                  onValueChange={setTempSelection}
                  style={styles.picker}
                  mode="dropdown"
                >
                  {organizedItems.map((item, index) => (
                    <Picker.Item
                      key={`${item}-${index}`}
                      label={item}
                      value={item}
                    />
                  ))}
                </Picker>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
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
  dropdownButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedText: {
    fontSize: 16,
    color: '#1A1E23',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 320,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 16,
  },
  doneText: {
    color: '#A4D65E',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  picker: {
    width: '100%',
    height: 200,
  },
  pickerItem: {
    fontSize: 20,
    color: '#1A1E23',
  },
});

export default Dropdown;