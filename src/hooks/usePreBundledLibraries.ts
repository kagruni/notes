import { useState, useEffect, useCallback } from 'react';

// Global counter to ensure absolutely unique IDs
let globalLibraryItemCounter = 0;

export interface LibraryItem {
  id: string;
  status: 'published' | 'unpublished';
  elements: any[];
  created: number;
  name?: string;
  error?: string;
}

export interface PreBundledLibrary {
  id: string;
  name: string;
  description: string;
  authors: Array<{ name: string; url?: string }>;
  source: string;
  preview: string;
  created: string;
  updated?: string;
  version: number;
  filename: string;
  downloadedAt: string;
  fileSize: number;
}

interface LibraryIndex {
  version: string;
  generatedAt: string;
  totalLibraries: number;
  libraries: PreBundledLibrary[];
  failed: any[];
}

export function usePreBundledLibraries() {
  const [libraries, setLibraries] = useState<PreBundledLibrary[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Load the library index
  const loadLibraryIndex = useCallback(async (): Promise<LibraryIndex | null> => {
    try {
      const response = await fetch('/excalidraw-libraries/index.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch library index: ${response.statusText}`);
      }
      const index: LibraryIndex = await response.json();
      return index;
    } catch (err) {
      console.error('Error loading library index:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library index');
      return null;
    }
  }, []);

  // Load a single library file
  const loadLibraryFile = useCallback(async (library: PreBundledLibrary): Promise<LibraryItem[] | null> => {
    try {
      const response = await fetch(`/excalidraw-libraries/${library.filename}`);
      if (!response.ok) {
        console.warn(`Failed to fetch library ${library.name}: ${response.statusText}`);
        return null;
      }

      const libraryData = await response.json();
      
      // Convert to Excalidraw LibraryItem format
      if (libraryData.type === 'excalidrawlib' && libraryData.libraryItems) {
        // Format 2: Already in LibraryItem format with libraryItems array
        const libraryItems = libraryData.libraryItems.map((item: any, index: number) => {
          const uniqueId = `lib-${++globalLibraryItemCounter}-${library.id}-${item.id || index}`;
          return {
            ...item,
            id: uniqueId, // Absolutely unique ID with global counter
            status: item.status || 'published',
            elements: item.elements || [],
            created: item.created || new Date(library.created).getTime(),
            name: item.name || `${library.name} ${index + 1}`
          };
        });
        
        // Debug first few libraries
        if (library.name === 'R Icons' || library.name === 'Code Essentials') {
          console.log(`🔍 Format 2 (libraryItems) - Parsed library ${library.name}:`, {
            originalLibraryData: libraryData,
            libraryItemsGenerated: libraryItems.length,
            firstLibraryItem: libraryItems[0],
            elementsInFirstItem: libraryItems[0]?.elements?.length
          });
        }
        
        return libraryItems;
      } else if (libraryData.type === 'excalidrawlib' && libraryData.library) {
        // Format 1: Standard Excalidraw library format - each item in the library array is a group of elements
        const libraryItems = libraryData.library.map((elementGroup: any, index: number) => ({
          id: `lib-${++globalLibraryItemCounter}-${library.id}-item-${index}`, // Absolutely unique ID
          status: 'published' as const,
          elements: Array.isArray(elementGroup) ? elementGroup : [elementGroup],
          created: new Date(library.created).getTime(),
          name: `${library.name} ${index + 1}`
        }));
        
        // Debug first few libraries
        if (library.name === 'R Icons' || library.name === 'Code Essentials') {
          console.log(`🔍 Format 1 (library array) - Parsed library ${library.name}:`, {
            originalLibraryData: libraryData,
            libraryItemsGenerated: libraryItems.length,
            firstLibraryItem: libraryItems[0],
            elementsInFirstItem: libraryItems[0]?.elements?.length
          });
        }
        
        return libraryItems;
      } else if (Array.isArray(libraryData)) {
        // If it's already an array of library items
        return libraryData.map((item: any, index: number) => ({
          ...item,
          id: `lib-${++globalLibraryItemCounter}-${library.id}-${item.id || index}`, // Absolutely unique ID
          status: item.status || 'published',
          elements: Array.isArray(item.elements) ? item.elements : Array.isArray(item) ? item : [item],
          created: item.created || new Date(library.created).getTime(),
          name: item.name || `${library.name} ${index + 1}`
        }));
      } else if (libraryData.library) {
        // If it's wrapped in a library object but not standard format
        const libraryItems = Array.isArray(libraryData.library) ? libraryData.library : [libraryData.library];
        return libraryItems.map((item: any, index: number) => ({
          id: `lib-${++globalLibraryItemCounter}-${library.id}-wrapped-${index}`, // Absolutely unique ID
          status: 'published' as const,
          elements: Array.isArray(item) ? item : [item],
          created: new Date(library.created).getTime(),
          name: `${library.name} ${index + 1}`
        }));
      } else {
        // Try to extract elements directly
        const elements = libraryData.elements || libraryData.libraryItems || libraryData;
        return [{
          id: `lib-${++globalLibraryItemCounter}-${library.id}-direct`, // Absolutely unique ID
          status: 'published' as const,
          elements: Array.isArray(elements) ? elements : [elements],
          created: new Date(library.created).getTime(),
          name: library.name
        }];
      }
    } catch (err) {
      console.warn(`Error loading library ${library.name}:`, err);
      return null;
    }
  }, []);

  // Load all libraries
  const loadAllLibraries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadProgress(0);

      // Load the index
      const index = await loadLibraryIndex();
      if (!index) {
        return;
      }

      setLibraries(index.libraries);
      console.log(`📚 Found ${index.totalLibraries} pre-bundled libraries`);

      // Load library files in batches to avoid overwhelming the browser
      const allLibraryItems: LibraryItem[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < index.libraries.length; i += batchSize) {
        const batch = index.libraries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (library) => {
          const items = await loadLibraryFile(library);
          return items || [];
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Flatten and add to collection
        batchResults.forEach(items => {
          allLibraryItems.push(...items);
        });

        // Update progress
        const progress = Math.round(((i + batchSize) / index.libraries.length) * 100);
        setLoadProgress(Math.min(progress, 100));

        // Small delay to prevent blocking the UI
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Ensure all IDs are unique by removing duplicates
      const uniqueLibraryItems = [];
      const seenIds = new Set();
      const duplicatesFound = [];
      
      for (const item of allLibraryItems) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueLibraryItems.push(item);
        } else {
          duplicatesFound.push(item.id);
          console.warn(`🚨 Duplicate library item ID found and removed:`, {
            id: item.id,
            name: item.name,
            elements: item.elements?.length || 0
          });
        }
      }
      
      if (duplicatesFound.length > 0) {
        console.error(`🚨 Found ${duplicatesFound.length} duplicate library items:`, duplicatesFound);
      }
      
      setLibraryItems(uniqueLibraryItems);
      console.log(`✅ Loaded ${uniqueLibraryItems.length} unique library items from ${index.libraries.length} libraries`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load libraries';
      setError(errorMessage);
      console.error('Error loading pre-bundled libraries:', err);
    } finally {
      setLoading(false);
    }
  }, [loadLibraryIndex, loadLibraryFile]);

  // Get library statistics
  const getStats = useCallback(() => {
    return {
      totalLibraries: libraries.length,
      totalItems: libraryItems.length,
      totalSize: libraries.reduce((sum, lib) => sum + lib.fileSize, 0),
      loadProgress
    };
  }, [libraries, libraryItems, loadProgress]);

  // Get library items in Excalidraw format
  const getExcalidrawLibraryItems = useCallback(() => {
    return libraryItems;
  }, [libraryItems]);

  // Search libraries
  const searchLibraries = useCallback((query: string) => {
    if (!query.trim()) return libraries;
    
    const searchTerm = query.toLowerCase();
    return libraries.filter(lib => 
      lib.name.toLowerCase().includes(searchTerm) ||
      lib.description.toLowerCase().includes(searchTerm) ||
      lib.authors.some(author => author.name.toLowerCase().includes(searchTerm))
    );
  }, [libraries]);

  // Load libraries on mount
  useEffect(() => {
    console.log('🔄 usePreBundledLibraries: Loading libraries...');
    loadAllLibraries();
  }, [loadAllLibraries]);

  // Debug logging
  useEffect(() => {
    if (!loading && libraryItems.length > 0) {
      console.log(`📚 usePreBundledLibraries: Loaded ${libraryItems.length} library items from ${libraries.length} libraries`);
      console.log('📚 Sample library items:', libraryItems.slice(0, 3));
    }
    if (error) {
      console.error('🚨 usePreBundledLibraries: Library loading error:', error);
    }
  }, [loading, libraryItems.length, libraries.length, error]);

  return {
    libraries,
    libraryItems,
    loading,
    error,
    loadProgress,
    getStats,
    getExcalidrawLibraryItems,
    searchLibraries,
    reloadLibraries: loadAllLibraries
  };
}