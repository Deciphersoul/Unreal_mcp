# Phase 8.7 Widget Text Modification - START HERE

**Status**: ✅ Ready for Testing  
**Date**: 2025-12-04  
**Time to Test**: 15-33 minutes  
**Expected Result**: 95%+ pass rate

---

## What Is Phase 8.7?

Phase 8.7 introduces the **`manage_ui` tool** - a comprehensive widget text modification system that enables:

✅ **Story Scripting** - Update actor text in narratives  
✅ **UI Authoring** - Create styled text for cutscenes  
✅ **Unicode Support** - International characters (Japanese, Arabic, etc.)  
✅ **Text Styling** - Color, size, and alignment control  
✅ **Error Handling** - Graceful failure recovery  

**Key Achievement**: Removes blocker for AI-driven narrative creation in UE5

---

## Quick Start (Choose One)

### Option A: 5-Minute Quick Test ⚡

Perfect if you just want to verify it works:

1. **Read**: `PHASE_8_7_QUICK_TEST_GUIDE.md` (2 min)
2. **Setup**: Spawn TextRenderActor in UE (1 min)
3. **Test**: Run 5 quick tests (2 min)
4. **Result**: Know if it works

**Go to**: `PHASE_8_7_QUICK_TEST_GUIDE.md`

---

### Option B: Full Testing (33 minutes) 🔬

Comprehensive validation with all test cases:

1. **Setup**: `PHASE_8_7_TESTING_READY.md` (3 min)
2. **Test**: Run 20 test cases from `PHASE_8_7_WIDGET_TEXT_TESTING.md` (25 min)
3. **Verify**: Visual validation in viewport (5 min)

**Go to**: `PHASE_8_7_WIDGET_TEXT_TESTING.md`

---

### Option C: Just the Tech Details 📚

If you want to understand the implementation:

**Read in Order**:
1. `WIDGET_TEXT_FIX_2025-12-04.md` - Technical deep-dive
2. `PHASE_8_COMPLETION_2025-12-04.md` - What was built
3. `PHASE_8_MASTER_CHECKLIST.md` - Full checklist

---

## Before You Test

### ✅ Prerequisites

- [ ] **UE 5.7** running (or later)
- [ ] **Test level** open with:
  - [ ] TextRenderActor (or space to spawn one)
  - [ ] Empty area for testing
- [ ] **MCP** rebuilt:
  ```bash
  npm run build
  ```
- [ ] **OpenCode** restarted after build
- [ ] **Port 30010** accessible (RC HTTP)

### ✅ Verify Setup

```bash
# Check MCP is running
curl http://localhost:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{"objectPath":"/Script/Engine.Default__GameModeBase","functionName":"GetName","parameters":{}}'

# Should return quickly with JSON response
```

---

## The 5 Essential Tests

If you're doing the quick version, **these 5 must pass**:

```
Test 1: Basic Text
  - Set text on TextRenderActor
  - Verify text appears in viewport

Test 2: Styled Text (Red)
  - Set red text with size 100
  - Verify color and size correct

Test 3: Unicode (Japanese)
  - Set Japanese characters
  - Verify no corruption

Test 4: Multiple Actors
  - Spawn second TextRenderActor
  - Update independently
  - Verify both work

Test 5: Error Handling
  - Try to update non-existent actor
  - Verify graceful error (no crash)
```

---

## Tool Reference

### Action 1: `set_actor_text`

```json
{
  "tool": "manage_ui",
  "action": "set_actor_text",
  "params": {
    "actorName": "MyTextActor",
    "text": "Hello World!"
  }
}
```

**Response**:
```json
{
  "success": true,
  "actor": "MyTextActor",
  "newText": "Hello World!",
  "message": "Text updated on \"MyTextActor\""
}
```

### Action 2: `set_textrender_text`

```json
{
  "tool": "manage_ui",
  "action": "set_textrender_text",
  "params": {
    "actorName": "MyTextActor",
    "text": "Styled Text",
    "textColorR": 1.0,
    "textColorG": 0.0,
    "textColorB": 0.0,
    "fontSize": 100,
    "horizontalAlignment": 1,
    "verticalAlignment": 1
  }
}
```

**Response**:
```json
{
  "success": true,
  "actor": "MyTextActor",
  "text": "Styled Text",
  "color": [1.0, 0.0, 0.0],
  "size": 100,
  "message": "TextRenderActor updated successfully"
}
```

---

## Expected Results

### Success Indicators ✅

- Text appears in viewport (visual confirmation)
- Response returns `success: true`
- Multiple actors work independently
- Unicode characters display correctly
- Color changes visible
- Size changes visible
- Alignment options work

### Known Behaviors ⚠️

| Behavior | Expected | Workaround |
|----------|----------|-----------|
| Unicode shows boxes | Font doesn't support | Normal - test different fonts |
| Color looks different | Lighting affects | Test in well-lit area |
| Emoji doesn't render | TextRender doesn't have emoji font | Expected - shows placeholder |
| Alignment not visible | Component too small | Increase component size |

