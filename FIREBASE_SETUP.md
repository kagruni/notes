# Firebase Setup Instructions

## Composite Indexes Deployment

This project requires composite indexes for efficient Firestore queries. The index configuration is defined in `firestore.indexes.json`.

### Required Index

**Tasks Collection Composite Index:**
- Fields: `userId` (ASC) → `projectId` (ASC) → `status` (ASC) → `order` (ASC)
- Purpose: Enables efficient queries for user tasks filtered by project and status, ordered by custom order

### Deployment Steps

#### Option 1: Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Accept default files or specify custom paths

4. **Deploy indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Monitor deployment**:
   - Check the Firebase Console → Firestore Database → Indexes
   - Wait for index status to change from "Building" to "Enabled"
   - This may take several minutes depending on existing data volume

#### Option 2: Firebase Console (Manual)

1. Navigate to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Firestore Database → Indexes → Composite
4. Click "Create Index"
5. Configure the index manually:
   - Collection: `tasks`
   - Fields (in order):
     1. `userId` - Ascending
     2. `projectId` - Ascending
     3. `status` - Ascending
     4. `order` - Ascending
   - Query scope: Collection
6. Click "Create"

### Verification

After deployment, verify the index is active:

```bash
firebase firestore:indexes
```

Or check in Firebase Console → Firestore Database → Indexes tab.

### Development vs Production

- **Local Development**: Firestore emulator automatically creates indexes as needed
- **Production**: Indexes must be explicitly deployed using the steps above

### Troubleshooting

**Index build fails:**
- Check Firebase project permissions
- Verify `firestore.indexes.json` syntax is valid
- Ensure you're authenticated with correct Firebase project

**Queries still slow:**
- Wait for index status to show "Enabled" (not "Building")
- Clear application cache and retry queries
- Check Firebase Console for any index warnings

**CLI errors:**
- Run `firebase login --reauth` to refresh authentication
- Verify project ID matches: `firebase use --add`
- Check Firebase CLI version: `firebase --version` (should be latest)

### Additional Resources

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Index Best Practices](https://firebase.google.com/docs/firestore/query-data/index-overview)
