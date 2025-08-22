# Canvas Real-Time Collaboration Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to implement real-time collaborative editing for canvases, similar to Figma's multiplayer experience. Users will be able to share canvases, see each other's cursors in real-time, and simultaneously edit the same canvas with automatic conflict resolution.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Technical Architecture](#technical-architecture)
3. [Phase 1: Canvas Sharing System](#phase-1-canvas-sharing-system)
4. [Phase 2: Real-Time Collaboration](#phase-2-real-time-collaboration)
5. [Implementation Details](#implementation-details)
6. [Performance Optimization](#performance-optimization)
7. [Security & Privacy](#security--privacy)
8. [Testing Strategy](#testing-strategy)
9. [Rollout Plan](#rollout-plan)
10. [Future Enhancements](#future-enhancements)

---

## Feature Overview

### Core Capabilities

1. **Canvas Sharing**
   - Share canvases with specific users via email
   - Set permission levels (view-only, edit, admin)
   - Revoke access at any time
   - Share via public link (optional)

2. **Real-Time Presence**
   - See who's currently viewing/editing
   - Live cursor tracking with user labels
   - User avatar indicators
   - "Following" mode to track another user's viewport

3. **Simultaneous Editing**
   - Multiple users can draw/edit at the same time
   - Automatic conflict resolution
   - Change attribution (who made what change)
   - Undo/redo awareness across users

4. **Communication Features**
   - Cursor chat (quick messages at cursor position)
   - Comments on specific elements
   - Activity feed showing recent changes

### User Stories

- **As a designer**, I want to share my canvas with teammates so we can brainstorm together
- **As a team member**, I want to see my colleague's cursor so I know what they're working on
- **As a manager**, I want to control who can edit vs. view my canvases
- **As a collaborator**, I want my changes to appear instantly for others without conflicts

---

## Technical Architecture

### Technology Stack

```yaml
Frontend:
  - React 18 + Next.js 15 (existing)
  - Excalidraw (existing canvas library)
  - Firebase Realtime Database (new - for real-time sync)
  - Firebase Firestore (existing - for persistent data)
  - WebSocket fallback via Firebase

Backend:
  - Firebase Functions (for server-side logic)
  - Firebase Realtime Database (for presence & live data)
  - Firebase Firestore (for canvas metadata & permissions)
  - Firebase Auth (existing - for user management)

Infrastructure:
  - CDN for cursor/avatar assets
  - Firebase Hosting (existing)
  - Analytics for collaboration metrics
```

### Data Architecture

```typescript
// Firestore Collections (Persistent Storage)
interface CanvasDocument {
  id: string;
  title: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Sharing metadata
  sharedWith: SharePermission[];
  isPublic: boolean;
  publicShareId?: string;
  
  // Collaboration settings
  collaborationEnabled: boolean;
  maxSimultaneousUsers?: number;
  allowComments: boolean;
  allowCursorChat: boolean;
}

interface SharePermission {
  userId?: string;        // null if invite pending
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  sharedAt: Date;
  sharedBy: string;
  acceptedAt?: Date;
  lastAccessedAt?: Date;
}

// Realtime Database Structure (Live Collaboration)
{
  "sessions": {
    "[canvasId]": {
      "metadata": {
        "started": 1234567890,
        "version": 1,
        "locked": false
      },
      "presence": {
        "[userId]": {
          "user": {
            "id": "user123",
            "email": "john@example.com",
            "displayName": "John Doe",
            "photoURL": "https://...",
            "color": "#FF5733"
          },
          "cursor": {
            "x": 450,
            "y": 320,
            "isActive": true
          },
          "viewport": {
            "x": 0,
            "y": 0,
            "zoom": 1.0
          },
          "state": {
            "isDrawing": false,
            "selectedElements": ["elem1", "elem2"],
            "tool": "selection"
          },
          "lastSeen": 1234567890
        }
      },
      "operations": {
        "[operationId]": {
          "id": "op_123",
          "userId": "user123",
          "timestamp": 1234567890,
          "type": "element-update",
          "data": {
            "elementId": "rect_abc",
            "changes": { /* ... */ }
          },
          "vector": [5, 3] // For OT
        }
      },
      "elements": {
        // Snapshot of current state for new joiners
        "snapshot": {
          "elements": [ /* Excalidraw elements */ ],
          "version": 42,
          "lastUpdated": 1234567890
        }
      },
      "chat": {
        "[messageId]": {
          "userId": "user123",
          "message": "Check this out!",
          "position": { "x": 100, "y": 200 },
          "timestamp": 1234567890
        }
      }
    }
  }
}
```

---

## Phase 1: Canvas Sharing System

### 1.1 Database Schema Updates

```typescript
// Update Canvas type
interface Canvas {
  // ... existing fields
  
  // Sharing fields
  sharedWith?: string[];          // User IDs with access
  shareSettings?: {
    allowPublicAccess: boolean;
    publicShareToken?: string;
    requireSignIn: boolean;
    expiresAt?: Date;
  };
  
  permissions?: {
    [userId: string]: {
      role: 'viewer' | 'editor' | 'admin';
      grantedAt: Date;
      grantedBy: string;
      customPermissions?: {
        canDelete: boolean;
        canShare: boolean;
        canExport: boolean;
        canComment: boolean;
      };
    };
  };
}

// New collection: canvas_invites
interface CanvasInvite {
  id: string;
  canvasId: string;
  canvasTitle: string;
  invitedEmail: string;
  invitedBy: {
    userId: string;
    email: string;
    displayName: string;
  };
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  inviteToken: string; // Secure random token
}
```

### 1.2 Sharing UI Components

```typescript
// ShareModal Component Structure
<ShareModal canvasId={canvasId}>
  <TabView>
    <Tab name="People">
      <InviteByEmail />
      <CurrentCollaborators />
      <PendingInvites />
    </Tab>
    <Tab name="Link">
      <PublicLinkGenerator />
      <LinkSettings />
      <CopyLinkButton />
    </Tab>
    <Tab name="Settings">
      <DefaultPermissions />
      <CollaborationSettings />
      <ExpirationSettings />
    </Tab>
  </TabView>
</ShareModal>
```

### 1.3 Firebase Security Rules

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Canvas access rules
    match /canvases/{canvasId} {
      allow read: if 
        request.auth != null && (
          resource.data.ownerId == request.auth.uid ||
          request.auth.uid in resource.data.sharedWith ||
          resource.data.shareSettings.allowPublicAccess == true
        );
      
      allow update: if 
        request.auth != null && (
          resource.data.ownerId == request.auth.uid ||
          (
            request.auth.uid in resource.data.sharedWith &&
            resource.data.permissions[request.auth.uid].role in ['editor', 'admin']
          )
        );
      
      allow delete: if 
        request.auth != null && 
        resource.data.ownerId == request.auth.uid;
    }
    
    // Canvas invites
    match /canvas_invites/{inviteId} {
      allow read: if 
        request.auth != null && (
          request.auth.email == resource.data.invitedEmail ||
          request.auth.uid == resource.data.invitedBy.userId
        );
      
      allow create: if 
        request.auth != null &&
        exists(/databases/$(database)/documents/canvases/$(request.resource.data.canvasId)) &&
        get(/databases/$(database)/documents/canvases/$(request.resource.data.canvasId)).data.ownerId == request.auth.uid;
      
      allow update: if 
        request.auth != null &&
        request.auth.email == resource.data.invitedEmail &&
        request.resource.data.status in ['accepted', 'declined'];
    }
  }
}
```

### 1.4 Sharing Implementation Steps

1. **Create Share Button in Canvas Editor**
   ```typescript
   // In CanvasEditor.tsx
   <ShareButton onClick={() => setShareModalOpen(true)}>
     <ShareIcon />
     {sharedUsers.length > 0 && <Badge>{sharedUsers.length}</Badge>}
   </ShareButton>
   ```

2. **Implement Email Invitation System**
   ```typescript
   const inviteUser = async (email: string, role: 'viewer' | 'editor') => {
     // Check if user exists in system
     const userQuery = await firestore
       .collection('users')
       .where('email', '==', email)
       .get();
     
     if (!userQuery.empty) {
       // User exists - add directly to canvas
       await firestore
         .collection('canvases')
         .doc(canvasId)
         .update({
           sharedWith: arrayUnion(userQuery.docs[0].id),
           [`permissions.${userQuery.docs[0].id}`]: {
             role,
             grantedAt: new Date(),
             grantedBy: currentUser.id
           }
         });
     } else {
       // User doesn't exist - create invite
       const invite = {
         canvasId,
         canvasTitle,
         invitedEmail: email,
         invitedBy: {
           userId: currentUser.id,
           email: currentUser.email,
           displayName: currentUser.displayName
         },
         role,
         status: 'pending',
         createdAt: new Date(),
         expiresAt: addDays(new Date(), 7),
         inviteToken: generateSecureToken()
       };
       
       await firestore.collection('canvas_invites').add(invite);
       
       // Send email notification
       await sendInviteEmail(email, invite);
     }
   };
   ```

3. **Update Canvas Queries**
   ```typescript
   // Get all canvases (owned + shared)
   const getAccessibleCanvases = async (userId: string) => {
     const owned = await firestore
       .collection('canvases')
       .where('ownerId', '==', userId)
       .get();
     
     const shared = await firestore
       .collection('canvases')
       .where('sharedWith', 'array-contains', userId)
       .get();
     
     return [...owned.docs, ...shared.docs].map(doc => ({
       id: doc.id,
       ...doc.data(),
       isOwner: doc.data().ownerId === userId,
       myRole: doc.data().permissions?.[userId]?.role || 'owner'
     }));
   };
   ```

---

## Phase 2: Real-Time Collaboration

### 2.1 Presence System Implementation

```typescript
// Presence Manager Class
class PresenceManager {
  private canvasId: string;
  private userId: string;
  private presenceRef: DatabaseReference;
  private othersRef: DatabaseReference;
  private listeners: Map<string, (data: any) => void> = new Map();
  private userColor: string;
  
  constructor(canvasId: string, userId: string, userInfo: UserInfo) {
    this.canvasId = canvasId;
    this.userId = userId;
    this.userColor = this.generateUserColor(userId);
    
    // Initialize Firebase Realtime Database references
    this.presenceRef = firebase.database()
      .ref(`sessions/${canvasId}/presence/${userId}`);
    
    this.othersRef = firebase.database()
      .ref(`sessions/${canvasId}/presence`);
    
    this.initialize(userInfo);
  }
  
  private async initialize(userInfo: UserInfo) {
    // Set initial presence
    await this.presenceRef.set({
      user: {
        id: this.userId,
        email: userInfo.email,
        displayName: userInfo.displayName,
        photoURL: userInfo.photoURL,
        color: this.userColor
      },
      cursor: { x: 0, y: 0, isActive: false },
      viewport: { x: 0, y: 0, zoom: 1 },
      state: {
        isDrawing: false,
        selectedElements: [],
        tool: 'selection'
      },
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Remove presence on disconnect
    this.presenceRef.onDisconnect().remove();
    
    // Listen for other users
    this.listenForOthers();
  }
  
  private listenForOthers() {
    this.othersRef.on('value', (snapshot) => {
      const allUsers = snapshot.val() || {};
      delete allUsers[this.userId]; // Remove self
      
      this.onUsersUpdate(allUsers);
    });
    
    // Listen for users joining
    this.othersRef.on('child_added', (snapshot) => {
      if (snapshot.key !== this.userId) {
        this.onUserJoined(snapshot.val());
      }
    });
    
    // Listen for users leaving
    this.othersRef.on('child_removed', (snapshot) => {
      if (snapshot.key !== this.userId) {
        this.onUserLeft(snapshot.key);
      }
    });
  }
  
  updateCursor(x: number, y: number, isActive: boolean = true) {
    this.presenceRef.child('cursor').set({
      x,
      y,
      isActive,
      timestamp: Date.now()
    });
  }
  
  updateViewport(x: number, y: number, zoom: number) {
    this.presenceRef.child('viewport').set({ x, y, zoom });
  }
  
  updateState(state: Partial<UserState>) {
    this.presenceRef.child('state').update(state);
  }
  
  private generateUserColor(userId: string): string {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
    ];
    
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  disconnect() {
    this.presenceRef.remove();
    this.othersRef.off();
    this.listeners.clear();
  }
}
```

### 2.2 Cursor Rendering System

```typescript
// CursorOverlay Component
const CursorOverlay: React.FC<{ users: CollaboratorPresence[] }> = ({ users }) => {
  return (
    <div className="cursor-overlay">
      {users.map(user => (
        <UserCursor
          key={user.id}
          user={user}
          smoothing={true}
        />
      ))}
    </div>
  );
};

// Individual User Cursor Component
const UserCursor: React.FC<{ user: CollaboratorPresence; smoothing: boolean }> = ({ 
  user, 
  smoothing 
}) => {
  const [position, setPosition] = useState(user.cursor);
  const [isVisible, setIsVisible] = useState(true);
  const positionRef = useRef(user.cursor);
  const animationRef = useRef<number>();
  
  useEffect(() => {
    if (smoothing) {
      // Smooth cursor movement with requestAnimationFrame
      const animate = () => {
        const current = positionRef.current;
        const target = user.cursor;
        
        // Lerp (Linear Interpolation) for smooth movement
        const newX = current.x + (target.x - current.x) * 0.2;
        const newY = current.y + (target.y - current.y) * 0.2;
        
        positionRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });
        
        if (Math.abs(target.x - newX) > 0.1 || Math.abs(target.y - newY) > 0.1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setPosition(user.cursor);
    }
  }, [user.cursor, smoothing]);
  
  // Hide cursor if inactive for 5 seconds
  useEffect(() => {
    setIsVisible(user.cursor.isActive);
    
    const timeout = setTimeout(() => {
      if (!user.cursor.isActive) {
        setIsVisible(false);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [user.cursor.isActive]);
  
  if (!isVisible) return null;
  
  return (
    <div
      className="user-cursor"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: smoothing ? 'none' : 'transform 0.1s linear',
        pointerEvents: 'none',
        position: 'absolute',
        zIndex: 1000
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={user.color}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      >
        <path d="M12 2L2 12l4 1 3 3 1 4 10-10-3-3-1-4-4-1z" />
      </svg>
      
      {/* User Label */}
      <div
        className="user-cursor-label"
        style={{
          backgroundColor: user.color,
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          marginTop: '4px',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        {user.displayName || user.email.split('@')[0]}
      </div>
      
      {/* Selection Indicator */}
      {user.state.selectedElements.length > 0 && (
        <div
          className="selection-indicator"
          style={{
            position: 'absolute',
            border: `2px dashed ${user.color}`,
            borderRadius: '4px',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
};
```

### 2.3 Operation Synchronization

```typescript
// Operation Manager for handling collaborative edits
class OperationManager {
  private canvasId: string;
  private userId: string;
  private operationsRef: DatabaseReference;
  private localVersion: number = 0;
  private serverVersion: number = 0;
  private pendingOperations: Operation[] = [];
  private excalidrawAPI: any;
  
  constructor(canvasId: string, userId: string, excalidrawAPI: any) {
    this.canvasId = canvasId;
    this.userId = userId;
    this.excalidrawAPI = excalidrawAPI;
    
    this.operationsRef = firebase.database()
      .ref(`sessions/${canvasId}/operations`);
    
    this.initialize();
  }
  
  private async initialize() {
    // Load initial state
    const snapshot = await firebase.database()
      .ref(`sessions/${this.canvasId}/elements/snapshot`)
      .once('value');
    
    if (snapshot.exists()) {
      const { elements, version } = snapshot.val();
      this.serverVersion = version;
      this.localVersion = version;
      
      // Load initial elements
      this.excalidrawAPI.updateScene({ elements });
    }
    
    // Listen for remote operations
    this.listenForOperations();
  }
  
  private listenForOperations() {
    this.operationsRef
      .orderByChild('timestamp')
      .startAt(Date.now())
      .on('child_added', (snapshot) => {
        const operation = snapshot.val();
        
        // Ignore own operations
        if (operation.userId === this.userId) {
          this.confirmOperation(operation.id);
          return;
        }
        
        // Apply remote operation
        this.applyRemoteOperation(operation);
      });
  }
  
  // Called when local user makes changes
  async sendOperation(type: string, data: any) {
    const operation: Operation = {
      id: generateId(),
      userId: this.userId,
      type,
      data,
      timestamp: Date.now(),
      localVersion: this.localVersion,
      serverVersion: this.serverVersion
    };
    
    // Add to pending
    this.pendingOperations.push(operation);
    
    // Send to server
    await this.operationsRef.push(operation);
    
    // Update local version
    this.localVersion++;
  }
  
  private applyRemoteOperation(operation: Operation) {
    // Operational Transform to handle conflicts
    const transformed = this.transformOperation(operation);
    
    switch (transformed.type) {
      case 'element-add':
        this.addElements(transformed.data.elements);
        break;
        
      case 'element-update':
        this.updateElements(transformed.data.elements);
        break;
        
      case 'element-delete':
        this.deleteElements(transformed.data.elementIds);
        break;
        
      case 'element-move':
        this.moveElements(
          transformed.data.elementIds,
          transformed.data.deltaX,
          transformed.data.deltaY
        );
        break;
    }
    
    // Update server version
    this.serverVersion = Math.max(this.serverVersion, operation.serverVersion + 1);
  }
  
  private transformOperation(operation: Operation): Operation {
    // Implement Operational Transform algorithm
    // This ensures operations can be applied in any order
    // while maintaining consistency
    
    let transformed = { ...operation };
    
    // Check for conflicts with pending operations
    for (const pending of this.pendingOperations) {
      if (this.operationsConflict(pending, operation)) {
        transformed = this.resolveConflict(pending, operation);
      }
    }
    
    return transformed;
  }
  
  private operationsConflict(op1: Operation, op2: Operation): boolean {
    // Check if two operations affect the same elements
    if (op1.type === 'element-update' && op2.type === 'element-update') {
      const ids1 = op1.data.elements.map((e: any) => e.id);
      const ids2 = op2.data.elements.map((e: any) => e.id);
      return ids1.some((id: string) => ids2.includes(id));
    }
    
    return false;
  }
  
  private resolveConflict(local: Operation, remote: Operation): Operation {
    // Conflict resolution strategies
    
    // Strategy 1: Last Write Wins (LWW)
    if (remote.timestamp > local.timestamp) {
      return remote;
    }
    
    // Strategy 2: Merge changes (for compatible operations)
    if (this.canMerge(local, remote)) {
      return this.mergeOperations(local, remote);
    }
    
    // Strategy 3: Transform operation
    return this.transformAgainst(remote, local);
  }
  
  private addElements(elements: any[]) {
    const currentElements = this.excalidrawAPI.getSceneElements();
    this.excalidrawAPI.updateScene({
      elements: [...currentElements, ...elements]
    });
  }
  
  private updateElements(updates: any[]) {
    const currentElements = this.excalidrawAPI.getSceneElements();
    const updatedElements = currentElements.map((elem: any) => {
      const update = updates.find(u => u.id === elem.id);
      return update ? { ...elem, ...update } : elem;
    });
    
    this.excalidrawAPI.updateScene({ elements: updatedElements });
  }
  
  private deleteElements(elementIds: string[]) {
    const currentElements = this.excalidrawAPI.getSceneElements();
    const filtered = currentElements.filter(
      (elem: any) => !elementIds.includes(elem.id)
    );
    
    this.excalidrawAPI.updateScene({ elements: filtered });
  }
  
  private moveElements(elementIds: string[], deltaX: number, deltaY: number) {
    const currentElements = this.excalidrawAPI.getSceneElements();
    const moved = currentElements.map((elem: any) => {
      if (elementIds.includes(elem.id)) {
        return {
          ...elem,
          x: elem.x + deltaX,
          y: elem.y + deltaY
        };
      }
      return elem;
    });
    
    this.excalidrawAPI.updateScene({ elements: moved });
  }
}
```

### 2.4 Integration with Excalidraw

```typescript
// Enhanced CanvasEditor with Collaboration
const CollaborativeCanvasEditor: React.FC<CanvasEditorProps> = (props) => {
  const { canvas, isOpen, onSave, onClose } = props;
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [isCollaborating, setIsCollaborating] = useState(false);
  
  const presenceManager = useRef<PresenceManager | null>(null);
  const operationManager = useRef<OperationManager | null>(null);
  const cursorThrottle = useRef<any>(null);
  
  // Initialize collaboration
  useEffect(() => {
    if (canvas && excalidrawAPI && canvas.collaborationEnabled) {
      initializeCollaboration();
    }
    
    return () => {
      if (presenceManager.current) {
        presenceManager.current.disconnect();
      }
    };
  }, [canvas, excalidrawAPI]);
  
  const initializeCollaboration = async () => {
    // Check if user has permission
    const hasPermission = await checkCollaborationPermission(canvas.id, user.id);
    
    if (!hasPermission) {
      console.warn('User does not have collaboration permission');
      return;
    }
    
    // Initialize presence
    presenceManager.current = new PresenceManager(
      canvas.id,
      user.id,
      {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    );
    
    // Set up presence callbacks
    presenceManager.current.onUsersUpdate = (users) => {
      setCollaborators(Object.values(users));
    };
    
    presenceManager.current.onUserJoined = (user) => {
      showNotification(`${user.displayName} joined the canvas`);
    };
    
    presenceManager.current.onUserLeft = (userId) => {
      showNotification(`User left the canvas`);
    };
    
    // Initialize operation sync
    operationManager.current = new OperationManager(
      canvas.id,
      user.id,
      excalidrawAPI
    );
    
    // Set up cursor tracking (throttled)
    cursorThrottle.current = throttle((x: number, y: number) => {
      if (presenceManager.current) {
        presenceManager.current.updateCursor(x, y, true);
      }
    }, 50); // 20 updates per second max
    
    setIsCollaborating(true);
  };
  
  // Track local cursor movement
  const handlePointerMove = useCallback((pointer: { x: number; y: number }) => {
    if (cursorThrottle.current && isCollaborating) {
      cursorThrottle.current(pointer.x, pointer.y);
    }
  }, [isCollaborating]);
  
  // Track local changes
  const handleChange = useCallback((elements: any[], appState: any) => {
    if (!operationManager.current || !isCollaborating) {
      // Fallback to regular save
      handleRegularSave(elements, appState);
      return;
    }
    
    // Diff to find changes
    const changes = diffElements(previousElements.current, elements);
    
    changes.forEach(change => {
      operationManager.current?.sendOperation(change.type, change.data);
    });
    
    previousElements.current = elements;
    
    // Update viewport if changed
    if (appState.scrollX !== previousViewport.current.x ||
        appState.scrollY !== previousViewport.current.y ||
        appState.zoom.value !== previousViewport.current.zoom) {
      
      presenceManager.current?.updateViewport(
        appState.scrollX,
        appState.scrollY,
        appState.zoom.value
      );
      
      previousViewport.current = {
        x: appState.scrollX,
        y: appState.scrollY,
        zoom: appState.zoom.value
      };
    }
  }, [isCollaborating]);
  
  return (
    <div className="collaborative-canvas-editor">
      {/* Collaboration Header */}
      {isCollaborating && (
        <CollaborationHeader
          collaborators={collaborators}
          onFollowUser={handleFollowUser}
          onToggleChat={toggleCursorChat}
        />
      )}
      
      {/* Main Canvas */}
      <div className="canvas-container">
        <ExcalidrawComponent
          initialData={initialData}
          onChange={handleChange}
          onPointerUpdate={handlePointerMove}
          excalidrawAPI={setExcalidrawAPI}
          // ... other props
        />
        
        {/* Cursor Overlay */}
        {isCollaborating && (
          <CursorOverlay users={collaborators} />
        )}
        
        {/* Cursor Chat */}
        {isCollaborating && showCursorChat && (
          <CursorChat
            position={cursorPosition}
            onSend={handleCursorMessage}
            messages={cursorMessages}
          />
        )}
      </div>
      
      {/* Collaboration Sidebar */}
      {isCollaborating && (
        <CollaborationSidebar
          collaborators={collaborators}
          activity={recentActivity}
          onInvite={handleInviteUser}
        />
      )}
    </div>
  );
};
```

---

## Performance Optimization

### 3.1 Cursor Movement Optimization

```typescript
// Intelligent Cursor Throttling
class CursorThrottler {
  private lastUpdate: number = 0;
  private updateInterval: number = 50; // 20 fps
  private distanceThreshold: number = 5; // pixels
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 };
  private pendingUpdate: any = null;
  
  shouldUpdate(x: number, y: number): boolean {
    const now = Date.now();
    const timeDiff = now - this.lastUpdate;
    const distance = Math.sqrt(
      Math.pow(x - this.lastPosition.x, 2) + 
      Math.pow(y - this.lastPosition.y, 2)
    );
    
    // Update if enough time passed OR significant movement
    if (timeDiff >= this.updateInterval || distance >= this.distanceThreshold) {
      this.lastUpdate = now;
      this.lastPosition = { x, y };
      return true;
    }
    
    // Schedule pending update
    if (!this.pendingUpdate) {
      this.pendingUpdate = setTimeout(() => {
        this.lastUpdate = Date.now();
        this.lastPosition = { x, y };
        this.pendingUpdate = null;
        // Trigger update
      }, this.updateInterval - timeDiff);
    }
    
    return false;
  }
}
```

### 3.2 Operation Batching

```typescript
// Batch multiple operations for efficiency
class OperationBatcher {
  private operations: Operation[] = [];
  private batchTimeout: any = null;
  private batchSize: number = 10;
  private batchDelay: number = 100; // ms
  
  add(operation: Operation) {
    this.operations.push(operation);
    
    if (this.operations.length >= this.batchSize) {
      this.flush();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flush(), this.batchDelay);
    }
  }
  
  private flush() {
    if (this.operations.length === 0) return;
    
    // Send batched operations
    const batch = {
      type: 'batch',
      operations: this.operations,
      timestamp: Date.now()
    };
    
    firebase.database()
      .ref(`sessions/${canvasId}/operations`)
      .push(batch);
    
    this.operations = [];
    clearTimeout(this.batchTimeout);
    this.batchTimeout = null;
  }
}
```

### 3.3 Viewport-Based Optimization

```typescript
// Only sync elements within viewport
class ViewportOptimizer {
  private viewport: Viewport;
  private visibleElements: Set<string> = new Set();
  
  updateViewport(viewport: Viewport) {
    this.viewport = viewport;
    this.updateVisibleElements();
  }
  
  private updateVisibleElements() {
    const elements = excalidrawAPI.getSceneElements();
    const newVisible = new Set<string>();
    
    elements.forEach(element => {
      if (this.isElementInViewport(element)) {
        newVisible.add(element.id);
        
        // Subscribe to element if newly visible
        if (!this.visibleElements.has(element.id)) {
          this.subscribeToElement(element.id);
        }
      } else {
        // Unsubscribe if no longer visible
        if (this.visibleElements.has(element.id)) {
          this.unsubscribeFromElement(element.id);
        }
      }
    });
    
    this.visibleElements = newVisible;
  }
  
  private isElementInViewport(element: any): boolean {
    // Check if element bounding box intersects viewport
    return (
      element.x < this.viewport.x + this.viewport.width &&
      element.x + element.width > this.viewport.x &&
      element.y < this.viewport.y + this.viewport.height &&
      element.y + element.height > this.viewport.y
    );
  }
}
```

---

## Security & Privacy

### 4.1 Permission Levels

```typescript
enum PermissionLevel {
  VIEWER = 'viewer',    // Can view only
  EDITOR = 'editor',    // Can edit elements
  ADMIN = 'admin'       // Can manage sharing
}

interface PermissionMatrix {
  [PermissionLevel.VIEWER]: {
    canView: true;
    canEdit: false;
    canComment: true;
    canExport: true;
    canShare: false;
    canDelete: false;
  };
  [PermissionLevel.EDITOR]: {
    canView: true;
    canEdit: true;
    canComment: true;
    canExport: true;
    canShare: false;
    canDelete: false;
  };
  [PermissionLevel.ADMIN]: {
    canView: true;
    canEdit: true;
    canComment: true;
    canExport: true;
    canShare: true;
    canDelete: true;
  };
}
```

### 4.2 Data Encryption

```typescript
// Encrypt sensitive cursor chat messages
class MessageEncryption {
  private key: CryptoKey;
  
  async initialize(canvasId: string) {
    // Generate or retrieve encryption key for canvas
    this.key = await this.getOrCreateKey(canvasId);
  }
  
  async encryptMessage(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  async decryptMessage(encrypted: string): Promise<string> {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}
```

### 4.3 Rate Limiting

```typescript
// Prevent abuse with rate limiting
class RateLimiter {
  private limits = {
    cursorUpdates: { max: 30, window: 1000 },      // 30/second
    operations: { max: 100, window: 60000 },        // 100/minute
    messages: { max: 10, window: 60000 },           // 10/minute
    invites: { max: 20, window: 3600000 }           // 20/hour
  };
  
  private counters: Map<string, number[]> = new Map();
  
  canPerform(action: string): boolean {
    const limit = this.limits[action];
    if (!limit) return true;
    
    const now = Date.now();
    const key = `${action}_${userId}`;
    
    if (!this.counters.has(key)) {
      this.counters.set(key, []);
    }
    
    const timestamps = this.counters.get(key)!;
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      t => now - t < limit.window
    );
    
    if (validTimestamps.length >= limit.max) {
      return false; // Rate limit exceeded
    }
    
    validTimestamps.push(now);
    this.counters.set(key, validTimestamps);
    
    return true;
  }
}
```

---

## Testing Strategy

### 5.1 Unit Tests

```typescript
// Test cursor synchronization
describe('CursorSync', () => {
  it('should broadcast cursor position', async () => {
    const manager = new PresenceManager(canvasId, userId, userInfo);
    
    manager.updateCursor(100, 200);
    
    const snapshot = await firebase.database()
      .ref(`sessions/${canvasId}/presence/${userId}/cursor`)
      .once('value');
    
    expect(snapshot.val()).toEqual({
      x: 100,
      y: 200,
      isActive: true,
      timestamp: expect.any(Number)
    });
  });
  
  it('should throttle cursor updates', () => {
    const throttler = new CursorThrottler();
    
    const updates = [];
    for (let i = 0; i < 100; i++) {
      if (throttler.shouldUpdate(i, i)) {
        updates.push({ x: i, y: i });
      }
    }
    
    expect(updates.length).toBeLessThan(10); // Throttled
  });
});
```

### 5.2 Integration Tests

```typescript
// Test multi-user collaboration
describe('Collaboration', () => {
  it('should sync changes between users', async () => {
    // User A creates element
    const userA = new CollaborationClient(canvasId, 'userA');
    await userA.createElement({
      type: 'rectangle',
      x: 100,
      y: 100
    });
    
    // User B should receive the element
    const userB = new CollaborationClient(canvasId, 'userB');
    await waitFor(() => {
      const elements = userB.getElements();
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('rectangle');
    });
  });
  
  it('should resolve conflicts correctly', async () => {
    // Both users move same element simultaneously
    const userA = new CollaborationClient(canvasId, 'userA');
    const userB = new CollaborationClient(canvasId, 'userB');
    
    const elementId = 'elem_123';
    
    await Promise.all([
      userA.moveElement(elementId, { x: 100, y: 100 }),
      userB.moveElement(elementId, { x: 200, y: 200 })
    ]);
    
    // Both should converge to same state
    await waitFor(() => {
      const elemA = userA.getElementById(elementId);
      const elemB = userB.getElementById(elementId);
      
      expect(elemA.x).toBe(elemB.x);
      expect(elemA.y).toBe(elemB.y);
    });
  });
});
```

### 5.3 Performance Tests

```typescript
// Test performance with multiple users
describe('Performance', () => {
  it('should handle 10 concurrent users', async () => {
    const users = [];
    
    // Create 10 users
    for (let i = 0; i < 10; i++) {
      users.push(new CollaborationClient(canvasId, `user${i}`));
    }
    
    // Each user moves cursor 100 times
    const startTime = Date.now();
    
    await Promise.all(
      users.map(user => 
        user.simulateCursorMovement(100)
      )
    );
    
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds
    
    // All users should see all cursors
    for (const user of users) {
      expect(user.getVisibleCursors()).toHaveLength(9); // All except self
    }
  });
});
```

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)
- Deploy to staging environment
- Internal team testing with 2-3 users
- Fix critical bugs
- Performance profiling

### Phase 2: Beta Release (Week 3-4)
- Release to 10% of users
- Monitor performance metrics
- Collect user feedback
- Iterate on UX issues

### Phase 3: General Availability (Week 5-6)
- Gradual rollout to all users
- Monitor server load
- Scale infrastructure as needed
- Documentation and tutorials

### Success Metrics
- < 100ms cursor latency (P50)
- < 200ms operation sync (P50)
- > 99% operation delivery rate
- < 1% conflict rate
- > 90% user satisfaction

---

## Future Enhancements

### Version 2.0 Features
1. **Voice/Video Chat**: Integrate WebRTC for voice/video
2. **Comments & Annotations**: Persistent comments on elements
3. **Version History**: Time-travel to see canvas history
4. **Presence Indicators**: Show where users are looking
5. **Collaborative Gestures**: Shared laser pointer, highlights

### Version 3.0 Features
1. **AI Assistance**: Collaborative AI suggestions
2. **Template Sharing**: Share canvas templates
3. **Advanced Permissions**: Element-level permissions
4. **Offline Collaboration**: Sync when reconnected
5. **Mobile Collaboration**: Full mobile support

### Performance Improvements
1. **WebRTC Data Channels**: Direct peer-to-peer for cursors
2. **CDN Distribution**: Edge servers for global performance
3. **Predictive Sync**: Anticipate user actions
4. **Compression**: Reduce bandwidth usage
5. **Connection Pooling**: Reuse connections

---

## Technical Dependencies

### NPM Packages to Install
```json
{
  "dependencies": {
    "firebase": "^10.x",           // Already installed
    "@firebase/database": "^1.x",  // Realtime Database
    "lodash.throttle": "^4.x",     // Throttling
    "lodash.debounce": "^4.x",     // Debouncing
    "uuid": "^9.x",                // ID generation
    "diff": "^5.x"                 // Element diffing
  }
}
```

### Firebase Configuration
```javascript
// Enable Realtime Database in Firebase Console
// firebase.json
{
  "database": {
    "rules": "database.rules.json"
  }
}

// database.rules.json
{
  "rules": {
    "sessions": {
      "$canvasId": {
        ".read": "auth != null && (root.child('canvases').child($canvasId).child('ownerId').val() == auth.uid || root.child('canvases').child($canvasId).child('sharedWith').val().contains(auth.uid))",
        ".write": "auth != null && (root.child('canvases').child($canvasId).child('ownerId').val() == auth.uid || root.child('canvases').child($canvasId).child('sharedWith').val().contains(auth.uid))"
      }
    }
  }
}
```

---

## Conclusion

This comprehensive plan provides a complete roadmap for implementing real-time collaborative canvas editing. The phased approach ensures a stable rollout while the detailed technical specifications provide clear implementation guidance.

Key success factors:
1. **Performance**: Keep latency under 100ms for cursor movement
2. **Reliability**: Ensure 99%+ uptime for collaboration services
3. **Scalability**: Design for 100+ concurrent users per canvas
4. **Security**: Implement proper access controls and encryption
5. **User Experience**: Make collaboration feel magical and seamless

The implementation will transform the canvas feature from a single-user tool to a powerful collaborative platform, enabling teams to work together in real-time regardless of their location.