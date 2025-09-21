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

const SwipeablePhotoGallery = ({
  photos = [],
  onPhotoPress,
  onRemovePhoto,
  showRemoveButton = false,
  containerStyle,
  imageStyle,
  height = 300,
  showIndicator = true,
  placeholderText = 'No photos attached',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingStates, setLoadingStates] = useState({});
  const [errorStates, setErrorStates] = useState({});
  const [imageDimensions, setImageDimensions] = useState({});
  const scrollViewRef = useRef(null);

  // Fetch image dimensions when photos change
  useEffect(() => {
    photos.forEach((photo, index) => {
      const photoUri = typeof photo === 'string' ? photo : photo.uri;
      if (photoUri && !imageDimensions[index]) {
        Image.getSize(
          photoUri,
          (width, height) => {
            setImageDimensions(prev => ({
              ...prev,
              [index]: { width, height, aspectRatio: width / height }
            }));
          },
          (error) => {
            console.log('Error getting image size for index', index, ':', error);
          }
        );
      }
    });
  }, [photos]);

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
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
      <View style={[styles.container, containerStyle, { height }]}>
        <View style={styles.noPhotosContainer}>
          <Ionicons name="image-outline" size={48} color="#999" />
          <Text style={styles.noPhotosText}>{placeholderText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ height }}
      >
        {photos.map((photo, index) => {
          const photoUri = typeof photo === 'string' ? photo : photo.uri;
          const isLoading = loadingStates[index];
          const hasError = errorStates[index];

          return (
            <View key={index} style={[styles.imageContainer, { width: screenWidth, height }]}>
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
                  (() => {
                    // Calculate optimal resize mode based on aspect ratios
                    const containerAspectRatio = screenWidth / height;
                    const imageInfo = imageDimensions[index];
                    const imageAspectRatio = imageInfo?.aspectRatio || containerAspectRatio;
                    
                    // Determine optimal resize mode
                    let resizeMode = 'cover'; // Default to cover to eliminate bars
                    
                    // If the image is wider than the container (landscape in portrait container)
                    // or taller than container (portrait in landscape container)
                    // use 'cover' to fill and eliminate bars
                    
                    // Only use 'contain' if aspect ratios are very similar
                    const aspectRatioDiff = Math.abs(imageAspectRatio - containerAspectRatio);
                    const aspectRatioTolerance = 0.1; // 10% tolerance
                    
                    if (aspectRatioDiff < aspectRatioTolerance) {
                      // Aspect ratios are close, use contain to show full image
                      resizeMode = 'contain';
                    }
                    
                    return (
                      <Image
                        source={{ uri: photoUri }}
                        style={[styles.image, imageStyle, { height }]}
                        resizeMode={resizeMode}
                        onLoadStart={() => handleImageLoadStart(index)}
                        onLoad={() => handleImageLoad(index)}
                        onError={() => handleImageError(index)}
                      />
                    );
                  })()
                )}
              </TouchableOpacity>

              {showRemoveButton && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <View style={styles.removeButtonBackground}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

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
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
  },
  noPhotosText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  removeButtonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  indicatorBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dotsBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 13,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
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

export default SwipeablePhotoGallery;