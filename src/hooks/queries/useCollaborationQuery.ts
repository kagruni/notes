import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Canvas, CanvasInvite, SharePermission, PermissionLevel } from '@/types';

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

async function fetchCollaborationData(canvasId: string): Promise<CollaborationState> {
  const currentUserId = auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error('User not authenticated');
  }

  // Fetch canvas document
  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);

  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }

  const canvas = canvasSnap.data() as Canvas;

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

  // Fetch pending invites
  const invitesQuery = query(
    collection(db, 'canvas_invites'),
    where('canvasId', '==', canvasId),
    where('status', '==', 'pending')
  );

  const invitesSnap = await getDocs(invitesQuery);
  const pendingInvites: CanvasInvite[] = [];
  invitesSnap.forEach((doc) => {
    pendingInvites.push({ id: doc.id, ...doc.data() } as CanvasInvite);
  });

  // Generate share link if public
  let shareLink: string | undefined;
  if (canvas.shareSettings?.publicShareToken) {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    shareLink = `${baseUrl}/canvas/invite/${canvas.shareSettings.publicShareToken}`;
  }

  return {
    collaborators,
    pendingInvites,
    currentUserPermission: userPermission,
    isOwner,
    isAdmin,
    canEdit,
    canShare,
    shareLink,
    isPublic: canvas.shareSettings?.allowPublicAccess || false
  };
}

/**
 * Hook to fetch collaboration data for a canvas
 * @param canvasId - The canvas ID to fetch collaboration data for
 * @returns Collaboration state including collaborators, permissions, and pending invites
 */
export function useCollaborationQuery(canvasId: string | null) {
  return useQuery({
    queryKey: ['collaboration', canvasId],
    queryFn: () => {
      if (!canvasId) {
        throw new Error('Canvas ID is required');
      }
      return fetchCollaborationData(canvasId);
    },
    enabled: !!canvasId && !!auth.currentUser,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true
  });
}

async function fetchCanvasAccess(canvasId: string): Promise<{
  hasAccess: boolean;
  permission?: PermissionLevel;
}> {
  const currentUserId = auth.currentUser?.uid;

  if (!currentUserId) {
    return { hasAccess: false };
  }

  try {
    const canvasRef = doc(db, 'canvases', canvasId);
    const canvasSnap = await getDoc(canvasRef);

    if (!canvasSnap.exists()) {
      return { hasAccess: false };
    }

    const canvas = canvasSnap.data() as Canvas;

    // Check if user is owner
    if (canvas.userId === currentUserId) {
      return { hasAccess: true, permission: PermissionLevel.ADMIN };
    }

    // Check if user is in sharedWith array
    if (canvas.sharedWith?.includes(currentUserId)) {
      const userPermission = canvas.permissions?.[currentUserId];
      const permission = userPermission?.role;
      return { hasAccess: true, permission };
    }

    // Check public access
    if (canvas.shareSettings?.allowPublicAccess) {
      // Check if link has expired
      if (canvas.shareSettings.expiresAt) {
        const expiresAt = canvas.shareSettings.expiresAt instanceof Date
          ? canvas.shareSettings.expiresAt
          : new Date(canvas.shareSettings.expiresAt);

        if (new Date() > expiresAt) {
          return { hasAccess: false };
        }
      }

      return { hasAccess: true, permission: PermissionLevel.VIEWER };
    }

    return { hasAccess: false };
  } catch (error) {
    console.error('Error checking canvas access:', error);
    return { hasAccess: false };
  }
}

/**
 * Hook to check if current user has access to a canvas
 * @param canvasId - The canvas ID to check access for
 * @returns Access status including hasAccess flag and permission level
 */
export function useCanvasAccessQuery(canvasId: string | null) {
  return useQuery({
    queryKey: ['canvasAccess', canvasId],
    queryFn: () => {
      if (!canvasId) {
        throw new Error('Canvas ID is required');
      }
      return fetchCanvasAccess(canvasId);
    },
    enabled: !!canvasId && !!auth.currentUser,
    staleTime: 60000, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false
  });
}
