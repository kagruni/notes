import React from 'react';
import { UserPresence } from '@/services/presence';

interface SimplifiedCollaborativeCursorsProps {
  users: UserPresence[];
}

export default function SimplifiedCollaborativeCursors({ users }: SimplifiedCollaborativeCursorsProps) {
  // Generate a color for each user if not provided
  const getUserColor = (userId: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#FFB6C1', '#FFD700', '#00CED1'
    ];
    
    // Use userId to consistently pick a color
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[999999]">
      {users.map(user => {
        if (!user.cursor) return null;
        
        const color = user.color || getUserColor(user.userId);
        
        return (
          <div
            key={user.userId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              transform: `translate(${user.cursor.x}px, ${user.cursor.y}px)`,
            }}
          >
            {/* Cursor pointer */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
            >
              <path
                d="M5 3L19 12L12 13L8 20L5 3Z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            
            {/* User label */}
            <div
              className="absolute left-6 top-0 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {user.displayName || user.email?.split('@')[0] || 'Anonymous'}
            </div>
          </div>
        );
      })}
    </div>
  );
}