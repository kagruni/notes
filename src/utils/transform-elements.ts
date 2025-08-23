/**
 * Transform elements from Excalidraw format to Firebase-compatible format
 * Converts nested arrays to objects to avoid Firebase issues
 */
export function transformElementsForFirebase(elements: any[]): any[] {
  return (elements || []).map(element => {
    const transformed = { ...element };
    
    Object.keys(transformed).forEach(key => {
      const value = transformed[key];
      
      if (key === 'points' && Array.isArray(value)) {
        // Convert points array [[x,y], [x,y]] to [{x, y}, {x, y}] for Firebase
        transformed[key] = value.map(point => {
          if (Array.isArray(point) && point.length >= 2) {
            return { x: point[0], y: point[1] };
          }
          // Already in object format or invalid
          return point;
        });
      } else if (key === 'scale' && Array.isArray(value) && value.length === 2) {
        // Convert scale [x, y] to {x, y}
        transformed[key] = { x: value[0], y: value[1] };
      } else if (key === 'boundElements' && Array.isArray(value)) {
        // Ensure boundElements are objects for Firebase
        transformed[key] = value.map((item, idx) => {
          if (Array.isArray(item)) {
            return { id: item[0], type: item[1] || 'text' };
          }
          if (item && typeof item === 'object' && 'id' in item) {
            return { id: item.id, type: item.type || 'text' };
          }
          return item;
        });
      }
    });
    
    return transformed;
  });
}

/**
 * Transform elements from Firebase format back to Excalidraw format
 * Converts objects back to nested arrays that Excalidraw expects
 */
export function transformElementsFromFirebase(elements: any[]): any[] {
  if (!elements || !Array.isArray(elements)) {
    console.log('[transformElementsFromFirebase] No elements to transform');
    return [];
  }
  
  console.log('[transformElementsFromFirebase] Transforming', elements.length, 'elements from Firebase format');
  
  return elements.map(element => {
    if (!element || typeof element !== 'object') return element;
    
    const transformed = { ...element };
    
    // Convert points back to array format if needed
    if (transformed.points && Array.isArray(transformed.points)) {
      const originalPoints = transformed.points;
      transformed.points = transformed.points.map((point: any) => {
        if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
          // Convert {x, y} back to [x, y]
          return [point.x, point.y];
        }
        // Already in array format or invalid
        return point;
      });
      console.log('[transformElementsFromFirebase] Transformed points for', element.type, 'from', originalPoints, 'to', transformed.points);
    }
    
    // Convert scale back to array format if needed
    if (transformed.scale && typeof transformed.scale === 'object' && 'x' in transformed.scale && 'y' in transformed.scale) {
      transformed.scale = [transformed.scale.x, transformed.scale.y];
    }
    
    // Convert boundElements back to array format if needed
    if (transformed.boundElements && Array.isArray(transformed.boundElements)) {
      console.log('[transformElementsFromFirebase] Processing boundElements for element:', element.id, transformed.boundElements);
      transformed.boundElements = transformed.boundElements.map((item: any) => {
        if (item && typeof item === 'object' && 'id' in item && 'type' in item) {
          return { id: item.id, type: item.type };  // Keep as object, not array
        }
        if (Array.isArray(item)) {
          return { id: item[0], type: item[1] || 'text' };  // Convert array to object
        }
        return item;
      });
    }
    
    return transformed;
  });
}