'use client';

import { useState, useEffect } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue, push } from 'firebase/database';

interface SyncDebuggerProps {
  canvasId: string;
  userId: string;
}

export default function SyncDebugger({ canvasId, userId }: SyncDebuggerProps) {
  const [operationLog, setOperationLog] = useState<any[]>([]);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!canvasId) return;

    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    
    console.log('[SyncDebugger] Setting up listener for path:', `canvas-operations/${canvasId}`);
    
    const unsubscribe = onValue(operationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ops = Object.entries(data).map(([key, value]: [string, any]) => ({
          key,
          ...value
        }));
        
        // Sort by timestamp descending
        ops.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Keep only last 10 operations
        const recentOps = ops.slice(0, 10);
        
        console.log('[SyncDebugger] Received operations update:', {
          total: ops.length,
          recent: recentOps.length,
          latest: recentOps[0]
        });
        
        setOperationLog(recentOps);
        setListening(true);
      } else {
        console.log('[SyncDebugger] No operations in database');
        setOperationLog([]);
        setListening(true);
      }
    }, (error) => {
      console.error('[SyncDebugger] Error listening to operations:', error);
      setListening(false);
    });

    return () => unsubscribe();
  }, [canvasId]);

  const sendDirectOperation = async () => {
    const testOp = {
      type: 'add',
      elementIds: ['sync-test-' + Date.now()],
      data: {
        elements: [{
          id: 'sync-test-' + Date.now(),
          type: 'rectangle',
          x: Math.random() * 500,
          y: Math.random() * 500,
          width: 100,
          height: 100,
          strokeColor: '#FF0000',
          backgroundColor: '#FFCCCC'
        }]
      },
      userId,
      clientId: 'sync-debugger',
      timestamp: Date.now()
    };

    try {
      const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
      await push(operationsRef, testOp);
      console.log('[SyncDebugger] Sent test operation directly to RTDB');
    } catch (error) {
      console.error('[SyncDebugger] Failed to send operation:', error);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 bg-black/90 text-white rounded-lg p-4 shadow-xl z-50 w-96 max-h-96 overflow-auto">
      <h3 className="font-bold text-sm mb-2 text-green-400">
        🔍 Sync Debugger - {listening ? '🟢 Live' : '🔴 Not Connected'}
      </h3>
      
      <div className="mb-3">
        <div className="text-xs text-gray-400">Canvas: {canvasId.slice(0, 8)}...</div>
        <div className="text-xs text-gray-400">User: {userId.slice(0, 8)}...</div>
        <div className="text-xs text-gray-400">Path: canvas-operations/{canvasId}</div>
      </div>

      <button
        onClick={sendDirectOperation}
        className="w-full mb-3 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
      >
        Send Direct RTDB Operation
      </button>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-yellow-400">
          Recent Operations ({operationLog.length}):
        </div>
        
        {operationLog.length === 0 ? (
          <div className="text-xs text-gray-500">No operations yet...</div>
        ) : (
          operationLog.map((op, index) => (
            <div 
              key={op.key} 
              className={`text-xs p-2 rounded ${
                op.clientId === 'sync-debugger' 
                  ? 'bg-green-900/50 border border-green-500' 
                  : op.userId === userId 
                    ? 'bg-blue-900/50 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-cyan-400">{op.type}</span>
                  {' - '}
                  <span className="text-yellow-400">{op.elementIds?.length || 0} elements</span>
                </div>
                <div className="text-gray-400">
                  {new Date(op.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="mt-1 text-gray-400">
                <div>Client: {op.clientId}</div>
                <div>User: {op.userId === userId ? 'You' : op.userId?.slice(0, 8) + '...'}</div>
                {op.data?.elements?.[0] && (
                  <div>Element: {op.data.elements[0].type} @ ({Math.round(op.data.elements[0].x)}, {Math.round(op.data.elements[0].y)})</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-yellow-400">
          🎯 What to check:
        </div>
        <ol className="text-xs text-gray-400 mt-1 space-y-1">
          <li>1. Draw something - operation should appear here</li>
          <li>2. Check if it shows in BOTH windows</li>
          <li>3. Blue = your ops, Gray = others</li>
          <li>4. Green = test operations</li>
        </ol>
      </div>
    </div>
  );
}