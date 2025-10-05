'use client';

import { useState, useCallback } from 'react';
import { Task, TaskStatus } from '@/types';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import { Plus, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTasksQuery } from '@/hooks/queries/useTasksQuery';
import { useRealtimeTasks } from '@/hooks/useRealtimeSync';
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/mutations/useTaskMutations';

interface TasksListViewProps {
  projectId: string;
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  editingTask: Task | null;
  onSetEditingTask: (task: Task | null) => void;
}

export default function TasksListView({
  projectId,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  editingTask,
  onSetEditingTask
}: TasksListViewProps) {
  // React Query hooks for tasks
  const { data: tasks = [], isLoading: loading } = useTasksQuery(projectId);
  useRealtimeTasks(projectId); // Real-time sync
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // Status configuration with colors
  const statusConfig = {
    todo: {
      label: 'To Do',
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      count: tasks.filter(t => t.status === 'todo').length
    },
    in_progress: {
      label: 'In Progress',
      color: 'text-yellow-700 dark:text-yellow-300',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      count: tasks.filter(t => t.status === 'in_progress').length
    },
    done: {
      label: 'Done',
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      count: tasks.filter(t => t.status === 'done').length
    },
  };

  // Group tasks by status
  const groupedTasks = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  const handleEditTask = (task: Task) => {
    onSetEditingTask(task);
    onOpenModal();
  };

  const handleModalClose = () => {
    onCloseModal();
    onSetEditingTask(null);
  };

  const handleModalSave = async (data: Partial<Task>) => {
    if (editingTask) {
      // Update existing task
      await updateTaskMutation.mutateAsync({
        taskId: editingTask.id,
        updates: data,
      });
    } else {
      // Create new task
      await createTaskMutation.mutateAsync({
        projectId,
        title: data.title || '',
        description: data.description,
        priority: data.priority,
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Status Sections */}
      {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h3 className={`text-xl font-semibold ${statusConfig[status].color}`}>
                {statusConfig[status].label}
              </h3>
              <span className={`px-3 py-1 ${statusConfig[status].bgColor} ${statusConfig[status].color} text-sm font-medium rounded-full`}>
                {statusConfig[status].count}
              </span>
            </div>
          </div>

          {/* Tasks Grid */}
          {groupedTasks[status].length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedTasks[status].map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <TaskCard
                    task={task}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <CheckSquare className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                No {statusConfig[status].label.toLowerCase()} tasks
              </p>
            </div>
          )}
        </motion.div>
      ))}

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        task={editingTask || undefined}
      />
    </div>
  );
}
