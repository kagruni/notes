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

export interface Note {
  id: string;
  title: string;
  content: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface Theme {
  mode: 'light' | 'dark';
} 