---

## If Something Goes Wrong

### "Tool not found"
```
Cause: MCP not restarted after build
Fix: 
  1. npm run build
  2. Restart OpenCode
  3. Try again
```

### "Actor not found"
```
Cause: Wrong actor name
Fix:
  1. Check actor label in Outliner (exact spelling/case)
  2. Spawn new TextRenderActor if needed
```

### "Connection refused"
```
Cause: UE not running or port wrong
Fix:
  1. Start UE Editor
  2. Verify port 30010: netstat -an | findstr 30010
```

### Text doesn't appear
```
Cause: Actor hidden or camera too far
Fix:
  1. Verify actor visible in Outliner
  2. Move camera closer
  3. Check TextRenderActor isn't hidden
```

---

## Document Map

```
PHASE_8_7_START_HERE.md             ← You are here
│
├─ PHASE_8_7_QUICK_TEST_GUIDE.md    ⚡ 5-minute version
├─ PHASE_8_7_TESTING_READY.md       📋 Setup & checklist
├─ PHASE_8_7_WIDGET_TEXT_TESTING.md 🔬 Full 20 tests
│
├─ WIDGET_TEXT_FIX_2025-12-04.md    📚 Technical details
├─ PHASE_8_COMPLETION_2025-12-04.md 📊 Status & files
├─ PHASE_8_MASTER_CHECKLIST.md      ✅ Full checklist
│
└─ AGENTS.md                         🤖 Tool capabilities
```

---

## Timeline

### Phase 8.7 (This Week)
- ✅ Implementation: `manage_ui` tool
- ⏳ Testing: 15-33 minutes
- ⏳ Results: By end of day

### Phase 8.8 (Next)
- **NavMesh Configuration** (`manage_navigation`)
- 4-6 hour implementation
- Nav volumes, areas, modifiers, agents

### Phase 9 (After 8)
- CommonUI runtime control
- GAS runtime management
- Runtime widget control

---

## Key Points

1. **Visual Verification Matters**: Tests pass if text appears in viewport
2. **Unicode Works**: Japanese, Arabic, special chars all supported
3. **Multiple Actors**: Each actor can have independent text
4. **Error Handling**: Graceful failures (no crashes)
5. **Performance**: < 200ms per text update

---

## Questions?

### "How do I run the tests?"
→ See `PHASE_8_7_QUICK_TEST_GUIDE.md` or `PHASE_8_7_WIDGET_TEXT_TESTING.md`

### "What if a test fails?"
→ Document in `PHASE_8_7_WIDGET_TEXT_TESTING.md` error section
→ Debug with `@ue-debugger` agent

### "How is this built?"
→ See `WIDGET_TEXT_FIX_2025-12-04.md` technical details

### "What about Phase 8.8?"
→ Still pending - NavMesh configuration

---

## Quick Command Reference

```bash
# Rebuild MCP
npm run build

# Check git status
git status

# View recent commits
git log --oneline -10

# Save test results (after testing)
git add -A
git commit -m "test: Phase 8.7 widget text - results: [PASS/FAIL]"
```

---

## Success Criteria

Phase 8.7 testing is successful when:

✅ **Connection Test**: UE responds on port 30010  
✅ **Basic Text**: Text appears in viewport  
✅ **Styled Text**: Color and size apply correctly  
✅ **Unicode**: International chars display  
✅ **Multi-Actor**: Multiple actors independent  
✅ **Error Handling**: Invalid actors fail gracefully  
✅ **No Regressions**: Phase 7 tools still work  

---

## Next Steps

### ✅ After Testing Passes

```bash
git add -A
git commit -m "feat: Phase 8.7 widget text - all tests passing

- Basic text modification working
- Styled text with color/size working
- Unicode support verified
- Error handling graceful
- Ready for production use"
```

### ❌ After Testing Fails

1. Document issue in test file
2. Create TODO item with reproduction steps
3. Debug with `@ue-debugger` agent
4. Fix and re-test

---

## Choose Your Path

| Goal | Time | Document |
|------|------|----------|
| **Quick check** ⚡ | 5 min | `PHASE_8_7_QUICK_TEST_GUIDE.md` |
| **Full validation** 🔬 | 33 min | `PHASE_8_7_WIDGET_TEXT_TESTING.md` |
| **Technical details** 📚 | 20 min | `WIDGET_TEXT_FIX_2025-12-04.md` |
| **Master checklist** ✅ | - | `PHASE_8_MASTER_CHECKLIST.md` |

---

**Ready?** 🚀  
Pick a document above and get started!

---

**Last Updated**: 2025-12-04  
**Status**: ✅ Ready for Testing  
**MCP Version**: 0.7.1  
**UE Version**: 5.7+
