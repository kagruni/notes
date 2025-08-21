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
import { Canvas } from '@/types';

export function useCanvases(projectId?: string) {
  const { user } = useAuth();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      setCanvases([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'canvases'),
      where('userId', '==', user.uid),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const canvasesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Canvas[];
        
        setCanvases(canvasesData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching canvases:', err);
        setError('Failed to fetch canvases');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, projectId]);

  const createCanvas = async (title: string, projectId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const docRef = await addDoc(collection(db, 'canvases'), {
        title,
        elements: [],
        appState: {},
        files: {},
        projectId,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return docRef.id;
    } catch (err) {
      console.error('Error creating canvas:', err);
      throw new Error('Failed to create canvas');
    }
  };

  // Helper function to remove undefined values recursively
  const cleanUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(cleanUndefinedValues);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  const updateCanvas = async (canvasId: string, updates: Partial<Pick<Canvas, 'title' | 'elements' | 'appState' | 'files' | 'thumbnail'>>) => {
    try {
      // Clean undefined values from updates
      const cleanedUpdates = cleanUndefinedValues(updates);
      
      await updateDoc(doc(db, 'canvases', canvasId), {
        ...cleanedUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating canvas:', err);
      throw new Error('Failed to update canvas');
    }
  };

  const deleteCanvas = async (canvasId: string) => {
    try {
      await deleteDoc(doc(db, 'canvases', canvasId));
    } catch (err) {
      console.error('Error deleting canvas:', err);
      throw new Error('Failed to delete canvas');
    }
  };

  return {
    canvases,
    loading,
    error,
    createCanvas,
    updateCanvas,
    deleteCanvas,
  };
}