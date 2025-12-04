# Phase 8.7 Widget Text Modification - Comprehensive Testing Guide

**Date**: 2025-12-04  
**Feature**: Widget Text Modification (`manage_ui` tool)  
**Status**: Ready for Testing  
**Priority**: High (Narrative/Story Feature)

---

## Executive Summary

Phase 8.7 introduces **`manage_ui` tool** for modifying text on actors (especially TextRenderActors and widgets) with full support for:
- ✅ Basic text modification
- ✅ Styled text (color, size, alignment)
- ✅ Unicode and international characters
- ✅ Proper FText marshaling for UE5.7

This enables **story scripting and UI authoring through MCP**.

---

## Implementation Status

### Tool Definition
- **File**: `src/tools/ui.ts`
- **Actions**: 2 primary actions
- **Python Support**: ✅ Full Python-based implementation
- **RC API Support**: ✅ Tested with RC HTTP

### Actions Implemented

#### Action 1: `set_actor_text`
**Purpose**: Set text on any actor with automatic component detection

**Parameters**:
```json
{
  "actorName": "string (required) - Actor label/name",
  "text": "string (required) - Text content (Unicode supported)",
  "componentName": "string (optional) - Specific component to target"
}
```

**Response**:
```json
{
  "success": true,
  "actor": "MyTextActor",
  "newText": "Updated text",
  "message": "Text updated on \"MyTextActor\""
}
```

#### Action 2: `set_textrender_text`
**Purpose**: Set text with styling options on TextRenderActors

**Parameters**:
```json
{
  "actorName": "string (required) - TextRenderActor label",
  "text": "string (required) - Text content",
  "textColorR": "number (optional, 0.0-1.0) - Red channel",
  "textColorG": "number (optional, 0.0-1.0) - Green channel",
  "textColorB": "number (optional, 0.0-1.0) - Blue channel",
  "fontSize": "number (optional) - World size of text",
  "horizontalAlignment": "number (optional, 0=Left, 1=Center, 2=Right)",
  "verticalAlignment": "number (optional, 0=Top, 1=Center, 2=Bottom)"
}
```

**Response**:
```json
{
  "success": true,
  "actor": "StoryTitle",
  "text": "Chapter 1: Beginning",
  "color": [1.0, 0.8, 0.0],
  "size": 120,
  "alignment": {
    "horizontal": 1,
    "vertical": 1
  },
  "message": "TextRenderActor updated successfully"
}
```

---

## Pre-Test Checklist

### Environment Setup
- [ ] UE 5.7 Editor running with test level open
- [ ] Test level contains at least one TextRenderActor (or empty space to spawn)
- [ ] MCP server running (check connection first)
- [ ] OpenCode connected and ready
- [ ] RC HTTP port 30010 is accessible

### MCP Build Status
- [ ] Run `npm run build` successfully
- [ ] OpenCode restarted after build
- [ ] `manage_ui` tool appears in tool list

### Actor Setup
- [ ] **Option A**: Existing TextRenderActor in level (label: "StoryText" or similar)
- [ ] **Option B**: Empty space to spawn new TextRenderActor

---

## Test Plan (33 minutes total)

### Phase 0: Connection Verification (2 min)

**Test 0.0: Verify UE Connection**

```
Tool: debug_extended
Action: check_connection
Expected Response: {
  "connected": true,
  "responseTime": "< 200ms",
  "serverVersion": "0.7.x"
}
```

**Pass Criteria**:
- [ ] Returns `connected: true`
- [ ] Response time < 500ms
- [ ] No errors in output

**If Failed**: 
- Check UE Editor is running
- Check port 30010 is listening: `netstat -an | findstr 30010`
- Restart UE and MCP

---

### Phase 1: Baseline - Phase 7 Tools Verification (3 min)

**Test 1.1: Verify Phase 7 tools still working**

```
Tool: manage_material
Action: get_parameters
Parameters: {materialPath: "/Game/Materials/M_Default"}
Expected: Returns parameter list (or "Material not found" OK)
```

**Pass Criteria**:
- [ ] Tool responds without error 500
- [ ] Response is valid JSON

```
Tool: manage_rendering
Action: get_info
Expected: Returns rendering feature status
```

**Pass Criteria**:
- [ ] Tool responds successfully
- [ ] No new regressions introduced

---

### Phase 2: Test 8.7.1 - Basic Text Modification

**Duration**: 5 minutes

**Setup**:
If you don't have a TextRenderActor, spawn one first:

```
Tool: control_actor
Action: spawn
Parameters: {
  classPath: "TextRenderActor",
  actorName: "TestText",
  location: {x: 0, y: 0, z: 200}
}
Expected: Actor spawned in viewport
```

