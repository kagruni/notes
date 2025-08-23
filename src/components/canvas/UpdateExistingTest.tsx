'use client';

import { useState } from 'react';

export default function UpdateExistingTest({ excalidrawAPI }: { excalidrawAPI: any }) {
  const [status, setStatus] = useState('');
  
  const testUpdateExisting = () => {
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
    
    // Take the first element and move it
    const firstElement = currentElements[0];
    console.log('[UpdateExistingTest] Original element:', {
      id: firstElement.id,
      x: firstElement.x,
      y: firstElement.y,
      versionNonce: firstElement.versionNonce
    });
    
    // Create a moved version of the element
    const movedElement = {
      ...firstElement,
      x: firstElement.x + 100,  // Move 100px to the right
      y: firstElement.y + 50,   // Move 50px down
      versionNonce: Math.floor(Math.random() * 2000000000),  // New version
      updated: Date.now()
    };
    
    console.log('[UpdateExistingTest] Modified element:', {
      id: movedElement.id,
      x: movedElement.x,
      y: movedElement.y,
      versionNonce: movedElement.versionNonce
    });
    
    // Create new array with the moved element
    const newElements = currentElements.map(el => 
      el.id === firstElement.id ? movedElement : el
    );
    
    // Method 1: Direct updateScene
    console.log('[UpdateExistingTest] Method 1: updateScene...');
    excalidrawAPI.updateScene({
      elements: newElements,
      commitToHistory: true
    });
    
    // Verify after a moment
    setTimeout(() => {
      const afterElements = excalidrawAPI.getSceneElements();
      const afterFirst = afterElements.find((el: any) => el.id === firstElement.id);
      
      if (afterFirst) {
        console.log('[UpdateExistingTest] After update:', {
          id: afterFirst.id,
          x: afterFirst.x,
          y: afterFirst.y,
          moved: afterFirst.x !== firstElement.x || afterFirst.y !== firstElement.y
        });
        
        if (afterFirst.x === movedElement.x && afterFirst.y === movedElement.y) {
          setStatus('✅ Element moved successfully!');
        } else {
          setStatus(`⚠️ Element in scene but position wrong: (${afterFirst.x}, ${afterFirst.y})`);
          
          // Try Method 2: Replace all elements
          console.log('[UpdateExistingTest] Method 2: Replacing all elements...');
          
          // Clear and restore
          excalidrawAPI.updateScene({ elements: [] });
          setTimeout(() => {
            excalidrawAPI.updateScene({ elements: newElements });
            setStatus('Tried clear and restore');
          }, 10);
        }
      } else {
        setStatus('❌ Element not found after update');
      }
    }, 100);
  };
  
  const testMoveWithHistory = () => {
    if (!excalidrawAPI) return;
    
    const currentElements = excalidrawAPI.getSceneElements();
    if (currentElements.length === 0) {
      setStatus('❌ No elements');
      return;
    }
    
    const firstElement = currentElements[0];
    
    // Try using the history API
    console.log('[UpdateExistingTest] Using history.push...');
    
    const movedElement = {
      ...firstElement,
      x: firstElement.x + 50,
      y: firstElement.y + 50,
      versionNonce: Math.floor(Math.random() * 2000000000)
    };
    
    const newElements = currentElements.map(el => 
      el.id === firstElement.id ? movedElement : el
    );
    
    // Push to history
    if (excalidrawAPI.history) {
      excalidrawAPI.history.push({
        elements: newElements,
        appState: excalidrawAPI.getAppState()
      });
      setStatus('Pushed to history');
    } else {
      setStatus('No history API');
    }
  };
  
  return (
    <div className="fixed bottom-20 left-4 z-50 bg-orange-600/90 text-white p-3 rounded-lg">
      <div className="text-sm font-bold mb-2">Update Existing Test</div>
      <div className="space-y-2">
        <button
          onClick={testUpdateExisting}
          className="px-3 py-1 bg-orange-700 text-white rounded text-sm hover:bg-orange-800 w-full"
        >
          Move First Element
        </button>
        <button
          onClick={testMoveWithHistory}
          className="px-3 py-1 bg-orange-700 text-white rounded text-sm hover:bg-orange-800 w-full"
        >
          Move with History
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