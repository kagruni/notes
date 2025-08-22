'use client';

import { useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function EnableCollaborationPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const enableCollaboration = async () => {
    if (!user) {
      setResult('You must be signed in to run this operation');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Find all canvases that have sharedWith array
      const canvasesRef = collection(db, 'canvases');
      const canvasesSnap = await getDocs(canvasesRef);
      
      let updatedCount = 0;
      let alreadyEnabledCount = 0;
      const updates: Promise<void>[] = [];
      
      canvasesSnap.forEach((canvasDoc) => {
        const data = canvasDoc.data();
        
        // If canvas has sharedWith users but collaborationEnabled is not true, update it
        if (data.sharedWith && data.sharedWith.length > 0) {
          if (!data.collaborationEnabled) {
            const canvasRef = doc(db, 'canvases', canvasDoc.id);
            updates.push(
              updateDoc(canvasRef, {
                collaborationEnabled: true
              })
            );
            updatedCount++;
          } else {
            alreadyEnabledCount++;
          }
        }
      });
      
      // Wait for all updates to complete
      await Promise.all(updates);
      
      setResult(`✅ Successfully updated ${updatedCount} canvases. ${alreadyEnabledCount} already had collaboration enabled.`);
    } catch (error) {
      console.error('Error enabling collaboration:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Enable Collaboration on Shared Canvases</h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This utility will enable the collaboration flag on all canvases that have been shared with other users.
            This is necessary for real-time collaboration features to work properly.
          </p>

          {!user ? (
            <div className="text-red-500 mb-4">
              You must be signed in to run this operation.
            </div>
          ) : (
            <button
              onClick={enableCollaboration}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium"
            >
              {loading ? 'Processing...' : 'Enable Collaboration'}
            </button>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.startsWith('✅') 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {result}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}