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
import { queryKeys } from '@/lib/queryKeys';
import { Project } from '@/types';
import toast from 'react-hot-toast';

interface CreateProjectInput {
  title: string;
  description?: string;
  color?: string;
}

interface UpdateProjectInput {
  projectId: string;
  updates: Partial<Pick<Project, 'title' | 'description' | 'color'>>;
}

/**
 * Create a new project with optimistic updates
 */
export function useCreateProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, description, color }: CreateProjectInput) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const projectData = {
        title,
        description: description || '',
        userId: user.uid,
        color: color || '#3B82F6',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      return docRef.id;
    },
    onMutate: async ({ title, description, color }) => {
      if (!user) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.list(user.uid) });

      // Snapshot previous data
      const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(user.uid));

      // Optimistically add project to cache
      if (previousProjects) {
        const optimisticProject: Project = {
          id: `temp-${Date.now()}`,
          title,
          description,
          userId: user.uid,
          color: color || '#3B82F6',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        queryClient.setQueryData<Project[]>(
          queryKeys.projects.list(user.uid),
          [...previousProjects, optimisticProject]
        );
      }

      return { previousProjects };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousProjects && user) {
        queryClient.setQueryData(queryKeys.projects.list(user.uid), context.previousProjects);
      }
      console.error('Error creating project:', error);
      toast.error(`Failed to create project: ${error.message}`);
    },
    onSuccess: () => {
      toast.success('Project created successfully');
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(user.uid) });
      }
    },
  });
}

/**
 * Update an existing project with optimistic updates
 */
export function useUpdateProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updates }: UpdateProjectInput) => {
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {} as Partial<Pick<Project, 'title' | 'description' | 'color'>>);

      await updateDoc(doc(db, 'projects', projectId), {
        ...filteredUpdates,
        updatedAt: serverTimestamp(),
      });

      return projectId;
    },
    onMutate: async ({ projectId, updates }) => {
      if (!user) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.list(user.uid) });

      // Snapshot previous data
      const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(user.uid));

      // Optimistically update project in cache
      if (previousProjects) {
        queryClient.setQueryData<Project[]>(
          queryKeys.projects.list(user.uid),
          previousProjects.map(p =>
            p.id === projectId
              ? { ...p, ...updates, updatedAt: new Date() }
              : p
          )
        );
      }

      return { previousProjects };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousProjects && user) {
        queryClient.setQueryData(queryKeys.projects.list(user.uid), context.previousProjects);
      }
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    },
    onSuccess: () => {
      toast.success('Project updated successfully');
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(user.uid) });
      }
    },
  });
}

/**
 * Delete a project with optimistic updates
 */
export function useDeleteProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await deleteDoc(doc(db, 'projects', projectId));
      return projectId;
    },
    onMutate: async (projectId) => {
      if (!user) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.list(user.uid) });

      // Snapshot previous data
      const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(user.uid));

      // Optimistically delete project from cache
      if (previousProjects) {
        queryClient.setQueryData<Project[]>(
          queryKeys.projects.list(user.uid),
          previousProjects.filter(p => p.id !== projectId)
        );
      }

      return { previousProjects };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousProjects && user) {
        queryClient.setQueryData(queryKeys.projects.list(user.uid), context.previousProjects);
      }
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    },
    onSuccess: () => {
      toast.success('Project deleted successfully');
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(user.uid) });
      }
    },
  });
}
