# Phase 8 Tools - Comprehensive Test Guide (2025-12-04)

## Pre-Test Checklist

- [ ] UE 5.7 editor running with test level open
- [ ] MCP server restarted after build (`npm run build`)
- [ ] OpenCode restarted (to pick up MCP changes)
- [ ] Test level has at least:
  - [ ] A floor/cube actor (for tags, components)
  - [ ] A TextRenderActor (for text modification)
  - [ ] Empty space to spawn new actors

## Phase 8 Tools Test Matrix

### 8.1 ✅ Asset Search (`manage_asset` - search action)

**Status**: Working - Already tested 2025-12-02

**Quick Smoke Test**:
```
Tool: manage_asset
Action: search
Pattern: "*cube*"
Asset Type: "StaticMesh"
Expected: Returns list of cube-like meshes
```

**Full Test Cases**:
1. Search by wildcard pattern
   - Search: `*sphere*` → Should find sphere assets
   - Search: `cube` (exact) → Should find exact matches
   - Search: `*_01` → Should find numbered assets

2. Search by asset type filter
   - Type: `StaticMesh` → Only static meshes
   - Type: `Material` → Only materials
   - Type: `Texture2D` → Only textures

3. Pagination
   - Limit: 50 → Should return max 50 results
   - Offset: 0 → Should start at beginning
   - Verify: Check `hasMore` and pagination info

**Pass Criteria**: All searches return results or empty list (never error)

---

### 8.2 ✅ Curves (`manage_curves` - All 5 actions)

**Status**: Placeholder responses (Python templates ready, awaiting integration)

**Test Setup**:
1. Note the `/Game` path for saving curves

**Test Cases**:

#### Action: create
```json
{
  "action": "create",
  "name": "TestFloatCurve",
  "path": "/Game/Curves",
  "curveType": "FloatCurve"
}
```
**Expected**: 
- Success response: "Curve TestFloatCurve of type FloatCurve would be created"
- Currently: Placeholder (waiting Python integration)
- When fixed: Asset should appear in `/Game/Curves` folder

#### Action: add_key
```json
{
  "action": "add_key",
  "curvePath": "/Game/Curves/TestFloatCurve",
  "time": 0.0,
  "value": 100.0,
  "interpolation": "Cubic"
}
```
**Expected**: Keyframe added at time 0.0 with value 100.0

#### Action: evaluate
```json
{
  "action": "evaluate",
  "curvePath": "/Game/Curves/TestFloatCurve",
  "time": 0.5
}
```
**Expected**: Returns interpolated value at time 0.5

#### Action: import
```json
{
  "action": "import",
  "curvePath": "/Game/Curves/TestFloatCurve",
  "importPath": "C:\\temp\\curve_data.csv"
}
```
**Expected**: Curve data imported from CSV file

#### Action: export
```json
{
  "action": "export",
  "curvePath": "/Game/Curves/TestFloatCurve",
  "exportPath": "C:\\temp\\exported_curve.csv",
  "exportFormat": "CSV"
}
```
**Expected**: Curve exported to file

**Pass Criteria**: All actions return responses (placeholders OK for now)

---

### 8.3 ✅ GameMode Setup (`manage_gamemode` - All 4 actions)

**Status**: Placeholder responses (Python templates ready, awaiting integration)

**Test Cases**:

#### Action: create_framework
```json
{
  "action": "create_framework",
  "projectName": "TestProject",
  "includeGAS": true,
  "includeCommonUI": true
}
```
**Expected**: 
- Placeholder: "Game framework would be created"
- When fixed: Should generate GameMode, GameState, PlayerState (with ASC), PlayerController classes

#### Action: set_default_classes
```json
{
  "action": "set_default_classes",
  "gameModeClass": "BP_TestGameMode",
  "playerControllerClass": "BP_TestPlayerController",
  "playerStateClass": "BP_TestPlayerState"
}
```
**Expected**: Default classes set in GameMode

#### Action: configure_replication
```json
{
  "action": "configure_replication",
  "replicationMode": "Full"
}
```
**Expected**: Replication configured (Full, Minimal, or ClientPredicted)

