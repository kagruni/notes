/**
 * Performance utilities for canvas collaboration
 */

import { Collaborator } from '@/types';

interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Check if a cursor position is within the viewport
 */
export function isCursorInViewport(
  cursor: { x: number; y: number },
  viewport: ViewportBounds
): boolean {
  return (
    cursor.x >= viewport.left &&
    cursor.x <= viewport.right &&
    cursor.y >= viewport.top &&
    cursor.y <= viewport.bottom
  );
}

/**
 * Filter collaborators to only those visible in viewport
 */
export function getVisibleCollaborators(
  collaborators: Collaborator[],
  viewport: ViewportBounds
): Collaborator[] {
  return collaborators.filter(collab => 
    collab.cursor && isCursorInViewport(collab.cursor, viewport)
  );
}

/**
 * Debounce function for optimizing frequent updates
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Memory cleanup utilities
 */
export class MemoryManager {
  private cleanupCallbacks: Set<() => void> = new Set();
  
  register(cleanup: () => void): void {
    this.cleanupCallbacks.add(cleanup);
  }
  
  unregister(cleanup: () => void): void {
    this.cleanupCallbacks.delete(cleanup);
  }
  
  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    this.cleanupCallbacks.clear();
  }
}

/**
 * Connection pooling for Firebase listeners
 */
export class ConnectionPool {
  private connections: Map<string, { 
    unsubscribe: () => void;
    refCount: number;
  }> = new Map();
  
  add(key: string, unsubscribe: () => void): void {
    const existing = this.connections.get(key);
    if (existing) {
      existing.refCount++;
    } else {
      this.connections.set(key, { unsubscribe, refCount: 1 });
    }
  }
  
  remove(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      connection.refCount--;
      if (connection.refCount <= 0) {
        connection.unsubscribe();
        this.connections.delete(key);
      }
    }
  }
  
  cleanup(): void {
    this.connections.forEach(({ unsubscribe }) => unsubscribe());
    this.connections.clear();
  }
}

/**
 * Conflict detection for concurrent edits
 */
export interface VersionedData<T> {
  data: T;
  version: number;
  timestamp: number;
}

export class ConflictDetector<T> {
  private lastKnownVersion: number = 0;
  
  detectConflict(local: VersionedData<T>, remote: VersionedData<T>): boolean {
    return local.version !== remote.version && 
           local.timestamp < remote.timestamp;
  }
  
  resolveConflict(
    local: VersionedData<T>, 
    remote: VersionedData<T>,
    resolver?: (local: T, remote: T) => T
  ): VersionedData<T> {
    if (this.detectConflict(local, remote)) {
      return {
        data: resolver ? resolver(local.data, remote.data) : remote.data,
        version: remote.version + 1,
        timestamp: Date.now()
      };
    }
    return local;
  }
  
  updateVersion(version: number): void {
    this.lastKnownVersion = Math.max(this.lastKnownVersion, version);
  }
}

/**
 * Batch operations for optimized updates
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private processDelay: number;
  
  constructor(
    private processor: (batch: T[]) => Promise<void>,
    options: { batchSize?: number; delay?: number } = {}
  ) {
    this.batchSize = options.batchSize || 10;
    this.processDelay = options.delay || 100;
  }
  
  add(item: T): void {
    this.queue.push(item);
    if (!this.processing) {
      this.scheduleProcessing();
    }
  }
  
  private scheduleProcessing(): void {
    this.processing = true;
    
    setTimeout(async () => {
      if (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        try {
          await this.processor(batch);
        } catch (error) {
          console.error('Batch processing error:', error);
        }
        
        if (this.queue.length > 0) {
          this.scheduleProcessing();
        } else {
          this.processing = false;
        }
      } else {
        this.processing = false;
      }
    }, this.processDelay);
  }
  
  flush(): Promise<void> {
    return new Promise(resolve => {
      const checkComplete = () => {
        if (this.queue.length === 0 && !this.processing) {
          resolve();
        } else {
          setTimeout(checkComplete, 50);
        }
      };
      checkComplete();
    });
  }
}