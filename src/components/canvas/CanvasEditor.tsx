'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { Canvas } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePreBundledLibraries } from '@/hooks/usePreBundledLibraries';
import { usePresence } from '@/hooks/usePresence';
import { useOperations } from '@/hooks/useOperations';
import ShareButton from './ShareButton';
import CollaborativeCursors from './CollaborativeCursors';
import CursorChat from './CursorChat';
import CollaboratorsList from './CollaboratorsList';
import { X, Save, Users, Wifi, WifiOff } from 'lucide-react';
import { 
  detectChanges, 
  changesToOperations, 
  applyOperation, 
  throttle 
} from '@/utils/excalidraw-collab';
import { cleanCanvasUpdates } from '@/utils/firestore-clean';
import { CanvasOperation } from '@/services/operations';
import DebugSync from './DebugSync';

// Import Excalidraw CSS - CRITICAL for proper rendering
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw component and types
const ExcalidrawComponent = dynamic(
  async () => {
    const excalidrawModule = await import('@excalidraw/excalidraw');
    return excalidrawModule.Excalidraw;
  },
  { 
    ssr: false,
  }
);

// We'll import CaptureUpdateAction and other utilities dynamically when needed

// No additional imports needed for thumbnail generation

interface CanvasEditorProps {
  canvas: Canvas | null;
  isOpen: boolean;
  onSave: (canvasId: string, updates: Partial<Canvas>) => Promise<void>;
  onClose: () => void;
}