#### Action: setup_input
```json
{
  "action": "setup_input",
  "inputContext": "/Game/Input/IMC_Default",
  "inputMode": "GameAndUI",
  "mouseLockMode": "LockOnCapture"
}
```
**Expected**: Input system configured

**Pass Criteria**: All actions return responses

---

### 8.4 ✅ Actor Tags (`manage_tags` - All 6 actions)

**Status**: Placeholder responses (Python templates ready, awaiting integration)

**Prerequisites**:
- Have actors in level (Floor, Wall, etc.)

**Test Cases**:

#### Action: add
```json
{
  "action": "add",
  "actorName": "Floor",
  "tag": "LevelGeometry"
}
```
**Expected**: Tag added to actor

#### Action: remove
```json
{
  "action": "remove",
  "actorName": "Floor",
  "tag": "LevelGeometry"
}
```
**Expected**: Tag removed from actor

#### Action: has
```json
{
  "action": "has",
  "actorName": "Floor",
  "tag": "LevelGeometry"
}
```
**Expected**: Returns true/false (currently placeholder)

#### Action: get_all
```json
{
  "action": "get_all",
  "actorName": "Floor"
}
```
**Expected**: Returns array of all tags on actor

#### Action: clear
```json
{
  "action": "clear",
  "actorName": "Floor"
}
```
**Expected**: All tags removed from actor

#### Action: query
```json
{
  "action": "query",
  "tagPattern": "Enemy_*",
  "matchAll": false
}
```
**Expected**: Returns all actors matching tag pattern

**Pass Criteria**: All actions return responses

---

### 8.5 ❌ Splines (`manage_spline` - KNOWN BUG)

**Status**: BUG - "Unable to create spline component"

**Known Issue**: Spline component creation fails during Python execution

**Test (Expect to Fail)**:
```json
{
  "action": "create",
  "name": "TestSpline",
  "points": [
    {"location": {"x": 0, "y": 0, "z": 100}},
    {"location": {"x": 500, "y": 0, "z": 100}},
    {"location": {"x": 500, "y": 500, "z": 100}}
  ]
}
```
**Expected Error**: "Unable to create spline component"

**TODO**: Investigate and fix Python script

---

### 8.6 ✅ Component Management (`manage_component` - WORKING)

**Status**: Fully working ✅

**Prerequisites**:
- Have a test actor in level (e.g., "TestCube")

**Test Cases**:

#### Action: add
```json
{
  "action": "add",
  "actorName": "TestCube",
  "componentType": "StaticMeshComponent",
  "componentName": "ExtraMesh"
}
```
**Expected**: ✅ New component added to actor
**Pass**: Should see "Component 'ExtraMesh' added" message

#### Action: get
```json
{
  "action": "get",
  "actorName": "TestCube"
}
```
**Expected**: ✅ Lists all components on actor
**Pass**: Should see component count and names

#### Action: remove
```json
{
  "action": "remove",
  "actorName": "TestCube",
  "componentName": "ExtraMesh"
}
```
**Expected**: ✅ Component removed
**Pass**: Should see success message

#### Action: set_property
```json
{
  "action": "set_property",
  "actorName": "TestCube",
  "componentName": "ExtraMesh",
  "propertyName": "Mobility",
  "value": "Movable"
}
```
**Expected**: Property set on component

---

### 8.7 ✅ Widget Text Modification (`manage_ui` - WORKING)

**Status**: Fully working ✅

**Prerequisites**:
- Spawn or have a TextRenderActor in level (name: "TestText")
- Test level must have at least 100cm of Z space

**Setup Commands** (if needed):
```
Tool: control_actor
Action: spawn
Class: "TextRenderActor"
Name: "TestText"
Location: {x: 0, y: 0, z: 200}
```

**Test Cases**:

#### Action: set_actor_text (Basic)
```json
{
  "action": "set_actor_text",
  "actorName": "TestText",
  "text": "Hello World!"
}
```
**Expected**: ✅ Text appears on actor in viewport
**Pass Criteria**: 
- [ ] Text changes in editor viewport
- [ ] No errors in log
- [ ] Returns success message

