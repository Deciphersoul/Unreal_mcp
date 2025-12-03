/**
 * Consolidated Tool Handlers
 * 
 * Maps 23 MCP tools to their action handlers.
 * Each tool has a numbered section with its action cases.
 * 
 * Structure:
 * - 1-10: Core tools (assets, actors, editor, level, animation, effects, blueprint, environment, system, console)
 * - 11-15: Data tools (RC presets, sequence, introspection, query, selection)
 * - 16-18: Lifecycle tools (debug, editor lifecycle, project build)
 * - 19-23: Phase 6-7 tools (input, rendering, material, cpp, collision)
 */

import {
  log,
  ensureArgsPresent,
  requireAction,
  requireNonEmptyString,
  requirePositiveNumber,
  requireVector3Components,
  elicitMissingPrimitiveArgs,
  getElicitationTimeoutMs,
  cleanObject
} from './handlers/handler-utils.js';

export async function handleConsolidatedToolCall(
  name: string,
  args: any,
  tools: any
) {
  const startTime = Date.now();
  // Use scoped logger (stderr) to avoid polluting stdout JSON
  log.debug(`Starting execution of ${name} at ${new Date().toISOString()}`);
  
  try {
    ensureArgsPresent(args);

    switch (name) {
      // 1. ASSET MANAGER
      case 'manage_asset':
        switch (requireAction(args)) {
          case 'list': {
            if (args.directory !== undefined && args.directory !== null && typeof args.directory !== 'string') {
              throw new Error('Invalid directory: must be a string');
            }
            const res = await tools.assetResources.list(args.directory || '/Game', false);
            return cleanObject({ success: true, ...res });
          }
          case 'import': {
            let sourcePath = typeof args.sourcePath === 'string' ? args.sourcePath.trim() : '';
            let destinationPath = typeof args.destinationPath === 'string' ? args.destinationPath.trim() : '';

            if ((!sourcePath || !destinationPath) && typeof tools.supportsElicitation === 'function' && tools.supportsElicitation() && typeof tools.elicit === 'function') {
              const schemaProps: Record<string, any> = {};
              const required: string[] = [];

              if (!sourcePath) {
                schemaProps.sourcePath = {
                  type: 'string',
                  title: 'Source File Path',
                  description: 'Full path to the asset file on disk to import'
                };
                required.push('sourcePath');
              }

              if (!destinationPath) {
                schemaProps.destinationPath = {
                  type: 'string',
                  title: 'Destination Path',
                  description: 'Unreal content path where the asset should be imported (e.g., /Game/MCP/Assets)'
                };
                required.push('destinationPath');
              }

              if (required.length > 0) {
                const timeoutMs = getElicitationTimeoutMs(tools);
                const options: any = { fallback: async () => ({ ok: false, error: 'missing-import-params' }) };
                if (typeof timeoutMs === 'number') {
                  options.timeoutMs = timeoutMs;
                }
                const elicited = await tools.elicit(
                  'Provide the missing import parameters for manage_asset.import',
                  { type: 'object', properties: schemaProps, required },
                  options
                );

                if (elicited?.ok && elicited.value) {
                  if (typeof elicited.value.sourcePath === 'string') {
                    sourcePath = elicited.value.sourcePath.trim();
                  }
                  if (typeof elicited.value.destinationPath === 'string') {
                    destinationPath = elicited.value.destinationPath.trim();
                  }
                }
              }
            }

            const sourcePathValidated = requireNonEmptyString(sourcePath || args.sourcePath, 'sourcePath', 'Invalid sourcePath');
            const destinationPathValidated = requireNonEmptyString(destinationPath || args.destinationPath, 'destinationPath', 'Invalid destinationPath');
            const res = await tools.assetTools.importAsset(sourcePathValidated, destinationPathValidated);
            return cleanObject(res);
          }
           case 'create_material': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the material details for manage_asset.create_material',
              {
                name: {
                  type: 'string',
                  title: 'Material Name',
                  description: 'Name for the new material asset'
                },
                path: {
                  type: 'string',
                  title: 'Save Path',
                  description: 'Optional Unreal content path where the material should be saved'
                }
              }
            );
            const sanitizedName = typeof args.name === 'string' ? args.name.trim() : args.name;
            const sanitizedPath = typeof args.path === 'string' ? args.path.trim() : args.path;
            const name = requireNonEmptyString(sanitizedName, 'name', 'Invalid name: must be a non-empty string');
            const res = await tools.materialTools.createMaterial(name, sanitizedPath || '/Game/Materials');
            return cleanObject(res);
          }
          case 'search': {
            // Get search parameters with defaults
            const searchPattern = typeof args.searchPattern === 'string' ? args.searchPattern.trim() : undefined;
            const assetType = typeof args.assetType === 'string' ? args.assetType.trim() : undefined;
            const directory = typeof args.directory === 'string' ? args.directory.trim() : '/Game';
            const recursive = typeof args.recursive === 'boolean' ? args.recursive : true;
            const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 500) : 100;
            const offset = typeof args.offset === 'number' ? Math.max(args.offset, 0) : 0;
            
            // Validate that at least one search parameter is provided
            if (!searchPattern && !assetType) {
              throw new Error('At least one of searchPattern or assetType must be provided for search action');
            }
            
            // Call asset resources search method
            const res = await tools.assetResources.search({
              searchPattern,
              assetType,
              directory,
              recursive,
              limit,
              offset
            });
            
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown asset action: ${args.action}`);
        }

      // 2. ACTOR CONTROL
      case 'control_actor':
        switch (requireAction(args)) {
          case 'spawn': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the spawn parameters for control_actor.spawn',
              {
                classPath: {
                  type: 'string',
                  title: 'Actor Class or Asset Path',
                  description: 'Class name (e.g., StaticMeshActor) or asset path (e.g., /Engine/BasicShapes/Cube) to spawn'
                }
              }
            );
            const classPathInput = typeof args.classPath === 'string' ? args.classPath.trim() : args.classPath;
            const classPath = requireNonEmptyString(classPathInput, 'classPath', 'Invalid classPath: must be a non-empty string');
            const actorNameInput = typeof args.actorName === 'string' && args.actorName.trim() !== ''
              ? args.actorName
              : (typeof args.name === 'string' ? args.name : undefined);
            const res = await tools.actorTools.spawn({
              classPath,
              location: args.location,
              rotation: args.rotation,
              actorName: actorNameInput
            });
            return cleanObject(res);
          }
          case 'delete': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Which actor should control_actor.delete remove?',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Exact label of the actor to delete'
                }
              }
            );
            const actorNameArg = typeof args.actorName === 'string' && args.actorName.trim() !== ''
              ? args.actorName
              : (typeof args.name === 'string' ? args.name : undefined);
            const actorName = requireNonEmptyString(actorNameArg, 'actorName', 'Invalid actorName');
            // Use ActorTools.delete() which tries Direct RC first, then Python fallback
            const res = await tools.actorTools.delete(actorName);
            return cleanObject(res);
          }
          case 'transform': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Which actor should control_actor.transform modify?',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Exact label of the actor to transform'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Invalid actorName');
            const res = await tools.actorTools.transform({
              actorName,
              location: args.location,
              rotation: args.rotation,
              scale: args.scale
            });
            return cleanObject(res);
          }
          case 'batch_spawn': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the class path for control_actor.batch_spawn',
              {
                classPath: {
                  type: 'string',
                  title: 'Actor Class or Asset Path',
                  description: 'Class name or asset path to spawn multiple instances of'
                }
              }
            );
            const classPath = requireNonEmptyString(args.classPath, 'classPath', 'Invalid classPath');
            const res = await tools.actorTools.batchSpawn({
              classPath,
              count: args.count,
              positions: args.positions,
              gridSize: args.gridSize,
              spacing: args.spacing,
              startLocation: args.startLocation,
              namePrefix: args.namePrefix
            });
            return cleanObject(res);
          }
          case 'set_material': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide actor and material for control_actor.set_material',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor to apply material to'
                },
                materialPath: {
                  type: 'string',
                  title: 'Material Path',
                  description: 'Content path to material asset'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Invalid actorName');
            const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Invalid materialPath');
            const res = await tools.actorTools.setMaterial({
              actorName,
              materialPath,
              slotIndex: args.slotIndex
            });
            return cleanObject(res);
          }
          case 'apply_force': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the target actor for control_actor.apply_force',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Physics-enabled actor that should receive the force'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Invalid actorName');
            const vector = requireVector3Components(args.force, 'Invalid force: must have numeric x,y,z');
            const res = await tools.physicsTools.applyForce({
              actorName,
              forceType: 'Force',
              vector
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown actor action: ${args.action}`);
        }

      // 3. EDITOR CONTROL
      case 'control_editor':
        switch (requireAction(args)) {
          case 'play': {
            const res = await tools.editorTools.playInEditor();
            return cleanObject(res);
          }
          case 'stop': {
            const res = await tools.editorTools.stopPlayInEditor();
            return cleanObject(res);
          }
          case 'pause': {
            const res = await tools.editorTools.pausePlayInEditor();
            return cleanObject(res);
          }
          case 'set_game_speed': {
            const speed = requirePositiveNumber(args.speed, 'speed', 'Invalid speed: must be a positive number');
            // Use console command via bridge
            const res = await tools.bridge.executeConsoleCommand(`slomo ${speed}`);
            return cleanObject(res);
          }
          case 'eject': {
            const res = await tools.bridge.executeConsoleCommand('eject');
            return cleanObject(res);
          }
          case 'possess': {
            const res = await tools.bridge.executeConsoleCommand('viewself');
            return cleanObject(res);
          }
          case 'set_camera': {
            const res = await tools.editorTools.setViewportCamera(args.location, args.rotation);
            return cleanObject(res);
          }
          case 'set_view_mode': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the view mode for control_editor.set_view_mode',
              {
                viewMode: {
                  type: 'string',
                  title: 'View Mode',
                  description: 'Viewport view mode (e.g., Lit, Unlit, Wireframe)'
                }
              }
            );
            const viewMode = requireNonEmptyString(args.viewMode, 'viewMode', 'Missing required parameter: viewMode');
            const res = await tools.bridge.setSafeViewMode(viewMode);
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown editor action: ${args.action}`);
        }

      // 4. LEVEL MANAGER
case 'manage_level':
        switch (requireAction(args)) {
          case 'load': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Select the level to load for manage_level.load',
              {
                levelPath: {
                  type: 'string',
                  title: 'Level Path',
                  description: 'Content path of the level asset to load (e.g., /Game/Maps/MyLevel)'
                }
              }
            );
            const levelPath = requireNonEmptyString(args.levelPath, 'levelPath', 'Missing required parameter: levelPath');
            const res = await tools.levelTools.loadLevel({ levelPath, streaming: !!args.streaming });
            return cleanObject(res);
          }
          case 'save': {
            const res = await tools.levelTools.saveLevel({ levelName: args.levelName, savePath: args.savePath });
            return cleanObject(res);
          }
          case 'stream': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the streaming level name for manage_level.stream',
              {
                levelName: {
                  type: 'string',
                  title: 'Level Name',
                  description: 'Streaming level name to toggle'
                }
              }
            );
            const levelName = requireNonEmptyString(args.levelName, 'levelName', 'Missing required parameter: levelName');
            const res = await tools.levelTools.streamLevel({ levelName, shouldBeLoaded: !!args.shouldBeLoaded, shouldBeVisible: !!args.shouldBeVisible });
            return cleanObject(res);
          }
          case 'create_light': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the light details for manage_level.create_light',
              {
                lightType: {
                  type: 'string',
                  title: 'Light Type',
                  description: 'Directional, Point, Spot, Rect, or Sky'
                },
                name: {
                  type: 'string',
                  title: 'Light Name',
                  description: 'Name for the new light actor'
                }
              }
            );
            const lightType = requireNonEmptyString(args.lightType, 'lightType', 'Missing required parameter: lightType');
            const name = requireNonEmptyString(args.name, 'name', 'Invalid name');
            const typeKey = lightType.toLowerCase();
            const toVector = (value: any, fallback: [number, number, number]): [number, number, number] => {
              if (Array.isArray(value) && value.length === 3) {
                return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
              }
              if (value && typeof value === 'object') {
                return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
              }
              return fallback;
            };
            const toRotator = (value: any, fallback: [number, number, number]): [number, number, number] => {
              if (Array.isArray(value) && value.length === 3) {
                return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
              }
              if (value && typeof value === 'object') {
                return [Number(value.pitch) || 0, Number(value.yaw) || 0, Number(value.roll) || 0];
              }
              return fallback;
            };
            const toColor = (value: any): [number, number, number] | undefined => {
              if (Array.isArray(value) && value.length === 3) {
                return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
              }
              if (value && typeof value === 'object') {
                return [Number(value.r) || 0, Number(value.g) || 0, Number(value.b) || 0];
              }
              return undefined;
            };

            const location = toVector(args.location, [0, 0, typeKey === 'directional' ? 500 : 0]);
            const rotation = toRotator(args.rotation, [0, 0, 0]);
            const color = toColor(args.color);
            const castShadows = typeof args.castShadows === 'boolean' ? args.castShadows : undefined;

            if (typeKey === 'directional') {
              return cleanObject(await tools.lightingTools.createDirectionalLight({
                name,
                intensity: args.intensity,
                color,
                rotation,
                castShadows,
                temperature: args.temperature
              }));
            }
            if (typeKey === 'point') {
              return cleanObject(await tools.lightingTools.createPointLight({
                name,
                location,
                intensity: args.intensity,
                radius: args.radius,
                color,
                falloffExponent: args.falloffExponent,
                castShadows
              }));
            }
            if (typeKey === 'spot') {
              const innerCone = typeof args.innerCone === 'number' ? args.innerCone : undefined;
              const outerCone = typeof args.outerCone === 'number' ? args.outerCone : undefined;
              if (innerCone !== undefined && outerCone !== undefined && innerCone >= outerCone) {
                throw new Error('innerCone must be less than outerCone');
              }
              return cleanObject(await tools.lightingTools.createSpotLight({
                name,
                location,
                rotation,
                intensity: args.intensity,
                innerCone: args.innerCone,
                outerCone: args.outerCone,
                radius: args.radius,
                color,
                castShadows
              }));
            }
            if (typeKey === 'rect') {
              return cleanObject(await tools.lightingTools.createRectLight({
                name,
                location,
                rotation,
                intensity: args.intensity,
                width: args.width,
                height: args.height,
                color
              }));
            }
            if (typeKey === 'sky' || typeKey === 'skylight') {
              return cleanObject(await tools.lightingTools.createSkyLight({
                name,
                sourceType: args.sourceType,
                cubemapPath: args.cubemapPath,
                intensity: args.intensity,
                recapture: args.recapture
              }));
            }
            throw new Error(`Unknown light type: ${lightType}`);
          }
          case 'build_lighting': {
            const res = await tools.lightingTools.buildLighting({ quality: args.quality || 'High', buildReflectionCaptures: true });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown level action: ${args.action}`);
        }

      // 5. ANIMATION & PHYSICS
