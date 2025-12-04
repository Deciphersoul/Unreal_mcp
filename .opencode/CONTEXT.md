# UE MCP Extended - Shared Context

## Vision

2-person indie studio productivity tool. Goal: 5 hours saved/day per person.
Core principle: Stay in AI chat, minimize UE editor clicks. One command = 20 clicks.
Ultimate goal: **Full autonomous UE5 project creation by AI.**

## Design Principles

1. **C++ First**: Primary game logic in C++, Blueprints only for small tweaks/designer overrides
2. **Multiplayer by Default**: **Everything we build assumes multiplayer.** All systems use replication, RPCs, and server authority patterns from day one. Never build single-player-only code.
3. **Hybrid Generation**: MCP templates for UE boilerplate, Claude generates custom logic directly
4. **Iterate via IDE**: User rebuilds project from IDE between tests - MCP doesn't trigger builds

## Multiplayer Patterns (Always Use)

| System | Pattern | Why |
|--------|---------|-----|
| **GAS** | ASC on PlayerState | Survives pawn respawn, proper replication |
| **Variables** | `UPROPERTY(Replicated)` | Sync to clients |
| **Events** | `UFUNCTION(Server, Reliable)` | Server authority |
| **State** | GameState/PlayerState | Not on Actors that respawn |
| **Movement** | CharacterMovementComponent | Built-in prediction |
| **Spawning** | Server spawns, replicates | Never client-spawn gameplay actors |

## Test Project

- **Path**: `C:\Users\Decipher\Documents\Unreal Projects\TestProjectGenAI`
- **Engine**: UE 5.7 with Remote Control plugins enabled
- **Engine Install**: `E:\Unreal Engine`
- **Editor Exe**: `E:\Unreal Engine\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe`
- **Purpose**: Test MCP tool limitations → add missing features to TODO.md

## MCP Server Setup

- **Use local build**: `opencode.json` in repo root points to `./dist/cli.js`
- **Build before use**: Run `npm run build` after any code changes
- **Docker vs Local**: Docker MCP can't reach host UE (network isolation) - always use local build
- **Restart required**: After code changes AND build, restart OpenCode to pick up new MCP code
- **If "Unknown action" error**: MCP server needs restart - close and reopen terminal/session

## Testing Workflow

### When Implementing New Tools:
1. **Write implementation** in TypeScript
2. **Build**: `npm run build` (compiles to `dist/`)
3. **Restart MCP**: Close/reopen OpenCode or terminal session
4. **Start UE**: Ensure UE Editor is running with Remote Control enabled
5. **Test**: Use new tool actions
6. **Verify**: Check results and error handling

### UE Startup for Testing:
- **Editor mode**: Start UE in editor mode (not game mode)
- **Wait**: UE takes 30-60 seconds to fully start
- **Verify connection**: Use `debug_extended` action: `check_connection`
- **Port check**: `netstat -an | findstr 30010` should show LISTENING

