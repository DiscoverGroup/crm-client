# Version Info System - Quick Reference

## 📋 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VERSION INFO SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 Website Version        🔒 Security Patch Version        │
│  ────────────────────      ──────────────────────────       │
│  v2.1.0                   v1.2.0                           │
│  BUILD-20260211-001       2 Critical Patches Applied       │
│  Feb 11, 2026             Last Patched: Feb 11, 2026       │
│                                                             │
│  📦 Key Dependencies       ⚙️ System Status                 │
│  ──────────────────        ──────────────────               │
│  React: 19.1.1            ✅ API Online                    │
│  TypeScript: 5.9.3        ✅ Database Connected            │
│  Vite: 7.1.7              ✅ Security Active               │
│  MongoDB: 7.0.0                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Access Points

### Admin Panel Tab
**Navigation:** Admin Panel → "ℹ️ Version Info" Tab

**Shows:**
- Website version with build number
- Security patch version with critical patch count
- All key dependencies with versions
- System status indicators
- Version history note

### Footer
**Location:** Bottom of every page

**Shows:**
- Compact version display
- Website version, security version, build info
- All on one line for quick reference

## 🔄 Update Workflow

```
1. Update src/config/version.ts
        ↓
2. Increment appropriate version number
   - MAJOR (breaking)
   - MINOR (features)
   - PATCH (fixes)
        ↓
3. Update build date and number
        ↓
4. If dependencies changed, update those too
        ↓
5. Rebuild project
        ↓
6. Version displays in Admin Panel and Footer
```

## 📊 Version Structure

### Website Version
```
MAJOR . MINOR . PATCH
  2   .   1   .   0     = v2.1.0
  
  ↑ Breaking changes
      ↑ New features (backwards compatible)
          ↑ Bug fixes only
```

### Security Version
```
MAJOR . MINOR . PATCH
  1   .   2   .   0     = v1.2.0
  
  ↑ Major security refactor
      ↑ Security features added
          ↑ Security patches applied
```

## 📝 Files Reference

| File | Purpose | Location |
|------|---------|----------|
| `version.ts` | Version config & helpers | `src/config/` |
| `AdminPanel.tsx` | Admin version tab | `src/components/` |
| `Footer.tsx` | Version footer display | `src/components/` |
| `VERSION-SYSTEM-GUIDE.md` | Detailed documentation | Project root |

## 🔑 Key Functions

```typescript
// Get formatted version strings
getFullVersion()       // Returns: "v2.1.0"
getSecurityVersion()   // Returns: "1.2.0"
getBuildInfo()         // Returns: "BUILD-20260211-001 (2026-02-11)"

// Access raw version data
VERSION_INFO.website.major
VERSION_INFO.security.lastPatched
VERSION_INFO.dependencies.react
```

## 📋 Checklist: Updating Versions

- [ ] Edit `src/config/version.ts`
- [ ] Update `website.major`, `minor`, or `patch`
- [ ] Update `website.buildDate` (YYYY-MM-DD format)
- [ ] Update `website.buildNumber` (increment)
- [ ] If security update: increment `security.patch`
- [ ] Update `security.lastPatched` if needed
- [ ] If packages upgraded: update `dependencies`
- [ ] Save file
- [ ] Rebuild project (`npm run build`)
- [ ] Verify in Admin Panel version tab
- [ ] Verify in footer
- [ ] Commit and deploy

## 🎨 UI Components

### Admin Panel Cards
- **Blue Card:** Website version info
- **Green Card:** Security patch info
- **Purple Card:** Dependencies
- **Light Blue Card:** System status
- **Yellow Banner:** Version note

### Footer Display
```
© 2026 DiscoverGroup CRM System. All rights reserved.
Website: v2.1.0 • Security: v1.2.0 • BUILD-20260211-001 (2026-02-11)
```

## 🔐 Security Tracking

**Critical Patches Counter**
```
Tracks number of critical security issues resolved:
- Injection attacks
- XSS vulnerabilities
- CSRF exploits
- Authentication issues
- Data breach prevention
```

**Last Patched Date**
```
Records when security was last updated
Helps compliance and audit trails
```

## 🚀 Example Deployment

```
Current: v2.1.0 (BUILD-20260211-001)
Security: v1.2.0

→ Add new feature
→ Update version to v2.2.0
→ Update BUILD number to BUILD-20260212-001
→ Deploy

Result:
Website: v2.2.0 (BUILD-20260212-001)
Security: v1.2.0 (unchanged)
```

## ⚠️ Common Tasks

**Apply security patch:**
```
security.patch: 0 → 1
security.lastPatched: update to today
```

**Major feature release:**
```
website.minor: 1 → 2
website.patch: 0 (reset)
```

**Bug fix release:**
```
website.patch: 0 → 1
(major and minor unchanged)
```

**Upgrade dependency:**
```
dependencies.react: 19.1.1 → 19.1.2
(notify users of upgraded lib versions)
```

## 📞 Support

For version system issues:
1. Check `VERSION-SYSTEM-GUIDE.md` troubleshooting section
2. Verify `src/config/version.ts` exists and is properly formatted
3. Rebuild project with `npm run build`
4. Clear browser cache if display not updating
5. Check TypeScript compilation for errors

---

**Quick Links:**
- 📖 Full Guide: `VERSION-SYSTEM-GUIDE.md`
- ⚙️ Config: `src/config/version.ts`
- 🖥️ Admin Tab: Admin Panel → Version Info
- 📺 Footer: Bottom of every page

**Status:** ✅ Production Ready