case 'animation_physics':
        switch (requireAction(args)) {
          case 'create_animation_bp': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for animation_physics.create_animation_bp',
              {
                name: {
                  type: 'string',
                  title: 'Blueprint Name',
                  description: 'Name of the Animation Blueprint to create'
                },
                skeletonPath: {
                  type: 'string',
                  title: 'Skeleton Path',
                  description: 'Content path of the skeleton asset to bind'
                }
              }
            );
            const name = requireNonEmptyString(args.name, 'name', 'Invalid name');
            const skeletonPath = requireNonEmptyString(args.skeletonPath, 'skeletonPath', 'Invalid skeletonPath');
            const res = await tools.animationTools.createAnimationBlueprint({ name, skeletonPath, savePath: args.savePath });
            return cleanObject(res);
          }
          case 'play_montage': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide playback details for animation_physics.play_montage',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor that should play the montage'
                },
                montagePath: {
                  type: 'string',
                  title: 'Montage Path',
                  description: 'Montage or animation asset path to play'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Invalid actorName');
            const montagePath = args.montagePath || args.animationPath;
            const validatedMontage = requireNonEmptyString(montagePath, 'montagePath', 'Invalid montagePath');
            const res = await tools.animationTools.playAnimation({ actorName, animationType: 'Montage', animationPath: validatedMontage, playRate: args.playRate });
            return cleanObject(res);
          }
          case 'setup_ragdoll': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide setup details for animation_physics.setup_ragdoll',
              {
                skeletonPath: {
                  type: 'string',
                  title: 'Skeleton Path',
                  description: 'Content path for the skeleton asset'
                },
                physicsAssetName: {
                  type: 'string',
                  title: 'Physics Asset Name',
                  description: 'Name of the physics asset to apply'
                }
              }
            );
            const skeletonPath = requireNonEmptyString(args.skeletonPath, 'skeletonPath', 'Invalid skeletonPath');
            const physicsAssetName = requireNonEmptyString(args.physicsAssetName, 'physicsAssetName', 'Invalid physicsAssetName');
            const res = await tools.physicsTools.setupRagdoll({ skeletonPath, physicsAssetName, blendWeight: args.blendWeight, savePath: args.savePath });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown animation/physics action: ${args.action}`);
        }

// 6. EFFECTS SYSTEM
      case 'create_effect':
        switch (requireAction(args)) {
          case 'particle': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the particle effect details for create_effect.particle',
              {
                effectType: {
                  type: 'string',
                  title: 'Effect Type',
                  description: 'Preset effect type to spawn (e.g., Fire, Smoke)'
                }
              }
            );
            const res = await tools.niagaraTools.createEffect({ effectType: args.effectType, name: args.name, location: args.location, scale: args.scale, customParameters: args.customParameters });
            return cleanObject(res);
          }
          case 'niagara': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the Niagara system path for create_effect.niagara',
              {
                systemPath: {
                  type: 'string',
                  title: 'Niagara System Path',
                  description: 'Asset path of the Niagara system to spawn'
                }
              }
            );
            const systemPath = requireNonEmptyString(args.systemPath, 'systemPath', 'Invalid systemPath');
            const verifyResult = await tools.bridge.executePythonWithResult(`
