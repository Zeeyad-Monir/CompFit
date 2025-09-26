import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

const BubblyHomeIcon = ({ size = 24, color = '#000', isFocused = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Simple house with rounded corners and soft roof - open door bottom */}
      <Path
        d="M10 20H5V10.5C5 10 5.2 9.6 5.6 9.3L11.3 4.5C11.7 4.2 12.3 4.2 12.7 4.5L18.4 9.3C18.8 9.6 19 10 19 10.5V20H14"
        fill={isFocused ? color : 'transparent'}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Simple rounded door */}
      <Rect
        x="10"
        y="14"
        width="4"
        height="6"
        rx="1"
        ry="1"
        fill={isFocused ? '#FFFFFF' : 'transparent'}
        stroke={isFocused ? 'none' : color}
        strokeWidth={1.2}
      />
    </Svg>
  );
};

export default BubblyHomeIcon;