'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { NoteDrawing } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { Edit2, Expand, X } from 'lucide-react';

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => {
    const module = await import('@excalidraw/excalidraw');
    return module.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-gray-500">Loading drawing...</div>
      </div>
    )
  }
);

interface DrawingViewerProps {
  drawing: NoteDrawing;
  onEdit?: () => void;
  onDelete?: () => void;
  editable?: boolean;
  className?: string;
}

export default function DrawingViewer({ 
  drawing, 
  onEdit, 
  onDelete,
  editable = false,
  className = ''
}: DrawingViewerProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const initialData = {
    elements: drawing.elements || [],
    appState: {
      ...(drawing.appState || {}),
      viewModeEnabled: !editable,
      zenModeEnabled: false,
      gridSize: null
    },
    files: drawing.files || {},
    scrollToContent: true
  };

  // Format date
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

  return (
    <>
      <div className={`relative group ${className}`}>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Drawing • {formatDate(drawing.createdAt)}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsExpanded(true)}
                className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Expand"
              >
                <Expand className="w-4 h-4" />
              </button>
              {editable && onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {editable && onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Drawing Canvas */}
          <div className="h-64 relative">
            <Excalidraw
              theme={theme === 'dark' ? 'dark' : 'light'}
              initialData={initialData}
              viewModeEnabled={true}
              zenModeEnabled={false}
              gridModeEnabled={false}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  export: false,
                  saveToActiveFile: false,
                  toggleTheme: false,
                  changeViewBackgroundColor: false
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Expanded View Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Drawing Preview
              </h3>
              <div className="flex items-center space-x-2">
                {editable && onEdit && (
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      onEdit();
                    }}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Expanded Drawing */}
            <div className="flex-1 relative">
              <Excalidraw
                theme={theme === 'dark' ? 'dark' : 'light'}
                initialData={initialData}
                viewModeEnabled={true}
                zenModeEnabled={false}
                gridModeEnabled={false}
                UIOptions={{
                  canvasActions: {
                    loadScene: false,
                    export: {
                      saveFileToDisk: true
                    },
                    saveToActiveFile: false,
                    toggleTheme: false,
                    changeViewBackgroundColor: false
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}