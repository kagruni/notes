'use client';

import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { X } from 'lucide-react';

// Field validation constants
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Task>) => void;
  task?: Task;
}

export default function TaskModal({ isOpen, onClose, onSave, task }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Determine if we're in edit mode or create mode
  const isEditMode = !!task;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
    } else {
      // Reset form for create mode
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
    }
    setError('');
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (title.trim().length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
      return;
    }

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
      return;
    }

    // Prevent double submission
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const taskData: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
      };

      await onSave(taskData);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save task:', err);
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  // Prevent background scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Title */}
            <div>
              <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                style={{ fontSize: isMobile ? '16px' : '14px' }}
                placeholder="Enter task title"
                maxLength={MAX_TITLE_LENGTH}
                required
                aria-required="true"
                aria-invalid={error.includes('title') ? 'true' : 'false'}
                aria-describedby="title-counter title-error"
              />
              <p id="title-counter" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {title.length}/{MAX_TITLE_LENGTH} characters
              </p>
              {error.includes('title') && (
                <p id="title-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                  {error}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                style={{ fontSize: isMobile ? '16px' : '14px' }}
                placeholder="Enter task description (optional)"
                maxLength={MAX_DESCRIPTION_LENGTH}
                aria-invalid={error.includes('Description') ? 'true' : 'false'}
                aria-describedby="description-counter description-error"
              />
              <p id="description-counter" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description.length}/{MAX_DESCRIPTION_LENGTH} characters
              </p>
              {error.includes('Description') && (
                <p id="description-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                  {error}
                </p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label id="priority-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="priority-label">
                {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-4 py-2 rounded-md border-2 transition-all capitalize ${
                      priority === p
                        ? p === 'low'
                          ? 'border-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-300'
                          : p === 'medium'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    aria-label={`Set priority to ${p}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Status - only show in edit mode */}
            {isEditMode && (
              <div>
                <label id="status-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="status-label">
                  {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-4 py-2 rounded-md border-2 transition-all text-sm ${
                        status === s
                          ? s === 'todo'
                            ? 'border-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-300'
                            : s === 'in_progress'
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                            : 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      aria-label={`Set status to ${s.replace('_', ' ')}`}
                    >
                      {s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : 'Done'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
              >
                {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
