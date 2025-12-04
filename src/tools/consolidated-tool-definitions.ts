// Consolidated tool definitions - reduced from 36 to 13 multi-purpose tools

export const consolidatedToolDefinitions = [
   // 1. ASSET MANAGER - Combines asset operations
  {
    name: 'manage_asset',
  description: `Asset library utility for browsing, importing, bootstrapping simple materials, and searching assets.

Use it when you need to:
- explore project content (\u002fContent automatically maps to \u002fGame).
- import FBX/PNG/WAV/EXR files into the project.
- spin up a minimal Material asset at a specific path.
- search for assets by name, type, or location.

Supported actions: list, import, create_material, search.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['list', 'import', 'create_material', 'search'],
          description: 'Action to perform'
        },
        // For list
        directory: { type: 'string', description: 'Directory path to list (shows immediate children only). Automatically maps /Content to /Game. Example: "/Game/MyAssets"' },
        // For import
        sourcePath: { type: 'string', description: 'Source file path on disk to import (FBX, PNG, WAV, EXR supported). Example: "C:/MyAssets/mesh.fbx"' },
        destinationPath: { type: 'string', description: 'Destination path in project content where asset will be imported. Example: "/Game/ImportedAssets"' },
        // For create_material
        name: { type: 'string', description: 'Name for the new material asset. Example: "MyMaterial"' },
        path: { type: 'string', description: 'Content path where material will be saved. Example: "/Game/Materials"' },
        // For search
        searchPattern: { type: 'string', description: 'Name pattern with wildcards (e.g., "*cube*", "material_*", "SM_*"). Case-insensitive.' },
        assetType: { type: 'string', description: 'Filter by asset class (e.g., "StaticMesh", "Material", "Texture2D", "SoundWave", "Blueprint").' },
        recursive: { type: 'boolean', description: 'Search subdirectories (default: true).' },
        limit: { type: 'number', description: 'Maximum results to return (default: 100, max: 500).' },
        offset: { type: 'number', description: 'Pagination offset (default: 0).' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        assets: { 
          type: 'array', 
          description: 'List of assets (for list and search actions)',
          items: {
            type: 'object',
            properties: {
              Name: { type: 'string' },
              Path: { type: 'string' },
              Class: { type: 'string' },
              PackagePath: { type: 'string' }
            }
          }
        },
        paths: { type: 'array', items: { type: 'string' }, description: 'Imported asset paths (for import)' },
        materialPath: { type: 'string', description: 'Created material path (for create_material)' },
        searchResults: { 
          type: 'object',
          description: 'Search metadata (for search action)',
          properties: {
            total: { type: 'number', description: 'Total matching assets found' },
            returned: { type: 'number', description: 'Number of assets returned in this page' },
            hasMore: { type: 'boolean', description: 'Whether there are more results beyond limit' },
            searchPattern: { type: 'string', description: 'The search pattern used' },
            assetType: { type: 'string', description: 'The asset type filter used' },
            directory: { type: 'string', description: 'The directory searched' }
          }
        },
        message: { type: 'string', description: 'Status message' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 2. ACTOR CONTROL - Combines actor operations
  {
    name: 'control_actor',
  description: `Viewport actor toolkit for spawning, transforming, removing, or nudging actors.

Use it when you need to:
- drop a class or mesh into the level (classPath accepts names or asset paths).
- delete actors by label, case-insensitively.
- transform actors (move, rotate, scale).
- spawn multiple actors in a batch (grid or line).
- apply materials to actors.
- push a physics-enabled actor with a world-space force vector.

Supported actions: spawn, delete, transform, batch_spawn, set_material, apply_force.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['spawn', 'delete', 'transform', 'batch_spawn', 'set_material', 'apply_force'],
          description: 'Action to perform'
        },
        // Common
        actorName: { type: 'string', description: 'Actor label/name. Required for delete, transform, set_material. Optional for spawn (auto-generated if not provided).' },
        replaceExisting: { type: 'boolean', description: 'If true, delete any existing actor with the requested name before spawning.' },
        classPath: { 

          type: 'string', 
          description: 'Actor class (e.g., "StaticMeshActor", "CameraActor") OR asset path (e.g., "/Engine/BasicShapes/Cube", "/Game/MyMesh"). Required for spawn and batch_spawn actions.'
        },
        // Transform (for spawn, transform)
        location: {
          type: 'object',
          description: 'World space location in centimeters. For spawn: defaults to origin. For transform: new position.',
          properties: {
            x: { type: 'number', description: 'X coordinate (forward axis in Unreal)' },
            y: { type: 'number', description: 'Y coordinate (right axis in Unreal)' },
            z: { type: 'number', description: 'Z coordinate (up axis in Unreal)' }
          }
        },
        rotation: {
          type: 'object',
          description: 'World space rotation in degrees. For spawn: defaults to zero. For transform: new rotation.',
          properties: {
            pitch: { type: 'number', description: 'Pitch rotation in degrees (Y-axis rotation)' },
            yaw: { type: 'number', description: 'Yaw rotation in degrees (Z-axis rotation)' },
            roll: { type: 'number', description: 'Roll rotation in degrees (X-axis rotation)' }
          }
        },
        scale: {
          type: 'object',
          description: 'Scale multiplier for transform action. 1.0 = original size.',
          properties: {
            x: { type: 'number', description: 'X scale multiplier' },
            y: { type: 'number', description: 'Y scale multiplier' },
            z: { type: 'number', description: 'Z scale multiplier' }
          }
        },
        // Batch spawn
        count: { type: 'number', description: 'Number of actors to spawn in a line (for batch_spawn)' },
        gridSize: {
          type: 'object',
          description: 'Grid dimensions for batch_spawn (alternative to count)',
          properties: {
            rows: { type: 'number', description: 'Number of rows' },
            cols: { type: 'number', description: 'Number of columns' }
          }
        },
        spacing: { type: 'number', description: 'Distance between actors in batch_spawn (default: 200 cm)' },
        startLocation: {
          type: 'object',
          description: 'Starting location for batch_spawn grid/line',
          properties: {
            x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }
          }
        },
        namePrefix: { type: 'string', description: 'Prefix for actor names in batch_spawn' },
        // Material
        materialPath: { type: 'string', description: 'Content path to material asset for set_material (e.g., "/Game/Materials/M_Red")' },
        slotIndex: { type: 'number', description: 'Material slot index (default: 0) for set_material' },
        // Physics
        force: {
          type: 'object',
          description: 'Force vector to apply in Newtons. Required for apply_force action.',
          properties: {
            x: { type: 'number', description: 'Force magnitude along X-axis' },
            y: { type: 'number', description: 'Force magnitude along Y-axis' },
            z: { type: 'number', description: 'Force magnitude along Z-axis' }
          }
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        actor: { type: 'string', description: 'Spawned actor name (for spawn)' },
        deleted: { type: 'string', description: 'Deleted actor name (for delete)' },
        spawned: { type: 'array', description: 'List of spawned actors (for batch_spawn)' },
        count: { type: 'number', description: 'Number of actors spawned (for batch_spawn)' },
        physicsEnabled: { type: 'boolean', description: 'Physics state (for apply_force)' },
        message: { type: 'string', description: 'Status message' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 3. EDITOR CONTROL - Combines editor operations
  {
    name: 'control_editor',
  description: `Editor session controls for PIE playback, camera placement, and view modes.

Use it when you need to:
- start or stop Play In Editor.
- reposition the active viewport camera.
- switch between Lit/Unlit/Wireframe and other safe view modes.

Supported actions: play, stop, set_camera, set_view_mode (with validation).`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['play', 'stop', 'set_camera', 'set_view_mode'],
          description: 'Editor action'
        },
        // Camera
        location: {
          type: 'object',
          description: 'World space camera location for set_camera action. All coordinates required.',
          properties: {
            x: { type: 'number', description: 'X coordinate in centimeters' },
            y: { type: 'number', description: 'Y coordinate in centimeters' },
            z: { type: 'number', description: 'Z coordinate in centimeters' }
          }
        },
        rotation: {
          type: 'object',
          description: 'Camera rotation for set_camera action. All rotation components required.',
          properties: {
            pitch: { type: 'number', description: 'Pitch in degrees' },
            yaw: { type: 'number', description: 'Yaw in degrees' },
            roll: { type: 'number', description: 'Roll in degrees' }
          }
        },
        // View mode
        viewMode: { 
          type: 'string', 
          description: 'View mode for set_view_mode action. Supported: Lit, Unlit, Wireframe, DetailLighting, LightingOnly, LightComplexity, ShaderComplexity. Required for set_view_mode.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        playing: { type: 'boolean', description: 'PIE play state' },
        location: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'Camera location [x, y, z]'
        },
        rotation: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'Camera rotation [pitch, yaw, roll]'
        },
        viewMode: { type: 'string', description: 'Current view mode' },
        message: { type: 'string', description: 'Status message' }
      }
    }
  },

  // 4. LEVEL MANAGER - Combines level and lighting operations
  {
    name: 'manage_level',
  description: `Level management helper for loading/saving, streaming, light creation, and lighting builds.

Use it when you need to:
- open or save a level by path.
- toggle streaming sublevels on/off.
- spawn a light actor of a given type.
- kick off a lighting build at a chosen quality.

Supported actions: load, save, stream, create_light, build_lighting.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['load', 'save', 'stream', 'create_light', 'build_lighting'],
          description: 'Level action'
        },
        // Level
        levelPath: { type: 'string', description: 'Full content path to level asset (e.g., "/Game/Maps/MyLevel"). Required for load action.' },
        levelName: { type: 'string', description: 'Level name for streaming operations. Required for stream action.' },
        streaming: { type: 'boolean', description: 'Whether to use streaming load (true) or direct load (false). Optional for load action.' },
        shouldBeLoaded: { type: 'boolean', description: 'Whether to load (true) or unload (false) the streaming level. Required for stream action.' },
        shouldBeVisible: { type: 'boolean', description: 'Whether the streaming level should be visible after loading. Optional for stream action.' },
        // Lighting
        lightType: { 
          type: 'string', 
          enum: ['Directional', 'Point', 'Spot', 'Rect'],
          description: 'Type of light to create. Directional for sun-like lighting, Point for omni-directional, Spot for cone-shaped, Rect for area lighting. Required for create_light.'
        },
        name: { type: 'string', description: 'Name for the spawned light actor. Optional, auto-generated if not provided.' },
        location: {
          type: 'object',
          description: 'World space location for light placement in centimeters. Optional for create_light, defaults to origin.',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            z: { type: 'number', description: 'Z coordinate' }
          }
        },
        intensity: { type: 'number', description: 'Light intensity value in lumens (for Point/Spot) or lux (for Directional). Typical range: 1000-10000. Optional for create_light.' },
        quality: { 
          type: 'string',
          enum: ['Preview', 'Medium', 'High', 'Production'],
          description: 'Lighting build quality level. Preview is fastest, Production is highest quality. Required for build_lighting action.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        levelName: { type: 'string', description: 'Level name' },
        loaded: { type: 'boolean', description: 'Level loaded state' },
        visible: { type: 'boolean', description: 'Level visibility' },
        lightName: { type: 'string', description: 'Created light name' },
        buildQuality: { type: 'string', description: 'Lighting build quality used' },
        message: { type: 'string', description: 'Status message' }
      }
    }
  },

  // 5. ANIMATION SYSTEM - Combines animation and physics setup
  {
    name: 'animation_physics',
  description: `Animation and physics rigging helper covering Anim BPs, montage playback, and ragdoll setup.

Use it when you need to:
- generate an Animation Blueprint for a skeleton.
- play a montage/animation on an actor at a chosen rate.
- enable a quick ragdoll using an existing physics asset.

Supported actions: create_animation_bp, play_montage, setup_ragdoll.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['create_animation_bp', 'play_montage', 'setup_ragdoll'],
          description: 'Action type'
        },
        // Common
        name: { type: 'string', description: 'Name for the created animation blueprint asset. Required for create_animation_bp action.' },
        actorName: { type: 'string', description: 'Actor label/name in the level to apply animation to. Required for play_montage and setup_ragdoll actions.' },
        // Animation
        skeletonPath: { type: 'string', description: 'Content path to skeleton asset (e.g., "/Game/Characters/MySkeleton"). Required for create_animation_bp action.' },
        montagePath: { type: 'string', description: 'Content path to animation montage asset to play. Required for play_montage if animationPath not provided.' },
        animationPath: { type: 'string', description: 'Content path to animation sequence asset to play. Alternative to montagePath for play_montage action.' },
        playRate: { type: 'number', description: 'Animation playback speed multiplier. 1.0 is normal speed, 2.0 is double speed, 0.5 is half speed. Optional, defaults to 1.0.' },
        // Physics
        physicsAssetName: { type: 'string', description: 'Name or path to physics asset for ragdoll simulation. Required for setup_ragdoll action.' },
        blendWeight: { type: 'number', description: 'Blend weight between animated and ragdoll physics (0.0 to 1.0). 0.0 is fully animated, 1.0 is fully ragdoll. Optional, defaults to 1.0.' },
        savePath: { type: 'string', description: 'Content path where animation blueprint will be saved (e.g., "/Game/Animations"). Required for create_animation_bp action.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        blueprintPath: { type: 'string', description: 'Created animation blueprint path' },
        playing: { type: 'boolean', description: 'Montage playing state' },
        playRate: { type: 'number', description: 'Current play rate' },
        ragdollActive: { type: 'boolean', description: 'Ragdoll activation state' },
        message: { type: 'string', description: 'Status message' }
      }
    }
  },

  // 6. EFFECTS SYSTEM - Combines particles and visual effects
  {
    name: 'create_effect',
  description: `FX sandbox for spawning Niagara systems, particle presets, or disposable debug shapes.

Use it when you need to:
- fire a Niagara system at a specific location/scale.
- trigger a simple particle effect by tag/name.
- draw temporary debug primitives (box/sphere/line) for planning layouts.

Supported actions: niagara, particle, debug_shape.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['particle', 'niagara', 'debug_shape'],
          description: 'Effect type'
        },
        // Common
        name: { type: 'string', description: 'Name for the spawned effect actor. Optional, auto-generated if not provided.' },
        location: {
          type: 'object',
          description: 'World space location where effect will be spawned in centimeters. Optional, defaults to origin.',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            z: { type: 'number', description: 'Z coordinate' }
          }
        },
        // Particles
        effectType: { 
          type: 'string',
          description: 'Preset particle effect type (Fire, Smoke, Water, Explosion, etc.). Used for particle action to spawn common effects.'
        },
        systemPath: { type: 'string', description: 'Content path to Niagara system asset (e.g., "/Game/Effects/MyNiagaraSystem"). Required for niagara action.' },
        scale: { type: 'number', description: 'Uniform scale multiplier for Niagara effect. 1.0 is normal size. Optional, defaults to 1.0.' },
        // Debug
        shape: { 
          type: 'string',
          description: 'Debug shape type to draw (Line, Box, Sphere, Capsule, Cone, Cylinder, Arrow). Required for debug_shape action.'
        },
        size: { type: 'number', description: 'Size/radius of debug shape in centimeters. For Line, this is thickness. For shapes, this is radius/extent. Optional, defaults vary by shape.' },
        color: {
          type: 'array',
          items: { type: 'number' },
          description: 'RGBA color array with values 0-255 (e.g., [255, 0, 0, 255] for red). Optional, defaults to white.'
        },
        duration: { type: 'number', description: 'How long debug shape persists in seconds. 0 means one frame, -1 means permanent until cleared. Optional, defaults to 0.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        effectName: { type: 'string', description: 'Created effect name' },
        effectPath: { type: 'string', description: 'Effect asset path' },
        spawned: { type: 'boolean', description: 'Whether effect was spawned in level' },
        location: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'Effect location [x, y, z]'
        },
        message: { type: 'string', description: 'Status message' }
      }
    }
  },

  // 7. BLUEPRINT MANAGER - Blueprint operations
  {
    name: 'manage_blueprint',
  description: `Blueprint scaffolding helper for creating assets and attaching components.

Use it when you need to:
- create a new Blueprint of a specific base type (Actor, Pawn, Character, ...).
- add a component to an existing Blueprint asset with a unique name.

Supported actions: create, add_component.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['create', 'add_component'],
          description: 'Blueprint action'
        },
        name: { type: 'string', description: 'Name for the blueprint asset. Required for create action. For add_component, this is the blueprint asset name or path.' },
        blueprintType: { 
          type: 'string',
          description: 'Base class type for blueprint (Actor, Pawn, Character, Object, ActorComponent, SceneComponent, etc.). Required for create action.'
        },
        componentType: { type: 'string', description: 'Component class to add (StaticMeshComponent, SkeletalMeshComponent, CameraComponent, etc.). Required for add_component action.' },
        componentName: { type: 'string', description: 'Unique name for the component instance within the blueprint. Required for add_component action.' },
        savePath: { type: 'string', description: 'Content path where blueprint will be saved (e.g., "/Game/Blueprints"). Required for create action.' }
      },
      required: ['action', 'name']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        blueprintPath: { type: 'string', description: 'Blueprint asset path' },
        componentAdded: { type: 'string', description: 'Added component name' },
        message: { type: 'string', description: 'Status message' },
        warning: { type: 'string', description: 'Warning if manual steps needed' }
      }
    }
  },

  // 8. ENVIRONMENT BUILDER - Landscape and foliage
  {
    name: 'build_environment',
  description: `Environment authoring toolkit for landscapes and foliage, from sculpting to procedural scatters.

Use it when you need to:
- create or sculpt a landscape actor.
- add foliage via types or paint strokes.
- drive procedural terrain/foliage generation with bounds, seeds, and density settings.
- spawn explicit foliage instances at transforms.

Supported actions: create_landscape, sculpt, add_foliage, paint_foliage, create_procedural_terrain, create_procedural_foliage, add_foliage_instances, create_landscape_grass_type.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['create_landscape', 'sculpt', 'add_foliage', 'paint_foliage', 'create_procedural_terrain', 'create_procedural_foliage', 'add_foliage_instances', 'create_landscape_grass_type'],
          description: 'Environment action'
        },
        // Common
        name: { type: 'string', description: 'Name for landscape, foliage type, or grass type actor. Optional for most actions, auto-generated if not provided.' },
        // Landscape
        sizeX: { type: 'number', description: 'Landscape width in components. Each component is typically 63 quads. Required for create_landscape action.' },
        sizeY: { type: 'number', description: 'Landscape height in components. Each component is typically 63 quads. Required for create_landscape action.' },
        tool: { 
          type: 'string',
          description: 'Landscape sculpt tool to use (Sculpt, Smooth, Flatten, Ramp, Erosion, Hydro, Noise). Required for sculpt action.'
        },
        // Advanced: procedural terrain
        location: {
          type: 'object',
          description: 'World space location for terrain placement. Required for create_procedural_terrain.',
          properties: { x: { type: 'number', description: 'X coordinate' }, y: { type: 'number', description: 'Y coordinate' }, z: { type: 'number', description: 'Z coordinate' } }
        },
        subdivisions: { type: 'number', description: 'Number of subdivisions for procedural terrain mesh. Higher values create more detailed terrain. Optional for create_procedural_terrain.' },
        heightFunction: { type: 'string', description: 'Mathematical function or algorithm for terrain height generation (e.g., "perlin", "simplex", custom formula). Optional for create_procedural_terrain.' },
        materialPath: { type: 'string', description: 'Content path to material for terrain/landscape (e.g., "/Game/Materials/TerrainMat"). Optional.' },
        // Advanced: procedural foliage
        bounds: {
          type: 'object',
          properties: {
            location: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
            size: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } }
          }
        },
        foliageTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              meshPath: { type: 'string' },
              density: { type: 'number' },
              minScale: { type: 'number' },
              maxScale: { type: 'number' },
              alignToNormal: { type: 'boolean' },
              randomYaw: { type: 'boolean' }
            }
          }
        },
        seed: { type: 'number' },
        // Advanced: direct foliage instances
        foliageType: { type: 'string' },
        transforms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              location: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
              rotation: { type: 'object', properties: { pitch: { type: 'number' }, yaw: { type: 'number' }, roll: { type: 'number' } } },
              scale: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } }
            }
          }
        },
        // Foliage (for add_foliage)
        meshPath: { type: 'string', description: 'Content path to static mesh for foliage (e.g., "/Game/Foliage/TreeMesh"). Required for add_foliage action.' },
        density: { type: 'number', description: 'Foliage placement density (instances per unit area). Typical range: 0.1 to 10.0. Required for add_foliage and affects procedural foliage.' },
        // Painting
        position: {
          type: 'object',
          description: 'World space position for foliage paint brush center. Required for paint_foliage action.',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            z: { type: 'number', description: 'Z coordinate' }
          }
        },
        brushSize: { type: 'number', description: 'Radius of foliage paint brush in centimeters. Typical range: 500-5000. Required for paint_foliage action.' },
        strength: { type: 'number', description: 'Paint tool strength/intensity (0.0 to 1.0). Higher values place more instances. Optional for paint_foliage, defaults to 0.5.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        landscapeName: { type: 'string', description: 'Landscape actor name' },
        foliageTypeName: { type: 'string', description: 'Foliage type name' },
        instancesPlaced: { type: 'number', description: 'Number of foliage instances placed' },
        message: { type: 'string', description: 'Status message' }
      }
    }
  },

  // 9. PERFORMANCE & AUDIO - System settings
  {
    name: 'system_control',
  description: `Runtime/system controls for profiling, quality tiers, audio/UI triggers, screenshots, and editor lifecycle.

Use it when you need to:
- toggle stat overlays or targeted profilers.
- adjust scalability categories (sg.*) or enable FPS display.
- play a one-shot sound and optionally position it.
- create/show lightweight widgets.
- capture a screenshot or start/quit the editor process.

Supported actions: profile, show_fps, set_quality, play_sound, create_widget, show_widget, screenshot, engine_start, engine_quit.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['profile', 'show_fps', 'set_quality', 'play_sound', 'create_widget', 'show_widget', 'screenshot', 'engine_start', 'engine_quit', 'read_log'],
          description: 'System action'
        },
        // Performance
        profileType: { 
          type: 'string',
          description: 'Type of profiling to enable: CPU (stat cpu), GPU (stat gpu), Memory (stat memory), FPS (stat fps), Unit (stat unit). Required for profile action.'
        },
        category: { 
          type: 'string',
          description: 'Scalability quality category to adjust: ViewDistance, AntiAliasing, Shadow/Shadows, PostProcess/PostProcessing, Texture/Textures, Effects, Foliage, Shading. Required for set_quality action.'
        },
        level: { type: 'number', description: 'Quality level (0=Low, 1=Medium, 2=High, 3=Epic, 4=Cinematic). Required for set_quality action.' },
        enabled: { type: 'boolean', description: 'Enable (true) or disable (false) profiling/FPS display. Required for profile and show_fps actions.' },
        verbose: { type: 'boolean', description: 'Show verbose profiling output with additional details. Optional for profile action.' },
        // Audio
        soundPath: { type: 'string', description: 'Content path to sound asset (SoundCue or SoundWave, e.g., "/Game/Audio/MySound"). Required for play_sound action.' },
        location: {
          type: 'object',
          description: 'World space location for 3D sound playback. Required if is3D is true for play_sound action.',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            z: { type: 'number', description: 'Z coordinate' }
          }
        },
        volume: { type: 'number', description: 'Volume multiplier (0.0=silent, 1.0=full volume). Optional for play_sound, defaults to 1.0.' },
        is3D: { type: 'boolean', description: 'Whether sound should be played as 3D positional audio (true) or 2D (false). Optional for play_sound, defaults to false.' },
        // UI
        widgetName: { type: 'string', description: 'Name for widget asset or instance. Required for create_widget and show_widget actions.' },
        widgetType: { 
          type: 'string',
          description: 'Widget blueprint type or category (HUD, Menu, Dialog, Notification, etc.). Optional for create_widget, helps categorize the widget.'
        },
        savePath: { type: 'string', description: 'Optional content path where the widget asset will be saved (defaults to /Game/UI/Widgets).' },
        visible: { type: 'boolean', description: 'Whether widget should be visible (true) or hidden (false). Required for show_widget action.' },

        // Screenshot
        resolution: { type: 'string', description: 'Screenshot resolution in WIDTHxHEIGHT format (e.g., "1920x1080", "3840x2160"). Optional for screenshot action, uses viewport size if not specified.' },
        // Engine lifecycle
        projectPath: { type: 'string', description: 'Absolute path to .uproject file (e.g., "C:/Projects/MyGame/MyGame.uproject"). Required for engine_start unless UE_PROJECT_PATH environment variable is set.' },
        editorExe: { type: 'string', description: 'Absolute path to Unreal Editor executable (e.g., "C:/UnrealEngine/Engine/Binaries/Win64/UnrealEditor.exe"). Required for engine_start unless UE_EDITOR_EXE environment variable is set.' }
        ,
        // Log reading
        filter_category: { description: 'Category filter as string or array; comma-separated or array values' },
        filter_level: { type: 'string', enum: ['Error','Warning','Log','Verbose','VeryVerbose','All'], description: 'Log level filter' },
        lines: { type: 'number', description: 'Number of lines to read from tail' },
        log_path: { type: 'string', description: 'Absolute path to a specific .log file to read' },
        include_prefixes: { type: 'array', items: { type: 'string' }, description: 'Only include categories starting with any of these prefixes' },
        exclude_categories: { type: 'array', items: { type: 'string' }, description: 'Categories to exclude' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        profiling: { type: 'boolean', description: 'Profiling active state' },
        fpsVisible: { type: 'boolean', description: 'FPS display state' },
        qualityLevel: { type: 'number', description: 'Current quality level' },
        soundPlaying: { type: 'boolean', description: 'Sound playback state' },
        widgetPath: { type: 'string', description: 'Created widget path' },
        widgetVisible: { type: 'boolean', description: 'Widget visibility state' },
        imagePath: { type: 'string', description: 'Saved screenshot path' },
        imageBase64: { type: 'string', description: 'Screenshot image base64 (truncated)' },
        pid: { type: 'number', description: 'Process ID for launched editor' },
        message: { type: 'string', description: 'Status message' },
        error: { type: 'string', description: 'Error message if failed' },
        logPath: { type: 'string', description: 'Log file path used for read_log' },
        entries: { 
          type: 'array',
          items: { type: 'object', properties: { timestamp: { type: 'string' }, category: { type: 'string' }, level: { type: 'string' }, message: { type: 'string' } } },
          description: 'Parsed Output Log entries'
        },
        filteredCount: { type: 'number', description: 'Count of entries after filtering' }
      }
    }
  },

  // 10. CONSOLE COMMAND - Universal tool
  {
    name: 'console_command',
  description: `Guarded console command executor for one-off \`stat\`, \`r.*\`, or viewmode commands.

Use it when higher-level tools don't cover the console tweak you need. Hazardous commands (quit/exit, crash triggers, unsafe viewmodes) are blocked, and unknown commands respond with a warning instead of executing blindly.`,
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Console command to execute in Unreal Engine (e.g., "stat fps", "r.SetRes 1920x1080", "viewmode lit"). Dangerous commands like quit/exit and crash triggers are blocked. Required.' }
      },
      required: ['command']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the command executed' },
        command: { type: 'string', description: 'The command that was executed' },
        result: { type: 'object', description: 'Command execution result' },
        warning: { type: 'string', description: 'Warning if command may be unrecognized' },
        info: { type: 'string', description: 'Additional information' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 11. REMOTE CONTROL PRESETS
  {
    name: 'manage_rc',
  description: `Remote Control preset helper for building, exposing, and mutating RC assets.

Use it when you need to:
- create a preset asset on disk.
- expose actors or object properties to the preset.
- list the exposed fields for inspection.
- get or set property values through RC with JSON-serializable payloads.

Supported actions: create_preset, expose_actor, expose_property, list_fields, set_property, get_property.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_preset', 'expose_actor', 'expose_property', 'list_fields', 'set_property', 'get_property'],
          description: 'RC action'
        },
        name: { type: 'string', description: 'Name for Remote Control preset asset. Required for create_preset action.' },
        path: { type: 'string', description: 'Content path where preset will be saved (e.g., "/Game/RCPresets"). Required for create_preset action.' },
        presetPath: { type: 'string', description: 'Full content path to existing Remote Control preset asset (e.g., "/Game/RCPresets/MyPreset"). Required for expose_actor, expose_property, list_fields, set_property, and get_property actions.' },
        actorName: { type: 'string', description: 'Actor label/name in level to expose to Remote Control preset. Required for expose_actor action.' },
        objectPath: { type: 'string', description: 'Full object path for property operations (e.g., "/Game/Maps/Level.Level:PersistentLevel.StaticMeshActor_0"). Required for expose_property, set_property, and get_property actions.' },
        propertyName: { type: 'string', description: 'Name of the property to expose, get, or set (e.g., "RelativeLocation", "Intensity", "bHidden"). Required for expose_property, set_property, and get_property actions.' },
        value: { description: 'New value to set for property. Must be JSON-serializable and compatible with property type (e.g., {"X":100,"Y":200,"Z":300} for location, true/false for bool, number for numeric types). Required for set_property action.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        presetPath: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
        value: {},
        error: { type: 'string' }
      }
    }
  },

  // 12. SEQUENCER / CINEMATICS
  {
    name: 'manage_sequence',
  description: `Sequencer automation helper for Level Sequences: asset management, bindings, and playback control.

Use it when you need to:
- create or open a sequence asset.
- add actors, spawnable cameras, or other bindings.
- adjust sequence metadata (frame rate, bounds, playback window).
- drive playback (play/pause/stop), adjust speed, or fetch binding info.
- add transform keyframes to animate actor movement.
- create camera cuts for cinematic camera switching.
- add property tracks to animate scalar/vector/color properties.
- add audio tracks with sound assets.
- add event tracks for triggering Blueprint events.

Supported actions: create, open, add_camera, add_actor, add_actors, remove_actors, get_bindings, add_spawnable_from_class, play, pause, stop, set_properties, get_properties, set_playback_speed, add_transform_keyframe, add_camera_cut_track, add_camera_cut, get_tracks, add_property_track, add_property_keyframe, add_audio_track, add_event_track, add_event_key.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: [
            'create', 'open', 'add_camera', 'add_actor', 'add_actors', 
            'remove_actors', 'get_bindings', 'add_spawnable_from_class',
            'play', 'pause', 'stop', 'set_properties', 'get_properties', 'set_playback_speed',
            'add_transform_keyframe', 'add_camera_cut_track', 'add_camera_cut', 'get_tracks',
            'add_property_track', 'add_property_keyframe', 'add_audio_track', 'add_event_track', 'add_event_key'
          ], 
          description: 'Sequence action' 
        },
        name: { type: 'string', description: 'Name for new Level Sequence asset. Required for create action.' },
        path: { type: 'string', description: 'Content path - for create action: save location (e.g., "/Game/Cinematics"); for open/operations: full asset path (e.g., "/Game/Cinematics/MySequence"). Required for create and open actions.' },
        actorName: { type: 'string', description: 'Actor label/name in level to add as possessable binding to sequence. Required for add_actor action.' },
        actorNames: { type: 'array', items: { type: 'string' }, description: 'Array of actor labels/names for batch add or remove operations. Required for add_actors and remove_actors actions.' },
        className: { type: 'string', description: 'Unreal class name for spawnable actor (e.g., "StaticMeshActor", "CineCameraActor", "SkeletalMeshActor"). Required for add_spawnable_from_class action.' },
        spawnable: { type: 'boolean', description: 'If true, camera is spawnable (owned by sequence); if false, camera is possessable (references level actor). Optional for add_camera, defaults to true.' },
        frameRate: { type: 'number', description: 'Sequence frame rate in frames per second (e.g., 24, 30, 60). Required for set_properties when changing frame rate.' },
        lengthInFrames: { type: 'number', description: 'Total sequence length measured in frames. Required for set_properties when changing duration.' },
        playbackStart: { type: 'number', description: 'First frame of playback range (inclusive). Optional for set_properties.' },
        playbackEnd: { type: 'number', description: 'Last frame of playback range (inclusive). Optional for set_properties.' },
        speed: { type: 'number', description: 'Playback speed multiplier. 1.0 is normal speed, 2.0 is double speed, 0.5 is half speed. Required for set_playback_speed action.' },
        loopMode: { type: 'string', enum: ['once', 'loop', 'pingpong'], description: 'How sequence loops: "once" plays once and stops, "loop" repeats from start, "pingpong" plays forward then backward. Optional for set_properties.' },
        bindingName: { type: 'string', description: 'Name of the binding (actor label) to target. Required for add_transform_keyframe and get_tracks actions.' },
        cameraBindingName: { type: 'string', description: 'Name of the camera binding for camera cuts. Required for add_camera_cut action.' },
        frame: { type: 'number', description: 'Frame number for keyframe placement. Required for add_transform_keyframe action.' },
        startFrame: { type: 'number', description: 'Start frame for camera cut section. Required for add_camera_cut action.' },
        endFrame: { type: 'number', description: 'End frame for camera cut section. Optional, defaults to sequence end.' },
        location: { 
          type: 'object', 
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          description: 'Location for transform keyframe. Optional for add_transform_keyframe.'
        },
        rotation: { 
          type: 'object', 
          properties: { pitch: { type: 'number' }, yaw: { type: 'number' }, roll: { type: 'number' } },
          description: 'Rotation for transform keyframe. Optional for add_transform_keyframe.'
        },
        scale: { 
          type: 'object', 
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          description: 'Scale for transform keyframe. Optional for add_transform_keyframe.'
        },
        interpolation: { type: 'string', enum: ['linear', 'constant', 'cubic'], description: 'Keyframe interpolation mode. Optional for add_transform_keyframe, defaults to cubic.' },
        // Property track parameters (7.8)
        propertyPath: { type: 'string', description: 'Property path to animate (e.g., "RelativeLocation", "Intensity"). Required for add_property_track and add_property_keyframe.' },
        propertyType: { type: 'string', enum: ['float', 'bool', 'vector', 'color'], description: 'Property value type. Optional for add_property_track, defaults to float.' },
        value: { description: 'Value for property keyframe. Number for float, boolean for bool, {x,y,z} for vector, {r,g,b,a} for color. Required for add_property_keyframe.' },
        // Audio track parameters (7.9)
        soundPath: { type: 'string', description: 'Content path to sound asset (SoundCue or SoundWave). Required for add_audio_track.' },
        rowIndex: { type: 'number', description: 'Row index for audio section. Optional for add_audio_track.' },
        // Event track parameters (7.10)
        eventName: { type: 'string', description: 'Name for the event track. Required for add_event_track and add_event_key.' },
        functionName: { type: 'string', description: 'Blueprint function name to call. Optional for add_event_key, defaults to eventName.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        sequencePath: { type: 'string' },
        cameraBindingId: { type: 'string' },
        bindings: { type: 'array', items: { type: 'object' } },
        actorsAdded: { type: 'array', items: { type: 'string' } },
        removedActors: { type: 'array', items: { type: 'string' } },
        notFound: { type: 'array', items: { type: 'string' } },
        spawnableId: { type: 'string' },
        frameRate: { type: 'object' },
        playbackStart: { type: 'number' },
        playbackEnd: { type: 'number' },
        duration: { type: 'number' },
        playbackSpeed: { type: 'number' },
        keyframes: { type: 'array', items: { type: 'object' }, description: 'Added keyframe details' },
        tracks: { type: 'array', items: { type: 'object' }, description: 'Track information for binding' },
        trackCount: { type: 'number' },
        cameraName: { type: 'string' },
        propertyPath: { type: 'string', description: 'Property path for property track' },
        trackType: { type: 'string', description: 'Type of track created' },
        soundPath: { type: 'string', description: 'Sound asset path for audio track' },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 13. INTROSPECTION
  {
    name: 'inspect',
  description: `Introspection utility for reading or mutating properties on actors, components, or CDOs.

Use it when you need to:
- inspect an object by path and retrieve its serialized properties.
- set a property value with built-in validation.

Supported actions: inspect_object, set_property.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['inspect_object', 'set_property'], description: 'Introspection action: "inspect_object" retrieves all properties, "set_property" modifies a specific property. Required.' },
        objectPath: { type: 'string', description: 'Full object path in Unreal format (e.g., "/Game/Maps/Level.Level:PersistentLevel.StaticMeshActor_0" or "/Script/Engine.Default__StaticMeshActor" for CDO). Required for both actions.' },
        propertyName: { type: 'string', description: 'Name of the property to modify (e.g., "RelativeLocation", "Mobility", "bHidden"). Required for set_property action.' },
        value: { description: 'New property value. Must be JSON-serializable and compatible with property type (e.g., {"X":100,"Y":0,"Z":0} for vectors, 5.0 for floats, true for bools, "Value" for strings). Required for set_property action.' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        info: { type: 'object' },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 14. QUERY LEVEL - Actor queries and scene understanding
  {
    name: 'query_level',
    description: `Level query tool for understanding what actors exist in the current scene.

Use it when you need to:
- see all actors in the level with their transforms and properties.
- find actors by class, tag, or name pattern.
- understand the current selection state.
- count actors by type.

Supported actions: get_all, get_selected, get_by_class, get_by_tag, get_by_name, count.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_all', 'get_selected', 'get_by_class', 'get_by_tag', 'get_by_name', 'count'],
          description: 'Query action to perform'
        },
        className: {
          type: 'string',
          description: 'Actor class name to filter by (e.g., "StaticMeshActor", "PointLight"). Used with get_by_class action.'
        },
        tag: {
          type: 'string',
          description: 'Actor tag to filter by. Used with get_by_tag action.'
        },
        namePattern: {
          type: 'string',
          description: 'Name pattern with wildcards (e.g., "Wall_*", "*_Door_*"). Used with get_by_name action.'
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden actors in results. Default: false.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of actors to return. Default: 100.'
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination. Default: 0.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        actors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              label: { type: 'string' },
              class: { type: 'string' },
              path: { type: 'string' },
              location: { type: 'object' },
              rotation: { type: 'object' },
              scale: { type: 'object' },
              tags: { type: 'array', items: { type: 'string' } },
              isHidden: { type: 'boolean' },
              isSelected: { type: 'boolean' }
            }
          }
        },
        count: { type: 'number' },
        totalCount: { type: 'number' },
        byClass: { type: 'object', description: 'Actor counts by class (for count action)' },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 15. MANAGE SELECTION - Editor selection control
  {
    name: 'manage_selection',
    description: `Editor selection control for selecting, deselecting, and querying actor selection state.

Use it when you need to:
- select specific actors by name or path.
- clear the current selection.
- select all actors of a specific class.
- invert the current selection.

Supported actions: select, deselect, clear, select_all_of_class, invert, get.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['select', 'deselect', 'clear', 'select_all_of_class', 'invert', 'get'],
          description: 'Selection action to perform'
        },
        actorNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Actor names/labels to select or deselect'
        },
        actorPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Full actor object paths to select or deselect'
        },
        className: {
          type: 'string',
          description: 'Class name for select_all_of_class action'
        },
        additive: {
          type: 'boolean',
          description: 'Add to existing selection instead of replacing. Default: false.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        selectedCount: { type: 'number' },
        selectedActors: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 16. DEBUG TOOLS EXTENDED - Enhanced debugging with error watching
  {
    name: 'debug_extended',
    description: `Extended debugging tools with error watching, log analysis, and connection status.

Use it when you need to:
- get recent log entries with filtering by category, severity, or search terms.
- start/stop watching for new errors in real-time.
- get recent errors or warnings specifically.
- check the connection status with Unreal Engine.

Supported actions: get_log, get_errors, get_warnings, start_watch, stop_watch, get_watched_errors, clear_errors, check_connection.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_log', 'get_errors', 'get_warnings', 'start_watch', 'stop_watch', 'get_watched_errors', 'clear_errors', 'check_connection'],
          description: 'Debug action to perform'
        },
        lines: {
          type: 'number',
          description: 'Number of log lines to retrieve. Default: 100.'
        },
        category: {
          type: 'string',
          description: 'Log category filter (e.g., "LogPython", "LogBlueprint", "LogTemp")'
        },
        severity: {
          type: 'string',
          enum: ['all', 'errors', 'warnings', 'errors_and_warnings'],
          description: 'Severity filter for log entries'
        },
        search: {
          type: 'string',
          description: 'Text to search for in log messages'
        },
        watchInterval: {
          type: 'number',
          description: 'Interval in milliseconds for error watching. Default: 2000.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        entries: { type: 'array', items: { type: 'object' } },
        errors: { type: 'array', items: { type: 'object' } },
        warnings: { type: 'array', items: { type: 'object' } },
        count: { type: 'number' },
        isWatching: { type: 'boolean' },
        connected: { type: 'boolean' },
        logPath: { type: 'string' },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 17. EDITOR LIFECYCLE - Save, reload, hot-reload, project management
  {
    name: 'editor_lifecycle',
    description: `Editor lifecycle management for saving, reloading, and project state.

Use it when you need to:
- save the current level or all modified assets.
- trigger Blueprint hot reload after changes.
- restart a PIE (Play In Editor) session.
- load or create levels.
- check editor state (current level, selection, PIE status).
- refresh assets from disk.

Supported actions: save_level, save_all, get_dirty, hot_reload, compile_blueprint, restart_pie, load_level, create_level, get_state, refresh_assets, force_gc.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['save_level', 'save_all', 'get_dirty', 'hot_reload', 'compile_blueprint', 'restart_pie', 'load_level', 'create_level', 'get_state', 'refresh_assets', 'force_gc'],
          description: 'Lifecycle action to perform'
        },
        blueprintPath: {
          type: 'string',
          description: 'Path to Blueprint for compile_blueprint action'
        },
        levelPath: {
          type: 'string',
          description: 'Path to level for load_level action'
        },
        levelName: {
          type: 'string',
          description: 'Name for new level in create_level action'
        },
        templatePath: {
          type: 'string',
          description: 'Optional template path for create_level action'
        },
        streaming: {
          type: 'boolean',
          description: 'Whether to use streaming load for load_level action'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        details: { type: 'object' },
        state: { type: 'object' },
        dirtyAssets: { type: 'array', items: { type: 'string' } },
        error: { type: 'string' }
      }
    }
  },

  // 18. PROJECT BUILD - Packaging and build operations
  {
    name: 'project_build',
    description: `Project packaging and build tools for Windows deployment.

Use it when you need to:
- validate the project before packaging.
- cook content for Windows.
- package the game for Windows (Development or Shipping).
- build lighting, navigation, or all.
- open the packaged output folder.

Supported actions: validate, cook, package, build_lighting, build_navigation, build_all, open_packaged.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['validate', 'cook', 'package', 'build_lighting', 'build_navigation', 'build_all', 'open_packaged'],
          description: 'Build action to perform'
        },
        configuration: {
          type: 'string',
          enum: ['Development', 'Shipping', 'DebugGame'],
          description: 'Build configuration for package action. Default: Development'
        },
        outputDir: {
          type: 'string',
          description: 'Custom output directory for package action'
        },
        compressed: {
          type: 'boolean',
          description: 'Whether to compress the packaged build. Default: true'
        },
        forDistribution: {
          type: 'boolean',
          description: 'Whether to package for distribution (signs executables). Default: false'
        },
        quality: {
          type: 'string',
          enum: ['Preview', 'Medium', 'High', 'Production'],
          description: 'Lighting build quality. Default: High'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        valid: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        details: { type: 'object' },
        logPath: { type: 'string' },
        error: { type: 'string' }
      }
    }
  },

  // 19. ENHANCED INPUT - Phase 7.5
  {
    name: 'manage_input',
    description: `UE5 Enhanced Input System management for InputActions and InputMappingContexts.

Use it when you need to:
- create Input Action assets with value types and triggers.
- create Input Mapping Context assets.
- add key mappings to contexts.
- list and query existing input assets.

Supported actions: create_action, create_context, add_mapping, get_mappings, remove_mapping, list_actions, list_contexts.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_action', 'create_context', 'add_mapping', 'get_mappings', 'remove_mapping', 'list_actions', 'list_contexts'],
          description: 'Input action to perform'
        },
        // Common
        name: {
          type: 'string',
          description: 'Name for new Input Action or Mapping Context.'
        },
        savePath: {
          type: 'string',
          description: 'Content path to save assets (default: /Game/Input).'
        },
        // For create_action
        valueType: {
          type: 'string',
          enum: ['Digital', 'Axis1D', 'Axis2D', 'Axis3D'],
          description: 'Input value type. Digital for buttons, Axis1D for single-axis (triggers), Axis2D for joysticks, Axis3D for 3D motion.'
        },
        triggers: {
          type: 'array',
          items: { type: 'string', enum: ['Pressed', 'Released', 'Hold', 'Tap', 'Pulse'] },
          description: 'Input triggers to add to the action.'
        },
        consumeInput: {
          type: 'boolean',
          description: 'Whether this action consumes input (prevents propagation).'
        },
        // For add_mapping / remove_mapping
        contextPath: {
          type: 'string',
          description: 'Content path to the Input Mapping Context.'
        },
        actionPath: {
          type: 'string',
          description: 'Content path to the Input Action.'
        },
        key: {
          type: 'string',
          description: 'Key name (e.g., "W", "SpaceBar", "Gamepad_FaceButton_Bottom", "LeftMouseButton").'
        },
        modifiers: {
          type: 'array',
          items: { type: 'string', enum: ['Shift', 'Ctrl', 'Alt', 'Cmd', 'Negate', 'Swizzle', 'DeadZone', 'Smooth'] },
          description: 'Input modifiers to apply.'
        },
        // For list operations
        directory: {
          type: 'string',
          description: 'Directory to search for input assets (default: /Game).'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        path: { type: 'string', description: 'Created asset path' },
        valueType: { type: 'string' },
        exists: { type: 'boolean' },
        mappingCount: { type: 'number' },
        removedCount: { type: 'number' },
        mappings: { type: 'array', items: { type: 'object' } },
        actions: { type: 'array', items: { type: 'object' } },
        contexts: { type: 'array', items: { type: 'object' } },
        message: { type: 'string' },
        error: { type: 'string' },
        warnings: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  // 20. RENDERING SETTINGS - Phase 7.3
  {
    name: 'manage_rendering',
    description: `UE5 rendering feature control for Nanite, Lumen, VSM, ray tracing, and post processing.

Use it when you need to:
- enable/disable Nanite on static meshes.
- configure Lumen global illumination settings.
- set Virtual Shadow Maps quality.
- toggle ray tracing features.
- adjust anti-aliasing and screen percentage.
- modify post process volume settings.

Supported actions: set_nanite, get_nanite, set_lumen, get_lumen, set_vsm, set_anti_aliasing, set_screen_percentage, set_ray_tracing, get_info, set_post_process.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_nanite', 'get_nanite', 'set_lumen', 'get_lumen', 'set_vsm', 'set_anti_aliasing', 'set_screen_percentage', 'set_ray_tracing', 'get_info', 'set_post_process'],
          description: 'Rendering action to perform'
        },
        // For Nanite
        meshPath: {
          type: 'string',
          description: 'Content path to static mesh for Nanite operations.'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable/disable flag for various features.'
        },
        // For Lumen
        method: {
          type: 'string',
          enum: ['ScreenTraces', 'HardwareRayTracing'],
          description: 'Lumen tracing method.'
        },
        quality: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Epic'],
          description: 'Quality level for Lumen.'
        },
        finalGatherQuality: {
          type: 'number',
          description: 'Lumen final gather quality (0.5-4.0).'
        },
        reflectionsEnabled: {
          type: 'boolean',
          description: 'Enable Lumen reflections.'
        },
        // For VSM
        resolution: {
          type: 'number',
          enum: [512, 1024, 2048, 4096],
          description: 'Virtual Shadow Map resolution.'
        },
        pagePoolSize: {
          type: 'number',
          description: 'VSM page pool size.'
        },
        // For Anti-Aliasing
        aaMethod: {
          type: 'string',
          enum: ['None', 'FXAA', 'TAA', 'TSR', 'MSAA'],
          description: 'Anti-aliasing method.'
        },
        aaQuality: {
          type: 'number',
          enum: [0, 1, 2, 3, 4],
          description: 'Anti-aliasing quality (0-4).'
        },
        // For Screen Percentage
        percentage: {
          type: 'number',
          description: 'Screen percentage (10-200).'
        },
        // For Ray Tracing
        globalIllumination: { type: 'boolean', description: 'Enable RT global illumination.' },
        reflections: { type: 'boolean', description: 'Enable RT reflections.' },
        shadows: { type: 'boolean', description: 'Enable RT shadows.' },
        ambientOcclusion: { type: 'boolean', description: 'Enable RT ambient occlusion.' },
        translucency: { type: 'boolean', description: 'Enable RT translucency.' },
        // For Post Process
        actorName: {
          type: 'string',
          description: 'PostProcessVolume actor name. If not provided, uses/creates global volume.'
        },
        autoExposure: { type: 'boolean', description: 'Enable auto exposure.' },
        exposureCompensation: { type: 'number', description: 'Exposure compensation EV (-5 to 5).' },
        bloomIntensity: { type: 'number', description: 'Bloom intensity (0-8).' },
        vignetteIntensity: { type: 'number', description: 'Vignette intensity (0-1).' },
        motionBlurAmount: { type: 'number', description: 'Motion blur amount (0-1).' },
        ambientOcclusionIntensity: { type: 'number', description: 'AO intensity (0-1).' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        error: { type: 'string' },
        naniteEnabled: { type: 'boolean' },
        settings: { type: 'object' },
        info: { type: 'object' },
        commandsExecuted: { type: 'array', items: { type: 'string' } },
        settingsApplied: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  // 20. MATERIAL MANAGEMENT - Phase 7.6
  {
    name: 'manage_material',
    description: `Material Instance creation and parameter management.

Use it when you need to:
- create a Material Instance from a parent material.
- set scalar (float), vector (color), or texture parameters.
- get all parameters from a Material Instance.
- copy Material Instances with optional overrides.

Supported actions: create_instance, set_scalar, set_vector, set_texture, get_parameters, copy.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_instance', 'set_scalar', 'set_vector', 'set_texture', 'get_parameters', 'copy'],
          description: 'Material action to perform'
        },
        // For create_instance
        name: {
          type: 'string',
          description: 'Name for the new Material Instance. Required for create_instance and copy.'
        },
        parentMaterial: {
          type: 'string',
          description: 'Content path to parent material (e.g., "/Game/Materials/M_Base"). Required for create_instance.'
        },
        savePath: {
          type: 'string',
          description: 'Content path where asset will be saved (e.g., "/Game/Materials"). Optional, defaults to /Game/Materials.'
        },
        // For parameter operations
        materialPath: {
          type: 'string',
          description: 'Content path to Material Instance for parameter operations. Required for set_scalar, set_vector, set_texture, get_parameters.'
        },
        parameterName: {
          type: 'string',
          description: 'Name of the parameter to set. Required for set_scalar, set_vector, set_texture.'
        },
        // For set_scalar
        scalarValue: {
          type: 'number',
          description: 'Float value for scalar parameter. Required for set_scalar.'
        },
        // For set_vector
        vectorValue: {
          type: 'object',
          description: 'Color value for vector parameter. Required for set_vector.',
          properties: {
            r: { type: 'number', description: 'Red component (0.0-1.0)' },
            g: { type: 'number', description: 'Green component (0.0-1.0)' },
            b: { type: 'number', description: 'Blue component (0.0-1.0)' },
            a: { type: 'number', description: 'Alpha component (0.0-1.0), optional' }
          }
        },
        // For set_texture
        texturePath: {
          type: 'string',
          description: 'Content path to texture asset. Required for set_texture.'
        },
        // For create_instance - batch parameters
        scalarParameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'number' }
            }
          },
          description: 'Array of scalar parameters to set during creation.'
        },
        vectorParameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: {
                type: 'object',
                properties: {
                  r: { type: 'number' },
                  g: { type: 'number' },
                  b: { type: 'number' },
                  a: { type: 'number' }
                }
              }
            }
          },
          description: 'Array of vector parameters to set during creation.'
        },
        textureParameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              texturePath: { type: 'string' }
            }
          },
          description: 'Array of texture parameters to set during creation.'
        },
        // For copy
        sourcePath: {
          type: 'string',
          description: 'Source Material Instance path for copy action.'
        },
        overrideScalars: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'number' }
            }
          },
          description: 'Scalar parameters to override in the copy.'
        },
        overrideVectors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: {
                type: 'object',
                properties: {
                  r: { type: 'number' },
                  g: { type: 'number' },
                  b: { type: 'number' },
                  a: { type: 'number' }
                }
              }
            }
          },
          description: 'Vector parameters to override in the copy.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        path: { type: 'string', description: 'Path to created/modified Material Instance' },
        parametersSet: { type: 'array', description: 'List of parameters that were set' },
        scalarParameters: { type: 'array', description: 'Scalar parameters (for get_parameters)' },
        vectorParameters: { type: 'array', description: 'Vector parameters (for get_parameters)' },
        textureParameters: { type: 'array', description: 'Texture parameters (for get_parameters)' },
        message: { type: 'string', description: 'Status message' },
        error: { type: 'string', description: 'Error message if failed' },
        warnings: { type: 'array', items: { type: 'string' }, description: 'Warnings during operation' }
      }
    }
  },

  // 20. C++ CLASS MANAGEMENT - Phase 6 Complete
  {
    name: 'manage_cpp',
    description: `C++ class scaffolding tool for generating UE5 C++ boilerplate with proper macros.

Use it when you need to:
- create a new C++ class (Actor, Character, Pawn, Component, etc.).
- generate GAS classes (AttributeSet, GameplayAbility, GameplayEffect, ASC on PlayerState).
- generate CommonUI classes (ActivatableWidget, ButtonBase, Widget Stack, Input Actions).
- add UPROPERTY/UFUNCTION with replication support.
- manage Build.cs module dependencies.
- create DataTables, DataAssets, and project modules.

**C++ First Workflow**: Use this for game logic, Blueprints only for small tweaks.
**Multiplayer by Default**: All generated code includes replication patterns.

Supported actions: 
- Class: create_class, add_property, add_function, list_templates
- GAS: create_gas_playerstate, create_gas_gamemode, create_gameplay_effect
- CommonUI: create_widget_stack_manager, create_input_action_data_asset
- Data: create_datatable_struct, create_primary_data_asset
- Project: add_module_dependency, get_module_dependencies, create_module, get_project_info, enable_plugin`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'create_class', 'add_property', 'add_function', 'list_templates',
            'create_gas_playerstate', 'create_gas_gamemode', 'create_gameplay_effect',
            'create_widget_stack_manager', 'create_input_action_data_asset',
            'create_datatable_struct', 'create_primary_data_asset',
            'add_module_dependency', 'get_module_dependencies', 'create_module', 'get_project_info', 'enable_plugin'
          ],
          description: 'C++ action to perform'
        },
        // For create_class
        className: {
          type: 'string',
          description: 'Name for the C++ class (without prefix like A or U). Required for most actions.'
        },
        classType: {
          type: 'string',
          enum: [
            'Actor', 'Character', 'Pawn', 'PlayerController', 'GameMode', 'GameState', 'PlayerState',
            'ActorComponent', 'SceneComponent', 'Widget', 'DataAsset', 'Subsystem',
            'AttributeSet', 'GameplayAbility', 'AbilitySystemComponent',
            'ActivatableWidget', 'ButtonBase'
          ],
          description: 'Base class type for the new C++ class. Required for create_class.'
        },
        moduleName: {
          type: 'string',
          description: 'Module name for the class. Optional, defaults to project name.'
        },
        includeReplication: {
          type: 'boolean',
          description: 'Include GetLifetimeReplicatedProps override for multiplayer. Default: true.'
        },
        interfaces: {
          type: 'array',
          items: { type: 'string' },
          description: 'Interfaces to implement (e.g., "IAbilitySystemInterface").'
        },
        // For add_property
        property: {
          type: 'object',
          description: 'Property definition for add_property action.',
          properties: {
            name: { type: 'string', description: 'Property name' },
            type: { type: 'string', description: 'C++ type (e.g., "float", "FVector", "TObjectPtr<AActor>")' },
            specifiers: {
              type: 'array',
              items: { type: 'string' },
              description: 'UPROPERTY specifiers (e.g., ["EditAnywhere", "BlueprintReadWrite"])'
            },
            defaultValue: { type: 'string', description: 'Default value (e.g., "0.f", "FVector::ZeroVector")' },
            comment: { type: 'string', description: 'Comment for the property' },
            isReplicated: { type: 'boolean', description: 'Mark as Replicated for multiplayer' },
            repNotifyFunc: { type: 'string', description: 'RepNotify function name (e.g., "OnRep_Health")' }
          }
        },
        // For add_function
        function: {
          type: 'object',
          description: 'Function definition for add_function action.',
          properties: {
            name: { type: 'string', description: 'Function name' },
            returnType: { type: 'string', description: 'Return type (e.g., "void", "bool", "float")' },
            parameters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' }
                }
              },
              description: 'Function parameters'
            },
            specifiers: {
              type: 'array',
              items: { type: 'string' },
              description: 'UFUNCTION specifiers (e.g., ["BlueprintCallable", "Category=MyCategory"])'
            },
            isRPC: { type: 'boolean', description: 'Is this a network RPC function?' },
            rpcType: {
              type: 'string',
              enum: ['Server', 'Client', 'NetMulticast'],
              description: 'RPC type for multiplayer'
            },
            isReliable: { type: 'boolean', description: 'Reliable RPC (guaranteed delivery). Default: true' },
            hasValidation: { type: 'boolean', description: 'Include validation function for Server RPCs' },
            body: { type: 'string', description: 'Function body implementation' },
            comment: { type: 'string', description: 'Comment for the function' }
          }
        },
        // For GAS
        attributeSetClass: {
          type: 'string',
          description: 'Attribute set class name for GAS PlayerState.'
        },
        abilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Default ability classes to grant'
        },
        defaultPawnClass: { type: 'string', description: 'Default pawn class for GameMode' },
        playerControllerClass: { type: 'string', description: 'PlayerController class for GameMode' },
        playerStateClass: { type: 'string', description: 'PlayerState class for GameMode' },
        gameStateClass: { type: 'string', description: 'GameState class for GameMode' },
        // For GameplayEffect
        durationType: {
          type: 'string',
          enum: ['Instant', 'Infinite', 'HasDuration'],
          description: 'Duration type for GameplayEffect'
        },
        durationMagnitude: { type: 'number', description: 'Duration in seconds for HasDuration effects' },
        modifiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              attribute: { type: 'string' },
              operation: { type: 'string', enum: ['Add', 'Multiply', 'Override'] },
              magnitude: { type: 'number' }
            }
          },
          description: 'Attribute modifiers for GameplayEffect'
        },
        tags: {
          type: 'object',
          properties: {
            assetTags: { type: 'array', items: { type: 'string' } },
            grantedTags: { type: 'array', items: { type: 'string' } },
            applicationRequiredTags: { type: 'array', items: { type: 'string' } },
            removalTags: { type: 'array', items: { type: 'string' } }
          },
          description: 'Gameplay tags for GameplayEffect'
        },
        // For DataTable
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              displayName: { type: 'string' },
              category: { type: 'string' }
            }
          },
          description: 'Fields for DataTable struct'
        },
        assetType: { type: 'string', description: 'Asset type identifier for PrimaryDataAsset' },
        // For Module/Project management
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Module dependencies to add (e.g., ["GameplayAbilities", "GameplayTags"])'
        },
        isPublic: { type: 'boolean', description: 'Add as public dependency (default: private)' },
        moduleType: {
          type: 'string',
          enum: ['Runtime', 'Editor', 'UncookedOnly'],
          description: 'Module type for create_module'
        },
        loadingPhase: {
          type: 'string',
          enum: ['Default', 'PreDefault', 'PostConfigInit', 'PreLoadingScreen'],
          description: 'Module loading phase'
        },
        pluginName: { type: 'string', description: 'Plugin name for enable_plugin' },
        enabled: { type: 'boolean', description: 'Enable or disable plugin' }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        headerPath: { type: 'string', description: 'Path to generated .h file' },
        sourcePath: { type: 'string', description: 'Path to generated .cpp file' },
        headerContent: { type: 'string', description: 'Generated header file content' },
        sourceContent: { type: 'string', description: 'Generated source file content' },
        content: { type: 'string', description: 'Generated content (for single-file outputs)' },
        buildCsPath: { type: 'string', description: 'Path to Build.cs file' },
        publicDeps: { type: 'array', items: { type: 'string' }, description: 'Public dependencies' },
        privateDeps: { type: 'array', items: { type: 'string' }, description: 'Private dependencies' },
        projectName: { type: 'string', description: 'Project name' },
        engineVersion: { type: 'string', description: 'Engine version' },
        modules: { type: 'array', items: { type: 'object' }, description: 'Project modules' },
        plugins: { type: 'array', items: { type: 'object' }, description: 'Project plugins' },
        templates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parentClass: { type: 'string' },
              module: { type: 'string' }
            }
          },
          description: 'Available class templates (for list_templates)'
        },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 23. COLLISION MANAGEMENT
  {
    name: 'manage_collision',
    description: `Collision preset and channel configuration for actors.

Use it when you need to:
- set collision profile presets on actors (BlockAll, OverlapAll, Pawn, etc.).
- configure collision response to specific channels.
- enable/disable collision on actors.
- query current collision settings.

Supported actions: set_profile, set_response, set_enabled, get_settings.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_profile', 'set_response', 'set_enabled', 'get_settings'],
          description: 'Collision action to perform'
        },
        actorName: {
          type: 'string',
          description: 'Actor label/name to configure collision for. Required for all actions.'
        },
        profile: {
          type: 'string',
          description: 'Collision profile preset name (e.g., "BlockAll", "OverlapAll", "Pawn", "NoCollision"). Required for set_profile action.'
        },
        channel: {
          type: 'string',
          enum: ['WorldStatic', 'WorldDynamic', 'Pawn', 'Visibility', 'Camera', 'PhysicsBody', 'Vehicle', 'Destructible'],
          description: 'Collision channel to configure response for. Required for set_response action.'
        },
        response: {
          type: 'string',
          enum: ['Ignore', 'Overlap', 'Block'],
          description: 'Collision response type. Required for set_response action.'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable collision. Required for set_enabled action.'
        },
        type: {
          type: 'string',
          enum: ['NoCollision', 'QueryOnly', 'PhysicsOnly', 'QueryAndPhysics'],
          description: 'Collision enabled type. Optional for set_enabled, defaults based on enabled flag.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        profile: { type: 'string', description: 'Current or set collision profile' },
        collisionEnabled: { type: 'string', description: 'Collision enabled state' },
        objectType: { type: 'string', description: 'Collision object type' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 24. CURVES MANAGEMENT - Phase 8.2
  {
    name: 'manage_curves',
    description: `Curve asset creation and editing for animation curves, float curves, and vector curves.

Use it when you need to:
- create new curve assets (FloatCurve, VectorCurve, TransformCurve).
- add keyframes to curves with interpolation settings.
- evaluate curves at specific times.
- import/export curve data.

Supported actions: create, add_key, evaluate, import, export.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'add_key', 'evaluate', 'import', 'export'],
          description: 'Curve action to perform'
        },
        name: {
          type: 'string',
          description: 'Name for the curve asset. Required for create action.'
        },
        path: {
          type: 'string',
          description: 'Content path where curve will be saved. Required for create action.'
        },
        curveType: {
          type: 'string',
          enum: ['FloatCurve', 'VectorCurve', 'TransformCurve'],
          description: 'Type of curve to create. Required for create action.'
        },
        curvePath: {
          type: 'string',
          description: 'Content path to existing curve asset. Required for add_key, evaluate, export actions.'
        },
        time: {
          type: 'number',
          description: 'Time value for keyframe or evaluation. Required for add_key and evaluate actions.'
        },
        value: {
          type: 'number',
          description: 'Float value for FloatCurve keyframe. Required for add_key with FloatCurve.'
        },
        vectorValue: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          },
          description: 'Vector value for VectorCurve keyframe. Required for add_key with VectorCurve.'
        },
        interpolation: {
          type: 'string',
          enum: ['Linear', 'Constant', 'Cubic'],
          description: 'Keyframe interpolation mode. Optional for add_key, defaults to Cubic.'
        },
        importPath: {
          type: 'string',
          description: 'File path to import curve data from (CSV/JSON). Required for import action.'
        },
        exportPath: {
          type: 'string',
          description: 'File path to export curve data to. Required for export action.'
        },
        exportFormat: {
          type: 'string',
          enum: ['CSV', 'JSON'],
          description: 'Export format. Optional for export, defaults to CSV.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        curvePath: { type: 'string', description: 'Path to created/modified curve asset' },
        value: { type: 'number', description: 'Evaluated float value (for evaluate action)' },
        vectorValue: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          },
          description: 'Evaluated vector value (for evaluate action)'
        },
        keyCount: { type: 'number', description: 'Number of keyframes in curve' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 25. GAMEMODE SETUP - Phase 8.3
  {
    name: 'manage_gamemode',
    description: `GameMode and game framework class setup for multiplayer projects.

Use it when you need to:
- create GameMode, GameState, PlayerState, and PlayerController classes.
- configure default classes for multiplayer framework.
- set up replication and RPC patterns.
- configure input and HUD classes.

Supported actions: create_framework, set_default_classes, configure_replication, setup_input.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_framework', 'set_default_classes', 'configure_replication', 'setup_input'],
          description: 'GameMode action to perform'
        },
        projectName: {
          type: 'string',
          description: 'Project name for class naming. Required for create_framework action.'
        },
        includeGAS: {
          type: 'boolean',
          description: 'Include Gameplay Ability System classes (PlayerState with ASC). Optional for create_framework, defaults to true.'
        },
        includeCommonUI: {
          type: 'boolean',
          description: 'Include CommonUI classes. Optional for create_framework, defaults to true.'
        },
        gameModeClass: {
          type: 'string',
          description: 'GameMode class to set as default. Required for set_default_classes action.'
        },
        playerControllerClass: {
          type: 'string',
          description: 'PlayerController class to set as default. Optional for set_default_classes.'
        },
        playerStateClass: {
          type: 'string',
          description: 'PlayerState class to set as default. Optional for set_default_classes.'
        },
        gameStateClass: {
          type: 'string',
          description: 'GameState class to set as default. Optional for set_default_classes.'
        },
        hudClass: {
          type: 'string',
          description: 'HUD class to set as default. Optional for set_default_classes.'
        },
        replicationMode: {
          type: 'string',
          enum: ['Full', 'Minimal', 'ClientPredicted'],
          description: 'Replication mode for configure_replication action. Required for configure_replication.'
        },
        inputContext: {
          type: 'string',
          description: 'Input Mapping Context asset path. Required for setup_input action.'
        },
        inputMode: {
          type: 'string',
          enum: ['UIOnly', 'GameOnly', 'GameAndUI'],
          description: 'Default input mode. Optional for setup_input, defaults to GameOnly.'
        },
        mouseLockMode: {
          type: 'string',
          enum: ['DoNotLock', 'LockOnCapture', 'LockAlways'],
          description: 'Mouse lock mode. Optional for setup_input, defaults to LockOnCapture.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        classesCreated: { type: 'array', items: { type: 'string' }, description: 'List of classes created' },
        defaultClasses: {
          type: 'object',
          description: 'Default classes that were set',
          properties: {
            gameMode: { type: 'string' },
            playerController: { type: 'string' },
            playerState: { type: 'string' },
            gameState: { type: 'string' },
            hud: { type: 'string' }
          }
        },
        replicationConfig: { type: 'object', description: 'Replication configuration applied' },
        inputConfig: { type: 'object', description: 'Input configuration applied' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 26. ACTOR TAGS - Phase 8.4
  {
    name: 'manage_tags',
    description: `Actor tag management for organizing, querying, and filtering actors.

Use it when you need to:
- add or remove tags from actors.
- query actors by tags.
- manage tag containers on actors.
- check if actors have specific tags.

Supported actions: add, remove, has, get_all, clear, query.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove', 'has', 'get_all', 'clear', 'query'],
          description: 'Tag action to perform'
        },
        actorName: {
          type: 'string',
          description: 'Actor label/name to manage tags for. Required for add, remove, has, get_all, clear actions.'
        },
        tag: {
          type: 'string',
          description: 'Tag to add, remove, or check. Required for add, remove, has actions.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Multiple tags to add or remove. Optional for add and remove actions.'
        },
        tagPattern: {
          type: 'string',
          description: 'Tag pattern with wildcards for querying (e.g., "Enemy_*", "*_Door"). Required for query action.'
        },
        matchAll: {
          type: 'boolean',
          description: 'Match all tags (AND) vs any tag (OR). Optional for query action, defaults to false (OR).'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        actorName: { type: 'string', description: 'Actor name' },
        tag: { type: 'string', description: 'Tag that was added/removed/checked' },
        tags: { type: 'array', items: { type: 'string' }, description: 'List of tags' },
        hasTag: { type: 'boolean', description: 'Whether actor has the tag (for has action)' },
        actors: { type: 'array', items: { type: 'string' }, description: 'List of actor names matching query' },
        count: { type: 'number', description: 'Number of actors/tags' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 27. COMPONENT TOOLS - Phase 8.6
  {
    name: 'manage_component',
    description: `Actor component management toolkit.

Use it when you need to:
- add a component to an existing actor.
- remove a specific component from an actor.
- inspect components attached to an actor.

Supported actions: add, remove, get.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove', 'get'],
          description: 'Component action to perform'
        },
        actorName: { type: 'string', description: 'Actor label/name to operate on.' },
        componentType: { type: 'string', description: 'Component class path or name (StaticMeshComponent, SceneComponent, etc.). Required for add and optional for remove.' },
        componentName: { type: 'string', description: 'Component name to create or target for removal.' },
        parentComponent: { type: 'string', description: 'Optional parent component name to attach to (defaults to root).' },
        location: {
          type: 'object',
          description: 'Relative location for new scene components.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        rotation: {
          type: 'object',
          description: 'Relative rotation for new scene components.',
          properties: {
            pitch: { type: 'number' },
            yaw: { type: 'number' },
            roll: { type: 'number' }
          }
        },
        scale: {
          type: 'object',
          description: 'Relative scale for new scene components.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        mobility: {
          type: 'string',
          enum: ['Static', 'Stationary', 'Movable'],
          description: 'Optional mobility override for primitive components.'
        },
        registerComponent: {
          type: 'boolean',
          description: 'If true (default), registers the new component after creation.'
        },
        replaceExisting: {
          type: 'boolean',
          description: 'If true, destroy any component with the same name before adding a new one.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        actorName: { type: 'string', description: 'Actor name used for the operation' },
        componentName: { type: 'string', description: 'Component name affected' },
        componentClass: { type: 'string', description: 'Component class affected' },
        attachedTo: { type: 'string', description: 'Parent component name for new scene components' },
        components: {
          type: 'array',
          description: 'Full component listing for get action.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              className: { type: 'string' },
              isRegistered: { type: 'boolean' },
              isSceneComponent: { type: 'boolean' },
              isPrimitiveComponent: { type: 'boolean' },
              attachedTo: { type: 'string' },
              relativeLocation: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              relativeRotation: {
                type: 'object',
                properties: {
                  pitch: { type: 'number' },
                  yaw: { type: 'number' },
                  roll: { type: 'number' }
                }
              },
              relativeScale: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              mobility: { type: 'string' }
            }
          }
        },
        count: { type: 'number', description: 'Number of components returned for get action' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  },

  // 28. SPLINE TOOLS - Phase 8.5
  {
    name: 'manage_spline',
    description: `Spline authoring toolkit for creating and editing spline actors.

Use it when you need to:
- create a spline actor with predefined points.
- add, update, or remove spline control points.
- inspect spline point data (location, tangents).
- sample a spline at a distance or spline input key.

Supported actions: create, add_point, set_point, remove_point, get_points, sample.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'add_point', 'set_point', 'remove_point', 'get_points', 'sample'],
          description: 'Spline action to perform'
        },
        name: { type: 'string', description: 'Spline actor name for create action.' },
        actorName: { type: 'string', description: 'Existing spline actor label/name for point operations.' },
        location: {
          type: 'object',
          description: 'World space location (x, y, z). Required for add_point and optional for create.',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            z: { type: 'number', description: 'Z coordinate' }
          }
        },
        rotation: {
          type: 'object',
          description: 'World rotation (pitch, yaw, roll) for create action.',
          properties: {
            pitch: { type: 'number', description: 'Pitch in degrees' },
            yaw: { type: 'number', description: 'Yaw in degrees' },
            roll: { type: 'number', description: 'Roll in degrees' }
          }
        },
        points: {
          type: 'array',
          description: 'Point definitions for create action.',
          items: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                description: 'Point location (x, y, z)',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              tangent: {
                type: 'object',
                description: 'Optional tangent direction (x, y, z)',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              pointType: {
                type: 'string',
                description: 'Spline point type (Linear, Curve, Constant, CurveClamped)'
              }
            }
          }
        },
        pointIndex: {
          type: 'number',
          description: 'Zero-based point index for set_point/remove_point or insertion index for add_point.'
        },
        tangent: {
          type: 'object',
          description: 'Tangent vector (x, y, z) for add_point or set_point.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        arriveTangent: {
          type: 'object',
          description: 'Arrive tangent override for set_point.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        leaveTangent: {
          type: 'object',
          description: 'Leave tangent override for set_point.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        pointType: {
          type: 'string',
          description: 'Spline point type (Linear, Curve, Constant, CurveClamped).'
        },
        space: {
          type: 'string',
          enum: ['World', 'Local'],
          description: 'Coordinate space for point operations (default: World).'
        },
        closedLoop: {
          type: 'boolean',
          description: 'Whether the created spline should be closed.'
        },
        replaceExisting: {
          type: 'boolean',
          description: 'If true, delete any existing actor with the same name before create.'
        },
        updateSpline: {
          type: 'boolean',
          description: 'Whether to update the spline after point edits (default: true).'
        },
        distance: {
          type: 'number',
          description: 'Distance along spline (cm) for sample action.'
        },
        inputKey: {
          type: 'number',
          description: 'Spline input key (0-1) for sample action.'
        }
      },
      required: ['action']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the operation succeeded' },
        message: { type: 'string', description: 'Status message' },
        actorName: { type: 'string', description: 'Spline actor name' },
        actorPath: { type: 'string', description: 'Actor path in the level' },
        pointIndex: { type: 'number', description: 'Point index affected by the operation' },
        pointCount: { type: 'number', description: 'Total point count on the spline' },
        pointsAdded: { type: 'number', description: 'Number of points created during create/add actions' },
        points: {
          type: 'array',
          description: 'List of spline points (for get_points).',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              location: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              tangent: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              arriveTangent: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              leaveTangent: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' }
                }
              },
              distance: { type: 'number', description: 'Distance along spline at this point' },
              pointType: { type: 'string', description: 'Spline point type' }
            }
          }
        },
        location: {
          type: 'object',
          description: 'Location returned by create/sample actions',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        direction: {
          type: 'object',
          description: 'Forward direction vector returned by sample',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        upVector: {
          type: 'object',
          description: 'Up vector returned by sample',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          }
        },
        rotation: {
          type: 'object',
          description: 'Rotation returned by sample',
          properties: {
            pitch: { type: 'number' },
            yaw: { type: 'number' },
            roll: { type: 'number' }
          }
        },
        distance: { type: 'number', description: 'Distance used for sampling' },
        inputKey: { type: 'number', description: 'Input key used for sampling' },
        sampleMode: { type: 'string', description: 'Indicates whether sampling used distance or inputKey' },
        error: { type: 'string', description: 'Error message if failed' }
      }
    }
  }
];
