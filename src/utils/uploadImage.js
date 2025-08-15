/**
 * Image Upload Utility for Cloudinary
 * Handles uploading images to Cloudinary using unsigned preset
 */

/**
 * Uploads an image to Cloudinary
 * @param {string} localUri - The local URI of the image to upload
 * @returns {Promise<string>} - The secure URL of the uploaded image
 * @throws {Error} - If upload fails
 */
export const uploadToCloudinary = async (localUri) => {
  // Cloudinary configuration
  const CLOUD_NAME = 'dlrxgzsr5';
  const UPLOAD_PRESET = 'submitted_workouts';
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  try {
    // Create form data
    const formData = new FormData();
    
    // Prepare the file object for upload
    const file = {
      uri: localUri,
      type: 'image/jpeg', // You can make this dynamic based on file extension
      name: `workout_${Date.now()}.jpg`,
    };
    
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    
    // Add timestamp to make filenames unique
    formData.append('folder', 'workout_submissions');
    formData.append('public_id', `workout_${Date.now()}`);

    console.log('Uploading image to Cloudinary...');
    
    // Make the upload request
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary upload error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to upload image');
    }

    // Parse the response
    const data = await response.json();
    console.log('Image uploaded successfully:', data.secure_url);
    
    // Return the secure URL
    return data.secure_url;
    
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Validates image file size (optional utility)
 * @param {number} fileSize - Size in bytes
 * @param {number} maxSizeMB - Maximum size in MB (default 10MB)
 * @returns {boolean} - True if valid size
 */
export const validateImageSize = (fileSize, maxSizeMB = 10) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
};