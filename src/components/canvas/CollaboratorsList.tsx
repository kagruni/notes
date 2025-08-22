'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { 
  ChevronDown,
  User,
  Crown,
  Trash2
} from 'lucide-react';
import { Canvas, PermissionLevel } from '@/types';
import { UserPresence } from '@/services/presence';

interface CollaboratorsListProps {
  canvas?: Canvas;
  onRemove?: (userId: string) => void;
  onUpdatePermission?: (userId: string, role: PermissionLevel) => void;
  // For real-time collaboration mode
  users?: UserPresence[];
  currentUserColor?: string;
}

export default function CollaboratorsList({ 
  canvas, 
  onRemove, 
  onUpdatePermission,
  users,
  currentUserColor
}: CollaboratorsListProps) {
  // If users are provided, render real-time collaboration view
  if (users && users.length > 0) {
    return (
      <div 
        className="absolute top-4 right-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-xs"
        style={{ minWidth: '200px' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Active Collaborators
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {users.length} online
          </span>
        </div>
        <div className="space-y-2">
          {/* Current user */}
          {currentUserColor && (
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentUserColor }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                You
              </span>
            </div>
          )}
          
          {/* Other users */}
          {users.map(user => (
            <div 
              key={user.userId}
              className="flex items-center gap-2 animate-fadeIn"
            >
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: user.color }}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                {user.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Original canvas collaborators view
  if (!canvas) {
    return null;
  }
  
  // Helper function to get user display info
  const getUserInfo = (userId: string) => {
    // Check if it's an invite (temporary user)
    if (userId.startsWith('invite_')) {
      const parts = userId.split('_');
      const email = parts[1];
      return {
        email,
        displayName: email,
        initials: email.substring(0, 2).toUpperCase(),
        isInvite: true
      };
    }
    
    // For regular users, we'd normally fetch from Firebase
    // For now, return mock data
    return {
      email: userId,
      displayName: 'User',
      initials: 'U',
      isInvite: false
    };
  };

  // Get owner info
  const owner = getUserInfo(canvas.userId);
  
  // Get collaborators info
  const collaborators = (canvas.sharedWith || []).map(userId => ({
    userId,
    ...getUserInfo(userId),
    permission: canvas.permissions?.[userId]?.role || PermissionLevel.VIEWER
  }));

  const getPermissionBadgeColor = (role: PermissionLevel) => {
    switch (role) {
      case PermissionLevel.ADMIN:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case PermissionLevel.EDITOR:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case PermissionLevel.VIEWER:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatPermissionLabel = (role: PermissionLevel) => {
    switch (role) {
      case PermissionLevel.ADMIN:
        return 'Admin';
      case PermissionLevel.EDITOR:
        return 'Editor';
      case PermissionLevel.VIEWER:
        return 'Viewer';
      default:
        return 'Viewer';
    }
  };

  if (collaborators.length === 0 && !canvas.userId) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <User className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm">No collaborators yet</p>
        <p className="text-xs mt-1">Invite people to collaborate on this canvas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Owner */}
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {owner.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {owner.displayName}
              </p>
              <Crown className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {owner.email} • Owner
            </p>
          </div>
        </div>
      </div>

      {/* Collaborators */}
      {collaborators.map((collaborator) => (
        <div 
          key={collaborator.userId}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
              {collaborator.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {collaborator.displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {collaborator.email}
                {collaborator.isInvite && ' • Pending invite'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Permission Dropdown */}
            <Menu as="div" className="relative inline-block text-left">
              <div>
                <Menu.Button className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md ${getPermissionBadgeColor(collaborator.permission)}`}>
                  {formatPermissionLabel(collaborator.permission)}
                  <ChevronDown className="w-3 h-3" />
                </Menu.Button>
              </div>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onUpdatePermission(collaborator.userId, PermissionLevel.VIEWER)}
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } ${
                            collaborator.permission === PermissionLevel.VIEWER ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                          } block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200`}
                        >
                          Viewer
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onUpdatePermission(collaborator.userId, PermissionLevel.EDITOR)}
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } ${
                            collaborator.permission === PermissionLevel.EDITOR ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                          } block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200`}
                        >
                          Editor
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onUpdatePermission(collaborator.userId, PermissionLevel.ADMIN)}
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } ${
                            collaborator.permission === PermissionLevel.ADMIN ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                          } block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200`}
                        >
                          Admin
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            {/* Remove Button */}
            <button
              onClick={() => onRemove(collaborator.userId)}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              aria-label="Remove collaborator"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}