'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { NoteImage } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImageToStorage, compressImageFile, getImageDisplayUrl } from '@/lib/imageStorage';
import { extractExifFromFile, parseDateTimeToDate } from '@/lib/exifExtractor';

interface ImageUploaderProps {
  images: NoteImage[];
  onImagesChange: (images: NoteImage[]) => void;
  onImageClick?: (imageIndex: number) => void;
  disabled?: boolean;
  projectId?: string; // Required for Firebase Storage path
}

export default function ImageUploader({ images, onImagesChange, onImageClick, disabled = false, projectId }: ImageUploaderProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     'ontouchstart' in window);


  const generateImageId = () => {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const processImageFile = useCallback(async (file: File): Promise<NoteImage> => {
    if (!user || !projectId) {
      throw new Error('User authentication and project ID required');
    }

    try {
      console.log('📁 Processing file:', file.name, 'type:', file.type, 'size:', file.size);
      
      // Extract EXIF data from the original file before compression
      const exifData = await extractExifFromFile(file);
      let capturedAt: Date | undefined;
      
      // Check if this might be from iPhone based on file properties
      const isLikelyIPhone = file.name.toLowerCase().includes('img_') || 
                           file.type === 'image/heic' || 
                           file.type === 'image/heif';
      
      if (isLikelyIPhone) {
        console.log('📱 Detected likely iPhone image upload');
      }
      
      if (exifData) {
        // Try DateTimeOriginal first (when photo was taken), then DateTime
        const dateTimeStr = exifData.dateTimeOriginal || exifData.dateTime;
        if (dateTimeStr) {
          const parsedDate = parseDateTimeToDate(dateTimeStr);
          capturedAt = parsedDate || undefined;
          console.log('📷 Photo was actually taken on:', capturedAt, '(from EXIF metadata)');
          console.log('📷 Upload happening now at:', new Date(), '(current time)');
        } else {
          console.log('📷 EXIF data found but no datetime information');
        }
      } else {
        console.log('📷 No EXIF metadata found in this image');
        if (isLikelyIPhone) {
          console.log('📱 iPhone Note: HEIC files may lose EXIF data during browser conversion to JPEG');
          console.log('📱 Recommendation: Use "Most Compatible" format in iPhone camera settings for better EXIF preservation');
        }
      }
      
      // Compress the image for optimal storage
      const compressedFile = await compressImageFile(file, isMobile ? 1200 : 1600, isMobile ? 0.75 : 0.85);
      console.log('📁 Image compressed from', file.size, 'to', compressedFile.size, 'bytes');
      
      const imageId = generateImageId();
      
      // Upload to Firebase Storage
      const { url, storagePath } = await uploadImageToStorage(compressedFile, user.uid, projectId, imageId);
      
      const noteImage: NoteImage = {
        id: imageId,
        url,
        storagePath,
        type: compressedFile.type,
        name: file.name,
        size: compressedFile.size,
        createdAt: new Date(),
        capturedAt,
        exifData: exifData || undefined,
      };

      console.log('📁 Created NoteImage with Firebase Storage:', {
        id: noteImage.id,
        name: noteImage.name,
        type: noteImage.type,
        size: noteImage.size,
        url: noteImage.url,
        capturedAt: noteImage.capturedAt, // When photo was taken (from EXIF)
        createdAt: noteImage.createdAt,   // When photo was uploaded (now)
        hasExifData: !!exifData
      });
      
      if (noteImage.capturedAt && noteImage.createdAt) {
        const timeDiff = noteImage.createdAt.getTime() - noteImage.capturedAt.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        console.log(`📷 This photo was taken ${daysDiff} days ago and is being uploaded now`);
      }

      return noteImage;
    } catch (error) {
      console.error('📁 Error processing image file:', error);
      throw error;
    }
  }, [user, projectId, isMobile]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      setError('Please sign in to upload images');
      return;
    }

    if (!projectId) {
      setError('Project ID required for image upload');
      return;
    }

    console.log('📁 File upload started, files:', files.length);
    setError(null);
    setProcessing(true);
    const newImages: NoteImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError(`File ${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 10MB for raw upload)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        const noteImage = await processImageFile(file);
        newImages.push(noteImage);
      }

      console.log('📁 Adding', newImages.length, 'images to state');
      onImagesChange([...images, ...newImages]);
    } catch (error) {
      console.error('📁 Error processing images:', error);
      setError(error instanceof Error ? error.message : 'Failed to process images. Please try again.');
    } finally {
      setProcessing(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [images, onImagesChange, processImageFile, user, projectId]);




  const removeImage = useCallback((imageId: string) => {
    onImagesChange(images.filter(img => img.id !== imageId));
  }, [images, onImagesChange]);


  // Show warning if project ID is missing
  if (!projectId && !disabled) {
    return (
      <div className="p-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-400 text-amber-700 dark:text-amber-400 rounded text-sm">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Project ID required for image upload
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Images {isMobile && '(Optimized for mobile)'}
        </label>
        
        {!disabled && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing || disabled}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm transition-colors"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              <Upload className="w-4 h-4" />
              <span>{processing ? 'Uploading...' : 'Upload'}</span>
            </button>
          </div>
        )}
      </div>

      {processing && (
        <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Uploading to cloud storage...
          </span>
        </div>
      )}


      {/* Hidden file input with mobile optimizations */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        style={{ fontSize: isMobile ? '16px' : '14px' }}
      />


      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {/* Image gallery */}
      {images.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Images ({images.length})
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div key={image.id} className="relative group">
                <img
                  src={getImageDisplayUrl(image)}
                  alt={image.name}
                  className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    if (onImageClick) {
                      onImageClick(index);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the image click
                    removeImage(image.id);
                  }}
                  className={`absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all ${
                    isMobile 
                      ? 'opacity-100 shadow-lg' // Always visible on mobile with shadow
                      : 'opacity-0 group-hover:opacity-100' // Hover behavior on desktop
                  }`}
                  style={{ 
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    minWidth: isMobile ? '32px' : '24px', // Larger touch target on mobile
                    minHeight: isMobile ? '32px' : '24px'
                  }}
                  aria-label={`Remove ${image.name}`}
                >
                  <X className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                  {image.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}