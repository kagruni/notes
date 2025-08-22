/**
 * Collaboration configuration constants
 */

export const COLLABORATION_CONFIG = {
  // Feature flags
  features: {
    realTimeSync: true,
    cursorSharing: true,
    chatEnabled: true,
    voiceNotes: false, // Future feature
    videoCall: false,  // Future feature
    versionHistory: true,
    conflictResolution: true,
    offlineMode: false // Future feature
  },

  // Performance thresholds
  performance: {
    maxActiveUsers: 50,
    cursorUpdateInterval: 50, // ms
    contentSaveDebounce: 1000, // ms
    chatMessageLimit: 50,
    viewportPadding: 100, // px
    batchSize: 10,
    batchDelay: 100, // ms
    connectionTimeout: 30000, // ms
    reconnectDelay: 1000, // ms
    maxReconnectAttempts: 5
  },

  // Rate limiting
  rateLimits: {
    cursorUpdates: {
      max: 60,
      window: 1000 // 60 updates per second
    },
    chatMessages: {
      max: 30,
      window: 60000 // 30 messages per minute
    },
    contentSaves: {
      max: 10,
      window: 60000 // 10 saves per minute
    },
    inviteGeneration: {
      max: 10,
      window: 3600000 // 10 invites per hour
    }
  },

  // Security settings
  security: {
    maxMessageLength: 500,
    maxCanvasSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    inviteLinkExpiry: {
      default: 7 * 24 * 60 * 60 * 1000, // 7 days
      min: 1 * 60 * 60 * 1000, // 1 hour
      max: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  },

  // UI settings
  ui: {
    cursorLabelTimeout: 3000, // ms - hide label after inactivity
    chatNotificationDuration: 5000, // ms
    connectionIndicatorDelay: 1000, // ms - delay before showing connection status
    animationDuration: 200, // ms
    toastDuration: 3000, // ms
    modalTransitionDuration: 150 // ms
  },

  // Collaboration roles
  roles: {
    viewer: {
      canView: true,
      canEdit: false,
      canComment: true,
      canShare: false,
      canDelete: false,
      canExport: true
    },
    editor: {
      canView: true,
      canEdit: true,
      canComment: true,
      canShare: false,
      canDelete: false,
      canExport: true
    },
    admin: {
      canView: true,
      canEdit: true,
      canComment: true,
      canShare: true,
      canDelete: false,
      canExport: true
    },
    owner: {
      canView: true,
      canEdit: true,
      canComment: true,
      canShare: true,
      canDelete: true,
      canExport: true
    }
  },

  // User colors for cursors and labels
  userColors: [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#48C9B0', // Turquoise
    '#6C5CE7', // Purple
    '#A29BFE', // Light Purple
    '#FD79A8', // Pink
    '#FDCB6E', // Orange
    '#6C63FF', // Indigo
    '#00B894', // Mint
    '#E17055', // Coral
    '#74B9FF', // Sky Blue
    '#A29BFE', // Lavender
    '#55A3FF'  // Ocean Blue
  ],

  // Firebase paths
  firebase: {
    collections: {
      canvases: 'canvases',
      invites: 'invites',
      presence: 'presence',
      sessions: 'sessions',
      activities: 'activities'
    },
    subcollections: {
      versions: 'versions',
      comments: 'comments',
      attachments: 'attachments'
    }
  },

  // WebSocket configuration (for future real-time enhancements)
  websocket: {
    enabled: false,
    url: process.env.NEXT_PUBLIC_WS_URL || '',
    reconnectInterval: 5000,
    heartbeatInterval: 30000,
    messageQueueSize: 100
  },

  // Analytics events
  analytics: {
    events: {
      COLLABORATION_START: 'collaboration_start',
      COLLABORATION_END: 'collaboration_end',
      INVITE_GENERATED: 'invite_generated',
      INVITE_ACCEPTED: 'invite_accepted',
      USER_JOINED: 'user_joined',
      USER_LEFT: 'user_left',
      CONTENT_SAVED: 'content_saved',
      CONFLICT_RESOLVED: 'conflict_resolved',
      CHAT_MESSAGE_SENT: 'chat_message_sent',
      PERMISSION_CHANGED: 'permission_changed'
    }
  },

  // Error messages
  errors: {
    RATE_LIMIT: 'Too many requests. Please try again later.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    CANVAS_NOT_FOUND: 'Canvas not found or has been deleted.',
    INVALID_INVITE: 'This invite link is invalid or has expired.',
    SESSION_EXPIRED: 'Your session has expired. Please refresh the page.',
    CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
    SYNC_FAILED: 'Failed to sync changes. Your work has been saved locally.',
    USER_LIMIT: 'Maximum number of active users reached.',
    CONTENT_TOO_LARGE: 'Canvas content exceeds maximum size limit.'
  },

  // Success messages
  messages: {
    INVITE_COPIED: 'Invite link copied to clipboard!',
    INVITE_SENT: 'Invite sent successfully!',
    USER_ADDED: 'User added as collaborator.',
    USER_REMOVED: 'User removed from canvas.',
    CHANGES_SAVED: 'Changes saved successfully.',
    CONNECTED: 'Connected to collaboration session.',
    DISCONNECTED: 'Disconnected from collaboration session.',
    PERMISSION_UPDATED: 'Permissions updated successfully.'
  }
};

// Helper functions
export function getRolePermissions(role: keyof typeof COLLABORATION_CONFIG.roles) {
  return COLLABORATION_CONFIG.roles[role] || COLLABORATION_CONFIG.roles.viewer;
}

export function getUserColor(index: number): string {
  const colors = COLLABORATION_CONFIG.userColors;
  return colors[index % colors.length];
}

export function getInviteExpiryOptions() {
  return [
    { value: 1, label: '1 hour', ms: 1 * 60 * 60 * 1000 },
    { value: 24, label: '24 hours', ms: 24 * 60 * 60 * 1000 },
    { value: 7 * 24, label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
    { value: 30 * 24, label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 }
  ];
}

export function isFeatureEnabled(feature: keyof typeof COLLABORATION_CONFIG.features): boolean {
  return COLLABORATION_CONFIG.features[feature] || false;
}

export function getRateLimit(action: keyof typeof COLLABORATION_CONFIG.rateLimits) {
  return COLLABORATION_CONFIG.rateLimits[action];
}

export default COLLABORATION_CONFIG;