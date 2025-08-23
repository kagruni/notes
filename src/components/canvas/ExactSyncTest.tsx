'use client';

import { useState } from 'react';
import { applyOperation } from '@/utils/excalidraw-collab';

export default function ExactSyncTest({ excalidrawAPI }: { excalidrawAPI: any }) {
  const [status, setStatus] = useState('');
  
  const testExactSync = () => {
    if (!excalidrawAPI) {
      setStatus('❌ No API');
      return;
    }
    
    // Get current elements
    const currentElements = excalidrawAPI.getSceneElements();
    if (currentElements.length === 0) {
      setStatus('❌ No elements on canvas');
      return;
    }
    
    // Simulate receiving an update operation (exactly like our sync)
    const firstElement = currentElements[0];
    const operation = {
      type: 'update' as const,
      elementIds: [firstElement.id],
      data: {
        elements: [{
          ...firstElement,
          x: firstElement.x + 100,
          y: firstElement.y + 100,
          versionNonce: Math.floor(Math.random() * 2000000000)
        }]
      },
      userId: 'test-user',
      clientId: 'test-client',
      timestamp: Date.now()
    };
    
    console.log('[ExactSyncTest] Simulating remote operation:', operation);
    
    // Apply the operation exactly like our sync does
    const updatedElements = applyOperation(currentElements, operation);
    console.log('[ExactSyncTest] After applyOperation:', {
      originalCount: currentElements.length,
      updatedCount: updatedElements.length,
      firstOriginal: currentElements[0],
      firstUpdated: updatedElements[0]
    });
    
    // Update scene exactly like our sync
    console.log('[ExactSyncTest] Calling updateScene...');
    excalidrawAPI.updateScene({
      elements: updatedElements,
      commitToHistory: false
    });
    
    // Verify
    setTimeout(() => {
      const afterElements = excalidrawAPI.getSceneElements();
      const afterFirst = afterElements[0];
      
      console.log('[ExactSyncTest] After updateScene:', {
        originalX: firstElement.x,
        originalY: firstElement.y,
        expectedX: firstElement.x + 100,
        expectedY: firstElement.y + 100,
        actualX: afterFirst.x,
        actualY: afterFirst.y
      });
      
      if (afterFirst.x === firstElement.x + 100 && afterFirst.y === firstElement.y + 100) {
        setStatus('✅ Update worked!');
      } else {
        setStatus(`❌ Update failed: got (${afterFirst.x}, ${afterFirst.y})`);
        
        // Try a different approach - completely new array
        console.log('[ExactSyncTest] Trying complete replacement...');
        const brandNewElements = updatedElements.map(el => ({
          ...el,
          id: el.id,  // Keep same ID
          seed: Math.floor(Math.random() * 2000000000),  // New seed
          versionNonce: Math.floor(Math.random() * 2000000000)  // New versionNonce
        }));
        
        excalidrawAPI.updateScene({
          elements: brandNewElements,
          commitToHistory: true
        });
        
        setTimeout(() => {
          const finalElements = excalidrawAPI.getSceneElements();
          const finalFirst = finalElements[0];
          setStatus(`After replacement: (${finalFirst.x}, ${finalFirst.y})`);
        }, 100);
      }
    }, 100);
  };
  
  const testAddNewInstead = () => {
    if (!excalidrawAPI) return;
    
    const currentElements = excalidrawAPI.getSceneElements();
    if (currentElements.length === 0) {
      setStatus('❌ No elements');
      return;
    }
    
    // Instead of updating, DELETE the old and ADD a new one
    const firstElement = currentElements[0];
    
    // Create new element with same visual but different position
    const newElement = {
      ...firstElement,
      id: 'moved-' + Date.now(),  // NEW ID
      x: firstElement.x + 150,
      y: firstElement.y + 150,
      seed: Math.floor(Math.random() * 2000000000),
      versionNonce: Math.floor(Math.random() * 2000000000)
    };
    
    // Remove old, add new
    const newElements = [
      ...currentElements.slice(1),  // All except first
      newElement  // Add the moved version
    ];
    
    console.log('[ExactSyncTest] Replacing with new ID...');
    excalidrawAPI.updateScene({
      elements: newElements,
      commitToHistory: true
    });
    
    setStatus('Replaced with new element');
  };
  
  return (
    <div className="fixed bottom-36 left-4 z-50 bg-red-600/90 text-white p-3 rounded-lg">
      <div className="text-sm font-bold mb-2">Exact Sync Test</div>
      <div className="space-y-2">
        <button
          onClick={testExactSync}
          className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800 w-full"
        >
          Test Exact Sync Flow
        </button>
        <button
          onClick={testAddNewInstead}
          className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800 w-full"
        >
          Delete & Add New
        </button>
      </div>
      {status && (
        <div className="mt-2 text-xs p-2 bg-black/30 rounded">
          {status}
        </div>
      )}
    </div>
  );
}