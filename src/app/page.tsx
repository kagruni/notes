'use client';

import { useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/components/auth/AuthPage';
import Dashboard from '@/components/Dashboard';
import Header from '@/components/layout/Header';

export default function Home() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Firebase Configuration Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            To use this notes app, you need to configure Firebase. Please:
          </p>
          <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>Create a Firebase project at <a href="https://console.firebase.google.com" className="text-blue-500 hover:underline" target="_blank">Firebase Console</a></li>
            <li>Enable Authentication and Firestore in your project</li>
            <li>Copy the configuration from Project Settings</li>
            <li>Create a <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.local</code> file in the project root</li>
            <li>Add your Firebase configuration (see <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.example</code>)</li>
          </ol>
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            Error: {error.message}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <Dashboard />
    </div>
  );
}
