'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function CheckCollaborationPage() {
  const [canvases, setCanvases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const fetchCanvases = async () => {
      try {
        // Get all canvases the user has access to
        const q1 = query(collection(db, 'canvases'), where('userId', '==', user.uid));
        const q2 = query(collection(db, 'canvases'), where('sharedWith', 'array-contains', user.uid));
        
        const [ownedSnap, sharedSnap] = await Promise.all([
          getDocs(q1),
          getDocs(q2)
        ]);
        
        const allCanvases: any[] = [];
        
        ownedSnap.forEach(doc => {
          allCanvases.push({ id: doc.id, ...doc.data(), ownership: 'owned' });
        });
        
        sharedSnap.forEach(doc => {
          allCanvases.push({ id: doc.id, ...doc.data(), ownership: 'shared' });
        });
        
        setCanvases(allCanvases);
      } catch (error) {
        console.error('Error fetching canvases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCanvases();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Canvas Collaboration Status</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Canvas ID</th>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Ownership</th>
                <th className="text-left p-2">Collaboration Enabled</th>
                <th className="text-left p-2">Shared With</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {canvases.map(canvas => (
                <tr key={canvas.id} className="border-b">
                  <td className="p-2 font-mono text-xs">{canvas.id.slice(0, 8)}...</td>
                  <td className="p-2">{canvas.title || canvas.name || 'Untitled'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      canvas.ownership === 'owned' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {canvas.ownership}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      canvas.collaborationEnabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {canvas.collaborationEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    {canvas.sharedWith?.length || 0} users
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => router.push(`/canvas/${canvas.id}`)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {canvases.length === 0 && (
            <p className="text-center py-8 text-gray-500">No canvases found</p>
          )}
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">Debugging Info:</p>
          <ul className="text-sm space-y-1">
            <li>• Canvases with "Collaboration Enabled: Yes" should sync in real-time</li>
            <li>• Check if the canvas you're testing shows "Yes" for collaboration</li>
            <li>• If it shows "No", the canvas needs to be re-shared to enable collaboration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}