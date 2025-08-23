/**
 * Version information utilities for the application
 * Provides access to build-time generated version information
 */

export interface VersionInfo {
  version: string;           // Display version (tag for releases, package.json for dev)
  packageVersion: string;    // Version from package.json
  commit: string;            // Git commit hash (short)
  commitMessage: string;     // Git commit message
  branch: string;            // Git branch name
  isRelease: boolean;        // Whether this is a release build
  tag: string | null;        // Git tag (if release)
  buildNumber: number;       // Build identifier (timestamp)
  buildDate: string;         // ISO date when built
  environment: string;       // Build environment
  generatedAt: string;       // When version.json was generated
  nodeVersion: string;       // Node.js version used for build
  platform: string;         // Platform where built
}

/**
 * Default version info when version.json is not available
 */
const DEFAULT_VERSION_INFO: VersionInfo = {
  version: '0.0.0-dev',
  packageVersion: '0.0.0',
  commit: 'unknown',
  commitMessage: 'No version information available',
  branch: 'unknown',
  isRelease: false,
  tag: null,
  buildNumber: 0,
  buildDate: new Date().toISOString(),
  environment: 'development',
  generatedAt: new Date().toISOString(),
  nodeVersion: 'unknown',
  platform: 'unknown'
};

/**
 * Loads version information from generated version.json file
 * Falls back to default values if file is not available
 */
export function getVersionInfo(): VersionInfo {
  try {
    // In Next.js, we need to handle this differently for client vs server
    if (typeof window !== 'undefined') {
      // Client-side: version info should be provided by server component or API
      const versionElement = document.getElementById('version-info');
      if (versionElement && versionElement.textContent) {
        return JSON.parse(versionElement.textContent);
      }
      return DEFAULT_VERSION_INFO;
    } else {
      // Server-side: directly read the generated file
      const versionData = require('./version.json');
      return versionData as VersionInfo;
    }
  } catch (error) {
    console.warn('Version information not available, using defaults:', error);
    return DEFAULT_VERSION_INFO;
  }
}

/**
 * Gets a formatted version string suitable for display
 */
export function getDisplayVersion(): string {
  const info = getVersionInfo();
  
  if (info.isRelease) {
    return `${info.version} (${info.commit})`;
  } else {
    return `${info.version}-dev (${info.commit})`;
  }
}

/**
 * Gets a short version string (just the version number)
 */
export function getShortVersion(): string {
  const info = getVersionInfo();
  return info.version;
}

/**
 * Gets build information string
 */
export function getBuildInfo(): string {
  const info = getVersionInfo();
  const date = new Date(info.buildDate).toLocaleDateString();
  return `Built ${date} on ${info.environment}`;
}

/**
 * Checks if this is a release build
 */
export function isRelease(): boolean {
  const info = getVersionInfo();
  return info.isRelease;
}

/**
 * Gets the environment this was built for
 */
export function getEnvironment(): string {
  const info = getVersionInfo();
  return info.environment;
}

/**
 * Gets full version details for debugging
 */
export function getFullVersionInfo(): string {
  const info = getVersionInfo();
  return JSON.stringify(info, null, 2);
}

/**
 * Component for embedding version info in HTML (for client-side hydration)
 */
export function VersionInfoScript() {
  const info = getVersionInfo();
  
  return (
    <script
      id="version-info"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(info)
      }}
    />
  );
}

/**
 * Hook for using version info in React components
 */
export function useVersionInfo(): VersionInfo {
  if (typeof window !== 'undefined') {
    // Client-side
    const versionElement = document.getElementById('version-info');
    if (versionElement && versionElement.textContent) {
      try {
        return JSON.parse(versionElement.textContent);
      } catch (error) {
        console.warn('Failed to parse version info from DOM:', error);
      }
    }
  }
  
  return DEFAULT_VERSION_INFO;
}

// Re-export the type for convenience
export type { VersionInfo };