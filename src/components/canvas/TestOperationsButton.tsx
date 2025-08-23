'use client';

import { operationsService } from '@/services/operations';

export default function TestOperationsButton() {
  const testDirectOperation = async () => {
    console.log('[TEST] Direct operation test starting...');
    
    // Check service state
    console.log('[TEST] Service state:', {
      currentCanvasId: (operationsService as any).currentCanvasId,
      currentUserId: (operationsService as any).currentUserId,
      hasRef: !!(operationsService as any).operationsRef,
      queueLength: operationsService.getQueueSize()
    });
    
    // Try to queue an operation directly
    const testOp = {
      type: 'add' as const,
      elementIds: ['direct-test-' + Date.now()],
      data: {
        elements: [{
          id: 'direct-test-' + Date.now(),
          type: 'rectangle',
          x: 200,
          y: 200,
          width: 100,
          height: 100
        }]
      }
    };
    
    console.log('[TEST] Queueing operation directly...');
    await operationsService.queueOperation(testOp);
    
    console.log('[TEST] After queue:', {
      queueSize: operationsService.getQueueSize()
    });
    
    // Force flush
    console.log('[TEST] Forcing sync...');
    await operationsService.forceSync();
    
    console.log('[TEST] After force sync:', {
      queueSize: operationsService.getQueueSize(),
      isSynced: operationsService.isSynced()
    });
  };
  
  return (
    <button
      onClick={testDirectOperation}
      className="fixed bottom-4 right-4 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg hover:bg-purple-700 z-50"
    >
      Test Direct Op
    </button>
  );
}