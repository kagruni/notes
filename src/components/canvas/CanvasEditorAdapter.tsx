'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Canvas } from '@/types';
import CanvasEditor from './CanvasEditor';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface CanvasEditorAdapterProps {
  canvasId: string;
  readOnly?: boolean;
  collaborationEnabled?: boolean;
}

export default function CanvasEditorAdapter({ 
  canvasId, 
  readOnly = false,
  collaborationEnabled = false 
}: CanvasEditorAdapterProps) {
  const { user } = useAuth();
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  // Load canvas data - only once for initial load when collaboration is enabled
  useEffect(() => {
    if (!canvasId) return;

    const canvasRef = doc(db, 'canvases', canvasId);
    
    // For collaborative canvases, we only need the initial load
    // Real-time sync happens through RTDB operations
    if (collaborationEnabled) {
      // Just get the canvas once
      const loadCanvas = async () => {
        try {
          const snapshot = await getDoc(canvasRef);
          if (snapshot.exists()) {
            const data = { id: snapshot.id, ...snapshot.data() } as Canvas;
            setCanvas(data);
          } else {
            toast.error('Canvas not found');
          }
        } catch (error) {
          console.error('Error loading canvas:', error);
          toast.error('Failed to load canvas');
        } finally {
          setLoading(false);
        }
      };
      loadCanvas();
    } else {
      // For non-collaborative canvases, listen for updates
      const unsubscribe = onSnapshot(canvasRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() } as Canvas;
          setCanvas(data);
          setLoading(false);
        } else {
          toast.error('Canvas not found');
          setLoading(false);
        }
      }, (error) => {
        console.error('Error loading canvas:', error);
        toast.error('Failed to load canvas');
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [canvasId, collaborationEnabled]);

  const handleSave = async (id: string, updates: Partial<Canvas>) => {
    if (readOnly || !user) return;

    try {
      const canvasRef = doc(db, 'canvases', id);
      await updateDoc(canvasRef, {
        ...updates,
        lastModified: new Date(),
        lastModifiedBy: user.uid
      });
    } catch (error) {
      console.error('Error saving canvas:', error);
      toast.error('Failed to save canvas');
    }
  };

  const handleClose = () => {
    // Since we're embedded in a page, we don't actually close
    // This is just to satisfy the CanvasEditor interface
    setIsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500">Canvas not found</div>
      </div>
    );
  }

  // Pass collaboration flag through canvas object
  const canvasWithCollaboration = {
    ...canvas,
    collaborationEnabled: collaborationEnabled
  };
  
  console.log('[CanvasEditorAdapter] Canvas collaboration status:', {
    canvasId: canvas.id,
    collaborationEnabled: collaborationEnabled,
    canvasHasCollab: canvas.collaborationEnabled,
    passedCollab: canvasWithCollaboration.collaborationEnabled
  });

  // CanvasEditor expects isOpen to be true to render
  return (
    <div className="w-full h-full">
      <CanvasErrorBoundary>
        <CanvasEditor
          canvas={canvasWithCollaboration}
          isOpen={isOpen}
          onSave={handleSave}
          onClose={handleClose}
        />
      </CanvasErrorBoundary>
    </div>
  );
}