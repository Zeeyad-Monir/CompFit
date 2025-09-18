import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [isOpen, setIsOpen] = useState(false);

  // Organize items: priority items first, then the rest
  const organizedItems = useMemo(() => {
    if (!priorityItems.length) return items;
    
    const priority = priorityItems.filter(item => items.includes(item));
    const remaining = items.filter(item => !priorityItems.includes(item));
    return [...priority, ...remaining];
  }, [items, priorityItems]);

  const toggle = () => setIsOpen(o => !o);
  
  const select = value => {
    onValueChange(value);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Text style={styles.selectedText}>{selectedValue}</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#1A1E23"
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.optionsContainer}>
          <ScrollView
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            style={styles.scrollViewStyle}
            contentContainerStyle={styles.scrollContent}
          >
            {organizedItems.map((item, index) => {
              const isPriority = priorityItems.includes(item);
              return (
                <TouchableOpacity
                  key={`${item}-${index}`}
                  style={[
                    styles.optionItem,
                    selectedValue === item && styles.selectedOption,
                    isPriority && styles.priorityOption,
                  ]}
                  onPress={() => select(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedValue === item && styles.selectedOptionText,
                      isPriority && styles.priorityOptionText,
                    ]}
                  >
                    {item}
                  </Text>
                  {selectedValue === item && (
                    <Ionicons name="checkmark" size={20} color="#A4D65E" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
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
  /* Fixed height scrollable container for smooth scrolling */
  optionsContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 320, // Fixed height for 8 visible items
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  optionItem: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedOption: { 
    backgroundColor: '#F9FAF9' 
  },
  priorityOption: {
    backgroundColor: '#E8F5E8',
    borderBottomWidth: 2,
    borderBottomColor: '#A4D65E',
  },
  optionText: {
    fontSize: 16,
    color: '#1A1E23',
    flex: 1,
  },
  selectedOptionText: {
    color: '#A4D65E',
    fontWeight: '500',
  },
  priorityOptionText: {
    fontWeight: '600',
    color: '#1A1E23',
  },
});

export default Dropdown;