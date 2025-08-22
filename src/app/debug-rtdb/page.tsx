'use client';

import { useState, useEffect } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useRouter } from 'next/navigation';

export default function DebugRTDBPage() {
  const [data, setData] = useState<any>(null);
  const [selectedCanvas, setSelectedCanvas] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Listen to all canvas operations
    const operationsRef = ref(rtdb, 'canvas-operations');
    
    const unsubscribe = onValue(operationsRef, (snapshot) => {
      const val = snapshot.val();
      console.log('[DebugRTDB] All canvas operations:', val);
      setData(val);
      
      // Auto-select first canvas if none selected
      if (val && !selectedCanvas) {
        const firstCanvasId = Object.keys(val)[0];
        if (firstCanvasId) {
          setSelectedCanvas(firstCanvasId);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedCanvas]);

  const getOperationCount = (canvasId: string) => {
    if (!data || !data[canvasId]) return 0;
    return Object.keys(data[canvasId]).length;
  };

  const getLatestOperation = (canvasId: string) => {
    if (!data || !data[canvasId]) return null;
    const operations = Object.values(data[canvasId]) as any[];
    operations.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return operations[0];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">RTDB Debug - Canvas Operations</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>

        {!data ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <p className="text-gray-500">No canvas operations found in RTDB</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Active Canvases</h2>
              <div className="space-y-2">
                {Object.keys(data).map(canvasId => (
                  <button
                    key={canvasId}
                    onClick={() => setSelectedCanvas(canvasId)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedCanvas === canvasId
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } border`}
                  >
                    <div className="font-mono text-xs mb-1">{canvasId}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {getOperationCount(canvasId)} operations
                    </div>
                    {getLatestOperation(canvasId) && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last: {new Date(getLatestOperation(canvasId).timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Operations Detail */}
            {selectedCanvas && data[selectedCanvas] && (
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Operations for Canvas: {selectedCanvas.slice(0, 8)}...
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(data[selectedCanvas])
                    .sort(([, a]: any, [, b]: any) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, 20)
                    .map(([opId, op]: [string, any]) => (
                      <div key={opId} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm">{op.type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(op.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div>Elements: {op.elementIds?.length || 0}</div>
                          <div>User: {op.userId?.slice(0, 8)}...</div>
                          <div>Client: {op.clientId}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Raw Data Preview */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Raw RTDB Structure</h2>
          <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-auto max-h-64">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}