### Automated Test Reports
- `npm run test:tools` executes the shared suite (currently 97 scenarios, with Spline Tools #1 expected to fail until the spline creation bug is fixed)
- Each run writes a JSON report under `tests/reports/` (filename `unreal-tool-test-results-<timestamp>.json`) for downstream agents to review
- **Important**: `control_actor.spawn` now accepts an optional `replaceExisting: true` flag that auto-deletes an existing actor label before spawning. Use it for automation loops (e.g., Actor Tools #4) instead of manual cleanup.

### Common Testing Issues:
- **"Unknown action"**: MCP not restarted after code changes
- **UE_NOT_CONNECTED**: UE not running or Remote Control not enabled
- **404 errors**: Wrong port (use 30010, not 30000) – MCP now defaults to 30010 after build, so seeing 30000 in logs means an override or stale env var
- **Python errors**: UE5.7 API changes - check TODO.md for workarounds

## UE 5.7 Remote Control Ports

| Port | Service | Purpose |
|------|---------|---------|
| **30000** | Conductor Web UI | Remote Control Web Interface (NOT the API) |
| **30002** | WebSocket (Conductor) | Multi-User Editing sync |
| **30010** | **HTTP API** | Remote Control API - **MCP uses this** |
| **30020** | WebSocket | Remote Control WebSocket - MCP connection status |

**Critical**: Port 30000 is Conductor UI, NOT the API. MCP must use port **30010** for HTTP, and our env defaults now point here—override only if your UE project truly runs the API elsewhere.

## Required UE Project Settings

Default settings work fine. Just ensure in **Edit → Project Settings → Plugins → Remote Control**:
- ✅ Auto Start Web Server = True (default)

### Optional Settings for Full Functionality

The MCP tools work in **two modes**:

1. **Limited Mode (default)** - Uses direct Remote Control API calls only
   - No UE settings changes needed
   - Most actor/asset operations work
   - Some features unavailable (PIE control, console commands, viewmodes)

2. **Full Mode** - Enable Python + Console commands in UE
   - In **Project Settings → Plugins → Remote Control API**:
     - ✅ Allow Remote Python Execution = True
     - ✅ Allow Console Command Remote Execution = True
   - Unlocks: PIE play/stop, viewmode switching, advanced queries

## Common Port Issues

- **Port 30010 not listening**: Usually means another UE instance grabbed the port, or UE didn't start cleanly
- **Fix**: Close ALL UE instances, reboot if needed, then start fresh
- **Verify**: `netstat -an | findstr 30010` should show LISTENING after UE starts

## Required UE Plugins

Enable in **Edit → Plugins**:
- **Remote Control API** - Core HTTP/WS endpoints (required)
- **Remote Control Web Interface** - WebSocket bridge (required)
- **Editor Scripting Utilities** - Editor subsystems (required)
- **Python Editor Script Plugin** - Python execution (optional - for Full Mode only)
- **Level Sequence Editor** + **Sequencer** - Required for `manage_sequence` tools (optional - for cinematics)

## API Priority Architecture

**Tools must follow this priority order:**

1. **Direct Remote Control API** (always try first)
   - `/remote/object/call` with EditorActorSubsystem, UnrealEditorSubsystem, etc.
   - `/remote/object/property` for reading/writing properties
   - `/remote/search/assets` for asset queries
   
2. **Graceful degradation** when RC API can't do something
   - Inform user what's limited
   - Suggest enabling Python for full functionality
   
3. **Python as last resort** (only when RC API has no equivalent)
   - Complex queries requiring iteration/filtering
   - Operations with no exposed RC function

### Direct RC API Capabilities (No Python)

| Operation | RC Endpoint | Function |
|-----------|-------------|----------|
| Spawn actor from mesh | `/remote/object/call` | `EditorActorSubsystem.SpawnActorFromObject` |
| Spawn actor from class | `/remote/object/call` | `EditorActorSubsystem.SpawnActorFromClass` |
| Delete actor | `/remote/object/call` | `EditorActorSubsystem.DestroyActor` |
| Get all actors | `/remote/object/call` | `EditorActorSubsystem.GetAllLevelActors` |
| Get selected actors | `/remote/object/call` | `EditorActorSubsystem.GetSelectedLevelActors` |
| Set selection | `/remote/object/call` | `EditorActorSubsystem.SetActorSelectionState` |
| Clear selection | `/remote/object/call` | `EditorActorSubsystem.ClearActorSelectionSet` |
| Set actor transform | `/remote/object/call` | `EditorActorSubsystem.SetActorTransform` |
| Set camera position | `/remote/object/call` | `UnrealEditorSubsystem.SetLevelViewportCameraInfo` |
| Get camera position | `/remote/object/call` | `UnrealEditorSubsystem.GetLevelViewportCameraInfo` |
| Save level | `/remote/object/call` | `EditorLoadingAndSavingUtils.SaveCurrentLevel` |
| Search assets | `/remote/search/assets` | (direct endpoint) |
| Read/write properties | `/remote/object/property` | (direct endpoint) |
| Describe object | `/remote/object/describe` | (direct endpoint) |

### Requires Python (Full Mode Only)

| Operation | Why |
|-----------|-----|
| PIE play/stop | Needs console command or Python |
| ViewMode switching | Needs console command |
| Build lighting | Needs LevelEditorSubsystem Python call |
| Complex actor filtering | RC returns paths only, need iteration |
| Get actor details (class, tags, etc.) | Need to call multiple RC functions per actor |

## Code Quality Standards

- **Target**: ~500 lines per file
- **Soft limit**: 1000 lines (consider refactoring)
- **Exception**: Coherent single-purpose files over 1000 lines are OK if well-structured
- **At 500+ lines**: consider helper functions or splitting
- **Priority**: clean helpers > new features
- **Avoid**: Splitting files that would constantly cross-reference each other
- Strong project structure for long-term viability

### Files Over 1000 Lines (Acceptable)
| File | Lines | Reason OK |
|------|-------|-----------|
| `consolidated-tool-handlers.ts` | ~2200 | All 25 tools in one switch - splitting would require complex imports |
| `consolidated-tool-definitions.ts` | ~1800 | All 25 tool schemas - splitting fragments the API surface |

| `lighting.ts` | ~1400 | 14 coherent lighting methods |
| `actors.ts` | ~1150 | 10 coherent actor methods |
| `blueprint.ts` | ~1050 | 7 coherent blueprint methods |
| `physics.ts` | ~1000 | ragdoll setup alone is 450+ lines |

## Current Roadmap Status

See **TODO.md** for full roadmap (Phases 6-11).

| Phase | Focus | Status |
|-------|-------|--------|
| 1-5 | Foundation, RC API, testing | ✅ Complete |
| 6 | C++ Workflow (templates, GAS, CommonUI) | ✅ Complete & Tested 2025-12-02 |
| 7 | Easy Wins (Materials, Rendering, Input, Collision, Sequence) | ✅ Complete 2025-12-02 |
  | **8** | Medium Features (8 items, reordered easy→hard) | **In Progress** (6/8 complete - 8.1-8.6 implemented, 8.2-8.4 still placeholder-backed) |
 | 9 | CommonUI Runtime → GAS Runtime | Pending |

 | 10 | Blueprint Graph Editing (needs C++ plugin) | Lower Priority |
 | 11 | Advanced/Research (World Partition, Skeletal, BT, PCG, etc.) | Future |

### Phase 8 Order (Easy → Hard) - Testing Update 2025-12-05

1. ✅ **Asset Search** (`manage_asset` add `search`) - ✅ TESTED 2025-12-04
   - Search by name pattern (wildcards: `*cube*`, `material_*`)
   - Filter by asset type (`StaticMesh`, `Material`, `Texture2D`, etc.)
   - Recursive directory search with pagination
   - Returns metadata: total count, hasMore, pagination info
   - **Status**: WORKING ✅

2. ✅ **Curves** (`manage_curves`) - ✅ CREATE/ADD/EVALUATE wired (import/export pending)
   - Create curve assets (FloatCurve, VectorCurve, TransformCurve)
   - Add keyframes with interpolation settings
   - Evaluate curves at specific times
   - Import/export curve data (CSV/JSON)
   - **Status**: Curve creation plus `add_key`/`evaluate` now operate on the underlying RichCurve data (fix landed Dec 5; rebuild + restart MCP before testing). Import/export remain placeholder-only until dedicated templates are added.
   - **Next Step**: Implement real import/export scripts.

3. ✅ **GameMode Setup** (`manage_gamemode`) - ✅ RETURNS PLACEHOLDER (Python not connected yet)
   - Create multiplayer game framework (GameMode, GameState, PlayerState, PlayerController)
   - Set default classes for multiplayer projects
   - Configure replication modes (Full, Minimal, ClientPredicted)
   - Setup input with Enhanced Input System
   - **Status**: All 4 actions still return placeholder responses (confirmed during Dec 5 tests)
   - **Next Step**: Connect Python templates in `consolidated-tool-handlers.ts`

4. ✅ **Actor Tags** (`manage_tags`) - ✅ RETURNS PLACEHOLDER (Python not connected yet)
   - Add/remove tags from actors
   - Query actors by tag patterns with wildcards (`Enemy_*`, `*_Door`)
   - Check if actors have specific tags
   - Clear all tags from actors
   - **Features**: AND/OR logic for tag queries, batch operations
   - **Status**: All 6 actions still return placeholder responses (confirmed during Dec 5 tests)
   - **Next Step**: Connect Python templates in `consolidated-tool-handlers.ts`

5. ✅ **Splines** (`manage_spline`) - ❌ HAS BUG (Cannot create spline component)
   - Create spline actors, add/update/remove points, inspect data, and sample along the curve
   - **Status**: Fails with "Unable to create spline component" error
   - **Issue**: Python spline spawning failing - needs investigation
   - **Next Step**: Debug spline creation Python script

6. ✅ **Component Management** (`manage_component`) - ✅ FULLY WORKING
   - Add, remove, list, and now edit component properties (Mobility included) on placed level actors.
   - **Status**: Setter now routes through `set_editor_property` with enum conversion so mobility toggles succeed; rebuild + restart MCP before re-testing to load the new Python helpers.
   - **Next Step**: None for core actions; future work is ergonomic improvements only.

7. **Phase 7 Tools (Materials, Rendering, Input, Collision)** - ✅ ALL WORKING 2025-12-04
   - All Phase 7 tools verified working: `manage_material`, `manage_rendering`, `manage_input`, `manage_collision`

8. **Widget Text Modification** (`manage_ui`) - ✅ FULLY WORKING 2025-12-05
   - **FIXED**: Created `manage_ui` tool with proper FText marshaling
   - **Actions**: `set_actor_text` (basic), `set_textrender_text` (styled with color/size/alignment)
   - **Features**: Unicode text support, RGB color (0.0-1.0 range), alignment options, large/small font sizes, emoji, long copy
   - **Implementation**: Python-based with proper `unreal.FText()` marshaling
   - **Status**: Deep-tested in UE5.7 (Phase8TestText + Phase8Headline) across basic/styled/unicode/long/error scenarios using Quick Iteration Loop.
 
### Active Tool Gaps (Dec 2025)
- `query_level.get_all`/`get_by_*` currently respond with `success` but return empty payloads even when actors exist. Agents must confirm actor labels manually.
- `manage_gamemode` + `manage_tags` still surface placeholder responses only; no UE changes occur yet.
- `manage_spline.create` returns "Unable to create spline component"; spline authoring is blocked until Python script is fixed.
- `manage_curves` import/export remain placeholder (create/add/evaluate now fixed once MCP is rebuilt/restarted).
- `manage_ui` is now the preferred way to author TextRender content (unicode, styled, multi-actor) and is safe to use for story scripting.
 
 
 ## Key UE Systems to Support


### Gameplay Ability System (GAS)
- **Pattern**: ASC on PlayerState (multiplayer-ready)
- **C++ Classes**: `UAttributeSet`, `UGameplayAbility`, `UGameplayEffect`
- **Phase 6**: C++ scaffolding templates
- **Phase 9**: Runtime control (grant abilities, apply effects, query tags)

### CommonUI
- **Purpose**: Cross-platform UI (gamepad/keyboard/touch input handling)
- **C++ Classes**: `UCommonActivatableWidget`, `UCommonButtonBase`
- **Phase 6**: C++ scaffolding templates  
- **Phase 9**: Runtime widget stack control

## C++ Code Generation

Claude can generate C++ directly for:
- Custom game logic
- Extending existing classes
- Complex systems integration

MCP will provide templates (Phase 6) for:
- Standard UE boilerplate (UCLASS, UPROPERTY, UFUNCTION macros)
- GAS AttributeSet with ATTRIBUTE_ACCESSORS
- CommonUI widget base classes
- DataAsset/DataTable structures

## Extracted Utility Files (Phase 2-7 Refactor)

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `src/utils/python-templates.ts` | 242 | Python script templates | `PYTHON_TEMPLATES`, `fillTemplate()` |
| `src/utils/viewmode.ts` | 197 | Viewmode validation | `VIEWMODE_ALIASES`, `validateViewmode()`, `getSafeAlternative()` |
| `src/utils/command-queue.ts` | 240 | Command throttling | `CommandQueue`, `CommandPriority` |
| `src/utils/safe-commands.ts` | 134 | Command safety | `SAFE_COMMANDS`, `isCrashCommand()`, `isDangerousCommand()` |
| `src/utils/python.ts` | 114 | Script generators | `generatePluginCheckScript()`, `ENGINE_VERSION_SCRIPT` |
| `src/utils/python-output.ts` | 351 | Output parsing | `parseStandardResult()`, `toPythonOutput()` |
| `src/tools/handlers/handler-utils.ts` | 199 | Tool handler utilities | `log`, `requireAction`, `elicitMissingPrimitiveArgs`, `cleanObject` |

When adding new functionality:
1. Check if existing utility can be extended
2. If new utility needed, keep it focused (<300 lines)
3. Export constants and functions, not classes when possible
4. Use existing patterns (e.g., `RESULT:` prefix for Python output parsing)

## Tool Reference (25 Tools)


| Tool | Purpose | Key Actions |
|------|---------|-------------|
| `query_level` | Find actors in scene | get_all, get_selected, get_by_class, get_by_tag, get_by_name, count |
| `manage_selection` | Editor selection | select, deselect, clear, select_all_of_class, invert |
| `control_actor` | Spawn/transform actors | spawn, delete, transform, batch_spawn, set_material, apply_force |
| `inspect` | Read/write properties | inspect_object, set_property |
| `control_editor` | PIE and camera | play, stop, pause, set_camera, set_view_mode |
| `editor_lifecycle` | Save/reload | save_level, save_all, hot_reload, restart_pie, load_level, get_state |
| `manage_asset` | Asset operations | list, import, create_material, **search** |
| `manage_blueprint` | Blueprint creation | create, add_component |
| `manage_level` | Level operations | load, save, create_light, build_lighting |
| `build_environment` | Landscape/foliage | create_landscape, sculpt, add_foliage |
| `create_effect` | VFX and debug | particle, niagara, debug_shape |
| `animation_physics` | Animation | create_animation_bp, play_montage, setup_ragdoll |
| `manage_sequence` | Cinematics | create, open, add_camera, add_actor, play, stop, add_transform_keyframe, add_camera_cut, add_property_track, add_audio_track, add_event_track |
| `system_control` | System utilities | play_sound, screenshot, profile, set_quality, read_log |
| `debug_extended` | Debugging | get_log, get_errors, start_watch, stop_watch, check_connection |
| `project_build` | Packaging | validate, cook, package, build_lighting, build_all |
| `manage_rc` | Remote Control | create_preset, expose_actor, set_property |
 | `console_command` | Console commands | (direct execution) |
 | **`manage_cpp`** | C++ scaffolding (Phase 6) | create_class, add_property, add_function, create_gas_playerstate, create_gas_gamemode, create_gameplay_effect |
 | **`manage_input`** | Enhanced Input (Phase 7) | create_action, create_context, add_mapping, get_mappings, remove_mapping, list_actions, list_contexts | ✅ All tested 2025-12-02 |
 | **`manage_material`** | Material Instances (Phase 7) | create_instance, set_scalar, set_vector, set_texture, get_parameters, copy | ✅ Tested |
 | **`manage_rendering`** | Rendering Settings (Phase 7) | set_nanite, get_nanite, set_lumen, get_lumen, set_vsm, set_anti_aliasing, set_ray_tracing, set_post_process | ✅ Console commands work |
 | **`manage_collision`** | Collision Settings (Phase 7) | set_profile, set_response, set_enabled, get_settings | ✅ All 4 tested 2025-12-02 |
 | **`manage_curves`** | Curve Assets (Phase 8.2) | create, add_key, evaluate (Python), import/export (placeholder) | ⚠️ Create works; `add_key`/`evaluate` currently error (`'CurveFloat' object has no attribute add_key/get_keys'`). |

  | **`manage_gamemode`** | Game Framework (Phase 8.3) | create_framework, set_default_classes, configure_replication, setup_input | ✅ Implemented 2025-12-02 (placeholder) |
  | **`manage_tags`** | Actor Tags (Phase 8.4) | add, remove, has, get_all, clear, query | ✅ Implemented 2025-12-02 (placeholder) |
  | **`manage_component`** | Component authoring (Phase 8.6) | add, remove, get | ✅ add/get/remove working; `set_property` Mobility writes still pending. |
  | **`manage_spline`** | Spline authoring (Phase 8.5) | create, add_point, set_point, remove_point, get_points, sample | ❌ `create` fails with "Unable to create spline component" (Dec 5 tests). |



## Coordinates & Units

- **Axes**: X=Forward (Red), Y=Right (Green), Z=Up (Blue)
- **Units**: Centimeters
- **Rotation**: Degrees - Pitch (Y), Yaw (Z), Roll (X)

## Map Convention

- **Test maps**: `Test_[Feature]_v[N]` (e.g., `Test_Collision_v1`, `Test_Lighting_v2`)
- **Before using existing map**: Check it won't conflict with current tests
- **When to create new**: No suitable map exists, or existing would be disrupted

## Error Recovery

| Situation | Action |
|-----------|--------|
| Connection failed | Verify UE running with Remote Control enabled |
| Tool returns error | Run `check_connection`, then retry once |
| PIE crash | Run `get_errors`, `stop`, inspect last action |
| Unexpected behavior | Run `get_log` with relevant category filter |
| Actor not found | Run `query_level` to verify name/path |
| ECONNREFUSED 127.0.0.1:30010 | UE not running, or port blocked by another UE instance - close all UE, restart |
| 404 on all tools but check_connection OK | MCP using wrong port (30000 instead of 30010) - update opencode.json |
| Port 30010 not listening after UE start | Another process grabbed port, or unclean shutdown - reboot and restart UE |
| 400 errors on most tools | Either Python disabled (expected in Limited Mode) or Python bridge not connected |
| check_connection says OK but tools fail | Known bug - check_connection reads cached flag, not actual connectivity |
| "Object cannot be accessed remotely" | RC settings blocking access - check Allow Remote Python Execution |
| "Console commands not enabled" | RC settings - check Allow Console Command Remote Execution |
| 404 on `/remote/script/execute` | Python execution disabled - this is expected in Limited Mode |

## Log Categories

- `LogBlueprint` - Blueprint compile/runtime errors
- `LogPhysics` - Physics and collision issues
- `LogPython` - Python script execution
- `LogTemp` - Temporary debug output
- `LogActor` - Actor lifecycle events

## Session Startup Checklist

1. Ensure opencode is running from `D:\Unreal\UE_mcp_extended` directory
2. Verify MCP is local build (not Docker) - check for ECONNREFUSED errors
3. Run `debug_extended` check_connection
4. Run `query_level` count - if 400 error, Python bridge issue
5. Run `editor_lifecycle` get_state - confirm correct project loaded

## When Stuck

Can't accomplish something with current tools? Add to `TODO.md`:
1. What you tried
2. What's missing (tool/action/parameter)
3. Suggested solution or workaround

## Reference Materials

- **RC API examples**: `D:\Unreal\AI work\` - Contains working JSON payloads for curl commands
- **RC API documentation**: `D:\Unreal\AI work\UE_Remote_Control_Commands.md` - Comprehensive command reference
- **Test with curl**: `curl -s http://127.0.0.1:30010/remote/info` - Verify RC API is responding
- **Windows test sounds**: `C:\Windows\Media\` - WAV files (ding.wav, chord.wav, etc.) for audio testing

## MCP Response Format

**Important**: Tool responses show summary text only. Detailed data is in `structuredContent` which doesn't display in the output.

**Workaround to see hidden data**:
- For `get_bindings`: Try an invalid name with `add_camera_cut` - error message lists all bindings
- For asset lists: Check `structuredContent` field if available
- For detailed results: The data exists but may need error-path discovery

## Key Learnings (Phase 1-2)

### What Works Well
- **Direct RC API** is reliable for: spawn, delete, select, camera, save
- **Python fallback** works when properly wrapped with `RESULT:` output parsing
- **Command throttling** prevents UE from being overwhelmed (100-500ms delays)
- **Viewmode safety** - blocking dangerous viewmodes prevents crashes

### Common Pitfalls
- **Don't use Python for what RC API can do** - RC is faster and works without settings
- **Always wrap Python output** with `RESULT:{json}` for reliable parsing
- **Dangerous console commands** (`buildpaths`, `rebuildnavigation`) can crash UE - blocked at HTTP level; our safe-command filter allows standard UE Python snippets (even ones containing `system(`) but still blocks real OS calls like `import os`, `os.system`, etc.
- **Multi-line Python** needs special handling - use `ExecutePythonCommandEx` with `ExecuteFile` mode

### Testing New Tools
1. Test with Full Mode enabled first (easier debugging)
2. Then test Limited Mode to verify graceful degradation
3. Check both success and error paths
4. Verify cleanup (delete test actors, save level)

### Python Script Pattern
```python
import unreal, json
try:
    # Your logic here
    result = {...}
    print('RESULT:' + json.dumps(result))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
```

### Boolean Values in Python Templates
When inserting JavaScript boolean values into Python templates, always convert to Python syntax:
```typescript
// WRONG - inserts JavaScript 'true'/'false'
recursive = ${recursive}

// CORRECT - inserts Python 'True'/'False'  
recursive = ${recursive ? 'True' : 'False'}
```

**Common pattern**: Use ternary operator to convert boolean parameters:
- `enabled = ${params.enabled ? 'True' : 'False'}`
- `additive = ${additive ? 'True' : 'False'}`
- `includeHidden = ${includeHidden ? 'True' : 'False'}`

### UE5.7 API Breaking Changes

**ARFilter** - Can't set `package_paths` on instances:
```python
# BROKEN in UE5.7:
filter = unreal.ARFilter()
filter.set_editor_property('package_paths', ['/Game'])  # Fails!

# WORKING in UE5.7:
assets = asset_registry.get_assets_by_class(
    unreal.TopLevelAssetPath('/Script/ModuleName', 'ClassName')
)
```

**Missing Classes in UE5.7:**
- `unreal.RendererSettings` - doesn't exist, use console commands instead
- `unreal.InputActionFactory` - doesn't exist, use `factory=None` with `create_asset`
- `unreal.InputMappingContextFactory` - doesn't exist, use `factory=None` with `create_asset`
- `unreal.PluginManager` - not exposed to Python, returns None
- `unreal.PluginsEditorSubsystem` - doesn't exist in Python API
- `unreal.PluginsSubsystem` - doesn't exist in Python API

**Constructor Limitations in UE5.7:**
- `unreal.Key(key_name)` - doesn't accept constructor args, use `key.set_editor_property('key_name', value)` instead

**Name Objects in UE5.7:**
- `asset.asset_name` returns `Name` object, not string - must convert with `str()`
- `asset.asset_class_path.asset_name` also returns `Name` object
- `asset.package_name` returns `Name` object
- **Fix**: Always wrap with `str()`: `str(asset.asset_name)`, `str(asset.package_name)`, etc.
- **JSON serialization**: `Name` objects cause "Object of type Name is not JSON serializable" error

**Enum Naming in UE5.7:**
- `InputActionValueType` uses underscores: `AXIS_1D`, `AXIS_2D`, `AXIS_3D` (not `AXIS1D`)
- `CollisionResponseType` / `CollisionChannel` - naming varies, use discovery pattern below
- Always use try/except when accessing enum values - naming may vary between UE versions

**Collision Enum Discovery Pattern:**
```python
# UE5.7 collision enums have unpredictable naming (ECR_IGNORE vs IGNORE vs Ignore)
# Use fallback pattern that tries multiple names:
for attr in ['IGNORE', 'ECR_IGNORE', 'Ignore']:
    if hasattr(unreal.CollisionResponseType, attr):
        response_enum = getattr(unreal.CollisionResponseType, attr)
        break
# Ultimate fallback: index into enum list
if response_enum is None:
    response_enum = list(unreal.CollisionResponseType)[index]
```

**Asset Creation in UE5.7:**
```python
# Use factory=None, UE auto-detects correct factory
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset = asset_tools.create_asset(
    asset_name=name,
    package_path=save_path,
    asset_class=unreal.InputAction,  # or other class
    factory=None  # Let UE figure it out
)
```

### Asset Creation Guardrails (2025-12-03)
- Every "create" flow must check `EditorAssetLibrary.does_asset_exist` before touching disk.
- If the asset already exists (e.g., `/Game/UI/Widgets/MCP_Widget`), tools return a success message describing the existing asset instead of prompting UE to overwrite.
- To replace an asset, delete/rename it (or provide a new path) before re-running automation; automatic overwrites are disallowed.
- When in doubt, run `manage_asset` `list`/`search` first so inputs reference a unique destination.

### UI Tool Reliability (2025-12-04)
- `system_control.create_widget` now sanitizes names (`My Widget` → `My_Widget`), auto-creates `/Game/UI/Widgets` if missing, and accepts an optional `savePath` override if you need another folder.
- `system_control.show_widget` verifies the widget blueprint asset exists (and is actually a widget) before issuing console commands, returning a clear error when the asset is missing.
- Both actions surface the resolved asset path (and any sanitization warnings) in their structured responses so dependent agents can react accordingly.

**Sequencer API Changes in UE5.7:**
- `MovieScene.add_master_track()` - REMOVED, use `MovieSceneSequenceExtensions.add_track(seq, TrackClass)`
- `MovieScene.get_master_tracks()` - REMOVED, use `MovieSceneSequenceExtensions.get_tracks(seq)`
- `MovieSceneSequenceExtensions.get_master_tracks()` - REMOVED, use `get_tracks()`
- `get_display_name()` - Returns `FText` not `str`, must convert: `str(track.get_display_name())`
- Track sections `get_start_frame()`/`get_end_frame()` - Return objects, convert: `int(section.get_start_frame())`
- `set_start_frame(FrameNumber)` - May fail with type error, use `set_start_frame_bounded()` or `set_range()`
- Property tracks: `get_name()` doesn't return property path - use `get_property_path()` or `get_property_name()`
- Event channels: `add_key(frame)` requires second arg `MovieSceneEvent()` payload
- `add_spawnable_from_class()` - May not exist on `LevelSequenceEditorSubsystem`, try `MovieSceneSequenceExtensions` or spawn+convert pattern

**Transform Track Channel Layout (UE5.7):**
Transform tracks don't support `section.add_key()` - must use channels directly:
```python
channels = section.get_all_channels()  # Returns 9 channels for transform
# Channels 0-2: Location X, Y, Z
# Channels 3-5: Rotation Pitch, Yaw, Roll  
# Channels 6-8: Scale X, Y, Z
channels[6].add_key(frame_num, scale_x, unreal.MovieSceneKeyInterpolation.RCIM_CUBIC)
channels[7].add_key(frame_num, scale_y, unreal.MovieSceneKeyInterpolation.RCIM_CUBIC)
channels[8].add_key(frame_num, scale_z, unreal.MovieSceneKeyInterpolation.RCIM_CUBIC)
```
Same pattern for Color tracks (4 channels: R, G, B, A) and other multi-channel tracks.

**Sequencer Binding Names:**
- When adding actor to sequence, binding name = actor label (not internal path name)
- Use `MovieSceneBindingExtensions.get_name(binding)` to get binding name
- Camera bindings get auto-generated names like `CineCameraActor6` (with number suffix)
- **Tip to discover binding names**: Try an invalid camera name with `add_camera_cut` - the error lists all available bindings

**Property Tracks vs Transform Keyframes:**
- For **transform properties** (RelativeScale3D, RelativeLocation, RelativeRotation): Use `add_transform_keyframe`
- For **other properties** (Intensity, Color, etc.): Use `add_property_track` + `add_property_keyframe`
- `add_property_track` auto-detects transform properties and returns guidance to use the correct action

**Reliable Patterns:**
- Console commands (`r.Lumen.*`, `r.Shadow.*`) always work for rendering
- `EditorAssetLibrary` for asset CRUD operations
- `EditorActorSubsystem` for actor operations
- `AssetToolsHelpers.get_asset_tools()` for asset creation with `factory=None`
- `MovieSceneSequenceExtensions` for all sequence/track operations
- `MovieSceneBindingExtensions` for binding-specific track operations

**Plugin Check Fallback (2025-12-02 Fix):**
UE 5.7 does NOT expose plugin status APIs to Python:
- `unreal.PluginManager.get()` returns `None`
- `unreal.PluginsEditorSubsystem` doesn't exist
- `unreal.PluginsSubsystem` doesn't exist

The fix: When **neither** plugin API is available (common in UE5.7), we **assume plugins are enabled** 
and let the operation attempt - it will fail with a real error if plugins are actually missing. 
This is better UX than blocking operations that would have worked.

### RC API Call Pattern
```typescript
await this.httpCall('/remote/object/call', 'PUT', {
  objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
  functionName: 'SpawnActorFromObject',
  parameters: { ObjectToUse: assetPath, Location: { X, Y, Z } },
  generateTransaction: false
});
```

## Error Handling Patterns (Phase 3 Learnings)

### What Returns Errors vs Empty Results
| Scenario | Expected Behavior |
|----------|-------------------|
| Actor not found (delete/force) | Error with message |
| Invalid asset path (spawn) | Error with suggestion |
| Invalid level path (load) | Error with path |
| Class/tag/name no match (query) | Success with empty array |
| Selection no match | Success with count: 0 |
| Invalid blueprint name | Error with details |
| Dangerous command | Error "blocked for safety" |
| Empty command | Success (no-op) |

### Connection Checking
The `check_connection` action now makes an actual HTTP call:
```typescript
// Makes GET request to /remote/info with 5s timeout
// Returns: connected, responseTimeMs, error details
```

### Input Validation Gaps (Known)
- `build_lighting` quality param: Invalid values silently default
- `manage_selection`: No warning when 0 actors matched
- These are documented in TODO.md Missing Features

### Direct RC API Debugging

**Test RC calls directly with curl:**
```bash
# Get all actors (returns internal paths, not labels)
curl -s -X PUT "http://localhost:30010/remote/object/call" -H "Content-Type: application/json" -d '{"objectPath": "/Script/UnrealEd.Default__EditorActorSubsystem", "functionName": "GetAllLevelActors", "parameters": {}}'

# Get actor label (what user sees)
curl -s -X PUT "http://localhost:30010/remote/object/call" -H "Content-Type: application/json" -d '{"objectPath": "/Game/Map.Map:PersistentLevel.ActorInternalName", "functionName": "GetActorLabel", "parameters": {}}'

# Test simple Python
curl -s -X PUT "http://localhost:30010/remote/object/call" -H "Content-Type: application/json" -d '{"objectPath": "/Script/PythonScriptPlugin.Default__PythonScriptLibrary", "functionName": "ExecutePythonCommand", "parameters": {"PythonCommand": "print(\"hello\")"}}'
```

## Debugging UE Python API

When encountering API issues (wrong enum names, missing attributes), use this pattern to inspect:

```bash
# Run Python to list enum values or class attributes
curl -s -X PUT "http://localhost:30010/remote/object/call" \
  -H "Content-Type: application/json" \
  -d '{"objectPath": "/Script/PythonScriptPlugin.Default__PythonScriptLibrary", "functionName": "ExecutePythonCommand", "parameters": {"PythonCommand": "import unreal; print([a for a in dir(unreal.InputActionValueType) if not a.startswith(\"_\")])"}}'
```

Note: Output goes to UE Output Log, not curl response. Check UE log or wrap with `RESULT:` prefix.

**Common discovery patterns:**
- Enum values: `dir(unreal.EnumClass)`
- Class methods: `dir(unreal.ClassName)`
- Property names: `asset.get_editor_properties()`

## Testing Checklist (Phase 3)

Before releasing changes, test these categories:
1. **Happy path**: spawn → query → select → delete → save
2. **Error paths**: invalid names, paths, classes
3. **Edge cases**: empty inputs, special characters
4. **Safety**: dangerous commands blocked
5. **Connection**: check_connection with UE running and stopped

## MCP Server Restart Required - CRITICAL

**After ANY code changes, you MUST restart the MCP server:**
1. Run `npm run build` to compile TypeScript to `dist/`
2. **Close and reopen OpenCode** (or restart the MCP process)
3. The running MCP server uses the OLD compiled code from `dist/` until restarted

**Why this happens:**
- MCP server loads compiled JavaScript from `dist/` directory at startup
- `npm run build` updates files in `dist/` but doesn't reload the running process
- OpenCode maintains a persistent MCP server process

**Signs MCP needs restart:**
- Fix was applied but behavior unchanged
- New actions show "Unknown action" error  
- Code changes don't take effect
- Python syntax errors persist after fix
- Tool returns same error despite code changes

**Workflow for fixing tools:**
1. Identify and fix bug in `src/` TypeScript files
2. Run `npm run build` to compile changes
3. **Tell user to restart OpenCode** (critical step!)
4. After restart, test the fixed action
5. Update TODO.md with results

## Testing New/Fixed Tools

After fixing a tool:
1. `npm run build` - compile changes
2. **Tell user to restart OpenCode** - critical step
3. After restart, test the specific action that was fixed
4. Update TODO.md with results

**Phase 6 C++ Tools - All Tested (2025-12-02):**
- `manage_cpp` create_class, add_property, add_function ✅
- `manage_cpp` create_gas_playerstate, create_gas_gamemode, create_gameplay_effect ✅
- `manage_cpp` create_widget_stack_manager, create_input_action_data_asset ✅
- `manage_cpp` create_datatable_struct, create_primary_data_asset ✅
- `manage_cpp` add_module_dependency, get_module_dependencies, enable_plugin ✅

**Phase 7 Input Tools - All Tested (2025-12-02):**
- `manage_input` create_action, create_context ✅
- `manage_input` list_actions, list_contexts ✅
- `manage_input` add_mapping - ✅ fixed (needs OpenCode restart)
- `manage_rendering` get_info, get_lumen, set_lumen ✅
- `manage_material` create_instance, get_parameters ✅

**Phase 7 Collision Tools - All Tested (2025-12-02):**
- `manage_collision` get_settings ✅
- `manage_collision` set_profile ✅
- `manage_collision` set_enabled ✅
- `manage_collision` set_response ✅ **FIXED** - enum fallback pattern works

**Phase 7 Sequence Track Tools - All Tested & Passing (2025-12-02):**

| Action | Status | Notes |
|--------|--------|-------|
| create | ✅ | Works |
| open | ✅ | Works |
| add_camera | ✅ | Works - camera gets auto-name like `CineCameraActor6` |
| set_properties | ✅ | Works |
| add_actor | ✅ | Works - binding name = actor label |
| add_actors | ✅ | Batch add works |
| remove_actors | ✅ | Batch remove works |
| get_bindings | ✅ | Works (details in structuredContent) |
| add_transform_keyframe | ✅ | Works - use for location/rotation/scale |
| add_camera_cut_track | ✅ | Works |
| add_camera_cut | ✅ | Camera binding names have number suffix (e.g., CineCameraActor6) |
| get_tracks | ✅ | Works (FText fix applied) |
| play/pause/stop | ✅ | Works |
| set_playback_speed | ✅ | Works |
| get_properties | ✅ | Works |
| add_property_track | ✅ | For transform props, returns existing track with guidance |
| add_property_keyframe | ✅ | Uses channel-based keyframing for transform tracks |
| add_event_track | ✅ | Works |
| add_event_key | ✅ | Works - MovieSceneEvent payload |
| add_audio_track | ✅ | Works - tested with imported Windows sound |
| add_spawnable_from_class | ✅ | Works - adds spawnable actors like PointLight |

**Final Results: 17/22 sequence actions passing (77%)** - All key actions working after fixes

**UE5.7 Sequencer API Fixes (2025-12-02):**
- `MovieScene.add_master_track()` removed → use `MovieSceneSequenceExtensions.add_track(seq, ...)`
- `MovieScene.get_master_tracks()` removed → use `MovieSceneSequenceExtensions.get_tracks(seq)`
- `get_display_name()` returns `FText` not `str` → convert with `str(track.get_display_name())`
- Track sections `get_start_frame()`/`get_end_frame()` return objects → convert with `int()`

**Root cause found**: `unreal.PluginManager.get()` returns `None` in UE5.7, causing all plugins 
to be marked as disabled. Fix: assume enabled when plugin APIs aren't available.

 **Phase 8.1 Asset Search Fix (2025-12-02):**
The `manage_asset` tool's `search` action had multiple issues:
1. **Boolean conversion**: JavaScript `true`/`false` → Python `True`/`False`
   - Error: `NameError: name 'true' is not defined`
   - **Fix**: `recursive = ${recursive ? 'True' : 'False'}`
2. **UE5.7 Name object bug**: `asset.asset_name` returns `Name` object, not string
   - Error: `'Name' object has no attribute 'lower'` (when calling `.lower()`)
   - Error: `Object of type Name is not JSON serializable`
   - **Fix**: Added `str()` conversions: `str(asset.asset_name)`, `str(asset.asset_class_path.asset_name)`, etc.
3. **MCP restart required**: After fixing code and rebuilding (`npm run build`), must restart OpenCode

 **Phase 8.2-8.4 Implementation Strategy (2025-12-02):**
Implemented three new tools using a **placeholder-first approach**:
1. **Complete tool definitions** in `consolidated-tool-definitions.ts` for the Phase 8.2-8.4 tools

2. **Full handler implementations** in `consolidated-tool-handlers.ts` with proper elicitation
3. **Tool classes** with placeholder implementations that return success + warning
4. **Python templates** ready for real implementation

**Why placeholder-first?**
- Allows immediate testing of tool registration and elicitation
- Enables gradual implementation of real Python functionality
- No breaking changes to existing system
- Users can test tool interfaces while real implementation is added

 **New Tools Status:**
- `manage_curves` (Phase 8.2): Curve asset creation and editing - **Create/Add/Evaluate wired to Python, import/export still placeholder**
- `manage_gamemode` (Phase 8.3): Multiplayer game framework setup - **All 4 actions implemented (placeholder responses)**
- `manage_tags` (Phase 8.4): Actor tag management with wildcard queries - **All 6 actions implemented (placeholder responses)**

**Implementation Complete**: All three tools are registered, compiled, and ready for testing after MCP restart.

### **Placeholder-First Implementation Pattern (Phase 8.2-8.4)**

For Phase 8 tools, we established a **placeholder-first implementation pattern**:

1. **Complete tool definitions** in `consolidated-tool-definitions.ts` with full schema
2. **Full handler implementations** in `consolidated-tool-handlers.ts` with proper parameter elicitation and validation
3. **Tool classes** with placeholder implementations that return success + warning messages
4. **Python templates** created and ready for real implementation

**Why this pattern works:**
- Allows immediate testing of tool registration and elicitation flow
- Enables gradual implementation of real Python functionality
- No breaking changes to existing system
- Users can test tool interfaces while real implementation is added incrementally
- Consistent with existing architecture (consolidated handlers return responses directly)

### **Phase 8.2-8.4 Python Templates Roadmap**

**Current Status**: Phase 8.2 (Curves) now uses real Python for create/add/evaluate (verified 2025-12-04). GameMode + Tags still return placeholder responses while their templates wait to be wired. Python templates live in `src/utils/python-templates.ts` for all actions.

**Implementation Roadmap** (Next Steps):

1. **Wire remaining handlers**:
   - Update `consolidated-tool-handlers.ts` so GameMode/Tags (and Curves import/export) call their Python templates
   - Ensure structured results propagate correctly

2. **Test real Python execution**:
   - After wiring, test each action in UE5.7 and handle enum/factory quirks

3. **Add missing Python templates**:
   - `manage_curves`: Add `IMPORT_CURVE` / `EXPORT_CURVE`
   - `manage_gamemode`: Add `CONFIGURE_REPLICATION` / `SETUP_INPUT`
   - Complete the template set for outstanding actions

**Python Templates Ready** (in `python-templates.ts`):
- **Curves**: `CREATE_CURVE`, `ADD_CURVE_KEY`, `EVALUATE_CURVE`
- **GameMode**: `CREATE_GAMEMODE_FRAMEWORK`, `SET_DEFAULT_CLASSES`
- **Actor Tags**: `ADD_ACTOR_TAGS`, `REMOVE_ACTOR_TAGS`, `HAS_ACTOR_TAG`, `GET_ACTOR_TAGS`, `CLEAR_ACTOR_TAGS`, `QUERY_ACTORS_BY_TAG`

**Missing Python Templates** (to be added):
- `IMPORT_CURVE`, `EXPORT_CURVE` (for `manage_curves`)
- `CONFIGURE_REPLICATION`, `SETUP_INPUT` (for `manage_gamemode`)

**Implementation Priority**:
1. Wire existing templates where possible
2. Add the missing templates
3. Retest all actions end-to-end

## Actor Names vs Labels (Important!)

Unreal has TWO different identifiers for actors:
- **Internal Name**: `StaticMeshActor_UAID_B48C9D80FEFC8AA702_1380248147` (what UE uses internally)
- **Actor Label**: `TestCube_MCP` (what user sees in Outliner, what we call "actorName")

**Key insight**: `GetAllLevelActors` returns paths with **internal names**, NOT labels.
To match user-provided names, must call `GetActorLabel()` on each actor.

Example path: `/Game/NewMap.NewMap:PersistentLevel.StaticMeshActor_UAID_xxx`
- Path parsing gives: `StaticMeshActor_UAID_xxx` (internal name)
- GetActorLabel gives: `TestCube_MCP` (user-visible label)

## C++ Generation Patterns (Phase 6 Learnings)

### Class Prefix Detection
When generating C++ for existing classes, detect Actor (A) vs UObject (U) prefix:
```typescript
// Check header content for " AClassName :" pattern
const classPrefix = headerContent.includes(` A${className} :`) ? 'A' : 'U';
```

### Replication Support
When adding replicated properties, must add ALL three pieces:
1. **Header**: `UPROPERTY(..., ReplicatedUsing=OnRep_PropName)` + `UFUNCTION() void OnRep_PropName();`
2. **Source GetLifetimeReplicatedProps**: `DOREPLIFETIME(ClassName, PropName);`
3. **Source OnRep function**: `void ClassName::OnRep_PropName() { }`

### Avoiding Duplicate Declarations
Templates like PlayerState/GameState already include `GetLifetimeReplicatedProps`.
Check before adding: `const templateHasRepProps = template.headerContent.includes('GetLifetimeReplicatedProps');`

### Class Name Prefix Handling
When user provides class names with U/A prefix (e.g., `UMyAttributeSet`), strip the prefix before generating:
```typescript
// Strip U prefix if user passed it
if (className.startsWith('U') && className[1] === className[1].toUpperCase()) {
  className = className.slice(1);
}
```
This prevents double-prefixing like `UUMyAttributeSet`.

### RPC Function Generation
Server RPCs need `_Implementation` and optionally `_Validate`:
```cpp
// Header
UFUNCTION(Server, Reliable, WithValidation)
void ServerDoThing(float Param);
bool ServerDoThing_Validate(float Param);
void ServerDoThing_Implementation(float Param);

// Source
void AMyClass::ServerDoThing_Implementation(float Param) { }
bool AMyClass::ServerDoThing_Validate(float Param) { return true; }
```

## Quick Reference: New Actions (Phase 5)

### control_actor new actions
```
# Transform existing actor
control_actor action:transform actorName:MyCube location:{x:100,y:0,z:0} rotation:{yaw:45} scale:{x:2,y:2,z:2}

# Batch spawn grid
control_actor action:batch_spawn classPath:/Engine/BasicShapes/Cube gridSize:{x:3,y:3,z:1} spacing:200

# Apply material
control_actor action:set_material actorName:MyCube materialPath:/Game/Materials/M_Red
```

### manage_sequence new actions
```
# Add transform keyframe
manage_sequence action:add_transform_keyframe bindingName:CineCameraActor frame:0 location:{x:0,y:0,z:200}

# Add camera cut track (once per sequence)
manage_sequence action:add_camera_cut_track

# Add camera cut at frame
manage_sequence action:add_camera_cut cameraBindingName:CineCameraActor startFrame:0 endFrame:60

# Get tracks for binding
manage_sequence action:get_tracks bindingName:CineCameraActor

# Add property track (for non-transform properties like Intensity, etc.)
manage_sequence action:add_property_track bindingName:MyLight propertyPath:Intensity propertyType:float
manage_sequence action:add_property_keyframe bindingName:MyLight propertyPath:Intensity frame:0 value:5000

# For transform properties (RelativeScale3D, RelativeLocation, RelativeRotation), use add_transform_keyframe instead:
manage_sequence action:add_transform_keyframe bindingName:MyActor frame:0 scale:{x:1,y:1,z:1}
manage_sequence action:add_transform_keyframe bindingName:MyActor frame:150 scale:{x:2,y:2,z:2}

# Add event track + key (Phase 7.10)
manage_sequence action:add_event_track bindingName:MyActor eventName:OnTrigger
manage_sequence action:add_event_key eventName:OnTrigger frame:60 bindingName:MyActor

# Add audio track (import a WAV file first if needed)
manage_asset action:import sourcePath:C:\Windows\Media\ding.wav destinationPath:/Game/Audio
manage_sequence action:add_audio_track soundPath:/Game/Audio/ding startFrame:50
```

## Common Template Issues to Check
When fixing Python template errors in TypeScript code, check for:

1. **Boolean values**: JavaScript `true`/`false` → Python `True`/`False`
   ```typescript
   // WRONG: recursive = ${recursive}
   // CORRECT: recursive = ${recursive ? 'True' : 'False'}
   ```

2. **String escaping**: Use `r"${path}"` for raw strings with backslashes
   ```typescript
   // For Windows paths: r"C:\Users\..."
   search_dir = r"${normalizedDir}"
   ```

3. **JSON serialization**: Wrap complex outputs with `json.dumps()`
   ```python
   print('RESULT:' + json.dumps(result))
   ```

4. **Indentation**: Python is whitespace-sensitive, ensure consistent indentation
   ```typescript
   const py = `
   import unreal, json
   try:
       # Code here
   except Exception as e:
       print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
   `.trim();  // .trim() removes leading/trailing whitespace
   ```

5. **Line endings**: Template literals preserve line breaks - ensure they're correct

6. **Parameter validation**: Check for undefined/null before inserting into template
   ```typescript
   search_pattern = ${searchPattern ? `r"${searchPattern.replace(/"/g, '\\"')}"` : 'None'}
   asset_type = ${assetType ? `"${assetType}"` : 'None'}
   ```
