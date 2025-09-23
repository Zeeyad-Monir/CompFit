import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
// Match submit button width exactly
const GALLERY_WIDTH = screenWidth - 32; // Match submit button width exactly
const GALLERY_HEIGHT = 240; // 10% more height space for photos

const CompactPhotoGallery = ({
  photos = [],
  onPhotoPress,
  onRemovePhoto,
  showRemoveButton = false,
  containerStyle,
  imageStyle,
  showIndicator = true,
  placeholderText = 'No photos attached',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingStates, setLoadingStates] = useState({});
  const [errorStates, setErrorStates] = useState({});
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / GALLERY_WIDTH);
    setCurrentIndex(index);
  };

  const handleImageLoad = (index) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoadStart = (index) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  };

  const handleImageError = (index) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    setErrorStates(prev => ({ ...prev, [index]: true }));
  };

  const handleRemovePhoto = (index) => {
    if (onRemovePhoto) {
      onRemovePhoto(index);
      if (currentIndex >= photos.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  if (!photos || photos.length === 0) {
    return (
      <View style={[styles.container, containerStyle, { height: GALLERY_HEIGHT }]}>
        <View style={styles.noPhotosContainer}>
          <Ionicons name="image-outline" size={48} color="#999" />
          <Text style={styles.noPhotosText}>{placeholderText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.galleryWrapper}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ height: GALLERY_HEIGHT }}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={GALLERY_WIDTH} // Explicitly set snap interval
          snapToAlignment="center"
        >
          {photos.map((photo, index) => {
            const photoUri = typeof photo === 'string' ? photo : photo.uri;
            const isLoading = loadingStates[index];
            const hasError = errorStates[index];

            return (
              <View key={index} style={styles.imageContainer}>
                <TouchableOpacity
                  onPress={() => onPhotoPress && onPhotoPress(index)}
                  activeOpacity={0.9}
                  style={styles.imageTouchable}
                >
                  {isLoading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                  )}
                  
                  {hasError ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle-outline" size={48} color="#999" />
                      <Text style={styles.errorText}>Failed to load image</Text>
                    </View>
                  ) : (
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{ uri: photoUri }}
                        style={[styles.image, imageStyle]}
                        resizeMode="cover" // Use cover to fill the width completely
                        onLoadStart={() => handleImageLoadStart(index)}
                        onLoad={() => handleImageLoad(index)}
                        onError={() => handleImageError(index)}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {showRemoveButton && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemovePhoto(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Larger touch target
                  >
                    <View style={styles.removeButtonBackground}>
                      <Ionicons name="close" size={18} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {showIndicator && photos.length > 1 && (
        <View style={styles.indicatorContainer}>
          <View style={styles.indicatorBackground}>
            <Text style={styles.indicatorText}>
              {currentIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>
      )}

      {photos.length > 1 && (
        <View style={styles.dotsContainer}>
          <View style={styles.dotsBackground}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.activeDot,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    width: GALLERY_WIDTH,
    alignSelf: 'center',
  },
  galleryWrapper: {
    width: GALLERY_WIDTH,
    height: GALLERY_HEIGHT,
    alignSelf: 'center',
    borderRadius: 12,
  },
  scrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: GALLERY_WIDTH,
    height: GALLERY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2, // Absolute minimal padding
    paddingVertical: 10,
  },
  imageTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Prevent overflow
  },
  imageWrapper: {
    width: GALLERY_WIDTH - 4, // Minimal 2px padding each side
    height: GALLERY_HEIGHT - 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    // Remove maxWidth/maxHeight constraints to allow full filling
  },
  loadingContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  noPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotosText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  removeButton: {
    position: 'absolute',
    top: 15,
    right: 10, // Closer to edge due to reduced padding
    zIndex: 10, // Higher z-index
    elevation: 5, // Android shadow
  },
  removeButtonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Darker background for better visibility
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)', // Add border for better visibility
  },
  indicatorContainer: {
    position: 'absolute',
    top: 15,
    left: 10, // Match the remove button margins
    zIndex: 1,
  },
  indicatorBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  indicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dotsBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 13,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#007AFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default CompactPhotoGallery;