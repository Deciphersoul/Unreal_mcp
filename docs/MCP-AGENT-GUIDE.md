# UE MCP Extended - Agent Guide

Complete reference for AI agents using the Unreal Engine MCP tools.

## Quick Start

> **Important Notes (Dec 2025):** `query_level` still returns counts without actor payloads. Use `manage_component.set_property` to edit actor/component values (e.g., TextRenderActor `propertyName: Text`). Always verify actor labels in the editor before running mutating commands.

### 1. Always Start With Connection Check
```
debug_extended action:check_connection
editor_lifecycle action:get_state
query_level action:count
```

### 2. Common Workflows

**Spawn and position an actor:**
```
control_actor action:spawn classPath:/Engine/BasicShapes/Cube location:{x:0,y:0,z:100}
control_actor action:transform actorName:Cube location:{x:200,y:0,z:100} rotation:{yaw:45}
```

**Create a cinematic sequence:**
```
manage_sequence action:create name:MyCinematic path:/Game/Cinematics
manage_sequence action:open path:/Game/Cinematics/MyCinematic
manage_sequence action:add_camera spawnable:true
manage_sequence action:add_actor actorName:MyCharacter
```

**Save and test:**
```
editor_lifecycle action:save_level
control_editor action:play
debug_extended action:get_errors
control_editor action:stop
```

---

## Tool Reference

### 1. control_actor
Actor spawning, positioning, and manipulation.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `spawn` | `classPath` | `actorName`, `location`, `rotation` | Spawn actor from class or mesh path |
| `delete` | `actorName` | - | Delete actor by label (case-insensitive) |
| `transform` | `actorName` | `location`, `rotation`, `scale` | Move/rotate/scale actor |
| `batch_spawn` | `classPath`, `gridSize` | `spacing`, `startLocation`, `namePrefix` | Spawn grid of actors |
| `set_material` | `actorName`, `materialPath` | `slotIndex` | Apply material to actor |
| `apply_force` | `actorName`, `force` | - | Push physics actor |

**Examples:**
```
# Spawn a cube at origin
control_actor action:spawn classPath:/Engine/BasicShapes/Cube actorName:MyCube

# Move and rotate it
control_actor action:transform actorName:MyCube location:{x:500,y:0,z:200} rotation:{yaw:90}

# Spawn a 3x3 grid of spheres
control_actor action:batch_spawn classPath:/Engine/BasicShapes/Sphere gridSize:{x:3,y:3,z:1} spacing:200

# Apply a material
control_actor action:set_material actorName:MyCube materialPath:/Game/Materials/M_Red
```

---

### 2. control_editor
Editor viewport and PIE control.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `play` | - | - | Start Play In Editor |
| `stop` | - | - | Stop PIE session |
| `set_camera` | `location`, `rotation` | - | Move viewport camera |
| `set_view_mode` | `viewMode` | - | Change view mode (Lit, Unlit, Wireframe) |

**Examples:**
```
# Start play mode
control_editor action:play

# Move camera to overview position
control_editor action:set_camera location:{x:-1000,y:0,z:500} rotation:{pitch:-20,yaw:0,roll:0}

# Switch to wireframe view
control_editor action:set_view_mode viewMode:Wireframe
```

---

### 3. manage_level
Level loading, saving, and lighting.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `load` | `levelPath` | `streaming` | Load a level |
| `save` | - | - | Save current level |
| `stream` | `levelName`, `shouldBeLoaded` | `shouldBeVisible` | Toggle streaming level |
| `create_light` | `lightType` | `location`, `intensity`, `name` | Create light actor |
| `build_lighting` | - | `quality` | Build lightmaps (Preview/Medium/High/Production) |

**Examples:**
```
# Save current level
manage_level action:save

# Add a directional light (sun)
manage_level action:create_light lightType:Directional intensity:10 name:Sun

# Add point lights
manage_level action:create_light lightType:Point location:{x:0,y:0,z:300} intensity:5000

# Build lighting
manage_level action:build_lighting quality:Preview
```

