import { rtdb } from '@/lib/firebase';
import { 
  ref, 
  push, 
  onChildAdded, 
  serverTimestamp,
  DataSnapshot,
  off,
  query,
  orderByChild,
  startAt,
  get,
  set
} from 'firebase/database';

export interface CanvasOperation {
  id?: string;
  type: 'add' | 'update' | 'delete' | 'move' | 'resize' | 'style';
  elementIds: string[];
  data: any; // Operation-specific data
  userId: string;
  timestamp: number;
  clientId: string; // Unique client session ID for conflict resolution
}

export interface OperationCallbacks {
  onRemoteOperation?: (operation: CanvasOperation) => void;
  onSyncStateChange?: (isSyncing: boolean) => void;
  onConflict?: (local: CanvasOperation, remote: CanvasOperation) => CanvasOperation | null;
}

class OperationsService {
  private operationsRef: any = null;
  private listeners: Map<string, any> = new Map();
  private currentCanvasId: string | null = null;
  private currentUserId: string | null = null;
  private clientId: string;
  private callbacks: OperationCallbacks = {};
  private operationQueue: CanvasOperation[] = [];
  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private batchTimeout: NodeJS.Timeout | null = null;
  private offlineQueue: CanvasOperation[] = [];
  private isOnline = true;

  constructor() {
    this.clientId = this.generateClientId();
    this.setupOnlineListener();
  }

  private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushOfflineQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  async initializeOperations(
    canvasId: string,
    userId: string,
    callbacks?: OperationCallbacks
  ) {
    console.log('[OperationsService] initializeOperations called:', {
      canvasId,
      userId,
      currentCanvasId: this.currentCanvasId,
      currentUserId: this.currentUserId,
      hasRef: !!this.operationsRef,
      willInitialize: this.currentCanvasId !== canvasId || this.currentUserId !== userId
    });
    
    // Check if already properly initialized for this canvas and user
    if (this.currentCanvasId === canvasId && 
        this.currentUserId === userId && 
        this.operationsRef) {
      console.log('[OperationsService] Already initialized for this canvas and user');
      return; // Already initialized
    }

    // Clean up previous operations if switching canvases
    if (this.currentCanvasId && this.currentCanvasId !== canvasId) {
      // console.log('[OperationsService] Cleaning up previous canvas operations');
      await this.cleanup();
    }

    this.currentCanvasId = canvasId;
    this.currentUserId = userId;
    this.callbacks = callbacks || {};
    this.lastSyncTimestamp = Date.now();

    // Reference to operations for this canvas
    this.operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    // console.log('[OperationsService] Set RTDB reference:', `canvas-operations/${canvasId}`);

    // Listen to new operations
    const operationsQuery = query(
      this.operationsRef,
      orderByChild('timestamp'),
      startAt(this.lastSyncTimestamp)
    );
    
    // console.log('[OperationsService] Setting up RTDB listener for new operations');

    const unsubscribe = onChildAdded(operationsQuery, (snapshot: DataSnapshot) => {
      const operation = snapshot.val() as CanvasOperation;
      
      console.log('[OperationsService] 📡 Received operation from RTDB:', {
        type: operation?.type,
        clientId: operation?.clientId,
        isOurs: operation?.clientId === this.clientId,
        timestamp: operation?.timestamp,
        elementCount: operation?.elementIds?.length,
        hasCallback: !!this.callbacks.onRemoteOperation,
        dataKeys: operation?.data ? Object.keys(operation.data) : [],
        hasElements: !!(operation?.data?.elements),
        firstElement: operation?.data?.elements?.[0] ? {
          id: operation.data.elements[0].id,
          type: operation.data.elements[0].type,
          x: operation.data.elements[0].x,
          y: operation.data.elements[0].y
        } : null
      });
      
      if (!operation) {
        console.log('[OperationsService] ❌ Null operation received');
        return;
      }

      // Skip our own operations (we already applied them optimistically)
      if (operation.clientId === this.clientId) {
        console.log('[OperationsService] ⏭ Skipping our own operation');
        return;
      }

      // Skip old operations
      if (operation.timestamp < this.lastSyncTimestamp) {
        console.log('[OperationsService] ⏰ Skipping old operation:', {
          opTime: operation.timestamp,
          lastSync: this.lastSyncTimestamp
        });
        return;
      }

      console.log('[OperationsService] ✅ Processing remote operation:', {
        type: operation.type,
        elements: operation.elementIds?.length,
        userId: operation.userId
      });
      
      // Handle potential conflicts
      const conflictingLocal = this.findConflictingOperation(operation);
      if (conflictingLocal) {
        const resolved = this.resolveConflict(conflictingLocal, operation);
        if (resolved) {
          // console.log('[OperationsService] Calling onRemoteOperation callback (resolved conflict)');
          this.callbacks.onRemoteOperation?.(resolved);
        }
      } else {
        console.log('[OperationsService] 📤 Calling onRemoteOperation callback');
        if (this.callbacks.onRemoteOperation) {
          this.callbacks.onRemoteOperation(operation);
          console.log('[OperationsService] ✅ Callback executed');
        } else {
          console.error('[OperationsService] ❌ No onRemoteOperation callback!');
        }
      }

      this.lastSyncTimestamp = Math.max(this.lastSyncTimestamp, operation.timestamp);
    });

    this.listeners.set('operations', unsubscribe);

    // Load recent operations for initial sync
    await this.loadRecentOperations();
  }

