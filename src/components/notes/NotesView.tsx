'use client';

import { useState } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { useCanvases } from '@/hooks/useCanvases';
import { Project, Note, NoteImage, Canvas } from '@/types';
import { ArrowLeft, Plus, Search, StickyNote, FileText, CheckSquare, Square, Clock, PenTool } from 'lucide-react';
import toast from 'react-hot-toast';
import NoteCard from '@/components/notes/NoteCard';
import NoteModal from '@/components/notes/NoteModal';
import CanvasCard from '@/components/canvas/CanvasCard';
import CanvasEditor from '@/components/canvas/CanvasEditor';
import { groupNotesByCalendarWeek } from '@/utils/date';

interface NotesViewProps {
  project: Project;
  onBack: () => void;
}

export default function NotesView({ project, onBack }: NotesViewProps) {
  const { notes, loading: notesLoading, error: notesError, createNote, updateNote, deleteNote } = useNotes(project.id);
  const { canvases, loading: canvasesLoading, error: canvasesError, createCanvas, updateCanvas, deleteCanvas } = useCanvases(project.id);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [contentType, setContentType] = useState<'notes' | 'canvases'>('notes');
  const [showCanvasEditor, setShowCanvasEditor] = useState(false);
  const [editingCanvas, setEditingCanvas] = useState<Canvas | null>(null);

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

  const handleCreateCanvas = async () => {
    try {
      const canvasId = await createCanvas('Untitled Canvas', project.id);
      const newCanvas: Canvas = {
        id: canvasId,
        title: 'Untitled Canvas',
        elements: [],
        appState: {},
        files: {},
        projectId: project.id,
        userId: '', // Will be filled by Firebase
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setEditingCanvas(newCanvas);
      setShowCanvasEditor(true);
    } catch (error) {
      console.error('Failed to create canvas:', error);
      toast.error('Failed to create canvas');
    }
  };

  const handleOpenCanvas = (canvas: Canvas) => {
    setEditingCanvas(canvas);
    setShowCanvasEditor(true);
  };

  const handleUpdateCanvas = async (canvasId: string, updates: Partial<Canvas>) => {
    try {
      await updateCanvas(canvasId, updates);
      toast.success('Canvas saved');
    } catch (error) {
      console.error('Failed to update canvas:', error);
      toast.error('Failed to save canvas');
    }
  };

  const handleDeleteCanvas = async (canvasId: string) => {
    try {
      await deleteCanvas(canvasId);
      toast.success('Canvas deleted');
    } catch (error) {
      console.error('Failed to delete canvas:', error);
      toast.error('Failed to delete canvas');
    }
  };

  const handleCloseCanvas = () => {
    setShowCanvasEditor(false);
    setEditingCanvas(null);
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
    
    // Clear selection and exit selection mode immediately
    const selectedNotesData = notes.filter(note => selectedNotes.has(note.id));
    setSelectedNotes(new Set());
    setIsSelectionMode(false);
    
    // Create promise for toast
    const pdfPromise = fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: selectedNotesData,
        projectTitle: project.title,
      }),
    }).then(async (response) => {
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
      
      return `PDF generated successfully for ${selectedNotesData.length} notes`;
    });

    // Show toast with promise
    toast.promise(
      pdfPromise,
      {
        loading: 'Generating PDF summary...',
        success: (message) => message,
        error: (err) => err.message || 'Failed to generate PDF summary',
      },
      {
        loading: {
          duration: Infinity,
        },
        success: {
          duration: 3000,
        },
        error: {
          duration: 5000,
        },
      }
    );
  };

  const handleGenerateHoursPDF = async () => {
    if (selectedNotes.size === 0) return;
    
    // Clear selection and exit selection mode immediately
    const selectedNotesData = notes.filter(note => selectedNotes.has(note.id));
    setSelectedNotes(new Set());
    setIsSelectionMode(false);
    
    // Create promise for toast
    const pdfPromise = fetch('/api/generate-hours-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: selectedNotesData,
        projectTitle: project.title,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hours PDF generation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to generate hours PDF: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_arbeitsstunden_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return `Worker hours PDF generated successfully`;
    });

    // Show toast with promise
    toast.promise(
      pdfPromise,
      {
        loading: 'Generating worker hours PDF...',
        success: (message) => message,
        error: (err) => err.message || 'Failed to generate worker hours PDF',
      },
      {
        loading: {
          duration: Infinity,
        },
        success: {
          duration: 3000,
        },
        error: {
          duration: 5000,
        },
      }
    );
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
          {/* Only show selection mode for notes */}
          {contentType === 'notes' && (
            <>
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
                <>
                  <button
                    onClick={handleGeneratePDF}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Generate PDF ({selectedNotes.size})</span>
                  </button>
                  
                  <button
                    onClick={handleGenerateHoursPDF}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Hours PDF ({selectedNotes.size})</span>
                  </button>
                </>
              )}
            </>
          )}
          
          {/* Create buttons based on content type */}
          {contentType === 'notes' ? (
            <button
              onClick={handleCreateNote}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Note</span>
            </button>
          ) : (
            <button
              onClick={handleCreateCanvas}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Canvas</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 mb-4">
          <button
            onClick={() => setContentType('notes')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              contentType === 'notes'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <StickyNote className="w-4 h-4" />
            <span>Notes</span>
            {notes.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {notes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setContentType('canvases')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              contentType === 'canvases'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Canvases</span>
            {canvases.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                {canvases.length}
              </span>
            )}
          </button>
        </div>

        {/* Search (only for notes) */}
        {contentType === 'notes' && (
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
        )}
      </div>

      {/* Content Grid */}
      <div>
        {contentType === 'notes' ? (
          // Notes Display
          notesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading notes...</div>
            </div>
          ) : notesError ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-500 dark:text-red-400">{notesError}</div>
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
        )
        ) : (
          // Canvases Display
          canvasesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading canvases...</div>
            </div>
          ) : canvasesError ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-500 dark:text-red-400">{canvasesError}</div>
            </div>
          ) : canvases.length === 0 ? (
            <div className="text-center py-12">
              <PenTool className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <div className="text-gray-500 dark:text-gray-400 mb-4">
                No canvases in this project yet. Create your first canvas!
              </div>
              <button
                onClick={handleCreateCanvas}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Canvas</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {canvases.map((canvas) => (
                <CanvasCard
                  key={canvas.id}
                  canvas={canvas}
                  onOpen={handleOpenCanvas}
                  onDelete={handleDeleteCanvas}
                />
              ))}
            </div>
          )
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

      {/* Canvas Editor */}
      <CanvasEditor
        canvas={editingCanvas}
        isOpen={showCanvasEditor}
        onSave={handleUpdateCanvas}
        onClose={handleCloseCanvas}
      />
    </div>
  );
} 