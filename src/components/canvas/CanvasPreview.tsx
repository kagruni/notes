'use client';

import { Canvas } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface CanvasPreviewProps {
  canvas: Canvas;
}

export default function CanvasPreview({ canvas }: CanvasPreviewProps) {
  const { theme } = useTheme();
  const elements = canvas.elements || [];
  
  // Filter out deleted elements
  const visibleElements = elements.filter((el: any) => !el.isDeleted);
  
  if (visibleElements.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" 
           style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#f9fafb' }}>
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" 
               stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} 
               strokeWidth="1.5" className="mx-auto mb-2">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <p className="text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
            Empty canvas
          </p>
        </div>
      </div>
    );
  }
  
  // Calculate bounding box for all elements
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  visibleElements.forEach((element: any) => {
    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 50;
    const height = element.height || 50;
    
    minX = Math.min(minX, x - 10);
    minY = Math.min(minY, y - 10);
    maxX = Math.max(maxX, x + width + 10);
    maxY = Math.max(maxY, y + height + 10);
  });
  
  // Calculate viewBox and scale
  const padding = 20;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxWidth = (maxX - minX) + (padding * 2);
  const viewBoxHeight = (maxY - minY) + (padding * 2);
  
  // Render element based on type
  const renderElement = (element: any, index: number) => {
    const strokeColor = element.strokeColor || (theme === 'dark' ? '#e5e7eb' : '#374151');
    const fillColor = element.backgroundColor === 'transparent' ? 'none' : 
                     (element.backgroundColor || 'none');
    const strokeWidth = Math.min(element.strokeWidth || 2, 3);
    const opacity = (element.opacity || 100) / 100;
    
    // Common props for all shapes
    const shapeProps = {
      stroke: strokeColor,
      fill: fillColor,
      strokeWidth: strokeWidth,
      opacity: opacity,
    };
    
    switch (element.type) {
      case 'rectangle':
        return (
          <rect
            key={`${element.id}-${index}`}
            x={element.x}
            y={element.y}
            width={Math.max(element.width || 0, 1)}
            height={Math.max(element.height || 0, 1)}
            rx={element.roughness > 1 ? 5 : 0}
            {...shapeProps}
          />
        );
        
      case 'ellipse':
        return (
          <ellipse
            key={`${element.id}-${index}`}
            cx={element.x + (element.width || 0) / 2}
            cy={element.y + (element.height || 0) / 2}
            rx={Math.max((element.width || 0) / 2, 1)}
            ry={Math.max((element.height || 0) / 2, 1)}
            {...shapeProps}
          />
        );
        
      case 'diamond':
        const cx = element.x + (element.width || 0) / 2;
        const cy = element.y + (element.height || 0) / 2;
        const w2 = (element.width || 0) / 2;
        const h2 = (element.height || 0) / 2;
        return (
          <path
            key={`${element.id}-${index}`}
            d={`M ${cx} ${element.y} L ${element.x + (element.width || 0)} ${cy} L ${cx} ${element.y + (element.height || 0)} L ${element.x} ${cy} Z`}
            {...shapeProps}
          />
        );
        
      case 'arrow':
      case 'line':
        if (element.points && element.points.length >= 2) {
          // Get first and last point for simple line
          const firstPoint = element.points[0];
          const lastPoint = element.points[element.points.length - 1];
          
          const x1 = element.x + (typeof firstPoint === 'object' ? (firstPoint.x || 0) : 
                     (Array.isArray(firstPoint) ? firstPoint[0] : 0));
          const y1 = element.y + (typeof firstPoint === 'object' ? (firstPoint.y || 0) : 
                     (Array.isArray(firstPoint) ? firstPoint[1] : 0));
          const x2 = element.x + (typeof lastPoint === 'object' ? (lastPoint.x || 0) : 
                     (Array.isArray(lastPoint) ? lastPoint[0] : 0));
          const y2 = element.y + (typeof lastPoint === 'object' ? (lastPoint.y || 0) : 
                     (Array.isArray(lastPoint) ? lastPoint[1] : 0));
          
          return (
            <line
              key={`${element.id}-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              {...shapeProps}
              fill="none"
            />
          );
        }
        return null;
        
      case 'text':
        const fontSize = Math.min(element.fontSize || 16, 20);
        return (
          <text
            key={`${element.id}-${index}`}
            x={element.x}
            y={element.y + fontSize}
            fontSize={fontSize}
            fill={strokeColor}
            opacity={opacity}
            fontFamily="sans-serif"
          >
            {(element.text || '').substring(0, 20)}
          </text>
        );
        
      case 'freedraw':
        if (element.points && element.points.length > 1) {
          // Create a simplified path from points
          const pathData = element.points.map((p: any, i: number) => {
            const px = element.x + (typeof p === 'object' ? (p.x || 0) : 
                       (Array.isArray(p) ? p[0] : 0));
            const py = element.y + (typeof p === 'object' ? (p.y || 0) : 
                       (Array.isArray(p) ? p[1] : 0));
            return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
          }).join(' ');
          
          return (
            <path
              key={`${element.id}-${index}`}
              d={pathData}
              {...shapeProps}
              fill="none"
            />
          );
        }
        return null;
        
      default:
        // For unknown types, show as a simple rectangle
        return (
          <rect
            key={`${element.id}-${index}`}
            x={element.x}
            y={element.y}
            width={Math.max(element.width || 50, 1)}
            height={Math.max(element.height || 50, 1)}
            {...shapeProps}
            strokeDasharray="5,5"
            fillOpacity={0.1}
          />
        );
    }
  };
  
  return (
    <div className="w-full h-full" 
         style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' }}>
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <rect 
          x={viewBoxX} 
          y={viewBoxY} 
          width={viewBoxWidth} 
          height={viewBoxHeight}
          fill={theme === 'dark' ? '#1f2937' : '#ffffff'}
        />
        
        {/* Render all elements */}
        {visibleElements.map((element, index) => renderElement(element, index))}
      </svg>
    </div>
  );
}