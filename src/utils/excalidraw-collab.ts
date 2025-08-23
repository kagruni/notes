// Using 'any' for ExcalidrawElement as the types are not exported properly
type ExcalidrawElement = any;
import { CanvasOperation } from '@/services/operations';
import { transformElementsFromFirebase, transformElementsForFirebase } from './transform-elements';

export interface ExcalidrawChange {
  added: ExcalidrawElement[];
  updated: ExcalidrawElement[];
  deleted: string[];
}

/**
 * Detects changes between two sets of Excalidraw elements
 */
export function detectChanges(
  oldElements: ExcalidrawElement[],
  newElements: ExcalidrawElement[]
): ExcalidrawChange {
  const oldMap = new Map(oldElements.map(el => [el.id, el]));
  const newMap = new Map(newElements.map(el => [el.id, el]));

  const added: ExcalidrawElement[] = [];
  const updated: ExcalidrawElement[] = [];
  const deleted: string[] = [];

  // Find added and updated elements
  newElements.forEach(newEl => {
    const oldEl = oldMap.get(newEl.id);
    if (!oldEl) {
      added.push(newEl);
    } else if (hasElementChanged(oldEl, newEl)) {
      // Debug text elements
      if (newEl.type === 'text') {
        console.log('[detectChanges] Text element changed:', {
          id: newEl.id,
          oldText: oldEl.text,
          newText: newEl.text,
          containerId: newEl.containerId,
          hasText: 'text' in newEl,
          textUndefined: newEl.text === undefined
        });
      }
      updated.push(newEl);
    }
  });

  // Find deleted elements
  oldElements.forEach(oldEl => {
    if (!newMap.has(oldEl.id)) {
      deleted.push(oldEl.id);
    }
  });

  // Only log summary if there are changes
  if (added.length > 0 || updated.length > 0 || deleted.length > 0) {
    console.log('[detectChanges] Changes detected:', {
      added: added.length,
      updated: updated.length,
      deleted: deleted.length
    });
  }

  return { added, updated, deleted };
}

/**
 * Checks if an element has changed
 */
function hasElementChanged(oldEl: ExcalidrawElement, newEl: ExcalidrawElement): boolean {
  // Special check for text elements - text changes are critical
  if (oldEl.type === 'text' || newEl.type === 'text') {
    const oldText = (oldEl as any).text || '';
    const newText = (newEl as any).text || '';
    if (oldText !== newText) {
      return true;
    }
  }
  
  // Check versionNonce first (Excalidraw uses this for change tracking)
  if ('versionNonce' in oldEl && 'versionNonce' in newEl) {
    if ((oldEl as any).versionNonce !== (newEl as any).versionNonce) {
      return true;
    }
  }
  
  // Check version if available
  if ('version' in oldEl && 'version' in newEl) {
    if (oldEl.version !== newEl.version) {
      return true;
    }
  }
  
  // Check updated timestamp - this should catch text changes
  if ('updated' in oldEl && 'updated' in newEl) {
    if ((oldEl as any).updated !== (newEl as any).updated) {
      return true;
    }
  }

  // If no version tracking, compare all properties
  // Check key properties including text and bindings
  // Note: Excluding boundElements as it causes issues with Excalidraw rendering
  const propsToCheck = ['x', 'y', 'width', 'height', 'angle', 'strokeColor', 
                        'backgroundColor', 'fillStyle', 'strokeWidth', 'roughness',
                        'opacity', 'text', 'fontSize', 'fontFamily', 'textAlign',
                        'verticalAlign', 'baseline', 'points', 'roundness',
                        'lastCommittedPoint', 'startBinding', 'endBinding', 
                        'containerId'];

  for (const prop of propsToCheck) {
    const oldVal = (oldEl as any)[prop];
    const newVal = (newEl as any)[prop];
    
    // Skip if both are undefined/null/same value
    if (oldVal === newVal) continue;
    
    // Handle arrays specially (like points)
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        return true;
      }
    } else if (oldVal !== newVal) {
      return true;
    }
  }
  
  // No changes detected
  return false;
}

/**
 * Clean element data for Firebase (remove undefined values)
 */
function cleanElementForFirebase(element: any): any {
  if (element === undefined) return null;
  if (element === null) return null;
  if (typeof element !== 'object') return element;
  
  if (Array.isArray(element)) {
    return element.map(item => cleanElementForFirebase(item));
  }
  
  const cleaned: any = {};
  for (const key in element) {
    const value = element[key];
    if (value !== undefined) {
      cleaned[key] = cleanElementForFirebase(value);
    }
  }
  return cleaned;
}

