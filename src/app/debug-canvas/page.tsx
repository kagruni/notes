'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugCanvasPage() {
  const [canvases, setCanvases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCanvases = async () => {
      try {
        // Don't require user for debugging - we just want to see the data
        console.log('Current user:', user?.uid, user?.email);
        const canvasesSnap = await getDocs(collection(db, 'canvases'));
        const canvasesList = canvasesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCanvases(canvasesList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch canvases');
      } finally {
        setLoading(false);
      }
    };

    fetchCanvases();
  }, []);

  if (loading) return <div className="p-4">Loading canvases...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug: Canvas Structure</h1>
      
      <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded">
        <p><strong>Current User:</strong> {user ? `${user.email || user.uid}` : 'Not signed in'}</p>
      </div>
      
      {canvases.length === 0 ? (
        <p className="text-gray-500">No canvases found.</p>
      ) : (
        <div className="space-y-4">
          {canvases.map((canvas) => (
            <div key={canvas.id} className="border p-4 rounded bg-gray-50 dark:bg-gray-800">
              <h2 className="font-bold text-lg mb-2">Canvas: {canvas.id}</h2>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Title:</strong> {canvas.title || 'undefined'}</div>
                <div><strong>Name:</strong> {canvas.name || 'undefined'}</div>
                <div><strong>Owner (userId):</strong> {canvas.userId}</div>
                <div><strong>Created:</strong> {canvas.createdAt?.toDate?.()?.toString() || canvas.createdAt}</div>
              </div>

              <div className="mt-2">
                <strong>SharedWith:</strong>
                {canvas.sharedWith ? (
                  <ul className="list-disc list-inside">
                    {canvas.sharedWith.map((userId: string) => (
                      <li key={userId}>{userId}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-500"> None</span>
                )}
              </div>

              <div className="mt-2">
                <strong>Permissions:</strong>
                {canvas.permissions ? (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(canvas.permissions, null, 2)}
                  </pre>
                ) : (
                  <span className="text-gray-500"> None</span>
                )}
              </div>

              <div className="mt-2">
                <strong>Is Owner:</strong> {canvas.userId === user?.uid ? '✅ Yes' : '❌ No'}
              </div>

              <div className="mt-2">
                <strong>Can Access:</strong> {
                  canvas.userId === user?.uid || canvas.sharedWith?.includes(user?.uid) 
                    ? '✅ Yes' 
                    : '❌ No'
                }
              </div>

              <div className="mt-2 space-x-2">
                <a 
                  href={`/canvas/${canvas.id}`}
                  className="text-blue-500 hover:underline"
                >
                  Open Canvas
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}