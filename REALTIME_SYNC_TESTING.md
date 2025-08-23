# Real-Time Canvas Collaboration Testing Guide

## ✅ Working Features
- Firebase RTDB is connected and working
- Test operations can be sent and received
- Active user presence tracking works
- Shared canvas access control works

## 🔍 Issue Found
Canvas changes (drawing, moving elements) are being detected but operations aren't being sent to RTDB properly.

## Testing Steps

### 1. Enable Collaboration on Canvas
**IMPORTANT**: Real-time sync only works when collaboration is explicitly enabled.

1. Open a canvas
2. Click the "Share" button in the top toolbar
3. In the Share Modal, scroll down to find **"Real-time collaboration"**
4. **Toggle it ON** (blue = enabled)
5. Click "Update Settings" or close the modal

### 2. Verify Collaboration is Enabled
1. Go to `/check-collaboration` page
2. Find your canvas in the list
3. Check that "Collaboration Enabled" shows **"Yes"** (green badge)
4. If it shows "No", go back and enable it in the Share modal

### 3. Test Real-Time Sync
1. Open the same canvas in two browser windows (or incognito)
2. Sign in as the same user or different users with edit permissions
3. Look for the diagnostic panel (blue box on right side)
4. Verify both windows show:
   - ✅ RTDB Connected
   - ✅ Collaboration: Enabled
   - ✅ Operations Init: Ready

### 4. Test Drawing Operations
1. In one window, draw a shape or move an element
2. Check the browser console (F12) for logs:
   - Look for `[CanvasEditor] onChange called`
   - Look for `[CanvasEditor] Detected changes`
   - Look for `[OperationsService] Adding to queue`
   - Look for `[OperationsService] ✅ Successfully sent`

### 5. Check Diagnostic Panel
In the diagnostic panel:
- "Op Count" should increase when you draw
- "User Canvas Operations" section should show your changes
- If test operations work but canvas operations don't appear, there's an issue with change detection

## Console Logs to Watch

### Good Signs ✅
```
[CanvasEditor] Detected changes: {added: 1, updated: 0, deleted: 0}
[OperationsService] Adding to queue
[OperationsService] Flushing operations
[OperationsService] ✅ Successfully sent 1 operations to RTDB
```

### Problem Signs ❌
```
[OperationsService] Cannot queue operation: no canvas ID or ref
[useOperations] Cannot queue operation - not initialized
[OperationsService] Flush skipped
```

## Common Issues & Solutions

### Issue: "Collaboration Disabled" in diagnostic panel
**Solution**: Enable collaboration in Share modal

### Issue: Operations not being sent
**Check**:
1. Is collaboration enabled on the canvas?
2. Are you signed in?
3. Do you have edit permissions?

### Issue: Changes not syncing between windows
**Check**:
1. Both windows show same Canvas ID in diagnostic panel
2. Both show "Connected" status
3. Both show "Operations Init: Ready"

## What's Currently Working vs Not Working

### ✅ Working:
- RTDB connection and authentication
- Test operations (diagnostic panel "Send Test Op" button)
- User presence and active user count
- Share permissions and access control

### ⚠️ Issue Being Fixed:
- Canvas drawing operations not being sent to RTDB
- The onChange handler detects changes but operations aren't reaching Firebase

## Next Steps for Developer

The issue is that canvas changes are detected but not properly sent to RTDB. The logs show:
1. Changes ARE detected by onChange handler
2. Operations ARE created from changes
3. queueOperation IS called
4. But operations might not be flushed to RTDB

Check console for specific error messages when drawing on canvas.