/**
 * Canvas collaboration service with real-time synchronization
 */

import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  DocumentSnapshot,
  Unsubscribe,
  setDoc,
  getDoc,
  deleteField
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Collaborator, 
  CollaborationState, 
  ChatMessage,
  Canvas
} from '@/types';
import { 
  debounce, 
  throttle, 
  ConnectionPool,
  ConflictDetector,
  BatchProcessor,
  VersionedData
} from '@/utils/performance';
import { 
  RateLimiter, 
  sanitizeChatMessage,
  validatePermissions,
  AuditLogger
} from '@/utils/security';

export class CollaborationService {
  private connectionPool = new ConnectionPool();
  private rateLimiter = new RateLimiter(30, 60000); // 30 actions per minute
  private conflictDetector = new ConflictDetector<any>();
  private auditLogger = new AuditLogger();
  private listeners: Map<string, Unsubscribe> = new Map();
  
  // Batch processor for cursor updates
  private cursorBatcher = new BatchProcessor<{
    canvasId: string;
    userId: string;
    cursor: { x: number; y: number };
  }>(
    async (batch) => {
      // Process cursor updates in batch
      for (const update of batch) {
        await this.updateCursorPosition(
          update.canvasId,
          update.userId,
          update.cursor
        );
      }
    },
    { batchSize: 5, delay: 50 }
  );
  