/**
 * Converts Excalidraw changes to canvas operations
 * Ensures bound text elements are synced with their containers
 */
export function changesToOperations(changes: ExcalidrawChange, allElements?: ExcalidrawElement[]): CanvasOperation[] {
  console.log('[changesToOperations] Converting changes to operations:', {
    added: changes.added.length,
    updated: changes.updated.length,
    deleted: changes.deleted.length
  });
  
  const operations: Omit<CanvasOperation, 'userId' | 'clientId' | 'timestamp'>[] = [];

  // Helper to find related bound elements
  // IMPORTANT: Use the FULL element from allElements, not the potentially partial element from changes
  const findRelatedElements = (changedElements: ExcalidrawElement[]): ExcalidrawElement[] => {
    if (!allElements) return changedElements;
    
    const result: ExcalidrawElement[] = [];
    const resultIds = new Set<string>();
    
    // First, add the FULL versions of changed elements from allElements
    changedElements.forEach(changedEl => {
      const fullElement = allElements.find(e => e.id === changedEl.id);
      if (fullElement) {
        result.push(fullElement);  // Use FULL element with all properties
        resultIds.add(fullElement.id);
        
        // Debug logging for text elements
        if (fullElement.type === 'text') {
          console.log('[changesToOperations] Using FULL text element:', {
            id: fullElement.id,
            text: fullElement.text,
            containerId: fullElement.containerId,
            hasText: 'text' in fullElement
          });
        }
      } else {
        // If not found in allElements (shouldn't happen), use the changed element
        result.push(changedEl);
        resultIds.add(changedEl.id);
      }
    });
    
    // Then find and add related elements (use a copy to avoid iterating while modifying)
    [...result].forEach(el => {
      // If this is a text element with a containerId, include its container
      if (el.type === 'text' && el.containerId && !resultIds.has(el.containerId)) {
        const container = allElements.find(e => e.id === el.containerId);
        if (container) {
          console.log('[changesToOperations] Including container for bound text:', el.id, '->', container.id);
          result.push(container);
          resultIds.add(container.id);
        }
      }
      
      // If this element has boundElements, include the bound text
      if (el.boundElements && Array.isArray(el.boundElements)) {
        el.boundElements.forEach((bound: any) => {
          const boundId = Array.isArray(bound) ? bound[0] : bound?.id || bound;
          if (boundId && !resultIds.has(boundId)) {
            const boundElement = allElements.find(e => e.id === boundId);
            if (boundElement && boundElement.type === 'text') {
              console.log('[changesToOperations] Including bound text for container:', el.id, '->', boundId);
              result.push(boundElement);
              resultIds.add(boundId);
            }
          }
        });
      }
    });
    
    return result;
  };

  if (changes.added.length > 0) {
    const elementsWithRelated = findRelatedElements(changes.added);
    console.log('[changesToOperations] Creating ADD operation for', elementsWithRelated.length, 'elements (including bound)');
    // Transform elements to Firebase format before sending
    const transformedElements = transformElementsForFirebase(elementsWithRelated);
    operations.push({
      type: 'add',
      elementIds: elementsWithRelated.map(el => el.id),
      data: { elements: transformedElements.map(el => cleanElementForFirebase(el)) }
    });
  }

  if (changes.updated.length > 0) {
    const elementsWithRelated = findRelatedElements(changes.updated);
    console.log('[changesToOperations] Creating UPDATE operation for', elementsWithRelated.length, 'elements (including bound)');
    
    // Debug: Log what we're sending for text elements
    elementsWithRelated.forEach(el => {
      if (el.type === 'text') {
        console.log('[changesToOperations] Sending text element update:', {
          id: el.id,
          text: el.text,
          containerId: el.containerId,
          x: el.x,
          y: el.y,
          hasText: 'text' in el,
          textLength: el.text?.length
        });
      }
    });
    
    // Transform elements to Firebase format before sending
    const transformedElements = transformElementsForFirebase(elementsWithRelated);
    operations.push({
      type: 'update',
      elementIds: elementsWithRelated.map(el => el.id),
      data: { elements: transformedElements.map(el => cleanElementForFirebase(el)) }
    });
  }

  if (changes.deleted.length > 0) {
    console.log('[changesToOperations] Creating DELETE operation for', changes.deleted.length, 'elements');
    operations.push({
      type: 'delete',
      elementIds: changes.deleted,
      data: { elementIds: changes.deleted }
    });
  }

  console.log('[changesToOperations] Created', operations.length, 'operations');
  return operations as CanvasOperation[];
}

