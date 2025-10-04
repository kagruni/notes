/**
 * Unit tests for useTasks hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useTasks } from './useTasks';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  runTransaction: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useTasks', () => {
  const mockUser = { uid: 'test-user-id' };
  const mockProjectId = 'test-project-id';

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  describe('Real-time listener behavior', () => {
    it('should set up snapshot listener when user and projectId are provided', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useTasks(mockProjectId));

      expect(collection).toHaveBeenCalled();
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('userId', '==', mockUser.uid);
      expect(where).toHaveBeenCalledWith('projectId', '==', mockProjectId);
      expect(orderBy).toHaveBeenCalledWith('status', 'asc');
      expect(orderBy).toHaveBeenCalledWith('order', 'asc');
      expect(onSnapshot).toHaveBeenCalled();

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not set up listener when user is null', () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useTasks(mockProjectId));

      expect(onSnapshot).not.toHaveBeenCalled();
      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should not set up listener when projectId is null', () => {
      const { result } = renderHook(() => useTasks(null));

      expect(onSnapshot).not.toHaveBeenCalled();
      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should handle snapshot updates correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'Description',
          status: 'todo',
          priority: 'medium',
          order: 1,
          createdAt: { toDate: () => new Date('2024-01-01') },
          updatedAt: { toDate: () => new Date('2024-01-01') },
        },
      ];

      (onSnapshot as jest.Mock).mockImplementation((q, successCallback) => {
        successCallback({
          docs: mockTasks.map((task) => ({
            id: task.id,
            data: () => task,
          })),
        });
        return jest.fn();
      });

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].title).toBe('Test Task');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle snapshot errors', async () => {
      const mockError = new Error('Firestore error');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (onSnapshot as jest.Mock).mockImplementation((q, successCallback, errorCallback) => {
        errorCallback(mockError);
        return jest.fn();
      });

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch tasks');
        expect(result.current.loading).toBe(false);
        expect(toast.error).toHaveBeenCalledWith('Failed to fetch tasks');
        expect(consoleError).toHaveBeenCalledWith('Error fetching tasks:', mockError);
      });

      consoleError.mockRestore();
    });
  });

  describe('createTask', () => {
    it('should create task with default values', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => false,
          data: () => undefined,
        }),
        set: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        await callback(mockTransaction);
      });
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.createTask(mockProjectId, 'New Task');

      expect(runTransaction).toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: mockProjectId,
          title: 'New Task',
          description: '',
          status: 'todo',
          priority: 'medium',
          order: 1,
          userId: mockUser.uid,
        })
      );
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        { maxOrder: 1 },
        { merge: true }
      );
      expect(toast.success).toHaveBeenCalledWith('Task created successfully');
    });

    it('should create task with custom description and priority', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => false,
          data: () => undefined,
        }),
        set: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        await callback(mockTransaction);
      });
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.createTask(
        mockProjectId,
        'High Priority Task',
        'Important task description',
        'high'
      );

      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: 'High Priority Task',
          description: 'Important task description',
          priority: 'high',
        })
      );
    });

    it('should calculate correct order when existing tasks present', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ maxOrder: 8 }),
        }),
        set: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        await callback(mockTransaction);
      });
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.createTask(mockProjectId, 'New Task');

      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          order: 9, // max order (8) + 1
        })
      );
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        { maxOrder: 9 },
        { merge: true }
      );
    });

    it('should throw error when user not authenticated', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.createTask(mockProjectId, 'New Task')
      ).rejects.toThrow('User not authenticated');

      expect(toast.error).toHaveBeenCalledWith('User not authenticated');
    });

    it('should handle creation errors', async () => {
      const mockError = new Error('Firestore error');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (runTransaction as jest.Mock).mockRejectedValue(mockError);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.createTask(mockProjectId, 'New Task')
      ).rejects.toThrow('Failed to create task');

      expect(toast.error).toHaveBeenCalledWith('Failed to create task');
      expect(consoleError).toHaveBeenCalledWith('Error creating task:', mockError);

      consoleError.mockRestore();
    });
  });

  describe('updateTask', () => {
    it('should update task with partial updates', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateTask('task-id', {
        title: 'Updated Title',
        priority: 'high',
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: 'Updated Title',
          priority: 'high',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Task updated successfully');
    });

    it('should filter out undefined values', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateTask('task-id', {
        title: 'Updated Title',
        description: undefined,
        priority: 'high',
      });

      const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateCall).toHaveProperty('title', 'Updated Title');
      expect(updateCall).toHaveProperty('priority', 'high');
      expect(updateCall).not.toHaveProperty('description');
    });

    it('should handle update errors', async () => {
      const mockError = new Error('Firestore error');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (updateDoc as jest.Mock).mockRejectedValue(mockError);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.updateTask('task-id', { title: 'Updated' })
      ).rejects.toThrow('Failed to update task');

      expect(toast.error).toHaveBeenCalledWith('Failed to update task');
      expect(consoleError).toHaveBeenCalledWith('Error updating task:', mockError);

      consoleError.mockRestore();
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deleteTask('task-id');

      expect(deleteDoc).toHaveBeenCalledWith(expect.anything());
      expect(toast.success).toHaveBeenCalledWith('Task deleted successfully');
    });

    it('should handle delete errors', async () => {
      const mockError = new Error('Firestore error');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (deleteDoc as jest.Mock).mockRejectedValue(mockError);
      (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

      const { result } = renderHook(() => useTasks(mockProjectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.deleteTask('task-id')).rejects.toThrow(
        'Failed to delete task'
      );

      expect(toast.error).toHaveBeenCalledWith('Failed to delete task');
      expect(consoleError).toHaveBeenCalledWith('Error deleting task:', mockError);

      consoleError.mockRestore();
    });
  });
});
