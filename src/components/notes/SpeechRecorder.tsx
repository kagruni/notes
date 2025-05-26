'use client';

import { useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSpeechToText, RecordingState } from '@/hooks/useSpeechToText';

interface SpeechRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export default function SpeechRecorder({ 
  onTranscriptionComplete, 
  onError,
  disabled = false 
}: SpeechRecorderProps) {
  const {
    isRecording,
    recordingState,
    error,
    transcription,
    startRecording,
    stopRecording,
    clearTranscription,
    clearError,
  } = useSpeechToText();

  // Handle transcription completion
  useEffect(() => {
    if (transcription) {
      onTranscriptionComplete(transcription);
      clearTranscription();
    }
  }, [transcription, onTranscriptionComplete, clearTranscription]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleToggleRecording = async () => {
    if (disabled) return;

    if (isRecording) {
      await stopRecording();
    } else {
      clearError();
      await startRecording();
    }
  };

  const getButtonColor = () => {
    switch (recordingState) {
      case 'recording':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'processing':
        return 'bg-blue-600 text-white cursor-not-allowed';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300';
    }
  };

  const getIcon = () => {
    switch (recordingState) {
      case 'recording':
        return <MicOff className="w-4 h-4" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Mic className="w-4 h-4" />;
    }
  };

  const getTooltip = () => {
    switch (recordingState) {
      case 'recording':
        return 'Stop recording';
      case 'processing':
        return 'Processing audio...';
      case 'error':
        return error || 'Recording error';
      default:
        return 'Start voice recording';
    }
  };

  const getLabel = () => {
    switch (recordingState) {
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Try again';
      default:
        return 'Voice input';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        type="button"
        onClick={handleToggleRecording}
        disabled={disabled || recordingState === 'processing'}
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200
          ${getButtonColor()}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isRecording ? 'animate-pulse' : ''}
        `}
        title={getTooltip()}
      >
        {getIcon()}
        <span className="text-sm font-medium">{getLabel()}</span>
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
            REC
          </span>
        </div>
      )}

      {/* Success indicator */}
      {recordingState === 'idle' && transcription && (
        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-medium">Transcribed</span>
        </div>
      )}

      {/* Error display */}
      {error && recordingState === 'error' && (
        <div className="flex items-center space-x-1">
          <button
            onClick={clearError}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}