export default function CanvasEditor({ canvas, isOpen, onSave, onClose }: CanvasEditorProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { getExcalidrawLibraryItems, loading: librariesLoading, error: librariesError } = usePreBundledLibraries();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [title, setTitle] = useState('');
  const [mounted, setMounted] = useState(false);
  const sceneVersion = useRef<number>(0);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastElements = useRef<any[]>([]);
  const isApplyingRemoteOp = useRef(false);
  const pendingRemoteOps = useRef<CanvasOperation[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRemoteOperationRef = useRef<((op: any) => void) | null>(null);
  const excalidrawRef = useRef<any>(null);
  const textEditingInterval = useRef<NodeJS.Timeout | null>(null);
  const isTextEditing = useRef<boolean>(false);
  
  // Collaboration state
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(true);
  const [CaptureUpdateAction, setCaptureUpdateAction] = useState<any>(null);
  const [excalidrawUtils, setExcalidrawUtils] = useState<any>(null);

  // Initialize collaboration hooks
  const {
    otherUsers,
    isConnected,
    userColor,
    updateCursor,
    sendMessage,
    totalUsers
  } = usePresence({
    canvasId: canvas?.id || '',
    enabled: collaborationEnabled && isOpen && !!canvas,
    callbacks: {
      onUserJoin: (user) => {
        console.log('User joined:', user.displayName);
      },
      onUserLeave: (userId) => {
        console.log('User left:', userId);
      }
    }
  });

  // Store API in ref for stable callback access
  const excalidrawAPIRef = useRef<any>(null);
  
  // Update API ref when state changes
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);
  
  // Create a stable callback that doesn't depend on excalidrawAPI in dependencies
  const handleRemoteOperation = useCallback((operation: any) => {
    // Get the current API reference from ref
    const currentAPI = excalidrawAPIRef.current;
    
    if (!currentAPI) {
      pendingRemoteOps.current.push(operation);
      return;
    }
    
    if (isApplyingRemoteOp.current) {
      pendingRemoteOps.current.push(operation);
      return;
    }
    
    isApplyingRemoteOp.current = true;
    
    try {
      // Get current elements from Excalidraw
      const currentElements = currentAPI.getSceneElements();
      
      // Apply the operation to get updated elements
      const updatedElements = applyOperation(currentElements, operation);
      
      // CRITICAL: Use restoreElements if available for proper reconciliation
      let elementsToUpdate = updatedElements;
      
      if (excalidrawUtils?.restoreElements) {
        try {
          // restoreElements properly reconciles elements with Excalidraw's internal state
          const restoredData = excalidrawUtils.restoreElements(updatedElements, null);
          elementsToUpdate = restoredData.elements || updatedElements;
        } catch (e) {
          // Use direct update if restore fails
        }
      }
      
      // Create completely new element objects to force Excalidraw to update
      try {
        // Create new array with element references - Excalidraw elements are already immutable
        const completelyNewElements = [...elementsToUpdate];
        
        // Prepare update parameters
        const updateParams: any = {
          elements: completelyNewElements
        };
        
        // Use the new API if CaptureUpdateAction is available
        if (CaptureUpdateAction && CaptureUpdateAction.NEVER !== undefined) {
          updateParams.captureUpdate = CaptureUpdateAction.NEVER;
        } else {
          updateParams.commitToHistory = false;
        }
        
        // Update the scene
        currentAPI.updateScene(updateParams);
        
        // Debug: Check what elements we just sent to Excalidraw
        const textElementsInUpdate = completelyNewElements.filter(el => el.type === 'text' && el.containerId);
        if (textElementsInUpdate.length > 0) {
          console.log('[CanvasEditor] Text elements sent to updateScene:', textElementsInUpdate.map(el => ({
            id: el.id,
            text: el.text,
            containerId: el.containerId,
            hasText: 'text' in el
          })));
        }
        
        // Update lastElements to prevent detecting this as a local change
        // Use shallow copy of elements to maintain proper change detection
        lastElements.current = completelyNewElements.map(el => ({ ...el }));
        
      } catch (updateError) {
        console.error('[CanvasEditor] ❌ updateScene error:', updateError);
      }
      
    } catch (error) {
      console.error('[CanvasEditor] ❌ Failed to apply remote operation:', error);
    } finally {
      // ALWAYS clear the flag, even if there was an error
      isApplyingRemoteOp.current = false;
      
      // Process any queued operations after clearing the flag
      if (pendingRemoteOps.current.length > 0) {
        const nextOp = pendingRemoteOps.current.shift();
        if (nextOp) {
          // Process next operation after a short delay to avoid stack overflow
          setTimeout(() => {
            handleRemoteOperation(nextOp);
          }, 50);
        }
      }
    }
  }, []); // No dependencies - we access everything via refs and state
  
  // Update the ref whenever the callback changes
  useEffect(() => {
    handleRemoteOperationRef.current = handleRemoteOperation;
  }, [handleRemoteOperation]);

  // Memoize callbacks to prevent unnecessary re-initialization
  const operationCallbacks = useMemo(() => ({
    onRemoteOperation: handleRemoteOperation,
    onSyncStateChange: (syncing: boolean) => {
      console.log('[CanvasEditor] 🔄 Sync state changed:', syncing);
    }
  }), [handleRemoteOperation]);

  const {
    queueOperation,
    isSyncing,
    isInitialized: operationsInitialized
  } = useOperations({
    canvasId: canvas?.id || '',
    enabled: collaborationEnabled && isOpen && !!canvas,
    callbacks: operationCallbacks
  });


  useEffect(() => {
    console.log('[CanvasEditor] 🚀 Component mounted');
    setMounted(true);
    return () => {
      console.log('[CanvasEditor] 💀 Component unmounting');
      setMounted(false);
      // Clean up text editing interval
      if (textEditingInterval.current) {
        clearInterval(textEditingInterval.current);
      }
    };
  }, []);
  
  // Commented out text editing detection due to rendering issues
  // TODO: Investigate why polling during text editing causes Excalidraw rendering errors
  /*
  useEffect(() => {
    if (!excalidrawAPI || !collaborationEnabled || !operationsInitialized || !user) return;
    
    const detectTextEditing = () => {
      // Check if there's an active text editor (textarea) in the Excalidraw canvas
      const textEditor = document.querySelector('.excalidraw-textEditorContainer textarea');
      
      if (textEditor && !isTextEditing.current) {
        // Text editing started
        isTextEditing.current = true;
        console.log('[CanvasEditor] Text editing started, starting polling');
        
        // Start polling for text changes every 500ms
        textEditingInterval.current = setInterval(() => {
          if (!excalidrawAPI) return;
          
          const currentElements = excalidrawAPI.getSceneElements();
          const changes = detectChanges(lastElements.current || [], currentElements);
          
          if (changes.updated.length > 0 || changes.added.length > 0) {
            // Send any changes detected during text editing (including bound text)
            console.log('[CanvasEditor] Changes detected during text editing');
            const operations = changesToOperations(changes);
            
            operations.forEach(async (op) => {
              try {
                await queueOperation(op.type, op.elementIds, op.data);
              } catch (error) {
                console.error('[CanvasEditor] Failed to queue text operation:', error);
              }
            });
            
            // Update lastElements after sending changes
            lastElements.current = currentElements.map(el => ({ ...el }));
          }
        }, 500); // Poll every 500ms for smooth real-time updates
        
      } else if (!textEditor && isTextEditing.current) {
        // Text editing ended
        isTextEditing.current = false;
        console.log('[CanvasEditor] Text editing ended, stopping polling');
        
        if (textEditingInterval.current) {
          clearInterval(textEditingInterval.current);
          textEditingInterval.current = null;
        }
      }
    };
    
    // Check for text editing every 200ms
    const checkInterval = setInterval(detectTextEditing, 200);
    
    return () => {
      clearInterval(checkInterval);
      if (textEditingInterval.current) {
        clearInterval(textEditingInterval.current);
      }
    };
  }, [excalidrawAPI, collaborationEnabled, operationsInitialized, user, queueOperation]);
  */

  // The excalidrawAPI callback will be called when the API is ready

  // Process pending remote operations when API becomes available
  useEffect(() => {
    if (excalidrawAPI && pendingRemoteOps.current.length > 0 && handleRemoteOperationRef.current) {
      console.log('[CanvasEditor] 🚀 Processing', pendingRemoteOps.current.length, 'pending remote operations');
      const ops = [...pendingRemoteOps.current];
      pendingRemoteOps.current = [];
      
      // Process each operation using our main handler via ref
      ops.forEach(op => {
        if (handleRemoteOperationRef.current) {
          handleRemoteOperationRef.current(op);
        }
      });
    }
  }, [excalidrawAPI]); // Use stable ref instead of function directly

  useEffect(() => {
    if (canvas) {
      setTitle(canvas.title);
      setCollaborationEnabled(canvas.collaborationEnabled || false);
      // Reset scene version when canvas changes
      sceneVersion.current = 0;
    } else {
      setTitle('Untitled Canvas');
      setCollaborationEnabled(false);
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
    // Deep copy initial elements to ensure proper change detection
    elements: transformElementsFromFirebase(canvas.elements || []).map(el => ({ ...el })),
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

      // When collaboration is enabled, don't save elements to Firestore
      // They are being synced through RTDB operations instead
      const saveData: any = {
        title,
      };

      // Always save elements, but when collaboration is enabled, 
      // this is just a snapshot - real-time sync happens through RTDB
      saveData.elements = transformedElements;

      saveData.appState = {
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
        };
        
      saveData.files = files || {};

      // Clean the data before saving to Firestore
      const cleanedData = cleanCanvasUpdates(saveData);
      await onSave(canvas.id, cleanedData);
      
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to auto-save canvas:', error);
    }
  }, [excalidrawAPI, canvas, title, onSave, theme, transformElementsForFirebase, collaborationEnabled]);

  // Setup auto-save on changes
  useEffect(() => {
    if (hasChanges) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      // Use longer delay for collaboration mode to avoid conflicts
      const delay = collaborationEnabled ? 10000 : 2000; // 10s for collab, 2s for solo
      autoSaveTimeout.current = setTimeout(async () => {
        if (!excalidrawAPI || !canvas) return;

        try {
          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          // Transform elements for Firebase compatibility (nested arrays -> objects)
          const transformedElements = transformElementsForFirebase(elements);

          // When collaboration is enabled, don't save elements to Firestore
          const saveData: any = {
            title,
          };

          // Always save elements, but when collaboration is enabled, 
          // this is just a snapshot - real-time sync happens through RTDB
          saveData.elements = transformedElements;

          saveData.appState = {
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
            };
            
          saveData.files = files || {};

          // Clean the data before saving to Firestore
          const cleanedData = cleanCanvasUpdates(saveData);
          await onSave(canvas.id, cleanedData);
          
          setHasChanges(false);
        } catch (error) {
          console.error('Failed to auto-save canvas:', error);
        }
      }, delay);
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [hasChanges, excalidrawAPI, canvas, title, onSave, theme, transformElementsForFirebase, collaborationEnabled]);

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

  // Load Excalidraw utilities when component mounts
  useEffect(() => {
    const loadExcalidrawUtils = async () => {
      try {
        const excalidrawModule = await import('@excalidraw/excalidraw');
        
        // Store CaptureUpdateAction
        if (excalidrawModule.CaptureUpdateAction) {
          setCaptureUpdateAction(excalidrawModule.CaptureUpdateAction);
        }
        
        // Store utility functions we might need
        const utils = {
          restoreElements: excalidrawModule.restoreElements,
          getNonDeletedElements: excalidrawModule.getNonDeletedElements,
          getSceneVersion: excalidrawModule.getSceneVersion,
        };
        
        setExcalidrawUtils(utils);
        console.log('[CanvasEditor] Loaded Excalidraw utilities');
      } catch (error) {
        console.error('[CanvasEditor] Failed to load Excalidraw utilities:', error);
      }
    };
    
    if (isOpen) {
      loadExcalidrawUtils();
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
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f9fafb',
          borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e5e7eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 100000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleAutoSave}
            style={{
              padding: '6px 12px',
              fontSize: '16px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: `1px solid ${theme === 'dark' ? '#404040' : '#e5e7eb'}`,
              borderRadius: '6px',
              color: theme === 'dark' ? '#ffffff' : '#111827',
              outline: 'none',
              minWidth: '200px',
            }}
            placeholder="Canvas Title"
          />
          
          {/* Save Status - Hidden to avoid clutter */}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Collaboration Status */}
          {collaborationEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Connection Status */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: isConnected 
                    ? (theme === 'dark' ? '#10b98120' : '#10b98120')
                    : (theme === 'dark' ? '#ef444420' : '#ef444420'),
                  color: isConnected ? '#10b981' : '#ef4444'
                }}
              >
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span style={{ fontSize: '12px', fontWeight: '500' }}>
                  {isConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
              
              {/* Active Users Count */}
              {totalUsers > 0 && (
                <button
                  onClick={() => setShowCollaborators(!showCollaborators)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme === 'dark' ? '#d1d5db' : '#4b5563',
                  }}
                >
                  <Users className="w-4 h-4" />
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>
                    {totalUsers} {totalUsers === 1 ? 'user' : 'users'}
                  </span>
                </button>
              )}
              
              {/* Sync Status */}
              {isSyncing && (
                <span style={{ 
                  fontSize: '12px', 
                  color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  Syncing...
                </span>
              )}
            </div>
          )}
          {/* Share Button */}
          {canvas && (
            <ShareButton
              canvas={canvas}
              onUpdate={async (updates) => {
                await onSave(canvas.id, updates);
                // Update local canvas state if needed
                if (updates.sharedWith || updates.permissions || updates.shareSettings) {
                  // The parent component should handle updating the canvas object
                  // through the onSave callback
                }
              }}
            />
          )}
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            style={{
              padding: '8px',
              backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'dark' ? '#d1d5db' : '#4b5563',
            }}
            aria-label="Close canvas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Excalidraw container - minimal wrapper */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 'calc(100% - 56px)',
          position: 'relative',
          top: '56px',
        }}
        className="excalidraw-wrapper"
      >
        {/* Collaborative Cursors Layer */}
        {collaborationEnabled && otherUsers.length > 0 && (
          <CollaborativeCursors 
            users={otherUsers}
            containerRef={containerRef}
            zoom={excalidrawAPI?.getAppState()?.zoom?.value || 1}
            viewportOffset={{
              x: excalidrawAPI?.getAppState()?.scrollX || 0,
              y: excalidrawAPI?.getAppState()?.scrollY || 0
            }}
          />
        )}
        
        {/* Collaborators List */}
        {collaborationEnabled && showCollaborators && otherUsers.length > 0 && (
          <CollaboratorsList 
            users={otherUsers}
            currentUserColor={userColor}
          />
        )}
        
        {/* Cursor Chat */}
        {collaborationEnabled && isConnected && (
          <CursorChat 
            onSendMessage={sendMessage}
            userColor={userColor}
          />
        )}
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
        {console.log('[CanvasEditor] 🎨 Rendering Excalidraw component with initialData:', !!initialData)}
        <ExcalidrawComponent
          initialData={initialData}
          libraryItems={preBundledLibraries}
          theme={theme}
          excalidrawAPI={(api: any) => {
            console.log('[CanvasEditor] 🎯 excalidrawAPI callback called!', {
              hasAPI: !!api,
              apiType: typeof api,
              hasGetSceneElements: !!(api?.getSceneElements),
              hasUpdateScene: !!(api?.updateScene),
              apiMethods: api ? Object.keys(api).slice(0, 15) : []
            });
            
            if (api && typeof api.updateScene === 'function' && typeof api.getSceneElements === 'function') {
              console.log('[CanvasEditor] ✅ Setting Excalidraw API from callback');
              setExcalidrawAPI(api);
            } else {
              console.error('[CanvasEditor] ❌ Invalid API received in callback:', api);
            }
          }}
          onChange={(elements, appState, files) => {
            // Early return if not ready for collaboration
            if (!user || !canvas) {
              return;
            }
            
            // Check if theme changed in Excalidraw and sync with our app
            if (appState.theme && appState.theme !== theme) {
                toggleTheme();
            }
            
            // Don't process if we're applying remote operations
            if (isApplyingRemoteOp.current) {
              // Still update lastElements to keep in sync - need to copy the elements
              lastElements.current = elements.map(el => ({ ...el }));
              return;
            }
            
            // Initialize lastElements on first change if not set
            if (!lastElements.current || lastElements.current.length === 0) {
              // Copy elements for initialization
              lastElements.current = elements.map(el => ({ ...el }));
              sceneVersion.current = 1;
              // Don't return here if collaboration is enabled - we might miss the first change!
              if (!collaborationEnabled) {
                return;
              }
            }
            
            // Track scene version to detect real changes
            sceneVersion.current = sceneVersion.current + 1;
            
            // Detect and queue operations for collaboration
            if (collaborationEnabled && operationsInitialized && user) {
              const changes = detectChanges(lastElements.current || [], elements);
              
              if (changes.added.length > 0 || changes.updated.length > 0 || changes.deleted.length > 0) {
                // Pass all current elements to ensure bound elements are included
                const operations = changesToOperations(changes, elements);
                
                if (operations.length > 0) {
                  operations.forEach(async (op) => {
                    try {
                      await queueOperation(op.type, op.elementIds, op.data);
                    } catch (error) {
                      console.error('[CanvasEditor] Failed to queue operation:', error);
                    }
                  });
                }
              }
              
              // Update lastElements AFTER processing changes - shallow copy of each element
              // This creates new objects for comparison but avoids deep nested copying
              lastElements.current = elements.map(el => ({ ...el }));
              
              // Debug: Check if text elements are still present
              const textElements = elements.filter(el => el.type === 'text');
              const boundTextElements = textElements.filter(el => el.containerId);
              if (boundTextElements.length > 0) {
                console.log('[CanvasEditor] After update, bound text elements:', boundTextElements.map(el => ({
                  id: el.id,
                  text: el.text,
                  containerId: el.containerId,
                  x: el.x,
                  y: el.y
                })));
              }
            } else {
              // Still update lastElements for when collaboration gets enabled
              lastElements.current = elements.map(el => ({ ...el }));
            }
            
            // Only mark as changed after initial setup (version > 1)
            if (sceneVersion.current > 1) {
              setHasChanges(true);
            }
          }}
          onPointerUpdate={(payload) => {
            if (collaborationEnabled && payload.x !== undefined && payload.y !== undefined) {
              updateCursor(payload.x, payload.y);
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

      {/* Debug sync component */}
      {collaborationEnabled && (
        <DebugSync canvasId={canvas?.id || ''} />
      )}

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