'use client';

import { useState, useEffect } from 'react';

export default function CollaborationFix({ excalidrawAPI }: { excalidrawAPI: any }) {
  const [status, setStatus] = useState('');
  const [CaptureUpdateAction, setCaptureUpdateAction] = useState<any>(null);
  
  // Load CaptureUpdateAction on mount
  useEffect(() => {
    const loadCaptureUpdateAction = async () => {
      try {
        const excalidrawModule = await import('@excalidraw/excalidraw');
        if (excalidrawModule.CaptureUpdateAction) {
          setCaptureUpdateAction(excalidrawModule.CaptureUpdateAction);
          console.log('[CollabFix] CaptureUpdateAction loaded');
        }
      } catch (error) {
        console.error('[CollabFix] Failed to load CaptureUpdateAction:', error);
      }
    };
    loadCaptureUpdateAction();
  }, []);
  
  // Test if we can force a complete re-render
  const testForceRerender = () => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }
    
    // Move first element
    const moved = {
      ...elements[0],
      x: elements[0].x + 100,
      y: elements[0].y + 100
    };
    
    const newElements = [moved, ...elements.slice(1)];
    
    // Method 1: Force re-render by toggling view
    console.log('[CollabFix] Method 1: Toggle view mode...');
    const currentAppState = excalidrawAPI.getAppState();
    
    // Change view mode to force re-render
    excalidrawAPI.updateScene({
      appState: {
        ...currentAppState,
        viewModeEnabled: true
      }
    });
    
    setTimeout(() => {
      // Update with new elements and restore view
      excalidrawAPI.updateScene({
        elements: newElements,
        appState: {
          ...currentAppState,
          viewModeEnabled: false
        }
      });
      setStatus('Toggled view mode');
    }, 10);
  };
  
  // Test if we need to use resetScene instead
  const testResetScene = () => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }
    
    // Move first element
    const moved = {
      ...elements[0],
      x: elements[0].x + 100,
      y: elements[0].y + 100,
      versionNonce: Math.random() * 2000000000
    };
    
    const newElements = [moved, ...elements.slice(1)];
    
    // Try resetScene if it exists
    if (excalidrawAPI.resetScene) {
      console.log('[CollabFix] Using resetScene...');
      excalidrawAPI.resetScene({
        elements: newElements,
        appState: excalidrawAPI.getAppState()
      });
      setStatus('Used resetScene');
    } else {
      setStatus('No resetScene method');
    }
  };
  
  // Test if we need to use scrollToContent
  const testScrollTrigger = () => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }
    
    // Move first element
    const moved = {
      ...elements[0],
      x: elements[0].x + 100,
      y: elements[0].y + 100
    };
    
    const newElements = [moved, ...elements.slice(1)];
    
    console.log('[CollabFix] Update with scrollToContent...');
    excalidrawAPI.updateScene({
      elements: newElements,
      appState: {
        ...excalidrawAPI.getAppState(),
        scrollToContent: true
      }
    });
    
    setStatus('Triggered scroll');
  };
  
  // Test if we need to use importData
  const testImportData = () => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }
    
    // Move first element
    const moved = {
      ...elements[0],
      x: elements[0].x + 100,
      y: elements[0].y + 100
    };
    
    const newElements = [moved, ...elements.slice(1)];
    
    // Try using importData
    if (excalidrawAPI.importData) {
      console.log('[CollabFix] Using importData...');
      excalidrawAPI.importData({
        elements: newElements,
        appState: excalidrawAPI.getAppState()
      });
      setStatus('Used importData');
    } else {
      setStatus('No importData method');
    }
  };
  
  // Test with CaptureUpdateAction.NEVER
  const testCaptureUpdateNever = () => {
    if (!excalidrawAPI || !CaptureUpdateAction) {
      setStatus('❌ API or CaptureUpdateAction not ready');
      return;
    }
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setStatus('No elements');
      return;
    }
    
    // Move first element
    const moved = {
      ...elements[0],
      x: elements[0].x + 100,
      y: elements[0].y + 100,
      versionNonce: Math.floor(Math.random() * 2000000000)
    };
    
    const newElements = [moved, ...elements.slice(1)];
    
    console.log('[CollabFix] Using CaptureUpdateAction.NEVER...');
    excalidrawAPI.updateScene({
      elements: newElements,
      captureUpdate: CaptureUpdateAction.NEVER
    });
    
    setStatus('Used CaptureUpdateAction.NEVER');
  };
  
  // Check what methods are available
  useEffect(() => {
    if (excalidrawAPI) {
      console.log('[CollabFix] Available methods:', {
        updateScene: !!excalidrawAPI.updateScene,
        resetScene: !!excalidrawAPI.resetScene,
        importData: !!excalidrawAPI.importData,
        restore: !!excalidrawAPI.restore,
        refresh: !!excalidrawAPI.refresh,
        setElements: !!excalidrawAPI.setElements,
        replaceAllElements: !!excalidrawAPI.replaceAllElements
      });
      
      // Check for any collaboration-specific methods
      const methods = Object.keys(excalidrawAPI).filter(key => 
        typeof excalidrawAPI[key] === 'function'
      );
      console.log('[CollabFix] All methods:', methods);
    }
  }, [excalidrawAPI]);
  
  return (
    <div className="fixed top-20 right-4 z-50 bg-purple-600/90 text-white p-3 rounded-lg">
      <div className="text-sm font-bold mb-2">Collaboration Fix</div>
      <div className="space-y-1">
        <button
          onClick={testCaptureUpdateNever}
          className="w-full px-2 py-1 bg-green-700 hover:bg-green-800 rounded text-xs font-bold"
        >
          CaptureUpdate.NEVER
        </button>
        <button
          onClick={testForceRerender}
          className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 rounded text-xs"
        >
          Force Re-render
        </button>
        <button
          onClick={testResetScene}
          className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 rounded text-xs"
        >
          Reset Scene
        </button>
        <button
          onClick={testScrollTrigger}
          className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 rounded text-xs"
        >
          Scroll Trigger
        </button>
        <button
          onClick={testImportData}
          className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 rounded text-xs"
        >
          Import Data
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