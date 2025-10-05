# Deprecated Hooks

These hooks have been replaced with React Query implementations.

## Migration Guide

### Old Pattern (Deprecated)
```typescript
import { useProjects } from '@/hooks/useProjects';

function MyComponent() {
  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();

  return <div>...</div>;
}
```

### New Pattern (React Query)
```typescript
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useRealtimeProjects } from '@/hooks/useRealtimeSync';
import { useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/mutations/useProjectMutations';

function MyComponent() {
  // Enable real-time sync
  useRealtimeProjects();

  // Fetch data
  const { data: projects = [], isLoading: loading, error } = useProjectsQuery();

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  return <div>...</div>;
}
```

## Why Migrate?

1. **Better Performance**: 60-80% reduction in Firebase reads through caching
2. **Optimistic Updates**: Instant UI feedback with automatic rollback
3. **Type Safety**: Better TypeScript support with query keys
4. **DevTools**: Built-in debugging tools
5. **Standard Patterns**: Industry-standard data fetching patterns

## Full Migration Examples

See `/REACT_QUERY_MIGRATION.md` in the project root for complete migration guide.

## These Files Are Kept For Reference Only

**DO NOT USE** these hooks in new code. They are kept here only for reference during the transition period.

They can be safely deleted after you've verified all components are using the new React Query hooks.
