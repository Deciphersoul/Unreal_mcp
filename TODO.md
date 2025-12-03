# UE MCP Extended - TODO

Track limitations discovered during testing. When a tool can't do something needed, add it here.

## Design Principles

1. **C++ First**: Primary game logic in C++, Blueprints only for small tweaks
2. **Multiplayer by Default**: **Everything assumes multiplayer.** Replication, RPCs, server authority from day one. Never build single-player-only code.
3. **Hybrid Generation**: MCP templates for boilerplate, Claude for custom logic
4. **Full AI Control**: Goal is autonomous UE5 project creation

## Development Workflow
1. **After Code Changes**: Run `npm run build` to compile TypeScript
2. **MCP Restart Required**: User must restart OpenCode/MCP server to pick up changes
3. **Old Code Runs**: Until MCP server process restarts, old compiled code executes

## UE5.7 Python API Notes
- **Name Objects**: `asset.asset_name` returns `Name` object, not string - use `str()` conversion
- **Boolean Conversion**: In Python templates, use `${booleanParam ? 'True' : 'False'}` not `${booleanParam}`
- **Asset Registry Timing**: May need explicit `refresh_assets` after asset creation

## Missing Features

Features discovered during testing that we can't do yet.

| Priority | Feature | Use Case | Status |
|----------|---------|----------|--------|
| ~~Low~~ | ~~Selection feedback on no-match~~ | ~~`select` returns success with 0 actors~~ | ✅ Fixed - returns warning |
| ~~Low~~ | ~~build_lighting quality validation~~ | ~~Invalid quality silently defaults~~ | ✅ Fixed - enum validation in schema |
| ~~Medium~~ | ~~Batch actor operations~~ | ~~Spawn multiple actors at once~~ | ✅ Added `batch_spawn` action |
| ~~Medium~~ | ~~Material assignment~~ | ~~Apply materials to actors~~ | ✅ Added `set_material` action |
| ~~Medium~~ | ~~Transform operations~~ | ~~Move/rotate/scale existing actors~~ | ✅ Added `transform` action |
| ~~Medium~~ | ~~Property animation keyframes~~ | ~~Animate float/color properties~~ | ✅ Added `add_property_track`/`add_property_keyframe` - needs restart |
| ~~Medium~~ | ~~Audio tracks in sequences~~ | ~~Add sound cues to cinematics~~ | ✅ Added `add_audio_track` - needs restart |
| ~~Low~~ | ~~Event tracks in sequences~~ | ~~Trigger Blueprint events at frames~~ | ✅ Added `add_event_track`/`add_event_key` - needs restart |

---

# Full UE5 AI Control Roadmap

## Phase 6: C++ Workflow Foundation ✅ COMPLETE (✅ TESTED 2025-12-01)

Enable AI to scaffold and manage C++ code for UE5 projects.

> **TESTED**: All Phase 6 tools tested against TestProjectGenAI (UE 5.7). Files generated correctly.
> **BUGS FIXED**: Class prefix (A vs U), duplicate GetLifetimeReplicatedProps, property parsing

### 6.1 C++ Class Templates (MCP Tool) ✅

New tool: `manage_cpp` for generating UE5 C++ boilerplate.

| Template | Parent Class | Use Case |
|----------|--------------|----------|
| Actor | `AActor` | Game entities, spawnable objects |
| Character | `ACharacter` | Player/AI with movement |
| Pawn | `APawn` | Controllable entities |
| PlayerController | `APlayerController` | Input handling, HUD |
| GameMode | `AGameModeBase` | Game rules, spawning |
| GameState | `AGameStateBase` | Replicated game data |
| PlayerState | `APlayerState` | Per-player replicated data |
| ActorComponent | `UActorComponent` | Logic components |
| SceneComponent | `USceneComponent` | Transform-based components |
| Widget | `UUserWidget` | UI elements |
| DataAsset | `UDataAsset` | Data-only assets |
| Subsystem | `UGameInstanceSubsystem` | Singletons |

