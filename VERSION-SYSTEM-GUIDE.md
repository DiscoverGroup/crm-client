# Version Information System

## Overview

The CRM system now includes a comprehensive version tracking system that displays both website version and security patch version. This information is accessible through the admin panel and displayed in the footer.

## Components

### 1. Version Configuration (`src/config/version.ts`)

Central location for all version information:

```typescript
export interface VersionInfo {
  website: {
    major: number;
    minor: number;
    patch: number;
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
```

**Current Versions:**
- Website: v2.1.0 (BUILD-20260211-001)
- Security: v1.2.0 (2 Critical Patches Applied)
- Build Date: February 11, 2026

### 2. Helper Functions

#### `getFullVersion(): string`
Returns formatted website version (e.g., "v2.1.0")

#### `getSecurityVersion(): string`
Returns formatted security version (e.g., "1.2.0")

#### `getBuildInfo(): string`
Returns build identifier and date (e.g., "BUILD-20260211-001 (2026-02-11)")

#### `formatVersion(major, minor, patch, prerelease?): string`
Generic version formatter supporting semantic versioning

### 3. UI Components

#### Admin Panel - Version Info Tab

New tab added to the admin panel (`src/components/AdminPanel.tsx`) displaying:

- **Website Version Card** (Blue)
  - Current version
  - Build number and date
  - Formatted release date

- **Security Patch Version Card** (Green)
  - Current security patch version
  - Last patched date
  - Number of critical patches applied

- **Dependencies Card** (Purple)
  - React version
  - TypeScript version
  - Vite version
  - MongoDB version

- **System Status Section** (Light Blue)
  - API status
  - Database connection status
  - Security status

#### Footer Version Display

Updated footer (`src/components/Footer.tsx`) shows:

```
Website: v2.1.0 • Security: v1.2.0 • BUILD-20260211-001 (2026-02-11)
```

## How to Update Versions

### Update Website Version

Edit `src/config/version.ts`:

```typescript
export const VERSION_INFO: VersionInfo = {
  website: {
    major: 2,      // Major version (breaking changes)
    minor: 2,      // Minor version (new features)
    patch: 0,      // Patch version (bug fixes)
    buildDate: '2026-02-11',
    buildNumber: 'BUILD-20260211-002'  // Increment build number
  },
  // ... rest of config
};
```

### Update Security Patch Version

When applying security patches:

```typescript
security: {
  major: 1,
  minor: 2,
  patch: 1,  // Increment patch for bug fixes
  lastPatched: '2026-02-11',
  criticalPatches: 3  // Increment when applying critical patches
},
```

### Update Dependencies

When upgrading packages:

```typescript
dependencies: {
  react: '19.1.2',      // Updated after package upgrade
  typescript: '5.9.4',
  vite: '7.1.8',
  mongodb: '7.0.1'
},
```

## Semantic Versioning

The system follows **Semantic Versioning (SemVer)**:

- **MAJOR** (e.g., 2.x.x): Breaking changes, significant features
- **MINOR** (e.g., x.1.x): New features, backwards compatible
- **PATCH** (e.g., x.x.0): Bug fixes, patches, no new features

### Example Progression:

1. Initial release: v1.0.0
2. Add feature: v1.1.0
3. Fix bug: v1.1.1
4. Add major feature: v2.0.0
5. Add security patch: v2.0.1

## Security Patch Tracking

The security section tracks:

- **Security Version**: Separate versioning for security-specific updates
- **Last Patched**: Date of the last security update
- **Critical Patches**: Count of critical security issues resolved

### Security Patch Types:

- **Critical** (0-day, RCE, Auth bypass): Patch version increment
- **High** (SQL injection, XSS): Patch version increment
- **Medium** (Information disclosure): Minor version increment
- **Low** (Best practices): Minor version increment

## Accessing Version Info

### For Admins

1. Login to admin panel
2. Click "ℹ️ Version Info" tab
3. View all version and system information

### For Users

1. Check footer at bottom of page
2. Shows website version, security version, and build info

### Programmatically

```typescript
import { 
  getFullVersion, 
  getSecurityVersion, 
  getBuildInfo,
  VERSION_INFO 
} from '../config/version';

console.log(getFullVersion());        // "v2.1.0"
console.log(getSecurityVersion());    // "1.2.0"
console.log(getBuildInfo());          // "BUILD-20260211-001 (2026-02-11)"
console.log(VERSION_INFO.website);    // Full website info
console.log(VERSION_INFO.security);   // Full security info
```

## API Integration (Future)

Version info can be exposed via API endpoint:

```typescript
// GET /api/system/version
{
  "website": { /* ... */ },
  "security": { /* ... */ },
  "dependencies": { /* ... */ },
  "status": "healthy"
}
```

## Deployment Checklist

Before deploying a new version:

1. ✅ Update `VERSION_INFO` in `src/config/version.ts`
2. ✅ Update `package.json` version field
3. ✅ Update `buildNumber` and `buildDate`
4. ✅ Document changes in changelog
5. ✅ Test version display in admin panel
6. ✅ Test version display in footer
7. ✅ Commit and deploy

## Troubleshooting

### Version not updating in footer

- Clear browser cache
- Verify `src/config/version.ts` was updated
- Check that `Footer.tsx` imports are correct
- Rebuild the project

### Admin panel version tab not showing

- Verify `AdminPanel.tsx` imports `VERSION_INFO` correctly
- Check TypeScript compilation for errors
- Ensure version.ts file exists at `src/config/version.ts`

## Future Enhancements

1. **Automated Version Management**: Git-based version bumping
2. **Changelog Integration**: Auto-generate from git commits
3. **Version History**: Track all deployed versions
4. **Update Notifications**: Alert admins to new versions
5. **Rollback Support**: Track deployable versions
6. **API Version Tracking**: Monitor API schema versions

---

**Last Updated:** February 11, 2026  
**Maintained By:** CRM Development Team  
**Status:** Active