import unreal, json
path = r"${systemPath}"
exists = unreal.EditorAssetLibrary.does_asset_exist(path)
print('RESULT:' + json.dumps({'success': exists, 'exists': exists, 'path': path}))
`.trim());
            if (!verifyResult?.exists) {
              return cleanObject({ success: false, error: `Niagara system not found at ${systemPath}` });
            }
            const loc = Array.isArray(args.location)
              ? { x: args.location[0], y: args.location[1], z: args.location[2] }
              : args.location || { x: 0, y: 0, z: 0 };
            const res = await tools.niagaraTools.spawnEffect({
              systemPath,
              location: [loc.x ?? 0, loc.y ?? 0, loc.z ?? 0],
              rotation: Array.isArray(args.rotation) ? args.rotation : undefined,
              scale: args.scale
            });
            return cleanObject(res);
          }
          case 'debug_shape': {
            const shapeInput = args.shape ?? 'Sphere';
            const shape = String(shapeInput).trim().toLowerCase();
            const originalShapeLabel = String(shapeInput).trim() || 'shape';
            const loc = args.location || { x: 0, y: 0, z: 0 };
            const size = args.size || 100;
            const color = args.color || [255, 0, 0, 255];
            const duration = args.duration || 5;
            if (shape === 'line') {
              const end = args.end || { x: loc.x + size, y: loc.y, z: loc.z };
              return cleanObject(await tools.debugTools.drawDebugLine({ start: [loc.x, loc.y, loc.z], end: [end.x, end.y, end.z], color, duration }));
            } else if (shape === 'box') {
              const extent = [size, size, size];
              return cleanObject(await tools.debugTools.drawDebugBox({ center: [loc.x, loc.y, loc.z], extent, color, duration }));
            } else if (shape === 'sphere') {
              return cleanObject(await tools.debugTools.drawDebugSphere({ center: [loc.x, loc.y, loc.z], radius: size, color, duration }));
            } else if (shape === 'capsule') {
              return cleanObject(await tools.debugTools.drawDebugCapsule({ center: [loc.x, loc.y, loc.z], halfHeight: size, radius: Math.max(10, size/3), color, duration }));
            } else if (shape === 'cone') {
              return cleanObject(await tools.debugTools.drawDebugCone({ origin: [loc.x, loc.y, loc.z], direction: [0,0,1], length: size, angleWidth: 0.5, angleHeight: 0.5, color, duration }));
            } else if (shape === 'arrow') {
              const end = args.end || { x: loc.x + size, y: loc.y, z: loc.z };
              return cleanObject(await tools.debugTools.drawDebugArrow({ start: [loc.x, loc.y, loc.z], end: [end.x, end.y, end.z], color, duration }));
            } else if (shape === 'point') {
              return cleanObject(await tools.debugTools.drawDebugPoint({ location: [loc.x, loc.y, loc.z], size, color, duration }));
            } else if (shape === 'text' || shape === 'string') {
              const text = args.text || 'Debug';
              return cleanObject(await tools.debugTools.drawDebugString({ location: [loc.x, loc.y, loc.z], text, color, duration }));
            }
            // Default fallback
            return cleanObject({ success: false, error: `Unsupported debug shape: ${originalShapeLabel}` });
          }
          default:
            throw new Error(`Unknown effect action: ${args.action}`);
        }

// 7. BLUEPRINT MANAGER
      case 'manage_blueprint':
        switch (requireAction(args)) {
          case 'create': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_blueprint.create',
              {
                name: {
                  type: 'string',
                  title: 'Blueprint Name',
                  description: 'Name for the new Blueprint asset'
                },
                blueprintType: {
                  type: 'string',
                  title: 'Blueprint Type',
                  description: 'Base type such as Actor, Pawn, Character, etc.'
                }
              }
            );
            const res = await tools.blueprintTools.createBlueprint({
              name: args.name,
              blueprintType: args.blueprintType || 'Actor',
              savePath: args.savePath,
              parentClass: args.parentClass
            });
            return cleanObject(res);
          }
          case 'add_component': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_blueprint.add_component',
              {
                name: {
                  type: 'string',
                  title: 'Blueprint Name',
                  description: 'Blueprint asset to modify'
                },
                componentType: {
                  type: 'string',
                  title: 'Component Type',
                  description: 'Component class to add (e.g., StaticMeshComponent)'
                },
                componentName: {
                  type: 'string',
                  title: 'Component Name',
                  description: 'Name for the new component'
                }
              }
            );
            const res = await tools.blueprintTools.addComponent({ blueprintName: args.name, componentType: args.componentType, componentName: args.componentName });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown blueprint action: ${args.action}`);
        }

