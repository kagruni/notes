import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserPresence } from '@/services/presence';
import { getVisibleCollaborators } from '@/utils/performance';

interface CollaborativeCursorsProps {
  users: UserPresence[];
  containerRef?: React.RefObject<HTMLElement>;
  viewportOffset?: { x: number; y: number };
  zoom?: number;
  viewportBounds?: { left: number; top: number; right: number; bottom: number };
}

interface AnimatedCursor {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export default function CollaborativeCursors({ 
  users, 
  containerRef,
  viewportOffset = { x: 0, y: 0 },
  zoom = 1,
  viewportBounds
}: CollaborativeCursorsProps) {
  const [cursors, setCursors] = useState<Map<string, AnimatedCursor>>(new Map());
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());

  // Filter users to only those visible in viewport
  const visibleUsers = useCallback(() => {
    if (!viewportBounds) return users;
    
    return users.filter(user => {
      if (!user.cursor) return false;
      
      // Check if cursor is within viewport bounds
      const cursorX = (user.cursor.x + viewportOffset.x) * zoom;
      const cursorY = (user.cursor.y + viewportOffset.y) * zoom;
      
      return (
        cursorX >= viewportBounds.left - 100 && // Add padding for labels
        cursorX <= viewportBounds.right + 100 &&
        cursorY >= viewportBounds.top - 100 &&
        cursorY <= viewportBounds.bottom + 100
      );
    });
  }, [users, viewportBounds, viewportOffset, zoom]);

  useEffect(() => {
    // Update cursor targets when users change
    setCursors(prevCursors => {
      const newCursors = new Map<string, AnimatedCursor>();
      const visible = visibleUsers();
      
      visible.forEach(user => {
        if (user.cursor) {
          const existing = prevCursors.get(user.userId);
          if (existing) {
            newCursors.set(user.userId, {
              ...existing,
              targetX: user.cursor.x,
              targetY: user.cursor.y
            });
          } else {
            newCursors.set(user.userId, {
              x: user.cursor.x,
              y: user.cursor.y,
              targetX: user.cursor.x,
              targetY: user.cursor.y
            });
          }
        }
      });
      
      return newCursors;
    });
  }, [users, viewportBounds, viewportOffset, zoom, visibleUsers]);

  useEffect(() => {
    // Smooth cursor animation using requestAnimationFrame
    const animate = () => {
      const now = Date.now();
      const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 0.1); // Cap at 100ms
      lastUpdateRef.current = now;

      setCursors(prevCursors => {
        const updatedCursors = new Map<string, AnimatedCursor>();
        
        prevCursors.forEach((cursor, userId) => {
          const dx = cursor.targetX - cursor.x;
          const dy = cursor.targetY - cursor.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0.5) {
            // Smooth interpolation with easing
            const speed = 0.15; // Adjust for smoother/faster movement
            updatedCursors.set(userId, {
              ...cursor,
              x: cursor.x + dx * speed,
              y: cursor.y + dy * speed
            });
          } else {
            updatedCursors.set(userId, cursor);
          }
        });

        return updatedCursors;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getUserForCursor = (userId: string) => {
    return users.find(u => u.userId === userId);
  };

  return (
    <div 
      className="pointer-events-none absolute inset-0 z-50"
      style={{ overflow: 'hidden' }}
    >
      {Array.from(cursors.entries()).map(([userId, cursor]) => {
        const user = getUserForCursor(userId);
        if (!user) return null;

        // Apply viewport transformation
        const screenX = (cursor.x + viewportOffset.x) * zoom;
        const screenY = (cursor.y + viewportOffset.y) * zoom;

        return (
          <div
            key={userId}
            className="absolute transition-none"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
              willChange: 'transform'
            }}
          >
            {/* Cursor pointer */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute -left-1 -top-1"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
            >
              <path
                d="M5.5 3.5L20.5 12L12 13.5L8.5 20.5L5.5 3.5Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* User label */}
            <div
              className="absolute left-5 top-0 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
              style={{
                backgroundColor: user.color,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              {user.displayName}
            </div>

            {/* Message bubble if present */}
            {(user as any).message && (
              <div
                className="absolute left-5 top-7 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg max-w-xs"
                style={{
                  borderLeft: `3px solid ${user.color}`
                }}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {(user as any).message}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}