import React, { useRef, useCallback } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Platform, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Smart keyboard-aware scroll view that only scrolls when necessary
 * Provides smooth, non-choppy transitions and intelligent scrolling behavior
 */
const SmartKeyboardAwareScrollView = ({ 
  children,
  extraScrollHeight = Platform.OS === 'ios' ? 120 : 100,  // Extra space above the focused input - increased for iOS physical devices
  extraHeight = Platform.OS === 'ios' ? 150 : 130, // Increased for iOS physical keyboards
  enableOnAndroid = true,
  enableAutomaticScroll = true,
  keyboardShouldPersistTaps = 'handled',
  scrollEnabled = true,
  resetScrollToCoords = { x: 0, y: 0 }, // Reset to top to prevent stuck positions
  viewIsInsideTabBar = true, // Account for bottom navigation
  keyboardOpeningTime = Platform.OS === 'ios' ? 250 : 300, // Faster for iOS physical keyboards
  scrollEventThrottle = 16, // 60fps smooth scrolling
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
  style,
  onScroll,
  contentInset,
  ...props 
}) => {
  const scrollRef = useRef(null);
  const lastScrollPosition = useRef(0);
  const scrollTimeout = useRef(null);
  
  // Smooth scroll handler with position tracking
  const handleScroll = useCallback((event) => {
    const currentPosition = event.nativeEvent.contentOffset.y;
    lastScrollPosition.current = currentPosition;
    
    if (onScroll) {
      onScroll(event);
    }
  }, [onScroll]);

  // Debounced scroll handler to prevent rapid corrections
  const handleSmoothScroll = useCallback((x, y, animated = true) => {
    // Clear any pending scroll
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Debounce rapid scrolls to prevent bouncing
    scrollTimeout.current = setTimeout(() => {
      if (scrollRef.current?.scrollToPosition) {
        scrollRef.current.scrollToPosition(x, y, animated);
      }
    }, 75); // Increased delay to better batch rapid changes and prevent bounce
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // iOS-specific content inset for tab bar
  const defaultContentInset = Platform.OS === 'ios' 
    ? { bottom: viewIsInsideTabBar ? 90 : 0, top: 0, left: 0, right: 0 }
    : undefined;
    
  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      // Core behavior - simplified for stability
      enableAutomaticScroll={enableAutomaticScroll}
      extraScrollHeight={extraScrollHeight}
      extraHeight={extraHeight}
      enableOnAndroid={enableOnAndroid}
      
      // Interaction
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      
      // Animation timing
      keyboardOpeningTime={keyboardOpeningTime}
      
      // Scroll behavior - enable reset to prevent stuck positions
      enableResetScrollToCoords={true}
      resetScrollToCoords={resetScrollToCoords}
      viewIsInsideTabBar={viewIsInsideTabBar}
      scrollEventThrottle={scrollEventThrottle}
      
      // iOS keyboard vertical offset for physical devices
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      
      // Styles
      contentContainerStyle={contentContainerStyle}
      style={style}
      contentInset={contentInset || defaultContentInset}
      onScroll={handleScroll}
      
      // Performance optimizations
      removeClippedSubviews={Platform.OS === 'android'}
      keyboardDismissMode="on-drag"
      
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
};

export default SmartKeyboardAwareScrollView;