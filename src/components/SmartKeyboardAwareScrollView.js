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
  extraScrollHeight = 100,  // Extra space above the focused input
  extraHeight = 130, // Unified for consistency across platforms
  enableOnAndroid = true,
  enableAutomaticScroll = true,
  keyboardShouldPersistTaps = 'handled',
  scrollEnabled = true,
  resetScrollToCoords = null, // Don't reset scroll position by default
  viewIsInsideTabBar = true, // Account for bottom navigation
  keyboardOpeningTime = 300, // Unified timing for smoother animations
  scrollEventThrottle = 16, // 60fps smooth scrolling
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
  style,
  onScroll,
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
      
      // Scroll behavior
      enableResetScrollToCoords={false}
      viewIsInsideTabBar={viewIsInsideTabBar}
      scrollEventThrottle={scrollEventThrottle}
      
      // Styles
      contentContainerStyle={contentContainerStyle}
      style={style}
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