import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Note, NoteImage } from '@/types';
import { migrateImageToStorage, deleteImageFromStorage } from '@/lib/imageStorage';

export function useNotes(projectId?: string) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Note[];
        
        // Migrate base64 images to Firebase Storage in the background
        const migrationPromises = notesData.map(async (note) => {
          if (!note.images || note.images.length === 0) return note;
          
          const imagesToMigrate = note.images.filter(img => img.data && !img.url);
          if (imagesToMigrate.length === 0) return note;
          
          console.log(`🔄 Migrating ${imagesToMigrate.length} images for note ${note.id}`);
          
          try {
            const migratedImages = await Promise.all(
              note.images.map(async (image) => {
                if (image.data && !image.url && user && projectId) {
                  // Migrate this image to Firebase Storage
                  return await migrateImageToStorage(image, user.uid, projectId);
                }
                return image; // Already migrated or no data to migrate
              })
            );
            
            // Update the note in Firestore with migrated images
            await updateDoc(doc(db, 'notes', note.id), {
              images: migratedImages,
              updatedAt: serverTimestamp(),
            });
            
            console.log(`✅ Successfully migrated images for note ${note.id}`);
            return { ...note, images: migratedImages };
          } catch (error) {
            console.error(`❌ Failed to migrate images for note ${note.id}:`, error);
            return note; // Return original note if migration fails
          }
        });
        
        // Wait for all migrations to complete, then update state
        try {
          const migratedNotes = await Promise.all(migrationPromises);
          setNotes(migratedNotes);
        } catch (error) {
          console.error('❌ Error during image migration:', error);
          setNotes(notesData); // Fallback to original data
        }
        
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching notes:', err);
        setError('Failed to fetch notes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, projectId]);

  const createNote = async (title: string, content: string, projectId: string, tags: string[], images?: NoteImage[]) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Check for mobile device
      const isMobile = typeof window !== 'undefined' && 
        (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         'ontouchstart' in window);

      // Mobile-specific validation
      if (isMobile && images && images.length > 0) {
        // For new Firebase Storage images, we don't need to worry about size limits
        // Only validate if there are still base64 images
        const base64Images = images.filter(img => img.data);
        if (base64Images.length > 0) {
          const totalImageSize = base64Images.reduce((total, img) => total + (img.data?.length || 0), 0);
          const maxSizeForMobile = 2 * 1024 * 1024; // 2MB total for mobile

          console.log('📱 Mobile device detected - validating base64 image data for new note');
          console.log('📱 Total base64 image data size:', totalImageSize, 'bytes');
          console.log('📱 Mobile limit:', maxSizeForMobile, 'bytes');

          if (totalImageSize > maxSizeForMobile) {
            throw new Error('Images too large for mobile upload. Please reduce image quality or remove some images.');
          }
        }
      }

      console.log('🔄 Creating note with data size:', JSON.stringify({ title, content, tags, images }).length, 'bytes');

      await addDoc(collection(db, 'notes'), {
        title,
        content,
        projectId,
        userId: user.uid,
        tags: tags,
        images: images || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Note created successfully');
    } catch (err) {
      console.error('❌ Error creating note:', err);
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('too large')) {
          throw err; // Re-throw our custom size error
        } else if (err.message.includes('offline')) {
          throw new Error('Cannot create note while offline. Please check your internet connection.');
        } else if (err.message.includes('permission')) {
          throw new Error('Permission denied. Please refresh the page and try again.');
        } else if (err.message.includes('quota')) {
          throw new Error('Storage quota exceeded. Please contact support.');
        }
      }
      
      throw new Error('Failed to create note. Please try again or reduce image sizes.');
    }
  };

  const updateNote = async (noteId: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'images'>>) => {
    try {
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {} as Partial<Pick<Note, 'title' | 'content' | 'tags' | 'images'>>);

      // Check for mobile device
      const isMobile = typeof window !== 'undefined' && 
        (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         'ontouchstart' in window);

      // Mobile-specific validation and limits
      if (isMobile && filteredUpdates.images) {
        const images = filteredUpdates.images as NoteImage[];
        // For new Firebase Storage images, we don't need to worry about size limits
        // Only validate if there are still base64 images
        const base64Images = images.filter(img => img.data);
        if (base64Images.length > 0) {
          const totalImageSize = base64Images.reduce((total, img) => total + (img.data?.length || 0), 0);
          const maxSizeForMobile = 2 * 1024 * 1024; // 2MB total for mobile

          console.log('📱 Mobile device detected - validating base64 image data');
          console.log('📱 Total base64 image data size:', totalImageSize, 'bytes');
          console.log('📱 Mobile limit:', maxSizeForMobile, 'bytes');

          if (totalImageSize > maxSizeForMobile) {
            throw new Error('Images too large for mobile upload. Please reduce image quality or remove some images.');
          }

          // Validate each base64 image
          for (const img of base64Images) {
            if (img.data && img.data.length > 1024 * 1024) { // 1MB per image on mobile
              console.log('📱 Large base64 image detected:', img.name, img.data.length, 'bytes');
            }
          }
        }
      }

      console.log('🔄 Updating note with data size:', JSON.stringify(filteredUpdates).length, 'bytes');
      
      await updateDoc(doc(db, 'notes', noteId), {
        ...filteredUpdates,
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Note updated successfully');
    } catch (err) {
      console.error('❌ Error updating note:', err);
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('too large')) {
          throw err; // Re-throw our custom size error
        } else if (err.message.includes('offline')) {
          throw new Error('Cannot update note while offline. Please check your internet connection.');
        } else if (err.message.includes('permission')) {
          throw new Error('Permission denied. Please refresh the page and try again.');
        } else if (err.message.includes('quota')) {
          throw new Error('Storage quota exceeded. Please contact support.');
        }
      }
      
      throw new Error('Failed to update note. Please try again or reduce image sizes.');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      // Get the note to find images that need to be deleted from storage
      const noteToDelete = notes.find(note => note.id === noteId);
      
      // Delete the note document first
      await deleteDoc(doc(db, 'notes', noteId));
      
      // Clean up Firebase Storage images in the background
      if (noteToDelete?.images) {
        const storageCleanupPromises = noteToDelete.images
          .filter(image => image.storagePath) // Only delete images that are in Firebase Storage
          .map(async (image) => {
            try {
              await deleteImageFromStorage(image.storagePath!);
              console.log(`🗑️ Deleted image from storage: ${image.storagePath}`);
            } catch (error) {
              console.warn(`⚠️ Failed to delete image from storage: ${image.storagePath}`, error);
              // Don't throw here - note deletion should succeed even if storage cleanup fails
            }
          });
        
        // Run storage cleanup in background without blocking
        Promise.all(storageCleanupPromises).catch(error => {
          console.warn('⚠️ Some images could not be cleaned up from storage:', error);
        });
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      throw new Error('Failed to delete note');
    }
  };

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
  };
} 