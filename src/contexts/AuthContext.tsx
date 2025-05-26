'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    try {
      const unsubscribe = auth.onAuthStateChanged(
        (user) => {
          setUser(user);
          setLoading(false);
          setError(undefined);
        },
        (error) => {
          console.warn('Firebase auth error:', error);
          setError(error as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firebase initialization error:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 