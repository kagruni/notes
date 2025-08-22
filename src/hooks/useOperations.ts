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
    if (!user || !canvasId || !enabled || initRef.current) return;

    const initOperations = async () => {
      try {
        initRef.current = true;
        
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

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize operations:', error);
        setIsInitialized(false);
      }
    };

    initOperations();

    return () => {
      if (initRef.current) {
        operationsService.cleanup().catch(console.error);
        initRef.current = false;
        setIsInitialized(false);
        setIsSyncing(false);
      }
    };
  }, [user, canvasId, enabled]); // Remove callbacks from dependencies

  const queueOperation = useCallback(async (
    type: CanvasOperation['type'],
    elementIds: string[],
    data: any
  ) => {
    if (!isInitialized) return;

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