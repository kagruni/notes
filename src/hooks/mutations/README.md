# Collaboration Mutation Hooks

React Query mutation hooks for managing canvas collaboration operations.

## Usage

### useShareCanvas

Invite a user to a canvas by email.

```tsx
import { useShareCanvas } from '@/hooks/mutations/useCollaborationMutations';
import { PermissionLevel } from '@/types';

function ShareButton({ canvasId }: { canvasId: string }) {
  const shareCanvas = useShareCanvas();

  const handleShare = async () => {
    try {
      await shareCanvas.mutateAsync({
        canvasId,
        email: 'user@example.com',
        permission: PermissionLevel.EDITOR
      });
      console.log('Invite sent successfully');
    } catch (error) {
      console.error('Failed to send invite:', error);
    }
  };

  return (
    <button onClick={handleShare} disabled={shareCanvas.isPending}>
      {shareCanvas.isPending ? 'Sending...' : 'Share Canvas'}
    </button>
  );
}
```

### useUpdatePermission

Update a user's permission level.

```tsx
import { useUpdatePermission } from '@/hooks/mutations/useCollaborationMutations';
import { PermissionLevel } from '@/types';

function PermissionEditor({ canvasId, userId }: { canvasId: string; userId: string }) {
  const updatePermission = useUpdatePermission();

  const handleUpdate = async (permission: PermissionLevel) => {
    try {
      await updatePermission.mutateAsync({ canvasId, userId, permission });
      console.log('Permission updated');
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  return (
    <select onChange={(e) => handleUpdate(e.target.value as PermissionLevel)}>
      <option value={PermissionLevel.VIEWER}>Viewer</option>
      <option value={PermissionLevel.EDITOR}>Editor</option>
      <option value={PermissionLevel.ADMIN}>Admin</option>
    </select>
  );
}
```

### useRemoveCollaborator

Remove a user from a canvas.

```tsx
import { useRemoveCollaborator } from '@/hooks/mutations/useCollaborationMutations';

function RemoveButton({ canvasId, userId }: { canvasId: string; userId: string }) {
  const removeCollaborator = useRemoveCollaborator();

  const handleRemove = async () => {
    try {
      await removeCollaborator.mutateAsync({ canvasId, userId });
      console.log('User removed');
    } catch (error) {
      console.error('Failed to remove user:', error);
    }
  };

  return (
    <button onClick={handleRemove} disabled={removeCollaborator.isPending}>
      Remove
    </button>
  );
}
```

### useGenerateShareLink

Generate a public share link.

```tsx
import { useGenerateShareLink } from '@/hooks/mutations/useCollaborationMutations';
import { PermissionLevel } from '@/types';

function ShareLinkGenerator({ canvasId }: { canvasId: string }) {
  const generateLink = useGenerateShareLink();

  const handleGenerate = async () => {
    try {
      const link = await generateLink.mutateAsync({
        canvasId,
        permission: PermissionLevel.VIEWER,
        expiresInDays: 7 // Link expires in 7 days
      });
      console.log('Share link:', link);
      navigator.clipboard.writeText(link);
    } catch (error) {
      console.error('Failed to generate link:', error);
    }
  };

  return (
    <button onClick={handleGenerate} disabled={generateLink.isPending}>
      Generate Share Link
    </button>
  );
}
```

### useRevokeShareLink

Revoke a public share link.

```tsx
import { useRevokeShareLink } from '@/hooks/mutations/useCollaborationMutations';

function RevokeButton({ canvasId }: { canvasId: string }) {
  const revokeLink = useRevokeShareLink();

  const handleRevoke = async () => {
    try {
      await revokeLink.mutateAsync({ canvasId });
      console.log('Share link revoked');
    } catch (error) {
      console.error('Failed to revoke link:', error);
    }
  };

  return (
    <button onClick={handleRevoke} disabled={revokeLink.isPending}>
      Revoke Share Link
    </button>
  );
}
```

### useAcceptInvite

Accept a canvas invitation.

```tsx
import { useAcceptInvite } from '@/hooks/mutations/useCollaborationMutations';

function InviteAcceptButton({ inviteToken }: { inviteToken: string }) {
  const acceptInvite = useAcceptInvite();

  const handleAccept = async () => {
    try {
      const canvas = await acceptInvite.mutateAsync({ inviteToken });
      console.log('Invite accepted, canvas:', canvas);
      // Navigate to canvas
      window.location.href = `/canvas/${canvas.id}`;
    } catch (error) {
      console.error('Failed to accept invite:', error);
    }
  };

  return (
    <button onClick={handleAccept} disabled={acceptInvite.isPending}>
      {acceptInvite.isPending ? 'Accepting...' : 'Accept Invitation'}
    </button>
  );
}
```

## Query Invalidation

All mutations automatically invalidate relevant queries after successful execution:

- `useShareCanvas` → Invalidates `['collaboration', canvasId]`
- `useUpdatePermission` → Invalidates `['collaboration', canvasId]`
- `useRemoveCollaborator` → Invalidates `['collaboration', canvasId]`
- `useGenerateShareLink` → Invalidates `['collaboration', canvasId]`
- `useRevokeShareLink` → Invalidates `['collaboration', canvasId]`
- `useAcceptInvite` → Invalidates `['collaboration', canvasId]`, `['canvasAccess', canvasId]`, and `['canvases']`
