/**
 * Version Information for CRM System
 * Tracks website version and security patch version
 */

export interface VersionInfo {
  website: {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    buildDate: string;
    buildNumber: string;
  };
  security: {
    major: number;
    minor: number;
    patch: number;
    lastPatched: string;
    criticalPatches: number;
  };
  dependencies: {
    react: string;
    typescript: string;
    vite: string;
    mongodb: string;
  };
}

// Current version information
export const VERSION_INFO: VersionInfo = {
  website: {
    major: 2,
    minor: 1,
    patch: 0,
    buildDate: '2026-02-11',
    buildNumber: 'BUILD-20260211-001'
  },
  security: {
    major: 1,
    minor: 2,
    patch: 0,
    lastPatched: '2026-02-11',
    criticalPatches: 2
  },
  dependencies: {
    react: '19.1.1',
    typescript: '5.9.3',
    vite: '7.1.7',
    mongodb: '7.0.0'
  }
};

/**
 * Format version as semantic version string (e.g., "2.1.0")
 */
export const formatVersion = (major: number, minor: number, patch: number, prerelease?: string): string => {
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
};

/**
 * Get full version string
 */
export const getFullVersion = (): string => {
  return `v${formatVersion(VERSION_INFO.website.major, VERSION_INFO.website.minor, VERSION_INFO.website.patch)}`;
};

/**
 * Get security version string
 */
export const getSecurityVersion = (): string => {
  return formatVersion(VERSION_INFO.security.major, VERSION_INFO.security.minor, VERSION_INFO.security.patch);
};

/**
 * Get build identifier
 */
export const getBuildInfo = (): string => {
  return `${VERSION_INFO.website.buildNumber} (${VERSION_INFO.website.buildDate})`;
};