---

### 4. manage_sequence
Level Sequence / Cinematics automation.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `create` | `name` | `path` | Create new Level Sequence |
| `open` | `path` | - | Open sequence in Sequencer |
| `add_camera` | - | `spawnable` | Add camera to sequence |
| `add_actor` | `actorName` | - | Add actor as possessable |
| `add_actors` | `actorNames` | - | Batch add actors |
| `remove_actors` | `actorNames` | - | Remove actors from sequence |
| `get_bindings` | - | `path` | List all bindings |
| `play` | - | `loopMode` | Play sequence |
| `pause` | - | - | Pause playback |
| `stop` | - | - | Stop/close sequence |
| `set_properties` | - | `frameRate`, `lengthInFrames`, `playbackStart`, `playbackEnd` | Set sequence properties |
| `get_properties` | - | `path` | Get sequence properties |
| `set_playback_speed` | `speed` | - | Set playback speed multiplier |
| `add_transform_keyframe` | `bindingName`, `frame` | `location`, `rotation`, `scale`, `interpolation` | Add transform keyframe |
| `add_camera_cut_track` | - | `path` | Create camera cut master track |
| `add_camera_cut` | `cameraBindingName`, `startFrame` | `endFrame` | Add camera cut at frame |
| `get_tracks` | `bindingName` | - | Get tracks for binding |

**Examples:**
```
# Create and setup a cinematic
manage_sequence action:create name:IntroCutscene path:/Game/Cinematics
manage_sequence action:open path:/Game/Cinematics/IntroCutscene
manage_sequence action:set_properties frameRate:30 lengthInFrames:300

# Add camera and actor
manage_sequence action:add_camera spawnable:true
manage_sequence action:add_actor actorName:PlayerCharacter

# Add keyframes for camera movement
manage_sequence action:add_transform_keyframe bindingName:CineCameraActor frame:0 location:{x:0,y:-500,z:200}
manage_sequence action:add_transform_keyframe bindingName:CineCameraActor frame:60 location:{x:0,y:0,z:200}
manage_sequence action:add_transform_keyframe bindingName:CineCameraActor frame:120 location:{x:500,y:0,z:300}

# Setup camera cuts
manage_sequence action:add_camera_cut_track
manage_sequence action:add_camera_cut cameraBindingName:CineCameraActor startFrame:0 endFrame:120

# Preview
manage_sequence action:play loopMode:loop
```

---

### 5. query_level
Scene understanding and actor discovery. **Current limitation (Dec 2025):** responses often report `success` but omit actor payloads. Use this tool for counts only and confirm actual actor labels in the editor before issuing mutating commands.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `get_all` | - | `limit`, `offset`, `includeHidden` | Get all actors |
| `get_selected` | - | - | Get currently selected actors |
| `get_by_class` | `className` | `limit`, `includeHidden` | Filter by class |
| `get_by_tag` | `tag` | `limit` | Filter by tag |
| `get_by_name` | `namePattern` | `limit` | Filter by name pattern (wildcards) |
| `count` | - | - | Count actors by type |

**Examples:**
```
# Get scene overview
query_level action:count

# Find all lights
query_level action:get_by_class className:Light limit:20

# Find actors by name pattern
query_level action:get_by_name namePattern:Wall_* limit:50

# Get current selection
query_level action:get_selected
```

---

### 6. manage_selection
Editor selection control.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `select` | `actorNames` or `actorPaths` | `additive` | Select actors |
| `deselect` | `actorNames` or `actorPaths` | - | Deselect specific actors |
| `clear` | - | - | Clear all selection |
| `select_all_of_class` | `className` | `additive` | Select by class |
| `invert` | - | - | Invert selection |
| `get` | - | - | Get current selection |

**Examples:**
```
# Select specific actors
manage_selection action:select actorNames:["Cube1","Cube2","Cube3"]

# Add to selection
manage_selection action:select actorNames:["Sphere1"] additive:true

# Select all lights
manage_selection action:select_all_of_class className:PointLight

# Clear selection
manage_selection action:clear
```

