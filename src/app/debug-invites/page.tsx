'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugInvitesPage() {
  const [allInvites, setAllInvites] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        // Get ALL invites
        const allInvitesSnap = await getDocs(collection(db, 'canvas_invites'));
        const allList = allInvitesSnap.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        setAllInvites(allList);

        // Get only PENDING invites
        const pendingQuery = query(
          collection(db, 'canvas_invites'),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        const pendingList = pendingSnap.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        setPendingInvites(pendingList);
        
      } catch (err) {
        console.error('Error fetching invites:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch invites');
      } finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, []);

  if (loading) return <div className="p-4">Loading invites...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug: Canvas Invites Collection</h1>
      
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <p><strong>Current User:</strong> {user?.email || user?.uid || 'Not signed in'}</p>
        <p><strong>Total Invites:</strong> {allInvites.length}</p>
        <p><strong>Pending Invites:</strong> {pendingInvites.length}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Invites ({pendingInvites.length})</h2>
        {pendingInvites.length === 0 ? (
          <p className="text-gray-500">No pending invites found</p>
        ) : (
          <div className="space-y-4">
            {pendingInvites.map((invite) => (
              <div key={invite.docId} className="border p-4 rounded bg-green-50 dark:bg-green-900/20">
                <p className="font-bold text-green-700 dark:text-green-300">PENDING - Can be accepted</p>
                <p><strong>Document ID:</strong> {invite.docId}</p>
                <p><strong>Token:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{invite.inviteToken}</code></p>
                <p><strong>Canvas ID:</strong> {invite.canvasId}</p>
                <p><strong>Email:</strong> {invite.invitedEmail}</p>
                <p><strong>Role:</strong> {invite.role}</p>
                <p><strong>Status:</strong> {invite.status}</p>
                <p><strong>Expires:</strong> {invite.expiresAt?.toDate?.()?.toString() || invite.expiresAt}</p>
                
                <div className="mt-2 space-y-1">
                  <a 
                    href={`/canvas/invite/${invite.inviteToken}`}
                    className="block text-blue-500 hover:underline"
                  >
                    → Test with invite page
                  </a>
                  <a 
                    href={`/test-accept`}
                    className="block text-purple-500 hover:underline"
                  >
                    → Test with test-accept page (copy token)
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">All Invites ({allInvites.length})</h2>
        {allInvites.length === 0 ? (
          <p className="text-gray-500">No invites found in the database</p>
        ) : (
          <div className="space-y-4">
            {allInvites.map((invite) => (
              <div 
                key={invite.docId} 
                className={`border p-4 rounded ${
                  invite.status === 'pending' 
                    ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <p><strong>Document ID:</strong> {invite.docId}</p>
                <p><strong>Token:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs break-all">{invite.inviteToken}</code></p>
                <p><strong>Canvas ID:</strong> {invite.canvasId}</p>
                <p><strong>Email:</strong> {invite.invitedEmail}</p>
                <p><strong>Role:</strong> {invite.role || 'undefined'}</p>
                <p><strong>Status:</strong> <span className={invite.status === 'pending' ? 'text-green-600' : 'text-gray-600'}>{invite.status}</span></p>
                <p><strong>Created:</strong> {invite.createdAt?.toDate?.()?.toString() || invite.createdAt}</p>
                <p><strong>Expires:</strong> {invite.expiresAt?.toDate?.()?.toString() || invite.expiresAt}</p>
                
                {invite.status === 'accepted' && (
                  <p className="text-sm text-gray-500 mt-2">
                    This invite was already accepted
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded">
        <h3 className="font-bold mb-2">Troubleshooting:</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>If no pending invites: All invites may have been accepted already</li>
          <li>If token not found: The token might be wrong or the invite expired</li>
          <li>Check the status field - only "pending" invites can be accepted</li>
          <li>Check if the token matches exactly (no extra spaces)</li>
        </ul>
      </div>
    </div>
  );
}