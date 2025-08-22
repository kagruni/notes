/**
 * Security utilities for canvas collaboration
 */

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate and sanitize chat messages
 */
export function sanitizeChatMessage(message: string): string {
  // Remove any HTML tags
  const stripped = message.replace(/<[^>]*>/g, '');
  
  // Limit message length
  const maxLength = 500;
  const trimmed = stripped.substring(0, maxLength);
  
  // Remove any control characters except newlines
  const cleaned = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return cleaned.trim();
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  checkLimit(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }
    
    if (record.count >= this.maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

/**
 * Permission validation utilities
 */
export interface CanvasPermissions {
  canView: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}

export function validatePermissions(
  userId: string,
  canvas: {
    userId: string;
    collaborators?: Array<{
      userId: string;
      role: 'viewer' | 'editor' | 'admin';
    }>;
  }
): CanvasPermissions {
  // Owner has full permissions
  if (canvas.userId === userId) {
    return {
      canView: true,
      canEdit: true,
      canShare: true,
      canDelete: true
    };
  }
  
  // Check collaborator permissions
  const collaborator = canvas.collaborators?.find(c => c.userId === userId);
  
  if (!collaborator) {
    return {
      canView: false,
      canEdit: false,
      canShare: false,
      canDelete: false
    };
  }
  
  switch (collaborator.role) {
    case 'admin':
      return {
        canView: true,
        canEdit: true,
        canShare: true,
        canDelete: false
      };
    case 'editor':
      return {
        canView: true,
        canEdit: true,
        canShare: false,
        canDelete: false
      };
    case 'viewer':
      return {
        canView: true,
        canEdit: false,
        canShare: false,
        canDelete: false
      };
    default:
      return {
        canView: false,
        canEdit: false,
        canShare: false,
        canDelete: false
      };
  }
}

/**
 * Audit logging utilities
 */
export interface AuditLog {
  userId: string;
  action: string;
  resourceId: string;
  resourceType: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private logs: AuditLog[] = [];
  private maxLogs = 1000;
  
  log(entry: Omit<AuditLog, 'timestamp'>): void {
    const log: AuditLog = {
      ...entry,
      timestamp: Date.now()
    };
    
    this.logs.push(log);
    
    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // In production, this would send to a logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(log);
    }
  }
  
  private sendToLoggingService(log: AuditLog): void {
    // Implementation would send to actual logging service
    console.log('[Audit]', log);
  }
  
  getRecentLogs(count: number = 100): AuditLog[] {
    return this.logs.slice(-count);
  }
  
  clear(): void {
    this.logs = [];
  }
}

/**
 * Input validation utilities
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateCanvasId(id: string): boolean {
  // Allow alphanumeric and hyphens, 20-40 chars
  const idRegex = /^[a-zA-Z0-9-]{20,40}$/;
  return idRegex.test(id);
}

export function validateUserId(id: string): boolean {
  // Firebase UIDs are typically 28 characters
  const idRegex = /^[a-zA-Z0-9]{20,40}$/;
  return idRegex.test(id);
}

/**
 * Content Security Policy headers for collaboration
 */
export function getCSPHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: https://firebaseapp.com https://firebaseio.com",
      "font-src 'self' data:",
      "frame-src 'self' https://accounts.google.com"
    ].join('; ')
  };
}

/**
 * Token generation and validation
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

export function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  return crypto.subtle.digest('SHA-256', data).then(buffer => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}