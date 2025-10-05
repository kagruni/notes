import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Note, NoteImage } from '@/types';
import { queryKeys } from '@/lib/queryKeys';
import { deleteImageFromStorage } from '@/lib/imageStorage';
import {
  optimisticallyAddNote,
  optimisticallyUpdateNote,
  optimisticallyDeleteNote,
  rollbackQueryData,
} from '@/lib/queryOptimizations';
import toast from 'react-hot-toast';

interface CreateNoteInput {
  title: string;
  content: string;
  projectId: string;
  tags: string[];
  images?: NoteImage[];
}

interface UpdateNoteInput {
  noteId: string;
  updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'images'>>;
}

/**
 * Check if device is mobile for validation
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    'ontouchstart' in window
  );
}

/**
 * Validate image sizes for mobile devices
 */
function validateMobileImages(images: NoteImage[]): void {
  if (!isMobileDevice()) return;

  // For new Firebase Storage images, we don't need to worry about size limits
  // Only validate if there are still base64 images
  const base64Images = images.filter(img => img.data);
  if (base64Images.length === 0) return;

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

/**
 * Mutation hook for creating a new note
 */
export function useCreateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content, projectId, tags, images }: CreateNoteInput) => {
      if (!user) throw new Error('User not authenticated');

      try {
        // Mobile-specific validation
        if (images && images.length > 0) {
          validateMobileImages(images);
        }

        console.log('🔄 Creating note with data size:', JSON.stringify({ title, content, tags, images }).length, 'bytes');

        const docRef = await addDoc(collection(db, 'notes'), {
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
        return docRef.id;
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
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.list(variables.projectId) });

      // Optimistically add note to cache
      const previousNotes = optimisticallyAddNote(variables.projectId, {
        title: variables.title,
        content: variables.content,
        userId: user!.uid,
        tags: variables.tags,
        images: variables.images,
      });

      return { previousNotes };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotes) {
        rollbackQueryData(queryKeys.notes.list(variables.projectId), context.previousNotes);
      }

      // Show error toast
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create note');
      }
    },
    onSuccess: () => {
      toast.success('Note created successfully');
    },
    onSettled: (_, __, variables) => {
      // Invalidate notes list for the project
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(variables.projectId),
      });
    },
  });
}

/**
 * Mutation hook for updating an existing note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, updates }: UpdateNoteInput) => {
      try {
        // Filter out undefined values to prevent Firebase errors
        const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            (acc as Record<string, unknown>)[key] = value;
          }
          return acc;
        }, {} as Partial<Pick<Note, 'title' | 'content' | 'tags' | 'images'>>);

        // Mobile-specific validation and limits
        if (filteredUpdates.images) {
          const images = filteredUpdates.images as NoteImage[];
          validateMobileImages(images);
        }

        console.log('🔄 Updating note with data size:', JSON.stringify(filteredUpdates).length, 'bytes');

        await updateDoc(doc(db, 'notes', noteId), {
          ...filteredUpdates,
          updatedAt: serverTimestamp(),
        });

        console.log('✅ Note updated successfully');
        return { noteId, updates: filteredUpdates };
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
    },
    onMutate: async (variables) => {
      // We need to find which project this note belongs to
      // We'll optimistically update all notes lists
      const allNotes = queryClient.getQueriesData<Note[]>({ queryKey: queryKeys.notes.lists() });
      const previousData: Array<{ queryKey: unknown[]; data: Note[] }> = [];

      for (const [queryKey, notes] of allNotes) {
        if (!notes) continue;

        const note = notes.find(n => n.id === variables.noteId);
        if (note) {
          // Cancel any outgoing refetches
          await queryClient.cancelQueries({ queryKey });

          // Store previous data
          previousData.push({ queryKey, data: notes });

          // Optimistically update
          optimisticallyUpdateNote(note.projectId, variables.noteId, variables.updates);
        }
      }

      return { previousData };
    },
    onError: (err, _variables, context) => {
      // Rollback all optimistic updates
      if (context?.previousData) {
        for (const { queryKey, data } of context.previousData) {
          rollbackQueryData(queryKey, data);
        }
      }

      // Show error toast
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to update note');
      }
    },
    onSuccess: () => {
      toast.success('Note updated successfully');
    },
    onSettled: (_, __, variables) => {
      // Invalidate all notes queries (we don't have projectId here)
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.all,
      });
      // Also invalidate the specific note detail if it exists
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.detail(variables.noteId),
      });
    },
  });
}

/**
 * Mutation hook for deleting a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, note }: { noteId: string; note?: Note }) => {
      try {
        // Delete the note document first
        await deleteDoc(doc(db, 'notes', noteId));

        // Clean up Firebase Storage images in the background
        if (note?.images) {
          const storageCleanupPromises = note.images
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
    },
    onMutate: async (variables) => {
      // We need to find which project this note belongs to
      const allNotes = queryClient.getQueriesData<Note[]>({ queryKey: queryKeys.notes.lists() });
      const previousData: Array<{ queryKey: unknown[]; data: Note[] }> = [];

      for (const [queryKey, notes] of allNotes) {
        if (!notes) continue;

        const note = notes.find(n => n.id === variables.noteId);
        if (note) {
          // Cancel any outgoing refetches
          await queryClient.cancelQueries({ queryKey });

          // Store previous data
          previousData.push({ queryKey, data: notes });

          // Optimistically delete
          optimisticallyDeleteNote(note.projectId, variables.noteId);
        }
      }

      return { previousData };
    },
    onError: (err, _variables, context) => {
      // Rollback all optimistic updates
      if (context?.previousData) {
        for (const { queryKey, data } of context.previousData) {
          rollbackQueryData(queryKey, data);
        }
      }

      // Show error toast
      toast.error('Failed to delete note');
    },
    onSuccess: () => {
      toast.success('Note deleted successfully');
    },
    onSettled: () => {
      // Invalidate all notes queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.all,
      });
    },
  });
}
