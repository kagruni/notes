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
        const canvasesData = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Transform elements back from Firebase format if needed
          if (data.elements && Array.isArray(data.elements)) {
            data.elements = data.elements.map((element: any) => {
              // Transform points back from {x, y} to [x, y] if needed
              if (element.points && Array.isArray(element.points)) {
                element.points = element.points.map((point: any) => {
                  if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
                    return [point.x, point.y];
                  }
                  return point;
                });
              }
              
              // Transform scale back from {x, y} to [x, y] if needed
              if (element.scale && typeof element.scale === 'object' && 'x' in element.scale && 'y' in element.scale) {
                element.scale = [element.scale.x, element.scale.y];
              }
              
              return element;
            });
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
        }) as Canvas[];
        
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

  // Transform data for Firebase (converts nested arrays to objects)
  const transformForFirebase = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      // Check if this is a nested array that needs transformation
      const hasNestedArrays = obj.some(item => Array.isArray(item));
      
      if (hasNestedArrays) {
        // Transform nested arrays to objects
        return obj.map(item => {
          if (Array.isArray(item)) {
            // Convert [x, y] to {x, y}
            if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
              return { x: item[0], y: item[1] };
            }
            // For other arrays, wrap in object
            return { data: item };
          }
          return transformForFirebase(item);
        });
      }
      
      // Regular array, process items
      return obj.map(transformForFirebase);
    }
    
    if (typeof obj === 'object') {
      const transformed: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        
        // Special handling for known nested array fields
        if (key === 'points' && Array.isArray(value)) {
          // Transform points [[x,y], [x,y]] to [{x, y}, {x, y}]
          transformed[key] = value.map(point => {
            if (Array.isArray(point) && point.length >= 2) {
              return { x: point[0], y: point[1] };
            }
            return point;
          });
        } else if (key === 'scale' && Array.isArray(value) && value.length === 2) {
          // Transform scale [x, y] to {x, y}
          transformed[key] = { x: value[0], y: value[1] };
        } else if (key === 'boundElements' && Array.isArray(value)) {
          // Ensure boundElements are objects
          transformed[key] = value
            .filter(el => el != null)
            .map(el => {
              if (Array.isArray(el)) {
                return { id: el[0], type: el[1] || 'arrow' };
              }
              return transformForFirebase(el);
            });
        } else if (key === 'groupIds' && Array.isArray(value)) {
          // Keep groupIds as flat array of strings
          transformed[key] = value
            .filter(id => id != null)
            .map(id => String(id));
        } else if (Array.isArray(value)) {
          // Check for nested arrays in any other field
          const hasNestedArrays = value.some(item => Array.isArray(item));
          
          if (hasNestedArrays) {
            console.warn(`🔧 Transforming nested array in ${key}`);
            transformed[key] = value.map(item => {
              if (Array.isArray(item)) {
                if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
                  return { x: item[0], y: item[1] };
                }
                return { data: item };
              }
              return transformForFirebase(item);
            });
          } else {
            transformed[key] = value.map(transformForFirebase);
          }
        } else {
          transformed[key] = transformForFirebase(value);
        }
      }
      
      return transformed;
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
      
      // Transform data for Firebase compatibility (nested arrays to objects)
      const transformedUpdates = transformForFirebase(updates);
      
      console.log('🧹 Transformed updates:', transformedUpdates);
      
      // Check transformed data for remaining nested arrays
      const remainingNestedArrayPaths = findNestedArrays(transformedUpdates);
      if (remainingNestedArrayPaths.length > 0) {
        console.error('🚨 STILL HAVE nested arrays after transformation at paths:', remainingNestedArrayPaths);
        console.error('🚨 Transformed updates with remaining nested arrays:', JSON.stringify(transformedUpdates, null, 2));
      }
      
      await updateDoc(doc(db, 'canvases', canvasId), {
        ...transformedUpdates,
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