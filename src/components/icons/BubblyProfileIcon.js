import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const BubblyProfileIcon = ({ size = 24, color = '#000', isFocused = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bubbly head - perfectly circular */}
      <Circle
        cx="12"
        cy="8.5"
        r="3.5"
        fill={isFocused ? color : 'transparent'}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Bubbly body/shoulders with extra rounded curves */}
      <Path
        d="M6.2 18.5C6.2 15.7 8.7 13.5 12 13.5C15.3 13.5 17.8 15.7 17.8 18.5C17.8 19.3 17.3 20 16.5 20H7.5C6.7 20 6.2 19.3 6.2 18.5Z"
        fill={isFocused ? color : 'transparent'}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default BubblyProfileIcon;