# Canvas Real-Time Collaboration - Technical Specification

## Problem Statement
Users need to collaborate on canvases in real-time, similar to Figma's multiplayer experience. Currently, canvases are single-user only, limiting team collaboration and requiring manual sharing of static exports.

## Scope
This specification covers the implementation of real-time collaborative editing for canvases, including:
- Canvas sharing system with permission management
- Real-time presence and cursor tracking
- Simultaneous editing with conflict resolution
- Performance optimization for multi-user scenarios
- Security and privacy controls

## Non-Goals
- Voice/video chat integration (future enhancement)
- Mobile collaboration (limited to desktop initially)
- Offline collaboration with sync (requires separate architecture)
- Canvas versioning/history (separate feature)

## Constraints

### Technical Constraints
- Must work within existing Next.js 15 App Router architecture
- Firebase Firestore for persistent storage (existing)
- Firebase Realtime Database for live collaboration (new)
- Excalidraw library limitations for real-time updates
- Browser WebSocket connection limits
- Firebase Realtime Database pricing constraints

### Performance Requirements
- Cursor latency: <100ms (P50), <200ms (P95)
- Operation sync: <200ms (P50), <500ms (P95)
- Support 10+ concurrent users per canvas
- <5MB bandwidth per user per hour
- Initial load time: <3s with collaboration enabled

### Security Requirements
- Granular permission levels (viewer, editor, admin)
- Secure invitation system with token validation
- Rate limiting to prevent abuse
- Data encryption for sensitive messages
- Audit trail for all canvas modifications

## Risks

### Technical Risks
1. **Conflict Resolution Complexity**: Operational Transform implementation may have edge cases
   - Mitigation: Start with Last-Write-Wins, implement OT incrementally
   
2. **Performance Degradation**: Multiple users may cause lag
   - Mitigation: Viewport optimization, operation batching, throttling
   
3. **Firebase Realtime Database Costs**: High-frequency updates may be expensive
   - Mitigation: Intelligent batching, cursor throttling, connection pooling

4. **Excalidraw Integration**: Library may not support all real-time features
   - Mitigation: Fork/patch library if needed, contribute upstream

### Business Risks
1. **User Adoption**: Complex UI might confuse users
   - Mitigation: Progressive disclosure, tooltips, onboarding
   
2. **Support Burden**: Collaboration issues may increase support tickets
   - Mitigation: Comprehensive logging, self-service troubleshooting

## Architecture Decisions

### Data Model

#### Firestore (Persistent Storage)
```typescript
// Enhanced Canvas Document
interface Canvas {
  id: string;
  title: string;
  elements: any[];
  appState?: any;
  files?: any;
  projectId: string;
  userId: string; // owner
  createdAt: Date;
  updatedAt: Date;
  thumbnail?: string;
  
  // New collaboration fields
  collaborationEnabled: boolean;
  sharedWith: string[]; // User IDs with access
  permissions: {
    [userId: string]: {
      role: 'viewer' | 'editor' | 'admin';
      grantedAt: Date;
      grantedBy: string;
    }
  };
  shareSettings: {
    allowPublicAccess: boolean;
    publicShareToken?: string;
    requireSignIn: boolean;
    expiresAt?: Date;
  };
}

// New Collection: canvas_invites
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
  inviteToken: string;
}
```

#### Firebase Realtime Database (Live Collaboration)
```typescript
interface RealtimeSession {
  sessions: {
    [canvasId: string]: {
      metadata: {
        started: number;
        version: number;
        locked: boolean;
      };
      presence: {
        [userId: string]: UserPresence;
      };
      operations: {
        [operationId: string]: Operation;
      };
      elements: {
        snapshot: {
          elements: any[];
          version: number;
          lastUpdated: number;
        };
      };
      chat: {
        [messageId: string]: CursorMessage;
      };
    };
  };
}

interface UserPresence {
  user: {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;
    color: string;
  };
  cursor: {
    x: number;
    y: number;
    isActive: boolean;
  };
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  state: {
    isDrawing: boolean;
    selectedElements: string[];
    tool: string;
  };
  lastSeen: number;
}

interface Operation {
  id: string;
  userId: string;
  timestamp: number;
  type: 'element-add' | 'element-update' | 'element-delete' | 'element-move';
  data: any;
  localVersion: number;
  serverVersion: number;
}
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Excalidraw  │  │   Presence   │  │  Operation   │      │
│  │   Component  │◄─┤   Manager    │◄─┤   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                 ▲                  ▲              │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌──────────────────────────────────────────────────┐      │
│  │          Firebase Realtime Database SDK          │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Backend                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Realtime   │  │  Firestore   │  │   Firebase   │      │
│  │   Database   │  │   Database   │  │   Functions  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│       Live             Persistent        Server Logic        │
│   Collaboration          Data           & Validation         │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── components/
│   ├── canvas/
│   │   ├── CanvasEditor.tsx (existing, enhance)
│   │   └── collaboration/
│   │       ├── CollaborativeCanvasEditor.tsx
│   │       ├── ShareModal.tsx
│   │       ├── CollaborationHeader.tsx
│   │       ├── CollaborationSidebar.tsx
│   │       ├── CursorOverlay.tsx
│   │       ├── UserCursor.tsx
│   │       └── CursorChat.tsx
│   └── common/
│       └── AvatarGroup.tsx
├── lib/
│   ├── collaboration/
│   │   ├── PresenceManager.ts
│   │   ├── OperationManager.ts
│   │   ├── CursorThrottler.ts
│   │   ├── OperationBatcher.ts
│   │   ├── ViewportOptimizer.ts
│   │   ├── ConflictResolver.ts
│   │   └── MessageEncryption.ts
│   └── firebase/
│       ├── realtimeDb.ts (new)
│       └── collaborationRules.ts (new)
├── hooks/
│   ├── useCollaboration.ts
│   ├── usePresence.ts
│   ├── useCursors.ts
│   └── useCanvasPermissions.ts
└── types/
    └── collaboration.ts

```

