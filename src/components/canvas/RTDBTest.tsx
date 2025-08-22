'use client';

import { useState, useEffect } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, push, onValue } from 'firebase/database';

interface RTDBTestProps {
  canvasId: string;
  userId: string;
}

export default function RTDBTest({ canvasId, userId }: RTDBTestProps) {
  const [testStatus, setTestStatus] = useState('Testing RTDB...');
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    if (!canvasId || !userId) {
      setTestStatus('Missing canvasId or userId');
      return;
    }

    // Test write to RTDB
    const testWrite = async () => {
      try {
        const testRef = ref(rtdb, `canvas-operations/${canvasId}/test`);
        const testData = {
          userId,
          timestamp: Date.now(),
          message: 'RTDB connection test'
        };
        
        console.log('[RTDBTest] Writing test data:', testData);
        await push(testRef, testData);
        console.log('[RTDBTest] Write successful');
        setTestStatus('RTDB Write: ✓');
      } catch (error) {
        console.error('[RTDBTest] Write failed:', error);
        setTestStatus(`RTDB Write: ✗ - ${error}`);
      }
    };

    // Test read from RTDB
    const testRef = ref(rtdb, `canvas-operations/${canvasId}`);
    const unsubscribe = onValue(testRef, 
      (snapshot) => {
        const data = snapshot.val();
        console.log('[RTDBTest] Received data:', data);
        if (data) {
          setLastMessage(data);
          setTestStatus('RTDB Connected: ✓');
        } else {
          setTestStatus('RTDB Connected: ✓ (no data)');
        }
      },
      (error) => {
        console.error('[RTDBTest] Read error:', error);
        setTestStatus(`RTDB Read: ✗ - ${error.message}`);
      }
    );

    testWrite();

    return () => unsubscribe();
  }, [canvasId, userId]);

  // Only render if we have valid props
  if (!canvasId || !userId) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-lg z-50 max-w-sm">
      <div className="text-xs font-mono">
        <div className="font-semibold mb-1">RTDB Debug:</div>
        <div className={testStatus.includes('✓') ? 'text-green-600' : testStatus.includes('✗') ? 'text-red-600' : 'text-gray-600'}>
          {testStatus}
        </div>
        {lastMessage && (
          <div className="mt-2 text-gray-500">
            Last op count: {Object.keys(lastMessage).length}
          </div>
        )}
      </div>
    </div>
  );
}