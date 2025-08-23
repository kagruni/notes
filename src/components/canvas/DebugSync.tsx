'use client';

import { useEffect, useState } from 'react';
import { ref, push, onChildAdded, off } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugSync({ canvasId }: { canvasId: string }) {
  const [operations, setOperations] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!canvasId) return;

    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    
    const handleNewOp = (snapshot: any) => {
      const op = snapshot.val();
      console.log('[DebugSync] 🔥 New operation:', op);
      
      if (op) {
        setOperations(prev => [...prev.slice(-9), {
          key: snapshot.key,
          ...op,
          time: new Date().toLocaleTimeString()
        }]);
      }
    };

    onChildAdded(operationsRef, handleNewOp);

    return () => {
      off(operationsRef, 'child_added', handleNewOp);
    };
  }, [canvasId]);

  const sendTestOp = async () => {
    if (!canvasId || !user) {
      setStatus('Missing canvas or user');
      return;
    }

    const testOp = {
      type: 'test',
      elementIds: ['test-' + Date.now()],
      data: { test: true },
      userId: user.uid,
      clientId: 'debug-' + Date.now(),
      timestamp: Date.now()
    };

    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    await push(operationsRef, testOp);
    setStatus('Test operation sent');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '300px',
      maxHeight: '400px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 100000,
      overflow: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        🔍 Debug Sync - Canvas: {canvasId?.slice(-6)}
      </div>
      
      <button
        onClick={sendTestOp}
        style={{
          padding: '5px 10px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '10px',
          width: '100%'
        }}
      >
        Send Test Operation
      </button>
      
      {status && (
        <div style={{
          padding: '5px',
          backgroundColor: 'rgba(76, 175, 80, 0.3)',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          {status}
        </div>
      )}
      
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        Operations ({operations.length}):
      </div>
      
      {operations.length === 0 ? (
        <div>No operations yet</div>
      ) : (
        operations.map((op, i) => (
          <div key={i} style={{
            marginBottom: '8px',
            padding: '5px',
            backgroundColor: op.userId === user?.uid ? 'rgba(0, 100, 255, 0.2)' : 'rgba(255, 100, 0, 0.2)',
            borderRadius: '4px',
            borderLeft: op.userId === user?.uid ? '3px solid blue' : '3px solid orange'
          }}>
            <div>{op.time} - {op.type}</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              User: {op.userId === user?.uid ? 'YOU' : op.userId?.slice(-6)}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              Elements: {op.elementIds?.join(', ')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}