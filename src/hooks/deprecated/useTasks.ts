import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStatus, TaskPriority } from '@/types';
import toast from 'react-hot-toast';

export function useTasks(projectId: string | null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      where('projectId', '==', projectId),
      orderBy('status', 'asc'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Task[];

        setTasks(tasksData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching tasks:', err);
        setError('Failed to fetch tasks');
        setLoading(false);
        toast.error('Failed to fetch tasks');
      }
    );

    return () => unsubscribe();
  }, [user, projectId]);

  const createTask = async (
    projectId: string,
    title: string,
    description?: string,
    priority: TaskPriority = 'medium'
  ) => {
    if (!user) {
      toast.error('User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
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

      toast.success('Task created successfully');
    } catch (err) {
      console.error('Error creating task:', err);
      toast.error('Failed to create task');
      throw new Error('Failed to create task');
    }
  };

  const updateTask = async (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'order'>>
  ) => {
    try {
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

      toast.success('Task updated successfully');
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
      throw new Error('Failed to update task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast.success('Task deleted successfully');
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Failed to delete task');
      throw new Error('Failed to delete task');
    }
  };

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
  };
}