## Backend Touchpoints

### Firebase Firestore
- **Canvases Collection**: Add collaboration fields
- **Canvas Invites Collection**: New collection for invitations
- **Security Rules**: Update to check permissions

### Firebase Realtime Database (New)
- **Sessions Node**: Real-time collaboration data
- **Presence System**: User tracking and cursor positions
- **Operations Log**: Change synchronization
- **Chat Messages**: Cursor chat functionality

### Firebase Functions (Optional)
- **Invitation Emails**: Send invite notifications
- **Cleanup Jobs**: Remove stale sessions
- **Analytics**: Track collaboration metrics

## Data Flow

### Sharing Flow
1. Owner clicks Share button
2. Modal opens with invite options
3. Email invitation created in Firestore
4. Recipient receives email with secure link
5. Recipient accepts invitation
6. Permissions updated in canvas document
7. User gains access to canvas

### Real-Time Collaboration Flow
1. User opens shared canvas
2. PresenceManager establishes connection
3. User presence broadcast to others
4. Cursor movements throttled and broadcast
5. Canvas changes captured as operations
6. Operations synchronized via Realtime Database
7. Conflict resolution applied if needed
8. All users see consistent state

### Conflict Resolution Strategy
1. **Detection**: Track version vectors for each operation
2. **Resolution**: 
   - Non-conflicting: Apply immediately
   - Conflicting: Use Operational Transform
   - Fallback: Last-Write-Wins with user notification
3. **Convergence**: Ensure all clients reach same state

## Performance Optimization Strategy

### Client-Side Optimizations
- Cursor throttling (20 updates/second max)
- Operation batching (100ms delay, 10 op max)
- Viewport-based rendering (only visible cursors)
- WebWorker for heavy computations
- RequestAnimationFrame for smooth animations

### Network Optimizations
- Connection pooling for Firebase
- Compression for large operations
- Delta updates instead of full state
- Intelligent reconnection with exponential backoff

### Server-Side Optimizations
- Snapshot intervals (every 100 operations)
- Automatic session cleanup (after 30 min idle)
- Rate limiting per user
- Horizontal scaling via Firebase

## Testing Strategy

### Unit Tests
- Cursor synchronization logic
- Conflict resolution algorithms
- Permission validation
- Rate limiting

### Integration Tests
- Multi-user collaboration scenarios
- Network failure recovery
- Permission changes during session
- Large canvas performance

### E2E Tests (Playwright)
- Complete sharing workflow
- Real-time cursor tracking
- Simultaneous editing
- Permission enforcement

### Performance Tests
- Load testing with 10+ users
- Bandwidth consumption monitoring
- Latency measurements
- Memory leak detection

## Deployment Strategy

### Phase 1: Foundation (Week 1)
- Database schema updates
- Basic sharing UI
- Permission system

### Phase 2: Real-Time Core (Week 2)
- Presence system
- Cursor rendering
- Basic operation sync

### Phase 3: Advanced Features (Week 3)
- Conflict resolution
- Cursor chat
- Performance optimizations

### Phase 4: Polish & Testing (Week 4)
- Bug fixes
- Performance tuning
- Documentation

## Monitoring & Observability

### Metrics to Track
- Active collaboration sessions
- Average users per session
- Cursor latency (P50, P95, P99)
- Operation sync time
- Conflict rate
- Error rate
- Bandwidth usage per user

### Logging
- Session start/end
- User join/leave
- Permission changes
- Conflict occurrences
- Error conditions

### Alerting
- High latency (>500ms P95)
- High conflict rate (>5%)
- Session failures
- Rate limit violations

## Security Considerations

### Access Control
- Row-level security in Firestore
- Realtime Database rules validation
- Token-based invite system
- Permission inheritance

### Data Protection
- End-to-end encryption for chat
- Secure WebSocket connections
- Input sanitization
- XSS prevention

### Rate Limiting
- Per-user operation limits
- Cursor update throttling
- Invite creation limits
- Connection limits

## Success Criteria

### Technical Metrics
- Cursor latency <100ms (P50)
- Operation sync <200ms (P50)
- 99%+ operation delivery rate
- <1% conflict rate
- Support 10+ concurrent users

### User Experience Metrics
- 90%+ user satisfaction score
- <5% collaboration-related support tickets
- 80%+ feature adoption rate
- <3s time to first cursor visibility

## Future Considerations

### Enhancements
- WebRTC for P2P optimization
- Voice/video integration
- Mobile collaboration
- Offline support with sync
- AI-powered collaboration features

### Scalability
- CDN for global distribution
- Regional Firebase instances
- Connection multiplexing
- Predictive pre-fetching

This specification provides the technical foundation for implementing real-time collaboration while maintaining performance, security, and user experience standards.