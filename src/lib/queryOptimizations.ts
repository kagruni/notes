import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { Project, Note, Canvas, Task } from '@/types';

/**
 * Query Optimizations
 *
 * Prefetching strategies for common navigation patterns
 * to reduce perceived loading time
 */

/**
 * Prefetch project notes when hovering over a project card
 */
export function prefetchProjectNotes(projectId: string, userId: string) {
  queryClient.prefetchQuery({
    queryKey: queryKeys.notes.list(projectId),
    staleTime: 30 * 1000, // Consider stale after 30 seconds
  });
}

/**
 * Prefetch project tasks when hovering over a project card
 */
export function prefetchProjectTasks(projectId: string, userId: string) {
  queryClient.prefetchQuery({
    queryKey: queryKeys.tasks.list(projectId),
    staleTime: 30 * 1000,
  });
}

/**
 * Prefetch canvas details when hovering over canvas card
 */
export function prefetchCanvas(canvasId: string) {
  queryClient.prefetchQuery({
    queryKey: queryKeys.canvases.detail(canvasId),
    staleTime: 60 * 1000, // Canvas data can be stale for 1 minute
  });
}

/**
 * Prefetch collaboration data when opening share modal
 */
export function prefetchCollaboration(canvasId: string) {
  queryClient.prefetchQuery({
    queryKey: queryKeys.collaboration.canvas(canvasId),
    staleTime: 30 * 1000,
  });
}

/**
 * Optimistic update helpers
 */

/**
 * Optimistically add a project to the cache
 */
export function optimisticallyAddProject(userId: string, project: Partial<Project>) {
  const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(userId));

  if (previousProjects) {
    const optimisticProject: Project = {
      id: `temp-${Date.now()}`, // Temporary ID
      title: project.title || '',
      description: project.description,
      userId,
      color: project.color || '#3B82F6',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queryClient.setQueryData<Project[]>(
      queryKeys.projects.list(userId),
      [...previousProjects, optimisticProject]
    );
  }

  return previousProjects;
}

/**
 * Optimistically update a project in the cache
 */
export function optimisticallyUpdateProject(
  userId: string,
  projectId: string,
  updates: Partial<Project>
) {
  const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(userId));

  if (previousProjects) {
    queryClient.setQueryData<Project[]>(
      queryKeys.projects.list(userId),
      previousProjects.map(p =>
        p.id === projectId
          ? { ...p, ...updates, updatedAt: new Date() }
          : p
      )
    );
  }

  return previousProjects;
}

/**
 * Optimistically delete a project from the cache
 */
export function optimisticallyDeleteProject(userId: string, projectId: string) {
  const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list(userId));

  if (previousProjects) {
    queryClient.setQueryData<Project[]>(
      queryKeys.projects.list(userId),
      previousProjects.filter(p => p.id !== projectId)
    );
  }

  return previousProjects;
}

/**
 * Optimistically add a note to the cache
 */
export function optimisticallyAddNote(projectId: string, note: Partial<Note>) {
  const previousNotes = queryClient.getQueryData<Note[]>(queryKeys.notes.list(projectId));

  if (previousNotes) {
    const optimisticNote: Note = {
      id: `temp-${Date.now()}`,
      title: note.title || '',
      content: note.content || '',
      projectId,
      userId: note.userId || '',
      tags: note.tags || [],
      images: note.images || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queryClient.setQueryData<Note[]>(
      queryKeys.notes.list(projectId),
      [optimisticNote, ...previousNotes]
    );
  }

  return previousNotes;
}

/**
 * Optimistically update a note in the cache
 */
export function optimisticallyUpdateNote(projectId: string, noteId: string, updates: Partial<Note>) {
  const previousNotes = queryClient.getQueryData<Note[]>(queryKeys.notes.list(projectId));

  if (previousNotes) {
    queryClient.setQueryData<Note[]>(
      queryKeys.notes.list(projectId),
      previousNotes.map(n =>
        n.id === noteId
          ? { ...n, ...updates, updatedAt: new Date() }
          : n
      )
    );
  }

  return previousNotes;
}

/**
 * Optimistically delete a note from the cache
 */
export function optimisticallyDeleteNote(projectId: string, noteId: string) {
  const previousNotes = queryClient.getQueryData<Note[]>(queryKeys.notes.list(projectId));

  if (previousNotes) {
    queryClient.setQueryData<Note[]>(
      queryKeys.notes.list(projectId),
      previousNotes.filter(n => n.id !== noteId)
    );
  }

  return previousNotes;
}

/**
 * Optimistically update a task in the cache
 */
export function optimisticallyUpdateTask(projectId: string, taskId: string, updates: Partial<Task>) {
  const previousTasks = queryClient.getQueryData<Task[]>(queryKeys.tasks.list(projectId));

  if (previousTasks) {
    queryClient.setQueryData<Task[]>(
      queryKeys.tasks.list(projectId),
      previousTasks.map(t =>
        t.id === taskId
          ? { ...t, ...updates, updatedAt: new Date() }
          : t
      )
    );
  }

  return previousTasks;
}

/**
 * Optimistically delete a task from the cache
 */
export function optimisticallyDeleteTask(projectId: string, taskId: string) {
  const previousTasks = queryClient.getQueryData<Task[]>(queryKeys.tasks.list(projectId));

  if (previousTasks) {
    queryClient.setQueryData<Task[]>(
      queryKeys.tasks.list(projectId),
      previousTasks.filter(t => t.id !== taskId)
    );
  }

  return previousTasks;
}

/**
 * Rollback helper for failed mutations
 */
export function rollbackQueryData<T>(queryKey: unknown[], previousData: T | undefined) {
  if (previousData !== undefined) {
    queryClient.setQueryData(queryKey, previousData);
  }
}
