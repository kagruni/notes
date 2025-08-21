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

  const updateCanvas = async (canvasId: string, updates: Partial<Pick<Canvas, 'title' | 'elements' | 'appState' | 'files' | 'thumbnail'>>) => {
    try {
      await updateDoc(doc(db, 'canvases', canvasId), {
        ...updates,
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