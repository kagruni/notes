import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const projectsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Project[];
        
        setProjects(projectsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching projects:', err);
        setError('Failed to fetch projects');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createProject = async (title: string, description?: string, color?: string) => {
    if (!user) {
      console.error('User not authenticated');
      throw new Error('User not authenticated');
    }

    // Debug authentication
    console.log('User authenticated:', !!user);
    console.log('User UID:', user.uid);
    console.log('User email:', user.email);

    console.log('Creating project with userId:', user.uid);
    console.log('Project data:', { title, description, color });

    try {
      const projectData = {
        title,
        description: description || '',
        userId: user.uid,
        color: color || '#3B82F6',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Attempting to create project:', projectData);
      console.log('Database reference:', db);
      console.log('Collection reference:', collection(db, 'projects'));
      
      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('Project created successfully with ID:', docRef.id);
    } catch (err) {
      console.error('Detailed error creating project:', err);
      console.error('Error code:', (err as any)?.code);
      console.error('Error message:', (err as any)?.message);
      console.error('Full error object:', err);
      throw new Error(`Failed to create project: ${(err as any)?.message || 'Unknown error'}`);
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Pick<Project, 'title' | 'description' | 'color'>>) => {
    try {
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await updateDoc(doc(db, 'projects', projectId), {
        ...filteredUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating project:', err);
      throw new Error('Failed to update project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
      throw new Error('Failed to delete project');
    }
  };

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
  };
} 