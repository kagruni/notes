'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { Canvas } from '@/types';

// Import Excalidraw CSS - CRITICAL for proper rendering
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw component
const Excalidraw = dynamic(
  async () => {
    const excalidrawModule = await import('@excalidraw/excalidraw');
    return excalidrawModule.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        zIndex: 99999
      }}>
        <div>Loading canvas...</div>
      </div>
    )
  }
);

interface CanvasEditorProps {
  canvas: Canvas | null;
  isOpen: boolean;
  onSave: (canvasId: string, updates: Partial<Canvas>) => Promise<void>;
  onClose: () => void;
}

export default function CanvasEditor({ canvas, isOpen, onSave, onClose }: CanvasEditorProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [title, setTitle] = useState('');
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const sceneVersion = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (canvas) {
      setTitle(canvas.title);
      // Reset scene version when canvas changes
      sceneVersion.current = 0;
    } else {
      setTitle('Untitled Canvas');
    }
    setHasChanges(false);
  }, [canvas]);

  // Initialize with existing canvas data if editing
  const initialData = canvas && canvas.elements ? {
    elements: canvas.elements || [],
    appState: canvas.appState || {},
    files: canvas.files || {},
    scrollToContent: true
  } : undefined;

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (!excalidrawAPI || !canvas || !hasChanges) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      await onSave(canvas.id, {
        title,
        elements,
        appState: {
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
    } catch (error) {
      console.error('Failed to auto-save canvas:', error);
    }
  }, [excalidrawAPI, canvas, title, onSave, hasChanges]);

  // Setup auto-save on changes
  useEffect(() => {
    if (hasChanges) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      
      const timeout = setTimeout(() => {
        handleAutoSave();
      }, 2000);
      
      setAutoSaveTimeout(timeout);
    }
    
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [hasChanges, handleAutoSave, autoSaveTimeout]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close: Escape (but not when typing in Excalidraw)
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('.excalidraw')) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [onClose, isOpen]);

  // Save viewport and restore it
  useEffect(() => {
    if (isOpen) {
      // Reset scene version when opening
      sceneVersion.current = 0;
      setHasChanges(false);
      
      // Save original viewport
      const originalViewport = document.querySelector('meta[name="viewport"]');
      const originalContent = originalViewport?.getAttribute('content') || '';
      
      // Set viewport for Excalidraw
      if (originalViewport) {
        originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      }
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore original viewport
        if (originalViewport) {
          originalViewport.setAttribute('content', originalContent);
        }
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Save before closing if there are changes
  const handleClose = useCallback(async () => {
    if (hasChanges) {
      await handleAutoSave();
    }
    onClose();
  }, [hasChanges, handleAutoSave, onClose]);

  if (!isOpen || !canvas || !mounted) return null;

  // Render in a portal to escape all parent styles
  const excalidrawContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        backgroundColor: '#ffffff',
      }}
    >
      {/* Excalidraw container - minimal wrapper */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
        className="excalidraw-wrapper"
      >
        <Excalidraw
          initialData={initialData}
          onChange={() => {
            // Track scene version to detect real changes
            // Excalidraw fires onChange on mount and during initialization
            // We only want to track changes after the second onChange event
            sceneVersion.current = sceneVersion.current + 1;
            // Only mark as changed after initial setup (version > 2)
            if (sceneVersion.current > 2) {
              setHasChanges(true);
            }
          }}
          onPointerUpdate={() => {}}
          excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
          name={title}
        />
      </div>

      {/* Minimal close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 100000,
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}
        title="Close (Esc)"
        aria-label="Close canvas"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Auto-save indicator */}
      {hasChanges && (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100000,
            padding: '6px 12px',
            borderRadius: '20px',
            backgroundColor: '#fb923c',
            color: 'white',
            fontSize: '13px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        >
          Auto-saving...
        </div>
      )}
    </div>
  );

  // Use portal to render outside of the app's DOM hierarchy
  return createPortal(excalidrawContent, document.body);
}