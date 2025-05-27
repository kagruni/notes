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
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Note[];
        
        setNotes(notesData);
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
        const totalImageSize = images.reduce((total, img) => total + (img.data?.length || 0), 0);
        const maxSizeForMobile = 2 * 1024 * 1024; // 2MB total for mobile

        console.log('📱 Mobile device detected - validating image data for new note');
        console.log('📱 Total image data size:', totalImageSize, 'bytes');
        console.log('📱 Mobile limit:', maxSizeForMobile, 'bytes');

        if (totalImageSize > maxSizeForMobile) {
          throw new Error('Images too large for mobile upload. Please reduce image quality or remove some images.');
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
        const totalImageSize = images.reduce((total, img) => total + (img.data?.length || 0), 0);
        const maxSizeForMobile = 2 * 1024 * 1024; // 2MB total for mobile

        console.log('📱 Mobile device detected - validating image data');
        console.log('📱 Total image data size:', totalImageSize, 'bytes');
        console.log('📱 Mobile limit:', maxSizeForMobile, 'bytes');

        if (totalImageSize > maxSizeForMobile) {
          throw new Error('Images too large for mobile upload. Please reduce image quality or remove some images.');
        }

        // Validate each image
        for (const img of images) {
          if (img.data && img.data.length > 1024 * 1024) { // 1MB per image on mobile
            console.log('📱 Large image detected:', img.name, img.data.length, 'bytes');
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
      await deleteDoc(doc(db, 'notes', noteId));
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