**Test 8.7.1a: Set text on existing actor**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "Hello World!"
}
```

**Expected Response**:
```json
{
  "success": true,
  "actor": "TestText",
  "newText": "Hello World!",
  "message": "Text updated on \"TestText\""
}
```

**Pass Criteria**:
- [ ] Response returns `success: true`
- [ ] Actor name matches request
- [ ] No errors in response
- [ ] **VISUAL**: Text appears in viewport showing "Hello World!"

**Test 8.7.1b: Update text again (verify it overwrites)**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "Updated Text"
}
```

**Expected Response**: Success message with new text

**Pass Criteria**:
- [ ] Text changes from "Hello World!" to "Updated Text"
- [ ] Previous text is replaced (not appended)
- [ ] **VISUAL**: Viewport shows updated text

---

### Phase 3: Test 8.7.2 - Styled Text with Color

**Duration**: 8 minutes

**Test 8.7.2a: Set red text with size**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Red Text",
  textColorR: 1.0,
  textColorG: 0.0,
  textColorB: 0.0,
  fontSize: 80
}
```

**Expected Response**:
```json
{
  "success": true,
  "actor": "TestText",
  "text": "Red Text",
  "color": [1.0, 0.0, 0.0],
  "size": 80,
  "message": "TextRenderActor updated successfully"
}
```

**Pass Criteria**:
- [ ] Returns success with color array `[1.0, 0.0, 0.0]`
- [ ] Size is set to 80
- [ ] **VISUAL**: Text appears RED in viewport
- [ ] **VISUAL**: Text size appears large (~80)

**Test 8.7.2b: Yellow text with different size**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Yellow Text",
  textColorR: 1.0,
  textColorG: 1.0,
  textColorB: 0.0,
  fontSize: 120
}
```

**Pass Criteria**:
- [ ] Text color appears YELLOW
- [ ] Text size is larger than previous
- [ ] Color values in response: `[1.0, 1.0, 0.0]`

**Test 8.7.2c: Blue text, smaller size**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Blue Small",
  textColorR: 0.0,
  textColorG: 0.0,
  textColorB: 1.0,
  fontSize: 40
}
```

**Pass Criteria**:
- [ ] Text color is BLUE
- [ ] Text is noticeably smaller
- [ ] Readable color gradient verified

---

### Phase 4: Test 8.7.3 - Unicode Support

**Duration**: 5 minutes

**Test 8.7.3a: Japanese characters**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "こんにちは世界"
}
```

**Expected**: Japanese text "Hello World" in Japanese

**Pass Criteria**:
- [ ] Response returns success
- [ ] **VISUAL**: Japanese characters display correctly (no mojibake)
- [ ] All 7 characters visible

**Test 8.7.3b: Mixed Unicode**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "English 中文 العربية Ñoño"
}
```

**Pass Criteria**:
- [ ] Response successful
- [ ] **VISUAL**: All scripts visible (Latin, Chinese, Arabic, Spanish N-tilde)
- [ ] No corruption or replacement characters

**Test 8.7.3c: Emoji (if font supports)**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "Game 🎮 Level 🎯 Win 🏆"
}
```

**Pass Criteria**:
- [ ] Response successful
- [ ] **VISUAL**: Emojis may or may not render (depends on TextRender font)
- [ ] Fallback: Text renders with placeholder characters (no crash)

---

### Phase 5: Test 8.7.4 - Text Alignment

**Duration**: 5 minutes

**Test 8.7.4a: Left alignment (default)**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Left Aligned",
  horizontalAlignment: 0,
  verticalAlignment: 0
}
```

**Pass Criteria**:
- [ ] Response successful
- [ ] **VISUAL**: Text appears at left edge of actor
- [ ] Text baseline at top

**Test 8.7.4b: Center both ways**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Centered",
  horizontalAlignment: 1,
  verticalAlignment: 1
}
```

**Pass Criteria**:
- [ ] Response successful
- [ ] **VISUAL**: Text centered horizontally
- [ ] **VISUAL**: Text centered vertically on actor
- [ ] Alignment values in response: `1, 1`

**Test 8.7.4c: Right alignment**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Right Aligned",
  horizontalAlignment: 2,
  verticalAlignment: 2
}
```

**Pass Criteria**:
- [ ] **VISUAL**: Text right-aligned
- [ ] **VISUAL**: Text at bottom of actor area

**Test 8.7.4d: Combination - right + top**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "TestText",
  text: "Top Right",
  horizontalAlignment: 2,
  verticalAlignment: 0
}
```

**Pass Criteria**:
- [ ] **VISUAL**: Text positioned at top-right

---

