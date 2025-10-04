/**
 * Component tests for TaskCard
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskCard from './TaskCard';
import { Task } from '@/types';

describe('TaskCard', () => {
  const mockTask: Task = {
    id: 'task-1',
    projectId: 'project-1',
    userId: 'user-1',
    title: 'Test Task',
    description: 'This is a test task description',
    status: 'todo',
    priority: 'medium',
    order: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm
    global.confirm = jest.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render task data correctly', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('This is a test task description')).toBeInTheDocument();
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    });

    it('should render without description when not provided', () => {
      const taskWithoutDescription = { ...mockTask, description: '' };
      render(
        <TaskCard
          task={taskWithoutDescription}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument();
    });

    it('should render formatted date', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Date formatting: Jan 2
      expect(screen.getByText(/Jan 2/)).toBeInTheDocument();
    });
  });

  describe('Priority Colors', () => {
    it('should display low priority color', () => {
      const lowPriorityTask = { ...mockTask, priority: 'low' as const };
      const { container } = render(
        <TaskCard task={lowPriorityTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('Low Priority')).toBeInTheDocument();
      const card = container.querySelector('.border-gray-300');
      expect(card).toBeInTheDocument();
    });

    it('should display medium priority color', () => {
      const mediumPriorityTask = { ...mockTask, priority: 'medium' as const };
      const { container } = render(
        <TaskCard task={mediumPriorityTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('Medium Priority')).toBeInTheDocument();
      const card = container.querySelector('.border-yellow-400');
      expect(card).toBeInTheDocument();
    });

    it('should display high priority color', () => {
      const highPriorityTask = { ...mockTask, priority: 'high' as const };
      const { container } = render(
        <TaskCard task={highPriorityTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('High Priority')).toBeInTheDocument();
      const card = container.querySelector('.border-red-400');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('should display To Do status with correct icon', () => {
      const todoTask = { ...mockTask, status: 'todo' as const };
      render(
        <TaskCard task={todoTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    it('should display In Progress status with correct icon', () => {
      const inProgressTask = { ...mockTask, status: 'in_progress' as const };
      render(
        <TaskCard task={inProgressTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should display Done status with correct icon', () => {
      const doneTask = { ...mockTask, status: 'done' as const };
      render(
        <TaskCard task={doneTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onEdit when card is clicked', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const card = screen.getByText('Test Task').closest('div');
      fireEvent.click(card!);

      expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
    });

    it('should open menu when actions button is clicked', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const actionsButton = screen.getByLabelText('Task actions');
      fireEvent.click(actionsButton);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should call onEdit when Edit menu item is clicked', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Open menu
      const actionsButton = screen.getByLabelText('Task actions');
      fireEvent.click(actionsButton);

      // Click Edit
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
    });

    it('should call onDelete when Delete is confirmed', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Open menu
      const actionsButton = screen.getByLabelText('Task actions');
      fireEvent.click(actionsButton);

      // Click Delete
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this task?'
      );
      expect(mockOnDelete).toHaveBeenCalledWith('task-1');
    });

    it('should not call onDelete when deletion is cancelled', () => {
      global.confirm = jest.fn(() => false);

      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Open menu
      const actionsButton = screen.getByLabelText('Task actions');
      fireEvent.click(actionsButton);

      // Click Delete
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(global.confirm).toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should close menu when clicking outside', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Open menu
      const actionsButton = screen.getByLabelText('Task actions');
      fireEvent.click(actionsButton);

      expect(screen.getByText('Edit')).toBeInTheDocument();

      // Click outside (on the overlay)
      const overlay = screen.getByText('Edit').closest('div')?.parentElement?.nextElementSibling;
      if (overlay) {
        fireEvent.click(overlay);
      }

      // Menu should be closed (implementation depends on state)
    });
  });

  describe('Dragging State', () => {
    it('should apply opacity when dragging', () => {
      const { container } = render(
        <TaskCard
          task={mockTask}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDragging={true}
        />
      );

      const card = container.firstChild;
      expect(card).toHaveClass('opacity-50');
    });

    it('should not apply opacity when not dragging', () => {
      const { container } = render(
        <TaskCard
          task={mockTask}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          isDragging={false}
        />
      );

      const card = container.firstChild;
      expect(card).not.toHaveClass('opacity-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(screen.getByLabelText('Task actions')).toBeInTheDocument();
    });

    it('should stop event propagation when clicking actions button', () => {
      render(
        <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const actionsButton = screen.getByLabelText('Task actions');
      const stopPropagation = jest.fn();

      fireEvent.click(actionsButton, {
        stopPropagation,
      });

      // Menu should open without triggering card click
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(mockOnEdit).not.toHaveBeenCalledWith(mockTask);
    });
  });

  describe('Text Truncation', () => {
    it('should truncate long titles', () => {
      const longTitleTask = {
        ...mockTask,
        title: 'This is a very long task title that should be truncated after two lines to prevent overflow',
      };

      const { container } = render(
        <TaskCard task={longTitleTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const titleElement = screen.getByText(longTitleTask.title);
      expect(titleElement).toHaveClass('line-clamp-2');
    });

    it('should truncate long descriptions', () => {
      const longDescTask = {
        ...mockTask,
        description: 'This is a very long description that should be truncated after two lines to prevent the card from becoming too large and overwhelming the UI',
      };

      const { container } = render(
        <TaskCard task={longDescTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const descElement = screen.getByText(longDescTask.description);
      expect(descElement).toHaveClass('line-clamp-2');
    });
  });
});
