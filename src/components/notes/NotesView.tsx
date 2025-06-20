'use client';

import { useState } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { Project, Note, NoteImage } from '@/types';
import { ArrowLeft, Plus, Search, StickyNote, FileText, CheckSquare, Square } from 'lucide-react';
import NoteCard from '@/components/notes/NoteCard';
import NoteModal from '@/components/notes/NoteModal';
import { groupNotesByCalendarWeek } from '@/utils/date';

interface NotesViewProps {
  project: Project;
  onBack: () => void;
}

export default function NotesView({ project, onBack }: NotesViewProps) {
  const { notes, loading, error, createNote, updateNote, deleteNote } = useNotes(project.id);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedNotes = groupNotesByCalendarWeek(filteredNotes);

  const handleSubmitNote = async (title: string, content: string, tags: string[], images?: NoteImage[]) => {
    await createNote(title, content, project.id, tags, images);
  };

  const handleUpdateNote = async (title: string, content: string, tags: string[], images?: NoteImage[]) => {
    if (editingNote) {
      await updateNote(editingNote.id, { title, content, tags, images });
    }
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setModalMode('view');
    setShowNoteModal(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setModalMode('edit');
    setShowNoteModal(true);
  };

  const handleEditFromView = () => {
    if (viewingNote) {
      setEditingNote(viewingNote);
      setViewingNote(null);
      setModalMode('edit');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId);
    }
  };

  const closeModal = () => {
    setShowNoteModal(false);
    setEditingNote(null);
    setViewingNote(null);
    setModalMode('create');
  };

  const handleCreateNote = () => {
    setModalMode('create');
    setShowNoteModal(true);
  };

  const toggleNoteSelection = (noteId: string) => {
    const newSelection = new Set(selectedNotes);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNotes(newSelection);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedNotes(new Set());
    }
  };

  const handleGeneratePDF = async () => {
    if (selectedNotes.size === 0) return;
    
    setIsGeneratingPDF(true);
    try {
      const selectedNotesData = notes.filter(note => selectedNotes.has(note.id));
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: selectedNotesData,
          projectTitle: project.title,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF generation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to generate PDF: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_summary_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSelectedNotes(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate PDF summary: ${errorMessage}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {project.title}
            </h1>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSelectionMode}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm ${
              isSelectionMode
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-800 dark:text-white'
            }`}
          >
            {isSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
          </button>
          
          {isSelectionMode && selectedNotes.size > 0 && (
            <button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>{isGeneratingPDF ? 'Generating...' : `Generate PDF (${selectedNotes.size})`}</span>
            </button>
          )}
          
          <button
            onClick={handleCreateNote}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Notes Grid */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading notes...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-red-500 dark:text-red-400">{error}</div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <StickyNote className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm 
                ? 'No notes found matching your search.' 
                : 'No notes in this project yet. Create your first note!'
              }
            </div>
            {!searchTerm && (
              <button
                onClick={handleCreateNote}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Note</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedNotes.map((group) => (
              <div key={`${group.year}-${group.week}`}>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  {group.weekLabel}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onView={handleViewNote}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedNotes.has(note.id)}
                      onToggleSelect={() => toggleNoteSelection(note.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Modal */}
      <NoteModal
        isOpen={showNoteModal}
        onClose={closeModal}
        onSubmit={modalMode === 'edit' ? handleUpdateNote : handleSubmitNote}
        note={editingNote || viewingNote}
        mode={modalMode}
        onEdit={modalMode === 'view' ? handleEditFromView : undefined}
        projectId={project.id}
      />
    </div>
  );
} 