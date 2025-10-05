# Collaboration Query Hooks

React Query hooks for managing canvas collaboration data.

## Usage

### useCollaborationQuery

Fetches collaboration data for a canvas including collaborators, permissions, and pending invites.

```tsx
import { useCollaborationQuery } from '@/hooks/queries/useCollaborationQuery';

function CollaborationPanel({ canvasId }: { canvasId: string }) {
  const { data, isLoading, error } = useCollaborationQuery(canvasId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Collaborators ({data.collaborators.length})</h2>
      {data.collaborators.map(collab => (
        <div key={collab.userId}>
          {collab.userId} - {collab.role}
        </div>
      ))}

      <h3>Pending Invites ({data.pendingInvites.length})</h3>
      {data.pendingInvites.map(invite => (
        <div key={invite.id}>
          {invite.invitedEmail} - {invite.role}
        </div>
      ))}

      <div>
        Can Edit: {data.canEdit ? 'Yes' : 'No'}
        Can Share: {data.canShare ? 'Yes' : 'No'}
        Is Public: {data.isPublic ? 'Yes' : 'No'}
      </div>
    </div>
  );
}
```

### useCanvasAccessQuery

Checks if the current user has access to a canvas.

```tsx
import { useCanvasAccessQuery } from '@/hooks/queries/useCollaborationQuery';

function CanvasGuard({ canvasId, children }: { canvasId: string; children: React.ReactNode }) {
  const { data, isLoading } = useCanvasAccessQuery(canvasId);

  if (isLoading) return <div>Checking access...</div>;
  if (!data?.hasAccess) return <div>Access denied</div>;

  return <>{children}</>;
}
```

## Query Keys

- `['collaboration', canvasId]` - Collaboration data for a specific canvas
- `['canvasAccess', canvasId]` - Access status for a specific canvas

## Refetch Behavior

- **useCollaborationQuery**: Refetches on window focus, considers data stale after 30 seconds
- **useCanvasAccessQuery**: Does not refetch on window focus, considers data stale after 1 minute