/**
 * Applies a canvas operation to Excalidraw elements
 */
export function applyOperation(
  elements: ExcalidrawElement[],
  operation: CanvasOperation
): ExcalidrawElement[] {
  console.log('[applyOperation] 🔍 STARTING:', {
    type: operation.type,
    currentElements: elements.length,
    operationElements: operation.elementIds?.length,
    hasData: !!operation.data,
    dataKeys: operation.data ? Object.keys(operation.data) : [],
    hasDataElements: !!(operation.data?.elements),
    dataElementsCount: operation.data?.elements?.length || 0
  });
  
  // Deep log the operation data
  if (operation.data?.elements?.[0]) {
    const firstEl = operation.data.elements[0];
    console.log('[applyOperation] 📦 First element in operation:', {
      id: firstEl.id,
      type: firstEl.type,
      x: firstEl.x,
      y: firstEl.y,
      width: firstEl.width,
      height: firstEl.height,
      hasVersionNonce: 'versionNonce' in firstEl,
      hasSeed: 'seed' in firstEl,
      allKeys: Object.keys(firstEl)
    });
  }
  
  const elementMap = new Map(elements.map(el => [el.id, el]));

  switch (operation.type) {
    case 'add':
      // Add new elements - transform from Firebase format back to Excalidraw format
      const rawNewElements = operation.data.elements as any[];
      const newElements = transformElementsFromFirebase(rawNewElements) as ExcalidrawElement[];
      console.log('[applyOperation] Adding', newElements.length, 'elements (transformed from Firebase format)');
      newElements.forEach(el => {
        if (!elementMap.has(el.id)) {
          // Ensure element has ALL required Excalidraw properties
          // Based on DirectUpdateTest which works, we need these exact properties
          const completeElement = {
            id: el.id,
            type: el.type,
            x: el.x || 0,
            y: el.y || 0,
            width: el.width || 100,
            height: el.height || 100,
            angle: el.angle || 0,
            strokeColor: el.strokeColor || '#000000',
            backgroundColor: el.backgroundColor || 'transparent',
            fillStyle: el.fillStyle || 'solid',
            strokeWidth: el.strokeWidth || 2,
            strokeStyle: el.strokeStyle || 'solid',
            roughness: el.roughness || 0,
            opacity: el.opacity || 100,
            groupIds: el.groupIds || [],
            frameId: el.frameId || null,
            roundness: el.roundness || null,
            seed: el.seed || Math.floor(Math.random() * 2000000000),
            version: 1,  // New elements start at version 1
            versionNonce: el.versionNonce || Math.floor(Math.random() * 2000000000),
            isDeleted: el.isDeleted || false,
            boundElements: el.boundElements || null,
            containerId: el.containerId || null,  // CRITICAL for bound text
            updated: el.updated || Date.now(),
            link: el.link || null,
            locked: el.locked || false,
            // Text-specific properties if it's a text element
            ...(el.type === 'text' ? {
              text: el.text || '',
              fontSize: el.fontSize || 20,
              fontFamily: el.fontFamily || 1,
              textAlign: el.textAlign || 'left',
              verticalAlign: el.verticalAlign || 'top'
            } : {}),
            // Preserve any additional properties
            ...el
          };
          console.log('[applyOperation] Adding element:', completeElement.id, completeElement.type, {
            x: completeElement.x,
            y: completeElement.y,
            width: completeElement.width,
            height: completeElement.height
          });
          elementMap.set(completeElement.id, completeElement);
        } else {
          console.log('[applyOperation] Element already exists:', el.id);
        }
      });
      break;

    case 'update':
      // Update existing elements - transform from Firebase format back to Excalidraw format
      const rawUpdatedElements = operation.data.elements as any[];
      
      // Debug: Log raw elements before transformation
      rawUpdatedElements.forEach(raw => {
        if (raw.type === 'text') {
          console.log('[applyOperation] RAW text element from Firebase:', {
            id: raw.id,
            text: raw.text,
            containerId: raw.containerId,
            hasText: 'text' in raw,
            allKeys: Object.keys(raw)
          });
        }
      });
      
      const updatedElements = transformElementsFromFirebase(rawUpdatedElements) as ExcalidrawElement[];
      console.log('[applyOperation] Updating', updatedElements.length, 'elements (transformed from Firebase format)');
      updatedElements.forEach(el => {
        const existing = elementMap.get(el.id);
        if (existing) {
          console.log('[applyOperation] Updating element:', el.id, {
            oldX: existing.x,
            newX: el.x,
            oldY: existing.y,
            newY: el.y
          });
        } else {
          console.log('[applyOperation] Element to update not found, adding:', el.id);
        }
        // CRITICAL FIX: Use existing element as base if it exists
        const baseElement = existing || {};
        
        // Determine if this is a text element
        const isTextElement = (el.type === 'text' || baseElement.type === 'text');
        
        // Log what we're updating
        if (isTextElement && baseElement.text) {
          console.log('[applyOperation] Updating text element:', {
            id: el.id,
            oldText: baseElement.text,
            newText: el.text,
            hasText: 'text' in el,
            oldX: baseElement.x,
            newX: el.x
          });
        }
        
        // Create a completely NEW element with updated properties
        // IMPORTANT: Only override properties that are explicitly defined in the update
        const completeElement = {
          // Start with ALL base properties (if element exists)
          ...baseElement,
          // Only override with defined properties from the update
          ...Object.fromEntries(
            Object.entries(el).filter(([key, value]) => value !== undefined)
          ),
          // Ensure critical properties are set explicitly to prevent loss
          id: el.id,
          type: el.type || baseElement.type,
          x: el.x !== undefined ? el.x : baseElement.x,
          y: el.y !== undefined ? el.y : baseElement.y,
          width: el.width !== undefined ? el.width : baseElement.width,
          height: el.height !== undefined ? el.height : baseElement.height,
          angle: el.angle !== undefined ? el.angle : baseElement.angle || 0,
          // Style properties
          strokeColor: el.strokeColor !== undefined ? el.strokeColor : baseElement.strokeColor || '#000000',
          backgroundColor: el.backgroundColor !== undefined ? el.backgroundColor : baseElement.backgroundColor || 'transparent',
          fillStyle: el.fillStyle !== undefined ? el.fillStyle : baseElement.fillStyle || 'solid',
          strokeWidth: el.strokeWidth !== undefined ? el.strokeWidth : baseElement.strokeWidth || 2,
          strokeStyle: el.strokeStyle !== undefined ? el.strokeStyle : baseElement.strokeStyle || 'solid',
          roughness: el.roughness !== undefined ? el.roughness : baseElement.roughness || 0,
          opacity: el.opacity !== undefined ? el.opacity : baseElement.opacity || 100,
          // Group and frame properties
          groupIds: el.groupIds !== undefined ? el.groupIds : baseElement.groupIds || [],
          frameId: el.frameId !== undefined ? el.frameId : baseElement.frameId || null,
          roundness: el.roundness !== undefined ? el.roundness : baseElement.roundness || null,
          // Version tracking
          seed: el.seed !== undefined ? el.seed : baseElement.seed || Math.floor(Math.random() * 2000000000),
          isDeleted: el.isDeleted !== undefined ? el.isDeleted : baseElement.isDeleted || false,
          link: el.link !== undefined ? el.link : baseElement.link || null,
          locked: el.locked !== undefined ? el.locked : baseElement.locked || false,
          // Bound element properties - CRITICAL for text in shapes
          containerId: el.containerId !== undefined ? el.containerId : baseElement.containerId || null,
          boundElements: el.boundElements !== undefined ? el.boundElements : baseElement.boundElements || null,
          // Force update timestamp
          updated: Date.now(),
          // CRITICAL: Increment version and update versionNonce for proper change detection
          version: ((baseElement.version || 0) + 1) as number,
          versionNonce: el.versionNonce || Math.floor(Math.random() * 2000000000)
        };
        
        // For text elements, ABSOLUTELY ensure text content is never lost
        if (isTextElement) {
          // The text property must NEVER be undefined or null for text elements
          if (!('text' in completeElement) || completeElement.text === undefined || completeElement.text === null) {
            completeElement.text = baseElement.text || '';
            console.warn('[applyOperation] Preserving text content from base:', {
              id: completeElement.id,
              text: completeElement.text
            });
          }
          
          // Ensure other text properties
          completeElement.fontSize = completeElement.fontSize || baseElement.fontSize || 20;
          completeElement.fontFamily = completeElement.fontFamily || baseElement.fontFamily || 1;
          completeElement.textAlign = completeElement.textAlign || baseElement.textAlign || 'left';
          completeElement.verticalAlign = completeElement.verticalAlign || baseElement.verticalAlign || 'top';
          completeElement.baseline = completeElement.baseline || baseElement.baseline || 0;
          
          // Ensure container relationship is preserved
          if (completeElement.containerId) {
            console.log('[applyOperation] Bound text element updated:', {
              id: completeElement.id,
              containerId: completeElement.containerId,
              text: completeElement.text,
              x: completeElement.x,
              y: completeElement.y
            });
          }
        }
        
        console.log('[applyOperation] Created updated element:', {
          id: completeElement.id,
          type: completeElement.type,
          x: completeElement.x,
          y: completeElement.y,
          versionNonce: completeElement.versionNonce,
          ...(isTextElement ? {
            text: completeElement.text,
            containerId: completeElement.containerId
          } : {
            boundElements: completeElement.boundElements
          })
        });
        
        elementMap.set(el.id, completeElement);
      });
      break;

    case 'delete':
      // Remove deleted elements
      console.log('[applyOperation] Deleting', operation.elementIds.length, 'elements');
      operation.elementIds.forEach(id => {
        if (elementMap.has(id)) {
          console.log('[applyOperation] Deleting element:', id);
          elementMap.delete(id);
        } else {
          console.log('[applyOperation] Element to delete not found:', id);
        }
      });
      break;

    case 'move':
      // Update positions
      operation.elementIds.forEach(id => {
        const el = elementMap.get(id);
        if (el && operation.data.deltaX !== undefined && operation.data.deltaY !== undefined) {
          elementMap.set(id, {
            ...el,
            x: el.x + operation.data.deltaX,
            y: el.y + operation.data.deltaY,
            version: (el.version || 0) + 1
          } as ExcalidrawElement);
        }
      });
      break;

    case 'resize':
      // Update size
      operation.elementIds.forEach(id => {
        const el = elementMap.get(id);
        if (el && operation.data.width !== undefined && operation.data.height !== undefined) {
          elementMap.set(id, {
            ...el,
            width: operation.data.width,
            height: operation.data.height,
            version: (el.version || 0) + 1
          } as ExcalidrawElement);
        }
      });
      break;

    case 'style':
      // Update styling
      operation.elementIds.forEach(id => {
        const el = elementMap.get(id);
        if (el) {
          elementMap.set(id, {
            ...el,
            ...operation.data.styles,
            version: (el.version || 0) + 1
          } as ExcalidrawElement);
        }
      });
      break;
  }

  // Convert map back to array - preserve original order
  const result = Array.from(elementMap.values());
  
  console.log('[applyOperation] ✅ COMPLETED:', {
    startElements: elements.length,
    endElements: result.length,
    difference: result.length - elements.length,
    operationType: operation.type
  });
  
  // Log a sample of the result
  if (result.length > 0 && result.length !== elements.length) {
    const lastElement = result[result.length - 1];
    console.log('[applyOperation] 📊 Last element in result:', {
      id: lastElement.id,
      type: lastElement.type,
      x: lastElement.x,
      y: lastElement.y,
      hasAllProps: !!(
        lastElement.id &&
        lastElement.type &&
        typeof lastElement.x === 'number' &&
        typeof lastElement.y === 'number'
      )
    });
  }
  
  return result;
}

