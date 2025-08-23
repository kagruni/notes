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
      
      // Only cleanup if we were previously initialized
      if (isInitialized) {
        console.log('[useOperations] Was initialized, cleaning up...');
        operationsService.cleanup().catch(console.error);
        setIsInitialized(false);
      }
      return;
    }

    console.log('[useOperations] ✅ Starting initialization for canvas:', canvasId, 'user:', user.uid);

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

    // Store current canvas ID for cleanup detection
    previousCanvasId.current = canvasId;
    
    return () => {
      // Only cleanup when canvas actually changes or component unmounts
      if (previousCanvasId.current && previousCanvasId.current !== canvasId) {
        console.log('[useOperations] Canvas changed, cleaning up old canvas:', previousCanvasId.current);
        operationsService.cleanup().catch(console.error);
        setIsInitialized(false);
        setIsSyncing(false);
      }
    };
  }, [user?.uid, canvasId, enabled]); // Use user.uid instead of user object
  
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
    
    await operationsService.queueOperation({
      type,
      elementIds,
      data
    });

    const newSize = operationsService.getQueueSize();
    console.log('[useOperations] Queue size after operation:', newSize);
    setQueueSize(newSize);
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