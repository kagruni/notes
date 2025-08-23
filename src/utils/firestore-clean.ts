/**
 * Clean data for Firestore - removes undefined values and handles special cases
 */
export function cleanForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (obj === '') return '';
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        // Skip undefined values completely
        if (value !== undefined) {
          const cleanedValue = cleanForFirestore(value);
          // Only add if the cleaned value is not undefined
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
    }
    return cleaned;
  }
  
  // For any other type, return null to avoid Firestore errors
  return null;
}

/**
 * Clean canvas updates specifically for Firestore
 */
export function cleanCanvasUpdates(updates: any): any {
  const cleaned = cleanForFirestore(updates);
  
  // Remove known problematic fields
  if (cleaned.appState) {
    delete cleaned.appState.collaborators;
    delete cleaned.appState.currentItemFontFamily;
    delete cleaned.appState.selectedElementIds;
    delete cleaned.appState.selectedGroupIds;
    
    // Clean any remaining undefined values in appState
    cleaned.appState = cleanForFirestore(cleaned.appState);
  }
  
  // Ensure files is an object, not undefined
  if (cleaned.files === undefined || cleaned.files === null) {
    cleaned.files = {};
  }
  
  return cleaned;
}