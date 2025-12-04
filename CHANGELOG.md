# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added - Phase 8.6: Component Management
- New tool: `manage_component` for adding, removing, and listing components on placed actors.
- Python utilities resolve component classes/attachments and expose mobility/transform overrides.
- Documentation and automated tests covering add/get/remove flows.

### Added - Phase 8.5: Splines
- New tool: `manage_spline` for authoring spline actors (create, add_point, set_point, remove_point, get_points, sample).
- Python-backed spline operations with Remote Control fallback, including tangent editing and sampling by distance/input key.
- Documentation and automated tests for spline workflows in `docs/unreal-tool-test-cases.md` and `tests/run-unreal-tool-tests.mjs`.


## [0.7.1] - 2025-12-02
### Added - Phase 8.1: Asset Search


#### Enhanced Tool: `manage_asset` - Added `search` action
- `search`: Search assets with filters (name pattern, asset type, directory, recursive)
- Parameters: `searchPattern` (wildcards: "*cube*"), `assetType` ("StaticMesh", "Material", etc.)
- Pagination: `limit` (default: 100, max: 500), `offset` for pagination
- Recursive search: `recursive` (default: true), `directory` (default: "/Game")
- Returns: Assets list with metadata including total count, pagination info

### Changed
- Version bumped to 0.7.1
- Phase 8: 1/8 items complete (8.1 Asset Search)
- `manage_asset` tool now has 4 actions: `list`, `import`, `create_material`, `search`

---

## [0.7.0] - 2025-12-01
### Added - Phase 7 (Partial): Easy Wins - Data & Config

#### New Tool: `manage_material` (Tool #20) - Material Instance Management
- `create_instance`: Create Material Instance from parent material with parameters
- `set_scalar`: Set scalar (float) parameter on Material Instance
- `set_vector`: Set vector (color) parameter on Material Instance  
- `set_texture`: Set texture parameter on Material Instance
- `get_parameters`: Get all parameters from Material Instance
- `copy`: Copy Material Instance with optional overrides

#### New Tool: `manage_rendering` (Tool #21) - UE5 Rendering Control
- `set_nanite` / `get_nanite`: Enable/disable Nanite on static meshes
- `set_lumen` / `get_lumen`: Configure Lumen GI settings
- `set_vsm`: Configure Virtual Shadow Maps
- `set_anti_aliasing`: Set AA method (None/FXAA/TAA/TSR/MSAA)
- `set_screen_percentage`: Set resolution scale (10-200%)
- `set_ray_tracing`: Toggle RT features (GI, reflections, shadows, AO, translucency)
- `get_info`: Get current rendering configuration
- `set_post_process`: Configure PostProcessVolume settings

#### New Tool: `manage_input` (Tool #22) - UE5 Enhanced Input System
- `create_action`: Create InputAction assets with value types and triggers
- `create_context`: Create InputMappingContext assets
- `add_mapping`: Add key mapping to context
- `get_mappings`: List mappings in context
- `remove_mapping`: Remove mapping from context
- `list_actions`: List all InputAction assets
- `list_contexts`: List all InputMappingContext assets

### Changed
- Version bumped to 0.7.0
- Tool count: 22 (up from 19)
- Phase 7: 3/10 items complete (7.3 Rendering, 7.5 Input, 7.6 Materials)

---

