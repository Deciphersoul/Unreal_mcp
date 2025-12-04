import { UnrealBridge } from '../unreal-bridge.js';
import { ensureRotation, ensureVector3 } from '../utils/validation.js';
import { coerceString, coerceVector3, interpretStandardResult } from '../utils/result-helpers.js';
import { escapePythonString } from '../utils/python.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('ActorTools');


/** Shape name to engine asset path mapping */
const SHAPE_MAPPING: Record<string, string> = {
  cube: '/Engine/BasicShapes/Cube',
  sphere: '/Engine/BasicShapes/Sphere',
  cylinder: '/Engine/BasicShapes/Cylinder',
  cone: '/Engine/BasicShapes/Cone',
  plane: '/Engine/BasicShapes/Plane',
  torus: '/Engine/BasicShapes/Torus'
};

/** Common actor class name to full script path mapping */
const CLASS_MAP: Record<string, string> = {
  'PointLight': '/Script/Engine.PointLight',
  'DirectionalLight': '/Script/Engine.DirectionalLight',
  'SpotLight': '/Script/Engine.SpotLight',
  'RectLight': '/Script/Engine.RectLight',
  'SkyLight': '/Script/Engine.SkyLight',
  'StaticMeshActor': '/Script/Engine.StaticMeshActor',
  'PlayerStart': '/Script/Engine.PlayerStart',
  'Camera': '/Script/Engine.CameraActor',
  'CameraActor': '/Script/Engine.CameraActor',
  'Pawn': '/Script/Engine.DefaultPawn',
  'Character': '/Script/Engine.Character',
  'TriggerBox': '/Script/Engine.TriggerBox',
  'TriggerSphere': '/Script/Engine.TriggerSphere',
  'BlockingVolume': '/Script/Engine.BlockingVolume',
  'PostProcessVolume': '/Script/Engine.PostProcessVolume',
  'LightmassImportanceVolume': '/Script/Engine.LightmassImportanceVolume',
  'NavMeshBoundsVolume': '/Script/Engine.NavMeshBoundsVolume',
  'ExponentialHeightFog': '/Script/Engine.ExponentialHeightFog',
  'AtmosphericFog': '/Script/Engine.AtmosphericFog',
  'SphereReflectionCapture': '/Script/Engine.SphereReflectionCapture',
  'BoxReflectionCapture': '/Script/Engine.BoxReflectionCapture',
  'DecalActor': '/Script/Engine.DecalActor'
};

/** Spawn method types */
type SpawnMethod = 'mesh' | 'class';

export interface SpawnResult {
  success: boolean;
  message: string;
  actorName?: string;
  actorPath?: string;
  resolvedClass?: string;
  requestedClass?: string;
  location?: { x: number; y: number; z: number };
  rotation?: { pitch: number; yaw: number; roll: number };
  warnings?: string[];
  details?: string[];
  pythonFallbackUsed?: boolean;
  spawnMethod?: 'DirectRC' | 'Python';
}

export interface DeleteResult {
  success: boolean;
  message: string;
  deleted?: string;
  error?: string;
  pythonFallbackUsed?: boolean;
  deleteMethod?: 'DirectRC' | 'Python';
}

export interface TransformResult {
  success: boolean;
  message: string;
  actorName?: string;
  location?: { x: number; y: number; z: number };
  rotation?: { pitch: number; yaw: number; roll: number };
  scale?: { x: number; y: number; z: number };
  error?: string;
  method?: 'DirectRC' | 'Python';
}

export interface BatchSpawnResult {
  success: boolean;
  message: string;
  spawned: Array<{ name: string; location: { x: number; y: number; z: number } }>;
  count: number;
  errors?: string[];
}

export interface SetMaterialResult {
  success: boolean;
  message: string;
  actorName?: string;
  materialPath?: string;
  error?: string;
}

export class ActorTools {
  constructor(private bridge: UnrealBridge) {}

  /**
   * Determine whether to use mesh spawn (SpawnActorFromObject) or class spawn (SpawnActorFromClass)
   * @returns 'mesh' for asset paths, 'class' for class-based actors
   */
  private determineSpawnMethod(classPath: string): { method: SpawnMethod; resolvedPath: string } {
    const lowerName = classPath.toLowerCase();
    
    // Check if it's a shape name that maps to a mesh
    if (SHAPE_MAPPING[lowerName]) {
      return { method: 'mesh', resolvedPath: SHAPE_MAPPING[lowerName] };
    }
    
    // Check if it starts with /Engine/BasicShapes/ - mesh spawn
    if (classPath.startsWith('/Engine/BasicShapes/')) {
      return { method: 'mesh', resolvedPath: classPath };
    }
    
    // Check if it's a /Game/ path - could be Blueprint or StaticMesh asset
    if (classPath.startsWith('/Game/')) {
      return { method: 'mesh', resolvedPath: classPath };
    }
    
    // Check if it's in our class map - class spawn
    if (CLASS_MAP[classPath]) {
      return { method: 'class', resolvedPath: CLASS_MAP[classPath] };
    }
    
    // Check if it's already a /Script/ path - class spawn
    if (classPath.startsWith('/Script/')) {
      return { method: 'class', resolvedPath: classPath };
    }
    
    // Check if it starts with /Engine/ but not BasicShapes - assume mesh
    if (classPath.startsWith('/Engine/')) {
      return { method: 'mesh', resolvedPath: classPath };
    }
    
    // Default: assume it's a class name, resolve to /Script/Engine.ClassName
    return { method: 'class', resolvedPath: `/Script/Engine.${classPath}` };
  }