  private async loadRecentOperations() {
    if (!this.operationsRef) return;

    try {
      // Get operations from last 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentQuery = query(
        this.operationsRef,
        orderByChild('timestamp'),
        startAt(fiveMinutesAgo)
      );

      const snapshot = await get(recentQuery);
      const operations: CanvasOperation[] = [];

      snapshot.forEach((child) => {
        const op = child.val() as CanvasOperation;
        if (op && op.clientId !== this.clientId) {
          operations.push(op);
        }
      });

      // Sort by timestamp and apply
      operations.sort((a, b) => a.timestamp - b.timestamp);
      operations.forEach(op => {
        this.callbacks.onRemoteOperation?.(op);
      });

      if (operations.length > 0) {
        this.lastSyncTimestamp = operations[operations.length - 1].timestamp;
      }
    } catch (error) {
      console.error('Failed to load recent operations:', error);
    }
  }

  private findConflictingOperation(remote: CanvasOperation): CanvasOperation | null {
    // Check if any queued operations conflict with the remote operation
    return this.operationQueue.find(local => {
      // Operations on same elements might conflict
      const hasCommonElements = local.elementIds.some(id => 
        remote.elementIds.includes(id)
      );

      if (!hasCommonElements) return false;

      // Check if operations happened close in time (within 1 second)
      const timeDiff = Math.abs(local.timestamp - remote.timestamp);
      return timeDiff < 1000;
    }) || null;
  }

  private resolveConflict(
    local: CanvasOperation, 
    remote: CanvasOperation
  ): CanvasOperation | null {
    // Allow custom conflict resolution
    if (this.callbacks.onConflict) {
      return this.callbacks.onConflict(local, remote);
    }

    // Default: Last-write-wins based on timestamp
    // If timestamps are equal, use clientId for deterministic ordering
    if (remote.timestamp > local.timestamp) {
      return remote;
    } else if (remote.timestamp < local.timestamp) {
      return null; // Keep local
    } else {
      // Same timestamp, use clientId for deterministic resolution
      return remote.clientId > local.clientId ? remote : null;
    }
  }

  async queueOperation(operation: Omit<CanvasOperation, 'userId' | 'clientId' | 'timestamp'>) {
    console.log('[OperationsService] queueOperation called:', {
      hasUserId: !!this.currentUserId,
      currentUserId: this.currentUserId,
      hasCanvasId: !!this.currentCanvasId,
      currentCanvasId: this.currentCanvasId,
      hasRef: !!this.operationsRef,
      operationType: operation.type
    });
    
    if (!this.currentUserId) {
      console.error('[OperationsService] ❌ Cannot queue operation: no user ID (service not initialized)');
      console.log('[OperationsService] Service state:', {
        currentCanvasId: this.currentCanvasId,
        currentUserId: this.currentUserId,
        hasRef: !!this.operationsRef,
        isOnline: this.isOnline
      });
      return;
    }
    
    if (!this.currentCanvasId || !this.operationsRef) {
      console.error('[OperationsService] ❌ Cannot queue operation: missing canvas or ref', {
        canvasId: this.currentCanvasId,
        hasRef: !!this.operationsRef
      });
      return;
    }

    const fullOperation: CanvasOperation = {
      ...operation,
      userId: this.currentUserId,
      clientId: this.clientId,
      timestamp: Date.now()
    };

    console.log('[OperationsService] Adding to queue:', {
      canvasId: this.currentCanvasId,
      type: fullOperation.type,
      queueLengthBefore: this.operationQueue.length
    });
    
    this.operationQueue.push(fullOperation);
    
    console.log('[OperationsService] Queue after adding:', {
      queueLength: this.operationQueue.length,
      isOnline: this.isOnline
    });

    if (!this.isOnline) {
      this.offlineQueue.push(fullOperation);
      console.log('[OperationsService] Added to offline queue (offline mode)');
      return;
    }

    // Batch operations for better performance
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    console.log('[OperationsService] Scheduling flush in 50ms');
    this.batchTimeout = setTimeout(() => {
      console.log('[OperationsService] Batch timeout triggered, flushing...');
      this.flushOperations();
    }, 50); // Batch operations within 50ms window
  }

  private async flushOperations() {
    if (this.operationQueue.length === 0 || !this.operationsRef) {
      console.log('[OperationsService] Flush skipped:', {
        queueLength: this.operationQueue.length,
        hasRef: !!this.operationsRef,
        currentCanvasId: this.currentCanvasId
      });
      return;
    }

    console.log('[OperationsService] Flushing operations:', {
      count: this.operationQueue.length,
      canvasId: this.currentCanvasId,
      path: `canvas-operations/${this.currentCanvasId}`,
      operations: this.operationQueue.map(op => ({
        type: op.type,
        elementCount: op.elementIds.length
      }))
    });
    
    this.isSyncing = true;
    this.callbacks.onSyncStateChange?.(true);

    try {
      // Send all queued operations
      const promises = this.operationQueue.map(op => {
        console.log('[OperationsService] Pushing to RTDB:', {
          type: op.type,
          elements: op.elementIds.length,
          timestamp: op.timestamp,
          userId: op.userId
        });
        return push(this.operationsRef, op);
      });

      await Promise.all(promises);
      
      console.log('[OperationsService] ✅ Successfully sent', this.operationQueue.length, 'operations to RTDB');
      // Clear successfully sent operations
      this.operationQueue = [];
    } catch (error: any) {
      console.error('[OperationsService] ❌ Failed to sync operations:', {
        error: error.message,
        code: error.code,
        canvasId: this.currentCanvasId
      });
      // Keep operations in queue for retry
      if (!this.isOnline) {
        this.offlineQueue.push(...this.operationQueue);
        this.operationQueue = [];
      }
    } finally {
      this.isSyncing = false;
      this.callbacks.onSyncStateChange?.(false);
    }
  }

  private async flushOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.operationsRef) return;

    console.log(`Syncing ${this.offlineQueue.length} offline operations`);

    try {
      const promises = this.offlineQueue.map(op => 
        push(this.operationsRef, op)
      );

      await Promise.all(promises);
      this.offlineQueue = [];
      console.log('Offline operations synced successfully');
    } catch (error) {
      console.error('Failed to sync offline operations:', error);
    }
  }

  async forceSync() {
    await this.flushOperations();
    await this.flushOfflineQueue();
  }

  getQueueSize(): number {
    return this.operationQueue.length + this.offlineQueue.length;
  }

  isSynced(): boolean {
    return !this.isSyncing && 
           this.operationQueue.length === 0 && 
           this.offlineQueue.length === 0;
  }

  async cleanup() {
    console.log('[OperationsService] Cleanup called for canvas:', this.currentCanvasId);
    
    // Flush any remaining operations
    await this.flushOperations();

    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Remove listeners
    if (this.operationsRef) {
      const unsubscribe = this.listeners.get('operations');
      if (unsubscribe) {
        off(this.operationsRef, 'child_added', unsubscribe);
      }
    }

    // Clear state
    this.listeners.clear();
    this.operationQueue = [];
    this.offlineQueue = [];
    this.currentCanvasId = null;
    this.currentUserId = null;
    this.operationsRef = null;
    this.callbacks = {};
    
    console.log('[OperationsService] Cleanup completed');
  }
}

// Export singleton instance
export const operationsService = new OperationsService();