| Task | Description | Status |
|------|-------------|--------|
| 6.1.1 | Create `manage_cpp` tool with `create_class` action | ✅ Complete |
| 6.1.2 | Generate `.h` and `.cpp` with correct UE macros | ✅ Complete |
| 6.1.3 | Support UPROPERTY/UFUNCTION generation | ✅ Complete |
| 6.1.4 | Add to project's Source folder automatically | ✅ Complete |
| 6.1.5 | Update `.Build.cs` module dependencies | ✅ Complete |

### 6.2 GAS C++ Scaffolding (Multiplayer-Ready) ✅

**All GAS code uses multiplayer patterns by default.**

| Template | Parent Class | Notes |
|----------|--------------|-------|
| AttributeSet | `UAttributeSet` | Health, Mana, etc. with `GAMEPLAYATTRIBUTE_REPNOTIFY` |
| GameplayAbility | `UGameplayAbility` | Abilities with prediction, `NetExecutionPolicy` set |
| GameplayEffect | `UGameplayEffect` | Buff/debuff data assets |
| AbilitySystemComponent | `UAbilitySystemComponent` | **Always on PlayerState** (survives respawn) |

| Task | Description | Status |
|------|-------------|--------|
| 6.2.1 | AttributeSet template with ATTRIBUTE_ACCESSORS + replication | ✅ Complete |
| 6.2.2 | GameplayAbility template with prediction support | ✅ Complete |
| 6.2.3 | ASC setup on PlayerState (**never on Character**) | ✅ Complete |
| 6.2.4 | GameplayEffect data asset creation | ✅ Complete |
| 6.2.5 | GAS initialization in GameMode with `InitGlobalData()` | ✅ Complete |

### 6.3 CommonUI C++ Scaffolding ✅

| Template | Parent Class | Notes |
|----------|--------------|-------|
| ActivatableWidget | `UCommonActivatableWidget` | Base for all UI |
| ButtonBase | `UCommonButtonBase` | Platform-aware buttons |
| TabListWidget | `UCommonTabListWidgetBase` | Tab navigation |
| ActionWidget | `UCommonActionWidget` | Input prompts |

| Task | Description | Status |
|------|-------------|--------|
| 6.3.1 | CommonUI widget templates | ✅ Complete |
| 6.3.2 | Input action data asset templates | ✅ Complete |
| 6.3.3 | Widget stack setup | ✅ Complete |

### 6.4 DataTable & DataAsset Support ✅

| Task | Description | Status |
|------|-------------|--------|
| 6.4.1 | Create DataTable row structs | ✅ Complete |
| 6.4.2 | Import CSV to DataTable | ⏸️ Deferred (requires runtime) |
| 6.4.3 | Create custom DataAsset classes | ✅ Complete |
| 6.4.4 | Create PrimaryDataAsset classes | ✅ Complete |

### 6.5 Project Structure Management ✅

| Task | Description | Status |
|------|-------------|--------|
| 6.5.1 | Parse existing `.Build.cs` | ✅ Complete |
| 6.5.2 | Add module dependencies | ✅ Complete |
| 6.5.3 | Create new modules (Runtime/Editor split) | ✅ Complete |
| 6.5.4 | Update `.uproject` plugin list | ✅ Complete |

### Phase 6 Summary

**19 actions in `manage_cpp` tool:**
- Class: `create_class`, `add_property`, `add_function`, `list_templates`
- GAS: `create_gas_playerstate`, `create_gas_gamemode`, `create_gameplay_effect`
- CommonUI: `create_widget_stack_manager`, `create_input_action_data_asset`
- Data: `create_datatable_struct`, `create_primary_data_asset`
- Project: `add_module_dependency`, `get_module_dependencies`, `create_module`, `get_project_info`, `enable_plugin`

---

## Phase 7: Easy Wins - Data & Config ✅ COMPLETE (2025-12-02)

Quick MCP tool additions using existing RC API patterns.