## [0.6.0] - 2025-12-01
### Added - Phase 6 Complete: C++ Workflow Foundation
- **New Tool: `manage_cpp`** (Tool #19) - Full C++ class scaffolding for UE5 with 16 actions

#### Class Management (6.1)
- `create_class`: Generate .h and .cpp for 17 class types (Actor, Character, Pawn, Component, GAS, CommonUI, etc.)
- `add_property`: Add UPROPERTY to existing classes with replication support
- `add_function`: Add UFUNCTION with RPC support (Server, Client, NetMulticast)
- `list_templates`: List all available class templates

#### GAS Scaffolding (6.2)
- `create_gas_playerstate`: Multiplayer-ready PlayerState with ASC (recommended pattern)
- `create_gas_gamemode`: GameMode with `UAbilitySystemGlobals::Get().InitGlobalData()` initialization
- `create_gameplay_effect`: GameplayEffect with duration, modifiers, and tags support
- Templates: AttributeSet (ATTRIBUTE_ACCESSORS + replication), GameplayAbility (prediction), AbilitySystemComponent

#### CommonUI Scaffolding (6.3)
- `create_widget_stack_manager`: GameInstanceSubsystem for managing activatable widget stacks
- `create_input_action_data_asset`: Input action data asset with gameplay tag support
- Templates: ActivatableWidget, ButtonBase

#### Data Assets (6.4)
- `create_datatable_struct`: DataTable row struct (FTableRowBase) generation
- `create_primary_data_asset`: PrimaryDataAsset with custom asset type registration

#### Project Management (6.5)
- `add_module_dependency`: Add dependencies to .Build.cs (public/private)
- `get_module_dependencies`: Read current module dependencies
- `create_module`: Create new Runtime/Editor modules with Build.cs and module files
- `get_project_info`: Parse .uproject for modules, plugins, engine version
- `enable_plugin`: Enable/disable plugins in .uproject

### Templates (17 total)
- **Core UE5**: Actor, Character, Pawn, PlayerController, GameMode, GameState, PlayerState, ActorComponent, SceneComponent, Widget, DataAsset, Subsystem
- **GAS**: AttributeSet, GameplayAbility, AbilitySystemComponent
- **CommonUI**: ActivatableWidget, ButtonBase

### Design Principles
- **C++ First Workflow**: Primary game logic in C++, Blueprints only for small tweaks
- **Multiplayer by Default**: All generated code includes replication patterns (DOREPLIFETIME, ReplicatedUsing, Server RPCs with validation)
- **ASC on PlayerState**: GAS classes follow the recommended multiplayer pattern (never on Character)

### Changed
- Version bumped to 0.6.0
- TODO.md updated: Phase 6 marked complete (all 22 tasks)

## [0.4.7] - 2025-11-16
### Added
- Output Log reading via `system_control` tool with `read_log` action. Supports filtering by category (comma-separated or array), log level (Error, Warning, Log, Verbose, VeryVerbose, All), line count (up to 2000), specific log path, include prefixes, and exclude categories. Automatically resolves the latest project log under Saved/Logs.
- New `src/tools/logs.ts` implementing robust log tailing, parsing (timestamp/category/level/message), and UE-specific internal entry filtering (e.g., excludes LogPython RESULT: blocks unless requested).

### Changed
- `system_control` tool schema: Added `read_log` action with full filter parameters to inputSchema; extended outputSchema with `logPath`, `entries` array, and `filteredCount`.
- Updated `src/tools/consolidated-tool-handlers.ts` to route `read_log` to LogTools without requiring UE connection (file-based).
- `src/index.ts`: Instantiates and passes LogTools to consolidated handler.
- Version bumped to 0.4.7 in package.json, package-lock.json, server.json, .env.production, and runtime config.

## [0.4.6] - 2025-10-04
### Fixed
- Fixed duplicate response output issue where tool responses were being displayed twice in MCP content
- Response validator now emits concise summaries in text content instead of duplicating full JSON payloads
- Structured content is preserved for validation and tests while user-facing output is streamlined

## [0.4.5] - 2025-10-03
### Added
- Expose `UE_PROJECT_PATH` environment variable across runtime config, Smithery manifest, and client example configs. This allows tools that need an absolute .uproject path (e.g., engine_start) to work without additional manual configuration.
- Added `projectPath` to the runtime `configSchema` so Smithery's session UI can inject a project path into the server environment.

### Changed
- Make `createServer` a synchronous factory (removed `async`) and updated `createServerDefault` and `startStdioServer` to use the synchronous factory. This aligns the exported default with Smithery’s expectations and prevents auto-start mismatches in the bundled output.
- Provide a default for `ueHost` in the exported `configSchema` so the Smithery configuration dialog pre-fills the host input.

### Documentation
- Updated `README.md`, `claude_desktop_config_example.json`, and `mcp-config-example.json` to include `UE_PROJECT_PATH` and usage notes.
- Updated `smithery.yaml` and `server.json` manifest to declare `UE_PROJECT_PATH` and default values.

### Build
- Rebuilt the Smithery bundle and TypeScript output to ensure schema and defaults are exported in the distributed artifact.

### Fixes
- Fixes Smithery UI blank ueHost field by defining a default in the runtime schema.


## [0.4.4] - 2025-09-30
- Previous release notes retained in upstream repo.
