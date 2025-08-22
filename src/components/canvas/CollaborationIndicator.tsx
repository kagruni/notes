'use client';

import { useState } from 'react';
import { Collaborator } from '@/types';

interface CollaborationIndicatorProps {
  isConnected: boolean;
  activeUsers: Collaborator[];
}

export default function CollaborationIndicator({
  isConnected,
  activeUsers
}: CollaborationIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Filter out the current user if needed and limit display
  const displayUsers = activeUsers.slice(0, 5);
  const additionalUsers = Math.max(0, activeUsers.length - 5);

  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Active users */}
      {activeUsers.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="text-xs text-gray-600 dark:text-gray-400 mr-1">
            {activeUsers.length} {activeUsers.length === 1 ? 'user' : 'users'}
          </div>
          
          <div 
            className="flex -space-x-2 relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {displayUsers.map((user, index) => (
              <div
                key={user.userId}
                className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-gray-800 shadow-sm"
                style={{
                  backgroundColor: user.color || '#6B7280',
                  zIndex: displayUsers.length - index
                }}
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
            
            {additionalUsers > 0 && (
              <div className="relative w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-medium border-2 border-white dark:border-gray-800 shadow-sm">
                +{additionalUsers}
              </div>
            )}

            {/* Tooltip with user list */}
            {showTooltip && (
              <div className="absolute top-full mt-2 left-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Active Collaborators
                </div>
                <div className="space-y-1">
                  {activeUsers.map(user => (
                    <div key={user.userId} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: user.color || '#6B7280' }}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {user.name}
                      </span>
                      {user.isActive && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          • active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}