'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Users, Clock, Search, Palette } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SharedWithMePage() {
  const [sharedCanvases, setSharedCanvases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchSharedCanvases = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }
      
      if (!user) {
        router.push('/');
        return;
      }

      try {
        // Query canvases where current user is in sharedWith array
        const q = query(
          collection(db, 'canvases'),
          where('sharedWith', 'array-contains', user.uid)
        );
        
        const canvasesSnap = await getDocs(q);
        const canvasesList = canvasesSnap.docs.map(doc => {
          const data = doc.data();
          // Get user's permission level
          const userPermission = data.permissions?.[user.uid];
          const role = userPermission 
            ? (typeof userPermission === 'string' ? userPermission : userPermission.role)
            : 'viewer';
          
          return {
            id: doc.id,
            ...data,
            userRole: role
          };
        });
        
        // Sort by last modified
        canvasesList.sort((a, b) => {
          const aTime = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });
        
        setSharedCanvases(canvasesList);
      } catch (err) {
        console.error('Error fetching shared canvases:', err);
        toast.error('Failed to load shared canvases');
        setError(err instanceof Error ? err.message : 'Failed to fetch shared canvases');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedCanvases();
  }, [user, authLoading, router]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCollaboratorCount = (canvas: any) => {
    if (!canvas.sharedWith) return 0;
    return canvas.sharedWith.length;
  };

  // Filter canvases based on search term
  const filteredCanvases = sharedCanvases.filter(canvas => {
    const name = canvas.title || canvas.name || 'Untitled Canvas';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading shared canvases...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Shared With Me
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search shared canvases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Canvas Grid */}
        {filteredCanvases.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm 
                ? 'No shared canvases found matching your search.' 
                : 'No canvases have been shared with you yet.'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              When someone shares a canvas with you, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCanvases.map((canvas) => (
              <div
                key={canvas.id}
                onClick={() => router.push(`/canvas/${canvas.id}`)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
                    {canvas.title || canvas.name || 'Untitled Canvas'}
                  </h3>
                  <span className={`ml-2 px-2 py-1 text-xs rounded ${
                    canvas.userRole === 'admin' 
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : canvas.userRole === 'editor'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {canvas.userRole}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Modified: {formatDate(canvas.updatedAt || canvas.createdAt)}</span>
                  </div>
                  
                  {getCollaboratorCount(canvas) > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{getCollaboratorCount(canvas)} collaborator{getCollaboratorCount(canvas) !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Canvas preview or thumbnail */}
                <div className="mt-4 h-32 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  {canvas.thumbnail ? (
                    <img 
                      src={canvas.thumbnail} 
                      alt={canvas.title || canvas.name || 'Canvas thumbnail'}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      <Palette className="w-8 h-8 mb-2" />
                      <span className="text-sm">Canvas Preview</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}