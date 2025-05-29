'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '@/types';

interface ThemeContextType {
  theme: Theme['mode'];
  toggleTheme: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme['mode']>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme') as Theme['mode'] | null;
    console.log('Initializing theme. Saved theme:', savedTheme);
    
    if (savedTheme === 'dark' || savedTheme === 'light') {
      console.log('Using saved theme:', savedTheme);
      setTheme(savedTheme);
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('No saved theme, system prefers dark:', systemPrefersDark);
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && mounted) {
      // Apply theme to document - Tailwind only needs dark class
      const htmlElement = document.documentElement;
      
      console.log('Applying theme:', theme);
      console.log('HTML element before:', htmlElement.className);
      console.log('Document ready state:', document.readyState);
      
      // Force a reflow to ensure the class is applied
      if (theme === 'dark') {
        htmlElement.classList.remove('light');
        htmlElement.classList.add('dark');
        htmlElement.style.colorScheme = 'dark';
      } else {
        htmlElement.classList.remove('dark');
        htmlElement.classList.add('light');
        htmlElement.style.colorScheme = 'light';
      }
      
      localStorage.setItem('theme', theme);
      
      console.log('HTML element after:', htmlElement.className);
      console.log('LocalStorage theme set to:', localStorage.getItem('theme'));
      
      // Force a repaint
      void htmlElement.offsetHeight;
    }
  }, [theme, isLoading, mounted]);

  const toggleTheme = () => {
    console.log('=== TOGGLE THEME CALLED ===');
    console.log('Current theme before toggle:', theme);
    
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log('Toggling from', prev, 'to', newTheme);
      return newTheme;
    });
  };

  console.log('ThemeProvider render - current theme:', theme, 'isLoading:', isLoading);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 