---

### 7. manage_asset
Asset browsing and import.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `list` | - | `directory` | List assets in directory |
| `import` | `sourcePath`, `destinationPath` | - | Import FBX/PNG/WAV/EXR |
| `create_material` | `name`, `path` | - | Create empty material |

**Examples:**
```
# Browse content
manage_asset action:list directory:/Game/Materials

# Import a mesh
manage_asset action:import sourcePath:C:/Assets/chair.fbx destinationPath:/Game/Meshes

# Create a material
manage_asset action:create_material name:M_NewMaterial path:/Game/Materials
```

---

### 8. manage_blueprint
Blueprint asset creation.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `create` | `name`, `savePath` | `blueprintType` | Create Blueprint |
| `add_component` | `name`, `componentType`, `componentName` | - | Add component to BP |

**Examples:**
```
# Create an Actor Blueprint
manage_blueprint action:create name:BP_MyActor savePath:/Game/Blueprints blueprintType:Actor

# Add a mesh component
manage_blueprint action:add_component name:BP_MyActor componentType:StaticMeshComponent componentName:MeshComp
```

---

### 9. manage_spline
Spline authoring toolkit.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `create` | `name` | `location`, `rotation`, `points`, `closedLoop`, `replaceExisting`, `space` | Spawn a spline actor with optional initial points |
| `add_point` | `actorName`, `location` | `pointIndex`, `tangent`, `pointType`, `space`, `updateSpline` | Insert a spline control point |
| `set_point` | `actorName`, `pointIndex` | `location`, `tangent`, `arriveTangent`, `leaveTangent`, `pointType`, `space`, `updateSpline` | Modify an existing point |
| `remove_point` | `actorName`, `pointIndex` | `updateSpline` | Delete a control point |
| `get_points` | `actorName` | `space` | Return point data (locations, tangents, distances) |
| `sample` | `actorName`, (`distance` or `inputKey`) | `space` | Sample spline position/direction |

**Examples:**
```
# Create a spline with two points
manage_spline action:create name:MCP_Spline_Test location:{x:0,y:0,z:0} points:[
  {location:{x:0,y:0,z:0}},
  {location:{x:200,y:0,z:100}, tangent:{x:100,y:0,z:0}, pointType:Curve}
]

# Add and sample a point
manage_spline action:add_point actorName:MCP_Spline_Test location:{x:300,y:0,z:150}
manage_spline action:sample actorName:MCP_Spline_Test distance:100
```

---

### 10. manage_component
Actor component management.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `add` | `actorName`, `componentType` | `componentName`, `parentComponent`, `location`, `rotation`, `scale`, `mobility`, `registerComponent`, `replaceExisting` | Add a component to an actor and optionally attach/configure it |
| `remove` | `actorName` | `componentName`, `componentType` | Remove a component by name or class |
| `get` | `actorName` | - | List all components attached to an actor |

**Examples:**
```
# Add a scene component at the actor origin
manage_component action:add actorName:MCP_Cube_B componentType:SceneComponent componentName:MCP_DebugScene location:{x:0,y:0,z:0}

# List and remove the component
manage_component action:get actorName:MCP_Cube_B
manage_component action:remove actorName:MCP_Cube_B componentName:MCP_DebugScene
```

---

### 11. create_effect
Visual effects and debug shapes.

| Action | Required Params | Optional Params | Description |
|--------|----------------|-----------------|-------------|
| `particle` | `effectType` | `location`, `name` | Spawn preset particle |
| `niagara` | `systemPath` | `location`, `scale`, `name` | Spawn Niagara system |
| `debug_shape` | `shape` | `location`, `size`, `color`, `duration` | Draw debug primitive |

**Examples:**
```
# Draw debug shapes for planning
create_effect action:debug_shape shape:Sphere location:{x:0,y:0,z:100} size:100 color:[255,0,0,255] duration:10

# Spawn fire effect
create_effect action:particle effectType:Fire location:{x:0,y:0,z:0}
```

