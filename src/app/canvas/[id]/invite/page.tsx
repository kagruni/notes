'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { acceptInvite } from '@/services/collaboration';
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  LogIn
} from 'lucide-react';
import Link from 'next/link';

export default function CanvasInvitePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needs-auth'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState<string>('');

  useEffect(() => {
    const acceptInviteToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setError('Invalid invite link - missing token');
        return;
      }

      if (authLoading) {
        return; // Wait for auth to load
      }

      if (!user) {
        setStatus('needs-auth');
        return;
      }

      try {
        setStatus('loading');
        const canvas = await acceptInvite(token);
        setCanvasTitle(canvas.title);
        setStatus('success');
        
        // Redirect to canvas after 2 seconds
        setTimeout(() => {
          router.push(`/canvas/${params.id}`);
        }, 2000);
      } catch (err) {
        console.error('Failed to accept invite:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to accept invite');
      }
    };

    acceptInviteToken();
  }, [searchParams, params.id, router, user, authLoading]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Accepting Invite...
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we process your invitation
          </p>
        </div>
      </div>
    );
  }

  if (status === 'needs-auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <LogIn className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Sign In Required
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need to sign in to accept this canvas invitation
            </p>
            <Link
              href={`/auth?redirect=/canvas/${params.id}/invite?token=${searchParams.get('token')}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Invitation Accepted!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              You now have access to
            </p>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              &quot;{canvasTitle}&quot;
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Redirecting to canvas...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Invalid or Expired Invite
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error || 'This invitation link is no longer valid'}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Possible reasons:
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 text-left">
                <li>• The invitation has expired</li>
                <li>• The invitation has already been used</li>
                <li>• The canvas no longer exists</li>
                <li>• The invitation was revoked</li>
              </ul>
            </div>
            <Link
              href="/"
              className="inline-block mt-6 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}