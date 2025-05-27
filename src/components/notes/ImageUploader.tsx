'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { NoteImage } from '@/types';

interface ImageUploaderProps {
  images: NoteImage[];
  onImagesChange: (images: NoteImage[]) => void;
  disabled?: boolean;
}

export default function ImageUploader({ images, onImagesChange, disabled = false }: ImageUploaderProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     'ontouchstart' in window);

  const generateImageId = () => {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const newImages: NoteImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError(`File ${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError(`File ${file.name} is too large (max 5MB)`);
          continue;
        }

        const base64Data = await convertFileToBase64(file);
        
        const noteImage: NoteImage = {
          id: generateImageId(),
          data: base64Data,
          type: file.type,
          name: file.name,
          size: file.size,
          createdAt: new Date(),
        };

        newImages.push(noteImage);
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages]);
      }
    } catch (err) {
      setError('Failed to process images');
      console.error('Error processing images:', err);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images, onImagesChange]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
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
      setError('Camera access denied or not available');
      setIsCapturing(false);
      console.error('Error starting camera:', err);
    }
  }, [isMobile]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const base64Data = canvas.toDataURL('image/jpeg', 0.8);
    
    const noteImage: NoteImage = {
      id: generateImageId(),
      data: base64Data,
      type: 'image/jpeg',
      name: `camera-${Date.now()}.jpg`,
      size: base64Data.length,
      createdAt: new Date(),
    };

    onImagesChange([...images, noteImage]);
    stopCamera();
  }, [images, onImagesChange, stopCamera]);

  const removeImage = useCallback((imageId: string) => {
    onImagesChange(images.filter(img => img.id !== imageId));
  }, [images, onImagesChange]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={disabled}
          className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Upload</span>
        </button>

        {isMobile && (
          <button
            type="button"
            onClick={isCapturing ? stopCamera : startCamera}
            disabled={disabled}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors disabled:opacity-50 ${
              isCapturing 
                ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' 
                : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isCapturing ? 'Cancel' : 'Camera'}
            </span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
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
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 transition-colors"
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
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.data}
                  alt={image.name}
                  className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
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