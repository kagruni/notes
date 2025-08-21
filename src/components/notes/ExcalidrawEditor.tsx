'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { NoteDrawing } from '@/types';
import { X, Save, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => {
    const module = await import('@excalidraw/excalidraw');
    return module.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading drawing canvas...</div>
      </div>
    )
  }
);

interface ExcalidrawEditorProps {
  drawing?: NoteDrawing | null;
  onSave: (drawing: Omit<NoteDrawing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export default function ExcalidrawEditor({ drawing, onSave, onClose }: ExcalidrawEditorProps) {
  const { theme } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize with existing drawing data if editing
  const initialData = drawing ? {
    elements: drawing.elements || [],
    appState: drawing.appState || {},
    files: drawing.files || {}
  } : undefined;

  const handleSave = useCallback(() => {
    if (!excalidrawAPI) return;

    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();

    onSave({
      elements,
      appState: {
        // Only save relevant app state properties
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemFontFamily: appState.currentItemFontFamily,
        currentItemFontSize: appState.currentItemFontSize,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
        currentItemFillStyle: appState.currentItemFillStyle,
        currentItemStrokeWidth: appState.currentItemStrokeWidth,
        currentItemRoughness: appState.currentItemRoughness,
        currentItemOpacity: appState.currentItemOpacity,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
      files: files || {}
    });
    
    setHasChanges(false);
  }, [excalidrawAPI, onSave]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Close: Escape (only when not fullscreen)
      if (e.key === 'Escape' && !isFullscreen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleClose, isFullscreen]);

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col ${
          isFullscreen 
            ? 'w-full h-full' 
            : 'w-full max-w-6xl h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {drawing ? 'Edit Drawing' : 'Create Drawing'}
          </h2>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600 dark:text-orange-400">
                Unsaved changes
              </span>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excalidraw Canvas */}
        <div className="flex-1 relative">
          <Excalidraw
            theme={theme === 'dark' ? 'dark' : 'light'}
            initialData={initialData}
            onChange={(elements: any, appState: any) => {
              setHasChanges(true);
            }}
            onPointerUpdate={() => {}}
            excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: {
                  saveFileToDisk: true
                },
                toggleTheme: false
              }
            }}
          />
        </div>

        {/* Footer with instructions */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>💡 Tip: Use shapes, text, and freehand drawing tools</span>
              <span className="hidden sm:inline">• Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+S</kbd> to save</span>
            </div>
            <div className="text-xs">
              Powered by Excalidraw
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}