'use client';

import { useState } from 'react';
import { ref, push, onChildAdded } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export default function SimpleSyncTest({ 
  canvasId,
  excalidrawAPI 
}: { 
  canvasId: string;
  excalidrawAPI: any;
}) {
  const [status, setStatus] = useState('');
  const [listening, setListening] = useState(false);
  
  const startListening = () => {
    if (listening) return;
    
    console.log('[SimpleSyncTest] Starting listener...');
    const testRef = ref(rtdb, `test-sync/${canvasId}`);
    
    const unsubscribe = onChildAdded(testRef, (snapshot) => {
      const data = snapshot.val();
      console.log('[SimpleSyncTest] 📡 Received test data:', data);
      
      if (!data || !excalidrawAPI) return;
      
      // Try to add the element directly
      const currentElements = excalidrawAPI.getSceneElements();
      const testElement = {
        id: data.id,
        type: 'rectangle',
        x: data.x || 400,
        y: data.y || 400,
        width: 120,
        height: 60,
        angle: 0,
        strokeColor: '#00FFFF',
        backgroundColor: '#00FFFF30',
        fillStyle: 'solid',
        strokeWidth: 3,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 2000000000),
        versionNonce: Math.floor(Math.random() * 2000000000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false
      };
      
      console.log('[SimpleSyncTest] Adding element to scene...');
      try {
        excalidrawAPI.updateScene({
          elements: [...currentElements, testElement]
        });
        setStatus(`✅ Received and added: ${data.id}`);
      } catch (error) {
        console.error('[SimpleSyncTest] Failed to add:', error);
        setStatus(`❌ Failed: ${error}`);
      }
    });
    
    setListening(true);
    setStatus('👂 Listening for test sync...');
  };
  
  const sendTestElement = async () => {
    console.log('[SimpleSyncTest] Sending test element...');
    const testRef = ref(rtdb, `test-sync/${canvasId}`);
    
    const testData = {
      id: 'simple-test-' + Date.now(),
      x: 400 + Math.random() * 100,
      y: 400 + Math.random() * 100,
      timestamp: Date.now()
    };
    
    try {
      await push(testRef, testData);
      console.log('[SimpleSyncTest] ✅ Sent:', testData);
      setStatus(`📤 Sent: ${testData.id}`);
    } catch (error) {
      console.error('[SimpleSyncTest] Failed to send:', error);
      setStatus(`❌ Send failed: ${error}`);
    }
  };
  
  return (
    <div className="fixed top-44 left-4 z-50 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
      <div className="text-sm font-bold mb-2">Simple Sync Test</div>
      
      <div className="space-y-2">
        <button
          onClick={startListening}
          disabled={listening}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 w-full"
        >
          {listening ? '👂 Listening...' : 'Start Listening'}
        </button>
        
        <button
          onClick={sendTestElement}
          className="px-3 py-1 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 w-full"
        >
          Send Cyan Rectangle
        </button>
      </div>
      
      {status && (
        <div className="mt-2 text-xs p-2 bg-gray-100 dark:bg-gray-700 rounded">
          {status}
        </div>
      )}
    </div>
  );
}