  private normalizeActorPath(actorPath: unknown): string | null {
    if (!actorPath || typeof actorPath !== 'string') {
      return null;
    }
    const trimmed = actorPath.trim();
    if (!trimmed || trimmed === 'None') {
      return null;
    }
    return trimmed;
  }

  private async findActorPath(actorName: string): Promise<string | null> {
    const trimmedName = actorName.trim();
    if (!trimmedName) {
      return null;
    }
    const subsystemPath = '/Script/UnrealEd.Default__EditorActorSubsystem';

    const tryFindByLabel = async (exactMatch: boolean): Promise<string | null> => {
      const response = await this.bridge.call({
        objectPath: subsystemPath,
        functionName: 'FindActorByLabel',
        parameters: {
          ActorLabel: trimmedName,
          ExactMatch: exactMatch
        }
      });
      return this.normalizeActorPath(response?.ReturnValue);
    };

    try {
      const exact = await tryFindByLabel(true);
      if (exact) {
        return exact;
      }
      const fuzzy = await tryFindByLabel(false);
      if (fuzzy) {
        return fuzzy;
      }
    } catch (error) {
      log.debug(`FindActorByLabel lookup failed for ${trimmedName}: ${error}`);
    }

    try {
      const pythonPath = await this.findActorPathViaPython(trimmedName);
      if (pythonPath) {
        return pythonPath;
      }
    } catch (pythonError) {
      log.debug(`Python actor lookup failed for ${trimmedName}: ${pythonError}`);
    }

    return null;
  }

  private async findActorPathViaPython(actorName: string): Promise<string | null> {
    if (!actorName) {
      return null;
    }
    const escapedName = escapePythonString(actorName);
    const pythonCmd = `
import unreal
import json

result = {
    "success": False,
    "path": "",
    "label": "",
    "message": "",
    "error": ""
}

target_label = "${escapedName}".strip()
if not target_label:
    result["error"] = "Actor name is empty"
else:
    try:
        subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        if subsystem:
            lower_target = target_label.lower()
            actors = subsystem.get_all_level_actors()
            for actor in actors:
                if not actor:
                    continue
                try:
                    label = (actor.get_actor_label() or "").strip()
                    name = actor.get_name() or ""
                    label_lower = label.lower()
                    name_lower = name.lower()
                    if label_lower == lower_target or name_lower == lower_target or label_lower.startswith(lower_target + "_"):
                        result["success"] = True
                        result["path"] = actor.get_path_name()
                        result["label"] = label or name
                        result["message"] = f"Actor '{result['label']}' matched via Python search"
                        break
                except Exception:
                    continue
            if not result["success"]:
                result["error"] = f"Actor not found: {target_label}"
        else:
            result["error"] = "EditorActorSubsystem not available"
    except Exception as search_error:
        result["error"] = str(search_error)

print('RESULT:' + json.dumps(result))
`.trim();

    const response = await this.bridge.executePython(pythonCmd);
    const interpreted = interpretStandardResult(response, {
      successMessage: `Actor path resolved for ${actorName}`,
      failureMessage: `Actor not found: ${actorName}`
    });

    if (interpreted.success) {
      return coerceString(interpreted.payload.path) ?? null;
    }

    return null;
  }

