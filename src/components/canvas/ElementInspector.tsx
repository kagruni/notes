'use client';

import { useState } from 'react';

export default function ElementInspector({ excalidrawAPI }: { excalidrawAPI: any }) {
  const [elementInfo, setElementInfo] = useState<string>('');

  const inspectElements = () => {
    if (!excalidrawAPI) return;
    
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      setElementInfo('No elements on canvas');
      return;
    }

    const firstEl = elements[0];
    const info = {
      totalElements: elements.length,
      firstElement: {
        ...firstEl,
        __proto__: Object.getPrototypeOf(firstEl)?.constructor?.name
      },
      allKeys: Object.keys(firstEl),
      hasVersion: 'version' in firstEl,
      hasVersionNonce: 'versionNonce' in firstEl,
      type: firstEl.type,
      id: firstEl.id,
      x: firstEl.x,
      y: firstEl.y
    };

    setElementInfo(JSON.stringify(info, null, 2));
    console.log('[ElementInspector] Full first element:', firstEl);
    console.log('[ElementInspector] Element prototype:', Object.getPrototypeOf(firstEl));
    console.log('[ElementInspector] All elements:', elements);
  };

  return (
    <div className="fixed top-20 right-4 z-50 bg-gray-800 text-white p-3 rounded-lg shadow-lg max-w-md">
      <div className="text-sm font-bold mb-2">Element Inspector</div>
      <button
        onClick={inspectElements}
        className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs mb-2"
      >
        Inspect Elements
      </button>
      {elementInfo && (
        <pre className="text-xs bg-black/50 p-2 rounded overflow-auto max-h-96">
          {elementInfo}
        </pre>
      )}
    </div>
  );
}