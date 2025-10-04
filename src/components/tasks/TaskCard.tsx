'use client';

import React, { useState } from 'react';
import { Task } from '@/types';
import { MoreHorizontal, Edit2, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isDragging?: boolean;
}

function TaskCard({ task, onEdit, onDelete, isDragging = false }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Priority configuration with colors
  const priorityConfig = {
    low: {
      color: 'border-gray-300 dark:border-gray-600',
      badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      label: 'Low'
    },
    medium: {
      color: 'border-yellow-400 dark:border-yellow-600',
      badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      label: 'Medium'
    },
    high: {
      color: 'border-red-400 dark:border-red-600',
      badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      label: 'High'
    },
  };

  // Status configuration with colors and icons
  const statusConfig = {
    todo: {
      color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      label: 'To Do',
      icon: Circle
    },
    in_progress: {
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      label: 'In Progress',
      icon: Clock
    },
    done: {
      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      label: 'Done',
      icon: CheckCircle2
    },
  };

  const StatusIcon = statusConfig[task.status].icon;
  const descriptionId = `task-desc-${task.id}`;

  return (
    <motion.div
      role="article"
      aria-label={`Task: ${task.title}`}
      aria-describedby={task.description ? descriptionId : undefined}
      whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.2 }}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-4 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all cursor-pointer relative ${
        priorityConfig[task.priority].color
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onEdit(task)}
    >
      {/* Header with Status Badge and Actions */}
      <div className="flex items-start justify-between mb-2">
        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium ${statusConfig[task.status].color}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusConfig[task.status].label}</span>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Task actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
                  aria-label="Edit task"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this task?')) {
                      setIsDeleting(true);
                      try {
                        await onDelete(task.id);
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                    setShowMenu(false);
                  }}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
        {task.title}
      </h3>

      {/* Description Preview */}
      {task.description && (
        <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer with Priority Badge */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className={`px-2 py-1 rounded-md text-xs font-medium ${priorityConfig[task.priority].badge}`}>
          {priorityConfig[task.priority].label} Priority
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(task.updatedAt)}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </motion.div>
  );
}

export default React.memo(TaskCard);
