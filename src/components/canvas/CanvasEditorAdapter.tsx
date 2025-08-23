'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Canvas } from '@/types';
import CanvasEditor from './CanvasEditor';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { cleanCanvasUpdates } from '@/utils/firestore-clean';

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

  // Load canvas data and listen for metadata updates
  useEffect(() => {
    if (!canvasId) return;

    const canvasRef = doc(db, 'canvases', canvasId);
    
    // Always listen for canvas metadata updates (like collaboration being toggled)
    // Even in collaborative mode, we need to know when collaboration settings change
    const unsubscribe = onSnapshot(canvasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Canvas;
        console.log('[CanvasEditorAdapter] Canvas data updated:', {
          id: data.id,
          collaborationEnabled: data.collaborationEnabled,
          propCollabEnabled: collaborationEnabled
        });
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
  }, [canvasId]); // Remove collaborationEnabled from deps to avoid re-subscribing

  const handleSave = async (id: string, updates: Partial<Canvas>) => {
    if (readOnly || !user) return;

    try {
      const canvasRef = doc(db, 'canvases', id);
      
      // Clean the updates to remove undefined values
      const cleanedUpdates = cleanCanvasUpdates({
        ...updates,
        lastModified: new Date(),
        lastModifiedBy: user.uid
      });
      
      console.log('[CanvasEditorAdapter] Saving to Firestore:', {
        hasElements: !!cleanedUpdates.elements,
        elementCount: cleanedUpdates.elements?.length,
        hasAppState: !!cleanedUpdates.appState,
        keys: Object.keys(cleanedUpdates)
      });
      
      await updateDoc(canvasRef, cleanedUpdates);
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

  // Use the collaboration flag from the prop (which comes from the parent's canvas state)
  // This ensures we're using the most up-to-date collaboration status
  const canvasWithCollaboration = {
    ...canvas,
    collaborationEnabled: collaborationEnabled || canvas.collaborationEnabled || false
  };
  
  console.log('[CanvasEditorAdapter] 🔄 Canvas collaboration status:', {
    canvasId: canvas.id,
    propCollabEnabled: collaborationEnabled,
    canvasCollabEnabled: canvas.collaborationEnabled,
    finalCollabEnabled: canvasWithCollaboration.collaborationEnabled
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