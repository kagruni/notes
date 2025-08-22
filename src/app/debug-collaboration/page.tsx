'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function DebugCollaborationPage() {
  const [canvasId, setCanvasId] = useState('');
  const [firestoreData, setFirestoreData] = useState<any>(null);
  const [rtdbOperations, setRtdbOperations] = useState<any[]>([]);
  const [listening, setListening] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const startListening = () => {
    if (!canvasId) {
      alert('Please enter a canvas ID');
      return;
    }

    setListening(true);

    // Listen to Firestore canvas document
    const canvasRef = doc(db, 'canvases', canvasId);
    const unsubFirestore = onSnapshot(canvasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFirestoreData({
          id: snapshot.id,
          ...data,
          elements: Array.isArray(data.elements) ? data.elements.length : 
                   (data.elements ? Object.keys(data.elements).length : 0),
          collaborationEnabled: data.collaborationEnabled,
          sharedWith: data.sharedWith || [],
          permissions: data.permissions || {}
        });
      }
    });

    // Listen to RTDB operations
    const operationsRef = ref(rtdb, `canvas-operations/${canvasId}`);
    const unsubRtdb = onValue(operationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const operations = Object.entries(data).map(([key, value]: [string, any]) => ({
          key,
          ...value,
          timestamp: new Date(value.timestamp).toLocaleTimeString()
        }));
        // Show last 10 operations
        setRtdbOperations(operations.slice(-10).reverse());
      } else {
        setRtdbOperations([]);
      }
    });

    // Cleanup
    return () => {
      unsubFirestore();
      unsubRtdb();
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Debug Collaboration</h1>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Canvas ID:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={canvasId}
                onChange={(e) => setCanvasId(e.target.value)}
                placeholder="Enter canvas ID"
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={startListening}
                disabled={listening}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {listening ? 'Listening...' : 'Start Listening'}
              </button>
            </div>
          </div>

          {/* Firestore Data */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Firestore Canvas Data:</h2>
            {firestoreData ? (
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-sm">
                <div>ID: {firestoreData.id}</div>
                <div>Elements Count: {firestoreData.elements}</div>
                <div>Collaboration Enabled: {firestoreData.collaborationEnabled ? '✅' : '❌'}</div>
                <div>Shared With: {firestoreData.sharedWith.length} users</div>
                <div>Permissions: {Object.keys(firestoreData.permissions).length} entries</div>
              </div>
            ) : (
              <div className="text-gray-500">No data yet</div>
            )}
          </div>

          {/* RTDB Operations */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Realtime Database Operations (Last 10):</h2>
            {rtdbOperations.length > 0 ? (
              <div className="space-y-2">
                {rtdbOperations.map((op) => (
                  <div key={op.key} className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{op.type}</span>
                      <span className="text-gray-500">{op.timestamp}</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      User: {op.userId?.substring(0, 8)}... | 
                      Elements: {op.elementIds?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No operations yet</div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}