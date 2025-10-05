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
import { Canvas } from '@/types';

// Transform data for Firebase (converts nested arrays to objects)
// Copied from existing useCanvases hook to ensure compatibility
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

// Mutation for creating a new canvas
export function useCreateCanvas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      name,
      projectId
    }: {
      title?: string;
      name?: string;
      projectId?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      // Support both name and title for compatibility
      const canvasTitle = title || name;
      if (!canvasTitle) throw new Error('Canvas title/name is required');

      // Create canvas with project-based structure
      const canvasData: any = {
        userId: user.uid,
        elements: [],
        appState: {},
        files: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add title/name based on what was provided
      if (title) {
        canvasData.title = title;
      }
      if (name) {
        canvasData.name = name;
      }
      if (!title && !name) {
        canvasData.title = canvasTitle;
        canvasData.name = canvasTitle;
      }

      // Add projectId if provided (for project-based canvases)
      if (projectId) {
        canvasData.projectId = projectId;
      } else {
        // Standalone canvas (for canvas list page)
        canvasData.content = null;
        canvasData.collaborators = {};
        canvasData.activeUsers = {};
        canvasData.chatMessages = [];
        canvasData.version = 1;
        canvasData.lastModified = serverTimestamp();
      }

      const docRef = await addDoc(collection(db, 'canvases'), canvasData);

      return docRef.id;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['canvases'] });
    },
  });
}

// Mutation for updating a canvas
export function useUpdateCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      canvasId,
      updates
    }: {
      canvasId: string;
      updates: Partial<Pick<Canvas, 'title' | 'name' | 'elements' | 'appState' | 'files' | 'thumbnail'>>
    }) => {
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

      return canvasId;
    },
    onSuccess: (canvasId) => {
      // Invalidate all canvas-related queries
      queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] });
      queryClient.invalidateQueries({ queryKey: ['canvases'] });
    },
  });
}

// Mutation for deleting a canvas
export function useDeleteCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (canvasId: string) => {
      await deleteDoc(doc(db, 'canvases', canvasId));
      return canvasId;
    },
    onSuccess: () => {
      // Invalidate all canvas-related queries
      queryClient.invalidateQueries({ queryKey: ['canvases'] });
    },
  });
}
