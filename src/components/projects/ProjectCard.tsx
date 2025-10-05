'use client';

import { useState } from 'react';
import { Project } from '@/types';
import { MoreHorizontal, Edit2, Trash2, Folder } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { prefetchProjectNotes, prefetchProjectTasks } from '@/lib/queryOptimizations';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onSelect: (project: Project) => void;
}

export default function ProjectCard({ project, onEdit, onDelete, onSelect }: ProjectCardProps) {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  // Prefetch project notes and tasks on hover
  const handleMouseEnter = () => {
    if (user) {
      prefetchProjectNotes(project.id, user.uid);
      prefetchProjectTasks(project.id, user.uid);
    }
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all cursor-pointer"
      onClick={() => onSelect(project)}
      onMouseEnter={handleMouseEnter}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: project.color + '20' }}
          >
            <Folder 
              className="w-5 h-5" 
              style={{ color: project.color }}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Updated {formatDate(project.updatedAt)}
            </p>
          </div>
        </div>

        <div className="relative">
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
                    onEdit(project);
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
                    onDelete(project.id);
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

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
        />
      )}
    </div>
  );
} 