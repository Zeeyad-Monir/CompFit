import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const BubblyPlusIcon = ({ size = 24, color = '#000', isFocused = false, showBackground = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Optional circular background for center button */}
      {showBackground && (
        <Circle
          cx="12"
          cy="12"
          r="11"
          fill={isFocused ? color : 'transparent'}
          stroke={color}
          strokeWidth={1.5}
        />
      )}
      
      {/* Vertical line with rounded caps - made extra bubbly */}
      <Path
        d="M12 6C12.64 6 13.275 6.635 13.275 7.275V16.725C13.275 17.365 12.64 18 12 18C11.36 18 10.725 17.365 10.725 16.725V7.275C10.725 6.635 11.36 6 12 6Z"
        fill={showBackground && isFocused ? '#FFFFFF' : color}
        strokeWidth={0}
      />
      
      {/* Horizontal line with rounded caps - made extra bubbly */}
      <Path
        d="M6 12C6 11.36 6.635 10.725 7.275 10.725H16.725C17.365 10.725 18 11.36 18 12C18 12.64 17.365 13.275 16.725 13.275H7.275C6.635 13.275 6 12.64 6 12Z"
        fill={showBackground && isFocused ? '#FFFFFF' : color}
        strokeWidth={0}
      />
    </Svg>
  );
};

export default BubblyPlusIcon;