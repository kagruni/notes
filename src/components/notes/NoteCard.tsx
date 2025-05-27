'use client';

import { useState } from 'react';
import { Note } from '@/types';
import { MoreHorizontal, Edit2, Trash2, Tag, Image as ImageIcon } from 'lucide-react';
import { getImageDisplayUrl } from '@/lib/imageStorage';

interface NoteCardProps {
  note: Note;
  onView: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export default function NoteCard({ note, onView, onEdit, onDelete }: NoteCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all cursor-pointer"
      onClick={() => onView(note)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
          {note.title}
        </h3>
        
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(note);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          {truncateContent(note.content)}
        </p>
      </div>

      {/* Images preview */}
      {note.images && note.images.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <ImageIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {note.images.length} image{note.images.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {note.images.slice(0, 3).map((image) => (
              <img
                key={image.id}
                src={getImageDisplayUrl(image)}
                alt={image.name}
                className="w-full h-16 object-cover rounded border border-gray-200 dark:border-gray-600"
              />
            ))}
            {note.images.length > 3 && (
              <div className="w-full h-16 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{note.images.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full"
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{note.tags.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {formatDate(note.updatedAt)}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
} 