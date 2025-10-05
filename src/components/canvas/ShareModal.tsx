'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  X,
  Copy,
  Link2,
  Globe,
  Lock,
  Check,
  Mail,
  UserPlus,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Canvas, PermissionLevel } from '@/types';
import CollaboratorsList from './CollaboratorsList';
import { useCollaborationQuery } from '@/hooks/queries/useCollaborationQuery';
import {
  useShareCanvas,
  useUpdatePermission,
  useRemoveCollaborator,
  useGenerateShareLink,
  useRevokeShareLink
} from '@/hooks/mutations/useCollaborationMutations';

interface ShareModalProps {
  canvas: Canvas;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Canvas>) => Promise<void>;
}

export default function ShareModal({ canvas, isOpen, onClose, onUpdate }: ShareModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER);
  const [linkPermission, setLinkPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [collaborationEnabled, setCollaborationEnabled] = useState(canvas.collaborationEnabled || false);

  // Debug logging
  console.log('ShareModal render:', { 
    canvasId: canvas.id, 
    canvasTitle: canvas.title, 
    canvasName: canvas.name,
    isOpen,
    collaborationEnabled,
    fullCanvas: canvas
  });

  // Query for collaboration data
  const {
    data: collaborationData,
    isLoading: isLoadingCollaboration,
    error: collaborationError
  } = useCollaborationQuery(canvas.id);

  // Mutation hooks
  const shareCanvasMutation = useShareCanvas();
  const updatePermissionMutation = useUpdatePermission();
  const removeCollaboratorMutation = useRemoveCollaborator();
  const generateShareLinkMutation = useGenerateShareLink();
  const revokeShareLinkMutation = useRevokeShareLink();

  // Extract data from query
  const collaborators = collaborationData?.collaborators || [];
  const pendingInvites = collaborationData?.pendingInvites || [];
  const canShare = collaborationData?.canShare || false;
  const shareLink = collaborationData?.shareLink;
  const isPublic = collaborationData?.isPublic || false;

  const handleInviteByEmail = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      setInviteError('Please enter a valid email address');
      return;
    }

    if (!canShare) {
      setInviteError('You do not have permission to share this canvas');
      return;
    }

    setIsInviting(true);
    setInviteError(null);

    try {
      await shareCanvasMutation.mutateAsync({
        canvasId: canvas.id,
        email: emailInput,
        permission: selectedPermission
      });
      setEmailInput('');
      setSelectedPermission(PermissionLevel.VIEWER);
    } catch (error) {
      console.error('Failed to invite user:', error);
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!canShare) {
      setLinkError('You do not have permission to generate share links');
      return;
    }

    setLinkError(null);

    try {
      await generateShareLinkMutation.mutateAsync({
        canvasId: canvas.id,
        permission: linkPermission,
        expiresInDays: 0 // No expiration by default
      });
    } catch (error) {
      console.error('Failed to generate share link:', error);
      setLinkError(error instanceof Error ? error.message : 'Failed to generate link');
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleTogglePublic = async () => {
    if (!canShare) {
      setLinkError('You do not have permission to change share settings');
      return;
    }

    setLinkError(null);

    try {
      if (isPublic) {
        await revokeShareLinkMutation.mutateAsync({
          canvasId: canvas.id
        });
      } else {
        await generateShareLinkMutation.mutateAsync({
          canvasId: canvas.id,
          permission: linkPermission,
          expiresInDays: 0
        });
      }
    } catch (error) {
      console.error('Failed to update public access:', error);
      setLinkError(error instanceof Error ? error.message : 'Failed to update settings');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await removeCollaboratorMutation.mutateAsync({
        canvasId: canvas.id,
        userId
      });
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
    }
  };

  const handleUpdatePermission = async (userId: string, newRole: PermissionLevel) => {
    try {
      await updatePermissionMutation.mutateAsync({
        canvasId: canvas.id,
        userId,
        permission: newRole
      });
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100001]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4">
                      Share &quot;{canvas.title}&quot;
                    </Dialog.Title>

                    {isLoadingCollaboration && (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading collaboration data...</span>
                      </div>
                    )}

                    <Tab.Group>
                      <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
                        <Tab
                          className={({ selected }) =>
                            `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                            ${selected 
                              ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                            }`
                          }
                        >
                          <div className="flex items-center justify-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            People
                          </div>
                        </Tab>
                        <Tab
                          className={({ selected }) =>
                            `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                            ${selected 
                              ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                            }`
                          }
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Link2 className="w-4 h-4" />
                            Link
                          </div>
                        </Tab>
                        <Tab
                          className={({ selected }) =>
                            `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                            ${selected 
                              ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                            }`
                          }
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Settings className="w-4 h-4" />
                            Settings
                          </div>
                        </Tab>
                      </Tab.List>

                      <Tab.Panels className="mt-4">
                        {/* People Tab */}
                        <Tab.Panel className="space-y-4">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <input
                                type="email"
                                placeholder="Enter email address"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleInviteByEmail()}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <select
                              value={selectedPermission}
                              onChange={(e) => setSelectedPermission(e.target.value as PermissionLevel)}
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={PermissionLevel.VIEWER}>Viewer</option>
                              <option value={PermissionLevel.EDITOR}>Editor</option>
                              <option value={PermissionLevel.ADMIN}>Admin</option>
                            </select>
                            <button
                              onClick={handleInviteByEmail}
                              disabled={isInviting || shareCanvasMutation.isPending || !emailInput || !canShare}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Mail className="w-4 h-4" />
                              {isInviting || shareCanvasMutation.isPending ? 'Sending...' : 'Invite'}
                            </button>
                          </div>

                          {inviteError && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
                            </div>
                          )}

                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                              People with access ({collaborators.length})
                            </h4>
                            <CollaboratorsList
                              canvas={canvas}
                              onRemove={handleRemoveCollaborator}
                              onUpdatePermission={handleUpdatePermission}
                            />
                            
                            {pendingInvites.length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                  Pending invites ({pendingInvites.length})
                                </h4>
                                <div className="space-y-2">
                                  {pendingInvites.map((invite) => (
                                    <div key={invite.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                      <span className="text-sm text-gray-600 dark:text-gray-300">{invite.invitedEmail}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{invite.role}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </Tab.Panel>

                        {/* Link Tab */}
                        <Tab.Panel className="space-y-4">
                          {linkError && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <p className="text-sm text-red-600 dark:text-red-400">{linkError}</p>
                            </div>
                          )}
                          
                          {shareLink ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">Share link</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                                    {shareLink}
                                  </p>
                                </div>
                                <button
                                  onClick={handleCopyLink}
                                  className="ml-4 px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 flex items-center gap-2 text-sm"
                                >
                                  {linkCopied ? (
                                    <>
                                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700 dark:text-gray-300">
                                  Permission for link visitors:
                                </label>
                                <select
                                  value={linkPermission}
                                  onChange={(e) => setLinkPermission(e.target.value as PermissionLevel)}
                                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value={PermissionLevel.VIEWER}>Viewer</option>
                                  <option value={PermissionLevel.EDITOR}>Editor</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Link2 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                              <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Generate a shareable link to allow others to access this canvas
                              </p>
                              <button
                                onClick={handleGenerateLink}
                                disabled={!canShare || generateShareLinkMutation.isPending}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {generateShareLinkMutation.isPending ? 'Generating...' : 'Generate Link'}
                              </button>
                            </div>
                          )}
                        </Tab.Panel>

                        {/* Settings Tab */}
                        <Tab.Panel className="space-y-4">
                          <div className="space-y-4">
                            {/* Real-time Collaboration Toggle */}
                            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    Real-time Collaboration
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    See cursors and changes from other users in real-time
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  const newValue = !collaborationEnabled;
                                  setCollaborationEnabled(newValue);
                                  await onUpdate({ collaborationEnabled: newValue });
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  collaborationEnabled 
                                    ? 'bg-blue-600' 
                                    : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    collaborationEnabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <div className="flex items-center gap-3">
                                {isPublic ? (
                                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                )}
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {isPublic ? 'Public' : 'Private'}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {isPublic 
                                      ? 'Anyone with the link can access' 
                                      : 'Only invited people can access'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={handleTogglePublic}
                                disabled={!canShare || generateShareLinkMutation.isPending || revokeShareLinkMutation.isPending}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  isPublic ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                                } ${!canShare || generateShareLinkMutation.isPending || revokeShareLinkMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span className="sr-only">Toggle public access</span>
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isPublic ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            {!canShare && (
                              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  <strong>Note:</strong> You need admin permissions to manage share settings.
                                </p>
                              </div>
                            )}

                            {collaborationError && (
                              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  <strong>Error:</strong> {collaborationError instanceof Error ? collaborationError.message : 'Failed to load collaboration data'}
                                </p>
                              </div>
                            )}
                          </div>
                        </Tab.Panel>
                      </Tab.Panels>
                    </Tab.Group>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}