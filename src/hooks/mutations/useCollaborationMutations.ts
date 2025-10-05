import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionLevel } from '@/types';
import {
  shareCanvas,
  updatePermission,
  removeCollaborator,
  generateShareLink,
  revokeShareLink,
  acceptInvite
} from '@/services/collaboration';

/**
 * Hook to invite a user to a canvas by email
 * @returns Mutation for sharing canvas with email and permission level
 */
export function useShareCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      canvasId,
      email,
      permission = PermissionLevel.VIEWER
    }: {
      canvasId: string;
      email: string;
      permission?: PermissionLevel;
    }) => {
      return await shareCanvas(canvasId, email, permission);
    },
    onSuccess: (_, variables) => {
      // Invalidate collaboration queries for this canvas
      queryClient.invalidateQueries({
        queryKey: ['collaboration', variables.canvasId]
      });
    }
  });
}

/**
 * Hook to update a user's permission level for a canvas
 * @returns Mutation for updating user permission
 */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      canvasId,
      userId,
      permission
    }: {
      canvasId: string;
      userId: string;
      permission: PermissionLevel;
    }) => {
      return await updatePermission(canvasId, userId, permission);
    },
    onSuccess: (_, variables) => {
      // Invalidate collaboration queries for this canvas
      queryClient.invalidateQueries({
        queryKey: ['collaboration', variables.canvasId]
      });
    }
  });
}

/**
 * Hook to remove a collaborator from a canvas
 * @returns Mutation for removing a user from canvas
 */
export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      canvasId,
      userId
    }: {
      canvasId: string;
      userId: string;
    }) => {
      return await removeCollaborator(canvasId, userId);
    },
    onSuccess: (_, variables) => {
      // Invalidate collaboration queries for this canvas
      queryClient.invalidateQueries({
        queryKey: ['collaboration', variables.canvasId]
      });
    }
  });
}

/**
 * Hook to generate a public share link for a canvas
 * @returns Mutation for generating a shareable link with optional expiration
 */
export function useGenerateShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      canvasId,
      permission = PermissionLevel.VIEWER,
      expiresInDays = 0
    }: {
      canvasId: string;
      permission?: PermissionLevel;
      expiresInDays?: number;
    }) => {
      return await generateShareLink(canvasId, permission, expiresInDays);
    },
    onSuccess: (_, variables) => {
      // Invalidate collaboration queries for this canvas
      queryClient.invalidateQueries({
        queryKey: ['collaboration', variables.canvasId]
      });
    }
  });
}

/**
 * Hook to revoke a public share link
 * @returns Mutation for revoking the public share link
 */
export function useRevokeShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ canvasId }: { canvasId: string }) => {
      return await revokeShareLink(canvasId);
    },
    onSuccess: (_, variables) => {
      // Invalidate collaboration queries for this canvas
      queryClient.invalidateQueries({
        queryKey: ['collaboration', variables.canvasId]
      });
    }
  });
}

/**
 * Hook to accept a canvas invitation
 * @returns Mutation for accepting an invitation with a token
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteToken }: { inviteToken: string }) => {
      return await acceptInvite(inviteToken);
    },
    onSuccess: (canvas) => {
      // Invalidate collaboration queries for the canvas
      if (canvas?.id) {
        queryClient.invalidateQueries({
          queryKey: ['collaboration', canvas.id]
        });
        queryClient.invalidateQueries({
          queryKey: ['canvasAccess', canvas.id]
        });
      }
      // Also invalidate the canvas list to show the new canvas
      queryClient.invalidateQueries({
        queryKey: ['canvases']
      });
    }
  });
}
