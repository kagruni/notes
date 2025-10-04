# Tasks Management Feature - Implementation Checklist

## Overview

This document provides an ordered, actionable task list for implementing the tasks management feature in the notes/projects application. Each task includes file paths, acceptance criteria, and testing notes.

**Reference:** See `TASKS_FEATURE_SPEC.md` for detailed technical specification.

---

## Phase 1: Foundation & Data Layer (Week 1)

### 1.1 TypeScript Types & Interfaces

**File:** `/src/types/index.ts`

**Tasks:**
- [ ] Add `TaskStatus` type: `'todo' | 'in_progress' | 'done'`
- [ ] Add `TaskPriority` type: `'low' | 'medium' | 'high'`
- [ ] Add `Task` interface with all required fields
- [ ] Export new types from index

**Acceptance Criteria:**
- No TypeScript errors
- Types match spec exactly
- All fields properly typed (no `any` types)

**Test Notes:**
- Type checking will catch any issues at compile time
- No runtime tests needed for types

**Implementation Hints:**
```typescript
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  projectId: string;
  userId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}
```

---

### 1.2 Firestore Security Rules

**File:** `/firestore.rules`

**Tasks:**
- [ ] Add `tasks` collection rules under `match /databases/{database}/documents`
- [ ] Implement read permissions (owner + project shared users)
- [ ] Implement create permissions (authenticated + project access)
- [ ] Implement update/delete permissions (owner only)
- [ ] Test rules using Firebase Emulator or Console

**Acceptance Criteria:**
- User can only read tasks from their projects
- User can only create tasks in projects they have access to
- User can only update/delete their own tasks
- Security rules deployed successfully

**Test Notes:**
- Use Firebase Emulator to test rules locally
- Test unauthorized access attempts
- Test project sharing scenarios

**Implementation Hints:**
```javascript
// Add to firestore.rules after other collections
match /tasks/{taskId} {
  allow read: if isSignedIn() && (
    resource.data.userId == request.auth.uid ||
    get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.userId == request.auth.uid ||
    request.auth.uid in get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.sharedWith
  );
  allow create: if isSignedIn() &&
    request.auth.uid == request.resource.data.userId;
  allow update, delete: if isOwner(resource);
}
```

---

### 1.3 Firestore Indexes

**File:** Create `firestore.indexes.json` (if doesn't exist) or add via Firebase Console

**Tasks:**
- [ ] Create composite index: `userId + projectId + status + createdAt`
- [ ] Create composite index: `userId + projectId + status + order`
- [ ] Deploy indexes to Firebase

**Acceptance Criteria:**
- Indexes created successfully in Firebase Console
- Query performance meets targets (<500ms)
- No index errors in console logs

**Test Notes:**
- Run queries with filters to trigger index creation prompts
- Monitor Firestore logs for missing index errors
- Use Firebase Console to verify index status

**Implementation:**
Via Firebase Console or `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

### 1.4 Custom Hook: `useTasks`

**File:** `/src/hooks/useTasks.ts`

**Tasks:**
- [ ] Create `useTasks` hook following `useNotes`/`useCanvases` pattern
- [ ] Implement Firestore real-time listener with `onSnapshot`
- [ ] Implement `createTask` function with order calculation
- [ ] Implement `updateTask` function with partial updates
- [ ] Implement `deleteTask` function
- [ ] Implement `updateTaskStatus` helper function
- [ ] Implement `reorderTask` function for drag-and-drop
- [ ] Add error handling with try-catch and toast notifications
- [ ] Add loading state management

**Acceptance Criteria:**
- Hook returns tasks array, loading state, error state
- All CRUD operations work correctly
- Real-time updates reflect changes immediately
- Errors are caught and displayed to user via toast
- Order calculation works correctly for new tasks

**Test Notes:**
- Unit test each CRUD function
- Test real-time listener behavior
- Test error scenarios (network offline, permission denied)
- Test order calculation edge cases

**Implementation Hints:**
```typescript
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStatus } from '@/types';
import toast from 'react-hot-toast';

