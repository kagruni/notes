'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Note, NoteImage } from '@/types';
import { X, Plus, Hash, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import SpeechRecorder from './SpeechRecorder';
import ImageUploader from './ImageUploader';
import { getImageDisplayUrl } from '@/lib/imageStorage';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, content: string, tags: string[], images?: NoteImage[]) => Promise<void>;
  note?: Note | null;
  mode?: 'view' | 'edit' | 'create';
  onEdit?: () => void;
  projectId: string;
}

export default function NoteModal({ isOpen, onClose, onSubmit, note, mode = 'create', onEdit, projectId }: NoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speechError, setSpeechError] = useState('');
  
  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Ref for the content textarea to handle cursor position
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if we're on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags || []);
      setImages(note.images || []);
    } else {
      setTitle('');
      setContent('');
      setTags([]);
      setImages([]);
    }
    setCurrentTag('');
    setError('');
    setSpeechError('');
    setGalleryOpen(false);
    setCurrentImageIndex(0);
  }, [note, isOpen]);

  const handleAddTag = () => {
    const tag = currentTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleTranscriptionComplete = (transcribedText: string) => {
    const textarea = contentTextareaRef.current;
    
    // Trim the transcribed text to remove any leading/trailing spaces
    const trimmedTranscription = transcribedText.trim();
    
    if (textarea) {
      // Get current cursor position
      const currentStart = textarea.selectionStart;
      const currentEnd = textarea.selectionEnd;
      const currentContent = content;
      
      // Check if cursor is positioned somewhere specific (not just at the very end)
      const isAtEnd = currentStart === currentContent.length;
      const hasSelection = currentStart !== currentEnd;
      
      if (!isAtEnd || hasSelection) {
        // Cursor is positioned somewhere specific - insert at that position
        const beforeCursor = currentContent.substring(0, currentStart);
        const afterCursor = currentContent.substring(currentEnd);
        
        // Add appropriate spacing
        let insertText = trimmedTranscription;
        if (beforeCursor && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n')) {
          insertText = ' ' + insertText;
        }
        if (afterCursor && !afterCursor.startsWith(' ') && !afterCursor.startsWith('\n')) {
          insertText = insertText + ' ';
        }
        
        const newContent = beforeCursor + insertText + afterCursor;
        setContent(newContent);
        
        // Restore cursor position after the inserted text
        setTimeout(() => {
          if (textarea) {
            const newCursorPosition = currentStart + insertText.length;
            textarea.setSelectionRange(newCursorPosition, newCursorPosition);
          }
        }, 0);
      } else {
        // Cursor is at the end or no specific position - append normally
        if (currentContent.length === 0) {
          // If content is empty, just add the transcription without any space
          setContent(trimmedTranscription);
        } else {
          // If there's existing content, add appropriate spacing
          const needsSpace = !currentContent.endsWith(' ') && !currentContent.endsWith('\n');
          const newContent = needsSpace 
            ? `${currentContent} ${trimmedTranscription}` 
            : `${currentContent}${trimmedTranscription}`;
          setContent(newContent);
        }
      }
    } else {
      // Fallback - just append to end
      if (content.length === 0) {
        // If content is empty, just add the transcription without any space
        setContent(trimmedTranscription);
      } else {
        // If there's existing content, add appropriate spacing
        const needsSpace = !content.endsWith(' ') && !content.endsWith('\n');
        const newContent = needsSpace 
          ? `${content} ${trimmedTranscription}` 
          : `${content}${trimmedTranscription}`;
        setContent(newContent);
      }
    }
    
    setSpeechError('');
  };

  // Handle textarea focus to track cursor position
  const handleTextareaFocus = useCallback(() => {
    // Immediately capture cursor position on focus
    setTimeout(() => {
      const textarea = contentTextareaRef.current;
      if (textarea) {
        // Track focus for voice input compatibility on mobile
        console.log('Textarea focused');
      }
    }, 0);
  }, []);

  // Handle textarea blur but preserve cursor position for potential voice input
  const handleTextareaBlur = useCallback(() => {
    // On mobile, keep textareaWasFocused true for a short time to handle voice input
    if (isMobile) {
      setTimeout(() => {
        // Only reset if user hasn't interacted with voice input
        console.log('Textarea blur handled on mobile');
      }, 1000); // Give 1 second for voice input to start
    }
  }, [isMobile]);

  // Handle selection change to update cursor position while focused
  const handleTextareaSelectionChange = useCallback(() => {
    // Track selection changes for voice input positioning
    console.log('Textarea selection changed');
  }, []);

  // Handle mobile touch events
  const handleTextareaTouchEnd = useCallback(() => {
    if (isMobile) {
      setTimeout(() => {
        // Handle touch end events on mobile
        console.log('Touch end handled on mobile');
      }, 100); // Small delay to ensure selection is updated
    }
  }, [isMobile]);

  const handleSpeechError = (errorMessage: string) => {
    setSpeechError(errorMessage);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('📝 Form submission started');
    console.log('📝 Mode:', mode);
    console.log('📝 Title:', title.trim());
    console.log('📝 Content length:', content.trim().length);
    console.log('📝 Tags:', tags);
    console.log('📝 Images count:', images.length);
    console.log('📝 Images details:', images.map(img => ({
      id: img.id,
      name: img.name,
      type: img.type,
      size: img.size,
      url: img.url,
      storagePath: img.storagePath,
      dataLength: img.data?.length || 0
    })));
    
    if (mode === 'view') return;
    
    if (!title.trim()) {
      setError('Note title is required');
      return;
    }

    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    // Prevent double submission
    if (loading) {
      console.log('📝 Preventing double submission');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('📝 Calling onSubmit with:', {
        title: title.trim(),
        contentLength: content.trim().length,
        tagsCount: tags.length,
        imagesCount: images.length
      });
      
      await onSubmit(title.trim(), content.trim(), tags, images);
      console.log('📝 Form submission successful');
      onClose();
    } catch (err: unknown) {
      console.error('📝 Form submission failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setLoading(false);
    }
  }, [mode, title, content, tags, images, loading, onSubmit, onClose]);

  // Prevent background scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);

  const getModalTitle = () => {
    switch (mode) {
      case 'view':
        return 'View Note';
      case 'edit':
        return 'Edit Note';
      default:
        return 'Create New Note';
    }
  };

  // Gallery navigation functions
  const openGallery = (imageIndex: number) => {
    setCurrentImageIndex(imageIndex);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  // Handle keyboard navigation in gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!galleryOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closeGallery();
          break;
        case 'ArrowLeft':
          goToPreviousImage();
          break;
        case 'ArrowRight':
          goToNextImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, goToNextImage, goToPreviousImage]);

  // Safe date formatting function with proper typing
  const formatImageDate = (createdAt: Date | { toDate(): Date } | string | number | null | undefined): string => {
    try {
      if (!createdAt) return 'Unknown';
      
      // If it's already a Date object
      if (createdAt instanceof Date) {
        return createdAt.toLocaleDateString();
      }
      
      // If it's a Firestore Timestamp
      if (typeof createdAt === 'object' && createdAt !== null && 'toDate' in createdAt && typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleDateString();
      }
      
      // If it's a string or number, try to parse it
      if (typeof createdAt === 'string' || typeof createdAt === 'number') {
        const date = new Date(createdAt);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }
      
      return 'Unknown';
    } catch (error) {
      console.warn('Error formatting image date:', error);
      return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      style={{ 
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getModalTitle()}
          </h2>
          <div className="flex items-center space-x-2">
            {mode === 'view' && onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          {speechError && mode !== 'view' && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
              Speech Error: {speechError}
            </div>
          )}

          {mode === 'view' ? (
            /* View Mode */
            <>
              {/* Title */}
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  {title}
                </h3>
              </div>

              {/* Content */}
              <div>
                <div className="whitespace-pre-wrap text-gray-900 dark:text-white leading-relaxed">
                  {content}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full"
                      >
                        <Hash className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Images */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Images ({images.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={getImageDisplayUrl(image)}
                          alt={image.name}
                          className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            openGallery(images.indexOf(image));
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                          {image.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* Close button for view mode */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            /* Edit/Create Mode */
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  style={{ fontSize: isMobile ? '16px' : '14px' }}
                  placeholder="Enter note title"
                  required
                />
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Content *
                  </label>
                  <SpeechRecorder
                    onTranscriptionComplete={handleTranscriptionComplete}
                    onError={handleSpeechError}
                    disabled={loading}
                  />
                </div>
                <textarea
                  ref={contentTextareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={handleTextareaFocus}
                  onBlur={handleTextareaBlur}
                  onSelect={handleTextareaSelectionChange}
                  onTouchEnd={handleTextareaTouchEnd}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  style={{ fontSize: isMobile ? '16px' : '14px' }}
                  placeholder="Write your note content here... or use voice input above"
                  required
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex space-x-2 mb-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      onKeyDown={handleTagKeyPress}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      style={{ fontSize: isMobile ? '16px' : '14px' }}
                      placeholder="Add a tag"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full"
                      >
                        <Hash className="w-3 h-3 mr-1" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Images */}
              <div>
                <ImageUploader
                  images={images}
                  onImagesChange={setImages}
                  onImageClick={openGallery}
                  disabled={loading}
                  projectId={projectId}
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  style={{ 
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
                  style={{ 
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                >
                  {loading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Image Gallery */}
      {galleryOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={closeGallery}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Image Gallery
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentImageIndex + 1} of {images.length}
                </span>
              </div>
              <button
                onClick={closeGallery}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="relative">
              {images.length > 0 && (
                <>
                  {/* Main Image */}
                  <div className="relative bg-black flex items-center justify-center min-h-[400px] max-h-[60vh]">
                    <img
                      src={getImageDisplayUrl(images[currentImageIndex])}
                      alt={images[currentImageIndex].name}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        imageRendering: 'auto'
                      }}
                    />
                    
                    {/* Navigation Buttons */}
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={goToPreviousImage}
                          disabled={currentImageIndex === 0}
                          className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={goToNextImage}
                          disabled={currentImageIndex === images.length - 1}
                          className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Image Info */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {images[currentImageIndex].name}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>Type: {images[currentImageIndex].type}</span>
                      <span>Size: {(images[currentImageIndex].size / 1024).toFixed(1)} KB</span>
                      <span>Added: {formatImageDate(images[currentImageIndex].createdAt)}</span>
                    </div>
                  </div>
                  
                  {/* Thumbnail Navigation */}
                  {images.length > 1 && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {images.map((image, index) => (
                          <button
                            key={image.id}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                              index === currentImageIndex
                                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                          >
                            <img
                              src={getImageDisplayUrl(image)}
                              alt={image.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}