'use client';

import { useState, useEffect } from 'react';

export default function MinimalSyncTest({ excalidrawAPI }: { excalidrawAPI: any }) {
  const [status, setStatus] = useState('');
  const [CaptureUpdateAction, setCaptureUpdateAction] = useState<any>(null);

  // Load CaptureUpdateAction
  useEffect(() => {
    import('@excalidraw/excalidraw').then(mod => {
      setCaptureUpdateAction(mod.CaptureUpdateAction);
      console.log('[MinimalSync] CaptureUpdateAction loaded');
    });
  }, []);

  const testMinimalUpdate = () => {
    if (!excalidrawAPI || !CaptureUpdateAction) {
      setStatus('Not ready');
      return;
    }

    // Get current elements
    const elements = excalidrawAPI.getSceneElements();
    console.log('[MinimalSync] Current elements:', elements);
    
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }

    // Create a completely new array with modified first element
    const firstEl = elements[0];
    const newFirstEl = {
      ...firstEl,
      x: firstEl.x + 50,
      y: firstEl.y + 50,
      version: (firstEl.version || 0) + 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
      updated: Date.now()
    };

    // Create new array
    const newElements = [
      newFirstEl,
      ...elements.slice(1)
    ];

    console.log('[MinimalSync] Updating with new elements');
    console.log('Old first element:', firstEl);
    console.log('New first element:', newFirstEl);

    // Update scene
    excalidrawAPI.updateScene({
      elements: newElements,
      captureUpdate: CaptureUpdateAction.NEVER
    });

    // Verify after a moment
    setTimeout(() => {
      const afterElements = excalidrawAPI.getSceneElements();
      const afterFirst = afterElements[0];
      
      if (afterFirst.x === newFirstEl.x && afterFirst.y === newFirstEl.y) {
        setStatus('✅ SUCCESS! Element moved');
      } else {
        setStatus(`❌ FAILED: Expected (${newFirstEl.x}, ${newFirstEl.y}) but got (${afterFirst.x}, ${afterFirst.y})`);
        
        // Log everything for debugging
        console.log('[MinimalSync] FAILURE DETAILS:');
        console.log('Elements we sent:', newElements);
        console.log('Elements after update:', afterElements);
        console.log('Are they the same array?', newElements === afterElements);
        console.log('Is first element same?', newElements[0] === afterElements[0]);
      }
    }, 100);
  };

  const testWithoutVersion = () => {
    if (!excalidrawAPI || !CaptureUpdateAction) {
      setStatus('Not ready');
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }

    // Try without modifying version/versionNonce
    const firstEl = elements[0];
    const newFirstEl = {
      ...firstEl,
      x: firstEl.x + 50,
      y: firstEl.y + 50
    };

    const newElements = [newFirstEl, ...elements.slice(1)];

    excalidrawAPI.updateScene({
      elements: newElements,
      captureUpdate: CaptureUpdateAction.NEVER
    });

    setTimeout(() => {
      const afterFirst = excalidrawAPI.getSceneElements()[0];
      if (afterFirst.x === newFirstEl.x) {
        setStatus('✅ Works without version!');
      } else {
        setStatus('❌ Needs version update');
      }
    }, 100);
  };

  const testReplaceAll = () => {
    if (!excalidrawAPI || !CaptureUpdateAction) {
      setStatus('Not ready');
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }

    // Create completely new objects
    const newElements = elements.map((el: any) => ({
      ...el,
      x: el.x + 30,
      y: el.y + 30,
      version: (el.version || 0) + 1,
      versionNonce: Math.floor(Math.random() * 2000000000)
    }));

    excalidrawAPI.updateScene({
      elements: newElements,
      captureUpdate: CaptureUpdateAction.NEVER
    });

    setTimeout(() => {
      const afterFirst = excalidrawAPI.getSceneElements()[0];
      if (afterFirst.x === elements[0].x + 30) {
        setStatus('✅ Replace all works!');
      } else {
        setStatus('❌ Replace all failed');
      }
    }, 100);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-lg shadow-lg">
      <div className="text-sm font-bold mb-2">Minimal Sync Test</div>
      <div className="space-y-2">
        <button
          onClick={testMinimalUpdate}
          className="w-full px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs"
        >
          Test Basic Update
        </button>
        <button
          onClick={testWithoutVersion}
          className="w-full px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs"
        >
          Test Without Version
        </button>
        <button
          onClick={testReplaceAll}
          className="w-full px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs"
        >
          Test Replace All
        </button>
      </div>
      {status && (
        <div className="mt-2 text-xs p-1 bg-black/30 rounded">
          {status}
        </div>
      )}
    </div>
  );
}