'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { shareCanvas } from '@/services/collaboration';

export default function MyCanvasesPage() {
  const [canvases, setCanvases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchMyCanvases = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }
      
      if (!user) {
        setError('Please sign in to view your canvases');
        setLoading(false);
        return;
      }

      try {
        // Query only canvases owned by the current user
        const q = query(
          collection(db, 'canvases'),
          where('userId', '==', user.uid)
        );
        
        const canvasesSnap = await getDocs(q);
        const canvasesList = canvasesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setCanvases(canvasesList);
      } catch (err) {
        console.error('Error fetching canvases:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch canvases');
      } finally {
        setLoading(false);
      }
    };

    fetchMyCanvases();
  }, [user, authLoading]);

  const handleShare = async (canvasId: string) => {
    const email = prompt('Enter email address to share with:');
    if (!email) return;

    setSharing(canvasId);
    try {
      const invite = await shareCanvas(canvasId, email, 'editor');
      alert(`Invite sent! Token: ${invite.inviteToken}\n\nShare this link:\nhttp://localhost:3000/canvas/invite/${invite.inviteToken}`);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to share'}`);
    } finally {
      setSharing(null);
    }
  };

  if (authLoading || loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Canvases</h1>
      
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <p><strong>Signed in as:</strong> {user?.email || user?.uid}</p>
      </div>
      
      {canvases.length === 0 ? (
        <div className="text-gray-500">
          <p>No canvases found.</p>
          <p className="mt-2">Create a canvas first, then come back here to share it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {canvases.map((canvas) => (
            <div key={canvas.id} className="border p-4 rounded bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="font-bold text-lg">
                    {canvas.title || canvas.name || 'Untitled Canvas'}
                  </h2>
                  <p className="text-sm text-gray-500">ID: {canvas.id}</p>
                </div>
                <div className="space-x-2">
                  <a 
                    href={`/canvas/${canvas.id}`}
                    className="text-blue-500 hover:underline"
                  >
                    Open
                  </a>
                  <button
                    onClick={() => handleShare(canvas.id)}
                    disabled={sharing === canvas.id}
                    className="text-green-500 hover:underline disabled:opacity-50"
                  >
                    {sharing === canvas.id ? 'Sharing...' : 'Share'}
                  </button>
                </div>
              </div>
              
              <div className="text-sm space-y-1">
                <p><strong>Created:</strong> {canvas.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</p>
                <p><strong>Has title field:</strong> {canvas.title ? '✅' : '❌'}</p>
                <p><strong>Has name field:</strong> {canvas.name ? '✅' : '❌'}</p>
              </div>

              {canvas.sharedWith && canvas.sharedWith.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-sm">Shared with {canvas.sharedWith.length} user(s):</p>
                  <ul className="text-xs list-disc list-inside">
                    {canvas.sharedWith.map((userId: string) => {
                      const permission = canvas.permissions?.[userId];
                      const role = permission ? (typeof permission === 'string' ? permission : permission.role) : 'viewer';
                      return (
                        <li key={userId}>
                          {userId} - {role}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded">
        <h2 className="font-bold mb-2">Quick Links:</h2>
        <div className="space-x-4">
          <a href="/test-invite" className="text-blue-500 hover:underline">
            View All Invites
          </a>
          <a href="/test-flow" className="text-blue-500 hover:underline">
            Test Complete Flow
          </a>
        </div>
      </div>
    </div>
  );
}