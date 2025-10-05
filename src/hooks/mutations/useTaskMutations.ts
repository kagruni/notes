import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { queryKeys } from '@/lib/queryKeys';
import toast from 'react-hot-toast';
import {
  optimisticallyUpdateTask,
  optimisticallyDeleteTask,
  rollbackQueryData,
} from '@/lib/queryOptimizations';

interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
}

interface UpdateTaskInput {
  taskId: string;
  updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'order'>>;
}

/**
 * Mutation hook for creating a new task
 * Uses Firebase transaction to atomically increment order counter
 */
export function useCreateTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      title,
      description,
      priority = 'medium',
    }: CreateTaskInput) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const tasksRef = collection(db, 'tasks');
      const counterRef = doc(db, 'taskCounters', projectId);

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentMax = counterDoc.exists() ? counterDoc.data().maxOrder : 0;
        const newOrder = currentMax + 1;

        const newTaskRef = doc(tasksRef);
        transaction.set(newTaskRef, {
          projectId,
          title,
          description: description || '',
          status: 'todo' as TaskStatus,
          priority,
          order: newOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
        });

        transaction.set(counterRef, { maxOrder: newOrder }, { merge: true });
      });
    },
    onSuccess: (_data, variables) => {
      toast.success('Task created successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.list(variables.projectId),
      });
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    },
  });
}

/**
 * Mutation hook for updating an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, updates }: UpdateTaskInput) => {
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {} as Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'order'>>);

      await updateDoc(doc(db, 'tasks', taskId), {
        ...filteredUpdates,
        updatedAt: serverTimestamp(),
      });

      return { taskId, updates: filteredUpdates };
    },
    onMutate: async (variables) => {
      // We need to find which project this task belongs to
      const allTasks = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.tasks.lists() });
      const previousData: Array<{ queryKey: unknown[]; data: Task[] }> = [];

      for (const [queryKey, tasks] of allTasks) {
        if (!tasks) continue;

        const task = tasks.find(t => t.id === variables.taskId);
        if (task) {
          // Cancel any outgoing refetches
          await queryClient.cancelQueries({ queryKey });

          // Store previous data
          previousData.push({ queryKey, data: tasks });

          // Optimistically update
          optimisticallyUpdateTask(task.projectId, variables.taskId, variables.updates);
        }
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback all optimistic updates
      if (context?.previousData) {
        for (const { queryKey, data } of context.previousData) {
          rollbackQueryData(queryKey, data);
        }
      }

      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    },
    onSuccess: () => {
      toast.success('Task updated successfully');
    },
    onSettled: () => {
      // Invalidate all task lists since we don't know which project this task belongs to
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.lists(),
      });
    },
  });
}

/**
 * Mutation hook for deleting a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await deleteDoc(doc(db, 'tasks', taskId));
      return taskId;
    },
    onMutate: async (taskId) => {
      // We need to find which project this task belongs to
      const allTasks = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.tasks.lists() });
      const previousData: Array<{ queryKey: unknown[]; data: Task[] }> = [];

      for (const [queryKey, tasks] of allTasks) {
        if (!tasks) continue;

        const task = tasks.find(t => t.id === taskId);
        if (task) {
          // Cancel any outgoing refetches
          await queryClient.cancelQueries({ queryKey });

          // Store previous data
          previousData.push({ queryKey, data: tasks });

          // Optimistically delete
          optimisticallyDeleteTask(task.projectId, taskId);
        }
      }

      return { previousData };
    },
    onError: (error, _taskId, context) => {
      // Rollback all optimistic updates
      if (context?.previousData) {
        for (const { queryKey, data } of context.previousData) {
          rollbackQueryData(queryKey, data);
        }
      }

      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    },
    onSuccess: () => {
      toast.success('Task deleted successfully');
    },
    onSettled: () => {
      // Invalidate all task lists since we don't know which project this task belongs to
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.lists(),
      });
    },
  });
}