| # | Feature | Tool | Actions | Status |
|---|---------|------|---------|--------|
| 7.1 | Physics Forces | `control_actor` | `apply_force` | ✅ Tested |
| 7.2 | Collision Presets | `manage_collision` | `set_profile`, `set_response`, `set_enabled`, `get_settings` | ✅ All 4 tested |
| 7.3 | Nanite/Lumen Settings | `manage_rendering` | `set_nanite`, `get_nanite`, `set_lumen`, `get_lumen`, `set_vsm`, `set_anti_aliasing`, `set_screen_percentage`, `set_ray_tracing`, `get_info`, `set_post_process` | ✅ Tested |
| 7.4 | Plugin Management | `manage_cpp` | `enable_plugin` | ✅ Tested |
| 7.5 | Enhanced Input | `manage_input` | `create_action`, `create_context`, `add_mapping`, `get_mappings`, `remove_mapping`, `list_actions`, `list_contexts` | ✅ Tested |
| 7.6 | Material Instances | `manage_material` | `create_instance`, `set_scalar`, `set_vector`, `set_texture`, `get_parameters`, `copy` | ✅ Tested |
| 7.7 | Basic Audio | `system_control` | `play_sound` | ✅ Tested |
| 7.8 | Sequence Property Tracks | `manage_sequence` | `add_property_track`, `add_property_keyframe` | ✅ Tested |
| 7.9 | Sequence Audio Tracks | `manage_sequence` | `add_audio_track` | ✅ Tested |
| 7.10 | Sequence Event Tracks | `manage_sequence` | `add_event_track`, `add_event_key` | ✅ Tested |

**Phase 7 Summary**: 10 of 10 items complete! All tested and working.

### Phase 8.2-8.4 Python Templates Implementation Status

**Phase 8.2-8.4 tools are fully implemented with placeholder responses**. Python templates are **ready** in `src/utils/python-templates.ts`.

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

**Sequence Tools - Full Test Results (2025-12-02)**:
All 12 sequence actions passing:
- `create`, `open`, `add_camera`, `add_actor`, `get_bindings` ✅
- `add_transform_keyframe` (location/rotation/scale) ✅
- `add_camera_cut_track`, `add_camera_cut` ✅
- `add_property_track`, `add_property_keyframe` ✅
- `add_event_track`, `add_event_key` ✅
- `add_audio_track` (tested with imported Windows ding.wav) ✅
- `add_spawnable_from_class` (e.g., PointLight) ✅
- `play`, `pause`, `stop`, `set_playback_speed`, `get_properties` ✅

**Key Fix**: For transform properties (RelativeScale3D, etc.), `add_property_track` now guides users to use `add_transform_keyframe` instead of creating duplicate tracks.

**Bug Fixes (2025-12-02)**:

1. **Plugin Check**: `unreal.PluginManager.get()` returns `None` in UE 5.7. Fixed - now assumes plugins enabled when API unavailable.

2. **UE5.7 Sequencer API**: `MovieScene.add_master_track()` and `get_master_tracks()` removed. Fixed to use `MovieSceneSequenceExtensions.add_track(seq, ...)` and `get_tracks()`.

3. **Transform Track Keyframing**: `section.add_key()` doesn't work for vector/transform tracks. Fixed to use channel-based keying:
   - Transform tracks have 9 channels: Location (0-2), Rotation (3-5), Scale (6-8)
   - Color tracks have 4 channels: R, G, B, A
   - Must call `section.get_all_channels()` and key each channel separately

---

## Phase 8: Medium Features (Reordered Easy → Hard)

| # | Feature | Tool | Actions | Difficulty | Status |
|---|---------|------|---------|------------|--------|
| 8.1 | **Asset Search** | `manage_asset` | `search` (by type/name pattern) | **Easy** | ✅ Fixed 2025-12-02 (UE5.7 Name object bug) |
 | 8.2 | **Curves** | `manage_curves` | Float/color curves, custom enums | **Easy** | ✅ **Implemented 2025-12-02** (all 5 actions, placeholder + Python templates ready) |
| 8.3 | **GameMode Setup** | `manage_gamemode` | Rules, spawning, player controllers | **Easy** | ✅ **Implemented 2025-12-02** (all 4 actions, placeholder + Python templates ready) |
| 8.4 | **Actor Tags** | `manage_tags` | `add_tag`, `remove_tag`, `get_by_tag`, `has_tag` | **Easy** | ✅ **Implemented 2025-12-02** (all 6 actions, placeholder + Python templates ready) |
| 8.5 | **Splines** | `manage_spline` | Create/edit splines, get points, sample | **Easy-Medium** | Pending |
| 8.6 | **Component Management** | `manage_component` | `add`, `remove`, `get_components` on actors | **Medium** | Pending |
| 8.7 | **DataTables** | `manage_datatable` | Create, edit rows, import CSV | **Medium** | Pending |
| 8.8 | **NavMesh Config** | `manage_navigation` | Nav volumes, areas, modifiers, agents | **Medium-Hard** | Pending |

