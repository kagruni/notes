import { rtdb } from '@/lib/firebase';
import { 
  ref, 
  onValue, 
  onDisconnect, 
  set, 
  push, 
  serverTimestamp,
  DataSnapshot,
  off,
  update
} from 'firebase/database';

export interface UserPresence {
  userId: string;
  email: string;
  displayName: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
  };
  lastSeen: number;
  isOnline: boolean;
}

export interface PresenceCallbacks {
  onUserJoin?: (user: UserPresence) => void;
  onUserLeave?: (userId: string) => void;
  onUserUpdate?: (user: UserPresence) => void;
  onPresenceUpdate?: (users: Map<string, UserPresence>) => void;
}

class PresenceService {
  private presenceRef: any = null;
  private myPresenceRef: any = null;
  private listeners: Map<string, any> = new Map();
  private activeUsers: Map<string, UserPresence> = new Map();
  private currentCanvasId: string | null = null;
  private currentUserId: string | null = null;
  private userColor: string = '';
  private callbacks: PresenceCallbacks = {};
  private cursorThrottle: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#FFB6C1', '#F7DC6F', '#BB8FCE',
      '#85C1E2', '#F8B739', '#52B788', '#E76F51', '#E9C46A'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async initializePresence(
    canvasId: string, 
    userId: string, 
    userInfo: { email: string; displayName: string },
    callbacks?: PresenceCallbacks
  ) {
    if (this.currentCanvasId === canvasId && this.currentUserId === userId) {
      return; // Already initialized for this canvas/user
    }

    // Clean up previous presence if switching canvases
    if (this.currentCanvasId && this.currentCanvasId !== canvasId) {
      await this.cleanup();
    }

    this.currentCanvasId = canvasId;
    this.currentUserId = userId;
    this.userColor = this.generateUserColor();
    this.callbacks = callbacks || {};

    // Reference to all users' presence in this canvas
    this.presenceRef = ref(rtdb, `canvas-presence/${canvasId}`);
    
    // Reference to current user's presence
    this.myPresenceRef = ref(rtdb, `canvas-presence/${canvasId}/${userId}`);

    // Set up my presence
    const myPresence: UserPresence = {
      userId,
      email: userInfo.email,
      displayName: userInfo.displayName || userInfo.email.split('@')[0],
      color: this.userColor,
      lastSeen: Date.now(),
      isOnline: true
    };

    // Set initial presence
    await set(this.myPresenceRef, myPresence);

    // Set up disconnect handler
    await onDisconnect(this.myPresenceRef).set({
      ...myPresence,
      isOnline: false,
      lastSeen: Date.now()
    });

    // Listen to all users' presence
    const unsubscribe = onValue(this.presenceRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() || {};
      const newUsers = new Map<string, UserPresence>();

      Object.entries(data).forEach(([uid, presence]) => {
        const userPresence = presence as UserPresence;
        
        // Skip offline users that have been gone for more than 30 seconds
        if (!userPresence.isOnline && 
            Date.now() - userPresence.lastSeen > 30000) {
          return;
        }

        const previousUser = this.activeUsers.get(uid);
        newUsers.set(uid, userPresence);

        // Trigger callbacks for user changes
        if (!previousUser && userPresence.isOnline && uid !== userId) {
          this.callbacks.onUserJoin?.(userPresence);
        } else if (previousUser && !userPresence.isOnline && uid !== userId) {
          this.callbacks.onUserLeave?.(uid);
        } else if (previousUser && userPresence.isOnline) {
          this.callbacks.onUserUpdate?.(userPresence);
        }
      });

      // Check for users who left
      this.activeUsers.forEach((user, uid) => {
        if (!newUsers.has(uid) && uid !== userId) {
          this.callbacks.onUserLeave?.(uid);
        }
      });

      this.activeUsers = newUsers;
      this.callbacks.onPresenceUpdate?.(newUsers);
    });

    this.listeners.set('presence', unsubscribe);

    // Start cleanup interval to remove stale presence
    this.startCleanupInterval();

    // Update heartbeat periodically
    this.startHeartbeat();
  }

  private startHeartbeat() {
    const heartbeatInterval = setInterval(() => {
      if (this.myPresenceRef && this.currentUserId) {
        update(this.myPresenceRef, {
          lastSeen: Date.now(),
          isOnline: true
        }).catch(console.error);
      }
    }, 10000); // Every 10 seconds

    this.listeners.set('heartbeat', heartbeatInterval);
  }

  private startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      // Remove stale users from local state
      const staleUsers: string[] = [];
      this.activeUsers.forEach((user, uid) => {
        if (!user.isOnline && Date.now() - user.lastSeen > 30000) {
          staleUsers.push(uid);
        }
      });

      staleUsers.forEach(uid => {
        this.activeUsers.delete(uid);
        this.callbacks.onUserLeave?.(uid);
      });

      if (staleUsers.length > 0) {
        this.callbacks.onPresenceUpdate?.(this.activeUsers);
      }
    }, 15000); // Check every 15 seconds
  }

  updateCursor(x: number, y: number) {
    if (!this.myPresenceRef) return;

    // Throttle cursor updates to max 60fps (16ms)
    if (this.cursorThrottle) {
      clearTimeout(this.cursorThrottle);
    }

    this.cursorThrottle = setTimeout(() => {
      update(this.myPresenceRef, {
        cursor: { x, y },
        lastSeen: Date.now()
      }).catch(console.error);
    }, 16);
  }

  async sendMessage(message: string) {
    if (!this.myPresenceRef) return;

    await update(this.myPresenceRef, {
      message,
      messageTimestamp: Date.now(),
      lastSeen: Date.now()
    });

    // Clear message after 5 seconds
    setTimeout(() => {
      if (this.myPresenceRef) {
        update(this.myPresenceRef, {
          message: null,
          messageTimestamp: null
        }).catch(console.error);
      }
    }, 5000);
  }

  getActiveUsers(): Map<string, UserPresence> {
    return new Map(this.activeUsers);
  }

  getUserColor(): string {
    return this.userColor;
  }

  async cleanup() {
    // Clear throttled cursor update
    if (this.cursorThrottle) {
      clearTimeout(this.cursorThrottle);
      this.cursorThrottle = null;
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear heartbeat
    const heartbeat = this.listeners.get('heartbeat');
    if (heartbeat) {
      clearInterval(heartbeat);
    }

    // Set offline status
    if (this.myPresenceRef) {
      await set(this.myPresenceRef, {
        userId: this.currentUserId,
        isOnline: false,
        lastSeen: Date.now()
      }).catch(console.error);
    }

    // Remove listeners
    if (this.presenceRef) {
      const unsubscribe = this.listeners.get('presence');
      if (unsubscribe) {
        off(this.presenceRef, 'value', unsubscribe);
      }
    }

    // Clear state
    this.listeners.clear();
    this.activeUsers.clear();
    this.currentCanvasId = null;
    this.currentUserId = null;
    this.presenceRef = null;
    this.myPresenceRef = null;
    this.callbacks = {};
  }
}

// Export singleton instance
export const presenceService = new PresenceService();