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

  // Helper function to clean data for Firebase (removes undefined values and handles nested arrays)
  const cleanForFirebase = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Handle arrays - Firebase supports arrays but not nested arrays in certain contexts
    if (Array.isArray(obj)) {
      return obj.map(cleanForFirebase);
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          // Special handling for potentially problematic fields
          if (key === 'points' && Array.isArray(value)) {
            // Flatten points array - convert nested arrays to simple coordinate pairs
            cleaned[key] = value.map(point => {
              if (Array.isArray(point)) {
                // Flatten [x, y] arrays to ensure no nesting - force to numbers
                const x = typeof point[0] === 'number' ? point[0] : 0;
                const y = typeof point[1] === 'number' ? point[1] : 0;
                return [x, y];
              }
              return point;
            });
          } else if (key === 'boundElements' && Array.isArray(value)) {
            // Clean bound elements array - flatten and remove nulls
            cleaned[key] = value
              .filter(el => el != null)
              .map(el => {
                if (typeof el === 'object' && !Array.isArray(el)) {
                  return cleanForFirebase(el);
                }
                // If it's an array or primitive, handle carefully
                return Array.isArray(el) ? null : el;
              })
              .filter(el => el != null);
          } else if (key === 'groupIds' && Array.isArray(value)) {
            // Ensure groupIds is a flat array of strings
            cleaned[key] = value
              .filter(id => typeof id === 'string' || typeof id === 'number')
              .map(id => String(id));
          } else if (Array.isArray(value)) {
            // General array handling - aggressive flattening
            cleaned[key] = value.map(item => {
              if (Array.isArray(item)) {
                // Aggressive flattening - if it's a nested array, flatten it completely
                console.warn(`🔧 Aggressively flattening nested array in ${key}:`, item);
                const flattened = item.flat(Infinity); // Flatten to any depth
                // If the flattened array has 2 elements and they're numbers, treat as coordinate
                if (flattened.length === 2 && typeof flattened[0] === 'number' && typeof flattened[1] === 'number') {
                  return flattened;
                }
                // Otherwise, convert to object or return first element
                return flattened.length === 1 ? flattened[0] : { data: flattened };
              }
              return cleanForFirebase(item);
            });
          } else {
            cleaned[key] = cleanForFirebase(value);
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  const updateCanvas = async (canvasId: string, updates: Partial<Pick<Canvas, 'title' | 'elements' | 'appState' | 'files' | 'thumbnail'>>) => {
    try {
      console.log('🔍 Raw updates received:', updates);
      
      // Comprehensive nested array detection
      const findNestedArrays = (obj: any, path = ''): string[] => {
        const nestedPaths: string[] = [];
        
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            if (Array.isArray(item)) {
              nestedPaths.push(`${path}[${index}]`);
            }
            nestedPaths.push(...findNestedArrays(item, `${path}[${index}]`));
          });
        } else if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            const currentPath = path ? `${path}.${key}` : key;
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                if (Array.isArray(item)) {
                  nestedPaths.push(`${currentPath}[${index}]`);
                }
              });
            }
            nestedPaths.push(...findNestedArrays(value, currentPath));
          });
        }
        
        return nestedPaths;
      };
      
      const nestedArrayPaths = findNestedArrays(updates);
      if (nestedArrayPaths.length > 0) {
        console.error('🚨 Found nested arrays at paths:', nestedArrayPaths);
        console.error('🚨 Full updates object:', JSON.stringify(updates, null, 2));
      }
      
      // Clean data for Firebase compatibility
      const cleanedUpdates = cleanForFirebase(updates);
      
      console.log('🧹 Cleaned updates:', cleanedUpdates);
      
      // Check cleaned data for remaining nested arrays
      const remainingNestedArrayPaths = findNestedArrays(cleanedUpdates);
      if (remainingNestedArrayPaths.length > 0) {
        console.error('🚨 STILL HAVE nested arrays after cleaning at paths:', remainingNestedArrayPaths);
        console.error('🚨 Cleaned updates with remaining nested arrays:', JSON.stringify(cleanedUpdates, null, 2));
      }
      
      await updateDoc(doc(db, 'canvases', canvasId), {
        ...cleanedUpdates,
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Canvas updated successfully');
    } catch (err) {
      console.error('❌ Error updating canvas:', err);
      console.error('❌ Updates that failed:', updates);
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