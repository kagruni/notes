/**
 * Component tests for ShareModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareModal from '@/components/canvas/ShareModal';
import { collaborationService } from '@/services/collaborationService';

// Mock the collaboration service
jest.mock('@/services/collaborationService', () => ({
  collaborationService: {
    generateInviteLink: jest.fn(),
    endSession: jest.fn()
  }
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

describe('ShareModal', () => {
  const mockCanvas = {
    id: 'test-canvas-id',
    name: 'Test Canvas',
    userId: 'owner-id',
    collaborators: []
  };

  const mockOnClose = jest.fn();
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render share modal with canvas info', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Share Canvas')).toBeInTheDocument();
    expect(screen.getByText('Test Canvas')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <ShareModal
        isOpen={false}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.queryByText('Share Canvas')).not.toBeInTheDocument();
  });

  it('should generate invite link with selected role', async () => {
    const mockLink = 'https://example.com/invite/abc123';
    (collaborationService.generateInviteLink as jest.Mock).mockResolvedValue(mockLink);

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    // Select editor role
    const roleSelect = screen.getByLabelText('Permission Level');
    fireEvent.change(roleSelect, { target: { value: 'editor' } });

    // Click generate link button
    const generateButton = screen.getByText('Generate Invite Link');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(collaborationService.generateInviteLink).toHaveBeenCalledWith(
        'test-canvas-id',
        'editor',
        expect.any(Number)
      );
    });
  });

  it('should copy link to clipboard', async () => {
    const mockLink = 'https://example.com/invite/abc123';
    (collaborationService.generateInviteLink as jest.Mock).mockResolvedValue(mockLink);

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    });

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    // Generate link first
    const generateButton = screen.getByText('Generate Invite Link');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockLink)).toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockLink);
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('should display collaborators list', () => {
    const canvasWithCollaborators = {
      ...mockCanvas,
      collaborators: [
        { userId: 'user1', name: 'John Doe', email: 'john@example.com', role: 'editor' },
        { userId: 'user2', name: 'Jane Smith', email: 'jane@example.com', role: 'viewer' }
      ]
    };

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={canvasWithCollaborators}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('should remove collaborator when remove button clicked', async () => {
    const canvasWithCollaborators = {
      ...mockCanvas,
      collaborators: [
        { userId: 'user1', name: 'John Doe', email: 'john@example.com', role: 'editor' }
      ]
    };

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={canvasWithCollaborators}
        onUpdate={mockOnUpdate}
      />
    );

    // Click remove button
    const removeButton = screen.getByLabelText('Remove collaborator');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it('should set expiry time for invite links', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    const expirySelect = screen.getByLabelText('Link Expiry');
    fireEvent.change(expirySelect, { target: { value: '1' } });

    const generateButton = screen.getByText('Generate Invite Link');
    fireEvent.click(generateButton);

    expect(collaborationService.generateInviteLink).toHaveBeenCalledWith(
      'test-canvas-id',
      'viewer',
      24 * 60 * 60 * 1000 // 1 day in milliseconds
    );
  });

  it('should handle errors when generating invite link', async () => {
    const mockError = new Error('Failed to generate link');
    (collaborationService.generateInviteLink as jest.Mock).mockRejectedValue(mockError);

    // Mock console.error
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    const generateButton = screen.getByText('Generate Invite Link');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error generating invite link:', mockError);
    });

    consoleError.mockRestore();
  });

  it('should close modal when close button clicked', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={mockCanvas}
        onUpdate={mockOnUpdate}
      />
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display owner badge for canvas owner', () => {
    const canvasWithOwner = {
      ...mockCanvas,
      collaborators: [
        { userId: 'owner-id', name: 'Owner Name', email: 'owner@example.com', role: 'admin' }
      ]
    };

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        canvas={canvasWithOwner}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Owner')).toBeInTheDocument();
  });
});