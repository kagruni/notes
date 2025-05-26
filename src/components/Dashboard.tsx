'use client';

import { useState } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types';
import ProjectCard from './projects/ProjectCard';
import ProjectModal from './projects/ProjectModal';
import NotesView from './notes/NotesView';
import { Plus, ArrowLeft } from 'lucide-react';

export default function Dashboard() {
  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleCreateProject = async (title: string, description?: string, color?: string) => {
    await createProject(title, description, color);
  };

  const handleUpdateProject = async (title: string, description?: string, color?: string) => {
    if (editingProject) {
      await updateProject(editingProject.id, { title, description, color });
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? All notes in this project will also be deleted.')) {
      await deleteProject(projectId);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Projects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Organize your notes into projects
          </p>
        </div>
        
        <button
          onClick={() => setShowProjectModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors"
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