---

### 12. debug_extended
Error tracking and diagnostics.

| Action | Description |
|--------|-------------|
| `check_connection` | Verify UE connection |
| `get_log` | Get recent log entries |
| `get_errors` | Get error messages |
| `get_warnings` | Get warning messages |
| `start_watch` | Start error monitoring |
| `stop_watch` | Stop error monitoring |
| `get_watched_errors` | Get monitored errors |
| `clear_errors` | Clear error buffer |

**Examples:**
```
# Check connection
debug_extended action:check_connection

# Get recent errors
debug_extended action:get_errors

# Get log with filter
debug_extended action:get_log category:LogBlueprint lines:50
```

---

### 13. editor_lifecycle
Editor state and save operations.

| Action | Description |
|--------|-------------|
| `save_level` | Save current level |
| `save_all` | Save all dirty assets |
| `get_dirty` | List unsaved assets |
| `hot_reload` | Trigger Blueprint hot reload |
| `compile_blueprint` | Compile specific Blueprint |
| `restart_pie` | Restart PIE session |
| `load_level` | Load level by path |
| `create_level` | Create new level |
| `get_state` | Get editor state info |
| `refresh_assets` | Refresh asset browser |
| `force_gc` | Force garbage collection |

---

### 14. system_control
Performance and system utilities.

| Action | Required Params | Description |
|--------|----------------|-------------|
| `profile` | `profileType`, `enabled` | Toggle profiling (CPU/GPU/Memory) |
| `show_fps` | `enabled` | Toggle FPS display |
| `set_quality` | `category`, `level` | Set scalability |
| `screenshot` | - | Capture screenshot |
| `read_log` | - | Read engine log file |

---

### 15. project_build
Packaging and builds.

| Action | Required Params | Description |
|--------|----------------|-------------|
| `validate` | - | Validate project |
| `cook` | - | Cook content |
| `package` | - | Package for Windows |
| `build_lighting` | - | Build lightmaps |
| `build_navigation` | - | Build nav mesh |
| `build_all` | - | Full rebuild |

---

### 16. console_command
Direct console access (with safety checks).

**Example:**
```
console_command command:"stat fps"
console_command command:"r.SetRes 1920x1080"
```

**Blocked commands:** quit, exit, crash triggers

---

## Best Practices

### 1. Start Every Session With
```
debug_extended action:check_connection
editor_lifecycle action:get_state
query_level action:count
```

### 2. Quick Iteration Loop
```
1. Make changes
2. editor_lifecycle action:save_level
3. control_editor action:play
4. debug_extended action:get_errors
5. control_editor action:stop
6. Fix and repeat
```

### 3. Before Complex Operations
- Use `query_level` to understand what's in the scene
- Use `manage_selection action:get` to know what's selected
- Save before destructive operations

### 4. Naming Conventions
- Actors: `Type_Name` (e.g., `SM_Chair`, `BP_Enemy`)
- Materials: `M_Name` or `MI_Name` for instances
- Blueprints: `BP_Name`
- Sequences: `LS_Name` or `Seq_Name`

### 5. Coordinate System
- X = Forward (Red)
- Y = Right (Green)  
- Z = Up (Blue)
- Units are centimeters
- Rotation: Pitch (Y), Yaw (Z), Roll (X) in degrees

---

## Troubleshooting

### "Unknown action" Error
The MCP server needs to be restarted after code changes. Restart your IDE or MCP client.

### Connection Failed
1. Check UE is running
2. Verify Remote Control plugin is enabled
3. Check port 30010 is correct (not 30000)

### Python Errors
Some features require Python execution to be enabled:
- Project Settings → Plugins → Remote Control API
- Enable "Allow Remote Python Execution"

### "Actor not found"
- Actor labels are case-insensitive
- Use `query_level` to find exact names
- Check if actor is in a sublevel

---

## Version
UE MCP Extended v0.5.0
Compatible with Unreal Engine 5.7
