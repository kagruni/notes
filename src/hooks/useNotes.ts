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
    } catch (err) {
      console.error('Error creating note:', err);
      throw new Error('Failed to create note');
    }
  };

  const updateNote = async (noteId: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'images'>>) => {
    try {
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await updateDoc(doc(db, 'notes', noteId), {
        ...filteredUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating note:', err);
      throw new Error('Failed to update note');
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