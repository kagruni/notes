# Real-Time Sync Testing Guide

## Current Status
- ✅ Firebase RTDB connected
- ✅ Test operations work (diagnostic panel)
- ✅ Operations are being sent to RTDB (numbers increment)
- ❌ Canvas elements not appearing in other window

## What's Been Fixed
1. **Undefined values in Firestore** - Created cleanForFirestore utility
2. **Variable scoping** - Fixed finalElements not defined error
3. **Operation detection** - Now detects modifications (not just additions)
4. **User ID persistence** - Fixed cleanup running too early

## Test Steps

### 1. Enable Collaboration
- Open canvas
- Click "Share" button
- Toggle "Real-time collaboration" ON
- Save settings

### 2. Open Console (F12) and Look For:

**In Window 1 (Drawing):**
```
[CanvasEditor] ✅ CHANGES DETECTED
[OperationsService] ✅ Successfully sent
```

**In Window 2 (Receiving):**
```
[OperationsService] 📡 Received operation from RTDB
[CanvasEditor] 📡 onRemoteOperation called
[applyOperation] Adding/Updating X elements
[CanvasEditor] ✅ Successfully applied remote operation
```

### 3. Check SyncDebugger (Black Panel)
- Should show operations in both windows
- Blue = your operations
- Gray = other user's operations

## Critical Questions to Answer:

1. **Are operations being sent?**
   - Check if operation count increases in Diagnostic Panel
   - Check if operations appear in SyncDebugger

2. **Are operations being received?**
   - Look for `[OperationsService] 📡 Received operation` in OTHER window
   - Check `isOurs: false` (not from same client)

3. **Is updateScene being called?**
   - Look for `[CanvasEditor] 🎨 Calling updateScene`
   - Check for any errors after this

4. **Are elements actually in the scene?**
   - After receiving, check element count in console logs

## If Still Not Working:

### Test Manual Operation:
1. Click "Send Canvas Op" button in Diagnostic Panel
2. This sends a rectangle directly to RTDB
3. Check if it appears in other window

### Check These Specific Logs:
```javascript
// This shows if operation is received
[OperationsService] 📡 Received operation from RTDB: {
  isOurs: false,  // Must be false
  type: "add",
  elementCount: 1
}

// This shows if it's being applied
[applyOperation] Adding element: [id] rectangle

// This shows if scene is updated
[CanvasEditor] Reconciled elements: {
  final: X  // Should be > 0
}
```

## Common Issues:

1. **Operations not sent** - Check collaboration is enabled
2. **Operations not received** - Check RTDB listener is active
3. **updateScene not working** - Excalidraw API issue
4. **Elements not visible** - Reconciliation problem

## Debug Commands:

```javascript
// Check service state
console.log(operationsService.currentCanvasId)
console.log(operationsService.currentUserId)

// Check Excalidraw state
excalidrawAPI.getSceneElements().length

// Force sync
operationsService.forceSync()
```