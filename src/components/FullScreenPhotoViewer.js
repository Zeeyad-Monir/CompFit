import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FullScreenPhotoViewer = ({
  visible,
  photos = [],
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadingStates, setLoadingStates] = useState({});
  const [imageDimensions, setImageDimensions] = useState({});
  const scrollViewRef = useRef(null);

  React.useEffect(() => {
    if (visible && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialIndex * screenWidth,
          animated: false,
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setCurrentIndex(index);
  };

  const handleImageLoadStart = (index) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  };

  const handleImageLoad = (index) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const calculateImageBounds = (imageWidth, imageHeight) => {
    const screenAspectRatio = screenWidth / screenHeight;
    const imageAspectRatio = imageWidth / imageHeight;
    
    let displayWidth, displayHeight, offsetX, offsetY;
    
    if (imageAspectRatio > screenAspectRatio) {
      // Image is wider than screen ratio - scale to fill height (will crop sides)
      displayHeight = screenHeight;
      displayWidth = screenHeight * imageAspectRatio;
      offsetX = (screenWidth - displayWidth) / 2;
      offsetY = 0;
    } else {
      // Image is taller than screen ratio - scale to fill width (will crop top/bottom)
      displayWidth = screenWidth;
      displayHeight = screenWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (screenHeight - displayHeight) / 2;
    }
    
    return {
      width: displayWidth,
      height: displayHeight,
      x: offsetX,
      y: offsetY,
    };
  };

  const handleImageDimensions = (index, photoUri) => {
    Image.getSize(
      photoUri,
      (width, height) => {
        const bounds = calculateImageBounds(width, height);
        setImageDimensions(prev => ({
          ...prev,
          [index]: bounds,
        }));
      },
      (error) => {
        console.error('Failed to get image size:', error);
      }
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        
        <SafeAreaView style={styles.safeArea}>
          {photos.length > 1 && (
            <View style={styles.header}>
              <View style={styles.counterContainer}>
                <View style={styles.counterBackground}>
                  <Text style={styles.counterText}>
                    {currentIndex + 1} / {photos.length}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.scrollView}
          >
            {photos.map((photo, index) => {
              const photoUri = typeof photo === 'string' ? photo : photo.uri;
              const isLoading = loadingStates[index];
              const bounds = imageDimensions[index];

              return (
                <View key={index} style={styles.imageContainer}>
                  {isLoading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                  
                  {/* Tap entire image to close */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={onClose}
                    style={[
                      styles.imageTouchable,
                      bounds && {
                        width: bounds.width,
                        height: bounds.height,
                        position: 'absolute',
                        left: bounds.x,
                        top: bounds.y,
                      }
                    ]}
                  >
                    <Image
                      source={{ uri: photoUri }}
                      style={[
                        styles.image,
                        bounds && {
                          width: bounds.width,
                          height: bounds.height,
                        }
                      ]}
                      resizeMode="cover"
                      onLoadStart={() => handleImageLoadStart(index)}
                      onLoad={() => {
                        handleImageLoad(index);
                        handleImageDimensions(index, photoUri);
                      }}
                    />
                  </TouchableOpacity>
                  
                  {index === currentIndex && (
                    <TouchableOpacity
                      style={styles.imageCloseButton}
                      onPress={onClose}
                      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                      <View style={styles.closeButtonBackground}>
                        <Ionicons name="close" size={24} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {photos.length > 1 && (
            <View style={styles.dotsContainer}>
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
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  imageCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterContainer: {
    // No position needed as it's in the header now
  },
  counterBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  imageTouchable: {
    width: screenWidth,
    height: screenHeight,
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  loadingContainer: {
    position: 'absolute',
    zIndex: 1,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default FullScreenPhotoViewer;