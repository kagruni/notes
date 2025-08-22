'use client';

import { Canvas } from '@/types';

interface TestPreviewProps {
  canvas: Canvas;
}

export default function TestPreview({ canvas }: TestPreviewProps) {
  const elementCount = canvas.elements?.length || 0;
  
  return (
    <div className="w-full h-full" style={{ backgroundColor: '#FFB6C1' }}>
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🎨</div>
          <p className="text-lg font-bold text-gray-800">
            {canvas.title}
          </p>
          <p className="text-sm text-gray-600">
            {elementCount} elements
          </p>
        </div>
      </div>
    </div>
  );
}