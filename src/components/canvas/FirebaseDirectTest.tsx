'use client';

import { useState, useEffect } from 'react';
import { ref, push, onChildAdded, off } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function FirebaseDirectTest({ 
  canvasId,
  excalidrawAPI 
}: { 
  canvasId: string;
  excalidrawAPI: any;
}) {
  const [status, setStatus] = useState('');
  const [receivedOps, setReceivedOps] = useState<any[]>([]);
  const [CaptureUpdateAction, setCaptureUpdateAction] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    import('@excalidraw/excalidraw').then(mod => {
      setCaptureUpdateAction(mod.CaptureUpdateAction);
    });
  }, []);

  useEffect(() => {
    if (!canvasId) return;

    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    
    const handleNewOperation = (snapshot: any) => {
      const op = snapshot.val();
      console.log('[FirebaseDirectTest] 🔥 Received operation:', op);
      
      if (op) {
        setReceivedOps(prev => [...prev.slice(-4), {
          key: snapshot.key,
          ...op,
          time: new Date().toLocaleTimeString()
        }]);

        // If it's not our operation, try to apply it
        if (op.userId !== user?.uid && excalidrawAPI && CaptureUpdateAction) {
          console.log('[FirebaseDirectTest] Applying remote operation to canvas');
          
          const elements = excalidrawAPI.getSceneElements();
          
          // Simple test: if operation is an update, move the element
          if (op.type === 'update' && op.data?.elements?.[0]) {
            const updateEl = op.data.elements[0];
            const newElements = elements.map((el: any) => {
              if (el.id === updateEl.id) {
                return {
                  ...el,
                  x: updateEl.x,
                  y: updateEl.y,
                  version: (el.version || 0) + 1,
                  versionNonce: Math.floor(Math.random() * 2000000000)
                };
              }
              return el;
            });

            excalidrawAPI.updateScene({
              elements: newElements,
              captureUpdate: CaptureUpdateAction.NEVER
            });
            
            setStatus(`Applied update for element ${updateEl.id}`);
          }
        }
      }
    };

    onChildAdded(operationsRef, handleNewOperation);

    return () => {
      off(operationsRef, 'child_added', handleNewOperation);
    };
  }, [canvasId, user?.uid, excalidrawAPI, CaptureUpdateAction]);

  const sendTestOperation = async () => {
    if (!canvasId || !excalidrawAPI || !user) {
      setStatus('Not ready');
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }

    const firstEl = elements[0];
    const testOp = {
      type: 'update',
      elementIds: [firstEl.id],
      data: {
        elements: [{
          id: firstEl.id,
          type: firstEl.type,
          x: firstEl.x + 50,
          y: firstEl.y + 50
        }]
      },
      userId: user.uid,
      clientId: 'test-' + Date.now(),
      timestamp: Date.now()
    };

    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    await push(operationsRef, testOp);
    
    setStatus(`Sent update for ${firstEl.id}`);
    console.log('[FirebaseDirectTest] 📤 Sent operation:', testOp);
  };

  const clearOperations = () => {
    setReceivedOps([]);
    setStatus('Cleared');
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-orange-600 text-white p-3 rounded-lg shadow-lg max-w-sm">
      <div className="text-sm font-bold mb-2">Firebase Direct Test</div>
      
      <div className="space-y-2">
        <button
          onClick={sendTestOperation}
          className="w-full px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded text-xs"
        >
          Send Test Operation
        </button>
        
        <button
          onClick={clearOperations}
          className="w-full px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded text-xs"
        >
          Clear Log
        </button>
      </div>

      {status && (
        <div className="mt-2 text-xs p-1 bg-black/30 rounded">
          {status}
        </div>
      )}

      <div className="mt-2">
        <div className="text-xs font-semibold">Recent Operations:</div>
        <div className="text-xs bg-black/30 p-1 rounded mt-1 max-h-32 overflow-auto">
          {receivedOps.length === 0 ? (
            <div>No operations yet</div>
          ) : (
            receivedOps.map((op, i) => (
              <div key={i} className="mb-1 border-b border-white/20 pb-1">
                <div>{op.time} - {op.type}</div>
                <div>User: {op.userId === user?.uid ? 'YOU' : op.userId?.slice(-6)}</div>
                <div>Elements: {op.elementIds?.join(', ')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}