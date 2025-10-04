'use client';

import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';

interface TasksKanbanViewProps {
  projectId: string;
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  editingTask: Task | null;
  onSetEditingTask: (task: Task | null) => void;
}

const COLUMN_CONFIG = {
  todo: {
    id: 'todo' as TaskStatus,
    title: 'To Do',
    color: 'bg-gray-50 dark:bg-gray-900/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
  in_progress: {
    id: 'in_progress' as TaskStatus,
    title: 'In Progress',
    color: 'bg-yellow-50 dark:bg-yellow-900/10',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
  },
  done: {
    id: 'done' as TaskStatus,
    title: 'Done',
    color: 'bg-green-50 dark:bg-green-900/10',
    borderColor: 'border-green-200 dark:border-green-700',
  },
};

export default function TasksKanbanView({
  projectId,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  editingTask,
  onSetEditingTask
}: TasksKanbanViewProps) {
  const { tasks, loading, updateTask, deleteTask } = useTasks(projectId);
  const [isDragDisabled, setIsDragDisabled] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Check if mobile (disable drag on mobile)
  useEffect(() => {
    const checkMobile = () => {
      setIsDragDisabled(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // No movement
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as TaskStatus;
    const taskId = draggableId;

    // Find the task
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Only update if status changed
    if (task.status !== newStatus) {
      try {
        // Optimistic update would happen via Firestore real-time listener
        await updateTask(taskId, { status: newStatus });
      } catch (error) {
        console.error('Failed to update task status:', error);
        // Error handling is done in useTasks hook (toast notification)
      }
    }
  };

  const handleEdit = (task: Task) => {
    onSetEditingTask(task);
    onOpenModal();
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleCloseModal = () => {
    onCloseModal();
    onSetEditingTask(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 flex-1 overflow-auto">
          {Object.values(COLUMN_CONFIG).map((column) => (
            <div
              key={column.id}
              className="flex flex-col min-h-[400px] md:min-h-0"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 id={`${column.id}-heading`} className="text-lg font-semibold text-gray-900 dark:text-white">
                  {column.title}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                  {tasksByStatus[column.id].length}
                </span>
              </div>

              {/* Droppable Column */}
              <Droppable droppableId={column.id} isDropDisabled={isDragDisabled}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    role="region"
                    aria-labelledby={`${column.id}-heading`}
                    aria-label={`${column.title} column`}
                    className={`flex-1 rounded-lg border-2 p-3 transition-colors min-h-[200px] ${
                      column.color
                    } ${column.borderColor} ${
                      snapshot.isDraggingOver
                        ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : ''
                    }`}
                  >
                    <div className="space-y-3">
                      {tasksByStatus[column.id].length === 0 ? (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                          <p className="text-sm">No tasks</p>
                        </div>
                      ) : (
                        <>
                          {/* Screen reader hint for drag and drop */}
                          {!isDragDisabled && (
                            <div className="sr-only" aria-live="polite">
                              Use arrow keys to move tasks between columns. Press space or enter to pick up or drop a task.
                            </div>
                          )}
                          {tasksByStatus[column.id].map((task, index) => (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              isDragDisabled={isDragDisabled}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    cursor: isDragDisabled ? 'pointer' : 'grab',
                                  }}
                                >
                                  <TaskCard
                                    task={task}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    isDragging={snapshot.isDragging}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Mobile: Show hint if drag disabled */}
              {isDragDisabled && tasksByStatus[column.id].length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                  Tap to edit task status
                </p>
              )}
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        projectId={projectId}
        task={editingTask}
      />
    </div>
  );
}
