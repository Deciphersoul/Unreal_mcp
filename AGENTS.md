# UE MCP Extended

MCP server providing **25 tools** for Unreal Engine 5.7 development.


## Purpose

Test MCP tool capabilities and limitations. When something can't be done, add it to `TODO.md`.
Ultimate goal: **Full autonomous UE5 project creation by AI.**

## Design Principles

1. **C++ First**: Primary game logic in C++, Blueprints only for small tweaks
2. **Multiplayer by Default**: **Everything assumes multiplayer.** Replication, RPCs, server authority from day one.
3. **Hybrid Generation**: MCP templates for boilerplate, Claude for custom logic
4. **IDE Rebuilds**: User rebuilds from IDE between tests - MCP doesn't trigger compilation

## Test Project

- **Path**: `C:\Users\Decipher\Documents\Unreal Projects\TestProjectGenAI`
- **Engine**: UE 5.7 with Remote Control enabled
- **HTTP Port**: 30010 (NOT 30000 - that's Conductor UI)
- **WebSocket Port**: 30020

## API Architecture - IMPORTANT

**Priority order for all tool implementations:**

1. **Direct Remote Control API** - Always try first, works without any UE settings changes
2. **Graceful degradation** - Inform user of limited functionality when RC can't do something
3. **Python as LAST RESORT** - Only when RC API has absolutely no way to accomplish the task

### Two Operating Modes

| Mode | UE Settings | Capabilities |
|------|-------------|--------------|
| **Limited** (default) | None required | Spawn, delete, select actors; move camera; save level; search assets |
| **Full** | Enable Python + Console in RC settings | + PIE control, viewmodes, build lighting, advanced queries |

### Enable Full Mode (Optional)

In **Project Settings → Plugins → Remote Control API**:
- ✅ Allow Remote Python Execution = True  
- ✅ Allow Console Command Remote Execution = True

## Troubleshooting

If tools fail with 404 but `check_connection` passes:
1. Verify MCP config has `UE_RC_HTTP_PORT=30010`
2. Check `netstat -an | findstr 30010` shows LISTENING
3. If port not listening: close ALL UE instances, reboot, restart UE fresh

If tools fail with 400 "cannot be accessed remotely":
- This is **expected** in Limited Mode for Python-dependent features
- Enable Full Mode settings above if you need those features

## Agents

See `.opencode/agent/` for agent definitions.

| Agent | Purpose |
|-------|---------|
| ue-assistant | Primary - delegates to specialists |
| ue-debugger | Error tracking, logs |
| ue-level-designer | Actors, lighting, test maps |
| ue-build-engineer | Packaging, builds |
| ue-asset-manager | Import, materials |
| ue-cinematics | Sequences, cameras |

## Current Roadmap

See **TODO.md** for detailed Phase 6-11 roadmap.

| Phase | Focus | Status |
|-------|-------|--------|
| 1-5 | Foundation (RC API, testing) | ✅ Complete |
| 6 | C++ Workflow (GAS, CommonUI scaffolding) | ✅ Complete & Tested |
| 7 | Easy Wins (Materials, Rendering, Input, Collision, Sequence) | ✅ Complete 2025-12-02 |
 | **8** | Medium Features (8 items, easy→hard) | **In Progress** (6/8 complete - 8.1-8.6 implemented, 8.2-8.4 still using placeholders) |

| 9 | CommonUI → GAS Runtime | Pending |
| 10 | Blueprint Graph Editing (C++ plugin) | Lower Priority |
| 11 | Advanced (World Partition, Skeletal, BT, PCG, etc.) | Research |

### Phase 8 Order (Easy → Hard)
1. ✅ **Asset Search** (`manage_asset` add `search`) - Fixed 2025-12-02
   - Search by name pattern (wildcards: `*cube*`, `material_*`)
   - Filter by asset type (`StaticMesh`, `Material`, `Texture2D`, etc.)
   - Recursive directory search with pagination
   - Returns metadata: total count, hasMore, pagination info
   - **FIXED**: UE5.7 `Name` object → string conversion bug + boolean conversion
   - **REQUIRES**: MCP restart after TypeScript rebuild
2. ✅ **Curves** (`manage_curves`) - **Implemented 2025-12-02**
   - Create curve assets (FloatCurve, VectorCurve, TransformCurve)
   - Add keyframes with interpolation settings
   - Evaluate curves at specific times
   - Import/export curve data (CSV/JSON)
   - **Status**: All 5 actions implemented with placeholder responses
   - **Python templates**: Ready in `python-templates.ts` (CREATE_CURVE, ADD_CURVE_KEY, EVALUATE_CURVE)
   - **Missing templates**: IMPORT_CURVE, EXPORT_CURVE
3. ✅ **GameMode Setup** (`manage_gamemode`) - **Implemented 2025-12-02**
   - Create multiplayer game framework (GameMode, GameState, PlayerState, PlayerController)
   - Set default classes for multiplayer projects
   - Configure replication modes (Full, Minimal, ClientPredicted)
   - Setup input with Enhanced Input System
   - **Status**: All 4 actions implemented with placeholder responses
   - **Python templates**: Ready in `python-templates.ts` (CREATE_GAMEMODE_FRAMEWORK, SET_DEFAULT_CLASSES)
   - **Missing templates**: CONFIGURE_REPLICATION, SETUP_INPUT
 4. ✅ **Actor Tags** (`manage_tags`) - **Implemented 2025-12-02**
    - Add/remove tags from actors
    - Query actors by tag patterns with wildcards (`Enemy_*`, `*_Door`)
    - Check if actors have specific tags
    - Clear all tags from actors
    - **Features**: AND/OR logic for tag queries, batch operations
    - **Status**: All 6 actions implemented with placeholder responses
    - **Python templates**: ✅ **Complete** in `python-templates.ts` (ADD_ACTOR_TAGS, REMOVE_ACTOR_TAGS, HAS_ACTOR_TAG, GET_ACTOR_TAGS, CLEAR_ACTOR_TAGS, QUERY_ACTORS_BY_TAG)
 5. ✅ **Splines** (`manage_spline`) - **Implemented 2025-12-04**
    - Create spline actors, add/update/remove points, inspect data, and sample along the curve
    - Uses Python fallback with helper utilities to spawn spline actors even when default component is missing
    - Fully wired into docs/tests (`docs/unreal-tool-test-cases.md`, `tests/run-unreal-tool-tests.mjs`)
 6. ✅ **Component Management** (`manage_component`) - **Implemented 2025-12-04**
    - Add, remove, and list components on placed level actors with attachment/mobility support
    - Python helper resolves component classes from names or paths and ensures safe registration/attachment flows
    - Documented and tested with new scenarios covering add/get/remove automation loops
 7. DataTables (`manage_datatable`)
 8. NavMesh Config (`manage_navigation`)


## Key UE Systems

### GAS (Gameplay Ability System)
- Always use **ASC on PlayerState** pattern (multiplayer-ready)
- C++ classes: `UAttributeSet`, `UGameplayAbility`, `UGameplayEffect`

### CommonUI  
- Use for all UI (cross-platform input handling)
- C++ classes: `UCommonActivatableWidget`, `UCommonButtonBase`

## Code Quality

- Target: ~500 lines per file
- Hard limit: 1000 lines (refactor if exceeded)
- Priority: clean helpers > new features

## Common Template Issues

When writing Python templates in TypeScript:
- **Boolean values**: Use `True`/`False` (Python), not `true`/`false` (JavaScript)
- **Pattern**: `${booleanParam ? 'True' : 'False'}` not `${booleanParam}`
- **Check existing code**: Search for `\$\{.*true.*\}` to find other instances
- **UE5.7 Name objects**: `asset.asset_name` returns `Name` object, not string - use `str()` conversion

## Phase 8.2-8.4 Python Templates Roadmap

**Current Status**: Phase 8.2-8.4 tools are **fully implemented with placeholder responses**. Python templates are **ready** in `src/utils/python-templates.ts`.

**Python Templates Ready**:
- **Curves**: `CREATE_CURVE`, `ADD_CURVE_KEY`, `EVALUATE_CURVE`
- **GameMode**: `CREATE_GAMEMODE_FRAMEWORK`, `SET_DEFAULT_CLASSES`
- **Actor Tags**: `ADD_ACTOR_TAGS`, `REMOVE_ACTOR_TAGS`, `HAS_ACTOR_TAG`, `GET_ACTOR_TAGS`, `CLEAR_ACTOR_TAGS`, `QUERY_ACTORS_BY_TAG`

**Missing Python Templates** (to be added):
- `IMPORT_CURVE`, `EXPORT_CURVE` (for `manage_curves`)
- `CONFIGURE_REPLICATION`, `SETUP_INPUT` (for `manage_gamemode`)

**Implementation Roadmap**:
1. **Connect tool handlers to Python templates** - Update `consolidated-tool-handlers.ts`
2. **Test real Python execution** - Verify UE5.7 API compatibility
3. **Add missing Python templates** - Complete the template set
4. **Test all actions end-to-end** - Full integration testing

**Note**: Tools currently return placeholder responses. Real Python execution will be enabled when handlers are connected to templates.

## After Code Changes

When modifying MCP code:
1. Run `npm run build` 
2. **User must restart OpenCode** to pick up changes
3. Old code runs until MCP server process restarts

## Development

```bash
npm install    # Install dependencies
npm run build  # Build TypeScript
```

## Testing Workflow

1. Use agents to test MCP tools
2. Discover limitations
3. Add to `TODO.md`
4. Implement missing features

## Codebase Structure

```
src/
├── unreal-bridge.ts     # Main bridge class (995 lines - at limit!)
├── utils/
│   ├── python-templates.ts  # Python script templates
│   ├── python-output.ts     # Output parsing (RESULT: extraction)
│   ├── python.ts            # Script generators
│   ├── viewmode.ts          # Viewmode validation/safety
│   ├── command-queue.ts     # Throttling with priority
│   └── safe-commands.ts     # Command safety/blocking
└── tools/
    ├── sequence.ts          # Sequence tools (939 lines)
    ├── sequence-keyframes.ts # Keyframe/camera cut helpers (429 lines)
    ├── actors.ts            # Actor spawn/transform/delete
    ├── consolidated-tool-definitions.ts  # All tool schemas
    ├── consolidated-tool-handlers.ts     # All tool handlers
    └── ...                  # Other tool handlers
```

## Adding New Functionality

### If modifying unreal-bridge.ts:
- **File is at 995 lines** - extract to utility if adding >20 lines
- Check if existing utility can handle it
- Follow existing patterns for consistency

### If adding new Python scripts:
- Add to `src/utils/python-templates.ts` or `src/utils/python.ts`
- Always use `RESULT:` prefix for JSON output
- Handle exceptions with error JSON

### If adding new tool:
- Use Direct RC API first, Python as fallback
- Add graceful degradation for Limited Mode
- Include in test suite

## Full Test Suite (Run Before Release)

### Happy Path Tests
```
1. check_connection → verify UE running (now makes actual HTTP call)
2. control_actor spawn/delete → actor lifecycle
3. control_editor camera/play/stop → editor control
4. manage_level lights/save → level operations
5. query_level get_all/by_class → queries
6. manage_selection select/clear → selection
7. manage_asset list → asset browsing
8. manage_blueprint create → asset creation
9. create_effect debug_shape → effects
10. system_control fps/screenshot → system
11. console_command stat → console access
```

### Error Path Tests (Phase 3)
```
1. control_actor delete NonExistent → should error "Actor not found"
2. control_actor spawn /Invalid/Path → should error with suggestion
3. query_level get_by_class FakeClass → should return empty (not error)
4. manage_level load /Fake/Level → should error "Level not found"
5. console_command quit → should error "blocked for safety"
6. manage_blueprint create Invalid/Name → should error
```

### Connection Test (with UE stopped)
```
1. Stop UE Editor
2. check_connection → should return connected: false, ECONNREFUSED message
3. Start UE Editor
4. check_connection → should return connected: true with response time
```

### Sequencer Tests (All Passing 2025-12-02)
```
1. manage_sequence create → creates /Game/Cinematics/TestSeq
2. manage_sequence open → opens sequence in editor
3. manage_sequence add_camera → spawnable camera binding (auto-named CineCameraActorN)
4. manage_sequence set_properties → frameRate, lengthInFrames
5. control_actor spawn TestCube → actor for sequence
6. manage_sequence add_actor → adds TestCube to sequence
7. manage_sequence get_bindings → list all bindings
8. manage_sequence add_transform_keyframe → location/rotation/scale keyframes
9. manage_sequence add_camera_cut_track → master camera cut track
10. manage_sequence add_camera_cut → camera cut section
11. manage_sequence get_tracks → binding tracks
12. manage_sequence add_property_track → for non-transform properties (Intensity, etc.)
13. manage_sequence add_event_track → event track on binding
14. manage_sequence add_event_key → event key at frame
15. manage_sequence add_audio_track → import WAV first (e.g., C:\Windows\Media\ding.wav)
16. manage_sequence add_spawnable_from_class → spawnable actors (PointLight, etc.)
17. manage_sequence play/pause/stop → playback control
18. manage_sequence set_playback_speed → 2x speed
19. manage_sequence get_properties → sequence metadata
```

## After Code Changes

**MCP server must be restarted after code changes:**
```bash
npm run build   # Compile TypeScript to dist/
# Then restart OpenCode or the MCP process
```

The running MCP uses compiled code from `dist/`. Changes to `src/` don't take effect until:
1. Build completes successfully
2. MCP server process is restarted

## Key Implementation Details

### Actor Names vs Labels
- **Path from GetAllLevelActors**: `/Game/Map.Map:PersistentLevel.StaticMeshActor_UAID_xxx`
- **Internal name** (from path): `StaticMeshActor_UAID_xxx`
- **Actor label** (user sees): `MyCube` - requires `GetActorLabel()` call

When matching user-provided names, always use `GetActorLabel()`, not path parsing.

### Actor Naming Collisions
- `control_actor.spawn` now checks for an existing actor label before spawning. If a requested `name`/`actorName` is already present, the tool returns `Actor '<name>' already exists. Choose a unique name or delete the existing actor first.`
- Automation that intentionally reuses labels (e.g., running Actor Tools #1 twice) must delete the previous actor via `control_actor.delete` (Actor Tools #2) before respawning, otherwise the scenario will fail early with the friendly error above.

### UE5.7 Python API Breaking Changes


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
- `unreal.InputActionFactory` - doesn't exist, use `factory=None`
- `unreal.InputMappingContextFactory` - doesn't exist, use `factory=None`
- `unreal.PluginManager` - not exposed to Python, can't check plugin status
- `unreal.PluginsEditorSubsystem` - doesn't exist
- `unreal.PluginsSubsystem` - doesn't exist

**Enum Naming Variations in UE5.7:**
- `InputActionValueType`: Uses `AXIS_1D`, `AXIS_2D`, `AXIS_3D` (not `AXIS1D`)
- Always use try/except when accessing enum values

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
- Transform/vector tracks: `section.add_key()` doesn't work - must use `section.get_all_channels()` and key each channel (0-2=Location, 3-5=Rotation, 6-8=Scale)

**Sequencer Binding Names:**
- When adding actor to sequence, binding name = actor label (not internal path name)
- Use `MovieSceneBindingExtensions.get_name(binding)` to get binding name
- Camera bindings get auto-generated names like `CineCameraActor6` (with number suffix)

**Reliable Patterns:**
- Console commands (`r.Lumen.*`, `r.Shadow.*`) always work for rendering settings
- `EditorAssetLibrary` for asset CRUD operations
- `EditorActorSubsystem` for actor operations
- `AssetToolsHelpers.get_asset_tools()` for asset creation
- `LevelSequenceFactoryNew()` for creating sequences
- `MovieSceneSequenceExtensions` for all sequence/track operations
- `MovieSceneBindingExtensions` for binding-specific track operations

### Direct RC API Testing
```bash
# Verify actor exists and get its label
curl -s -X PUT "http://localhost:30010/remote/object/call" \
  -H "Content-Type: application/json" \
  -d '{"objectPath": "/Game/Map.Map:PersistentLevel.ActorPath", "functionName": "GetActorLabel", "parameters": {}}'
```
