'use client';

import { Canvas } from '@/types';
import { PenTool, Square, Circle, Type, ArrowRight, Minus } from 'lucide-react';

interface SimpleCanvasPreviewProps {
  canvas: Canvas;
}

export default function SimpleCanvasPreview({ canvas }: SimpleCanvasPreviewProps) {
  const elements = canvas.elements || [];
  
  console.log('SimpleCanvasPreview rendering for:', canvas.title, 'Elements:', elements);
  
  // Count different element types
  const elementCounts = elements.reduce((acc: any, el: any) => {
    if (el.isDeleted) return acc;
    const type = el.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  const totalElements = Object.values(elementCounts).reduce((sum: any, count: any) => sum + count, 0) as number;
  
  // Get icon for element type
  const getIcon = (type: string) => {
    switch(type) {
      case 'rectangle': return <Square className="w-4 h-4" />;
      case 'ellipse': return <Circle className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      case 'arrow': return <ArrowRight className="w-4 h-4" />;
      case 'line': return <Minus className="w-4 h-4" />;
      default: return <PenTool className="w-4 h-4" />;
    }
  };
  
  if (totalElements === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <PenTool className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Empty canvas</p>
        </div>
      </div>
    );
  }
  
  // Show a grid of element type counts
  const mainTypes = ['rectangle', 'ellipse', 'arrow', 'text', 'line', 'freedraw'];
  const displayTypes = mainTypes.filter(type => elementCounts[type] > 0).slice(0, 6);
  
  return (
    <div className="w-full h-full p-4 flex flex-col justify-center">
      <div className="text-center mb-4">
        <PenTool className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {totalElements} {totalElements === 1 ? 'element' : 'elements'}
        </p>
      </div>
      
      {displayTypes.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-w-[150px] mx-auto">
          {displayTypes.map(type => (
            <div key={type} className="flex flex-col items-center">
              <div className="text-gray-600 dark:text-gray-400">
                {getIcon(type)}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {elementCounts[type]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}