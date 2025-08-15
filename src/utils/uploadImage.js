/**
 * Image Upload Utility for Cloudinary
 * Handles uploading images to Cloudinary using unsigned preset
 */

/**
 * Uploads an image to Cloudinary using unsigned upload
 * @param {string} localUri - The local URI of the image to upload
 * @returns {Promise<string>} - The secure URL of the uploaded image
 * @throws {Error} - If upload fails
 */
export const uploadToCloudinary = async (localUri) => {
  // Cloudinary configuration - FIXED cloud name
  const CLOUD_NAME = 'dlrxgzrs5'; // Corrected cloud name
  const UPLOAD_PRESET = 'submitted_workouts';
  // IMPORTANT: Use /image/upload for unsigned uploads
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  try {
    // Create FormData for multipart upload
    const formData = new FormData();
    
    // For React Native, we need to format the file object correctly
    // Make sure filename doesn't contain slashes
    const filename = `workout_${Date.now()}.jpg`; // Simple filename without slashes
    
    const photo = {
      uri: localUri,
      type: 'image/jpeg',
      name: filename, // Use clean filename
    };
    
    // Append the file and upload preset
    formData.append('file', photo);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Don't append folder if it might cause issues
    // formData.append('folder', 'workout_submissions');
    
    console.log('Uploading to Cloudinary...');
    console.log('URL:', UPLOAD_URL);
    console.log('Preset:', UPLOAD_PRESET);
    console.log('Filename:', filename);

    console.log('Uploading to Cloudinary...');
    console.log('URL:', UPLOAD_URL);
    console.log('Preset:', UPLOAD_PRESET);

    // Make the request WITHOUT Content-Type header
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
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Alternative: Upload using data URI (base64)
 * This method often works better with React Native
 */
export const uploadToCloudinaryDataUri = async (localUri) => {
  const CLOUD_NAME = 'dlrxgzrs5'; // Corrected cloud name
  const UPLOAD_PRESET = 'submitted_workouts';
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  try {
    // Convert image to base64 data URI
    const response = await fetch(localUri);
    const blob = await response.blob();
    
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Create form data with base64 string
    const formData = new FormData();
    formData.append('file', base64);
    formData.append('upload_preset', UPLOAD_PRESET);

    const uploadResponse = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await uploadResponse.json();

    if (!uploadResponse.ok) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;

  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * SOLUTION: Create a new unsigned preset
 * If the above methods don't work, the issue is likely with the preset configuration.
 * Try creating a NEW unsigned preset with a different name.
 */
export const uploadToCloudinaryNewPreset = async (localUri) => {
  const CLOUD_NAME = 'dlrxgzrs5'; // Corrected cloud name
  // Try using 'ml_default' which is often a default unsigned preset
  // Or create a new preset called 'workout_uploads' or 'mobile_uploads'
  const UPLOAD_PRESET = 'ml_default'; // Try this first
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  try {
    const formData = new FormData();
    
    const photo = {
      uri: localUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    };
    
    formData.append('file', photo);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Upload failed with ml_default:', data);
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;

  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Test function to verify Cloudinary connectivity
 */
export const testCloudinaryConnection = async () => {
  const CLOUD_NAME = 'dlrxgzrs5'; // Corrected cloud name
  const UPLOAD_PRESET = 'submitted_workouts';
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  
  // 1x1 transparent pixel
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  try {
    const formData = new FormData();
    formData.append('file', testImage);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    console.log('Test result:', data);
    
    if (data.error) {
      console.error('Cloudinary error:', data.error);
      return { success: false, error: data.error.message };
    }
    
    return { success: true, url: data.secure_url };
  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Validates image file size
 */
export const validateImageSize = (fileSize, maxSizeMB = 10) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
};