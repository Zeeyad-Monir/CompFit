/**
 * Profile Picture Upload Utility for Cloudinary
 * Uses the existing Cloudinary configuration for free image hosting
 */

export const uploadProfilePicture = async (localUri, userId) => {
  const CLOUD_NAME = 'dlrxgzrs5';
  const UPLOAD_PRESET = 'profile_pictures'; // Your new preset
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  
  try {
    const formData = new FormData();
    
    const photo = {
      uri: localUri,
      type: 'image/jpeg',
      name: `profile_${userId}_${Date.now()}.jpg`,
    };
    
    formData.append('file', photo);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'profile_pictures'); // Organize in Cloudinary folder
    
    console.log('Uploading profile picture to Cloudinary...');
    console.log('URL:', UPLOAD_URL);
    console.log('Preset:', UPLOAD_PRESET);
    
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid response from Cloudinary');
    }
    
    if (!response.ok) {
      console.error('Upload failed:', data);
      throw new Error(data.error?.message || 'Upload failed');
    }
    
    console.log('Upload successful:', data.secure_url);
    return data.secure_url;
    
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Profile picture upload failed: ${error.message}`);
  }
};