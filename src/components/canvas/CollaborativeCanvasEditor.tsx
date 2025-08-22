'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Canvas } from '@/types';
import { collaborationService } from '@/services/collaborationService';
import SimplifiedCollaborativeCursors from './SimplifiedCollaborativeCursors';
import { UserPresence } from '@/services/presence';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';

// Import Excalidraw CSS
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw
const Excalidraw = dynamic(
  async () => {
    const module = await import('@excalidraw/excalidraw');
    return module.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

interface CollaborativeCanvasEditorProps {
  canvasId: string;
  readOnly?: boolean;
  collaborationEnabled?: boolean;
}

export default function CollaborativeCanvasEditor({ 
  canvasId, 
  readOnly = false,
  collaborationEnabled = false 
}: CollaborativeCanvasEditorProps) {
  const { user } = useAuth();
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);
  const [lastSavedElements, setLastSavedElements] = useState<any[]>([]);

  // Load canvas data
  useEffect(() => {
    if (!canvasId) return;

    const canvasRef = doc(db, 'canvases', canvasId);
    const unsubscribe = onSnapshot(canvasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Canvas;
        setCanvas(data);
        
        // Load saved elements if they exist
        if (data.elements && excalidrawAPI) {
          const elements = transformElementsFromFirebase(data.elements);
          // Only update if elements have changed to avoid infinite loops
          if (JSON.stringify(elements) !== JSON.stringify(lastSavedElements)) {
            excalidrawAPI.updateScene({
              elements: elements,
              appState: data.appState || {}
            });
            setLastSavedElements(elements);
          }
        }
        
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [canvasId, excalidrawAPI]);

  // Transform elements from Firebase format
  const transformElementsFromFirebase = useCallback((elements: any) => {
    if (!elements) return [];
    
    try {
      // Handle if elements is already an array
      if (Array.isArray(elements)) {
        return elements;
      }
      
      // Convert from object format back to array
      if (typeof elements === 'object') {
        // Check if it's stored with element_ prefix keys
        const keys = Object.keys(elements);
        if (keys.length > 0 && keys[0].startsWith('element_')) {
          // Sort by index and extract elements
          return keys
            .sort((a, b) => {
              const indexA = parseInt(a.replace('element_', ''));
              const indexB = parseInt(b.replace('element_', ''));
              return indexA - indexB;
            })
            .map(key => {
              const element = elements[key];
              // Convert points back from object to array if needed
              if (element.points && typeof element.points === 'object' && !Array.isArray(element.points)) {
                const pointKeys = Object.keys(element.points).sort((a, b) => {
                  const indexA = parseInt(a.replace('p', ''));
                  const indexB = parseInt(b.replace('p', ''));
                  return indexA - indexB;
                });
                element.points = pointKeys.map(pk => element.points[pk]);
              }
              return element;
            });
        }
        return Object.values(elements);
      }
    } catch (error) {
      console.error('Error transforming elements from Firebase:', error);
    }
    
    return [];
  }, []);

  // Transform elements for Firebase storage
  const transformElementsForFirebase = useCallback((elements: any[]) => {
    if (!elements || !Array.isArray(elements)) return {};
    
    // Convert array to object for Firebase
    const elementObj: { [key: string]: any } = {};
    elements.forEach((element, index) => {
      if (element && typeof element === 'object') {
        elementObj[`element_${index}`] = {
          ...element,
          // Convert any nested arrays to objects
          points: Array.isArray(element.points) 
            ? element.points.reduce((acc: any, point: any, i: number) => {
                acc[`p${i}`] = point;
                return acc;
              }, {})
            : element.points
        };
      }
    });
    
    return elementObj;
  }, []);

  // Save canvas data with debouncing
  const saveCanvas = useCallback(
    debounce(async (elements: any[], appState: any) => {
      if (!canvasId || readOnly || !user) return;

      try {
        const canvasRef = doc(db, 'canvases', canvasId);
        const transformedElements = transformElementsForFirebase(elements);
        
        await updateDoc(canvasRef, {
          elements: transformedElements,
          appState: {
            ...appState,
            collaborators: undefined,
            currentItemFontFamily: undefined
          },
          lastModified: new Date(),
          lastModifiedBy: user.uid
        });

        setLastSavedElements(elements);
      } catch (error) {
        console.error('Error saving canvas:', error);
        toast.error('Failed to save canvas');
      }
    }, 1000),
    [canvasId, readOnly, user]
  );

  // Handle Excalidraw changes
  const handleChange = useCallback((elements: any[], appState: any) => {
    if (!readOnly) {
      saveCanvas(elements, appState);
    }

    // Broadcast cursor position if collaboration is enabled
    if (collaborationEnabled && user && excalidrawAPI) {
      const { scrollX, scrollY } = appState;
      const pointer = excalidrawAPI.getAppState()?.cursorPosition;
      
      if (pointer) {
        collaborationService.broadcastCursor(canvasId, user.uid, {
          x: pointer.x,
          y: pointer.y,
          scrollX,
          scrollY
        });
      }
    }
  }, [readOnly, collaborationEnabled, user, canvasId, excalidrawAPI, saveCanvas]);

  // Subscribe to collaboration updates
  useEffect(() => {
    if (!collaborationEnabled || !canvasId) return;

    const unsubscribe = collaborationService.subscribeToCanvas(canvasId, {
      onUserJoin: (userId, userData) => {
        const newUser: UserPresence = {
          userId,
          email: userData.email || '',
          displayName: userData.name || userData.email || 'Anonymous',
          color: userData.color || '#' + Math.floor(Math.random()*16777215).toString(16),
          lastSeen: Date.now(),
          isOnline: true
        };
        setCollaborators(prev => [...prev.filter(c => c.userId !== userId), newUser]);
      },
      onUserLeave: (userId) => {
        setCollaborators(prev => prev.filter(c => c.userId !== userId));
      },
      onCursorMove: (userId, cursor) => {
        setCollaborators(prev => prev.map(c => 
          c.userId === userId ? { ...c, cursor } : c
        ));
      }
    });

    return () => unsubscribe();
  }, [collaborationEnabled, canvasId]);

  if (loading || !canvas) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const initialData = {
    elements: transformElementsFromFirebase(canvas.elements || []),
    appState: {
      ...canvas.appState,
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1
    },
    scrollToContent: true
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0">
        <Excalidraw
          initialData={initialData}
          onChange={handleChange}
          excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
          viewModeEnabled={readOnly}
          zenModeEnabled={false}
          gridModeEnabled={false}
          theme="light"
          name={canvas.name || canvas.title || 'Untitled Canvas'}
          UIOptions={{
            canvasActions: {
              export: true,
              loadScene: !readOnly,
              saveToActiveFile: false,
              toggleTheme: true,
              changeViewBackgroundColor: true
            }
          }}
        />
      </div>
      
      {/* Render collaborative cursors */}
      {collaborationEnabled && (
        <SimplifiedCollaborativeCursors 
          users={collaborators}
        />
      )}
    </div>
  );
}