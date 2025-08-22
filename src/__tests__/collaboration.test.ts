/**
 * Unit tests for collaboration service
 */

import { collaborationService } from '@/services/collaborationService';
import { 
  validatePermissions, 
  sanitizeChatMessage,
  RateLimiter,
  validateEmail,
  validateCanvasId,
  generateSecureToken
} from '@/utils/security';
import {
  debounce,
  throttle,
  ConflictDetector,
  BatchProcessor,
  isCursorInViewport,
  getVisibleCollaborators
} from '@/utils/performance';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  deleteField: jest.fn()
}));

describe('CollaborationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permission Validation', () => {
    it('should grant full permissions to owner', () => {
      const permissions = validatePermissions('user1', {
        userId: 'user1',
        collaborators: []
      });

      expect(permissions).toEqual({
        canView: true,
        canEdit: true,
        canShare: true,
        canDelete: true
      });
    });

    it('should grant appropriate permissions to collaborators', () => {
      const canvas = {
        userId: 'owner',
        collaborators: [
          { userId: 'editor1', role: 'editor' as const },
          { userId: 'viewer1', role: 'viewer' as const },
          { userId: 'admin1', role: 'admin' as const }
        ]
      };

      const editorPerms = validatePermissions('editor1', canvas);
      expect(editorPerms.canEdit).toBe(true);
      expect(editorPerms.canShare).toBe(false);

      const viewerPerms = validatePermissions('viewer1', canvas);
      expect(viewerPerms.canView).toBe(true);
      expect(viewerPerms.canEdit).toBe(false);

      const adminPerms = validatePermissions('admin1', canvas);
      expect(adminPerms.canShare).toBe(true);
      expect(adminPerms.canDelete).toBe(false);
    });

    it('should deny all permissions to non-collaborators', () => {
      const permissions = validatePermissions('stranger', {
        userId: 'owner',
        collaborators: []
      });

      expect(permissions).toEqual({
        canView: false,
        canEdit: false,
        canShare: false,
        canDelete: false
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize chat messages', () => {
      const malicious = '<script>alert("xss")</script>Hello';
      const sanitized = sanitizeChatMessage(malicious);
      expect(sanitized).toBe('Hello');
    });

    it('should limit message length', () => {
      const longMessage = 'a'.repeat(600);
      const sanitized = sanitizeChatMessage(longMessage);
      expect(sanitized.length).toBeLessThanOrEqual(500);
    });

    it('should remove control characters', () => {
      const withControl = 'Hello\x00World\x1F';
      const sanitized = sanitizeChatMessage(withControl);
      expect(sanitized).toBe('HelloWorld');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      const limiter = new RateLimiter(3, 1000);
      const key = 'test-user';

      expect(limiter.checkLimit(key)).toBe(true);
      expect(limiter.checkLimit(key)).toBe(true);
      expect(limiter.checkLimit(key)).toBe(true);
      expect(limiter.checkLimit(key)).toBe(false); // Should be rate limited
    });

    it('should reset after window expires', (done) => {
      const limiter = new RateLimiter(1, 100);
      const key = 'test-user';

      expect(limiter.checkLimit(key)).toBe(true);
      expect(limiter.checkLimit(key)).toBe(false);

      setTimeout(() => {
        expect(limiter.checkLimit(key)).toBe(true);
        done();
      }, 150);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect version conflicts', () => {
      const detector = new ConflictDetector();
      
      const local = {
        data: { content: 'local' },
        version: 1,
        timestamp: 1000
      };

      const remote = {
        data: { content: 'remote' },
        version: 2,
        timestamp: 2000
      };

      expect(detector.detectConflict(local, remote)).toBe(true);
    });

    it('should resolve conflicts with custom resolver', () => {
      const detector = new ConflictDetector();
      
      const local = {
        data: { content: 'local' },
        version: 1,
        timestamp: 1000
      };

      const remote = {
        data: { content: 'remote' },
        version: 2,
        timestamp: 2000
      };

      const resolved = detector.resolveConflict(
        local,
        remote,
        (l, r) => ({ content: 'merged' })
      );

      expect(resolved.data.content).toBe('merged');
      expect(resolved.version).toBe(3);
    });
  });

  describe('Viewport Culling', () => {
    it('should identify cursors in viewport', () => {
      const viewport = { left: 0, top: 0, right: 100, bottom: 100 };
      
      expect(isCursorInViewport({ x: 50, y: 50 }, viewport)).toBe(true);
      expect(isCursorInViewport({ x: 150, y: 50 }, viewport)).toBe(false);
      expect(isCursorInViewport({ x: 50, y: 150 }, viewport)).toBe(false);
    });

    it('should filter visible collaborators', () => {
      const viewport = { left: 0, top: 0, right: 100, bottom: 100 };
      const collaborators = [
        { userId: '1', cursor: { x: 50, y: 50 }, name: 'User1', email: '', isActive: true, lastSeen: 0, color: '#000' },
        { userId: '2', cursor: { x: 150, y: 50 }, name: 'User2', email: '', isActive: true, lastSeen: 0, color: '#000' },
        { userId: '3', cursor: { x: 75, y: 75 }, name: 'User3', email: '', isActive: true, lastSeen: 0, color: '#000' }
      ];

      const visible = getVisibleCollaborators(collaborators, viewport);
      expect(visible).toHaveLength(2);
      expect(visible[0].userId).toBe('1');
      expect(visible[1].userId).toBe('3');
    });
  });

  describe('Batch Processing', () => {
    it('should batch operations', async () => {
      const processed: number[][] = [];
      const processor = new BatchProcessor<number>(
        async (batch) => {
          processed.push([...batch]);
        },
        { batchSize: 3, delay: 10 }
      );

      processor.add(1);
      processor.add(2);
      processor.add(3);
      processor.add(4);

      await processor.flush();

      expect(processed).toHaveLength(2);
      expect(processed[0]).toEqual([1, 2, 3]);
      expect(processed[1]).toEqual([4]);
    });
  });

  describe('Input Validation', () => {
    it('should validate email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('no@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
    });

    it('should validate canvas IDs', () => {
      expect(validateCanvasId('abc123-def456-789012345678')).toBe(true);
      expect(validateCanvasId('short')).toBe(false);
      expect(validateCanvasId('invalid@chars')).toBe(false);
    });

    it('should generate secure tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).toHaveLength(32);
      expect(token2).toHaveLength(32);
      expect(token1).not.toBe(token2);
    });
  });

  describe('Debounce and Throttle', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });
});