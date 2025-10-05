import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

/**
 * React Query hook for fetching tasks
 * @param projectId - Project ID to filter tasks, or null to disable query
 */
export function useTasksQuery(projectId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.tasks.list(projectId || ''),
    queryFn: async (): Promise<Task[]> => {
      if (!user || !projectId) {
        return [];
      }

      const q = query(
        collection(db, 'tasks'),
        where('userId', '==', user.uid),
        where('projectId', '==', projectId),
        orderBy('status', 'asc'),
        orderBy('order', 'asc')
      );

      const snapshot = await getDocs(q);

      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Task[];

      return tasks;
    },
    enabled: !!user && !!projectId,
  });
}
