'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TestInvitePage() {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const invitesSnap = await getDocs(collection(db, 'canvas_invites'));
        const invitesList = invitesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInvites(invitesList);
      } catch (err) {
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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Canvas Invites in Firestore</h1>
      
      {invites.length === 0 ? (
        <p className="text-gray-500">No invites found in the database.</p>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => (
            <div key={invite.id} className="border p-4 rounded bg-gray-50 dark:bg-gray-800">
              <p><strong>ID:</strong> {invite.id}</p>
              <p><strong>Canvas ID:</strong> {invite.canvasId}</p>
              <p><strong>Token:</strong> {invite.inviteToken}</p>
              <p><strong>Email:</strong> {invite.invitedEmail}</p>
              <p><strong>Status:</strong> {invite.status}</p>
              <p><strong>Role:</strong> {invite.role}</p>
              <p><strong>Expires:</strong> {invite.expiresAt?.toDate?.()?.toString() || invite.expiresAt}</p>
              
              <div className="mt-2 space-y-2">
                <p className="font-semibold">Test this invite:</p>
                <a 
                  href={`/canvas/invite/${invite.inviteToken}`}
                  className="text-blue-500 hover:underline block"
                >
                  Accept Invite (Same Tab)
                </a>
                <a 
                  href={`/canvas/invite/${invite.inviteToken}`}
                  className="text-purple-500 hover:underline block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Accept Invite (New Tab)
                </a>
                <p className="text-xs text-gray-500">
                  Direct link: http://localhost:3000/canvas/invite/{invite.inviteToken}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded">
        <h2 className="font-bold mb-2">How to Create an Invite:</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to a canvas</li>
          <li>Click the Share button</li>
          <li>Enter an email address</li>
          <li>Select permission level</li>
          <li>Click "Send Invite"</li>
        </ol>
      </div>
    </div>
  );
}