# Version Management & Release Process

This document explains the automated versioning and release system for this project.

## Overview

The project uses an automated version management system that:
- Generates version information at build time from Git tags
- Distinguishes between development and release builds
- Works consistently across all environments (local, CI/CD, production)
- Requires no special commit messages for daily development

## How It Works

### Build-Time Version Generation
- `src/lib/version.json` is generated automatically during builds
- The file is in `.gitignore` and never committed
- Version info is created from Git history and current environment
- `prebuild` script runs before every `npm run build`

### Version Sources
- **Development**: Uses `package.json` version + commit hash
- **Release**: Uses Git tag version + commit hash + release flag

## Daily Development Workflow

### ✅ Normal Development (No Special Requirements)

```bash
# Work on any branch - no special commit format needed
git add .
git commit -m "fix: improved user authentication"
git commit -m "feat: added new dashboard widget"
git commit -m "refactor: cleaned up API endpoints"
git push origin your-branch
```

**Key Points:**
- Write commit messages however you prefer
- No special formatting required
- Work on any branch (main, stage, feature branches, etc.)
- Push changes normally

### 🔄 Recommended Branch Workflow

```bash
# Daily development
git checkout stage                    # or your feature branch
# ... make changes ...
git commit -m "your normal commits"
git push origin stage

# When ready for release
git checkout main
git merge stage                       # bring changes to main
npm run release:patch                 # create release (see below)
git checkout stage                    # back to development
```

## Release Process

### Creating Releases

Use these commands when you're ready to publish a new version:

```bash
# Bug fixes (0.2.1 → 0.2.2)
npm run release:patch

# New features (0.2.1 → 0.3.0)  
npm run release:minor

# Breaking changes (0.2.1 → 1.0.0)
npm run release:major
```

### What Release Commands Do Automatically

1. **Update package.json version**
2. **Create Git commit** with version number as message
3. **Create Git tag** (e.g., `v0.2.1`)
4. **Push to main branch** with tags

Example of what happens:
```bash
npm run release:patch
# → Updates package.json: 0.2.1 → 0.2.2
# → Creates commit: "0.2.2"
# → Creates tag: v0.2.2
# → Pushes to origin/main with tags
```

## Environment Behavior

### Local Development
```bash
npm run dev           # Shows package.json version + commit
npm run build         # Generates version.json, shows release info
npm run start         # Shows release version info
```

### Production Deployment
```bash
# During deployment (Vercel, Netlify, etc.):
npm run build         # prebuild generates version.json
# → Automatically shows correct version to users
```

### Testing Version Generation
```bash
npm run version:generate    # Manually generate version.json
```

## UI Display

The version system provides different information based on context:

### Development Builds
```json
{
  "version": "0.2.1",           // from package.json
  "commit": "abc123",
  "isRelease": false,
  "environment": "development"
}
```

### Release Builds  
```json
{
  "version": "v0.2.1",          // from git tag
  "commit": "def456", 
  "isRelease": true,
  "environment": "production"
}
```

### Additional Fields
- `buildDate`: When the version was generated
- `buildNumber`: Timestamp-based build identifier
- `commitMessage`: The commit message for the current commit

## Technical Implementation

### Key Files
- `scripts/build-version.js`: Generates version information
- `src/lib/version.json`: Generated version data (in .gitignore)
- `src/lib/version.ts`: TypeScript utilities for reading version
- `package.json`: Contains prebuild hook and release scripts

### Scripts
```json
{
  "prebuild": "node scripts/build-version.js",
  "version:generate": "node scripts/build-version.js",
  "release:patch": "npm version patch && git push origin main --tags",
  "release:minor": "npm version minor && git push origin main --tags", 
  "release:major": "npm version major && git push origin main --tags"
}
```

## Troubleshooting

### Version File Issues
If you have uncommitted changes to `version.json`:
```bash
git checkout -- src/lib/version.json    # discard changes
```

### Missing Version Information
```bash
npm run version:generate    # regenerate version.json
```

### Release Conflicts
Make sure your working directory is clean before releasing:
```bash
git status                  # check for uncommitted changes
git stash                   # if needed, stash changes
npm run release:patch       # then release
git stash pop              # restore changes if stashed
```

## Benefits

✅ **Clean Git History**: No version bumps cluttering commit history  
✅ **Automatic Process**: No manual version file editing  
✅ **Environment Aware**: Different behavior for dev vs production  
✅ **CI/CD Ready**: Works automatically in deployment pipelines  
✅ **Team Friendly**: No special knowledge required for daily development  
✅ **Industry Standard**: Git tags for releases, build-time generation  

## Best Practices

1. **Always release from main branch** for consistency
2. **Use semantic versioning** (patch/minor/major appropriately)
3. **Test locally** with `npm run build` before releasing
4. **Don't commit** `src/lib/version.json` (it's auto-generated)
5. **Use descriptive commit messages** for better git history

---

For questions or issues with the version management system, refer to this documentation or check the implementation in `scripts/build-version.js`. 