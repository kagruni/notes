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
import { queryKeys } from '@/lib/queryKeys';
import { Project } from '@/types';

/**
 * Fetch projects for the current user
 *
 * Uses getDocs for one-time fetch (real-time updates in Phase 3)
 * Automatically invalidated by mutations
 */
export function useProjectsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.projects.list(user?.uid ?? ''),
    queryFn: async (): Promise<Project[]> => {
      if (!user) {
        return [];
      }

      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Project[];
    },
    enabled: !!user,
  });
}
