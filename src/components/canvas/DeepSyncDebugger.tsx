'use client';

import { useState, useEffect } from 'react';
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';

interface DeepSyncDebuggerProps {
  excalidrawAPI: any;
  lastElements: React.MutableRefObject<ExcalidrawElement[] | null>;
  isApplyingRemoteOp: React.MutableRefObject<boolean>;
}

export default function DeepSyncDebugger({ 
  excalidrawAPI, 
  lastElements,
  isApplyingRemoteOp
}: DeepSyncDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isExpanded, setIsExpanded] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (!excalidrawAPI) return;
      
      const currentElements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      // Get a sample element for detailed inspection
      const sampleElement = currentElements[0];
      
      setDebugInfo({
        currentElementCount: currentElements.length,
        lastElementCount: lastElements.current?.length || 0,
        isApplyingRemote: isApplyingRemoteOp.current,
        sampleElement: sampleElement ? {
          id: sampleElement.id,
          type: sampleElement.type,
          x: sampleElement.x,
          y: sampleElement.y,
          version: (sampleElement as any).version,
          versionNonce: (sampleElement as any).versionNonce,
          updated: (sampleElement as any).updated,
          seed: (sampleElement as any).seed,
          hasAllProps: !!(
            sampleElement.id &&
            sampleElement.type &&
            typeof sampleElement.x === 'number' &&
            typeof sampleElement.y === 'number' &&
            typeof (sampleElement as any).versionNonce === 'number'
          )
        } : null,
        appState: {
          zoom: appState?.zoom?.value || 1,
          scrollX: appState?.scrollX || 0,
          scrollY: appState?.scrollY || 0,
          theme: appState?.theme
        },
        apiMethods: {
          hasUpdateScene: !!excalidrawAPI.updateScene,
          hasRestore: !!excalidrawAPI.restore,
          hasGetSceneElements: !!excalidrawAPI.getSceneElements,
          hasGetAppState: !!excalidrawAPI.getAppState
        }
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [excalidrawAPI, lastElements, isApplyingRemoteOp]);
  
  const testDirectSync = () => {
    if (!excalidrawAPI) {
      console.error('[DeepDebug] No API');
      return;
    }
    
    console.log('[DeepDebug] Testing direct sync...');
    
    // Create a test element with EXACT structure from working DirectUpdateTest
    const testEl = {
      id: 'debug-' + Date.now(),
      type: 'rectangle' as const,
      x: 300,
      y: 300,
      width: 100,
      height: 100,
      angle: 0,
      strokeColor: '#FF00FF',
      backgroundColor: '#FF00FF20',
      fillStyle: 'solid' as const,
      strokeWidth: 2,
      strokeStyle: 'solid' as const,
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
    
    const current = excalidrawAPI.getSceneElements();
    console.log('[DeepDebug] Before:', current.length, 'elements');
    
    // Method 1: Direct updateScene
    console.log('[DeepDebug] Method 1: updateScene');
    excalidrawAPI.updateScene({
      elements: [...current, testEl]
    });
    
    setTimeout(() => {
      const after1 = excalidrawAPI.getSceneElements();
      console.log('[DeepDebug] After method 1:', after1.length, 'elements');
      const found1 = after1.find((el: any) => el.id === testEl.id);
      console.log('[DeepDebug] Found after method 1?', !!found1);
      
      if (!found1 && excalidrawAPI.restore) {
        // Method 2: Try restore
        console.log('[DeepDebug] Method 2: restore');
        excalidrawAPI.restore({
          elements: [...after1, testEl],
          appState: null,
          scrollToContent: false
        });
        
        setTimeout(() => {
          const after2 = excalidrawAPI.getSceneElements();
          console.log('[DeepDebug] After method 2:', after2.length, 'elements');
          const found2 = after2.find((el: any) => el.id === testEl.id);
          console.log('[DeepDebug] Found after method 2?', !!found2);
        }, 100);
      }
    }, 100);
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-green-400 font-mono text-xs p-3 rounded-lg max-w-md z-50">
      <div 
        className="flex justify-between items-center mb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-bold">🔬 Deep Sync Debugger</div>
        <div>{isExpanded ? '▼' : '▶'}</div>
      </div>
      
      {isExpanded && (
        <>
          <div className="space-y-1">
            <div>Elements: {debugInfo.currentElementCount} (last: {debugInfo.lastElementCount})</div>
            <div>Applying Remote: {String(debugInfo.isApplyingRemote)}</div>
            
            {debugInfo.sampleElement && (
              <div className="border-t border-green-600 pt-1 mt-1">
                <div className="font-bold">Sample Element:</div>
                <div>Type: {debugInfo.sampleElement.type}</div>
                <div>Pos: ({Math.round(debugInfo.sampleElement.x)}, {Math.round(debugInfo.sampleElement.y)})</div>
                <div>Version: {debugInfo.sampleElement.version}</div>
                <div>VNonce: {debugInfo.sampleElement.versionNonce}</div>
                <div>Has All Props: {String(debugInfo.sampleElement.hasAllProps)}</div>
              </div>
            )}
            
            <div className="border-t border-green-600 pt-1 mt-1">
              <div className="font-bold">API Methods:</div>
              {Object.entries(debugInfo.apiMethods || {}).map(([key, value]) => (
                <div key={key}>{key}: {String(value)}</div>
              ))}
            </div>
          </div>
          
          <button
            onClick={testDirectSync}
            className="mt-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 w-full"
          >
            Test Direct Sync (Purple Rectangle)
          </button>
        </>
      )}
    </div>
  );
}