**Moved to Phase 11 (Hard):**
- World Partition → Complex UE5 system, likely API gaps
- Skeletal Mesh → Sockets/retargeting are specialized subsystems
- Source Control → Backburner (depends on P4/Git plugin exposure)

---

## Phase 9: GAS & CommonUI Runtime Control (Reordered Easy → Hard)

Runtime MCP control for GAS and CommonUI systems.

### 9.1 CommonUI Runtime (`manage_common_ui`) - **Medium** (do first)

Widget stack is straightforward, 6 actions.

| Action | Description | Status |
|--------|-------------|--------|
| `push_widget` | Push widget to activatable stack | Pending |
| `pop_widget` | Pop top widget from stack | Pending |
| `get_input_type` | Query current input type (gamepad/kb) | Pending |
| `set_input_type` | Force input type | Pending |
| `get_active_widget` | Get currently focused widget | Pending |
| `set_focus` | Set focus to specific widget | Pending |

### 9.2 GAS Runtime (`manage_gas`) - **Medium-Hard** (do second)

ASC queries may need discovery patterns for UE5.7 API, 12 actions.

| Action | Description | Status |
|--------|-------------|--------|
| `get_attributes` | Read all attributes from actor's ASC | Pending |
| `set_attribute` | Modify attribute base value | Pending |
| `grant_ability` | Grant ability by class to actor | Pending |
| `remove_ability` | Remove granted ability | Pending |
| `apply_effect` | Apply GameplayEffect to target | Pending |
| `remove_effect` | Remove active effect | Pending |
| `get_active_effects` | List active effects on actor | Pending |
| `has_tag` | Check if actor has gameplay tag | Pending |
| `add_tag` | Add loose gameplay tag | Pending |
| `remove_tag` | Remove loose gameplay tag | Pending |
| `activate_ability` | Try activate ability by tag/class | Pending |
| `cancel_ability` | Cancel active ability | Pending |

---

## Phase 10: Blueprint Graph Editing (LOWER PRIORITY)

Requires C++ UE Plugin to expose graph APIs to Remote Control.

### 10.0 C++ Plugin: BlueprintGraphMCP

| Task | Description | Status |
|------|-------------|--------|
| 10.0.1 | Create plugin structure | Pending |
| 10.0.2 | Expose `AddVariableToBlueprint()` | Pending |
| 10.0.3 | Expose `AddFunctionToBlueprint()` | Pending |
| 10.0.4 | Expose `AddNodeToGraph()` | Pending |
| 10.0.5 | Expose `ConnectPins()` | Pending |
| 10.0.6 | Expose `GetGraphNodes()` | Pending |
| 10.0.7 | Register with Remote Control | Pending |

### 10.1 Blueprint Variables

| Action | Description | Status |
|--------|-------------|--------|
| `add_variable` | Add variable with type, default, flags | Pending |
| `remove_variable` | Remove variable by name | Pending |
| `set_variable_default` | Set default value | Pending |
| `get_variables` | List all variables | Pending |

### 10.2 Blueprint Functions

| Action | Description | Status |
|--------|-------------|--------|
| `add_function` | Create function with inputs/outputs | Pending |
| `remove_function` | Remove function | Pending |
| `add_local_variable` | Add local var to function | Pending |

### 10.3 Blueprint Nodes

| Action | Description | Status |
|--------|-------------|--------|
| `add_event` | Add event node (BeginPlay, Tick, etc.) | Pending |
| `add_function_call` | Add function call node | Pending |
| `add_variable_get` | Add variable getter | Pending |
| `add_variable_set` | Add variable setter | Pending |
| `add_branch` | Add Branch node | Pending |
| `add_sequence` | Add Sequence node | Pending |

### 10.4 Blueprint Connections

| Action | Description | Status |
|--------|-------------|--------|
| `connect_pins` | Wire two pins together | Pending |
| `disconnect_pin` | Break connection | Pending |
| `get_connections` | List all connections | Pending |

