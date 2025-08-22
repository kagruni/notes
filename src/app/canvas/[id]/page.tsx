'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CanvasEditorAdapter from '@/components/canvas/CanvasEditorAdapter';
import CollaborationIndicator from '@/components/canvas/CollaborationIndicator';
import ShareButton from '@/components/canvas/ShareButton';
import { collaborationService } from '@/services/collaborationService';
import { Canvas, CollaborationState } from '@/types';
import { validatePermissions } from '@/utils/security';
import toast from 'react-hot-toast';

export default function CanvasPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const canvasId = params.id as string;

  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationState>({
    isConnected: false,
    activeUsers: [],
    version: 0
  });
  const [permissions, setPermissions] = useState({
    canView: false,
    canEdit: false,
    canShare: false,
    canDelete: false
  });

  useEffect(() => {
    if (!user || !canvasId) return;

    let unsubscribe: (() => void) | null = null;

    const loadCanvas = async () => {
      try {
        // Get canvas document
        const canvasRef = doc(db, 'canvases', canvasId);
        const canvasDoc = await getDoc(canvasRef);

        if (!canvasDoc.exists()) {
          setError('Canvas not found');
          setLoading(false);
          return;
        }

        const canvasData = { id: canvasDoc.id, ...canvasDoc.data() } as Canvas;
        
        // Check permissions
        const userPermissions = validatePermissions(user.uid, canvasData);
        setPermissions(userPermissions);

        if (!userPermissions.canView) {
          setError('You do not have permission to view this canvas');
          setLoading(false);
          return;
        }

        setCanvas(canvasData);

        // Start collaboration session
        await collaborationService.startSession(
          canvasId,
          user.uid,
          {
            name: user.displayName || 'Anonymous',
            email: user.email || ''
          }
        );

        // Subscribe to real-time updates
        unsubscribe = onSnapshot(canvasRef, (snapshot) => {
          if (snapshot.exists()) {
            const updatedCanvas = { id: snapshot.id, ...snapshot.data() } as Canvas;
            setCanvas(updatedCanvas);
            
            // Update permissions in case they changed
            const updatedPermissions = validatePermissions(user.uid, updatedCanvas);
            setPermissions(updatedPermissions);
          }
        });

        // Subscribe to collaboration updates
        const collaborationUnsub = collaborationService.subscribeToCanvas(
          canvasId,
          {
            onStateChange: (state) => {
              setCollaborationState(state);
            }
          }
        );

        // Store unsubscribe functions
        const cleanup = () => {
          if (unsubscribe) unsubscribe();
          collaborationUnsub();
        };

        // Set up cleanup on unmount
        return cleanup;
      } catch (err) {
        console.error('Error loading canvas:', err);
        setError('Failed to load canvas');
        toast.error('Failed to load canvas');
      } finally {
        setLoading(false);
      }
    };

    loadCanvas();

    // Cleanup on unmount
    return () => {
      if (user && canvasId) {
        collaborationService.endSession(canvasId, user.uid).catch(console.error);
      }
    };
  }, [user, canvasId, router]);

  // Handle visibility change to update presence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!user || !canvasId) return;

      if (document.hidden) {
        // User switched tabs/minimized window
        collaborationService.endSession(canvasId, user.uid).catch(console.error);
      } else {
        // User returned to tab
        collaborationService.startSession(
          canvasId,
          user.uid,
          {
            name: user.displayName || 'Anonymous',
            email: user.email || ''
          }
        ).catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, canvasId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading canvas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!canvas) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {canvas.name}
            </h1>
            <CollaborationIndicator
              isConnected={collaborationState.isConnected}
              activeUsers={collaborationState.activeUsers}
            />
          </div>
          <div className="flex items-center gap-2">
            {permissions.canShare && (
              <ShareButton canvas={canvas} />
            )}
          </div>
        </div>
      </div>

      {/* Canvas editor */}
      <div className="pt-14 h-screen">
        <CanvasEditorAdapter
          canvasId={canvasId}
          readOnly={!permissions.canEdit}
          collaborationEnabled={true}
        />
      </div>
    </div>
  );
}