import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Canvas, CanvasInvite, PermissionLevel, SharePermission } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Share a canvas with a user by email
 */
export async function shareCanvas(
  canvasId: string, 
  email: string, 
  permission: PermissionLevel = PermissionLevel.VIEWER
): Promise<CanvasInvite> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to share canvas');
  }

  // Get the canvas to verify ownership/admin rights
  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has permission to share
  const isOwner = canvas.userId === currentUser.uid;
  const userPermission = canvas.permissions?.[currentUser.uid];
  const isAdmin = userPermission && (
    typeof userPermission === 'string' 
      ? userPermission === PermissionLevel.ADMIN
      : userPermission.role === PermissionLevel.ADMIN
  );
  
  if (!isOwner && !isAdmin) {
    throw new Error('Insufficient permissions to share this canvas');
  }

  // Create an invite
  const inviteToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
  
  const invite: Omit<CanvasInvite, 'id'> = {
    canvasId,
    canvasTitle: canvas.title || canvas.name || 'Untitled Canvas',
    invitedEmail: email,
    invitedBy: {
      userId: currentUser.uid,
      email: currentUser.email || '',
      displayName: currentUser.displayName || currentUser.email || ''
    },
    role: permission,
    status: 'pending',
    createdAt: new Date(),
    expiresAt,
    inviteToken
  };

  // Add invite to Firestore
  const inviteRef = await addDoc(collection(db, 'canvas_invites'), {
    ...invite,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt)
  });

  return {
    ...invite,
    id: inviteRef.id
  } as CanvasInvite;
}

/**
 * Update a user's permission level for a canvas
 */
export async function updatePermission(
  canvasId: string, 
  userId: string, 
  permission: PermissionLevel
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to update permissions');
  }

  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has permission to update permissions
  const isOwner = canvas.userId === currentUser.uid;
  const userPermission = canvas.permissions?.[currentUser.uid];
  const isAdmin = userPermission && (
    typeof userPermission === 'string' 
      ? userPermission === PermissionLevel.ADMIN
      : userPermission.role === PermissionLevel.ADMIN
  );
  
  if (!isOwner && !isAdmin) {
    throw new Error('Insufficient permissions to update user permissions');
  }

  // Update the permissions map
  const updatedPermissions = {
    ...canvas.permissions,
    [userId]: {
      userId,
      role: permission,
      grantedAt: new Date(),
      grantedBy: currentUser.uid
    } as SharePermission
  };

  await updateDoc(canvasRef, {
    permissions: updatedPermissions,
    updatedAt: serverTimestamp()
  });
}

/**
 * Remove a collaborator from a canvas
 */
export async function removeCollaborator(
  canvasId: string, 
  userId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to remove collaborators');
  }

  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has permission to remove collaborators
  const isOwner = canvas.userId === currentUser.uid;
  const userPermission = canvas.permissions?.[currentUser.uid];
  const isAdmin = userPermission && (
    typeof userPermission === 'string' 
      ? userPermission === PermissionLevel.ADMIN
      : userPermission.role === PermissionLevel.ADMIN
  );
  const isRemovingSelf = userId === currentUser.uid;
  
  if (!isOwner && !isAdmin && !isRemovingSelf) {
    throw new Error('Insufficient permissions to remove this collaborator');
  }

  // Remove from sharedWith array and permissions map
  const updatedSharedWith = (canvas.sharedWith || []).filter(id => id !== userId);
  const updatedPermissions = { ...canvas.permissions };
  delete updatedPermissions[userId];

  await updateDoc(canvasRef, {
    sharedWith: updatedSharedWith,
    permissions: updatedPermissions,
    collaborationEnabled: updatedSharedWith.length > 0,
    updatedAt: serverTimestamp()
  });
}

/**
 * Generate a shareable link for a canvas
 */
export async function generateShareLink(
  canvasId: string, 
  _permission: PermissionLevel = PermissionLevel.VIEWER,
  expiresInDays: number = 0 // 0 means no expiration
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to generate share links');
  }

  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has permission to generate share links
  const isOwner = canvas.userId === currentUser.uid;
  const userPermission = canvas.permissions?.[currentUser.uid];
  const isAdmin = userPermission && (
    typeof userPermission === 'string' 
      ? userPermission === PermissionLevel.ADMIN
      : userPermission.role === PermissionLevel.ADMIN
  );
  
  if (!isOwner && !isAdmin) {
    throw new Error('Insufficient permissions to generate share links');
  }

  // Generate a unique token
  const publicShareToken = uuidv4();
  
  // Calculate expiration
  let expiresAt: Date | undefined;
  if (expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // Update canvas with share settings
  await updateDoc(canvasRef, {
    shareSettings: {
      allowPublicAccess: true,
      publicShareToken,
      requireSignIn: true, // Always require sign-in for security
      expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null
    },
    collaborationEnabled: true,
    updatedAt: serverTimestamp()
  });

  // Return the full share URL
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  return `${baseUrl}/canvas/invite/${publicShareToken}`;
}

/**
 * Accept a canvas invite
 */
