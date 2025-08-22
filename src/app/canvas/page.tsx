'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Canvas } from '@/types';
import { Plus, Users, Clock, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CanvasListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all');

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    // Subscribe to canvases where user is owner or collaborator
    const canvasesRef = collection(db, 'canvases');
    
    let q;
    if (filter === 'owned') {
      q = query(
        canvasesRef,
        where('userId', '==', user.uid),
        orderBy('lastModified', 'desc')
      );
    } else if (filter === 'shared') {
      q = query(
        canvasesRef,
        where(`collaborators.${user.uid}`, '!=', null),
        orderBy('lastModified', 'desc')
      );
    } else {
      // For 'all', we need to fetch both owned and shared
      // Firebase doesn't support OR queries well, so we'll handle this differently
      q = query(canvasesRef, orderBy('lastModified', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const canvasData: Canvas[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filter client-side for 'all' filter
        if (filter === 'all') {
          if (data.userId === user.uid || data.collaborators?.[user.uid]) {
            canvasData.push({ id: doc.id, ...data } as Canvas);
          }
        } else {
          canvasData.push({ id: doc.id, ...data } as Canvas);
        }
      });
      setCanvases(canvasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filter, router]);

  const createNewCanvas = async () => {
    if (!user) return;

    try {
      const newCanvas = {
        name: `Canvas ${new Date().toLocaleDateString()}`,
        userId: user.uid,
        content: null,
        collaborators: {},
        activeUsers: {},
        chatMessages: [],
        version: 1,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'canvases'), newCanvas);
      toast.success('Canvas created!');
      router.push(`/canvas/${docRef.id}`);
    } catch (error) {
      console.error('Error creating canvas:', error);
      toast.error('Failed to create canvas');
    }
  };

  const filteredCanvases = canvases.filter(canvas =>
    canvas.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCollaboratorCount = (canvas: Canvas) => {
    if (!canvas.collaborators) return 0;
    return Object.keys(canvas.collaborators).length;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading canvases...</p>
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
                My Canvases
              </h1>
            </div>
            <button
              onClick={createNewCanvas}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Canvas
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search canvases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('owned')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'owned'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Owned by me
            </button>
            <button
              onClick={() => setFilter('shared')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'shared'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Shared with me
            </button>
          </div>
        </div>

        {/* Canvas Grid */}
        {filteredCanvases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm ? 'No canvases found matching your search.' : 'No canvases yet.'}
            </p>
            {!searchTerm && (
              <button
                onClick={createNewCanvas}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first canvas →
              </button>
            )}
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
                    {canvas.name}
                  </h3>
                  {canvas.userId !== user?.uid && (
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      Shared
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Modified: {formatDate(canvas.lastModified)}</span>
                  </div>
                  
                  {getCollaboratorCount(canvas) > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{getCollaboratorCount(canvas)} collaborator{getCollaboratorCount(canvas) !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Canvas preview placeholder */}
                <div className="mt-4 h-32 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-gray-400 dark:text-gray-500 text-sm">
                    Canvas Preview
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}