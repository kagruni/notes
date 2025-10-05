/**
 * Query Key Factory
 *
 * Centralized, type-safe query keys for React Query
 * Follows best practices: https://tkdodo.eu/blog/effective-react-query-keys
 */

export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (userId: string) => [...queryKeys.projects.lists(), userId] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },

  // Notes
  notes: {
    all: ['notes'] as const,
    lists: () => [...queryKeys.notes.all, 'list'] as const,
    list: (projectId: string) => [...queryKeys.notes.lists(), projectId] as const,
    details: () => [...queryKeys.notes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notes.details(), id] as const,
  },

  // Canvases
  canvases: {
    all: ['canvases'] as const,
    lists: () => [...queryKeys.canvases.all, 'list'] as const,
    list: (projectId?: string) => [...queryKeys.canvases.lists(), projectId ?? 'all'] as const,
    owned: (userId: string) => [...queryKeys.canvases.all, 'owned', userId] as const,
    shared: (userId: string) => [...queryKeys.canvases.all, 'shared', userId] as const,
    details: () => [...queryKeys.canvases.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.canvases.details(), id] as const,
  },

  // Tasks
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (projectId: string) => [...queryKeys.tasks.lists(), projectId] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },

  // Collaboration
  collaboration: {
    all: ['collaboration'] as const,
    canvas: (canvasId: string) => [...queryKeys.collaboration.all, 'canvas', canvasId] as const,
    collaborators: (canvasId: string) => [...queryKeys.collaboration.canvas(canvasId), 'collaborators'] as const,
    invites: (canvasId: string) => [...queryKeys.collaboration.canvas(canvasId), 'invites'] as const,
    access: (canvasId: string) => [...queryKeys.collaboration.canvas(canvasId), 'access'] as const,
  },
} as const;
