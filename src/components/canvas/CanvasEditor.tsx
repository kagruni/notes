'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { Canvas } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

// Import Excalidraw CSS - CRITICAL for proper rendering
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw component  
const ExcalidrawComponent = dynamic(
  async () => {
    const excalidrawModule = await import('@excalidraw/excalidraw');
    return excalidrawModule.Excalidraw;
  },
  { 
    ssr: false,
  }
);

interface CanvasEditorProps {
  canvas: Canvas | null;
  isOpen: boolean;
  onSave: (canvasId: string, updates: Partial<Canvas>) => Promise<void>;
  onClose: () => void;
}

export default function CanvasEditor({ canvas, isOpen, onSave, onClose }: CanvasEditorProps) {
  const { theme, toggleTheme } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [title, setTitle] = useState('');
  const [mounted, setMounted] = useState(false);
  const sceneVersion = useRef<number>(0);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Reset scene version when theme changes to prevent false change detection
  useEffect(() => {
    sceneVersion.current = 0;
  }, [theme]);

  // Initialize with existing canvas data if editing
  const initialData = canvas && canvas.elements ? {
    elements: canvas.elements || [],
    appState: {
      theme: theme,
      // Set theme-appropriate defaults
      viewBackgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
      currentItemStrokeColor: theme === 'dark' ? '#ffffff' : '#000000',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 1,
      currentItemRoughness: 1,
      currentItemOpacity: 100,
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
      ...canvas.appState,
      // Always override theme to match current app theme
      theme: theme,
    },
    files: canvas.files || {},
    scrollToContent: true
  } : {
    // Default data for new canvas
    elements: [],
    appState: {
      theme: theme,
      viewBackgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
      currentItemStrokeColor: theme === 'dark' ? '#ffffff' : '#000000',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 1,
      currentItemRoughness: 1,
      currentItemOpacity: 100,
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
    },
    files: {}
  };

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (!excalidrawAPI || !canvas) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      await onSave(canvas.id, {
        title,
        elements: elements || [],
        appState: {
          theme: theme,
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
  }, [excalidrawAPI, canvas, title, onSave, theme]);

  // Setup auto-save on changes
  useEffect(() => {
    if (hasChanges) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      autoSaveTimeout.current = setTimeout(async () => {
        if (!excalidrawAPI || !canvas) return;

        try {
          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          await onSave(canvas.id, {
            title,
            elements: elements || [],
            appState: {
              theme: theme,
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
      }, 1000);
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [hasChanges, excalidrawAPI, canvas, title, onSave]);

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

  // Hide "Excalidraw links" heading and extra dividers using JavaScript
  useEffect(() => {
    const hideExcalidrawLinksAndDividers = () => {
      // Look for any element containing "Excalidraw links" text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.includes('Excalidraw links')) {
          // Hide the parent element
          let parent = node.parentElement;
          while (parent && parent !== document.body) {
            if (parent.tagName === 'H1' || parent.tagName === 'H2' || 
                parent.tagName === 'H3' || parent.tagName === 'H4' || 
                parent.tagName === 'H5' || parent.tagName === 'H6' ||
                parent.textContent?.trim() === 'Excalidraw links') {
              parent.style.display = 'none';
              break;
            }
            parent = parent.parentElement;
          }
        }
      }

      // Remove extra dividers/separators - more aggressive approach
      const allElements = document.querySelectorAll('*');
      const dividers = [];
      
      allElements.forEach(el => {
        // Look for elements that look like dividers
        const className = el.className || '';
        if (el.tagName === 'HR' || 
            (typeof className === 'string' && (className.includes('separator') || className.includes('divider'))) ||
            (el.offsetHeight < 5 && el.offsetWidth > 100 && 
             (el.style.backgroundColor || el.style.borderTop || el.style.borderBottom))) {
          dividers.push(el);
        }
      });
      
      // Hide all but the first divider in the menu
      if (dividers.length > 1) {
        dividers.slice(1).forEach(divider => {
          divider.style.display = 'none';
        });
      }
      
      // Also try to find menu-specific dividers
      const menuContent = document.querySelector('.Island__content, .MenuTrigger__content');
      if (menuContent) {
        const menuDividers = menuContent.querySelectorAll('hr, [style*="border"], [style*="background"]');
        if (menuDividers.length > 1) {
          // Keep only the first divider
          for (let i = 1; i < menuDividers.length; i++) {
            menuDividers[i].style.display = 'none';
          }
        }
      }
    };

    if (isOpen && mounted) {
      // Run immediately and after a short delay to catch dynamically added content
      hideExcalidrawLinksAndDividers();
      const timer = setTimeout(hideExcalidrawLinksAndDividers, 500);
      
      // Also set up a mutation observer to catch future changes
      const observer = new MutationObserver(hideExcalidrawLinksAndDividers);
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });

      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
  }, [isOpen, mounted]);

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
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
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
        {/* Hide social links with CSS */}
        <style>{`
          [data-testid="socials"] {
            display: none !important;
          }
          .Menu__socials {
            display: none !important;
          }
          a[href*="github.com"],
          a[href*="twitter.com"], 
          a[href*="x.com"],
          a[href*="discord.gg"] {
            display: none !important;
          }
          /* Hide the extra divider that was before the social links section */
          .Menu__separator:last-of-type {
            display: none !important;
          }
          /* Alternative approach - hide empty separator elements */
          hr:empty {
            display: none !important;
          }
          .MenuTrigger__content > div > hr:nth-last-child(2) {
            display: none !important;
          }
        `}</style>
        <ExcalidrawComponent
          initialData={initialData}
          theme={theme}
          onChange={(elements, appState) => {
            // Check if theme changed in Excalidraw and sync with our app
            if (appState.theme && appState.theme !== theme) {
              console.log('Theme changed in Excalidraw:', appState.theme, 'current app theme:', theme);
              toggleTheme();
            }
            
            // Track scene version to detect real changes
            // Excalidraw fires onChange on mount and during initialization
            // We only want to track changes after initial setup
            sceneVersion.current = sceneVersion.current + 1;
            // Only mark as changed after initial setup (version > 1)
            // This makes auto-save more sensitive to changes
            if (sceneVersion.current > 1) {
              setHasChanges(true);
            }
          }}
          onPointerUpdate={() => {}}
          excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
          name={title}
          UIOptions={{
            canvasActions: {
              loadScene: true,
              saveToActiveFile: true,
              saveAsImage: true,
              clearCanvas: true,
              toggleTheme: true,
              changeViewBackgroundColor: true,
              export: {
                saveFileToDisk: true,
              }
            }
          }}
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
          backgroundColor: theme === 'dark' ? 'rgba(60, 60, 60, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
          color: theme === 'dark' ? '#ffffff' : '#000000',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme === 'dark' ? '0 2px 4px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
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

    </div>
  );

  // Use portal to render outside of the app's DOM hierarchy
  return createPortal(excalidrawContent, document.body);
}