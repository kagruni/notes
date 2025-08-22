'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Canvas } from '@/types';
import ShareModal from './ShareModal';

interface ShareButtonProps {
  canvas: Canvas;
  onUpdate: (updates: Partial<Canvas>) => Promise<void>;
}

export default function ShareButton({ canvas, onUpdate }: ShareButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Calculate number of collaborators
  const collaboratorCount = canvas.sharedWith?.length || 0;
  
  // Debug logging
  console.log('ShareButton render:', { 
    canvasId: canvas.id, 
    canvasTitle: canvas.title, 
    isModalOpen,
    collaboratorCount 
  });

  return (
    <>
      <button
        onClick={() => {
          console.log('ShareButton clicked, setting modal open to true');
          setIsModalOpen(true);
        }}
        className="relative inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Share canvas"
      >
        <Users className="w-4 h-4" />
        <span>Share</span>
        {collaboratorCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-blue-600 dark:bg-blue-500 rounded-full">
            {collaboratorCount}
          </span>
        )}
      </button>

      <ShareModal
        canvas={canvas}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
      />
    </>
  );
}