/**
 * Component tests for TaskModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskModal from './TaskModal';
import { Task } from '@/types';

describe('TaskModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const mockTask: Task = {
    id: 'task-1',
    projectId: 'project-1',
    userId: 'user-1',
    title: 'Existing Task',
    description: 'Existing description',
    status: 'in_progress',
    priority: 'high',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <TaskModal isOpen={false} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.queryByText('Create New Task')).not.toBeInTheDocument();
    });

    it('should render create mode when no task provided', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByText('Create New Task')).toBeInTheDocument();
      expect(screen.getByLabelText('Task title')).toHaveValue('');
      expect(screen.getByLabelText('Task description')).toHaveValue('');
    });

    it('should render edit mode with task data', () => {
      render(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );

      expect(screen.getByText('Edit Task')).toBeInTheDocument();
      expect(screen.getByLabelText('Task title')).toHaveValue('Existing Task');
      expect(screen.getByLabelText('Task description')).toHaveValue('Existing description');
    });

    it('should show status selector only in edit mode', () => {
      // Create mode - no status selector
      const { rerender } = render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );
      expect(screen.queryByText('Status')).not.toBeInTheDocument();

      // Edit mode - status selector visible
      rerender(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when title is empty', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Task title is required')).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show error when title exceeds 100 characters', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      const longTitle = 'a'.repeat(101);
      fireEvent.change(titleInput, { target: { value: longTitle } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title must be 100 characters or less')).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show error when description exceeds 500 characters', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } });

      const descInput = screen.getByLabelText('Task description');
      const longDesc = 'a'.repeat(501);
      fireEvent.change(descInput, { target: { value: longDesc } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Description must be 500 characters or less')).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should trim whitespace from title', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: '  Valid Title  ' } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Valid Title',
          })
        );
      });
    });
  });

  describe('Character Limits', () => {
    it('should display character count for title', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByText('0/100 characters')).toBeInTheDocument();

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'Test' } });

      expect(screen.getByText('4/100 characters')).toBeInTheDocument();
    });

    it('should display character count for description', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByText('0/500 characters')).toBeInTheDocument();

      const descInput = screen.getByLabelText('Task description');
      fireEvent.change(descInput, { target: { value: 'Test description' } });

      expect(screen.getByText('16/500 characters')).toBeInTheDocument();
    });

    it('should enforce maxLength on title input', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title') as HTMLInputElement;
      expect(titleInput.maxLength).toBe(100);
    });

    it('should enforce maxLength on description textarea', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const descInput = screen.getByLabelText('Task description') as HTMLTextAreaElement;
      expect(descInput.maxLength).toBe(500);
    });
  });

  describe('Priority Selection', () => {
    it('should default to medium priority', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const mediumButton = screen.getByLabelText('Set priority to medium');
      expect(mediumButton).toHaveClass('border-blue-500');
    });

    it('should change priority when button clicked', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const highButton = screen.getByLabelText('Set priority to high');
      fireEvent.click(highButton);

      expect(highButton).toHaveClass('border-red-500');
    });

    it('should save selected priority', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'Test Task' } });

      const lowButton = screen.getByLabelText('Set priority to low');
      fireEvent.click(lowButton);

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'low',
          })
        );
      });
    });
  });

  describe('Status Selection (Edit Mode)', () => {
    it('should show current status in edit mode', () => {
      render(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );

      const inProgressButton = screen.getByLabelText('Set status to in_progress');
      expect(inProgressButton).toHaveClass('border-yellow-500');
    });

    it('should change status when button clicked', () => {
      render(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );

      const doneButton = screen.getByLabelText('Set status to done');
      fireEvent.click(doneButton);

      expect(doneButton).toHaveClass('border-green-500');
    });

    it('should save updated status', async () => {
      render(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );

      const doneButton = screen.getByLabelText('Set status to done');
      fireEvent.click(doneButton);

      const submitButton = screen.getByText('Update');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'done',
          })
        );
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSave with correct data in create mode', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const descInput = screen.getByLabelText('Task description');
      fireEvent.change(descInput, { target: { value: 'Task description' } });

      const highButton = screen.getByLabelText('Set priority to high');
      fireEvent.click(highButton);

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          title: 'New Task',
          description: 'Task description',
          priority: 'high',
          status: 'todo',
        });
      });
    });

    it('should call onClose after successful save', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should set description to undefined when empty', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            description: undefined,
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      let resolvePromise: () => void;
      const slowSave = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolvePromise = resolve;
          })
      );

      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={slowSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      resolvePromise!();

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
      });
    });

    it('should prevent double submission', async () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const submitButton = screen.getByText('Create');

      // Click multiple times
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle save errors', async () => {
      const mockError = new Error('Failed to save');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockOnSave.mockRejectedValue(mockError);

      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });

      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Modal Controls', () => {
    it('should close when close button clicked', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close when cancel button clicked', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when opening in create mode', () => {
      const { rerender } = render(
        <TaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
        />
      );

      expect(screen.getByLabelText('Task title')).toHaveValue('Existing Task');

      // Switch to create mode
      rerender(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText('Task title')).toHaveValue('');
      expect(screen.getByLabelText('Task description')).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText('Task title')).toBeInTheDocument();
      expect(screen.getByLabelText('Task description')).toBeInTheDocument();
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('should mark required fields', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title') as HTMLInputElement;
      expect(titleInput.required).toBe(true);
    });

    it('should have accessible priority buttons', () => {
      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.getByLabelText('Set priority to low')).toBeInTheDocument();
      expect(screen.getByLabelText('Set priority to medium')).toBeInTheDocument();
      expect(screen.getByLabelText('Set priority to high')).toBeInTheDocument();
    });
  });

  describe('Mobile Optimization', () => {
    it('should set font size to 16px on mobile to prevent zoom', () => {
      // Mock mobile user agent
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
      });

      render(
        <TaskModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      const titleInput = screen.getByLabelText('Task title');
      expect(titleInput).toHaveStyle({ fontSize: '16px' });
    });
  });
});
