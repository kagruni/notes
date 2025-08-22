import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { CanvasOperation } from '@/services/operations';

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
      updated.push(newEl);
    }
  });

  // Find deleted elements
  oldElements.forEach(oldEl => {
    if (!newMap.has(oldEl.id)) {
      deleted.push(oldEl.id);
    }
  });

  return { added, updated, deleted };
}

/**
 * Checks if an element has changed
 */
function hasElementChanged(oldEl: ExcalidrawElement, newEl: ExcalidrawElement): boolean {
  // Check version if available
  if ('version' in oldEl && 'version' in newEl) {
    return oldEl.version !== newEl.version;
  }

  // Check key properties
  const propsToCheck = ['x', 'y', 'width', 'height', 'angle', 'strokeColor', 
                        'backgroundColor', 'fillStyle', 'strokeWidth', 'roughness',
                        'opacity', 'text', 'fontSize', 'fontFamily'];

  return propsToCheck.some(prop => {
    const oldVal = (oldEl as any)[prop];
    const newVal = (newEl as any)[prop];
    return oldVal !== newVal;
  });
}

/**
 * Converts Excalidraw changes to canvas operations
 */
export function changesToOperations(changes: ExcalidrawChange): CanvasOperation[] {
  const operations: Omit<CanvasOperation, 'userId' | 'clientId' | 'timestamp'>[] = [];

  if (changes.added.length > 0) {
    operations.push({
      type: 'add',
      elementIds: changes.added.map(el => el.id),
      data: { elements: changes.added }
    });
  }

  if (changes.updated.length > 0) {
    operations.push({
      type: 'update',
      elementIds: changes.updated.map(el => el.id),
      data: { elements: changes.updated }
    });
  }

  if (changes.deleted.length > 0) {
    operations.push({
      type: 'delete',
      elementIds: changes.deleted,
      data: { elementIds: changes.deleted }
    });
  }

  return operations as CanvasOperation[];
}

/**
 * Applies a canvas operation to Excalidraw elements
 */
export function applyOperation(
  elements: ExcalidrawElement[],
  operation: CanvasOperation
): ExcalidrawElement[] {
  const elementMap = new Map(elements.map(el => [el.id, el]));

  switch (operation.type) {
    case 'add':
      // Add new elements
      const newElements = operation.data.elements as ExcalidrawElement[];
      newElements.forEach(el => {
        if (!elementMap.has(el.id)) {
          elementMap.set(el.id, el);
        }
      });
      break;

    case 'update':
      // Update existing elements
      const updatedElements = operation.data.elements as ExcalidrawElement[];
      updatedElements.forEach(el => {
        elementMap.set(el.id, el);
      });
      break;

    case 'delete':
      // Remove deleted elements
      operation.elementIds.forEach(id => {
        elementMap.delete(id);
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

  return Array.from(elementMap.values());
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