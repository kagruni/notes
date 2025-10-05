import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Canvas } from '@/types';

// Transform data from Firebase format back to application format
const transformFromFirebase = (data: any): any => {
  if (data && data.elements && Array.isArray(data.elements)) {
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

  return data;
};

// Hook for fetching canvases by project ID
export function useCanvasesQuery(projectId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['canvases', projectId, user?.uid],
    queryFn: async () => {
      if (!user || !projectId) {
        return [];
      }

      const q = query(
        collection(db, 'canvases'),
        where('userId', '==', user.uid),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);

      const canvases = snapshot.docs.map(doc => {
        const data = doc.data();
        const transformedData = transformFromFirebase(data);

        return {
          id: doc.id,
          ...transformedData,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Canvas;
      });

      return canvases;
    },
    enabled: !!user && !!projectId,
  });
}

// Hook for fetching a single canvas by ID
export function useCanvasQuery(canvasId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['canvas', canvasId],
    queryFn: async () => {
      if (!user || !canvasId) {
        return null;
      }

      const canvasRef = doc(db, 'canvases', canvasId);
      const canvasSnap = await getDoc(canvasRef);

      if (!canvasSnap.exists()) {
        throw new Error('Canvas not found');
      }

      const data = canvasSnap.data();
      const transformedData = transformFromFirebase(data);

      return {
        id: canvasSnap.id,
        ...transformedData,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Canvas;
    },
    enabled: !!user && !!canvasId,
  });
}

// Hook for fetching all canvases owned by the current user
export function useOwnedCanvasesQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['canvases', 'owned', user?.uid],
    queryFn: async () => {
      if (!user) {
        return [];
      }

      const q = query(
        collection(db, 'canvases'),
        where('userId', '==', user.uid),
        orderBy('lastModified', 'desc')
      );

      const snapshot = await getDocs(q);

      const canvases = snapshot.docs.map(doc => {
        const data = doc.data();
        const transformedData = transformFromFirebase(data);

        return {
          id: doc.id,
          ...transformedData,
        } as Canvas;
      });

      return canvases;
    },
    enabled: !!user,
  });
}

// Hook for fetching canvases shared with the current user
export function useSharedCanvasesQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['canvases', 'shared', user?.uid],
    queryFn: async () => {
      if (!user) {
        return [];
      }

      const q = query(
        collection(db, 'canvases'),
        where(`collaborators.${user.uid}`, '!=', null),
        orderBy('lastModified', 'desc')
      );

      const snapshot = await getDocs(q);

      const canvases = snapshot.docs.map(doc => {
        const data = doc.data();
        const transformedData = transformFromFirebase(data);

        return {
          id: doc.id,
          ...transformedData,
        } as Canvas;
      });

      return canvases;
    },
    enabled: !!user,
  });
}
