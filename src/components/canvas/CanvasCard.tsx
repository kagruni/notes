'use client';

import { Canvas } from '@/types';
import { PenTool, Trash2, Edit3, Maximize2 } from 'lucide-react';

interface CanvasCardProps {
  canvas: Canvas;
  onOpen: (canvas: Canvas) => void;
  onDelete: (canvasId: string) => void;
  onRename?: (canvas: Canvas) => void;
}

export default function CanvasCard({ canvas, onOpen, onDelete, onRename }: CanvasCardProps) {
  const formatDate = (date: Date | any) => {
    try {
      if (date?.toDate) {
        return date.toDate().toLocaleDateString();
      }
      if (date instanceof Date) {
        return date.toLocaleDateString();
      }
      if (typeof date === 'string' || typeof date === 'number') {
        return new Date(date).toLocaleDateString();
      }
      return 'Unknown date';
    } catch {
      return 'Unknown date';
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this canvas?')) {
      onDelete(canvas.id);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename) {
      onRename(canvas);
    }
  };

  const handleOpen = () => {
    onOpen(canvas);
  };

  // Calculate element count for display
  const elementCount = canvas.elements?.length || 0;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group"
      onClick={handleOpen}
    >
      {/* Canvas Preview Area */}
      <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 relative flex items-center justify-center overflow-hidden">
        {canvas.thumbnail ? (
          <img 
            src={canvas.thumbnail} 
            alt={canvas.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <PenTool className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {elementCount > 0 ? `${elementCount} elements` : 'Empty canvas'}
            </p>
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Maximize2 className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Canvas Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
            {canvas.title}
          </h3>
          <div className="flex items-center space-x-1">
            {onRename && (
              <button
                onClick={handleRename}
                className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                title="Rename canvas"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Delete canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{formatDate(canvas.updatedAt)}</span>
          <span className="text-xs">{elementCount > 0 ? `${elementCount} elements` : 'Empty'}</span>
        </div>
      </div>
    </div>
  );
}