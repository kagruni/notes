'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AuthStatusPage() {
  const { user, loading, error } = useAuth();
  const [directAuthUser, setDirectAuthUser] = useState<any>(null);
  const [directAuthLoading, setDirectAuthLoading] = useState(true);

  useEffect(() => {
    // Check auth directly without context
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDirectAuthUser(user);
      setDirectAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Status</h1>
      
      {/* Context Auth Status */}
      <div className="mb-6 p-4 border rounded bg-blue-50 dark:bg-blue-900/20">
        <h2 className="text-xl font-semibold mb-3">Auth Context Status:</h2>
        <div className="space-y-2">
          <p><strong>Loading:</strong> {loading ? '⏳ Yes' : '✅ No'}</p>
          <p><strong>Error:</strong> {error ? `❌ ${error.message}` : '✅ None'}</p>
          <p><strong>User:</strong> {user ? '✅ Signed In' : '❌ Not Signed In'}</p>
          {user && (
            <>
              <p><strong>User ID:</strong> {user.uid}</p>
              <p><strong>Email:</strong> {user.email || 'No email'}</p>
              <p><strong>Display Name:</strong> {user.displayName || 'No display name'}</p>
            </>
          )}
        </div>
      </div>

      {/* Direct Firebase Auth Status */}
      <div className="mb-6 p-4 border rounded bg-green-50 dark:bg-green-900/20">
        <h2 className="text-xl font-semibold mb-3">Direct Firebase Auth Status:</h2>
        <div className="space-y-2">
          <p><strong>Loading:</strong> {directAuthLoading ? '⏳ Yes' : '✅ No'}</p>
          <p><strong>User:</strong> {directAuthUser ? '✅ Signed In' : '❌ Not Signed In'}</p>
          {directAuthUser && (
            <>
              <p><strong>User ID:</strong> {directAuthUser.uid}</p>
              <p><strong>Email:</strong> {directAuthUser.email || 'No email'}</p>
              <p><strong>Display Name:</strong> {directAuthUser.displayName || 'No display name'}</p>
              <p><strong>Provider:</strong> {directAuthUser.providerData?.[0]?.providerId || 'Unknown'}</p>
            </>
          )}
        </div>
      </div>

      {/* Firebase Config Check */}
      <div className="mb-6 p-4 border rounded bg-yellow-50 dark:bg-yellow-900/20">
        <h2 className="text-xl font-semibold mb-3">Firebase Configuration:</h2>
        <div className="space-y-2">
          <p><strong>Project ID:</strong> {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ Not Set'}</p>
          <p><strong>Auth Domain:</strong> {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '❌ Not Set'}</p>
          <p><strong>API Key Set:</strong> {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Yes' : '❌ No'}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border rounded bg-gray-50 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3">Actions:</h2>
        <div className="space-y-2">
          {!user && !directAuthUser && (
            <div>
              <p className="mb-2">You need to sign in first:</p>
              <a href="/" className="text-blue-500 hover:underline">
                Go to Home Page to Sign In
              </a>
            </div>
          )}
          {(user || directAuthUser) && (
            <div className="space-x-4">
              <a href="/my-canvases" className="text-blue-500 hover:underline">
                View My Canvases
              </a>
              <a href="/test-flow" className="text-blue-500 hover:underline">
                Test Collaboration Flow
              </a>
              <button
                onClick={() => {
                  auth.signOut();
                  window.location.reload();
                }}
                className="text-red-500 hover:underline"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div className="mt-6 p-4 border rounded bg-gray-100 dark:bg-gray-900">
        <h2 className="text-xl font-semibold mb-3">Debug Info:</h2>
        <pre className="text-xs overflow-x-auto">
          {JSON.stringify({
            contextUser: user ? { uid: user.uid, email: user.email } : null,
            directUser: directAuthUser ? { uid: directAuthUser.uid, email: directAuthUser.email } : null,
            timestamp: new Date().toISOString()
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}