/**
 * Merges remote elements with local elements, handling conflicts
 */
export function mergeElements(
  localElements: ExcalidrawElement[],
  remoteElements: ExcalidrawElement[],
  conflictStrategy: 'local' | 'remote' | 'merge' = 'merge'
): ExcalidrawElement[] {
  const localMap = new Map(localElements.map(el => [el.id, el]));
  const remoteMap = new Map(remoteElements.map(el => [el.id, el]));
  const merged = new Map<string, ExcalidrawElement>();

  // Process all unique element IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  allIds.forEach(id => {
    const localEl = localMap.get(id);
    const remoteEl = remoteMap.get(id);

    if (!localEl && remoteEl) {
      // Element only exists remotely
      merged.set(id, remoteEl);
    } else if (localEl && !remoteEl) {
      // Element only exists locally
      merged.set(id, localEl);
    } else if (localEl && remoteEl) {
      // Element exists in both - apply conflict strategy
      switch (conflictStrategy) {
        case 'local':
          merged.set(id, localEl);
          break;
        case 'remote':
          merged.set(id, remoteEl);
          break;
        case 'merge':
          // Use version comparison if available, otherwise use remote
          if ('version' in localEl && 'version' in remoteEl) {
            merged.set(id, localEl.version > remoteEl.version ? localEl : remoteEl);
          } else {
            merged.set(id, remoteEl);
          }
          break;
      }
    }
  });

  return Array.from(merged.values());
}

/**
 * Throttles function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    }
  };
}