// Competition Background Image Management
// Handles assignment and retrieval of background images for competition cards

const coverPhotos = [
  'coverPhotoOne',
  'coverPhotoTwo', 
  'coverPhotoThree',
  'coverPhotoFour',
  'coverPhotoFive',
  'coverPhotoSix',
  'coverPhotoSeven',
  'coverPhotoEight',
  'coverPhotoNine',
  'coverPhotosTen',  // Note: typo in filename
  'coverPhotoEleven',
  'coverPhotoTwelve',
  'coverPhotoThirteen',
  'coverPhotoFourteen'
];

const imageRequireMap = {
  'coverPhotoOne': require('../../assets/coverPhotos/coverPhotoOne.png'),
  'coverPhotoTwo': require('../../assets/coverPhotos/coverPhotoTwo.png'),
  'coverPhotoThree': require('../../assets/coverPhotos/coverPhotoThree.png'),
  'coverPhotoFour': require('../../assets/coverPhotos/coverPhotoFour.png'),
  'coverPhotoFive': require('../../assets/coverPhotos/coverPhotoFive.png'),
  'coverPhotoSix': require('../../assets/coverPhotos/coverPhotoSix.png'),
  'coverPhotoSeven': require('../../assets/coverPhotos/coverPhotoSeven.png'),
  'coverPhotoEight': require('../../assets/coverPhotos/coverPhotoEight.png'),
  'coverPhotoNine': require('../../assets/coverPhotos/coverPhotoNine.png'),
  'coverPhotosTen': require('../../assets/coverPhotos/coverPhotosTen.png'),
  'coverPhotoEleven': require('../../assets/coverPhotos/coverPhotoEleven.png'),
  'coverPhotoTwelve': require('../../assets/coverPhotos/coverPhotoTwelve.png'),
  'coverPhotoThirteen': require('../../assets/coverPhotos/coverPhotoThirteen.png'),
  'coverPhotoFourteen': require('../../assets/coverPhotos/coverPhotoFourteen.png')
};

export const assignCompetitionBackground = async (userId, db) => {
  try {
    // Query active competitions for this user
    const { collection, query, where, getDocs, or } = await import('firebase/firestore');
    const q = query(
      collection(db, 'competitions'),
      or(
        where('ownerId', '==', userId),
        where('participants', 'array-contains', userId)
      )
    );
    
    const snapshot = await getDocs(q);
    const activeComps = snapshot.docs
      .map(doc => doc.data())
      .filter(comp => {
        const now = new Date();
        const end = new Date(comp.endDate);
        return now <= end && comp.status !== 'completed' && comp.status !== 'cancelled';
      });
    
    const usedImages = activeComps.map(comp => comp.backgroundImage).filter(Boolean);
    const availableImages = coverPhotos.filter(img => !usedImages.includes(img));
    
    // Select from available images, or all images if none available
    const pool = availableImages.length > 0 ? availableImages : coverPhotos;
    return pool[Math.floor(Math.random() * pool.length)];
  } catch (error) {
    console.error('Error assigning background:', error);
    // Fallback to random selection
    return coverPhotos[Math.floor(Math.random() * coverPhotos.length)];
  }
};

export const getBackgroundImage = (imageName) => {
  if (!imageName) {
    // Return null for competitions without background (backward compatibility)
    return null;
  }
  return imageRequireMap[imageName] || null;
};