// 8. ENVIRONMENT BUILDER
      case 'build_environment':
        switch (requireAction(args)) {
          case 'create_landscape': {
            const res = await tools.landscapeTools.createLandscape({ name: args.name, sizeX: args.sizeX, sizeY: args.sizeY, materialPath: args.materialPath });
            return cleanObject(res);
          }
          case 'sculpt': {
            const res = await tools.landscapeTools.sculptLandscape({ landscapeName: args.name, tool: args.tool, brushSize: args.brushSize, strength: args.strength });
            return cleanObject(res);
          }
          case 'add_foliage': {
            const res = await tools.foliageTools.addFoliageType({ name: args.name, meshPath: args.meshPath, density: args.density });
            return cleanObject(res);
          }
          case 'paint_foliage': {
            const pos = args.position ? [args.position.x || 0, args.position.y || 0, args.position.z || 0] : [0,0,0];
            const res = await tools.foliageTools.paintFoliage({ foliageType: args.foliageType, position: pos, brushSize: args.brushSize, paintDensity: args.paintDensity, eraseMode: args.eraseMode });
            return cleanObject(res);
          }
          case 'create_procedural_terrain': {
            const loc = args.location ? [args.location.x||0, args.location.y||0, args.location.z||0] : [0,0,0];
            const res = await tools.buildEnvAdvanced.createProceduralTerrain({
              name: args.name || 'ProceduralTerrain',
              location: loc as [number,number,number],
              sizeX: args.sizeX,
              sizeY: args.sizeY,
              subdivisions: args.subdivisions,
              heightFunction: args.heightFunction,
              material: args.materialPath
            });
            return cleanObject(res);
          }
          case 'create_procedural_foliage': {
            if (!args.bounds || !args.bounds.location || !args.bounds.size) throw new Error('bounds.location and bounds.size are required');
            const bounds = {
              location: [args.bounds.location.x||0, args.bounds.location.y||0, args.bounds.location.z||0] as [number,number,number],
              size: [args.bounds.size.x||1000, args.bounds.size.y||1000, args.bounds.size.z||100] as [number,number,number]
            };
            const res = await tools.buildEnvAdvanced.createProceduralFoliage({
              name: args.name || 'ProceduralFoliage',
              bounds,
              foliageTypes: args.foliageTypes || [],
              seed: args.seed
            });
            return cleanObject(res);
          }
          case 'add_foliage_instances': {
            if (!args.foliageType) throw new Error('foliageType is required');
            if (!Array.isArray(args.transforms)) throw new Error('transforms array is required');
            const transforms = (args.transforms as any[]).map(t => ({
              location: [t.location?.x||0, t.location?.y||0, t.location?.z||0] as [number,number,number],
              rotation: t.rotation ? [t.rotation.pitch||0, t.rotation.yaw||0, t.rotation.roll||0] as [number,number,number] : undefined,
              scale: t.scale ? [t.scale.x||1, t.scale.y||1, t.scale.z||1] as [number,number,number] : undefined
            }));
            const res = await tools.buildEnvAdvanced.addFoliageInstances({ foliageType: args.foliageType, transforms });
            return cleanObject(res);
          }
          case 'create_landscape_grass_type': {
            const res = await tools.buildEnvAdvanced.createLandscapeGrassType({
              name: args.name || 'GrassType',
              meshPath: args.meshPath,
              density: args.density,
              minScale: args.minScale,
              maxScale: args.maxScale
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown environment action: ${args.action}`);
        }

      // 9. SYSTEM CONTROL
      case 'system_control':
        switch (requireAction(args)) {
          case 'read_log': {
            const filterCategoryRaw = args.filter_category;
            const filterCategory = Array.isArray(filterCategoryRaw)
              ? filterCategoryRaw
              : typeof filterCategoryRaw === 'string' && filterCategoryRaw.trim() !== ''
                ? filterCategoryRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
                : undefined;
            const res = await tools.logTools.readOutputLog({
              filterCategory,
              filterLevel: args.filter_level,
              lines: typeof args.lines === 'number' ? args.lines : undefined,
              logPath: typeof args.log_path === 'string' ? args.log_path : undefined,
              includePrefixes: Array.isArray(args.include_prefixes) ? args.include_prefixes : undefined,
              excludeCategories: Array.isArray(args.exclude_categories) ? args.exclude_categories : undefined
            });
            return cleanObject(res);
          }
          case 'profile': {
            const res = await tools.performanceTools.startProfiling({ type: args.profileType, duration: args.duration });
            return cleanObject(res);
          }
          case 'show_fps': {
            const res = await tools.performanceTools.showFPS({ enabled: !!args.enabled, verbose: !!args.verbose });
            return cleanObject(res);
          }
          case 'set_quality': {
            const res = await tools.performanceTools.setScalability({ category: args.category, level: args.level });
            return cleanObject(res);
          }
          case 'play_sound': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the audio asset for system_control.play_sound',
              {
                soundPath: {
                  type: 'string',
                  title: 'Sound Asset Path',
                  description: 'Asset path of the sound to play'
                }
              }
            );
            const soundPath = requireNonEmptyString(args.soundPath, 'soundPath', 'Missing required parameter: soundPath');
            if (args.location && typeof args.location === 'object') {
              const loc = [args.location.x || 0, args.location.y || 0, args.location.z || 0];
              const res = await tools.audioTools.playSoundAtLocation({ soundPath, location: loc as [number, number, number], volume: args.volume, pitch: args.pitch, startTime: args.startTime });
              return cleanObject(res);
            }
            const res = await tools.audioTools.playSound2D({ soundPath, volume: args.volume, pitch: args.pitch, startTime: args.startTime });
            return cleanObject(res);
          }
          case 'create_widget': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for system_control.create_widget',
              {
                widgetName: {
                  type: 'string',
                  title: 'Widget Name',
                  description: 'Name for the new UI widget asset'
                },
                widgetType: {
                  type: 'string',
                  title: 'Widget Type',
                  description: 'Widget type such as HUD, Menu, Overlay, etc.'
                }
              }
            );
            const widgetName = requireNonEmptyString(args.widgetName ?? args.name, 'widgetName', 'Missing required parameter: widgetName');
            const widgetType = requireNonEmptyString(args.widgetType, 'widgetType', 'Missing required parameter: widgetType');
            const res = await tools.uiTools.createWidget({ name: widgetName, type: widgetType as any, savePath: args.savePath });
            return cleanObject(res);
          }
          case 'show_widget': {
            const res = await tools.uiTools.setWidgetVisibility({ widgetName: args.widgetName, visible: args.visible !== false });
            return cleanObject(res);
          }
          case 'screenshot': {
            const res = await tools.visualTools.takeScreenshot({ resolution: args.resolution });
            return cleanObject(res);
          }
          case 'engine_start': {
            const res = await tools.engineTools.launchEditor({ editorExe: args.editorExe, projectPath: args.projectPath });
            return cleanObject(res);
          }
          case 'engine_quit': {
            const res = await tools.engineTools.quitEditor();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown system action: ${args.action}`);
        }

      // 10. CONSOLE COMMAND - handle validation here
case 'console_command':
        if (!args.command || typeof args.command !== 'string' || args.command.trim() === '') {
          return { success: true, message: 'Empty command' } as any;
        }
        // Basic safety filter
        const cmd = String(args.command).trim();
        const blocked = [/\bquit\b/i, /\bexit\b/i, /debugcrash/i];
        if (blocked.some(r => r.test(cmd))) {
          return { success: false, error: 'Command blocked for safety' } as any;
        }
        try {
          const raw = await tools.bridge.executeConsoleCommand(cmd);
          const summary = tools.bridge.summarizeConsoleCommand(cmd, raw);
          const output = summary.output || '';
          const looksInvalid = /unknown|invalid/i.test(output);
          return cleanObject({
            success: summary.returnValue !== false && !looksInvalid,
            command: summary.command,
            output: output || undefined,
            logLines: summary.logLines?.length ? summary.logLines : undefined,
            returnValue: summary.returnValue,
            message: !looksInvalid
              ? (output || 'Command executed')
              : undefined,
            error: looksInvalid ? output : undefined,
            raw: summary.raw
          });
        } catch (e: any) {
          return cleanObject({ success: false, command: cmd, error: e?.message || String(e) });
        }
        

      // 11. REMOTE CONTROL PRESETS - Direct implementation
      case 'manage_rc':
        // Handle RC operations directly through RcTools
        let rcResult: any;
        const rcAction = requireAction(args);
        switch (rcAction) {
          // Support both 'create_preset' and 'create' for compatibility
          case 'create_preset':
          case 'create':
            // Support both 'name' and 'presetName' parameter names
            const presetName = args.name || args.presetName;
            if (!presetName) throw new Error('Missing required parameter: name or presetName');
            rcResult = await tools.rcTools.createPreset({ 
              name: presetName, 
              path: args.path 
            });
            // Return consistent output with presetId for tests
            if (rcResult.success) {
              rcResult.message = `Remote Control preset created: ${presetName}`;
              // Ensure presetId is set (for test compatibility)
              if (rcResult.presetPath && !rcResult.presetId) {
                rcResult.presetId = rcResult.presetPath;
              }
            }
            break;
            
          case 'list':
            // List all presets - implement via RcTools
            rcResult = await tools.rcTools.listPresets();
            break;
            
          case 'delete':
          case 'delete_preset':
            const presetIdentifier = args.presetId || args.presetPath;
            if (!presetIdentifier) throw new Error('Missing required parameter: presetId');
            rcResult = await tools.rcTools.deletePreset(presetIdentifier);
            if (rcResult.success) {
              rcResult.message = 'Preset deleted successfully';
            }
            break;
            
          case 'expose_actor':
            if (!args.presetPath) throw new Error('Missing required parameter: presetPath');
            if (!args.actorName) throw new Error('Missing required parameter: actorName');
            
            rcResult = await tools.rcTools.exposeActor({ 
              presetPath: args.presetPath,
              actorName: args.actorName
            });
            if (rcResult.success) {
              rcResult.message = `Actor '${args.actorName}' exposed to preset`;
            }
            break;
            
          case 'expose_property':
          case 'expose':  // Support simplified name from tests
            // Support both presetPath and presetId
            const presetPathExp = args.presetPath || args.presetId;
            if (!presetPathExp) throw new Error('Missing required parameter: presetPath or presetId');
            if (!args.objectPath) throw new Error('Missing required parameter: objectPath');
            if (!args.propertyName) throw new Error('Missing required parameter: propertyName');
            
            rcResult = await tools.rcTools.exposeProperty({ 
              presetPath: presetPathExp,
              objectPath: args.objectPath, 
              propertyName: args.propertyName 
            });
            if (rcResult.success) {
              rcResult.message = `Property '${args.propertyName}' exposed to preset`;
            }
            break;
            
          case 'list_fields':
          case 'get_exposed':  // Support test naming
            const presetPathList = args.presetPath || args.presetId;
            if (!presetPathList) throw new Error('Missing required parameter: presetPath or presetId');
            
            rcResult = await tools.rcTools.listFields({ 
              presetPath: presetPathList 
            });
            // Map 'fields' to 'exposedProperties' for test compatibility
            if (rcResult.success && rcResult.fields) {
              rcResult.exposedProperties = rcResult.fields;
            }
            break;
            
          case 'set_property':
          case 'set_value':  // Support test naming
            // Support both patterns
            const objPathSet = args.objectPath || args.presetId;
            const propNameSet = args.propertyName || args.propertyLabel;
            
            if (!objPathSet) throw new Error('Missing required parameter: objectPath or presetId');
            if (!propNameSet) throw new Error('Missing required parameter: propertyName or propertyLabel');
            if (args.value === undefined) throw new Error('Missing required parameter: value');
            
            rcResult = await tools.rcTools.setProperty({ 
              objectPath: objPathSet,
              propertyName: propNameSet,
              value: args.value 
            });
            if (rcResult.success) {
              rcResult.message = `Property '${propNameSet}' value updated`;
            }
            break;
            
          case 'get_property':
          case 'get_value':  // Support test naming
            const objPathGet = args.objectPath || args.presetId;
            const propNameGet = args.propertyName || args.propertyLabel;
            
            if (!objPathGet) throw new Error('Missing required parameter: objectPath or presetId');
            if (!propNameGet) throw new Error('Missing required parameter: propertyName or propertyLabel');
            
            rcResult = await tools.rcTools.getProperty({ 
              objectPath: objPathGet,
              propertyName: propNameGet 
            });
            break;
            
          case 'call_function':
            if (!args.presetId) throw new Error('Missing required parameter: presetId');
            if (!args.functionLabel) throw new Error('Missing required parameter: functionLabel');
            
            // For now, return not implemented
            rcResult = { 
              success: false, 
              error: 'Function calls not yet implemented' 
            };
            break;
            
          default:
            throw new Error(`Unknown RC action: ${rcAction}. Valid actions are: create_preset, expose_actor, expose_property, list_fields, set_property, get_property, or their simplified versions: create, list, delete, expose, get_exposed, set_value, get_value, call_function`);
        }
        
        // Return result directly - MCP formatting will be handled by response validator
        // Clean to prevent circular references
        return cleanObject(rcResult);

      // 12. SEQUENCER / CINEMATICS
      case 'manage_sequence':
        // Direct handling for sequence operations
        const seqResult = await (async () => {
          const sequenceTools = tools.sequenceTools;
          if (!sequenceTools) throw new Error('Sequence tools not available');
          const action = requireAction(args);
          
          switch (action) {
            case 'create':
              return await sequenceTools.create({ name: args.name, path: args.path });
            case 'open':
              return await sequenceTools.open({ path: args.path });
            case 'add_camera':
              return await sequenceTools.addCamera({ spawnable: args.spawnable !== false });
            case 'add_actor':
              return await sequenceTools.addActor({ actorName: args.actorName });
            case 'add_actors':
              if (!args.actorNames) throw new Error('Missing required parameter: actorNames');
              return await sequenceTools.addActors({ actorNames: args.actorNames });
            case 'remove_actors':
              if (!args.actorNames) throw new Error('Missing required parameter: actorNames');
              return await sequenceTools.removeActors({ actorNames: args.actorNames });
            case 'get_bindings':
              return await sequenceTools.getBindings({ path: args.path });
            case 'add_spawnable_from_class':
              if (!args.className) throw new Error('Missing required parameter: className');
              return await sequenceTools.addSpawnableFromClass({ className: args.className, path: args.path });
            case 'play':
              return await sequenceTools.play({ loopMode: args.loopMode });
            case 'pause':
              return await sequenceTools.pause();
            case 'stop':
              return await sequenceTools.stop();
            case 'set_properties':
              return await sequenceTools.setSequenceProperties({
                path: args.path,
                frameRate: args.frameRate,
                lengthInFrames: args.lengthInFrames,
                playbackStart: args.playbackStart,
                playbackEnd: args.playbackEnd
              });
            case 'get_properties':
              return await sequenceTools.getSequenceProperties({ path: args.path });
            case 'set_playback_speed':
              if (args.speed === undefined) throw new Error('Missing required parameter: speed');
              return await sequenceTools.setPlaybackSpeed({ speed: args.speed });
            case 'add_transform_keyframe':
              if (!args.bindingName) throw new Error('Missing required parameter: bindingName');
              if (args.frame === undefined) throw new Error('Missing required parameter: frame');
              return await sequenceTools.addTransformKeyframe({
                bindingName: args.bindingName,
                frame: args.frame,
                location: args.location,
                rotation: args.rotation,
                scale: args.scale,
                interpolation: args.interpolation
              });
            case 'add_camera_cut_track':
              return await sequenceTools.addCameraCutTrack({ path: args.path });
            case 'add_camera_cut':
              if (!args.cameraBindingName) throw new Error('Missing required parameter: cameraBindingName');
              if (args.startFrame === undefined) throw new Error('Missing required parameter: startFrame');
              return await sequenceTools.addCameraCut({
                cameraBindingName: args.cameraBindingName,
                startFrame: args.startFrame,
                endFrame: args.endFrame
              });
            case 'get_tracks':
              if (!args.bindingName) throw new Error('Missing required parameter: bindingName');
              return await sequenceTools.getTracks({ bindingName: args.bindingName });
            // Phase 7.8: Property Tracks
            case 'add_property_track':
              if (!args.bindingName) throw new Error('Missing required parameter: bindingName');
              if (!args.propertyPath) throw new Error('Missing required parameter: propertyPath');
              return await sequenceTools.addPropertyTrack({
                bindingName: args.bindingName,
                propertyPath: args.propertyPath,
                propertyType: args.propertyType
              });
            case 'add_property_keyframe':
              if (!args.bindingName) throw new Error('Missing required parameter: bindingName');
              if (!args.propertyPath) throw new Error('Missing required parameter: propertyPath');
              if (args.frame === undefined) throw new Error('Missing required parameter: frame');
              if (args.value === undefined) throw new Error('Missing required parameter: value');
              return await sequenceTools.addPropertyKeyframe({
                bindingName: args.bindingName,
                propertyPath: args.propertyPath,
                frame: args.frame,
                value: args.value
              });
            // Phase 7.9: Audio Tracks
            case 'add_audio_track':
              if (!args.soundPath) throw new Error('Missing required parameter: soundPath');
              return await sequenceTools.addAudioTrack({
                soundPath: args.soundPath,
                startFrame: args.startFrame,
                rowIndex: args.rowIndex
              });
            // Phase 7.10: Event Tracks
            case 'add_event_track':
              if (!args.eventName) throw new Error('Missing required parameter: eventName');
              return await sequenceTools.addEventTrack({
                bindingName: args.bindingName,
                eventName: args.eventName
              });
            case 'add_event_key':
              if (!args.eventName) throw new Error('Missing required parameter: eventName');
              if (args.frame === undefined) throw new Error('Missing required parameter: frame');
              return await sequenceTools.addEventKey({
                eventName: args.eventName,
                frame: args.frame,
                functionName: args.functionName,
                bindingName: args.bindingName
              });
            default:
              throw new Error(`Unknown sequence action: ${action}`);
          }
        })();
        
        // Return result directly - MCP formatting will be handled by response validator
        // Clean to prevent circular references
        return cleanObject(seqResult);
      // 13. INTROSPECTION
case 'inspect':
  const inspectAction = requireAction(args);
  switch (inspectAction) {
          case 'inspect_object': {
            const res = await tools.introspectionTools.inspectObject({ objectPath: args.objectPath, detailed: args.detailed });
            return cleanObject(res);
          }
          case 'set_property': {
            const res = await tools.introspectionTools.setProperty({ objectPath: args.objectPath, propertyName: args.propertyName, value: args.value });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown inspect action: ${inspectAction}`);
        }

      // 14. QUERY LEVEL - Actor queries
      case 'query_level':
        switch (requireAction(args)) {
          case 'get_all': {
            const res = await tools.queryLevelTools.getAllActors({
              includeHidden: args.includeHidden,
              limit: args.limit,
              offset: args.offset
            });
            return cleanObject(res);
          }
          case 'get_selected': {
            const res = await tools.queryLevelTools.getSelectedActors();
            return cleanObject(res);
          }
          case 'get_by_class': {
            if (!args.className) throw new Error('Missing required parameter: className');
            const res = await tools.queryLevelTools.getActorsByClass(args.className, {
              includeHidden: args.includeHidden,
              limit: args.limit
            });
            return cleanObject(res);
          }
          case 'get_by_tag': {
            if (!args.tag) throw new Error('Missing required parameter: tag');
            const res = await tools.queryLevelTools.getActorsByTag(args.tag, {
              includeHidden: args.includeHidden,
              limit: args.limit
            });
            return cleanObject(res);
          }
          case 'get_by_name': {
            if (!args.namePattern) throw new Error('Missing required parameter: namePattern');
            const res = await tools.queryLevelTools.getActorsByName(args.namePattern, {
              includeHidden: args.includeHidden,
              limit: args.limit
            });
            return cleanObject(res);
          }
          case 'count': {
            const res = await tools.queryLevelTools.countActors();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown query_level action: ${args.action}`);
        }

      // 15. MANAGE SELECTION - Editor selection control
      case 'manage_selection':
        switch (requireAction(args)) {
          case 'select': {
            const res = await tools.manageSelectionTools.selectActors({
              actorNames: args.actorNames,
              actorPaths: args.actorPaths,
              additive: args.additive
            });
            return cleanObject(res);
          }
          case 'deselect': {
            const res = await tools.manageSelectionTools.deselectActors({
              actorNames: args.actorNames,
              actorPaths: args.actorPaths
            });
            return cleanObject(res);
          }
          case 'clear': {
            const res = await tools.manageSelectionTools.clearSelection();
            return cleanObject(res);
          }
          case 'select_all_of_class': {
            if (!args.className) throw new Error('Missing required parameter: className');
            const res = await tools.manageSelectionTools.selectAllOfClass(args.className, args.additive);
            return cleanObject(res);
          }
          case 'invert': {
            const res = await tools.manageSelectionTools.invertSelection();
            return cleanObject(res);
          }
          case 'get': {
            const res = await tools.manageSelectionTools.getSelection();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_selection action: ${args.action}`);
        }

      // 16. DEBUG TOOLS EXTENDED - Enhanced debugging
      case 'debug_extended':
        switch (requireAction(args)) {
          case 'get_log': {
            const res = await tools.debugToolsExtended.getLogs({
              lines: args.lines,
              category: args.category,
              severity: args.severity,
              search: args.search
            });
            return cleanObject(res);
          }
          case 'get_errors': {
            const res = await tools.debugToolsExtended.getErrors(args.lines);
            return cleanObject(res);
          }
          case 'get_warnings': {
            const res = await tools.debugToolsExtended.getWarnings(args.lines);
            return cleanObject(res);
          }
          case 'start_watch': {
            const res = await tools.debugToolsExtended.startErrorWatch(args.watchInterval);
            return cleanObject(res);
          }
          case 'stop_watch': {
            const res = tools.debugToolsExtended.stopErrorWatch();
            return cleanObject(res);
          }
          case 'get_watched_errors': {
            const res = tools.debugToolsExtended.getRecentWatchedErrors();
            return cleanObject(res);
          }
          case 'clear_errors': {
            const res = tools.debugToolsExtended.clearRecentErrors();
            return cleanObject(res);
          }
          case 'check_connection': {
            const res = await tools.debugToolsExtended.checkConnection();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown debug_extended action: ${args.action}`);
        }

      // 17. EDITOR LIFECYCLE - Save, reload, hot-reload
      case 'editor_lifecycle':
        switch (requireAction(args)) {
          case 'save_level': {
            const res = await tools.editorLifecycleTools.saveCurrentLevel();
            return cleanObject(res);
          }
          case 'save_all': {
            const res = await tools.editorLifecycleTools.saveAllDirtyAssets();
            return cleanObject(res);
          }
          case 'get_dirty': {
            const res = await tools.editorLifecycleTools.getDirtyAssets();
            return cleanObject(res);
          }
          case 'hot_reload': {
            const res = await tools.editorLifecycleTools.hotReloadBlueprints();
            return cleanObject(res);
          }
          case 'compile_blueprint': {
            if (!args.blueprintPath) throw new Error('Missing required parameter: blueprintPath');
            const res = await tools.editorLifecycleTools.compileBlueprint(args.blueprintPath);
            return cleanObject(res);
          }
          case 'restart_pie': {
            const res = await tools.editorLifecycleTools.restartPIE();
            return cleanObject(res);
          }
          case 'load_level': {
            if (!args.levelPath) throw new Error('Missing required parameter: levelPath');
            const res = await tools.editorLifecycleTools.loadLevel(args.levelPath, args.streaming);
            return cleanObject(res);
          }
          case 'create_level': {
            if (!args.levelName) throw new Error('Missing required parameter: levelName');
            const res = await tools.editorLifecycleTools.createNewLevel(args.levelName, args.templatePath);
            return cleanObject(res);
          }
          case 'get_state': {
            const res = await tools.editorLifecycleTools.getEditorState();
            return cleanObject(res);
          }
          case 'refresh_assets': {
            const res = await tools.editorLifecycleTools.refreshAssets();
            return cleanObject(res);
          }
          case 'force_gc': {
            const res = await tools.editorLifecycleTools.forceGarbageCollection();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown editor_lifecycle action: ${args.action}`);
        }

      // 18. PROJECT BUILD - Packaging and build operations
      case 'project_build':
        switch (requireAction(args)) {
          case 'validate': {
            const res = await tools.projectBuildTools.validateForPackaging();
            return cleanObject(res);
          }
          case 'cook': {
            const res = await tools.projectBuildTools.cookContent();
            return cleanObject(res);
          }
          case 'package': {
            const res = await tools.projectBuildTools.packageGame({
              configuration: args.configuration,
              outputDir: args.outputDir,
              compressed: args.compressed,
              forDistribution: args.forDistribution
            });
            return cleanObject(res);
          }
          case 'build_lighting': {
            const res = await tools.projectBuildTools.buildLighting(args.quality);
            return cleanObject(res);
          }
          case 'build_navigation': {
            const res = await tools.projectBuildTools.buildNavigation();
            return cleanObject(res);
          }
          case 'build_all': {
            const res = await tools.projectBuildTools.buildAll();
            return cleanObject(res);
          }
          case 'open_packaged': {
            const res = await tools.projectBuildTools.openPackagedFolder();
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown project_build action: ${args.action}`);
        }

      // 19. ENHANCED INPUT - Phase 7.5
      case 'manage_input':
        switch (requireAction(args)) {
          case 'create_action': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_input.create_action',
              {
                name: {
                  type: 'string',
                  title: 'Action Name',
                  description: 'Name for the Input Action asset'
                }
              }
            );
            const name = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
            const res = await tools.inputTools.createInputAction({
              name,
              savePath: args.savePath,
              valueType: args.valueType,
              triggers: args.triggers,
              consumeInput: args.consumeInput
            });
            return cleanObject(res);
          }
          case 'create_context': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_input.create_context',
              {
                name: {
                  type: 'string',
                  title: 'Context Name',
                  description: 'Name for the Input Mapping Context asset'
                }
              }
            );
            const name = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
            const res = await tools.inputTools.createInputMappingContext({
              name,
              savePath: args.savePath,
              priority: args.priority
            });
            return cleanObject(res);
          }
          case 'add_mapping': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_input.add_mapping',
              {
                contextPath: {
                  type: 'string',
                  title: 'Context Path',
                  description: 'Content path to the Input Mapping Context'
                },
                actionPath: {
                  type: 'string',
                  title: 'Action Path',
                  description: 'Content path to the Input Action'
                },
                key: {
                  type: 'string',
                  title: 'Key',
                  description: 'Key name (e.g., "W", "SpaceBar")'
                }
              }
            );
            const contextPath = requireNonEmptyString(args.contextPath, 'contextPath', 'Missing required parameter: contextPath');
            const actionPath = requireNonEmptyString(args.actionPath, 'actionPath', 'Missing required parameter: actionPath');
            const key = requireNonEmptyString(args.key, 'key', 'Missing required parameter: key');
            const res = await tools.inputTools.addMapping({
              contextPath,
              actionPath,
              key,
              modifiers: args.modifiers
            });
            return cleanObject(res);
          }
          case 'get_mappings': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the context path for manage_input.get_mappings',
              {
                contextPath: {
                  type: 'string',
                  title: 'Context Path',
                  description: 'Content path to the Input Mapping Context'
                }
              }
            );
            const contextPath = requireNonEmptyString(args.contextPath, 'contextPath', 'Missing required parameter: contextPath');
            const res = await tools.inputTools.getMappings({ contextPath });
            return cleanObject(res);
          }
          case 'remove_mapping': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_input.remove_mapping',
              {
                contextPath: {
                  type: 'string',
                  title: 'Context Path',
                  description: 'Content path to the Input Mapping Context'
                },
                key: {
                  type: 'string',
                  title: 'Key',
                  description: 'Key name to remove'
                }
              }
            );
            const contextPath = requireNonEmptyString(args.contextPath, 'contextPath', 'Missing required parameter: contextPath');
            const key = requireNonEmptyString(args.key, 'key', 'Missing required parameter: key');
            const res = await tools.inputTools.removeMapping({
              contextPath,
              key,
              actionPath: args.actionPath
            });
            return cleanObject(res);
          }
          case 'list_actions': {
            const res = await tools.inputTools.listInputActions({
              directory: args.directory
            });
            return cleanObject(res);
          }
          case 'list_contexts': {
            const res = await tools.inputTools.listInputMappingContexts({
              directory: args.directory
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_input action: ${args.action}`);
        }

      // 20. RENDERING SETTINGS (Phase 7.3)
      case 'manage_rendering':
        switch (requireAction(args)) {
          case 'set_nanite': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_rendering.set_nanite',
              {
                meshPath: {
                  type: 'string',
                  title: 'Mesh Path',
                  description: 'Content path to the static mesh'
                }
              }
            );
            const meshPath = requireNonEmptyString(args.meshPath, 'meshPath', 'Missing required parameter: meshPath');
            const enabled = args.enabled !== false; // Default true
            const res = await tools.renderingTools.setNaniteEnabled({ meshPath, enabled });
            return cleanObject(res);
          }
          case 'get_nanite': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the mesh path for manage_rendering.get_nanite',
              {
                meshPath: {
                  type: 'string',
                  title: 'Mesh Path',
                  description: 'Content path to the static mesh'
                }
              }
            );
            const meshPath = requireNonEmptyString(args.meshPath, 'meshPath', 'Missing required parameter: meshPath');
            const res = await tools.renderingTools.getNaniteStatus({ meshPath });
            return cleanObject(res);
          }
          case 'set_lumen': {
            const res = await tools.renderingTools.setLumenSettings({
              method: args.method,
              quality: args.quality,
              finalGatherQuality: args.finalGatherQuality,
              reflectionsEnabled: args.reflectionsEnabled,
              infiniteBounces: args.infiniteBounces
            });
            return cleanObject(res);
          }
          case 'get_lumen': {
            const res = await tools.renderingTools.getLumenSettings();
            return cleanObject(res);
          }
          case 'set_vsm': {
            const res = await tools.renderingTools.setVirtualShadowMaps({
              enabled: args.enabled,
              resolution: args.resolution,
              pagePoolSize: args.pagePoolSize
            });
            return cleanObject(res);
          }
          case 'set_anti_aliasing': {
            if (!args.aaMethod) throw new Error('Missing required parameter: aaMethod');
            const res = await tools.renderingTools.setAntiAliasing({
              method: args.aaMethod,
              quality: args.aaQuality
            });
            return cleanObject(res);
          }
          case 'set_screen_percentage': {
            if (args.percentage === undefined) throw new Error('Missing required parameter: percentage');
            const res = await tools.renderingTools.setScreenPercentage({
              percentage: args.percentage
            });
            return cleanObject(res);
          }
          case 'set_ray_tracing': {
            const res = await tools.renderingTools.setRayTracing({
              globalIllumination: args.globalIllumination,
              reflections: args.reflections,
              shadows: args.shadows,
              ambientOcclusion: args.ambientOcclusion,
              translucency: args.translucency
            });
            return cleanObject(res);
          }
          case 'get_info': {
            const res = await tools.renderingTools.getRenderingInfo();
            return cleanObject(res);
          }
          case 'set_post_process': {
            const res = await tools.renderingTools.setPostProcessSettings({
              actorName: args.actorName,
              autoExposure: args.autoExposure,
              exposureCompensation: args.exposureCompensation,
              bloomIntensity: args.bloomIntensity,
              vignetteIntensity: args.vignetteIntensity,
              motionBlurAmount: args.motionBlurAmount,
              ambientOcclusionIntensity: args.ambientOcclusionIntensity
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_rendering action: ${args.action}`);
        }

      // 21. MATERIAL MANAGEMENT (Phase 7.6)
      case 'manage_material':
        switch (requireAction(args)) {
          case 'create_instance': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_material.create_instance',
              {
                name: {
                  type: 'string',
                  title: 'Instance Name',
                  description: 'Name for the new Material Instance'
                },
                parentMaterial: {
                  type: 'string',
                  title: 'Parent Material',
                  description: 'Content path to the parent material'
                }
              }
            );
            const name = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
            const parentMaterial = requireNonEmptyString(args.parentMaterial, 'parentMaterial', 'Missing required parameter: parentMaterial');
            const res = await tools.materialTools.createMaterialInstance({
              name,
              parentMaterial,
              savePath: args.savePath,
              scalarParameters: args.scalarParameters,
              vectorParameters: args.vectorParameters,
              textureParameters: args.textureParameters
            });
            return cleanObject(res);
          }
          case 'set_scalar': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_material.set_scalar',
              {
                materialPath: {
                  type: 'string',
                  title: 'Material Instance Path',
                  description: 'Content path to the Material Instance'
                },
                parameterName: {
                  type: 'string',
                  title: 'Parameter Name',
                  description: 'Name of the scalar parameter'
                },
                scalarValue: {
                  type: 'number',
                  title: 'Value',
                  description: 'Float value to set'
                }
              }
            );
            const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
            const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
            if (args.scalarValue === undefined) throw new Error('Missing required parameter: scalarValue');
            const res = await tools.materialTools.setScalarParameter({
              materialPath,
              parameterName,
              value: args.scalarValue
            });
            return cleanObject(res);
          }
          case 'set_vector': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_material.set_vector',
              {
                materialPath: {
                  type: 'string',
                  title: 'Material Instance Path',
                  description: 'Content path to the Material Instance'
                },
                parameterName: {
                  type: 'string',
                  title: 'Parameter Name',
                  description: 'Name of the vector parameter'
                }
              }
            );
            const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
            const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
            if (!args.vectorValue || typeof args.vectorValue !== 'object') throw new Error('Missing required parameter: vectorValue');
            const res = await tools.materialTools.setVectorParameter({
              materialPath,
              parameterName,
              value: args.vectorValue
            });
            return cleanObject(res);
          }
          case 'set_texture': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_material.set_texture',
              {
                materialPath: {
                  type: 'string',
                  title: 'Material Instance Path',
                  description: 'Content path to the Material Instance'
                },
                parameterName: {
                  type: 'string',
                  title: 'Parameter Name',
                  description: 'Name of the texture parameter'
                },
                texturePath: {
                  type: 'string',
                  title: 'Texture Path',
                  description: 'Content path to the texture asset'
                }
              }
            );
            const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
            const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
            const texturePath = requireNonEmptyString(args.texturePath, 'texturePath', 'Missing required parameter: texturePath');
            const res = await tools.materialTools.setTextureParameter({
              materialPath,
              parameterName,
              texturePath
            });
            return cleanObject(res);
          }
          case 'get_parameters': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide the Material Instance path for manage_material.get_parameters',
              {
                materialPath: {
                  type: 'string',
                  title: 'Material Instance Path',
                  description: 'Content path to the Material Instance'
                }
              }
            );
            const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
            const res = await tools.materialTools.getParameters({ materialPath });
            return cleanObject(res);
          }
          case 'copy': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_material.copy',
              {
                sourcePath: {
                  type: 'string',
                  title: 'Source Path',
                  description: 'Content path to the source Material Instance'
                },
                name: {
                  type: 'string',
                  title: 'New Name',
                  description: 'Name for the copied Material Instance'
                }
              }
            );
            const sourcePath = requireNonEmptyString(args.sourcePath, 'sourcePath', 'Missing required parameter: sourcePath');
            const newName = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
            const res = await tools.materialTools.copyMaterialInstance({
              sourcePath,
              newName,
              savePath: args.savePath,
              overrideScalars: args.overrideScalars,
              overrideVectors: args.overrideVectors
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_material action: ${args.action}`);
        }

      // 22. C++ CLASS MANAGEMENT (Phase 6)
      case 'manage_cpp':
        switch (requireAction(args)) {
          case 'create_class': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_class',
              {
                className: {
                  type: 'string',
                  title: 'Class Name',
                  description: 'Name for the C++ class (without A/U prefix)'
                },
                classType: {
                  type: 'string',
                  title: 'Class Type',
                  description: 'Base class type (Actor, Character, Pawn, etc.)'
                }
              }
            );
            const className = requireNonEmptyString(args.className, 'className', 'Missing required parameter: className');
            const classType = requireNonEmptyString(args.classType, 'classType', 'Missing required parameter: classType');
            const res = await tools.cppTools.createClass({
              className,
              classType,
              moduleName: args.moduleName,
              properties: args.properties,
              functions: args.functions,
              interfaces: args.interfaces,
              includeReplication: args.includeReplication !== false // Default true for multiplayer
            });
            return cleanObject(res);
          }
          case 'add_property': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.add_property',
              {
                className: {
                  type: 'string',
                  title: 'Class Name',
                  description: 'C++ class to add property to'
                }
              }
            );
            const className = requireNonEmptyString(args.className, 'className', 'Missing required parameter: className');
            if (!args.property) throw new Error('Missing required parameter: property');
            const res = await tools.cppTools.addProperty({
              className,
              property: args.property
            });
            return cleanObject(res);
          }
          case 'add_function': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.add_function',
              {
                className: {
                  type: 'string',
                  title: 'Class Name',
                  description: 'C++ class to add function to'
                }
              }
            );
            const className = requireNonEmptyString(args.className, 'className', 'Missing required parameter: className');
            if (!args.function) throw new Error('Missing required parameter: function');
            const res = await tools.cppTools.addFunction({
              className,
              function: args.function
            });
            return cleanObject(res);
          }
          case 'list_templates': {
            const res = tools.cppTools.listTemplates();
            return cleanObject({ success: true, ...res });
          }
          case 'create_gas_playerstate': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_gas_playerstate',
              {
                className: {
                  type: 'string',
                  title: 'Class Name',
                  description: 'Name for the GAS PlayerState class'
                }
              }
            );
            const className = requireNonEmptyString(args.className, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createGASPlayerState({
              className,
              attributeSetClass: args.attributeSetClass,
              abilities: args.abilities
            });
            return cleanObject(res);
          }
          // GAS GameMode
          case 'create_gas_gamemode': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_gas_gamemode',
              {
                className: {
                  type: 'string',
                  title: 'Class Name',
                  description: 'Name for the GAS GameMode class'
                }
              }
            );
            const className = requireNonEmptyString(args.className, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createGASGameMode({
              className,
              defaultPawnClass: args.defaultPawnClass,
              playerControllerClass: args.playerControllerClass,
              playerStateClass: args.playerStateClass,
              gameStateClass: args.gameStateClass
            });
            return cleanObject(res);
          }
          // GameplayEffect
          case 'create_gameplay_effect': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_gameplay_effect',
              {
                className: {
                  type: 'string',
                  title: 'Effect Name',
                  description: 'Name for the GameplayEffect class'
                }
              }
            );
            const name = requireNonEmptyString(args.className || args.name, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createGameplayEffect({
              name,
              durationType: args.durationType,
              durationMagnitude: args.durationMagnitude,
              modifiers: args.modifiers,
              tags: args.tags
            });
            return cleanObject(res);
          }
          // Input Action Data Asset
          case 'create_input_action_data_asset': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_input_action_data_asset',
              {
                className: {
                  type: 'string',
                  title: 'Asset Name',
                  description: 'Name for the Input Action Data Asset class'
                }
              }
            );
            const name = requireNonEmptyString(args.className || args.name, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createInputActionDataAsset({
              name,
              actions: args.actions
            });
            return cleanObject(res);
          }
          // Widget Stack Manager
          case 'create_widget_stack_manager': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_widget_stack_manager',
              {
                className: {
                  type: 'string',
                  title: 'Manager Name',
                  description: 'Name for the Widget Stack Manager subsystem'
                }
              }
            );
            const name = requireNonEmptyString(args.className || args.name, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createWidgetStackManager({ name });
            return cleanObject(res);
          }
          // DataTable Struct
          case 'create_datatable_struct': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_datatable_struct',
              {
                className: {
                  type: 'string',
                  title: 'Struct Name',
                  description: 'Name for the DataTable row struct'
                }
              }
            );
            const name = requireNonEmptyString(args.className || args.name, 'className', 'Missing required parameter: className');
            if (!args.fields || !Array.isArray(args.fields)) {
              throw new Error('Missing required parameter: fields (array of field definitions)');
            }
            const res = await tools.cppTools.createDataTableStruct({
              name,
              fields: args.fields
            });
            return cleanObject(res);
          }
          // Primary Data Asset
          case 'create_primary_data_asset': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_primary_data_asset',
              {
                className: {
                  type: 'string',
                  title: 'Asset Name',
                  description: 'Name for the Primary Data Asset class'
                }
              }
            );
            const name = requireNonEmptyString(args.className || args.name, 'className', 'Missing required parameter: className');
            const res = await tools.cppTools.createPrimaryDataAsset({
              name,
              assetType: args.assetType,
              properties: args.properties
            });
            return cleanObject(res);
          }
          // Add Module Dependency
          case 'add_module_dependency': {
            if (!args.dependencies || !Array.isArray(args.dependencies) || args.dependencies.length === 0) {
              throw new Error('Missing required parameter: dependencies (array of module names)');
            }
            const res = await tools.cppTools.addModuleDependency({
              moduleName: args.moduleName,
              dependencies: args.dependencies,
              isPublic: args.isPublic
            });
            return cleanObject(res);
          }
          // Get Module Dependencies
          case 'get_module_dependencies': {
            const res = await tools.cppTools.getModuleDependencies({
              moduleName: args.moduleName
            });
            return cleanObject(res);
          }
          // Create Module
          case 'create_module': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.create_module',
              {
                moduleName: {
                  type: 'string',
                  title: 'Module Name',
                  description: 'Name for the new module'
                }
              }
            );
            const moduleName = requireNonEmptyString(args.moduleName, 'moduleName', 'Missing required parameter: moduleName');
            const res = await tools.cppTools.createModule({
              moduleName,
              moduleType: args.moduleType,
              loadingPhase: args.loadingPhase
            });
            return cleanObject(res);
          }
          // Get Project Info
          case 'get_project_info': {
            const res = await tools.cppTools.getProjectInfo();
            return cleanObject(res);
          }
          // Enable Plugin
          case 'enable_plugin': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide details for manage_cpp.enable_plugin',
              {
                pluginName: {
                  type: 'string',
                  title: 'Plugin Name',
                  description: 'Name of the plugin to enable/disable'
                }
              }
            );
            const pluginName = requireNonEmptyString(args.pluginName, 'pluginName', 'Missing required parameter: pluginName');
            const res = await tools.cppTools.enablePlugin({
              pluginName,
              enabled: args.enabled
            });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_cpp action: ${args.action}`);
        }

      // 23. COLLISION MANAGEMENT
      case 'manage_collision':
        switch (requireAction(args)) {
          case 'set_profile': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide actor and profile for manage_collision.set_profile',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor to set collision profile on'
                },
                profile: {
                  type: 'string',
                  title: 'Collision Profile',
                  description: 'Collision profile preset (e.g., BlockAll, OverlapAll, Pawn)'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Missing required parameter: actorName');
            const profile = requireNonEmptyString(args.profile, 'profile', 'Missing required parameter: profile');
            const res = await tools.collisionTools.setProfile({ actorName, profile });
            return cleanObject(res);
          }
          case 'set_response': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide actor, channel, and response for manage_collision.set_response',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor to configure collision response'
                },
                channel: {
                  type: 'string',
                  title: 'Collision Channel',
                  description: 'Channel to set response for (WorldStatic, Pawn, etc.)'
                },
                response: {
                  type: 'string',
                  title: 'Response Type',
                  description: 'Ignore, Overlap, or Block'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Missing required parameter: actorName');
            const channel = requireNonEmptyString(args.channel, 'channel', 'Missing required parameter: channel');
            const response = requireNonEmptyString(args.response, 'response', 'Missing required parameter: response');
            const res = await tools.collisionTools.setResponse({ actorName, channel, response: response as 'Ignore' | 'Overlap' | 'Block' });
            return cleanObject(res);
          }
          case 'set_enabled': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Provide actor and enabled state for manage_collision.set_enabled',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor to enable/disable collision'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Missing required parameter: actorName');
            const enabled = args.enabled !== false; // Default to true if not specified
            const res = await tools.collisionTools.setEnabled({ actorName, enabled, type: args.type });
            return cleanObject(res);
          }
          case 'get_settings': {
            await elicitMissingPrimitiveArgs(
              tools,
              args,
              'Which actor should manage_collision.get_settings query?',
              {
                actorName: {
                  type: 'string',
                  title: 'Actor Name',
                  description: 'Actor to get collision settings from'
                }
              }
            );
            const actorName = requireNonEmptyString(args.actorName, 'actorName', 'Missing required parameter: actorName');
            const res = await tools.collisionTools.getSettings({ actorName });
            return cleanObject(res);
          }
          default:
            throw new Error(`Unknown manage_collision action: ${args.action}`);
        }

      default:
        throw new Error(`Unknown consolidated tool: ${name}`);
    }

// All cases return (or throw) above; this is a type guard for exhaustiveness.

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.log(`[ConsolidatedToolHandler] Failed execution of ${name} after ${duration}ms: ${err?.message || String(err)}`);
    
    // Return consistent error structure matching regular tool handlers
    const errorMessage = err?.message || String(err);
    const isTimeout = errorMessage.includes('timeout');
    
    return {
      content: [{
        type: 'text',
        text: isTimeout 
          ? `Tool ${name} timed out. Please check Unreal Engine connection.`
          : `Failed to execute ${name}: ${errorMessage}`
      }],
      isError: true
    };
  }
}