### Phase 6: Test 8.7.5 - Multiple Actors

**Duration**: 8 minutes

**Test 8.7.5a: Spawn second TextRenderActor**

```
Tool: control_actor
Action: spawn
Parameters: {
  classPath: "TextRenderActor",
  actorName: "Title",
  location: {x: 0, y: 0, z: 400}
}
```

**Pass Criteria**:
- [ ] Second actor spawned successfully
- [ ] Positioned higher (z: 400)

**Test 8.7.5b: Spawn third TextRenderActor**

```
Tool: control_actor
Action: spawn
Parameters: {
  classPath: "TextRenderActor",
  actorName: "Subtitle",
  location: {x: 0, y: 0, z: 300}
}
```

**Pass Criteria**:
- [ ] Third actor spawned
- [ ] Three actors now visible in viewport

**Test 8.7.5c: Update each with different text and colors**

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "Title",
  text: "CHAPTER 1",
  textColorR: 1.0,
  textColorG: 0.8,
  textColorB: 0.0,
  fontSize: 150,
  horizontalAlignment: 1
}
```

**Pass Criteria**:
- [ ] Title actor shows "CHAPTER 1"
- [ ] Color is YELLOW/GOLD
- [ ] Large size (150)
- [ ] Centered

```
Tool: manage_ui
Action: set_textrender_text
Parameters: {
  actorName: "Subtitle",
  text: "The Beginning",
  textColorR: 0.8,
  textColorG: 0.8,
  textColorB: 0.8,
  fontSize: 60,
  horizontalAlignment: 1
}
```

**Pass Criteria**:
- [ ] Subtitle shows "The Beginning"
- [ ] Gray text
- [ ] Smaller than title
- [ ] Centered

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "Press E to continue"
}
```

**Pass Criteria**:
- [ ] TestText actor shows action prompt
- [ ] Three actors visible with different text
- [ ] **VISUAL**: Complete story screen layout

---

### Phase 7: Test 8.7.6 - Error Handling

**Duration**: 5 minutes

**Test 8.7.6a: Invalid actor name**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "NonExistentActor",
  text: "This should fail"
}
```

**Expected Response**: Error mentioning actor not found

**Pass Criteria**:
- [ ] Returns error (not success)
- [ ] Error message mentions actor name
- [ ] Graceful error, no crash
- [ ] Response is valid JSON

**Test 8.7.6b: Empty text (edge case)**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: ""
}
```

**Expected Response**: Success or meaningful error

**Pass Criteria**:
- [ ] Response is valid
- [ ] Either clears text or returns error
- [ ] **VISUAL**: Text either disappears or shows warning

