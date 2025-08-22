'use client';

import { Canvas } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface CanvasThumbnailProps {
  canvas: Canvas;
}

export default function CanvasThumbnail({ canvas }: CanvasThumbnailProps) {
  const { theme } = useTheme();
  const elements = canvas.elements || [];
  
  console.log(`Canvas "${canvas.title}" elements:`, elements.length, elements);
  
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasElements = false;
  
  elements.forEach((element: any) => {
    if (element.isDeleted) return;
    hasElements = true;
    
    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 100;
    const height = element.height || 100;
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });
  
  if (!hasElements) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="text-center">
          <div className="text-gray-400 dark:text-gray-600">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Empty canvas</p>
        </div>
      </div>
    );
  }
  
  // Add padding
  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  
  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = maxY - minY;
  
  // Create SVG elements for each shape
  const renderElement = (element: any) => {
    if (element.isDeleted) return null;
    
    const strokeColor = element.strokeColor || (theme === 'dark' ? '#e5e7eb' : '#374151');
    const fillColor = element.backgroundColor === 'transparent' ? 'none' : (element.backgroundColor || 'none');
    const strokeWidth = element.strokeWidth || 2;
    const opacity = (element.opacity || 100) / 100;
    
    const commonProps = {
      stroke: strokeColor,
      fill: fillColor,
      strokeWidth: strokeWidth,
      opacity: opacity,
    };
    
    switch (element.type) {
      case 'rectangle':
        return (
          <rect
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width || 0}
            height={element.height || 0}
            {...commonProps}
          />
        );
        
      case 'ellipse':
        return (
          <ellipse
            key={element.id}
            cx={element.x + (element.width || 0) / 2}
            cy={element.y + (element.height || 0) / 2}
            rx={(element.width || 0) / 2}
            ry={(element.height || 0) / 2}
            {...commonProps}
          />
        );
        
      case 'diamond':
        const cx = element.x + (element.width || 0) / 2;
        const cy = element.y + (element.height || 0) / 2;
        const w2 = (element.width || 0) / 2;
        const h2 = (element.height || 0) / 2;
        return (
          <path
            key={element.id}
            d={`M ${cx} ${element.y} L ${element.x + (element.width || 0)} ${cy} L ${cx} ${element.y + (element.height || 0)} L ${element.x} ${cy} Z`}
            {...commonProps}
          />
        );
        
      case 'arrow':
      case 'line':
        if (element.points && element.points.length >= 2) {
          const points = element.points.map((p: any) => {
            let px = 0, py = 0;
            if (typeof p === 'object' && p !== null) {
              px = p.x || 0;
              py = p.y || 0;
            } else if (Array.isArray(p)) {
              px = p[0] || 0;
              py = p[1] || 0;
            }
            return `${element.x + px},${element.y + py}`;
          }).join(' ');
          
          return (
            <polyline
              key={element.id}
              points={points}
              fill="none"
              {...commonProps}
            />
          );
        }
        return null;
        
      case 'text':
        return (
          <text
            key={element.id}
            x={element.x}
            y={element.y + (element.height || 0) / 2}
            fontSize={element.fontSize || 20}
            fill={strokeColor}
            opacity={opacity}
          >
            {element.text || ''}
          </text>
        );
        
      case 'freedraw':
        if (element.points && element.points.length > 0) {
          const points = element.points.map((p: any, i: number) => {
            let px = 0, py = 0;
            if (typeof p === 'object' && p !== null) {
              px = p.x || 0;
              py = p.y || 0;
            } else if (Array.isArray(p)) {
              px = p[0] || 0;
              py = p[1] || 0;
            }
            return `${i === 0 ? 'M' : 'L'} ${element.x + px} ${element.y + py}`;
          }).join(' ');
          
          return (
            <path
              key={element.id}
              d={points}
              fill="none"
              {...commonProps}
            />
          );
        }
        return null;
        
      default:
        // Render unknown elements as a simple rectangle outline
        return (
          <rect
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width || 100}
            height={element.height || 100}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.3}
          />
        );
    }
  };
  
  console.log(`Rendering SVG with viewBox: ${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`);
  
  return (
    <div className="w-full h-full" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6' }}>
      <svg
        viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background rect to ensure visibility */}
        <rect 
          x={minX} 
          y={minY} 
          width={viewBoxWidth} 
          height={viewBoxHeight} 
          fill={theme === 'dark' ? '#1f2937' : '#ffffff'}
        />
        {elements.map(renderElement).filter(Boolean)}
      </svg>
    </div>
  );
}