export function useTasks(projectId?: string) {
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
          dueDate: doc.data().dueDate?.toDate(),
        })) as Task[];

        setTasks(tasksData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching tasks:', err);
        setError('Failed to fetch tasks');
        setLoading(false);
        toast.error('Failed to load tasks');
      }
    );

    return () => unsubscribe();
  }, [user, projectId]);

  const createTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'order'>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Calculate order: max order in status + 1
      const tasksInStatus = tasks.filter(t => t.status === taskData.status);
      const maxOrder = tasksInStatus.length > 0
        ? Math.max(...tasksInStatus.map(t => t.order))
        : 0;

      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        userId: user.uid,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Task created successfully');
    } catch (err) {
      console.error('Error creating task:', err);
      toast.error('Failed to create task');
      throw err;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      toast.success('Task updated successfully');
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
      throw err;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast.success('Task deleted successfully');
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Failed to delete task');
      throw err;
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    await updateTask(taskId, { status });
  };

  const reorderTask = async (taskId: string, newOrder: number, newStatus?: TaskStatus) => {
    const updates: Partial<Task> = { order: newOrder };
    if (newStatus) updates.status = newStatus;
    await updateTask(taskId, updates);
  };

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    reorderTask,
  };
}
```

---

## Phase 2: Core Components - Task Card & Modal (Week 1 continued)

### 2.1 TaskCard Component

**File:** `/src/components/tasks/TaskCard.tsx`

**Tasks:**
- [ ] Create TaskCard component with props interface
- [ ] Implement card layout (title, description preview, badges)
- [ ] Add priority badge with color coding
- [ ] Add status badge with color coding
- [ ] Add due date display with overdue indicator
- [ ] Add quick actions menu (edit, delete, change status)
- [ ] Add click handler to open modal
- [ ] Add responsive styles (mobile vs desktop)
- [ ] Add dark mode support
- [ ] Add hover animations (Framer Motion)

**Acceptance Criteria:**
- Card displays all task information correctly
- Priority colors match spec (Low: gray, Medium: blue, High: red)
- Status colors match spec (To Do: gray, In Progress: yellow, Done: green)
- Due date shows "Overdue" badge if past current date
- Actions menu works (edit, delete)
- Responsive on mobile and desktop
- Dark mode styles applied

**Test Notes:**
- Snapshot test for rendering
- Test click handlers (onEdit, onDelete)
- Test overdue date calculation
- Visual regression test

**Implementation Hints:**
```typescript
'use client';

import { Task } from '@/types';
import { Edit3, Trash2, Calendar, ArrowDown, Minus, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isDraggable?: boolean;
}