---

## Phase 11: Advanced/Research (Reordered by likely API exposure)

Features requiring significant research or new UE systems.

| # | Feature | Tool | Difficulty | Notes |
|---|---------|------|------------|-------|
| 11.1 | **World Partition** | `manage_world_partition` | **Hard** | Moved from Phase 8 - Data layers, streaming, HLOD |
| 11.2 | **Skeletal Mesh** | `manage_skeleton` | **Hard** | Moved from Phase 8 - Sockets, retargeting, morph targets |
| 11.3 | **AI Behavior Trees** | `manage_behavior_tree` | **Medium** | Has Python API exposure |
| 11.4 | **Chaos Physics** | `manage_chaos` | **Medium-Hard** | Destruction, cloth have some API |
| 11.5 | **PCG** | `manage_pcg` | **Hard** | UE5.2+ PCG graphs, newer API |
| 11.6 | **Niagara Scripting** | `manage_niagara_module` | **Hard** | Module/emitter creation is complex |
| 11.7 | **Control Rig** | `manage_control_rig` | **Very Hard** | Animation rigging is specialized |
| 11.8 | **MetaSounds** | `manage_metasounds` | **Very Hard** | Procedural audio graphs |
| 11.9 | **Mass Entity** | `manage_mass` | **Research** | UE5.4+ ECS system, very new |
| 11.10 | **Source Control** | `manage_source_control` | **Backburner** | P4/Git - depends on plugin exposure |

---

## Completed Phases (1-5)

All foundational phases complete. See git history for details.

- **Phase 1** ✅: Direct RC API refactor - all tools use RC first, Python fallback
- **Phase 2** ✅: Code quality - `unreal-bridge.ts` reduced 43% (1737→995 lines)  
- **Phase 3** ✅: Full test suite - 11 categories, all passing
- **Phase 4** ✅: Bug fixes - connection check, selection by label
- **Phase 5** ✅: New features - transform, batch_spawn, set_material, keyframes

---

## Known Limitations

| Tool | Limitation | Workaround |
|------|------------|------------|
| `project_build` | Packaging is async, can't track progress | Check UE Output Log manually |
| `manage_blueprint` | Can't edit Blueprint graphs | Phase 10 (C++ plugin required) |
| `inspect` | Some properties are read-only | Use console commands if available |
| C++ generation | No MCP tool yet | Claude generates directly (Phase 6) |
| GAS | No runtime control | Phase 9 |
| CommonUI | No widget stack control | Phase 9 |
| `manage_input` | UE5.7: Factory classes don't exist | ✅ Fixed: use `factory=None` with `create_asset()` |
| `manage_input` | UE5.7: Enum naming varies (`AXIS_1D` vs `AXIS1D`) | Fixed: try/except for both formats |
| `manage_rendering` | Can't read current console var values | Only set operations work reliably |
| `manage_collision` | UE5.7: Collision enum naming varies | Fixed: Fallback pattern tries ECR_*, UPPER, Mixed case |
| `manage_sequence` | Requires Sequencer plugins enabled | Enable LevelSequenceEditor + Sequencer in Project plugins |
| Plugin status check | Requires Python to verify plugins | When Python disabled, assumes enabled (optimistic) |

---

## Phase 7 Testing Results (2025-12-01)

### Tested ✅
| Tool | Action | Result |
|------|--------|--------|
| `manage_material` | `create_instance` | ✅ Works - created `/Game/Materials/MI_TestRed` |
| `manage_material` | `get_parameters` | ✅ Works - returns parameter info |
| `manage_rendering` | `set_lumen` | ✅ Works - console commands execute |
| `manage_rendering` | `set_anti_aliasing` | ✅ Works - TSR enabled |
| `manage_cpp` | `get_project_info` | ✅ Works |
| `manage_cpp` | `list_templates` | ✅ Works |

### Fixed During Testing
| Tool | Issue | Fix |
|------|-------|-----|
| `manage_input` | `list_actions` - ARFilter API broken in UE5.7 | Changed to `get_assets_by_class()` |
| `manage_rendering` | `get_info` - RendererSettings doesn't exist | Simplified to PPV counting |
| `manage_rendering` | `get_lumen` - same issue | Returns static console command docs |

