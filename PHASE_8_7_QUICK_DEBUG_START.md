# 🚀 Phase 8.7 Quick Debug Start (5 Minutes)

**Status**: Debug build ready, awaiting test execution  
**Build Date**: 2025-12-04 3:52 PM

## What Changed Since Last Session

✅ Added 50+ debug log points to Python scripts  
✅ Built TypeScript successfully  
✅ Ready to identify root cause of widget text failures  

## 3-Step Quick Start

### 1️⃣ Restart OpenCode (Critical!)
This loads the new debug build:
- Close OpenCode completely
- Wait 5 seconds  
- Reopen OpenCode
- **Result**: MCP process now running `dist/` files with debug code

### 2️⃣ Create Test Actor in UE
In Unreal Editor:
1. Right-click viewport
2. Search: `TextRenderActor`
3. Place in scene
4. In Details → Actor Label: type **TestText**
5. ✓ Done - actor ready for testing

### 3️⃣ Test the Debug Build
In OpenCode, call:

**Tool**: `ue-mcp_manage_ui`  
**Action**: `set_actor_text`  
**Parameters**:
```json
{
  "actorName": "TestText",
  "text": "Hello World"
}
```

### 4️⃣ Watch the Magic ✨

**In UE Output Log** (Window → Developer Tools → Output Log):
```
DEBUG: setActorText started
DEBUG: Parameters - actor_name='TestText', ...
DEBUG: Getting EditorActorSubsystem...
DEBUG: Found N actors
DEBUG: Actor X: label='TestText', class=TextRenderActor
DEBUG: MATCH FOUND
... (execution continues) ...
```

**In OpenCode**: Should show `success: true`  
**In Viewport**: TextRenderActor displays "Hello World"

## What These Debug Lines Tell Us

| Debug Line | Means |
|-----------|--------|
| "setActorText started" | Python execution reached |
| "Subsystem result: ..." | EditorActorSubsystem available |
| "Found N actors" | Actor search working |
| "MATCH FOUND at index X" | TestText found ✓ |
| "FText created successfully" | FText marshaling working |
| No output after this | Execution stops at property assignment |

## 🎯 Expected Outcome

**Best Case** (95% probability):
- Debug output shows where execution stops
- We identify the exact API call that fails
- 15 minutes to fix
- All tests pass

**Example Failure Point**:
```
DEBUG: Target actor found: TextRenderActor
DEBUG: Creating FText from: Hello World
ERROR: FText creation failed: no such attribute 'FText'
```
→ Then we know FText doesn't exist in UE5.7 Python, use alternative

## 📋 Capture Output

After test completes:
1. Select all in Output Log: `Ctrl+A`
2. Copy: `Ctrl+C`  
3. Create file: `UE_DEBUG_2025-12-04.txt` in repo
4. Paste debug output there

This file will be crucial for fixing any issues.

## ✅ Success Criteria

- [ ] Debug output appears in UE console
- [ ] Either test passes (text updates in viewport)
- [ ] Or debug output shows exact failure point
- [ ] We can now proceed with fix if needed

## ⏱️ Timeline

| Step | Time |
|------|------|
| Restart MCP | 1 min |
| Create actor | 2 min |
| Run test | 1 min |
| Analyze | 1 min |
| **Total** | **5 min** |

---

**Next**: Execute these 3 steps and come back with the debug output or success message!
