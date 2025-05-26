'use client';

import { useState } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { Project, Note } from '@/types';
import { ArrowLeft, Plus, Search, StickyNote } from 'lucide-react';
import NoteCard from '@/components/notes/NoteCard';
import NoteModal from '@/components/notes/NoteModal';

interface NotesViewProps {
  project: Project;
  onBack: () => void;
}

export default function NotesView({ project, onBack }: NotesViewProps) {
  const { notes, loading, error, createNote, updateNote, deleteNote } = useNotes(project.id);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNote = async (title: string, content: string, tags?: string[]) => {
    await createNote(title, content, project.id, tags);
  };

  const handleUpdateNote = async (title: string, content: string, tags?: string[]) => {
    if (editingNote) {
      await updateNote(editingNote.id, { title, content, tags });
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setShowNoteModal(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId);
    }
  };

  const closeModal = () => {
    setShowNoteModal(false);
    setEditingNote(null);
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
        
        <button
          onClick={() => setShowNoteModal(true)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
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
                onClick={() => setShowNoteModal(true)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Note</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </div>

      {/* Note Modal */}
      <NoteModal
        isOpen={showNoteModal}
        onClose={closeModal}
        onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
        note={editingNote}
      />
    </div>
  );
} 