  /**
   * Spawn actor using Direct Remote Control API
   * Tries SpawnActorFromObject for meshes, SpawnActorFromClass for classes
   */
  private async spawnViaDirectRC(params: {

    classPath: string;
    location: { x: number; y: number; z: number };
    rotation: { pitch: number; yaw: number; roll: number };
    actorName?: string;
  }): Promise<SpawnResult> {
    const { method, resolvedPath } = this.determineSpawnMethod(params.classPath);
    
    const location = {
      X: params.location.x,
      Y: params.location.y,
      Z: params.location.z
    };
    
    const rotation = {
      Pitch: params.rotation.pitch,
      Yaw: params.rotation.yaw,
      Roll: params.rotation.roll
    };
    
    log.debug(`Attempting Direct RC spawn: method=${method}, path=${resolvedPath}`);
    
    try {
      let result: any;
      
      if (method === 'mesh') {
        // For mesh assets, use SpawnActorFromObject
        // Need to append .AssetName for the object reference
        let objectPath = resolvedPath;
        if (!objectPath.includes('.')) {
          // Extract asset name from path and append it
          const assetName = objectPath.split('/').pop();
          objectPath = `${resolvedPath}.${assetName}`;
        }
        
        result = await this.bridge.call({
          objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
          functionName: 'SpawnActorFromObject',
          parameters: {
            ObjectToUse: objectPath,
            Location: location,
            Rotation: rotation
          }
        });
      } else {
        // For class-based actors, use SpawnActorFromClass
        result = await this.bridge.call({
          objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
          functionName: 'SpawnActorFromClass',
          parameters: {
            ActorClass: resolvedPath,
            Location: location,
            Rotation: rotation
          }
        });
      }
      
      // Check if spawn succeeded - ReturnValue should be the actor path
      const actorPath = result?.ReturnValue;
      if (!actorPath || actorPath === 'None' || actorPath === '') {
        throw new Error(`Direct RC spawn returned empty result for ${resolvedPath}`);
      }
      
      // Extract actor name from path (last component)
      let actorName = actorPath.split('.').pop() || actorPath.split(':').pop() || 'SpawnedActor';
      
      // If a custom name was requested, try to rename the actor
      if (params.actorName) {
        try {
          await this.bridge.call({
            objectPath: actorPath,
            functionName: 'SetActorLabel',
            parameters: {
              NewActorLabel: params.actorName
            }
          });
          actorName = params.actorName;
        } catch (renameErr) {
          log.debug(`Could not rename actor to ${params.actorName}: ${renameErr}`);
          // Not fatal, continue with auto-generated name
        }
      }
      
      return {
        success: true,
        message: `Spawned ${actorName} at (${params.location.x}, ${params.location.y}, ${params.location.z})`,
        actorName,
        actorPath,
        resolvedClass: resolvedPath,
        requestedClass: params.classPath,
        location: params.location,
        rotation: params.rotation,
        spawnMethod: 'DirectRC'
      };
      
    } catch (error: any) {
      log.debug(`Direct RC spawn failed: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Delete actor using Direct Remote Control API
   */
  private async deleteViaDirectRC(actorName: string): Promise<DeleteResult> {
    log.debug(`Attempting Direct RC delete for actor: ${actorName}`);
    
    try {
      const targetActorPath = await this.findActorPath(actorName);
      if (!targetActorPath) {
        throw new Error(`Actor not found: ${actorName}`);
      }
      
      // Destroy the actor
      const destroyResult = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'DestroyActor',
        parameters: {
          ActorToDestroy: targetActorPath
        }
      });
      
      const success = destroyResult?.ReturnValue === true || destroyResult?.ReturnValue === 'true';
      
      if (!success) {
        throw new Error(`DestroyActor returned false for ${actorName}`);
      }
      
      return {
        success: true,
        message: `Deleted actor: ${actorName}`,
        deleted: actorName,
        deleteMethod: 'DirectRC'
      };
      
    } catch (error: any) {
      log.debug(`Direct RC delete failed: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Delete an actor by name
   * Tries Direct RC API first, falls back to Python if needed
   */
  async delete(actorName: string): Promise<DeleteResult> {
    if (!actorName || typeof actorName !== 'string' || actorName.trim().length === 0) {
      throw new Error(`Invalid actorName: ${actorName}`);
    }
    
    const trimmedName = actorName.trim();
    
    // Try Direct RC first
    try {
      const result = await this.deleteViaDirectRC(trimmedName);
      return result;
    } catch (directRcError: any) {
      log.debug(`Direct RC delete failed, falling back to Python: ${directRcError?.message}`);
      
      // Fall back to Python-based deletion
      try {
        const pythonResult = await this.deleteViaPython(trimmedName);
        return {
          ...pythonResult,
          pythonFallbackUsed: true,
          deleteMethod: 'Python'
        };
      } catch (pythonError: any) {
        throw new Error(`Failed to delete actor '${trimmedName}': Direct RC error: ${directRcError?.message}. Python fallback error: ${pythonError?.message}`);
      }
    }
  }

  /**
   * Delete actor using Python (fallback method)
   */
  private async deleteViaPython(actorName: string): Promise<DeleteResult> {
    const escapedName = escapePythonString(actorName);
    
    const pythonCmd = `
import unreal
import json

result = {"success": False, "deleted": "", "error": ""}

try:
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if subsys:
        actors = subsys.get_all_level_actors()
        found = False
        actor_name = "${escapedName}"
        actor_name_lower = actor_name.lower()

        for actor in actors:
            if not actor:
                continue
            try:
                label = (actor.get_actor_label() or "").strip()
                name = (actor.get_name() or "").strip()
                label_lower = label.lower()
                name_lower = name.lower()
                if label_lower == actor_name_lower or name_lower == actor_name_lower or label_lower.startswith(actor_name_lower + "_"):
                    success = subsys.destroy_actor(actor)
                    result["success"] = success
                    result["deleted"] = label or name or actor_name
                    found = True
                    break
            except Exception:
                continue

        if not found:
            result["error"] = f"Actor not found: {actor_name}"
    else:
        result["error"] = "EditorActorSubsystem not available"


except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    const response = await this.bridge.executePython(pythonCmd);
    const interpreted = interpretStandardResult(response, {
      successMessage: `Deleted actor ${actorName}`,
      failureMessage: `Failed to delete actor ${actorName}`
    });
    
    if (!interpreted.success) {
      throw new Error(interpreted.error || interpreted.message);
    }
    
    return {
      success: true,
      message: interpreted.message,
      deleted: coerceString(interpreted.payload.deleted) || actorName
    };
  }

  async spawn(params: { classPath: string; location?: { x: number; y: number; z: number }; rotation?: { pitch: number; yaw: number; roll: number }; actorName?: string; replaceExisting?: boolean }): Promise<SpawnResult> {
    if (!params.classPath || typeof params.classPath !== 'string' || params.classPath.trim().length === 0) {
      throw new Error(`Invalid classPath: ${params.classPath}`);
    }

    const className = params.classPath.trim();
    const requestedActorName = typeof params.actorName === 'string' ? params.actorName.trim() : undefined;
    if (params.actorName !== undefined && (!requestedActorName || requestedActorName.length === 0)) {
      throw new Error(`Invalid actorName: ${params.actorName}`);
    }
    const sanitizedActorName = requestedActorName?.replace(/[^A-Za-z0-9_-]/g, '_');
    const replaceExisting = params.replaceExisting === true;

    if (sanitizedActorName) {
      const existing = await this.findActorPath(sanitizedActorName);
      if (existing) {
        if (!replaceExisting) {
          throw new Error(`Actor '${sanitizedActorName}' already exists. Choose a unique name or delete the existing actor first.`);
        }
        await this.delete(sanitizedActorName);
      }
    }

    // Prepare location and rotation with defaults


    const [locX, locY, locZ] = ensureVector3(
      params.location ?? { x: 0, y: 0, z: 100 },
      'actor location'
    );
    const [rotPitch, rotYaw, rotRoll] = ensureRotation(
      params.rotation ?? { pitch: 0, yaw: 0, roll: 0 },
      'actor rotation'
    );
    
    const location = { x: locX, y: locY, z: locZ };
    const rotation = { pitch: rotPitch, yaw: rotYaw, roll: rotRoll };
    
    // Try Direct RC first
    try {
      const result = await this.spawnViaDirectRC({
        classPath: className,
        location,
        rotation,
        actorName: sanitizedActorName
      });
      return result;
    } catch (directRcError: any) {
      log.debug(`Direct RC spawn failed, falling back to Python: ${directRcError?.message}`);
      
      // Fall back to Python-based spawning
      try {
        const pythonResult = await this.spawnViaPython({
          classPath: className,
          location,
          rotation,
          actorName: sanitizedActorName
        });
        
        return {
          ...pythonResult,
          pythonFallbackUsed: true,
          spawnMethod: 'Python',
          warnings: [
            ...(pythonResult.warnings || []),
            `Direct RC spawn failed (${directRcError?.message}), used Python fallback`
          ]
        };
      } catch (pythonError: any) {
        throw new Error(`Failed to spawn actor: Direct RC error: ${directRcError?.message}. Python fallback error: ${pythonError?.message}`);
      }
    }
  }

  /**
   * Spawn actor using Python (fallback method - existing logic)
   */
  private async spawnViaPython(params: {
    classPath: string;
    location: { x: number; y: number; z: number };
    rotation: { pitch: number; yaw: number; roll: number };
    actorName?: string;
  }): Promise<SpawnResult> {
    const { classPath: className, location, rotation, actorName: sanitizedActorName } = params;
    const lowerName = className.toLowerCase();
    
    const mappedClassPath = SHAPE_MAPPING[lowerName] ?? this.resolveActorClass(className);

    // Use the already-validated location and rotation from params
    const locX = location.x;
    const locY = location.y;
    const locZ = location.z;
    const rotPitch = rotation.pitch;
    const rotYaw = rotation.yaw;
    const rotRoll = rotation.roll;

    const escapedResolvedClassPath = escapePythonString(mappedClassPath);
  const escapedRequestedPath = escapePythonString(className);
  const escapedRequestedActorName = sanitizedActorName ? escapePythonString(sanitizedActorName) : '';

    const pythonCmd = `
import unreal
import json
import time

result = {
  "success": False,
  "message": "",
  "error": "",
  "actorName": "",
  "requestedClass": "${escapedRequestedPath}",
  "resolvedClass": "${escapedResolvedClassPath}",
  "location": [${locX}, ${locY}, ${locZ}],
  "rotation": [${rotPitch}, ${rotYaw}, ${rotRoll}],
  "requestedActorName": "${escapedRequestedActorName}",
  "warnings": [],
  "details": []
}

${this.getPythonSpawnHelper()}

abstract_classes = ['PlaneReflectionCapture', 'ReflectionCapture', 'Actor', 'Pawn', 'Character']

def finalize():
  data = dict(result)
  if data.get("success"):
    if not data.get("message"):
      data["message"] = "Actor spawned successfully"
    data.pop("error", None)
  else:
    if not data.get("error"):
      data["error"] = data.get("message") or "Failed to spawn actor"
    if not data.get("message"):
      data["message"] = data["error"]
  if not data.get("warnings"):
    data.pop("warnings", None)
  if not data.get("details"):
    data.pop("details", None)
  return data

try:
  les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
  if les and les.is_in_play_in_editor():
    result["message"] = "Cannot spawn actors while in Play In Editor mode. Please stop PIE first."
    result["error"] = result["message"]
    result["details"].append("Play In Editor mode detected")
    print('RESULT:' + json.dumps(finalize()))
    raise SystemExit(0)
except SystemExit:
  raise
except Exception:
  result["warnings"].append("Unable to determine Play In Editor state")

if result["requestedClass"] in abstract_classes:
  result["message"] = f"Cannot spawn {result['requestedClass']}: class is abstract and cannot be instantiated"
  result["error"] = result["message"]
else:
  try:
    class_path = result["resolvedClass"]
    requested_path = result["requestedClass"]
    location = unreal.Vector(${locX}, ${locY}, ${locZ})
    rotation = unreal.Rotator(${rotPitch}, ${rotYaw}, ${rotRoll})
    actor = None

    simple_name = requested_path.split('/')[-1] if '/' in requested_path else requested_path
    if '.' in simple_name:
      simple_name = simple_name.split('.')[-1]
    simple_name_lower = simple_name.lower()
    class_lookup_name = class_path.split('.')[-1] if '.' in class_path else simple_name

    result["details"].append(f"Attempting spawn using class path: {class_path}")

    if class_path.startswith('/Game') or class_path.startswith('/Engine'):
      try:
        asset = unreal.EditorAssetLibrary.load_asset(class_path)
      except Exception as asset_error:
        asset = None
        result["warnings"].append(f"Failed to load asset for {class_path}: {asset_error}")
      if asset:
        if isinstance(asset, unreal.Blueprint):
          try:
            actor_class = asset.generated_class()
          except Exception as blueprint_error:
            actor_class = None
            result["warnings"].append(f"Failed to resolve blueprint class: {blueprint_error}")
          if actor_class:
            actor = spawn_actor_from_class(actor_class, location, rotation)
            if actor:
              result["details"].append("Spawned using Blueprint generated class")
        elif isinstance(asset, unreal.StaticMesh):
          actor = spawn_actor_from_class(unreal.StaticMeshActor, location, rotation)
          if actor:
            mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if mesh_component:
              mesh_component.set_static_mesh(asset)
              mesh_component.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
              result["details"].append("Applied static mesh to spawned StaticMeshActor")

    if not actor:
      shape_map = {
        'cube': '/Engine/BasicShapes/Cube',
        'sphere': '/Engine/BasicShapes/Sphere',
        'cylinder': '/Engine/BasicShapes/Cylinder',
        'cone': '/Engine/BasicShapes/Cone',
        'plane': '/Engine/BasicShapes/Plane',
        'torus': '/Engine/BasicShapes/Torus'
      }
      mesh_path = shape_map.get(simple_name_lower)
      if not mesh_path and class_path.startswith('/Engine/BasicShapes'):
        mesh_path = class_path
      if mesh_path:
        try:
          shape_mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
        except Exception as shape_error:
          shape_mesh = None
          result["warnings"].append(f"Failed to load shape mesh {mesh_path}: {shape_error}")
        if shape_mesh:
          actor = spawn_actor_from_class(unreal.StaticMeshActor, location, rotation)
          if actor:
            mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if mesh_component:
              mesh_component.set_static_mesh(shape_mesh)
              mesh_component.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
              result["details"].append(f"Spawned StaticMeshActor with mesh {mesh_path}")

    if not actor:
      if class_lookup_name == "StaticMeshActor":
        actor = spawn_actor_from_class(unreal.StaticMeshActor, location, rotation)
        if actor:
          try:
            cube_mesh = unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube')
          except Exception as cube_error:
            cube_mesh = None
            result["warnings"].append(f"Failed to load default cube mesh: {cube_error}")
          if cube_mesh:
            mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if mesh_component:
              mesh_component.set_static_mesh(cube_mesh)
              mesh_component.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
              result["details"].append("Applied default cube mesh to StaticMeshActor")
      elif class_lookup_name == "CameraActor":
        actor = spawn_actor_from_class(unreal.CameraActor, location, rotation)
        if actor:
          result["details"].append("Spawned CameraActor via reflected class lookup")
      else:
        actor_class = getattr(unreal, class_lookup_name, None)
        if actor_class:
          actor = spawn_actor_from_class(actor_class, location, rotation)
          if actor:
            result["details"].append(f"Spawned {class_lookup_name} via reflected class lookup")

    if actor:
      desired_name = (result.get("requestedActorName") or "").strip()
      actor_name = ""
      if desired_name:
        try:
          try:
            actor.set_actor_label(desired_name, True)
          except TypeError:
            actor.set_actor_label(desired_name)
          actor_name = actor.get_actor_label() or desired_name
        except Exception as label_error:
          result["warnings"].append(f"Failed to honor requested actor name '{desired_name}': {label_error}")
      if not actor_name:
        timestamp = int(time.time() * 1000) % 10000
        base_name = simple_name or class_lookup_name or class_path.split('/')[-1]
        fallback_name = f"{base_name}_{timestamp}"
        try:
          actor.set_actor_label(fallback_name)
        except Exception as label_error:
          result["warnings"].append(f"Failed to set actor label: {label_error}")
        actor_name = actor.get_actor_label() or fallback_name
      result["success"] = True
      result["actorName"] = actor_name
      if not result["message"]:
        result["message"] = f"Spawned {actor_name} at ({location.x}, {location.y}, {location.z})"
    else:
      result["message"] = f"Failed to spawn actor from: {class_path}. Try using /Engine/BasicShapes/Cube or StaticMeshActor"
      result["error"] = result["message"]
  except Exception as spawn_error:
    result["error"] = f"Error spawning actor: {spawn_error}"
    if not result["message"]:
      result["message"] = result["error"]

print('RESULT:' + json.dumps(finalize()))
`.trim();

    try {
      const response = await this.bridge.executePython(pythonCmd);
      const interpreted = interpretStandardResult(response, {
        successMessage: `Spawned actor ${className}`,
        failureMessage: `Failed to spawn actor ${className}`
      });

      if (!interpreted.success) {
        throw new Error(interpreted.error || interpreted.message);
      }

      const actorName = coerceString(interpreted.payload.actorName);
      const resolvedClass = coerceString(interpreted.payload.resolvedClass) ?? mappedClassPath;
      const requestedClass = coerceString(interpreted.payload.requestedClass) ?? className;
      const locationVector = coerceVector3(interpreted.payload.location) ?? [locX, locY, locZ];
      const rotationVector = coerceVector3(interpreted.payload.rotation) ?? [rotPitch, rotYaw, rotRoll];

      const result: SpawnResult = {
        success: true,
        message: interpreted.message,
        actorName: actorName ?? undefined,
        resolvedClass,
        requestedClass,
        location: { x: locationVector[0], y: locationVector[1], z: locationVector[2] },
        rotation: { pitch: rotationVector[0], yaw: rotationVector[1], roll: rotationVector[2] }
      };

      if (interpreted.warnings?.length) {
        result.warnings = interpreted.warnings;
      }
      if (interpreted.details?.length) {
        result.details = interpreted.details;
      }

      return result;
    } catch (err) {
      throw new Error(`Failed to spawn actor via Python: ${err}`);
    }
  }
  
  async spawnViaConsole(params: { classPath: string; location?: { x: number; y: number; z: number }; rotation?: { pitch: number; yaw: number; roll: number } }) {
    try {
      const [locX, locY, locZ] = ensureVector3(params.location ?? { x: 0, y: 0, z: 100 }, 'actor location');
      // Check if editor is in play mode first
      try {
        const pieCheckPython = `
import unreal
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if les and les.is_in_play_in_editor():
    print("PIE_ACTIVE")
else:
    print("PIE_INACTIVE")
        `.trim();
        
        const pieCheckResult = await this.bridge.executePython(pieCheckPython);
        const outputStr = typeof pieCheckResult === 'string' ? pieCheckResult : JSON.stringify(pieCheckResult);
        
        if (outputStr.includes('PIE_ACTIVE')) {
          throw new Error('Cannot spawn actors while in Play In Editor mode. Please stop PIE first.');
        }
      } catch (pieErr: any) {
        // If the error is about PIE, throw it
        if (String(pieErr).includes('Play In Editor')) {
          throw pieErr;
        }
        // Otherwise ignore and continue
      }
      
      // List of known abstract classes that cannot be spawned
      const abstractClasses = ['PlaneReflectionCapture', 'ReflectionCapture', 'Actor'];
      
      // Check if this is an abstract class
      if (abstractClasses.includes(params.classPath)) {
        throw new Error(`Cannot spawn ${params.classPath}: class is abstract and cannot be instantiated`);
      }
      
      // Get the console-friendly class name
      const spawnClass = this.getConsoleClassName(params.classPath);
      
      // Use summon command with location if provided
  const command = `summon ${spawnClass} ${locX} ${locY} ${locZ}`;
      
      await this.bridge.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/Engine.Default__KismetSystemLibrary',
        functionName: 'ExecuteConsoleCommand',
        parameters: {
          WorldContextObject: null,
          Command: command,
          SpecificPlayer: null
        },
        generateTransaction: false
      });
      
      // Console commands don't reliably report success/failure
      // We can't guarantee this actually worked, so indicate uncertainty
      return { 
        success: true, 
        message: `Actor spawn attempted via console: ${spawnClass} at ${locX},${locY},${locZ}`,
        note: 'Console spawn result uncertain - verify in editor'
      };
    } catch (err) {
      throw new Error(`Failed to spawn actor: ${err}`);
    }
  }
  private getPythonSpawnHelper(): string {
  return `
def spawn_actor_from_class(actor_class, location, rotation):
  actor = None
  try:
    actor_subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if actor_subsys:
      actor = actor_subsys.spawn_actor_from_class(actor_class, location, rotation)
  except Exception:
    actor = None
  if not actor:
    raise RuntimeError('EditorActorSubsystem unavailable or failed to spawn actor. Enable Editor Scripting Utilities plugin and verify class path.')
  return actor
`.trim();
  }

  private resolveActorClass(classPath: string): string {
    // Check if it's a simple name that needs mapping
    if (CLASS_MAP[classPath]) {
      return CLASS_MAP[classPath];
    }
    
    // Check if it already looks like a full path
    if (classPath.startsWith('/Script/') || classPath.startsWith('/Game/')) {
      return classPath;
    }

    if (classPath.startsWith('/Engine/')) {
      return classPath;
    }
    
    // Check for Blueprint paths
    if (classPath.includes('Blueprint') || classPath.includes('BP_')) {
      // Ensure it has the proper prefix
      if (!classPath.startsWith('/Game/')) {
        return '/Game/' + classPath;
      }
      return classPath;
    }
    
    // Default: assume it's an engine class
    return '/Script/Engine.' + classPath;
  }
  
  private getConsoleClassName(classPath: string): string {
    // Normalize class path for console 'summon'
    const input = classPath;

    // Engine classes: reduce '/Script/Engine.ClassName' to 'ClassName'
    if (input.startsWith('/Script/Engine.')) {
      return input.replace('/Script/Engine.', '');
    }

    // If it's already a simple class name (no path) and not a /Game asset, strip optional _C and return
    if (!input.startsWith('/Game/') && !input.includes('/')) {
      if (input.endsWith('_C')) return input.slice(0, -2);
      return input;
    }

    // Blueprint assets under /Game: ensure '/Game/Path/Asset.Asset_C'
    if (input.startsWith('/Game/')) {
      // Remove any existing ".Something" suffix to rebuild normalized class ref
      const pathWithoutSuffix = input.split('.')[0];
      const parts = pathWithoutSuffix.split('/');
      const assetName = parts[parts.length - 1].replace(/_C$/, '');
      const normalized = `${pathWithoutSuffix}.${assetName}_C`;
      return normalized;
    }

    // Fallback: return input unchanged
    return input;
  }

  /**
   * Transform an existing actor (move/rotate/scale)
   */
  async transform(params: {
    actorName: string;
    location?: { x: number; y: number; z: number };
    rotation?: { pitch: number; yaw: number; roll: number };
    scale?: { x: number; y: number; z: number };
  }): Promise<TransformResult> {
    if (!params.actorName?.trim()) {
      throw new Error('actorName is required for transform');
    }

    const escapedName = escapePythonString(params.actorName.trim());
    const hasLocation = params.location !== undefined;
    const hasRotation = params.rotation !== undefined;
    const hasScale = params.scale !== undefined;

    if (!hasLocation && !hasRotation && !hasScale) {
      throw new Error('At least one of location, rotation, or scale must be provided');
    }

    const pythonCmd = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}
actor_name = "${escapedName}"

try:
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        result["error"] = "EditorActorSubsystem not available"
    else:
        actors = subsys.get_all_level_actors()
        target = None
        actor_name_lower = actor_name.lower()
        
        for actor in actors:
            if not actor:
                continue
            try:
                label = actor.get_actor_label()
                name = actor.get_name()
                if label.lower() == actor_name_lower or name.lower() == actor_name_lower or label.lower().startswith(actor_name_lower + "_"):
                    target = actor
                    break
            except:
                continue
        
        if not target:
            result["error"] = f"Actor not found: {actor_name}"
        else:
            ${hasLocation ? `
            new_loc = unreal.Vector(${params.location!.x}, ${params.location!.y}, ${params.location!.z})
            target.set_actor_location(new_loc, False, False)
            result["location"] = [${params.location!.x}, ${params.location!.y}, ${params.location!.z}]
            ` : ''}
            
            ${hasRotation ? `
            new_rot = unreal.Rotator(${params.rotation!.pitch}, ${params.rotation!.yaw}, ${params.rotation!.roll})
            target.set_actor_rotation(new_rot, False)
            result["rotation"] = [${params.rotation!.pitch}, ${params.rotation!.yaw}, ${params.rotation!.roll}]
            ` : ''}
            
            ${hasScale ? `
            new_scale = unreal.Vector(${params.scale!.x}, ${params.scale!.y}, ${params.scale!.z})
            target.set_actor_scale3d(new_scale)
            result["scale"] = [${params.scale!.x}, ${params.scale!.y}, ${params.scale!.z}]
            ` : ''}
            
            result["success"] = True
            result["actorName"] = target.get_actor_label()
            result["message"] = f"Transformed {target.get_actor_label()}"
            
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    const response = await this.bridge.executePython(pythonCmd);
    const interpreted = interpretStandardResult(response, {
      successMessage: `Transformed actor ${params.actorName}`,
      failureMessage: `Failed to transform actor ${params.actorName}`
    });

    if (!interpreted.success) {
      throw new Error(interpreted.error || interpreted.message);
    }

    const payload = interpreted.payload as any;
    return {
      success: true,
      message: interpreted.message,
      actorName: coerceString(payload.actorName) || params.actorName,
      location: Array.isArray(payload.location) ? { x: payload.location[0], y: payload.location[1], z: payload.location[2] } : undefined,
      rotation: Array.isArray(payload.rotation) ? { pitch: payload.rotation[0], yaw: payload.rotation[1], roll: payload.rotation[2] } : undefined,
      scale: Array.isArray(payload.scale) ? { x: payload.scale[0], y: payload.scale[1], z: payload.scale[2] } : undefined,
      method: 'Python'
    };
  }

  /**
   * Spawn multiple actors in a batch (grid, line, or custom positions)
   */
  async batchSpawn(params: {
    classPath: string;
    count?: number;
    positions?: Array<{ x: number; y: number; z: number }>;
    gridSize?: { rows: number; cols: number };
    spacing?: number;
    startLocation?: { x: number; y: number; z: number };
    namePrefix?: string;
  }): Promise<BatchSpawnResult> {
    const classPath = params.classPath?.trim();
    if (!classPath) {
      throw new Error('classPath is required for batch spawn');
    }

    const positions: Array<{ x: number; y: number; z: number }> = [];
    const startLoc = params.startLocation || { x: 0, y: 0, z: 100 };
    const spacing = params.spacing || 200;

    // Generate positions based on params
    if (params.positions && params.positions.length > 0) {
      positions.push(...params.positions);
    } else if (params.gridSize) {
      // Grid layout
      for (let row = 0; row < params.gridSize.rows; row++) {
        for (let col = 0; col < params.gridSize.cols; col++) {
          positions.push({
            x: startLoc.x + col * spacing,
            y: startLoc.y + row * spacing,
            z: startLoc.z
          });
        }
      }
    } else if (params.count && params.count > 0) {
      // Line layout
      for (let i = 0; i < params.count; i++) {
        positions.push({
          x: startLoc.x + i * spacing,
          y: startLoc.y,
          z: startLoc.z
        });
      }
    } else {
      throw new Error('Provide positions, gridSize, or count for batch spawn');
    }

    const spawned: Array<{ name: string; location: { x: number; y: number; z: number } }> = [];
    const errors: string[] = [];
    const namePrefix = params.namePrefix || classPath.split('/').pop()?.replace('.', '_') || 'Actor';

    for (let i = 0; i < positions.length; i++) {
      try {
        const result = await this.spawn({
          classPath,
          location: positions[i],
          actorName: `${namePrefix}_${i}`
        });
        if (result.success) {
          spawned.push({
            name: result.actorName || `${namePrefix}_${i}`,
            location: positions[i]
          });
        } else {
          errors.push(`Position ${i}: ${result.message}`);
        }
      } catch (err: any) {
        errors.push(`Position ${i}: ${err.message || err}`);
      }
    }

    return {
      success: spawned.length > 0,
      message: `Spawned ${spawned.length}/${positions.length} actors`,
      spawned,
      count: spawned.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Set material on an actor's mesh component
   */
  async setMaterial(params: {
    actorName: string;
    materialPath: string;
    slotIndex?: number;
  }): Promise<SetMaterialResult> {
    if (!params.actorName?.trim()) {
      throw new Error('actorName is required');
    }
    if (!params.materialPath?.trim()) {
      throw new Error('materialPath is required');
    }

    const escapedActorName = escapePythonString(params.actorName.trim());
    const escapedMaterialPath = escapePythonString(params.materialPath.trim());
    const slotIndex = params.slotIndex ?? 0;

    const pythonCmd = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}
actor_name = "${escapedActorName}"
material_path = "${escapedMaterialPath}"

try:
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        result["error"] = "EditorActorSubsystem not available"
    else:
        # Find the actor
        actors = subsys.get_all_level_actors()
        target = None
        actor_name_lower = actor_name.lower()
        
        for actor in actors:
            if not actor:
                continue
            try:
                label = actor.get_actor_label()
                name = actor.get_name()
                if label.lower() == actor_name_lower or name.lower() == actor_name_lower:
                    target = actor
                    break
            except:
                continue
        
        if not target:
            result["error"] = f"Actor not found: {actor_name}"
        else:
            # Load the material
            material = unreal.EditorAssetLibrary.load_asset(material_path)
            if not material:
                result["error"] = f"Material not found: {material_path}"
            else:
                # Find mesh component
                mesh_comp = target.get_component_by_class(unreal.StaticMeshComponent)
                if not mesh_comp:
                    mesh_comp = target.get_component_by_class(unreal.SkeletalMeshComponent)
                
                if not mesh_comp:
                    result["error"] = "Actor has no mesh component"
                else:
                    mesh_comp.set_material(${slotIndex}, material)
                    result["success"] = True
                    result["actorName"] = target.get_actor_label()
                    result["materialPath"] = material_path
                    result["message"] = f"Applied material to {target.get_actor_label()}"
                    
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    const response = await this.bridge.executePython(pythonCmd);
    const interpreted = interpretStandardResult(response, {
      successMessage: `Applied material to ${params.actorName}`,
      failureMessage: `Failed to apply material to ${params.actorName}`
    });

    if (!interpreted.success) {
      throw new Error(interpreted.error || interpreted.message);
    }

    return {
      success: true,
      message: interpreted.message,
      actorName: coerceString(interpreted.payload.actorName) || params.actorName,
      materialPath: params.materialPath
    };
  }
}