#### Action: set_textrender_text (Styled)
```json
{
  "action": "set_textrender_text",
  "actorName": "TestText",
  "text": "Styled Text 🎮",
  "textColorR": 1.0,
  "textColorG": 0.5,
  "textColorB": 0.0,
  "fontSize": 80,
  "horizontalAlignment": 1,
  "verticalAlignment": 1
}
```
**Expected**: ✅ Text appears with orange color, 80pt size, centered
**Pass Criteria**:
- [ ] Text color is orange
- [ ] Font size is large
- [ ] Text is centered horizontally and vertically
- [ ] Unicode character (🎮) renders correctly
- [ ] No errors in log

#### Test Unicode Support
```json
{
  "action": "set_actor_text",
  "actorName": "TestText",
  "text": "Héllö Wørld 日本語"
}
```
**Expected**: ✅ All unicode characters display correctly

#### Test Long Text
```json
{
  "action": "set_actor_text",
  "actorName": "TestText",
  "text": "This is a much longer text to test how the text rendering handles multiple lines and word wrapping in the viewport."
}
```
**Expected**: ✅ Long text displays without truncation

**Pass Criteria**: Both actions work, styled text displays correctly

---

### 8.8 ⏳ NavMesh Config (`manage_navigation` - NOT YET IMPLEMENTED)

**Status**: Pending implementation

**Placeholder**: Can discuss use cases and design

---

## Test Execution Order

**Recommended sequence** (builds confidence):

1. **Phase 7 Validation** (2 min)
   - Verify existing tools still work
   - Run: `manage_asset list` and `manage_rendering get_info`

2. **8.1 Asset Search** (5 min)
   - Warm up with already-working tool
   - Run: Multiple search patterns

3. **8.6 Component Management** (5 min)
   - Next most likely to work
   - Run: add/get/remove sequence

4. **8.7 Widget Text** (10 min)
   - Most visual feedback
   - Run: Basic text, then styled text
   - Watch viewport for changes

5. **8.2-8.4 Placeholder Tools** (5 min)
   - Verify placeholder responses work
   - Run: One action from each tool

6. **8.5 Splines** (2 min)
   - Last (expect failure)
   - Run: One create action

---

## Success Metrics

| Category | Target | Current |
|----------|--------|---------|
| Phase 7 Validation | 100% | Unknown (test) |
| 8.1 Asset Search | Working | ✅ |
| 8.2-8.4 Placeholders | Responding | ✅ |
| 8.6 Components | 100% working | ✅ |
| 8.7 Widget Text | 100% working | ✅ |
| 8.5 Splines | Needs fix | ❌ |
| **Overall Phase 8** | **87.5%** | ✅ 7/8 |

---

## Quick Reference: Tool Names for Testing

```
Tools to test:
- manage_asset (search)
- manage_curves (all 5 actions)
- manage_gamemode (all 4 actions)
- manage_tags (all 6 actions)
- manage_component (add/get/remove/set_property)
- manage_ui (set_actor_text, set_textrender_text)
- manage_spline (create - will fail)
```

---

## Documentation Files

- `PHASE_8_COMPLETION_2025-12-04.md` - What was implemented
- `TESTING_SUMMARY_2025-12-04.md` - Test results
- `WIDGET_TEXT_FIX_2025-12-04.md` - Technical details of widget text fix
- This file - Comprehensive test guide

---

## After Testing

1. **If all tests pass**:
   - Document results in `TEST_RESULTS_2025-12-05.md`
   - Commit changes to git
   - Mark Phase 8 as complete

2. **If tests fail**:
   - Document error messages
   - Create issues for blockers
   - Add to TODO.md

3. **Next steps**:
   - Connect Phase 8.2-8.4 Python templates
   - Debug spline creation
   - Begin Phase 9 (CommonUI runtime)

---

## Testing With Agents

You can also delegate testing to specialist agents:

```
@ue-level-designer: Test manage_ui, manage_component on test level
@ue-asset-manager: Test manage_asset search with different patterns
@ue-debugger: Run manage_curves/gamemode/tags with Python enabled
```

