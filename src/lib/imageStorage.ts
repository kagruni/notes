import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { NoteImage } from '@/types';

/**
 * Upload image to Firebase Storage
 */
export async function uploadImageToStorage(
  file: File, 
  userId: string, 
  projectId: string,
  imageId: string
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `images/${userId}/${projectId}/${imageId}`;
  const storageRef = ref(storage, storagePath);
  
  try {
    console.log('🔄 Uploading image to Firebase Storage:', { storagePath, fileName: file.name, size: file.size });
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    console.log('✅ Image uploaded successfully');
    
    // Get the download URL
    const url = await getDownloadURL(snapshot.ref);
    console.log('✅ Download URL obtained:', url);
    
    return { url, storagePath };
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
}

/**
 * Upload base64 image to Firebase Storage
 */
export async function uploadBase64ToStorage(
  base64Data: string,
  fileName: string,
  mimeType: string,
  userId: string,
  projectId: string,
  imageId: string
): Promise<{ url: string; storagePath: string }> {
  try {
    console.log('🔄 Converting base64 to blob for Firebase Storage upload');
    
    // Convert base64 to blob
    const response = await fetch(base64Data);
    const blob = await response.blob();
    
    // Create a file from the blob
    const file = new File([blob], fileName, { type: mimeType });
    
    return await uploadImageToStorage(file, userId, projectId, imageId);
  } catch (error) {
    console.error('❌ Error converting base64 to storage:', error);
    throw new Error('Failed to process image. Please try again.');
  }
}

/**
 * Delete image from Firebase Storage
 */
export async function deleteImageFromStorage(storagePath: string): Promise<void> {
  try {
    console.log('🔄 Deleting image from Firebase Storage:', storagePath);
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log('✅ Image deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    // Don't throw error here as it might be already deleted or not exist
    console.log('Image deletion failed, but continuing...');
  }
}

/**
 * Convert NoteImage with base64 data to use Firebase Storage
 */
export async function migrateImageToStorage(
  image: NoteImage,
  userId: string,
  projectId: string
): Promise<NoteImage> {
  if (image.url || !image.data) {
    // Already using storage or no data to migrate
    return image;
  }
  
  try {
    console.log('🔄 Migrating image to Firebase Storage:', image.name);
    
    const { url, storagePath } = await uploadBase64ToStorage(
      image.data,
      image.name,
      image.type,
      userId,
      projectId,
      image.id
    );
    
    // Return updated image without base64 data
    return {
      ...image,
      url,
      storagePath,
      data: undefined, // Remove base64 data to save space
    };
  } catch (error) {
    console.error('❌ Error migrating image:', error);
    // Keep the original image with base64 data as fallback
    return image;
  }
}

/**
 * Get the display URL for an image (prioritizes Firebase Storage URL over base64)
 */
export function getImageDisplayUrl(image: NoteImage): string {
  return image.url || image.data || '';
}

/**
 * Compress image file for optimal storage
 */
export function compressImageFile(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
} 