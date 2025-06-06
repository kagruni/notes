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