import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { Project, Note, Canvas, Task } from '@/types';

/**
 * Real-time sync hooks that combine React Query caching with Firebase onSnapshot
 *
 * These hooks:
 * 1. Set up Firebase onSnapshot listeners for real-time updates
 * 2. Update React Query cache when Firebase data changes
 * 3. Automatically cleanup listeners on unmount
 *
 * This gives us both caching AND real-time updates!
 */

/**
 * Syncs projects in real-time and updates React Query cache
 */
export function useRealtimeProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Project[];

      // Update React Query cache
      queryClient.setQueryData(queryKeys.projects.list(user.uid), projects);
    });

    return () => unsubscribe();
  }, [user, queryClient]);
}

/**
 * Syncs notes for a project in real-time
 */
export function useRealtimeNotes(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !projectId) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Note[];

      // Update React Query cache
      queryClient.setQueryData(queryKeys.notes.list(projectId), notes);
    });

    return () => unsubscribe();
  }, [user, projectId, queryClient]);
}

/**
 * Syncs canvases in real-time
 */
export function useRealtimeCanvases(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const constraints: QueryConstraint[] = [
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    ];

    if (projectId) {
      constraints.splice(1, 0, where('projectId', '==', projectId));
    }

    const q = query(collection(db, 'canvases'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const canvases = snapshot.docs.map(doc => {
        const data = doc.data();

        // Transform elements back from Firebase format
        if (data.elements && Array.isArray(data.elements)) {
          data.elements = data.elements.map((element: any) => {
            // Transform points back from {x, y} to [x, y]
            if (element.points && Array.isArray(element.points)) {
              element.points = element.points.map((point: any) => {
                if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
                  return [point.x, point.y];
                }
                return point;
              });
            }

            // Transform scale back from {x, y} to [x, y]
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

      // Update React Query cache
      const cacheKey = projectId
        ? queryKeys.canvases.list(projectId)
        : queryKeys.canvases.list();
      queryClient.setQueryData(cacheKey, canvases);
    });

    return () => unsubscribe();
  }, [user, projectId, queryClient]);
}

/**
 * Syncs tasks for a project in real-time
 */
export function useRealtimeTasks(projectId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !projectId) return;

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      where('projectId', '==', projectId),
      orderBy('status', 'asc'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Task[];

      // Update React Query cache
      queryClient.setQueryData(queryKeys.tasks.list(projectId), tasks);
    });

    return () => unsubscribe();
  }, [user, projectId, queryClient]);
}

/**
 * Syncs owned canvases in real-time
 */
export function useRealtimeOwnedCanvases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'canvases'),
      where('userId', '==', user.uid),
      orderBy('lastModified', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const canvases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Canvas[];

      queryClient.setQueryData(queryKeys.canvases.owned(user.uid), canvases);
    });

    return () => unsubscribe();
  }, [user, queryClient]);
}

/**
 * Syncs shared canvases in real-time
 */
export function useRealtimeSharedCanvases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'canvases'),
      where(`collaborators.${user.uid}`, '!=', null),
      orderBy('lastModified', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const canvases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Canvas[];

      queryClient.setQueryData(queryKeys.canvases.shared(user.uid), canvases);
    });

    return () => unsubscribe();
  }, [user, queryClient]);
}
