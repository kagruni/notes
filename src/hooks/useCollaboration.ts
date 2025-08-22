import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Canvas, SharePermission, PermissionLevel, CanvasInvite } from '@/types';
import {
  shareCanvas,
  updatePermission,
  removeCollaborator,
  generateShareLink,
  acceptInvite,
  getCollaborators,
  checkCanvasAccess,
  revokeShareLink
} from '@/services/collaboration';

interface CollaborationState {
  collaborators: SharePermission[];
  pendingInvites: CanvasInvite[];
  currentUserPermission?: PermissionLevel;
  isOwner: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canShare: boolean;
  shareLink?: string;
  isPublic: boolean;
}

interface UseCollaborationReturn extends CollaborationState {
  loading: boolean;
  error: string | null;
  inviteUser: (email: string, permission?: PermissionLevel) => Promise<void>;
  updateUserPermission: (userId: string, permission: PermissionLevel) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  generateLink: (permission?: PermissionLevel, expiresInDays?: number) => Promise<string>;
  revokeLink: () => Promise<void>;
  acceptCanvasInvite: (token: string) => Promise<void>;
  refreshCollaborators: () => Promise<void>;
}

export function useCollaboration(canvasId: string | null): UseCollaborationReturn {
  const [state, setState] = useState<CollaborationState>({
    collaborators: [],
    pendingInvites: [],
    isOwner: false,
    isAdmin: false,
    canEdit: false,
    canShare: false,
    isPublic: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load canvas and check permissions
  useEffect(() => {
    if (!canvasId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to canvas changes
    const canvasRef = doc(db, 'canvases', canvasId);
    const unsubscribeCanvas = onSnapshot(
      canvasRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setError('Canvas not found');
          setLoading(false);
          return;
        }

        const canvas = snapshot.data() as Canvas;
        const currentUserId = auth.currentUser?.uid;

        if (!currentUserId) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        // Determine user permissions
        const isOwner = canvas.userId === currentUserId;
        const userPermission = canvas.permissions?.[currentUserId]?.role;
        const isAdmin = isOwner || userPermission === PermissionLevel.ADMIN;
        const canEdit = isOwner || 
          userPermission === PermissionLevel.EDITOR || 
          userPermission === PermissionLevel.ADMIN;
        const canShare = isOwner || userPermission === PermissionLevel.ADMIN;

        // Get collaborators
        const collaborators = Object.values(canvas.permissions || {});

        // Generate share link if public
        let shareLink: string | undefined;
        if (canvas.shareSettings?.publicShareToken) {
          const baseUrl = window.location.origin;
          shareLink = `${baseUrl}/canvas/invite/${canvas.shareSettings.publicShareToken}`;
        }

        setState({
          collaborators,
          pendingInvites: [], // Will be loaded separately
          currentUserPermission: userPermission,
          isOwner,
          isAdmin,
          canEdit,
          canShare,
          shareLink,
          isPublic: canvas.shareSettings?.allowPublicAccess || false
        });

        setLoading(false);
      },
      (err) => {
        console.error('Error loading canvas:', err);
        setError('Failed to load canvas data');
        setLoading(false);
      }
    );

    // Subscribe to pending invites
    const invitesQuery = query(
      collection(db, 'canvas_invites'),
      where('canvasId', '==', canvasId),
      where('status', '==', 'pending')
    );

    const unsubscribeInvites = onSnapshot(
      invitesQuery,
      (snapshot) => {
        const invites: CanvasInvite[] = [];
        snapshot.forEach((doc) => {
          invites.push({ id: doc.id, ...doc.data() } as CanvasInvite);
        });
        setState(prev => ({ ...prev, pendingInvites: invites }));
      },
      (err) => {
        console.error('Error loading invites:', err);
      }
    );

    return () => {
      unsubscribeCanvas();
      unsubscribeInvites();
    };
  }, [canvasId]);

  // Invite a user by email
  const inviteUser = useCallback(async (email: string, permission: PermissionLevel = PermissionLevel.VIEWER) => {
    if (!canvasId) {
      throw new Error('No canvas selected');
    }
    if (!state.canShare) {
      throw new Error('You do not have permission to share this canvas');
    }

    try {
      await shareCanvas(canvasId, email, permission);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite user';
      setError(message);
      throw err;
    }
  }, [canvasId, state.canShare]);

  // Update user permission
  const updateUserPermission = useCallback(async (userId: string, permission: PermissionLevel) => {
    if (!canvasId) {
      throw new Error('No canvas selected');
    }
    if (!state.canShare) {
      throw new Error('You do not have permission to update permissions');
    }

    try {
      await updatePermission(canvasId, userId, permission);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update permission';
      setError(message);
      throw err;
    }
  }, [canvasId, state.canShare]);

  // Remove a user
  const removeUser = useCallback(async (userId: string) => {
    if (!canvasId) {
      throw new Error('No canvas selected');
    }
    
    const isSelf = userId === auth.currentUser?.uid;
    if (!state.canShare && !isSelf) {
      throw new Error('You do not have permission to remove users');
    }

    try {
      await removeCollaborator(canvasId, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove user';
      setError(message);
      throw err;
    }
  }, [canvasId, state.canShare]);

  // Generate a share link
  const generateLink = useCallback(async (
    permission: PermissionLevel = PermissionLevel.VIEWER, 
    expiresInDays: number = 0
  ): Promise<string> => {
    if (!canvasId) {
      throw new Error('No canvas selected');
    }
    if (!state.canShare) {
      throw new Error('You do not have permission to generate share links');
    }

    try {
      const link = await generateShareLink(canvasId, permission, expiresInDays);
      setState(prev => ({ ...prev, shareLink: link, isPublic: true }));
      return link;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate share link';
      setError(message);
      throw err;
    }
  }, [canvasId, state.canShare]);

  // Revoke share link
  const revokeLink = useCallback(async () => {
    if (!canvasId) {
      throw new Error('No canvas selected');
    }
    if (!state.canShare) {
      throw new Error('You do not have permission to revoke share links');
    }

    try {
      await revokeShareLink(canvasId);
      setState(prev => ({ ...prev, shareLink: undefined, isPublic: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke share link';
      setError(message);
      throw err;
    }
  }, [canvasId, state.canShare]);

  // Accept an invite
  const acceptCanvasInvite = useCallback(async (token: string) => {
    try {
      await acceptInvite(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      setError(message);
      throw err;
    }
  }, []);

  // Refresh collaborators list
  const refreshCollaborators = useCallback(async () => {
    if (!canvasId) return;

    try {
      const collaborators = await getCollaborators(canvasId);
      setState(prev => ({ ...prev, collaborators }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh collaborators';
      setError(message);
    }
  }, [canvasId]);

  return {
    ...state,
    loading,
    error,
    inviteUser,
    updateUserPermission,
    removeUser,
    generateLink,
    revokeLink,
    acceptCanvasInvite,
    refreshCollaborators
  };
}

// Hook to check if current user has access to a canvas
export function useCanvasAccess(canvasId: string | null): {
  hasAccess: boolean;
  permission?: PermissionLevel;
  loading: boolean;
} {
  const [hasAccess, setHasAccess] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasId || !auth.currentUser) {
      setLoading(false);
      setHasAccess(false);
      return;
    }

    checkCanvasAccess(canvasId)
      .then(({ hasAccess, permission }) => {
        setHasAccess(hasAccess);
        setPermission(permission);
      })
      .catch((err) => {
        console.error('Error checking canvas access:', err);
        setHasAccess(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [canvasId]);

  return { hasAccess, permission, loading };
}