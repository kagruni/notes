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

  useEffect(() => {
    console.log('[useOperations] Hook check:', {
      hasUser: !!user,
      userId: user?.uid,
      canvasId: canvasId,
      enabled: enabled
    });
    
    if (!user || !canvasId || !enabled) {
      console.log('[useOperations] Skipping init - missing requirements:', {
        user: !!user,
        canvasId: !!canvasId,
        enabled
      });
      return;
    }

    console.log('[useOperations] Initializing operations for canvas:', canvasId, 'user:', user.uid);

    const initOperations = async () => {
      try {
        await operationsService.initializeOperations(
          canvasId,
          user.uid,
          {
            ...callbacks,
            onSyncStateChange: (syncing) => {
              setIsSyncing(syncing);
              callbacks?.onSyncStateChange?.(syncing);
            }
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

    return () => {
      console.log('[useOperations] Cleaning up operations for canvas:', canvasId);
      operationsService.cleanup().catch(console.error);
      setIsInitialized(false);
      setIsSyncing(false);
    };
  }, [user, canvasId, enabled]); // Remove callbacks from dependencies

  const queueOperation = useCallback(async (
    type: CanvasOperation['type'],
    elementIds: string[],
    data: any
  ) => {
    if (!isInitialized) {
      console.warn('[useOperations] Cannot queue operation - not initialized');
      return;
    }

    console.log('[useOperations] Queueing operation:', { type, elementIds: elementIds.length });
    await operationsService.queueOperation({
      type,
      elementIds,
      data
    });

    setQueueSize(operationsService.getQueueSize());
  }, [isInitialized]);

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