'use client';

import { useState, useEffect } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, push, onValue, set, serverTimestamp } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';

export default function TestRTDBPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [customRoomId, setCustomRoomId] = useState('');
  const [testCanvasId, setTestCanvasId] = useState<string>('');
  const [status, setStatus] = useState('Initializing...');

  // Use a shared room ID - users can enter the same ID to join the same room
  useEffect(() => {
    // Use URL param if provided, otherwise use default shared room
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || customRoomId || 'shared-test-room';
    setTestCanvasId(roomId);
  }, [customRoomId]);

  useEffect(() => {
    if (!user || !testCanvasId) {
      if (!user) setStatus('Not authenticated');
      return;
    }

    setStatus('Setting up RTDB listener...');
    
    // Create a reference to test location
    const testRef = ref(rtdb, `test-operations/${testCanvasId}`);
    
    // Listen for changes
    console.log('[TestRTDB] Setting up listener for path:', `test-operations/${testCanvasId}`);
    const unsubscribe = onValue(testRef, (snapshot) => {
      const data = snapshot.val();
      console.log('[TestRTDB] Received data from path', `test-operations/${testCanvasId}:`, data);
      
      if (data) {
        const messageList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        setMessages(messageList);
        setStatus(`Connected - ${messageList.length} messages in room "${testCanvasId}"`);
        console.log('[TestRTDB] Updated messages:', messageList.length, 'messages');
      } else {
        setMessages([]);
        setStatus(`Connected - no messages in room "${testCanvasId}"`);
        console.log('[TestRTDB] No messages in room');
      }
    }, (error) => {
      console.error('[TestRTDB] Listener error:', error);
      setStatus(`Error: ${error.message}`);
    });

    setStatus('Connected to RTDB');

    return () => unsubscribe();
  }, [user, testCanvasId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !user || !testCanvasId) {
      console.log('[TestRTDB] Cannot send - missing:', {
        hasInput: !!inputValue.trim(),
        hasUser: !!user,
        hasRoomId: !!testCanvasId
      });
      return;
    }

    try {
      const path = `test-operations/${testCanvasId}`;
      const testRef = ref(rtdb, path);
      const newMessage = {
        text: inputValue,
        userId: user.uid,
        userEmail: user.email,
        timestamp: Date.now(),
        serverTimestamp: serverTimestamp()
      };
      
      console.log('[TestRTDB] Pushing message to path:', path);
      console.log('[TestRTDB] Message data:', newMessage);
      await push(testRef, newMessage);
      console.log('[TestRTDB] Message sent successfully to room:', testCanvasId);
      setInputValue('');
    } catch (error) {
      console.error('[TestRTDB] Failed to send:', error);
      setStatus(`Send error: ${error}`);
    }
  };

  const clearMessages = async () => {
    if (!testCanvasId) return;
    
    try {
      const testRef = ref(rtdb, `test-operations/${testCanvasId}`);
      await set(testRef, null);
      console.log('[TestRTDB] Cleared all messages');
    } catch (error) {
      console.error('[TestRTDB] Failed to clear:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Firebase RTDB Test</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: <span className="font-mono">{status}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              User: <span className="font-mono">{user?.email || 'Not authenticated'}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Room ID: <span className="font-mono text-blue-600">{testCanvasId}</span>
            </p>
          </div>

          <div className="mb-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Both users must use the same Room ID to see each other's messages!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current room: <span className="font-mono font-bold">{testCanvasId}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Share this URL with another user: 
                <span className="font-mono text-xs block mt-1 text-blue-600">
                  {typeof window !== 'undefined' ? `${window.location.origin}/test-rtdb?room=${testCanvasId}` : ''}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Change Room (optional):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter room ID..."
                onChange={(e) => setCustomRoomId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
              <button
                onClick={() => window.location.search = `?room=${customRoomId}`}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Join Room
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Send to RTDB
            </button>
            <button
              onClick={clearMessages}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Clear All
            </button>
          </div>

          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[200px]">
            <h3 className="font-semibold mb-2">Messages from RTDB:</h3>
            {messages.length === 0 ? (
              <p className="text-gray-500">No messages yet. Send one above!</p>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="font-mono text-sm">{msg.text}</p>
                    <p className="text-xs text-gray-500">
                      From: {msg.userEmail} at {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm font-semibold">Testing Instructions:</p>
            <ol className="text-sm mt-2 space-y-1">
              <li>1. Open this page in two different browsers or incognito windows</li>
              <li>2. Log in as different users in each window</li>
              <li>3. Send messages from one window</li>
              <li>4. Messages should appear instantly in both windows</li>
              <li>5. Check browser console for detailed logs</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}