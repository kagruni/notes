'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, AlertCircle } from 'lucide-react';
import { NoteImage } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImageToStorage, compressImageFile, getImageDisplayUrl } from '@/lib/imageStorage';

interface ImageUploaderProps {
  images: NoteImage[];
  onImagesChange: (images: NoteImage[]) => void;
  onImageClick?: (imageIndex: number) => void;
  disabled?: boolean;
  projectId?: string; // Required for Firebase Storage path
}

export default function ImageUploader({ images, onImagesChange, onImageClick, disabled = false, projectId }: ImageUploaderProps) {
  const { user } = useAuth();
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     'ontouchstart' in window);

  // Check if camera is supported
  const checkCameraSupport = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Check if we're on HTTPS or localhost
    const isSecureContext = window.location.protocol === 'https:' || 
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      setCameraSupported(false);
      return false;
    }
    
    // Check if mediaDevices API is available
    const hasMediaDevices = navigator && 
                           navigator.mediaDevices && 
                           typeof navigator.mediaDevices.getUserMedia === 'function';
    
    setCameraSupported(hasMediaDevices);
    return hasMediaDevices;
  }, []);

  const generateImageId = () => {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const processImageFile = useCallback(async (file: File): Promise<NoteImage> => {
    if (!user || !projectId) {
      throw new Error('User authentication and project ID required');
    }

    try {
      console.log('📁 Processing file:', file.name, 'type:', file.type, 'size:', file.size);
      
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
      };

      console.log('📁 Created NoteImage with Firebase Storage:', {
        id: noteImage.id,
        name: noteImage.name,
        type: noteImage.type,
        size: noteImage.size,
        url: noteImage.url
      });

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

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Check camera support first
      if (!checkCameraSupport()) {
        const isSecureContext = typeof window !== 'undefined' && 
                               (window.location.protocol === 'https:' || 
                                window.location.hostname === 'localhost' ||
                                window.location.hostname === '127.0.0.1');
        
        if (!isSecureContext) {
          setError('Camera requires HTTPS. Please access the app via HTTPS or localhost for camera functionality.');
        } else {
          setError('Camera is not supported on this device or browser.');
        }
        return;
      }

      setIsCapturing(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isMobile ? 'environment' : 'user', // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera is not supported on this device.');
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('Camera access failed. Please ensure you are using HTTPS and have granted camera permissions.');
      }
      
      setIsCapturing(false);
    }
  }, [isMobile, checkCameraSupport]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !user || !projectId) return;

    console.log('📸 Camera capture started');
    setProcessing(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log('📸 Canvas size set:', canvas.width, 'x', canvas.height);

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to create blob from canvas'));
            },
            'image/jpeg',
            isMobile ? 0.75 : 0.85
          );
        });

        // Create file from blob
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Process the captured image
        const noteImage = await processImageFile(file);

        console.log('📸 Adding camera image to state');
        onImagesChange([...images, noteImage]);
        setIsCapturing(false);
        stopCamera();
      }
    } catch (error) {
      console.error('📸 Error capturing photo:', error);
      setError(error instanceof Error ? error.message : 'Failed to capture photo');
    } finally {
      setProcessing(false);
    }
  }, [images, onImagesChange, stopCamera, processImageFile, user, projectId, isMobile]);

  const removeImage = useCallback((imageId: string) => {
    onImagesChange(images.filter(img => img.id !== imageId));
  }, [images, onImagesChange]);

  // Initialize camera support check
  useState(() => {
    if (typeof window !== 'undefined') {
      checkCameraSupport();
    }
  });

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
            {cameraSupported && (
              <button
                type="button"
                onClick={isCapturing ? stopCamera : startCamera}
                disabled={processing}
                className="flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm transition-colors"
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
              >
                <Camera className="w-4 h-4" />
                <span>{isCapturing ? 'Cancel' : 'Camera'}</span>
              </button>
            )}
            
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

      {/* HTTPS warning for mobile */}
      {isMobile && cameraSupported === false && (
        <div className="p-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-400 text-amber-700 dark:text-amber-400 rounded text-sm flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Camera requires HTTPS:</strong> To use the camera feature on mobile devices, you need to access the app via HTTPS. 
            For development, you can use tools like ngrok or deploy to a staging environment with HTTPS.
          </div>
        </div>
      )}

      {/* Hidden file input with mobile optimizations */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        style={{ fontSize: isMobile ? '16px' : '14px' }}
      />

      {/* Camera view */}
      {isCapturing && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full max-h-64 object-cover"
            playsInline
            muted
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={processing}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-50"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              <div className="w-full h-full bg-gray-200 rounded-full"></div>
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

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