export default function TaskCard({ task, onEdit, onDelete, isDraggable }: TaskCardProps) {
  const priorityConfig = {
    low: { icon: ArrowDown, color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300', label: 'Low' },
    medium: { icon: Minus, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', label: 'Medium' },
    high: { icon: ArrowUp, color: 'bg-red-500/10 text-red-700 dark:text-red-300', label: 'High' },
  };

  const statusConfig = {
    todo: { color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300', label: 'To Do' },
    in_progress: { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300', label: 'In Progress' },
    done: { color: 'bg-green-500/10 text-green-700 dark:text-green-300', label: 'Done' },
  };

  const PriorityIcon = priorityConfig[task.priority].icon;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer"
      onClick={() => onEdit(task)}
    >
      {/* Header: Priority & Actions */}
      <div className="flex items-start justify-between mb-2">
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium ${priorityConfig[task.priority].color}`}>
          <PriorityIcon className="w-3 h-3" />
          <span>{priorityConfig[task.priority].label}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
            aria-label="Edit task"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {task.title}
      </h3>

      {/* Description Preview */}
      {task.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer: Due Date & Status */}
      <div className="flex items-center justify-between mt-3">
        {task.dueDate && (
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            {isOverdue && (
              <span className="ml-1 px-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded">
                Overdue
              </span>
            )}
          </div>
        )}
        <div className={`px-2 py-1 rounded-md text-xs font-medium ${statusConfig[task.status].color}`}>
          {statusConfig[task.status].label}
        </div>
      </div>
    </motion.div>
  );
}
```

---

### 2.2 TaskModal Component

**File:** `/src/components/tasks/TaskModal.tsx`

**Tasks:**
- [ ] Create TaskModal component with props interface
- [ ] Use Headless UI Dialog for modal
- [ ] Implement form with all fields (title, description, status, priority, due date, tags)
- [ ] Add form validation (title required, due date not in past)
- [ ] Add submit handler with loading state
- [ ] Add cancel/close handler
- [ ] Style modal with TailwindCSS
- [ ] Add Framer Motion animations (enter/exit)
- [ ] Add responsive layout (mobile: full screen, desktop: centered)
- [ ] Support 3 modes: create, edit, view

**Acceptance Criteria:**
- Modal opens/closes smoothly with animation
- Form validation prevents invalid submissions
- Title field is required
- Due date cannot be in past (for new tasks)
- Tags are comma-separated and limited to 5
- Loading state shows spinner on submit button
- Escape key closes modal
- Click outside closes modal
- Focus returns to trigger button on close

**Test Notes:**
- Test form validation logic
- Test submit with valid/invalid data
- Test keyboard interactions (Escape, Tab, Enter)
- Test accessibility (focus management, ARIA labels)

**Implementation Hints:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '@/types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => Promise<void>;
  task?: Task;
  mode: 'create' | 'edit' | 'view';
}

export default function TaskModal({ isOpen, onClose, onSubmit, task, mode }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setTags(task.tags?.join(', ') || '');
    } else {
      // Reset form for create mode
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setDueDate('');
      setTags('');
    }
    setErrors({});
  }, [task, isOpen]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (dueDate && mode === 'create') {
      const selectedDate = new Date(dueDate);
      if (selectedDate < new Date()) {
        newErrors.dueDate = 'Due date cannot be in the past';
      }
    }

    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagArray.length > 5) {
      newErrors.tags = 'Maximum 5 tags allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const taskData: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      await onSubmit(taskData);
      onClose();
    } catch (error) {
      console.error('Failed to submit task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30"
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Create Task' : mode === 'edit' ? 'Edit Task' : 'Task Details'}
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={mode === 'view'}
                maxLength={100}
              />
              {errors.title && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={mode === 'view'}
                maxLength={500}
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={mode === 'view'}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <div className="flex space-x-4">
                {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                  <label key={p} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={priority === p}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="text-blue-600 focus:ring-blue-500"
                      disabled={mode === 'view'}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={mode === 'view'}
              />
              {errors.dueDate && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.dueDate}</p>}
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags <span className="text-xs text-gray-500">(comma-separated, max 5)</span>
              </label>
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. frontend, urgent, bug"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={mode === 'view'}
              />
              {errors.tags && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.tags}</p>}
            </div>

            {/* Actions */}
            {mode !== 'view' && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center space-x-2"
                >
                  {loading && <span className="animate-spin">ó</span>}
                  <span>{mode === 'create' ? 'Create Task' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

---

## Phase 3: List View Implementation (Week 1-2)

### 3.1 TasksListView Component

**File:** `/src/components/tasks/TasksListView.tsx`

**Tasks:**
- [ ] Create TasksListView component
- [ ] Group tasks by status (To Do, In Progress, Done)
- [ ] Render status sections with headers
- [ ] Show task count per section
- [ ] Implement collapsible sections (optional)
- [ ] Add empty state for each section
- [ ] Map TaskCard components for each task
- [ ] Add responsive grid layout

**Acceptance Criteria:**
- Tasks grouped correctly by status
- Task count displays for each section
- Empty state shows when section has no tasks
- TaskCard components receive correct props
- Responsive on mobile (single column) and desktop (grid)

**Test Notes:**
- Test grouping logic with various task lists
- Test empty state rendering
- Visual regression test

**Implementation Hints:**
```typescript
'use client';

import { Task, TaskStatus } from '@/types';
import TaskCard from './TaskCard';
import { CheckSquare } from 'lucide-react';

interface TasksListViewProps {
  tasks: Task[];
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
}

export default function TasksListView({ tasks, onTaskEdit, onTaskDelete }: TasksListViewProps) {
  const statusConfig = {
    todo: { label: 'To Do', color: 'text-gray-700 dark:text-gray-300' },
    in_progress: { label: 'In Progress', color: 'text-yellow-700 dark:text-yellow-300' },
    done: { label: 'Done', color: 'text-green-700 dark:text-green-300' },
  };

  const groupedTasks = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  return (
    <div className="space-y-8">
      {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
        <div key={status}>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-semibold ${statusConfig[status].color}`}>
              {statusConfig[status].label}
            </h2>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-full">
              {groupedTasks[status].length}
            </span>
          </div>

          {/* Tasks Grid */}
          {groupedTasks[status].length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedTasks[status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onTaskEdit}
                  onDelete={onTaskDelete}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <CheckSquare className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No {statusConfig[status].label.toLowerCase()} tasks</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 4: Kanban View with Drag-and-Drop (Week 2)

### 4.1 Install Drag-and-Drop Library

**Tasks:**
- [ ] Install `@hello-pangea/dnd`: `npm install @hello-pangea/dnd`
- [ ] Install types: `npm install --save-dev @types/react-beautiful-dnd`
- [ ] Verify installation (check package.json)

**Acceptance Criteria:**
- Library installed successfully
- No peer dependency warnings
- Types available for TypeScript

**Test Notes:**
- Import library in a component to verify installation

---

### 4.2 TasksKanbanView Component

**File:** `/src/components/tasks/TasksKanbanView.tsx`

**Tasks:**
- [ ] Create TasksKanbanView component
- [ ] Import DragDropContext, Droppable, Draggable from @hello-pangea/dnd
- [ ] Implement 3 columns (To Do, In Progress, Done)
- [ ] Implement `onDragEnd` handler
- [ ] Calculate new order and status on drop
- [ ] Call `reorderTask` from useTasks hook
- [ ] Add optimistic updates for smooth UX
- [ ] Add visual drop indicators
- [ ] Style columns with TailwindCSS
- [ ] Add empty state per column
- [ ] Add task count badges

**Acceptance Criteria:**
- 3 columns render correctly
- Tasks can be dragged between columns
- Status updates on drop
- Order recalculates correctly
- Optimistic update shows immediate feedback
- Errors rollback UI state
- Empty state displays when column is empty
- Responsive (disable drag on mobile, show status selector instead)

**Test Notes:**
- E2E test drag-and-drop flow
- Test order calculation logic
- Test error rollback
- Test mobile fallback

**Implementation Hints:**
```typescript
'use client';

import { Task, TaskStatus } from '@/types';
import TaskCard from './TaskCard';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { CheckSquare } from 'lucide-react';

interface TasksKanbanViewProps {
  tasks: Task[];
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onReorder: (taskId: string, newStatus: TaskStatus, newOrder: number) => Promise<void>;
}

export default function TasksKanbanView({ tasks, onTaskEdit, onTaskDelete, onReorder }: TasksKanbanViewProps) {
  const statusConfig = {
    todo: { label: 'To Do', color: 'bg-gray-100 dark:bg-gray-800' },
    in_progress: { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/20' },
    done: { label: 'Done', color: 'bg-green-100 dark:bg-green-900/20' },
  };

  const groupedTasks = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside a droppable
    if (!destination) return;

    // No change
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const newStatus = destination.droppableId as TaskStatus;
    const newOrder = destination.index;

    try {
      await onReorder(draggableId, newStatus, newOrder);
    } catch (error) {
      console.error('Failed to reorder task:', error);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
          <Droppable droppableId={status} key={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`rounded-lg p-4 ${statusConfig[status].color} ${
                  snapshot.isDraggingOver ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {statusConfig[status].label}
                  </h3>
                  <span className="px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-full">
                    {groupedTasks[status].length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-3 min-h-[200px]">
                  {groupedTasks[status].length > 0 ? (
                    groupedTasks[status].map((task, index) => (
                      <Draggable draggableId={task.id} index={index} key={task.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <TaskCard
                              task={task}
                              onEdit={onTaskEdit}
                              onDelete={onTaskDelete}
                              isDraggable={true}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">No tasks</p>
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
```

---

## Phase 5: Integration into NotesView (Week 2)

### 5.1 Update NotesView Component

**File:** `/src/components/notes/NotesView.tsx`

**Tasks:**
- [ ] Import TasksListView and TasksKanbanView components
- [ ] Import TaskModal component
- [ ] Import useTasks hook
- [ ] Add 'tasks' to contentType state: `'notes' | 'canvases' | 'tasks'`
- [ ] Add Tasks tab button to tab navigation
- [ ] Add state for task modal (showTaskModal, editingTask, modalMode, viewMode)
- [ ] Add conditional rendering for tasks view
- [ ] Implement task CRUD handlers (create, update, delete)
- [ ] Implement view switcher (list/kanban)
- [ ] Add TaskModal integration

**Acceptance Criteria:**
- Tasks tab appears alongside Notes and Canvases tabs
- Clicking Tasks tab switches to tasks view
- useTasks hook fetches tasks correctly
- Create/Edit/Delete tasks works
- View switcher toggles between list and kanban
- Modal opens for create/edit
- All state management works correctly

**Test Notes:**
- E2E test full workflow (create, edit, delete tasks)
- Test view switching
- Test tab navigation

**Implementation Hints:**
```typescript
// In NotesView.tsx, add to existing state:
const [contentType, setContentType] = useState<'notes' | 'canvases' | 'tasks'>('notes');
const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
const [showTaskModal, setShowTaskModal] = useState(false);
const [editingTask, setEditingTask] = useState<Task | null>(null);
const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit' | 'view'>('create');

// Add useTasks hook
const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask, reorderTask } = useTasks(project.id);

// Add tab button
<button
  onClick={() => setContentType('tasks')}
  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
    contentType === 'tasks'
      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`}
>
  <CheckSquare className="w-4 h-4" />
  <span>Tasks</span>
  {tasks.length > 0 && (
    <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
      {tasks.length}
    </span>
  )}
</button>

// Add conditional rendering
{contentType === 'tasks' && (
  <div>
    {/* View Switcher */}
    <div className="flex items-center justify-between mb-6">
      <div className="flex space-x-2">
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          List
        </button>
        <button
          onClick={() => setViewMode('kanban')}
          className={`px-3 py-1 rounded ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          Kanban
        </button>
      </div>
      <button
        onClick={() => {
          setTaskModalMode('create');
          setEditingTask(null);
          setShowTaskModal(true);
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        + New Task
      </button>
    </div>

    {/* Views */}
    {viewMode === 'list' ? (
      <TasksListView
        tasks={tasks}
        onTaskEdit={(task) => {
          setEditingTask(task);
          setTaskModalMode('edit');
          setShowTaskModal(true);
        }}
        onTaskDelete={deleteTask}
      />
    ) : (
      <TasksKanbanView
        tasks={tasks}
        onTaskEdit={(task) => {
          setEditingTask(task);
          setTaskModalMode('edit');
          setShowTaskModal(true);
        }}
        onTaskDelete={deleteTask}
        onReorder={reorderTask}
      />
    )}
  </div>
)}

{/* Task Modal */}
<TaskModal
  isOpen={showTaskModal}
  onClose={() => {
    setShowTaskModal(false);
    setEditingTask(null);
  }}
  onSubmit={async (taskData) => {
    if (taskModalMode === 'create') {
      await createTask({ ...taskData, projectId: project.id, status: 'todo', priority: 'medium' });
    } else {
      await updateTask(editingTask!.id, taskData);
    }
  }}
  task={editingTask}
  mode={taskModalMode}
/>
```

---

## Phase 6: Testing (Week 2-3)

### 6.1 Unit Tests

**File:** `/src/hooks/__tests__/useTasks.test.ts`

**Tasks:**
- [ ] Setup Firebase Emulator for tests
- [ ] Test task creation
- [ ] Test task updates
- [ ] Test task deletion
- [ ] Test order calculation
- [ ] Test error handling

**Acceptance Criteria:**
- All tests pass
- Code coverage >80%

---

### 6.2 Component Tests

**Files:**
- `/src/components/tasks/__tests__/TaskCard.test.tsx`
- `/src/components/tasks/__tests__/TaskModal.test.tsx`

**Tasks:**
- [ ] Test TaskCard rendering
- [ ] Test TaskCard click handlers
- [ ] Test TaskModal form validation
- [ ] Test TaskModal submit

**Acceptance Criteria:**
- All tests pass
- Snapshots match

---

### 6.3 E2E Tests

**File:** `/e2e/tasks.spec.ts` (Playwright)

**Tasks:**
- [ ] Test complete task workflow (create, edit, delete)
- [ ] Test drag-and-drop in kanban view
- [ ] Test view switching
- [ ] Test mobile responsive behavior

**Acceptance Criteria:**
- All E2E tests pass
- Tests run in CI pipeline

---

## Phase 7: Polish & Optimization (Week 3)

### 7.1 Performance Optimization

**Tasks:**
- [ ] Memoize TaskCard component
- [ ] Add React.memo to expensive components
- [ ] Lazy load kanban view
- [ ] Optimize bundle size (check with `npm run build`)
- [ ] Add virtual scrolling for >100 tasks (optional)

**Acceptance Criteria:**
- Bundle size increase <50KB gzipped
- Lighthouse performance score >90
- 60fps drag operations

---

### 7.2 Accessibility Audit

**Tasks:**
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Verify ARIA labels
- [ ] Check color contrast
- [ ] Add focus indicators

**Acceptance Criteria:**
- Lighthouse accessibility score 100
- WCAG AA compliance
- Keyboard navigation works

---

### 7.3 Documentation

**Tasks:**
- [ ] Add JSDoc comments to all components
- [ ] Add usage examples in comments
- [ ] Update README with tasks feature
- [ ] Create user guide (optional)

**Acceptance Criteria:**
- All public APIs documented
- Examples provided

---

## Summary

**Total Estimated Time:** 2-3 weeks

**Phase Breakdown:**
- Phase 1 (Foundation): 2-3 days
- Phase 2 (Core Components): 2-3 days
- Phase 3 (List View): 1-2 days
- Phase 4 (Kanban): 2-3 days
- Phase 5 (Integration): 1-2 days
- Phase 6 (Testing): 2-3 days
- Phase 7 (Polish): 1-2 days

**Risk Mitigation:**
- Start with list view (simpler) before kanban
- Test early and often
- Use feature flag for safer rollout
- Defer advanced features to future iterations

**Success Metrics:**
- All acceptance criteria met
- All tests passing
- Performance targets achieved
- Accessibility compliance
- Positive user feedback
