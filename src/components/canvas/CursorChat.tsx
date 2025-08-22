import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface CursorChatProps {
  onSendMessage: (message: string) => void;
  userColor: string;
  position?: { x: number; y: number };
}

export default function CursorChat({ onSendMessage, userColor, position }: CursorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Keyboard shortcut to open chat (/)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't open if already typing in an input
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setMessage('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      setIsOpen(false);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow submit button click
    timeoutRef.current = setTimeout(() => {
      if (!message.trim()) {
        setIsOpen(false);
      }
    }, 200);
  };

  const handleInputFocus = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-all hover:scale-105"
        style={{ backgroundColor: userColor }}
        title="Press / to quick chat"
      >
        Press / to chat
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 left-6 z-50"
      style={{
        transform: position ? `translate(${position.x}px, ${position.y}px)` : undefined
      }}
    >
      <form 
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 border border-gray-200 dark:border-gray-700"
        style={{ borderLeft: `4px solid ${userColor}` }}
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          placeholder="Type a quick message..."
          className="flex-1 px-3 py-2 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none min-w-[200px]"
          maxLength={100}
        />
        <button
          type="submit"
          className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          style={{ color: userColor }}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press Enter to send, Esc to cancel
      </div>
    </div>
  );
}