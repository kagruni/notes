'use client';

import { useState, useEffect } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue, push, set } from 'firebase/database';

interface DiagnosticPanelProps {
  canvasId: string;
  userId: string;
  collaborationEnabled: boolean;
  operationsInitialized: boolean;
}

export default function DiagnosticPanel({ 
  canvasId, 
  userId, 
  collaborationEnabled,
  operationsInitialized 
}: DiagnosticPanelProps) {
  console.log('[DiagnosticPanel] Status:', {
    canvasId,
    userId,
    collaborationEnabled,
    operationsInitialized
  });
  const [diagnostics, setDiagnostics] = useState({
    canvasId: '',
    rtdbConnected: false,
    operationsPath: '',
    operationCount: 0,
    lastOperation: null as any,
    listenerActive: false,
    canSendTest: false,
    errors: [] as string[],
    lastUserOperation: null as any
  });

  useEffect(() => {
    if (!canvasId || !userId) return;

    const operationsPath = `canvas-operations/${canvasId}`;
    setDiagnostics(prev => ({ 
      ...prev, 
      canvasId, 
      operationsPath,
      canSendTest: true 
    }));

    // Set up listener to verify RTDB connection
    const operationsRef = ref(rtdb, operationsPath);
    const unsubscribe = onValue(
      operationsRef,
      (snapshot) => {
        const data = snapshot.val();
        const operations = data ? Object.values(data) : [];
        const lastOp = operations.length > 0 
          ? operations.sort((a: any, b: any) => b.timestamp - a.timestamp)[0]
          : null;
        
        // Find last user operation (not test)
        const userOps = operations.filter((op: any) => op.clientId !== 'diagnostic-test');
        const lastUserOp = userOps.length > 0
          ? userOps.sort((a: any, b: any) => b.timestamp - a.timestamp)[0]
          : null;

        setDiagnostics(prev => ({
          ...prev,
          rtdbConnected: true,
          listenerActive: true,
          operationCount: operations.length,
          lastOperation: lastOp,
          lastUserOperation: lastUserOp
        }));
      },
      (error) => {
        setDiagnostics(prev => ({
          ...prev,
          rtdbConnected: false,
          errors: [...prev.errors, `RTDB Error: ${error.message}`]
        }));
      }
    );

    return () => unsubscribe();
  }, [canvasId, userId]);

  const sendTestOperation = async () => {
    if (!canvasId || !userId) {
      console.error('[Diagnostic] Missing canvasId or userId');
      return;
    }

    const testOp = {
      type: 'test',
      elementIds: ['test-element-' + Date.now()],
      data: { test: true, timestamp: Date.now() },
      userId: userId,
      clientId: 'diagnostic-test',
      timestamp: Date.now()
    };

    try {
      console.log('[Diagnostic] Sending test operation:', testOp);
      const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
      await push(operationsRef, testOp);
      console.log('[Diagnostic] Test operation sent successfully');
    } catch (error: any) {
      console.error('[Diagnostic] Failed to send test operation:', error);
      setDiagnostics(prev => ({
        ...prev,
        errors: [...prev.errors, `Send Error: ${error.message}`]
      }));
    }
  };
  
  const sendCanvasOperation = async () => {
    if (!canvasId || !userId) {
      console.error('[Diagnostic] Missing canvasId or userId');
      return;
    }

    // Create a real canvas operation that mimics adding a rectangle
    const elementId = 'manual-rect-' + Date.now();
    const canvasOp = {
      type: 'add',
      elementIds: [elementId],
      data: {
        elements: [{
          id: elementId,
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 200,
          height: 100,
          angle: 0,
          strokeColor: '#000000',
          backgroundColor: 'transparent',
          fillStyle: 'hachure',
          strokeWidth: 1,
          roughness: 1,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: Math.floor(Math.random() * 1000000),
          versionNonce: Math.floor(Math.random() * 1000000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false
        }]
      },
      userId: userId,
      clientId: 'diagnostic-canvas-test',
      timestamp: Date.now()
    };

    try {
      console.log('[Diagnostic] Sending CANVAS operation:', canvasOp);
      const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
      await push(operationsRef, canvasOp);
      console.log('[Diagnostic] Canvas operation sent successfully');
      alert('Canvas operation sent! Check if a rectangle appears in other window.');
    } catch (error: any) {
      console.error('[Diagnostic] Failed to send canvas operation:', error);
      setDiagnostics(prev => ({
        ...prev,
        errors: [...prev.errors, `Canvas Op Error: ${error.message}`]
      }));
    }
  };

  const clearOperations = async () => {
    if (!canvasId) return;
    
    try {
      const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
      await set(operationsRef, null);
      console.log('[Diagnostic] Cleared all operations');
    } catch (error: any) {
      console.error('[Diagnostic] Failed to clear operations:', error);
    }
  };

  return (
    <div className="fixed top-20 right-4 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg p-4 shadow-xl z-50 w-80">
      <h3 className="font-bold text-sm mb-3 text-blue-600">🔍 Real-time Sync Diagnostics</h3>
      
      {/* Critical Status Banner */}
      {!collaborationEnabled && (
        <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-500 rounded text-xs">
          ⚠️ Collaboration is DISABLED - Enable it in Share modal!
        </div>
      )}
      {collaborationEnabled && !operationsInitialized && (
        <div className="mb-3 p-2 bg-orange-100 dark:bg-orange-900/20 border border-orange-500 rounded text-xs">
          🔄 Operations initializing...
        </div>
      )}
      {collaborationEnabled && operationsInitialized && (
        <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/20 border border-green-500 rounded text-xs">
          ✅ Ready for real-time sync!
        </div>
      )}
      
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>Canvas ID:</div>
          <div className="font-mono truncate">{diagnostics.canvasId || 'Not set'}</div>
          
          <div>RTDB Path:</div>
          <div className="font-mono truncate text-xs">{diagnostics.operationsPath || 'Not set'}</div>
          
          <div>RTDB Status:</div>
          <div className={diagnostics.rtdbConnected ? 'text-green-600' : 'text-red-600'}>
            {diagnostics.rtdbConnected ? '✅ Connected' : '❌ Disconnected'}
          </div>
          
          <div>Listener:</div>
          <div className={diagnostics.listenerActive ? 'text-green-600' : 'text-yellow-600'}>
            {diagnostics.listenerActive ? '✅ Active' : '⚠️ Inactive'}
          </div>
          
          <div>Collaboration:</div>
          <div className={collaborationEnabled ? 'text-green-600' : 'text-red-600'}>
            {collaborationEnabled ? '✅ Enabled' : '❌ Disabled'}
          </div>
          
          <div>Operations Init:</div>
          <div className={operationsInitialized ? 'text-green-600' : 'text-red-600'}>
            {operationsInitialized ? '✅ Ready' : '❌ Not Ready'}
          </div>
          
          <div>Op Count:</div>
          <div className="font-bold">{diagnostics.operationCount}</div>
          
          {diagnostics.lastOperation && (
            <>
              <div>Last Op:</div>
              <div className="truncate">{diagnostics.lastOperation.type}</div>
              
              <div>Last Time:</div>
              <div>{new Date(diagnostics.lastOperation.timestamp).toLocaleTimeString()}</div>
            </>
          )}
          
          {diagnostics.lastUserOperation && (
            <>
              <div className="col-span-2 mt-2 border-t pt-2">User Canvas Operations:</div>
              <div>Type:</div>
              <div className="text-blue-600 font-bold">{diagnostics.lastUserOperation.type}</div>
              <div>Elements:</div>
              <div className="text-blue-600">{diagnostics.lastUserOperation.elementIds?.length || 0}</div>
              <div>User:</div>
              <div className="truncate text-xs">{diagnostics.lastUserOperation.userId}</div>
            </>
          )}
        </div>

        {diagnostics.errors.length > 0 && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="font-semibold text-red-600 mb-1">Errors:</div>
            {diagnostics.errors.map((err, i) => (
              <div key={i} className="text-red-500 text-xs">{err}</div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={sendTestOperation}
            disabled={!diagnostics.canSendTest}
            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
          >
            Send Test Op
          </button>
          <button
            onClick={sendCanvasOperation}
            disabled={!diagnostics.canSendTest}
            className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
          >
            Send Canvas Op
          </button>
          <button
            onClick={clearOperations}
            className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Clear All
          </button>
        </div>

        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          <div className="font-semibold mb-1">Diagnostic Steps:</div>
          <ol className="text-xs space-y-1">
            <li>1. Click "Send Test Op" - should update in both windows ✅</li>
            <li>2. Draw/move elements on canvas</li>
            <li>3. Check "User Canvas Operations" section</li>
            <li>4. If no user ops appear, check console for errors</li>
            <li>5. Look for "[OperationsService]" logs in console</li>
          </ol>
        </div>
      </div>
    </div>
  );
}