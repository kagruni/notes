import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

interface UseSpeechToTextReturn {
  isRecording: boolean;
  recordingState: RecordingState;
  error: string | null;
  transcription: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscription: () => void;
  clearError: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const checkMicrophoneSupport = () => {
    if (typeof window === 'undefined') return false;
    
    // Check if we're on HTTPS or localhost
    const isSecureContext = window.location.protocol === 'https:' || 
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      return false;
    }
    
    // Check if mediaDevices API is available
    return navigator && 
           navigator.mediaDevices && 
           typeof navigator.mediaDevices.getUserMedia === 'function';
  };

  const processRecording = useCallback(async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        throw new Error('No audio data recorded');
      }

      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0].type 
      });

      // Check minimum file size (avoid very short recordings)
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short');
      }

      // Create form data for API
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      // Send to transcription API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const result = await response.json();
      
      if (result.success && result.text) {
        setTranscription(result.text);
        setRecordingState('idle');
      } else {
        throw new Error('No transcription returned');
      }

    } catch (err) {
      console.error('Error processing recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to process recording');
      setRecordingState('error');
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscription(null);

      // Check browser support first
      if (!checkMicrophoneSupport()) {
        const isSecureContext = typeof window !== 'undefined' && 
                               (window.location.protocol === 'https:' || 
                                window.location.hostname === 'localhost' ||
                                window.location.hostname === '127.0.0.1');
        
        if (!isSecureContext) {
          throw new Error('Voice recording requires HTTPS. Please access the app via HTTPS or localhost for voice functionality.');
        } else {
          throw new Error('Your browser does not support audio recording');
        }
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for speech recognition
        } 
      });

      // Clear previous chunks
      audioChunksRef.current = [];

      // Create MediaRecorder with optimal settings for speech
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000, // Optimal for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          await processRecording();
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed');
        setRecordingState('error');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setRecordingState('recording');

    } catch (err) {
      console.error('Error starting recording:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found on this device.');
        } else if (err.name === 'NotSupportedError') {
          setError('Audio recording is not supported on this device.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to start recording. Please ensure you are using HTTPS and have granted microphone permissions.');
      }
      
      setRecordingState('error');
    }
  }, [processRecording]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      setRecordingState('processing');
      mediaRecorderRef.current.stop();
    }
  }, [recordingState]);

  const clearTranscription = useCallback(() => {
    setTranscription(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (recordingState === 'error') {
      setRecordingState('idle');
    }
  }, [recordingState]);

  return {
    isRecording: recordingState === 'recording',
    recordingState,
    error,
    transcription,
    startRecording,
    stopRecording,
    clearTranscription,
    clearError,
  };
}