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
import { Note } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Query hook for fetching notes by project
 *
 * @param projectId - Optional project ID to filter notes
 * @returns React Query result with notes data
 */
export function useNotesQuery(projectId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notes.list(projectId || ''),
    queryFn: async (): Promise<Note[]> => {
      // Early return if no user or projectId
      if (!user || !projectId) {
        return [];
      }

      // Build Firebase query
      const q = query(
        collection(db, 'notes'),
        where('userId', '==', user.uid),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      // Fetch notes
      const snapshot = await getDocs(q);

      // Transform Firestore documents to Note objects
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to Date objects
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Note[];

      return notes;
    },
    enabled: !!user && !!projectId,
  });
}