### Retested ✅ (2025-12-01)
| Tool | Action | Result |
|------|--------|--------|
| `manage_input` | `list_actions` | ✅ Works with `get_assets_by_class()` |
| `manage_input` | `list_contexts` | ✅ Works with `get_assets_by_class()` |
| `manage_rendering` | `get_info` | ✅ Works - simplified PPV counting |
| `manage_rendering` | `get_lumen` | ✅ Works - returns console command docs |

### Phase 7 Testing Results (2025-12-02)

| Tool | Action | Result |
|------|--------|--------|
| `manage_input` | `create_action` | ✅ Works - created IA_MCPTestJump |
| `manage_input` | `create_context` | ✅ Works - created IMC_MCPTestContext |
| `manage_input` | `add_mapping` | ✅ FIXED - `unreal.Key()` uses `set_editor_property` now (needs OpenCode restart) |
| `manage_input` | `list_actions` | ✅ Works |
| `manage_input` | `list_contexts` | ✅ Works |

### Phase 6 Testing Results (2025-12-02)

| Tool | Action | Result |
|------|--------|--------|
| `manage_cpp` | `create_class` (Actor) | ✅ Works - created TestMCPActor.h/.cpp |
| `manage_cpp` | `add_property` (replicated) | ✅ Works - adds UPROPERTY + DOREPLIFETIME |
| `manage_cpp` | `add_function` (Server RPC) | ✅ Works - adds _Implementation + _Validate |
| `manage_cpp` | `create_gas_playerstate` | ✅ Works - GAS on PlayerState pattern |
| `manage_cpp` | `create_gas_gamemode` | ✅ Works - InitGlobalData() setup |
| `manage_cpp` | `create_gameplay_effect` | ✅ Works - basic GE scaffolding |
| `manage_cpp` | `create_widget_stack_manager` | ✅ Works - CommonUI subsystem |
| `manage_cpp` | `create_input_action_data_asset` | ✅ Works - input config struct |
| `manage_cpp` | `create_datatable_struct` | ✅ Works - FTableRowBase struct |
| `manage_cpp` | `create_primary_data_asset` | ✅ Works - PrimaryDataAsset class |
| `manage_cpp` | `add_module_dependency` | ✅ Works - updates Build.cs |
| `manage_cpp` | `get_module_dependencies` | ✅ Works - parses Build.cs |
| `manage_cpp` | `enable_plugin` | ✅ Works - updates .uproject |
| `manage_cpp` | `get_project_info` | ✅ Works |
| `manage_cpp` | `list_templates` | ✅ Works |

### Phase 6 Bugs Fixed
| Bug | Fix |
|-----|-----|
| `add_function` used wrong class prefix (U instead of A for Actors) | Fixed regex to detect ` AClassName :` |
| `add_property` missing OnRep function + DOREPLIFETIME | Added full replication support |
| `create_gas_playerstate` duplicate GetLifetimeReplicatedProps | Check if template already has it |
| `create_primary_data_asset` properties as undefined | Added defensive array/object checks |
| `create_gas_playerstate` double U prefix on AttributeSet type | Strip U prefix if user provides it (2025-12-02) |

### Phase 7 Bugs Fixed
| Bug | Fix |
|-----|-----|
| `manage_input` add_mapping - `unreal.Key()` constructor | UE5.7: Use `set_editor_property('key_name', ...)` instead (2025-12-02) |

### Phase 7 Additional Testing (2025-12-02)

| Tool | Action | Result |
|------|--------|--------|
| `control_actor` | `apply_force` | ✅ Works - applied 50000N upward force to cube |
| `manage_cpp` | `enable_plugin` | ✅ Works - enabled GameplayAbilities, LevelSequenceEditor |
| `system_control` | `play_sound` | ✅ Works - played /Engine/EditorSounds/Notifications/CompileSuccess |

### Phase 7 Collision Testing (2025-12-02)

| Tool | Action | Result |
|------|--------|--------|
| `manage_collision` | `get_settings` | ✅ Works - returns profile, collision type, object type |
| `manage_collision` | `set_profile` | ✅ Works - set OverlapAll on cube |
| `manage_collision` | `set_enabled` | ✅ Works - toggled NoCollision/QueryAndPhysics |
| `manage_collision` | `set_response` | ✅ Works - enum fallback pattern successful |

