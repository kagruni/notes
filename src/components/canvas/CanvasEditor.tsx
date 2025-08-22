'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { Canvas } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { usePreBundledLibraries } from '@/hooks/usePreBundledLibraries';

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

// No additional imports needed for thumbnail generation

interface CanvasEditorProps {
  canvas: Canvas | null;
  isOpen: boolean;
  onSave: (canvasId: string, updates: Partial<Canvas>) => Promise<void>;
  onClose: () => void;
}

export default function CanvasEditor({ canvas, isOpen, onSave, onClose }: CanvasEditorProps) {
  const { theme, toggleTheme } = useTheme();
  const { getExcalidrawLibraryItems, loading: librariesLoading, error: librariesError } = usePreBundledLibraries();
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

  // Get pre-bundled libraries
  const preBundledLibraries = getExcalidrawLibraryItems();

  // Transform elements for Firebase compatibility (nested arrays -> objects)
  const transformElementsForFirebase = useCallback((elements: any[]) => {
    return (elements || []).map(element => {
      const transformed = { ...element };
      
      Object.keys(transformed).forEach(key => {
        const value = transformed[key];
        
        if (key === 'points' && Array.isArray(value)) {
          // Convert points array [[x,y], [x,y]] to [{x, y}, {x, y}] for Firebase
          transformed[key] = value.map(point => {
            if (Array.isArray(point) && point.length >= 2) {
              return { x: point[0], y: point[1] };
            }
            // Already in object format or invalid
            return point;
          });
        } else if (key === 'scale' && Array.isArray(value) && value.length === 2) {
          // Convert scale [x, y] to {x, y}
          transformed[key] = { x: value[0], y: value[1] };
        } else if (key === 'boundElements' && Array.isArray(value)) {
          // Ensure boundElements are objects, not nested arrays
          transformed[key] = value
            .filter(el => el != null)
            .map(el => {
              if (Array.isArray(el)) {
                console.warn(`🔧 Converting boundElement array to object:`, el);
                return { id: el[0], type: el[1] || 'arrow' };
              }
              return el;
            });
        } else if (key === 'groupIds' && Array.isArray(value)) {
          // Ensure groupIds is a flat array of strings
          transformed[key] = value
            .filter(id => id != null)
            .map(id => String(id));
        } else if (Array.isArray(value)) {
          // Check for any other nested arrays and convert them
          const hasNestedArrays = value.some(item => Array.isArray(item));
          if (hasNestedArrays) {
            console.warn(`🔧 Found nested array in ${key}, converting to objects`);
            transformed[key] = value.map(item => {
              if (Array.isArray(item)) {
                // Convert array to object representation
                if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
                  return { x: item[0], y: item[1] };
                }
                return { data: item };
              }
              return item;
            });
          }
        }
      });
      
      return transformed;
    });
  }, []);

  // Transform elements from Firebase back to Excalidraw format
  const transformElementsFromFirebase = useCallback((elements: any[]) => {
    if (!elements) return [];
    
    return elements.map(element => {
      const restored = { ...element };
      
      Object.keys(restored).forEach(key => {
        const value = restored[key];
        
        if (key === 'points' && Array.isArray(value)) {
          // Convert points from [{x, y}, {x, y}] back to [[x,y], [x,y]]
          restored[key] = value.map(point => {
            if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
              return [point.x, point.y];
            }
            // Already in array format or invalid
            return point;
          });
        } else if (key === 'scale' && value && typeof value === 'object' && 'x' in value && 'y' in value) {
          // Convert scale from {x, y} back to [x, y]
          restored[key] = [value.x, value.y];
        } else if (Array.isArray(value)) {
          // Check if array contains objects that should be arrays
          const needsConversion = value.some(item => 
            item && typeof item === 'object' && 'x' in item && 'y' in item
          );
          if (needsConversion) {
            restored[key] = value.map(item => {
              if (item && typeof item === 'object' && 'x' in item && 'y' in item) {
                return [item.x, item.y];
              }
              if (item && typeof item === 'object' && 'data' in item) {
                return item.data;
              }
              return item;
            });
          }
        }
      });
      
      return restored;
    });
  }, []);

  // Initialize with existing canvas data if editing
  const initialData = canvas && canvas.elements ? {
    elements: transformElementsFromFirebase(canvas.elements || []),
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
    files: {},
    libraryItems: preBundledLibraries
  };

  // No thumbnail generation needed - we render live previews from elements

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (!excalidrawAPI || !canvas) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Transform elements for Firebase compatibility (nested arrays -> objects)
      const transformedElements = transformElementsForFirebase(elements);

      await onSave(canvas.id, {
        title,
        elements: transformedElements,
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
  }, [excalidrawAPI, canvas, title, onSave, theme, transformElementsForFirebase]);

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

          // Transform elements for Firebase compatibility (nested arrays -> objects)
          const transformedElements = transformElementsForFirebase(elements);

          await onSave(canvas.id, {
            title,
            elements: transformedElements,
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
  }, [hasChanges, excalidrawAPI, canvas, title, onSave, theme, transformElementsForFirebase]);

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

  // Add debug logging
  useEffect(() => {
    if (!librariesLoading && preBundledLibraries.length > 0) {
      console.log(`🎨 Canvas Editor: Loaded ${preBundledLibraries.length} library items`);
      console.log(`🎨 Canvas Editor: Sample library items:`, preBundledLibraries.slice(0, 2));
      console.log(`🎨 Canvas Editor: Passing to Excalidraw initialData.libraryItems:`, preBundledLibraries);
    }
    if (librariesError) {
      console.error('🚨 Canvas Editor: Library loading error:', librariesError);
    }
  }, [librariesLoading, preBundledLibraries.length, librariesError]);

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
          libraryItems={preBundledLibraries}
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
          excalidrawAPI={(api: any) => {
            setExcalidrawAPI(api);
            // Try to load libraries using the API
            if (api && preBundledLibraries.length > 0) {
              console.log('🔧 Attempting to load libraries via excalidrawAPI:', preBundledLibraries.length);
              try {
                // Try different API methods to load libraries
                if (api.updateLibrary) {
                  api.updateLibrary({ libraryItems: preBundledLibraries });
                  console.log('✅ Used api.updateLibrary');
                } else if (api.setLibraryItems) {
                  api.setLibraryItems(preBundledLibraries);
                  console.log('✅ Used api.setLibraryItems');
                } else if (api.addLibraryItems) {
                  api.addLibraryItems(preBundledLibraries);
                  console.log('✅ Used api.addLibraryItems');
                } else {
                  console.log('❌ No library loading method found on excalidrawAPI');
                  console.log('Available API methods:', Object.keys(api));
                }
              } catch (error) {
                console.error('❌ Error loading libraries via API:', error);
              }
            }
          }}
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