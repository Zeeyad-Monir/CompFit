import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated } from 'react-native';

export default function AnimatedCounter({ 
  value, 
  duration = 1000, 
  delay = 0,
  style,
  format = (val) => Math.round(val).toString(),
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    const listener = animatedValue.addListener(({ value: animValue }) => {
      setDisplayValue(format(animValue));
    });

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      delay,
      useNativeDriver: false, // Can't use native driver for value interpolation
    }).start();

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, delay]);

  return <Text style={style}>{displayValue}</Text>;
}