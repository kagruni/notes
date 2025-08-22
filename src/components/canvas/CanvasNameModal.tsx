'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CanvasNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  initialName?: string;
  title?: string;
}

export default function CanvasNameModal({
  isOpen,
  onClose,
  onConfirm,
  initialName = 'Untitled Canvas',
  title = 'Name Your Canvas'
}: CanvasNameModalProps) {
  const [canvasName, setCanvasName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setCanvasName(initialName);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = canvasName.trim();
    onConfirm(trimmedName || 'Untitled Canvas');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label
              htmlFor="canvas-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Canvas Name
            </label>
            <input
              id="canvas-name"
              type="text"
              value={canvasName}
              onChange={(e) => setCanvasName(e.target.value)}
              placeholder="Enter canvas name..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Give your canvas a descriptive name to easily find it later.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              {initialName && initialName !== 'Untitled Canvas' ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}