  /**
   * Start collaboration session
   */
  async startSession(
    canvasId: string,
    userId: string,
    userInfo: { name: string; email: string }
  ): Promise<void> {
    // Check rate limit
    if (!this.rateLimiter.checkLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Validate permissions
    const canvasDoc = await getDoc(doc(db, 'canvases', canvasId));
    if (!canvasDoc.exists()) {
      throw new Error('Canvas not found');
    }
    
    const permissions = validatePermissions(userId, canvasDoc.data() as Canvas);
    if (!permissions.canView) {
      throw new Error('You do not have permission to view this canvas');
    }
    
    // Log session start
    this.auditLogger.log({
      userId,
      action: 'collaboration_session_start',
      resourceId: canvasId,
      resourceType: 'canvas',
      metadata: { userInfo }
    });
    
    // Add user to active collaborators
    const collaboratorData: Collaborator = {
      userId,
      name: userInfo.name,
      email: userInfo.email,
      isActive: true,
      lastSeen: Date.now(),
      color: this.generateUserColor(userId),
      cursor: null
    };
    
    await updateDoc(doc(db, 'canvases', canvasId), {
      [`collaborators.${userId}`]: collaboratorData,
      [`activeUsers.${userId}`]: {
        ...collaboratorData,
        joinedAt: serverTimestamp()
      }
    });
  }
  
  /**
   * End collaboration session
   */
  async endSession(canvasId: string, userId: string): Promise<void> {
    // Log session end
    this.auditLogger.log({
      userId,
      action: 'collaboration_session_end',
      resourceId: canvasId,
      resourceType: 'canvas'
    });
    
    // Remove from active users
    await updateDoc(doc(db, 'canvases', canvasId), {
      [`activeUsers.${userId}`]: deleteField(),
      [`collaborators.${userId}.isActive`]: false,
      [`collaborators.${userId}.lastSeen`]: serverTimestamp()
    });
    
    // Cleanup connections
    this.cleanup(canvasId);
  }
  
  /**
   * Update cursor position (throttled)
   */
  private updateCursorPosition = throttle(
    async (canvasId: string, userId: string, cursor: { x: number; y: number }) => {
      try {
        await updateDoc(doc(db, 'canvases', canvasId), {
          [`collaborators.${userId}.cursor`]: cursor,
          [`collaborators.${userId}.lastActivity`]: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating cursor:', error);
      }
    },
    100 // Throttle to max 10 updates per second
  );
  
  /**
   * Queue cursor update for batch processing
   */
  queueCursorUpdate(
    canvasId: string,
    userId: string,
    cursor: { x: number; y: number }
  ): void {
    this.cursorBatcher.add({ canvasId, userId, cursor });
  }
  
  /**
   * Send chat message
   */
  async sendMessage(
    canvasId: string,
    userId: string,
    message: string,
    userInfo: { name: string }
  ): Promise<void> {
    // Check rate limit
    if (!this.rateLimiter.checkLimit(`chat_${userId}`)) {
      throw new Error('Too many messages. Please slow down.');
    }
    
    // Sanitize message
    const sanitized = sanitizeChatMessage(message);
    if (!sanitized) {
      throw new Error('Invalid message content');
    }
    
    const chatMessage: ChatMessage = {
      id: `${Date.now()}_${userId}`,
      userId,
      userName: userInfo.name,
      message: sanitized,
      timestamp: Date.now()
    };
    
    // Store last 50 messages
    const canvasRef = doc(db, 'canvases', canvasId);
    const canvasDoc = await getDoc(canvasRef);
    
    if (canvasDoc.exists()) {
      const currentMessages = canvasDoc.data().chatMessages || [];
      const updatedMessages = [...currentMessages, chatMessage].slice(-50);
      
      await updateDoc(canvasRef, {
        chatMessages: updatedMessages
      });
    }
  }
  
  /**
   * Save canvas content with conflict detection
   */
  saveCanvasContent = debounce(
    async (
      canvasId: string,
      content: any,
      version: number
    ): Promise<void> => {
      try {
        const canvasRef = doc(db, 'canvases', canvasId);
        const canvasDoc = await getDoc(canvasRef);
        
        if (canvasDoc.exists()) {
          const remote = canvasDoc.data();
          const local: VersionedData<any> = {
            data: content,
            version,
            timestamp: Date.now()
          };
          
          const remoteVersioned: VersionedData<any> = {
            data: remote.content,
            version: remote.version || 0,
            timestamp: remote.lastModified?.toMillis() || 0
          };
          
          // Check for conflicts
          if (this.conflictDetector.detectConflict(local, remoteVersioned)) {
            // Handle conflict - for now, last write wins
            console.warn('Conflict detected, resolving...');
          }
          
          await updateDoc(canvasRef, {
            content,
            version: version + 1,
            lastModified: serverTimestamp()
          });
          
          this.conflictDetector.updateVersion(version + 1);
        }
      } catch (error) {
        console.error('Error saving canvas:', error);
        throw error;
      }
    },
    1000 // Debounce saves to max once per second
  );
  
  /**
   * Subscribe to canvas updates
   */
  subscribeToCanvas(
    canvasId: string,
    callbacks: {
      onCollaboratorsChange?: (collaborators: Collaborator[]) => void;
      onContentChange?: (content: any) => void;
      onChatMessage?: (messages: ChatMessage[]) => void;
      onStateChange?: (state: CollaborationState) => void;
    }
  ): () => void {
    const canvasRef = doc(db, 'canvases', canvasId);
    
    const unsubscribe = onSnapshot(canvasRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data();
      
      // Update collaborators
      if (callbacks.onCollaboratorsChange && data.collaborators) {
        const collaboratorsList = Object.values(data.collaborators) as Collaborator[];
        callbacks.onCollaboratorsChange(collaboratorsList);
      }
      
      // Update content
      if (callbacks.onContentChange && data.content) {
        callbacks.onContentChange(data.content);
      }
      
      // Update chat
      if (callbacks.onChatMessage && data.chatMessages) {
        callbacks.onChatMessage(data.chatMessages);
      }
      
      // Update state
      if (callbacks.onStateChange) {
        const state: CollaborationState = {
          isConnected: true,
          activeUsers: Object.values(data.activeUsers || {}) as Collaborator[],
          version: data.version || 0
        };
        callbacks.onStateChange(state);
      }
    });
    
    // Store unsubscribe function
    const key = `canvas_${canvasId}`;
    this.listeners.set(key, unsubscribe);
    this.connectionPool.add(key, unsubscribe);
    
    return () => {
      this.connectionPool.remove(key);
      this.listeners.delete(key);
    };
  }
  
  /**
   * Generate invite link
   */
  async generateInviteLink(
    canvasId: string,
    role: 'viewer' | 'editor' | 'admin',
    expiresIn: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ): Promise<string> {
    const token = this.generateInviteToken();
    const expiresAt = Date.now() + expiresIn;
    
    // Store invite in Firebase
    await setDoc(doc(db, 'invites', token), {
      canvasId,
      role,
      expiresAt,
      createdAt: serverTimestamp(),
      used: false
    });
    
    // Return invite URL
    const baseUrl = window.location.origin;
    return `${baseUrl}/canvas/invite/${token}`;
  }
  
  /**
   * Accept invite
   */
  async acceptInvite(
    token: string,
    userId: string,
    userInfo: { name: string; email: string }
  ): Promise<string> {
    const inviteRef = doc(db, 'invites', token);
    const inviteDoc = await getDoc(inviteRef);
    
    if (!inviteDoc.exists()) {
      throw new Error('Invalid invite link');
    }
    
    const invite = inviteDoc.data();
    
    // Check if expired
    if (invite.expiresAt < Date.now()) {
      throw new Error('Invite link has expired');
    }
    
    // Check if already used
    if (invite.used) {
      throw new Error('Invite link has already been used');
    }
    
    // Add user as collaborator
    await updateDoc(doc(db, 'canvases', invite.canvasId), {
      [`collaborators.${userId}`]: {
        userId,
        name: userInfo.name,
        email: userInfo.email,
        role: invite.role,
        joinedAt: serverTimestamp()
      }
    });
    
    // Mark invite as used
    await updateDoc(inviteRef, {
      used: true,
      usedBy: userId,
      usedAt: serverTimestamp()
    });
    
    // Log invite acceptance
    this.auditLogger.log({
      userId,
      action: 'invite_accepted',
      resourceId: invite.canvasId,
      resourceType: 'canvas',
      metadata: { role: invite.role, token }
    });
    
    return invite.canvasId;
  }
  
  /**
   * Generate a color for a user based on their ID
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FECA57', '#48C9B0', '#6C5CE7', '#A29BFE',
      '#FD79A8', '#FDCB6E', '#6C63FF', '#00B894'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  /**
   * Generate secure invite token
   */
  private generateInviteToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Cleanup connections and resources
   */
  cleanup(canvasId?: string): void {
    if (canvasId) {
      const key = `canvas_${canvasId}`;
      const unsubscribe = this.listeners.get(key);
      if (unsubscribe) {
        unsubscribe();
        this.listeners.delete(key);
      }
      this.connectionPool.remove(key);
    } else {
      // Cleanup all
      this.listeners.forEach(unsubscribe => unsubscribe());
      this.listeners.clear();
      this.connectionPool.cleanup();
    }
    
    this.cursorBatcher.flush();
    this.rateLimiter.cleanup();
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();