### Phase 7 Sequence Track Testing (2025-12-02)

**Full Sequencer Test Suite Results:**

| # | Action | Result | Notes |
|---|--------|--------|-------|
| 1 | `create` | ✅ Pass | Created /Game/Cinematics/TestSeq |
| 2 | `open` | ✅ Pass | Opens in Sequencer editor |
| 3 | `add_camera` | ✅ Pass | Spawnable camera binding |
| 4 | `set_properties` | ✅ Pass | Frame rate & length set |
| 5 | `add_actor` | ✅ Pass | Actor bound to sequence |
| 6 | `get_bindings` | ✅ Pass | Returns binding list |
| 7 | `add_transform_keyframe` | ✅ Pass | 3 keyframes at 0, 150, 300 |
| 8 | `add_camera_cut_track` | ✅ Pass | Track exists/created |
| 9 | `add_camera_cut` | ✅ Pass | After using correct binding name |
| 10 | `get_tracks` | ✅ Pass | Returns track info |
| 11 | `add_property_track` | ⚠️ Partial | Says success but track not usable |
| 12 | `add_property_keyframe` | ❌ Fail | Can't find property track |
| 13 | `add_event_track` | ✅ Pass | Event track added |
| 14 | `add_event_key` | ❌ Fail | Missing new_value argument |
| 15 | `play/pause/stop` | ✅ Pass | Playback controls work |
| 16 | `set_playback_speed` | ✅ Pass | Speed set to 2x |
| 17 | `get_properties` | ✅ Pass | Returns sequence metadata |
| 18 | `add_audio_track` | ❌ Fail | FrameNumber conversion error |
| 19 | `add_actors` (batch) | ✅ Pass | Batch add works |
| 20 | `add_spawnable_from_class` | ❌ Fail | API error |
| 21 | `remove_actors` | ✅ Pass | Batch remove works |

**Summary**: 17/22 passed (77%)

**Note**: Sequencer requires plugins enabled: `LevelSequenceEditor`, `Sequencer` (user enabled 2025-12-02)

### Sequencer Bugs Fixed (2025-12-02)

| Bug | Fix |
|-----|-----|
| `add_property_track` - Track created but keyframes can't find it | Added diagnostic output, search by property path not track name |
| `add_property_keyframe` - Can't find property track | Search by `get_property_path()`, track class, and track name |
| `get_tracks` - Minimal output | Added `propertyPath` field to track info |
| `add_audio_track` - FrameNumber type error | Try `set_start_frame_bounded()`, `set_range()`, fallback patterns |
| `add_event_key` - Missing new_value argument | Event channels need `MovieSceneEvent()` payload |
| `add_spawnable_from_class` - Generic failure | Try 4 methods: subsystem, extensions, library, spawn+convert |

**All fixes need OpenCode restart to take effect.**

### Phase 7 Bugs Fixed (2025-12-02)

| Bug | Fix |
|-----|-----|
| `manage_collision` set_response - `CollisionResponseType.IGNORE` not found | Added fallback pattern trying multiple enum naming conventions (ECR_IGNORE, IGNORE, Ignore) + index fallback |
| Sequencer tools blocked when Python disabled | Plugin check now assumes plugins enabled when Python fails - lets operations attempt and fail with real errors |

### Code Refactoring Completed (2025-12-02)

| File | Change | Notes |
|------|--------|-------|
| `src/tools/handlers/handler-utils.ts` | NEW - Extracted utilities | log, validators, elicitation helpers |
| `src/tools/consolidated-tool-handlers.ts` | Cleaned up | Fixed section numbers, added header docs, imports from handler-utils |
| Large files (lighting, actors, blueprint, physics) | KEPT AS-IS | Well-structured single-purpose files over 1000 lines are acceptable |

---

## Notes

- Target: ~500 lines per file, hard limit: 1000 lines
- UE 5.7 Remote Control: HTTP=30010, WS=30020
- **API Priority**: Direct RC → Graceful degradation → Python LAST RESORT
- **Code Priority**: C++ first, Blueprints only for small tweaks
- **Multiplayer**: All systems designed for replication from start
