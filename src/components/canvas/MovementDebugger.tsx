'use client';

import { useState, useEffect } from 'react';

export default function MovementDebugger({ 
  lastElements,
  excalidrawAPI 
}: { 
  lastElements: React.MutableRefObject<any[] | null>;
  excalidrawAPI: any;
}) {
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  const testMovementDetection = () => {
    if (!excalidrawAPI || !lastElements.current) {
      console.error('[MovementDebugger] Missing API or lastElements');
      return;
    }
    
    const current = excalidrawAPI.getSceneElements();
    console.log('[MovementDebugger] Manual test:', {
      lastCount: lastElements.current.length,
      currentCount: current.length
    });
    
    // Compare first element in detail
    if (lastElements.current.length > 0 && current.length > 0) {
      const lastFirst = lastElements.current[0];
      const currentFirst = current[0];
      
      console.log('[MovementDebugger] First element comparison:', {
        id: lastFirst.id,
        lastX: lastFirst.x,
        currentX: currentFirst.x,
        lastY: lastFirst.y,
        currentY: currentFirst.y,
        lastVersionNonce: lastFirst.versionNonce,
        currentVersionNonce: currentFirst.versionNonce,
        sameReference: lastFirst === currentFirst,
        xChanged: lastFirst.x !== currentFirst.x,
        yChanged: lastFirst.y !== currentFirst.y,
        versionNonceChanged: lastFirst.versionNonce !== currentFirst.versionNonce
      });
    }
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (!excalidrawAPI || !lastElements.current) return;
      
      const current = excalidrawAPI.getSceneElements();
      const last = lastElements.current;
      
      // Check if elements are same references
      const sameRefs = last.length > 0 && current.length > 0 && last[0] === current[0];
      
      setDebugInfo({
        lastCount: last.length,
        currentCount: current.length,
        sameReferences: sameRefs,
        firstElementSample: current[0] ? {
          x: Math.round(current[0].x),
          y: Math.round(current[0].y),
          versionNonce: current[0].versionNonce
        } : null
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastElements, excalidrawAPI]);
  
  return (
    <div className="fixed top-56 left-4 z-50 bg-purple-900/90 text-white p-3 rounded-lg text-xs">
      <div className="font-bold mb-2">Movement Debugger</div>
      <div className="space-y-1">
        <div>Last: {debugInfo.lastCount} | Current: {debugInfo.currentCount}</div>
        <div>Same Refs: {String(debugInfo.sameReferences)}</div>
        {debugInfo.firstElementSample && (
          <div>
            First: ({debugInfo.firstElementSample.x}, {debugInfo.firstElementSample.y})
            <br />VNonce: {debugInfo.firstElementSample.versionNonce}
          </div>
        )}
      </div>
      <button
        onClick={testMovementDetection}
        className="mt-2 px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs w-full"
      >
        Test Detection
      </button>
    </div>
  );
}