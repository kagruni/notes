'use client';

import { useState } from 'react';

export default function ManualSyncTest({ 
  excalidrawAPI,
  queueOperation 
}: { 
  excalidrawAPI: any;
  queueOperation: (type: string, elementIds: string[], data: any) => void;
}) {
  const [status, setStatus] = useState('');
  
  const testManualSync = async () => {
    if (!excalidrawAPI) {
      setStatus('❌ No Excalidraw API');
      return;
    }
    
    if (!queueOperation) {
      setStatus('❌ No queueOperation function');
      return;
    }
    
    console.log('[ManualSyncTest] Creating test element...');
    setStatus('Creating test element...');
    
    // Create a simple rectangle element
    const testElement = {
      id: 'manual-sync-test-' + Date.now(),
      type: 'rectangle',
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      width: 150,
      height: 80,
      angle: 0,
      strokeColor: '#00FF00',
      backgroundColor: '#00FF0050',
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
    
    console.log('[ManualSyncTest] Test element created:', testElement);
    
    // First, add it locally to verify it works
    const currentElements = excalidrawAPI.getSceneElements();
    const newElements = [...currentElements, testElement];
    
    console.log('[ManualSyncTest] Adding locally first...');
    excalidrawAPI.updateScene({
      elements: newElements,
      commitToHistory: true
    });
    
    // Verify it was added locally
    setTimeout(async () => {
      const verifyElements = excalidrawAPI.getSceneElements();
      const found = verifyElements.find((el: any) => el.id === testElement.id);
      
      if (found) {
        console.log('[ManualSyncTest] ✅ Element added locally');
        setStatus('✅ Added locally, sending to remote...');
        
        // Now queue it as an operation for remote sync
        console.log('[ManualSyncTest] Queueing operation for remote sync...');
        try {
          await queueOperation('add', [testElement.id], { elements: [testElement] });
          console.log('[ManualSyncTest] ✅ Operation queued');
          setStatus('✅ Green rectangle added and synced!');
          
          // Alert the user
          setTimeout(() => {
            alert('Success! A green rectangle should appear on both canvases.');
          }, 500);
        } catch (error) {
          console.error('[ManualSyncTest] Failed to queue operation:', error);
          setStatus('❌ Failed to sync: ' + error);
        }
      } else {
        console.error('[ManualSyncTest] ❌ Failed to add locally');
        setStatus('❌ Failed to add element locally');
      }
    }, 100);
  };
  
  return (
    <div className="fixed top-32 left-4 z-50">
      <button
        onClick={testManualSync}
        className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 font-bold"
      >
        Manual Sync Test
      </button>
      {status && (
        <div className="mt-2 px-3 py-1 bg-gray-800 text-white rounded text-sm">
          {status}
        </div>
      )}
    </div>
  );
}