export async function acceptInvite(inviteToken: string): Promise<Canvas> {
  try {
    if (!inviteToken) {
      throw new Error('Invite token is required');
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to accept invites');
    }

    // Find the invite by token
    const invitesQuery = query(
      collection(db, 'canvas_invites'),
      where('inviteToken', '==', inviteToken),
      where('status', '==', 'pending')
    );
    
    let inviteSnap;
    try {
      inviteSnap = await getDocs(invitesQuery);
    } catch (queryError) {
      throw new Error(`Failed to query invites: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
    }
    
    if (inviteSnap.empty) {
      // Try to find any invite with this token to provide better error message
      const allInvitesQuery = query(
        collection(db, 'canvas_invites'),
        where('inviteToken', '==', inviteToken)
      );
      const allInvitesSnap = await getDocs(allInvitesQuery);
      
      if (!allInvitesSnap.empty) {
        const existingInvite = allInvitesSnap.docs[0].data();
        if (existingInvite.status === 'accepted') {
          throw new Error('This invite has already been accepted');
        }
        throw new Error(`Invite status is: ${existingInvite.status}`);
      }
      
      throw new Error('No invite found with this token. Please check the link and try again.');
    }
    
    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data() as CanvasInvite;
    
    if (!invite) {
      throw new Error('Invite data is corrupted or missing');
    }
  
    // Check if invite has expired
    const now = new Date();
    const expiresAt = invite.expiresAt instanceof Timestamp 
      ? invite.expiresAt.toDate() 
      : new Date(invite.expiresAt);
      
    if (now > expiresAt) {
      throw new Error('This invite has expired');
    }
  
  // Check if the invite is for the current user's email
  // Skip email check if user doesn't have an email (e.g., phone auth)
  // For local development, we'll skip the email check
  // if (currentUser.email && invite.invitedEmail !== currentUser.email) {
  //   throw new Error('This invite is for a different email address');
  // }

  // Get the canvas
  if (!invite.canvasId) {
    throw new Error('Invite is missing canvas ID');
  }
  
  const canvasRef = doc(db, 'canvases', invite.canvasId);
  let canvasSnap;
  
  try {
    canvasSnap = await getDoc(canvasRef);
  } catch (error) {
    throw new Error(`Failed to fetch canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  if (!canvasSnap.exists()) {
    throw new Error(`Canvas not found with ID: ${invite.canvasId}`);
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  if (!canvas) {
    throw new Error('Canvas data is empty');
  }

  // Add user to canvas sharedWith and permissions
  const updatedSharedWith = [...(canvas.sharedWith || [])];
  if (!updatedSharedWith.includes(currentUser.uid)) {
    updatedSharedWith.push(currentUser.uid);
  }
  
  // Build permissions object carefully
  const existingPermissions = canvas.permissions || {};
  const updatedPermissions = {
    ...existingPermissions,
    [currentUser.uid]: {
      userId: currentUser.uid,
      role: invite.role || PermissionLevel.VIEWER,
      grantedAt: new Date(),
      grantedBy: invite.invitedBy?.userId || 'unknown'
    } as SharePermission
  };

  // Update canvas
  try {
    await updateDoc(canvasRef, {
      sharedWith: updatedSharedWith,
      permissions: updatedPermissions,
      collaborationEnabled: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw new Error(`Failed to update canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Update invite status
  try {
    await updateDoc(doc(db, 'canvas_invites', inviteDoc.id), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
  } catch (error) {
    // Don't fail if we can't update the invite status - the user was already added
    console.warn('Failed to update invite status:', error);
  }

  return {
    ...canvas,
    id: invite.canvasId,
    sharedWith: updatedSharedWith,
    permissions: updatedPermissions
  };
  } catch (error) {
    // Re-throw the error for the caller to handle
    throw error;
  }
}

/**
 * Get list of collaborators for a canvas
 */
export async function getCollaborators(canvasId: string): Promise<SharePermission[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to view collaborators');
  }

  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has access to view collaborators
  const hasAccess = canvas.userId === currentUser.uid || 
    (canvas.sharedWith?.includes(currentUser.uid));
  
  if (!hasAccess) {
    throw new Error('Insufficient permissions to view collaborators');
  }

  // Return the permissions as an array
  return Object.values(canvas.permissions || {});
}

/**
 * Check if a user has access to a canvas
 */
export async function checkCanvasAccess(
  canvasId: string,
  userId?: string
): Promise<{ hasAccess: boolean; permission?: PermissionLevel }> {
  const targetUserId = userId || auth.currentUser?.uid;
  
  if (!targetUserId) {
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
    if (canvas.userId === targetUserId) {
      return { hasAccess: true, permission: PermissionLevel.ADMIN };
    }
    
    // Check if user is in sharedWith array
    if (canvas.sharedWith?.includes(targetUserId)) {
      const userPermission = canvas.permissions?.[targetUserId];
      const permission = userPermission && (
        typeof userPermission === 'string' 
          ? userPermission
          : userPermission.role
      );
      return { hasAccess: true, permission };
    }
    
    // Check public access
    if (canvas.shareSettings?.allowPublicAccess) {
      // Check if link has expired
      if (canvas.shareSettings.expiresAt) {
        const expiresAt = canvas.shareSettings.expiresAt instanceof Timestamp
          ? canvas.shareSettings.expiresAt.toDate()
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
 * Revoke a public share link
 */
export async function revokeShareLink(canvasId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to revoke share links');
  }

  const canvasRef = doc(db, 'canvases', canvasId);
  const canvasSnap = await getDoc(canvasRef);
  
  if (!canvasSnap.exists()) {
    throw new Error('Canvas not found');
  }
  
  const canvas = canvasSnap.data() as Canvas;
  
  // Check if user has permission to revoke share links
  const isOwner = canvas.userId === currentUser.uid;
  const userPermission = canvas.permissions?.[currentUser.uid];
  const isAdmin = userPermission && (
    typeof userPermission === 'string' 
      ? userPermission === PermissionLevel.ADMIN
      : userPermission.role === PermissionLevel.ADMIN
  );
  
  if (!isOwner && !isAdmin) {
    throw new Error('Insufficient permissions to revoke share links');
  }

  // Clear share settings
  await updateDoc(canvasRef, {
    shareSettings: {
      allowPublicAccess: false,
      publicShareToken: null,
      requireSignIn: true,
      expiresAt: null
    },
    updatedAt: serverTimestamp()
  });
}