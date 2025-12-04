# Phase 8.7 Debug Test Execution Guide

**Date**: 2025-12-04  
**Status**: Ready for Test Execution  
**Build Time**: Just completed  
**Debug Build**: ✅ Present at `dist/tools/ui.js`

## Current State

### ✅ Completed
- TypeScript build: **SUCCESS** (0 errors, TypeScript compilation successful)
- Debug build generated: `dist/tools/ui.js` (32.7 KB, built 3:52 PM)
- Python debug code integrated: 50+ debug log points added
- Handler routing: In place for both actions
- UE Connection: ✅ Working (port 30010 responsive)

### ⚠️ Important

**The debug build is now compiled to JavaScript but OpenCode may still be running the OLD version.** We need to restart the MCP process to load the new build.

## Step 1: Restart OpenCode (Critical!)

This ensures the new debug build with 50+ debug points is loaded:

```bash
# Close OpenCode completely (kill all node processes related to MCP)
# Then restart OpenCode
```

**Why**: The TypeScript→JavaScript compilation is done, but the MCP server process (`dist/` files) isn't running the new code until restarted.

## Step 2: Verify MCP Restart Success

After restarting OpenCode, verify the new build is loaded by checking the tool responds:

```bash
# In OpenCode console or any tool interface:
# Call: ue-mcp_manage_ui action:set_actor_text
# With parameters:
#   actorName: "TestText" 
#   text: "Hello World"
```

Expected: If MCP restarted properly, you'll see detailed debug output.

## Step 3: Create Test Actor (if not present)

In UE Editor:
1. Open: Window → Developer Tools → Output Log (keep it visible)
2. Place a **TextRenderActor** in the level named: **TestText**
   - Right-click in viewport → Search for "TextRenderActor"
   - Place it in scene
   - In Details panel, find "Actor Label" and name it: **TestText**
3. Verify: Name appears in Outliner as "TestText"

## Step 4: Run Test 1 - Set Actor Text (Debug Version)

In OpenCode, call:
```
Tool: ue-mcp_manage_ui
Action: set_actor_text
Parameters:
  actorName: "TestText"
  text: "Hello World"
```

### What to Watch For

**In UE Output Log** (Window → Developer Tools → Output Log):
Look for "DEBUG:" lines like:
```
DEBUG: setActorText started
DEBUG: Parameters - actor_name='TestText', text_value='Hello World', component_name=''
DEBUG: Getting EditorActorSubsystem...
DEBUG: Subsystem result: <unreal.EditorActorSubsystem object>
DEBUG: Getting all level actors...
DEBUG: Found 5 actors
DEBUG: Actor 0: label='Floor', class=StaticMeshActor
DEBUG: Actor 1: label='TestText', class=TextRenderActor
DEBUG: MATCH FOUND at index 1
DEBUG: Target actor found: TextRenderActor
DEBUG: Creating FText from: Hello World
DEBUG: FText created successfully: FText(Hello World)
DEBUG: Attempting direct property assignment on actor
DEBUG: Direct assignment succeeded
RESULT:{"success":true,"actor":"TestText","newText":"Hello World",...}
```

**In OpenCode Result**:
Should show success with the updated text.

**In UE Viewport**:
The TextRenderActor should display: **"Hello World"**

### What Could Go Wrong

| Symptom | Likely Cause | Debug Action |
|---------|-------------|--------------|
| No DEBUG output in UE log | MCP didn't restart; still running old code | Restart MCP process |
| "EditorActorSubsystem not available" | UE subsystem unavailable | Check UE Remote Control settings |
| "Actor not found" | Wrong actor name or not placed in level | Verify actor label is exactly "TestText" |
| "TextRenderComponent not found" | Component not on actor | Verify it's a TextRenderActor, not different class |
| RESULT JSON not in log | Python execution failed completely | Check UE console for exceptions |
| Generic error in OpenCode | Python returned no JSON | Look for exceptions in UE Output Log stderr |

## Step 5: Capture Full Debug Output

Once you see DEBUG output in UE, **save the entire UE Output Log**:

1. In UE Output Log window:
   - Click "Clear" to start fresh
   - Run the test again
   - Select all output: `Ctrl+A`
   - Copy: `Ctrl+C`
   - Paste into file: `UE_DEBUG_OUTPUT_2025-12-04.txt` in repo root

This will help identify exactly where the execution stops.

## Step 6: Run Test 2 - Set TextRender Text (with Styling)

If Test 1 succeeds, run this to test styled text:
```
Tool: ue-mcp_manage_ui
Action: set_textrender_text
Parameters:
  actorName: "TestText"
  text: "Styled Text"
  textColorR: 1.0
  textColorG: 0.0
  textColorB: 0.0
  fontSize: 48
```

Expected: Red text at 48pt size in the viewport.

## Step 7: Analyze Debug Output

With the UE Output Log saved, analyze it for:

1. **Where does execution stop?**
   - If stops at subsystem: UE environment issue
   - If stops at actor search: Actor not found (wrong name?)
   - If stops at FText creation: Python API incompatibility
   - If stops at property assignment: Component/property doesn't exist

2. **What exceptions appear?**
   - Look for `Exception caught: ...`
   - Look for traceback with file/line numbers

3. **Are all actors being listed?**
   - Debug shows "Found N actors"
   - Then lists each actor's label and class
   - Confirms TestText is in that list or not

## Step 8: If Tests Pass ✅

1. Mark todo #2, #3 as complete
2. Run full 21-test suite from `PHASE_8_7_WIDGET_TEXT_TESTING.md`
3. Generate final test report
4. Update `AGENTS.md` with success status

## Step 9: If Tests Fail ❌

With the debug output, we can now:

1. Identify the exact failure point
2. Modify the Python code accordingly
3. Rebuild: `npm run build`
4. Restart MCP again
5. Re-test

**This debug loop is powerful**: Each iteration will pinpoint the exact issue.

## Troubleshooting: OpenCode Restart

If you need to force-restart OpenCode and its MCP:

**Option A - Graceful (Recommended)**
1. In OpenCode: Close the terminal/tool panel
2. Close OpenCode application completely
3. Wait 5 seconds
4. Reopen OpenCode
5. MCP should auto-start

**Option B - Force Kill**
```powershell
# Kill all node processes
taskkill /IM node.exe /F
# Wait 5 seconds
# Restart OpenCode
```

## Key Files Modified

- `src/tools/ui.ts` - Lines 597-920 (setActorText + setTextRenderText)
- `src/tools/consolidated-tool-handlers.ts` - Handler routing
- Build output: `dist/tools/ui.js` (compiled, ready)

## Expected Timeline

| Action | Time |
|--------|------|
| Restart MCP | 1 min |
| Create test actor | 2 min |
| Run Test 1 | 1 min |
| Analyze output | 5 min |
| (If needed) Fix + Rebuild + Test | 15 min |
| **Total**: | **10-30 min** |

## Success Criteria

✅ **Phase 8.7 Complete** when:
1. `manage_ui set_actor_text` updates TextRenderActor text in viewport
2. `manage_ui set_textrender_text` applies color/size/alignment
3. Both return success JSON with actor info
4. 21 test cases pass (or documented with workarounds)
5. AGENTS.md updated with final status

## Next After Success

- [ ] Phase 8.5-8.8 implementation (Splines, Component Mgmt, DataTables, NavMesh)
- [ ] Phase 9: CommonUI → GAS Runtime integration
- [ ] Phase 10: Blueprint Graph Editing

---

**Ready to proceed?** Restart OpenCode and jump to Step 2 above.
