'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { shareCanvas, acceptInvite } from '@/services/collaboration';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PermissionLevel } from '@/types';

export default function TestFlowPage() {
  const { user } = useAuth();
  const [canvasId, setCanvasId] = useState('');
  const [email, setEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testShareCanvas = async () => {
    if (!canvasId || !email) {
      addResult('❌ Please enter canvas ID and email');
      return;
    }

    setLoading(true);
    try {
      addResult('📤 Starting share process...');
      
      // Check if canvas exists
      const canvasDoc = await getDoc(doc(db, 'canvases', canvasId));
      if (!canvasDoc.exists()) {
        addResult('❌ Canvas not found');
        setLoading(false);
        return;
      }
      
      addResult('✅ Canvas found');
      const canvasData = canvasDoc.data();
      addResult(`Canvas title/name: ${canvasData.title || canvasData.name || 'undefined'}`);
      
      // Try to share
      const invite = await shareCanvas(canvasId, email, PermissionLevel.EDITOR);
      addResult('✅ Invite created successfully');
      addResult(`Invite token: ${invite.inviteToken}`);
      setInviteToken(invite.inviteToken);
      
    } catch (error) {
      addResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testAcceptInvite = async () => {
    if (!inviteToken) {
      addResult('❌ Please enter or generate an invite token');
      return;
    }

    setLoading(true);
    try {
      addResult('📥 Starting accept process...');
      
      const canvas = await acceptInvite(inviteToken);
      addResult('✅ Invite accepted successfully');
      addResult(`Canvas ID: ${canvas.id}`);
      addResult(`Canvas title: ${canvas.title || canvas.name || 'undefined'}`);
      
    } catch (error) {
      addResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Collaboration Flow</h1>
        <p className="text-red-500">Please sign in to test the collaboration features.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Collaboration Flow</h1>
      
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <p><strong>Current User:</strong> {user.email || user.uid}</p>
      </div>

      <div className="space-y-6">
        {/* Share Canvas Test */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-3">1. Test Share Canvas</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Canvas ID:</label>
              <input
                type="text"
                value={canvasId}
                onChange={(e) => setCanvasId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter canvas ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email to invite:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="user@example.com"
              />
            </div>
            
            <button
              onClick={testShareCanvas}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Share Canvas'}
            </button>
          </div>
        </div>

        {/* Accept Invite Test */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-3">2. Test Accept Invite</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Invite Token:</label>
              <input
                type="text"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter or use generated token"
              />
            </div>
            
            <button
              onClick={testAcceptInvite}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Accept Invite'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-3">Results</h2>
          
          {results.length === 0 ? (
            <p className="text-gray-500">No actions performed yet.</p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {results.map((result, index) => (
                <div key={index} className={
                  result.includes('❌') ? 'text-red-600' :
                  result.includes('✅') ? 'text-green-600' :
                  'text-gray-700 dark:text-gray-300'
                }>
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="border p-4 rounded bg-gray-50 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-3">Quick Links</h2>
          <div className="space-x-4">
            <a href="/test-invite" className="text-blue-500 hover:underline">
              View All Invites
            </a>
            <a href="/debug-canvas" className="text-blue-500 hover:underline">
              Debug Canvases
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}