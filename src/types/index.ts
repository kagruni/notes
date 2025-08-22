export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
}

export interface NoteImage {
  id: string;
  url?: string; // Firebase Storage URL (preferred)
  data?: string; // base64 encoded image data (fallback for backward compatibility)
  type: string; // MIME type (image/jpeg, image/png, etc.)
  name: string; // original filename or generated name
  size: number; // file size in bytes
  storagePath?: string; // Firebase Storage path for deletion
  createdAt: Date;
  capturedAt?: Date; // When the photo was originally taken (from EXIF)
  exifData?: {
    dateTime?: string;
    dateTimeOriginal?: string;
    camera?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

export enum PermissionLevel {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin'
}

export interface SharePermission {
  userId: string;
  role: PermissionLevel;
  grantedAt: Date;
  grantedBy: string;
}

export interface CanvasInvite {
  id: string;
  canvasId: string;
  canvasTitle: string;
  invitedEmail: string;
  invitedBy: {
    userId: string;
    email: string;
    displayName: string;
  };
  role: PermissionLevel;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  inviteToken: string;
}

// Excalidraw element type - minimal type definition
export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface Canvas {
  id: string;
  name: string; // Changed from title to name for consistency
  title?: string; // Keep for backward compatibility
  elements?: ExcalidrawElement[]; // Excalidraw elements
  appState?: Record<string, unknown>; // Excalidraw app state
  files?: Record<string, unknown>; // Excalidraw files (for images in drawings)
  content?: any; // Generic content field for canvas data
  projectId?: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastModified?: any; // Firebase timestamp
  thumbnail?: string; // Optional thumbnail for preview
  version?: number; // Version for conflict resolution
  
  // Collaboration fields
  collaborationEnabled?: boolean;
  collaborators?: {
    [userId: string]: Collaborator;
  };
  activeUsers?: {
    [userId: string]: Collaborator & { joinedAt?: any };
  };
  chatMessages?: ChatMessage[];
  sharedWith?: string[]; // Array of user IDs with access
  shareSettings?: {
    allowPublicAccess: boolean;
    publicShareToken?: string;
    requireSignIn: boolean;
    expiresAt?: Date;
  };
  permissions?: {
    [userId: string]: SharePermission;
  };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  images?: NoteImage[];
}

export interface Theme {
  mode: 'light' | 'dark';
}

// Collaboration types
export interface Collaborator {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  lastSeen: number;
  color: string;
  cursor: { x: number; y: number } | null;
  role?: 'viewer' | 'editor' | 'admin';
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
}

export interface CollaborationState {
  isConnected: boolean;
  activeUsers: Collaborator[];
  version: number;
} 