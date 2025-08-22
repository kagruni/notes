'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { acceptInvite } from '@/services/collaboration';

export default function TestAcceptPage() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!token) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Starting accept process with token:', token);
      const canvas = await acceptInvite(token);
      console.log('Accept successful, canvas:', canvas);
      
      setResult({
        success: true,
        canvasId: canvas.id,
        canvasTitle: canvas.title || canvas.name || 'Untitled',
        message: 'Invite accepted successfully!'
      });
    } catch (err) {
      console.error('Accept failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Accept Invite</h1>
        <p className="text-red-500">Please sign in first</p>
        <a href="/" className="text-blue-500 hover:underline">Go to Home</a>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Accept Invite</h1>
      
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <p><strong>Signed in as:</strong> {user.email || user.uid}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Invite Token:
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Paste invite token here"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get this from the test-invite page or from the invite creator
          </p>
        </div>

        <button
          onClick={handleAccept}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Accepting...' : 'Accept Invite'}
        </button>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded">
            <p className="text-red-600 dark:text-red-400 font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className={`p-4 rounded ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.success && result.canvasId && (
              <div className="mt-4">
                <a 
                  href={`/canvas/${result.canvasId}`}
                  className="text-blue-500 hover:underline"
                >
                  Open Canvas →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
          <h3 className="font-semibold mb-2">Debug Info:</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Check the browser console for detailed logs
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            The error message above should tell you exactly what went wrong
          </p>
        </div>

        <div className="space-x-4">
          <a href="/test-invite" className="text-blue-500 hover:underline">
            View All Invites
          </a>
          <a href="/my-canvases" className="text-blue-500 hover:underline">
            My Canvases
          </a>
        </div>
      </div>
    </div>
  );
}