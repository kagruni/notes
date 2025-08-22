import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { presenceService, UserPresence, PresenceCallbacks } from '@/services/presence';

interface UsePresenceOptions {
  canvasId: string;
  enabled?: boolean;
  callbacks?: PresenceCallbacks;
}

export function usePresence({ canvasId, enabled = true, callbacks }: UsePresenceOptions) {
  const [user] = useAuthState(auth);
  const [activeUsers, setActiveUsers] = useState<Map<string, UserPresence>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [userColor, setUserColor] = useState<string>('');
  const initRef = useRef(false);

  useEffect(() => {
    if (!user || !canvasId || !enabled || initRef.current) return;

    const initPresence = async () => {
      try {
        initRef.current = true;
        
        const userInfo = {
          email: user.email || 'Anonymous',
          displayName: user.displayName || user.email?.split('@')[0] || 'User'
        };

        await presenceService.initializePresence(
          canvasId,
          user.uid,
          userInfo,
          {
            ...callbacks,
            onPresenceUpdate: (users) => {
              setActiveUsers(new Map(users));
              callbacks?.onPresenceUpdate?.(users);
            }
          }
        );

        setUserColor(presenceService.getUserColor());
        setIsConnected(true);
        setActiveUsers(presenceService.getActiveUsers());
      } catch (error) {
        console.error('Failed to initialize presence:', error);
        setIsConnected(false);
      }
    };

    initPresence();

    return () => {
      if (initRef.current) {
        presenceService.cleanup().catch(console.error);
        initRef.current = false;
        setIsConnected(false);
        setActiveUsers(new Map());
      }
    };
  }, [user, canvasId, enabled]); // Remove callbacks from dependencies to prevent re-initialization

  const updateCursor = useCallback((x: number, y: number) => {
    if (isConnected) {
      presenceService.updateCursor(x, y);
    }
  }, [isConnected]);

  const sendMessage = useCallback(async (message: string) => {
    if (isConnected) {
      await presenceService.sendMessage(message);
    }
  }, [isConnected]);

  const getOtherUsers = useCallback(() => {
    const others = new Map(activeUsers);
    if (user) {
      others.delete(user.uid);
    }
    return Array.from(others.values());
  }, [activeUsers, user]);

  return {
    activeUsers,
    otherUsers: getOtherUsers(),
    isConnected,
    userColor,
    updateCursor,
    sendMessage,
    totalUsers: activeUsers.size
  };
}