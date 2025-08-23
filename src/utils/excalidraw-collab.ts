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
  console.log('[detectChanges] 🔎 DETECTING CHANGES:', {
    oldCount: oldElements.length,
    newCount: newElements.length,
    difference: newElements.length - oldElements.length
  });
  
  // Log sample elements for debugging
  if (newElements.length > oldElements.length && newElements.length > 0) {
    const lastNew = newElements[newElements.length - 1];
    console.log('[detectChanges] Potential new element:', {
      id: lastNew.id,
      type: lastNew.type,
      x: lastNew.x,
      y: lastNew.y
    });
  }
  
  const oldMap = new Map(oldElements.map(el => [el.id, el]));
  const newMap = new Map(newElements.map(el => [el.id, el]));

  const added: ExcalidrawElement[] = [];
  const updated: ExcalidrawElement[] = [];
  const deleted: string[] = [];

  // Find added and updated elements
  newElements.forEach(newEl => {
    const oldEl = oldMap.get(newEl.id);
    if (!oldEl) {
      console.log('[detectChanges] Element added:', newEl.id, newEl.type);
      added.push(newEl);
    } else if (hasElementChanged(oldEl, newEl)) {
      console.log('[detectChanges] Element updated:', newEl.id, {
        oldVersion: (oldEl as any).version,
        newVersion: (newEl as any).version,
        type: newEl.type
      });
      updated.push(newEl);
    }
  });

  // Find deleted elements
  oldElements.forEach(oldEl => {
    if (!newMap.has(oldEl.id)) {
      console.log('[detectChanges] Element deleted:', oldEl.id);
      deleted.push(oldEl.id);
    }
  });

  console.log('[detectChanges] Results:', {
    added: added.length,
    updated: updated.length,
    deleted: deleted.length
  });

  return { added, updated, deleted };
}

/**
 * Checks if an element has changed
 */
function hasElementChanged(oldEl: ExcalidrawElement, newEl: ExcalidrawElement): boolean {
  // DEEP LOG: Show actual values for debugging
  const deepComparison = {
    id: oldEl.id,
    type: oldEl.type,
    oldX: oldEl.x,
    newX: newEl.x,
    xChanged: oldEl.x !== newEl.x,
    oldY: oldEl.y,
    newY: newEl.y,
    yChanged: oldEl.y !== newEl.y,
    oldVersionNonce: (oldEl as any).versionNonce,
    newVersionNonce: (newEl as any).versionNonce,
    versionNonceChanged: (oldEl as any).versionNonce !== (newEl as any).versionNonce,
    sameObjectReference: oldEl === newEl
  };
  
  console.log('[hasElementChanged] DEEP COMPARISON:', deepComparison);
  
  // Check versionNonce first (Excalidraw uses this for change tracking)
  if ('versionNonce' in oldEl && 'versionNonce' in newEl) {
    const versionNonceChanged = (oldEl as any).versionNonce !== (newEl as any).versionNonce;
    if (versionNonceChanged) {
      console.log('[hasElementChanged] ✅ VersionNonce changed:', {
        id: oldEl.id,
        oldVersionNonce: (oldEl as any).versionNonce,
        newVersionNonce: (newEl as any).versionNonce
      });
      return true;
    }
  }
  
  // Check version if available
  if ('version' in oldEl && 'version' in newEl) {
    const versionChanged = oldEl.version !== newEl.version;
    if (versionChanged) {
      console.log('[hasElementChanged] ✅ Version changed:', {
        id: oldEl.id,
        oldVersion: oldEl.version,
        newVersion: newEl.version
      });
      return true;
    }
  }

  // If no version tracking, compare all properties
  // Check key properties and also 'updated' timestamp
  const propsToCheck = ['x', 'y', 'width', 'height', 'angle', 'strokeColor', 
                        'backgroundColor', 'fillStyle', 'strokeWidth', 'roughness',
                        'opacity', 'text', 'fontSize', 'fontFamily', 'points',
                        'lastCommittedPoint', 'startBinding', 'endBinding', 'updated'];

  const changedProps: string[] = [];
  propsToCheck.forEach(prop => {
    const oldVal = (oldEl as any)[prop];
    const newVal = (newEl as any)[prop];
    
    // Special handling for arrays (like points)
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedProps.push(`${prop}: [array changed]`);
      }
    } else if (oldVal !== newVal) {
      changedProps.push(`${prop}: ${oldVal} → ${newVal}`);
    }
  });
  
  if (changedProps.length > 0) {
    console.log('[hasElementChanged] ✅ Props changed:', {
      id: oldEl.id,
      type: oldEl.type,
      changes: changedProps
    });
    return true;
  }
  
  // No changes detected
  console.log('[hasElementChanged] ❌ No changes for element:', oldEl.id);
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
 */
export function changesToOperations(changes: ExcalidrawChange): CanvasOperation[] {
  console.log('[changesToOperations] Converting changes to operations:', {
    added: changes.added.length,
    updated: changes.updated.length,
    deleted: changes.deleted.length
  });
  
  const operations: Omit<CanvasOperation, 'userId' | 'clientId' | 'timestamp'>[] = [];

  if (changes.added.length > 0) {
    console.log('[changesToOperations] Creating ADD operation for', changes.added.length, 'elements');
    // Transform elements to Firebase format before sending
    const transformedElements = transformElementsForFirebase(changes.added);
    operations.push({
      type: 'add',
      elementIds: changes.added.map(el => el.id),
      data: { elements: transformedElements.map(el => cleanElementForFirebase(el)) }
    });
  }

  if (changes.updated.length > 0) {
    console.log('[changesToOperations] Creating UPDATE operation for', changes.updated.length, 'elements');
    // Transform elements to Firebase format before sending
    const transformedElements = transformElementsForFirebase(changes.updated);
    operations.push({
      type: 'update',
      elementIds: changes.updated.map(el => el.id),
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
            updated: el.updated || Date.now(),
            link: el.link || null,
            locked: el.locked || false,
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
        // CRITICAL FIX: Don't spread baseElement/el at the end - it overwrites our updates!
        const baseElement = existing || {};
        
        // Create a completely NEW element with updated properties
        const completeElement = {
          // Start with base properties
          ...baseElement,
          // Override with ALL properties from the update (these are the new values!)
          ...el,
          // Ensure critical properties are set
          id: el.id,
          type: el.type || baseElement.type,
          x: el.x !== undefined ? el.x : baseElement.x,
          y: el.y !== undefined ? el.y : baseElement.y,
          width: el.width !== undefined ? el.width : baseElement.width,
          height: el.height !== undefined ? el.height : baseElement.height,
          // Text properties
          text: el.text !== undefined ? el.text : baseElement.text,
          fontSize: el.fontSize !== undefined ? el.fontSize : baseElement.fontSize,
          fontFamily: el.fontFamily !== undefined ? el.fontFamily : baseElement.fontFamily,
          textAlign: el.textAlign !== undefined ? el.textAlign : baseElement.textAlign,
          verticalAlign: el.verticalAlign !== undefined ? el.verticalAlign : baseElement.verticalAlign,
          // Force update timestamp
          updated: Date.now(),
          // CRITICAL: Increment version and update versionNonce for proper change detection
          version: ((baseElement.version || 0) + 1) as number,
          versionNonce: el.versionNonce || Math.floor(Math.random() * 2000000000)
        };
        
        console.log('[applyOperation] Created updated element:', {
          id: completeElement.id,
          x: completeElement.x,
          y: completeElement.y,
          versionNonce: completeElement.versionNonce
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