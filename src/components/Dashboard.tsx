'use client';

import { useState } from 'react';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useRealtimeProjects } from '@/hooks/useRealtimeSync';
import { useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/mutations/useProjectMutations';
import { Project } from '@/types';
import ProjectCard from './projects/ProjectCard';
import ProjectModal from './projects/ProjectModal';
import NotesView from './notes/NotesView';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  // Enable real-time sync
  useRealtimeProjects();

  // Queries
  const { data: projects = [], isLoading: loading, error } = useProjectsQuery();

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'canvases'>('projects');

  const handleCreateProject = async (title: string, description?: string, color?: string) => {
    createProjectMutation.mutate({ title, description, color });
  };

  const handleUpdateProject = async (title: string, description?: string, color?: string) => {
    if (editingProject) {
      updateProjectMutation.mutate({
        projectId: editingProject.id,
        updates: { title, description, color }
      });
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? All notes in this project will also be deleted.')) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
  };

  const closeModal = () => {
    setShowProjectModal(false);
    setEditingProject(null);
  };

  // Show notes view if project is selected
  if (selectedProject) {
    return (
      <NotesView 
        project={selectedProject} 
        onBack={handleBackToProjects}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
            activeTab === 'projects'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          My Projects
        </button>
        <button
          onClick={() => setActiveTab('canvases')}
          className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
            activeTab === 'canvases'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Canvas & Collaboration
        </button>
      </div>

      {activeTab === 'canvases' ? (
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Canvas & Collaboration</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Create and collaborate on visual canvases
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <a
              href="/canvas"
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">My Canvases</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                View and manage your own canvases
              </p>
            </a>
            
            <a
              href="/shared-with-me"
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Shared With Me</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                View canvases others have shared with you
              </p>
            </a>
            
            <a
              href="/my-canvases"
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Share & Collaborate</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Share your canvases and manage collaborators
              </p>
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Projects</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Organize your notes into projects
              </p>
            </div>
        
        <button
          onClick={() => setShowProjectModal(true)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading projects...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-red-500 dark:text-red-400">{error}</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              No projects yet. Create your first project to get started!
            </div>
            <button
              onClick={() => setShowProjectModal(true)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
                onSelect={handleSelectProject}
              />
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={showProjectModal}
        onClose={closeModal}
        onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
        project={editingProject}
      />
    </div>
  );
} 