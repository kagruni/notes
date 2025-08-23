'use client';

import { transformElementsForFirebase, transformElementsFromFirebase } from '@/utils/transform-elements';

export default function TransformTest() {
  const testTransform = () => {
    // Create a test rectangle element (most common type)
    const original = {
      id: 'test-123',
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      angle: 0,
      strokeColor: '#000000',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 123456789,
      versionNonce: 987654321,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false
    };
    
    console.log('[TransformTest] ORIGINAL:', original);
    
    // Transform TO Firebase
    const toFirebase = transformElementsForFirebase([original])[0];
    console.log('[TransformTest] TO FIREBASE:', toFirebase);
    console.log('[TransformTest] TO FIREBASE changes:', {
      xSame: original.x === toFirebase.x,
      ySame: original.y === toFirebase.y,
      versionNonceSame: original.versionNonce === toFirebase.versionNonce
    });
    
    // Transform FROM Firebase
    const fromFirebase = transformElementsFromFirebase([toFirebase])[0];
    console.log('[TransformTest] FROM FIREBASE:', fromFirebase);
    console.log('[TransformTest] FROM FIREBASE changes:', {
      xSame: original.x === fromFirebase.x,
      ySame: original.y === fromFirebase.y,
      versionNonceSame: original.versionNonce === fromFirebase.versionNonce
    });
    
    // Check if round-trip preserves data
    const matches = JSON.stringify(original) === JSON.stringify(fromFirebase);
    console.log('[TransformTest] ROUND-TRIP MATCHES:', matches);
    
    if (!matches) {
      console.log('[TransformTest] DIFFERENCES:', {
        original: JSON.stringify(original, null, 2),
        afterRoundTrip: JSON.stringify(fromFirebase, null, 2)
      });
    }
    
    // Test with a line element that has points
    const lineElement = {
      id: 'line-123',
      type: 'line',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      angle: 0,
      points: [[0, 0], [100, 100]],
      strokeColor: '#000000',
      versionNonce: 111222333
    };
    
    console.log('[TransformTest] LINE ORIGINAL:', lineElement);
    const lineToFB = transformElementsForFirebase([lineElement])[0];
    console.log('[TransformTest] LINE TO FB:', lineToFB);
    const lineFromFB = transformElementsFromFirebase([lineToFB])[0];
    console.log('[TransformTest] LINE FROM FB:', lineFromFB);
    
    alert('Check console for transform test results');
  };
  
  return (
    <button
      onClick={testTransform}
      className="fixed bottom-4 left-4 px-4 py-2 bg-yellow-600 text-white rounded-lg shadow-lg hover:bg-yellow-700 z-50 font-bold"
    >
      Test Transform
    </button>
  );
}