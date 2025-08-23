'use client';

export default function DirectUpdateTest({ excalidrawAPI }: { excalidrawAPI: any }) {
  const testDirectUpdate = () => {
    if (!excalidrawAPI) {
      console.error('[DirectUpdateTest] No Excalidraw API');
      return;
    }
    
    console.log('[DirectUpdateTest] Testing direct update...');
    
    // Create a test rectangle
    const testElement = {
      id: 'direct-test-' + Date.now(),
      type: 'rectangle',
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100,
      width: 200,
      height: 100,
      angle: 0,
      strokeColor: '#FF0000',
      backgroundColor: '#FFCCCC',
      fillStyle: 'solid',
      strokeWidth: 2,
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
    
    // Get current elements
    const currentElements = excalidrawAPI.getSceneElements();
    console.log('[DirectUpdateTest] Current elements:', currentElements.length);
    
    // Add test element
    const newElements = [...currentElements, testElement];
    
    // Try to update scene
    console.log('[DirectUpdateTest] Calling updateScene with', newElements.length, 'elements');
    
    try {
      excalidrawAPI.updateScene({
        elements: newElements,
        commitToHistory: true
      });
      console.log('[DirectUpdateTest] ✅ updateScene called successfully');
      
      // Verify it was added
      setTimeout(() => {
        const afterElements = excalidrawAPI.getSceneElements();
        console.log('[DirectUpdateTest] After update:', afterElements.length, 'elements');
        const found = afterElements.find((el: any) => el.id === testElement.id);
        if (found) {
          console.log('[DirectUpdateTest] ✅ Element found in scene!');
          alert('Success! Red rectangle should be visible on canvas.');
        } else {
          console.error('[DirectUpdateTest] ❌ Element NOT found in scene');
          alert('Failed! Element not in scene after update.');
        }
      }, 100);
    } catch (error) {
      console.error('[DirectUpdateTest] Failed to update scene:', error);
      alert('Error updating scene: ' + error);
    }
  };
  
  return (
    <button
      onClick={testDirectUpdate}
      className="fixed top-20 left-4 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 z-50 font-bold"
    >
      Test Direct Update
    </button>
  );
}