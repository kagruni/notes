import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { operationsService, CanvasOperation, OperationCallbacks } from '@/services/operations';

interface UseOperationsOptions {
  canvasId: string;
  enabled?: boolean;
  callbacks?: OperationCallbacks;
}

export function useOperations({ canvasId, enabled = true, callbacks }: UseOperationsOptions) {
  const [user] = useAuthState(auth);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const initRef = useRef(false);
  const previousCanvasId = useRef<string | null>(null);
  const callbacksRef = useRef<OperationCallbacks | undefined>(callbacks);
  
  // Update callbacks ref whenever they change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    console.log('[useOperations] 🔍 Hook effect triggered:', {
      hasUser: !!user,
      userId: user?.uid,
      canvasId: canvasId,
      enabled: enabled,
      wasInitialized: isInitialized
    });
    
    if (!user || !canvasId || !enabled) {
      console.log('[useOperations] ⛔ Skipping init - missing requirements:', {
        user: !!user,
        canvasId: !!canvasId,
        enabled,
        reason: !user ? 'No user' : !canvasId ? 'No canvas ID' : 'Not enabled'
      });
      return;
    }

    console.log('[useOperations] ✅ Starting initialization for canvas:', canvasId, 'user:', user.uid);

    const initOperations = async () => {
      try {
        await operationsService.initializeOperations(
          canvasId,
          user.uid,
          {
            onRemoteOperation: (operation) => {
              console.log('[useOperations] Forwarding remote operation to callback');
              callbacksRef.current?.onRemoteOperation?.(operation);
            },
            onSyncStateChange: (syncing) => {
              setIsSyncing(syncing);
              callbacksRef.current?.onSyncStateChange?.(syncing);
            },
            onConflict: callbacksRef.current?.onConflict
          }
        );

        console.log('[useOperations] Operations initialized successfully for canvas:', canvasId);
        setIsInitialized(true);
      } catch (error) {
        console.error('[useOperations] Failed to initialize operations:', error);
        setIsInitialized(false);
      }
    };

    initOperations();

    // Store current canvas ID for cleanup detection
    previousCanvasId.current = canvasId;
    
    return () => {
      // Don't cleanup here - it causes issues with callback references
      // Cleanup will happen in the unmount effect
    };
  }, [user?.uid, canvasId, enabled]); // Remove callbacks from dependencies
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[useOperations] Component unmounting, cleaning up...');
      operationsService.cleanup().catch(console.error);
    };
  }, []); // Empty deps - only run on unmount

  const queueOperation = useCallback(async (
    type: CanvasOperation['type'],
    elementIds: string[],
    data: any
  ) => {
    console.log('[useOperations] queueOperation called:', {
      isInitialized,
      type,
      elementIds: elementIds.length,
      hasData: !!data
    });
    
    if (!isInitialized) {
      console.warn('[useOperations] Cannot queue operation - not initialized');
      return;
    }

    console.log('[useOperations] Passing to service:', { 
      type, 
      elementIds: elementIds.length,
      dataKeys: Object.keys(data || {})
    });
    
    try {
      await operationsService.queueOperation({
        type,
        elementIds,
        data
      });

      const newSize = operationsService.getQueueSize();
      console.log('[useOperations] Queue size after operation:', newSize);
      setQueueSize(newSize);
    } catch (error) {
      console.error('[useOperations] Failed to queue operation:', error);
      // Try to re-initialize if the service was cleared
      if (user && canvasId && enabled) {
        console.log('[useOperations] Attempting to re-initialize after failure');
        setIsInitialized(false);
        // Will re-initialize on next effect run
      }
    }
  }, [isInitialized, user, canvasId, enabled]);

  const forceSync = useCallback(async () => {
    if (!isInitialized) return;

    await operationsService.forceSync();
    setQueueSize(operationsService.getQueueSize());
  }, [isInitialized]);

  const isSynced = useCallback(() => {
    return operationsService.isSynced();
  }, []);

  // Update queue size periodically
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      setQueueSize(operationsService.getQueueSize());
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  return {
    queueOperation,
    forceSync,
    isSyncing,
    queueSize,
    isSynced,
    isInitialized
  };
}