**Test 8.7.6c: Very long text**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "TestText",
  text: "This is a very long text that contains many words and should test how the system handles lengthy content without breaking or causing performance issues in the editor. It should wrap or overflow gracefully depending on TextRender configuration."
}
```

**Pass Criteria**:
- [ ] Response successful
- [ ] **VISUAL**: Text appears (may wrap if font supports it)
- [ ] No crashes or timeouts

**Test 8.7.6d: Special characters in actor name (case insensitivity)**

```
Tool: manage_ui
Action: set_actor_text
Parameters: {
  actorName: "testtext",
  text: "Lowercase actor name"
}
```

**Expected**: Should match "TestText" (case insensitive)

**Pass Criteria**:
- [ ] Finds actor despite case difference
- [ ] Updates text successfully
- [ ] Actor name matching is case-insensitive

---

## Test Results Summary

### Overall Scoring

| Test ID | Category | Test Case | Expected | Result | Status |
|---------|----------|-----------|----------|--------|--------|
| 0.0 | Connection | UE connectivity | Pass | ? | [ ] |
| 1.1 | Baseline | Phase 7 tools | Pass | ? | [ ] |
| 8.7.1a | Basic | Set text | Pass | ? | [ ] |
| 8.7.1b | Basic | Update text | Pass | ? | [ ] |
| 8.7.2a | Color | Red text | Pass | ? | [ ] |
| 8.7.2b | Color | Yellow text | Pass | ? | [ ] |
| 8.7.2c | Color | Blue text | Pass | ? | [ ] |
| 8.7.3a | Unicode | Japanese | Pass | ? | [ ] |
| 8.7.3b | Unicode | Mixed scripts | Pass | ? | [ ] |
| 8.7.3c | Unicode | Emoji | Pass | ? | [ ] |
| 8.7.4a | Alignment | Left/Top | Pass | ? | [ ] |
| 8.7.4b | Alignment | Center | Pass | ? | [ ] |
| 8.7.4c | Alignment | Right/Bottom | Pass | ? | [ ] |
| 8.7.4d | Alignment | Right/Top | Pass | ? | [ ] |
| 8.7.5a | Multi | Spawn actor 2 | Pass | ? | [ ] |
| 8.7.5b | Multi | Spawn actor 3 | Pass | ? | [ ] |
| 8.7.5c | Multi | Update all | Pass | ? | [ ] |
| 8.7.6a | Errors | Invalid actor | Fail | ? | [ ] |
| 8.7.6b | Errors | Empty text | Pass | ? | [ ] |
| 8.7.6c | Errors | Long text | Pass | ? | [ ] |
| 8.7.6d | Errors | Case insensitive | Pass | ? | [ ] |

### Summary Statistics

- **Total Tests**: 20
- **Expected Passes**: 19
- **Expected Failures**: 1 (invalid actor - intentional)
- **Actual Passes**: ___
- **Actual Failures**: ___
- **Success Rate**: ___% (Expected: 95%+)

---

## Known Issues & Workarounds

### Issue: Text doesn't appear in viewport
**Workaround**: 
- Verify TextRenderActor exists: `query_level get_by_class TextRenderActor`
- Check actor is visible: Select actor in outliner, verify visibility
- Try moving camera closer to actor

### Issue: Unicode appears as boxes
**Cause**: TextRenderActor font doesn't support character set
**Workaround**:
- Expected for emoji (falls back to placeholders)
- For international text, may need custom font
- Test assumes default TextRender font (Limited support)

### Issue: Color appears different than expected
**Cause**: TextRenderActor applies lighting/shaders
**Workaround**:
- Colors will be affected by scene lighting
- Test in well-lit area
- Expected: R(1,0,0) shows red-ish, not pure red due to shading

### Issue: Alignment doesn't appear to work
**Cause**: TextRender component size may be default
**Workaround**:
- Alignment works relative to component bounds
- May not be visible unless component is larger
- Verify with `manage_component get` to see component size

---

## Performance Expectations

| Operation | Expected Time |
|-----------|----------------|
| Set text | < 100ms |
| Update text | < 100ms |
| Set with color | < 100ms |
| Spawn actor | < 200ms |
| Update 3 actors | < 300ms total |
| Invalid actor | < 50ms (error) |

---

## Cleanup After Testing

```bash
# Delete test actors
Tool: control_actor
Action: delete
Parameters: {actorName: "TestText"}

Tool: control_actor
Action: delete
Parameters: {actorName: "Title"}

Tool: control_actor
Action: delete
Parameters: {actorName: "Subtitle"}

# Save level
Tool: editor_lifecycle
Action: save_level
```

---

## Test Execution Log

**Tester**: _______________  
**Date**: _______________  
**UE Version**: 5.7  
**MCP Version**: 0.7.x  

### Session Notes

```
[Record any observations, issues, or notable findings here]


```

### Issues Found

```
[List any bugs discovered during testing]

Issue #1: ________________________________________________
Issue #2: ________________________________________________
Issue #3: ________________________________________________
```

### Recommendations

```
[Suggest improvements or additional tests]

1. ________________________________________________________
2. ________________________________________________________
3. ________________________________________________________
```

---

## Next Steps

### If All Tests Pass ✅
1. Mark Phase 8.7 as **COMPLETE & VERIFIED**
2. Begin Phase 8.8 (NavMesh Configuration) implementation
3. Update documentation with test results
4. Commit with message: `feat: Phase 8.7 testing complete - manage_ui verified`

### If Tests Fail ❌
1. Document issue in TODO.md
2. Debug with `@ue-debugger` agent
3. Fix in development
4. Re-test after fixes

### Phase 8.8 Preview

**Navigation Mesh Configuration** (`manage_navigation`)

| Feature | Action | Status |
|---------|--------|--------|
| Create nav volume | `create_nav_volume` | ⏳ Next |
| Configure areas | `set_nav_area` | ⏳ Next |
| Add modifiers | `add_nav_modifier` | ⏳ Next |
| Configure agents | `configure_nav_agent` | ⏳ Next |
| Build navmesh | `build_navigation` | ⏳ Next |

---

## References

### Tool Documentation
- **Tool File**: `src/tools/ui.ts`
- **Definitions**: `src/tools/consolidated-tool-definitions.ts`
- **Handlers**: `src/tools/consolidated-tool-handlers.ts`
- **Python Templates**: `src/utils/python-templates.ts`

### Related Documentation
- `PHASE_8_COMPLETION_2025-12-04.md` - Implementation details
- `WIDGET_TEXT_FIX_2025-12-04.md` - Technical deep-dive
- `AGENTS.md` - Tool capabilities overview

---

**Last Updated**: 2025-12-04  
**Status**: Ready for Testing
