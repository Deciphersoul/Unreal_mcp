/**
 * Python script templates for Unreal Engine Remote Control API
 * These templates use EditorLevelLibrary and other UE Python APIs
 */

export interface PythonScriptTemplate {
  name: string;
  script: string;
  params?: Record<string, any>;
}

export const PYTHON_TEMPLATES: Record<string, PythonScriptTemplate> = {
  GET_ALL_ACTORS: {
    name: 'get_all_actors',
    script: `
import unreal
import json

# Use EditorActorSubsystem instead of deprecated EditorLevelLibrary
try:
   subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
   if subsys:
       actors = subsys.get_all_level_actors()
       result = [{'name': a.get_name(), 'class': a.get_class().get_name(), 'path': a.get_path_name()} for a in actors]
       print(f"RESULT:{json.dumps(result)}")
   else:
       print("RESULT:[]")
except Exception as e:
   print(f"RESULT:{json.dumps({'error': str(e)})}")
    `.trim()
  },
  SPAWN_ACTOR_AT_LOCATION: {
    name: 'spawn_actor',
    script: `
import unreal
import json

location = unreal.Vector({x}, {y}, {z})
rotation = unreal.Rotator({pitch}, {yaw}, {roll})

try:
   # Use EditorActorSubsystem instead of deprecated EditorLevelLibrary
   subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
   if subsys:
       # Try to load asset class
       actor_class = unreal.EditorAssetLibrary.load_asset("{class_path}")
       if actor_class:
           spawned = subsys.spawn_actor_from_object(actor_class, location, rotation)
           if spawned:
               print(f"RESULT:{json.dumps({'success': True, 'actor': spawned.get_name(), 'location': [{x}, {y}, {z}]}})}")
           else:
               print(f"RESULT:{json.dumps({'success': False, 'error': 'Failed to spawn actor'})}")
       else:
           print(f"RESULT:{json.dumps({'success': False, 'error': 'Failed to load actor class: {class_path}'})}")
   else:
       print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
    `.trim()
  },
  DELETE_ACTOR: {
    name: 'delete_actor',
    script: `
import unreal
import json

try:
   subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
   if subsys:
       actors = subsys.get_all_level_actors()
       found = False
       for actor in actors:
           if not actor:
               continue
           label = actor.get_actor_label()
           name = actor.get_name()
           if label == "{actor_name}" or name == "{actor_name}" or label.lower().startswith("{actor_name}".lower()+"_"):
               success = subsys.destroy_actor(actor)
               print(f"RESULT:{json.dumps({'success': success, 'deleted': label})}")
               found = True
               break
       if not found:
           print(f"RESULT:{json.dumps({'success': False, 'error': 'Actor not found: {actor_name}'})}")
   else:
       print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
    `.trim()
  },
  CREATE_ASSET: {
    name: 'create_asset',
    script: `
import unreal
import json

try:
   asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
   if asset_tools:
       # Create factory based on asset type
       factory_class = getattr(unreal, '{factory_class}', None)
       asset_class = getattr(unreal, '{asset_class}', None)

       if factory_class and asset_class:
           factory = factory_class()
           # Clean up the path - remove trailing slashes and normalize
           package_path = "{package_path}".rstrip('/').replace('//', '/')

           # Ensure package path is valid (starts with /Game or /Engine)
           if not package_path.startswith('/Game') and not package_path.startswith('/Engine'):
               if not package_path.startswith('/'):
                   package_path = f"/Game/{package_path}"
               else:
                   package_path = f"/Game{package_path}"

           # Create full asset path for verification
           full_asset_path = f"{package_path}/{asset_name}" if package_path != "/Game" else f"/Game/{asset_name}"

           # Create the asset with cleaned path
           asset = asset_tools.create_asset("{asset_name}", package_path, asset_class, factory)
           if asset:
               # Save the asset
               saved = unreal.EditorAssetLibrary.save_asset(asset.get_path_name())
               # Enhanced verification with retry logic
                asset_path = asset.get_path_name()
                verification_attempts = 0
                max_verification_attempts = 5
                asset_verified = False

                while verification_attempts < max_verification_attempts and not asset_verified:
                    verification_attempts += 1
                    # Wait a bit for the asset to be fully saved
                    import time
                    time.sleep(0.1)

                    # Check if asset exists
                    asset_exists = unreal.EditorAssetLibrary.does_asset_exist(asset_path)

                    if asset_exists:
                        asset_verified = True
                    elif verification_attempts < max_verification_attempts:
                        # Try to reload the asset registry
                        try:
                            unreal.AssetRegistryHelpers.get_asset_registry().scan_modified_asset_files([asset_path])
                        except:
                            pass

                if asset_verified:
                    print(f"RESULT:{json.dumps({'success': saved, 'path': asset_path, 'verified': True})}")
                else:
                    print(f"RESULT:{json.dumps({'success': saved, 'path': asset_path, 'warning': 'Asset created but verification pending'})}")
           else:
               print(f"RESULT:{json.dumps({'success': False, 'error': 'Failed to create asset'})}")
       else:
           print(f"RESULT:{json.dumps({'success': False, 'error': 'Invalid factory or asset class'})}")
   else:
       print(f"RESULT:{json.dumps({'success': False, 'error': 'AssetToolsHelpers not available'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
    `.trim()
  },
  SET_VIEWPORT_CAMERA: {
    name: 'set_viewport_camera',
    script: `
import unreal
import json

location = unreal.Vector({x}, {y}, {z})
rotation = unreal.Rotator({pitch}, {yaw}, {roll})

try:
   # Use UnrealEditorSubsystem for viewport operations (UE5.1+)
   ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
   les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

   if ues:
       ues.set_level_viewport_camera_info(location, rotation)
       try:
           if les:
               les.editor_invalidate_viewports()
       except Exception:
           pass
       print(f"RESULT:{json.dumps({'success': True, 'location': [{x}, {y}, {z}], 'rotation': [{pitch}, {yaw}, {roll}]}})}")
   else:
       print(f"RESULT:{json.dumps({'success': False, 'error': 'UnrealEditorSubsystem not available'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
    `.trim()
  },
  BUILD_LIGHTING: {
    name: 'build_lighting',
    script: `
import unreal
import json

try:
   les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
   if les:
       # Use UE 5.6 enhanced lighting quality settings
       quality_map = {
           'Preview': unreal.LightingBuildQuality.PREVIEW,
           'Medium': unreal.LightingBuildQuality.MEDIUM,
           'High': unreal.LightingBuildQuality.HIGH,
           'Production': unreal.LightingBuildQuality.PRODUCTION
       }
       q = quality_map.get('{quality}', unreal.LightingBuildQuality.PREVIEW)
       les.build_light_maps(q, True)
       print(f"RESULT:{json.dumps({'success': True, 'quality': '{quality}', 'method': 'LevelEditorSubsystem'})}")
   else:
       print(f"RESULT:{json.dumps({'success': False, 'error': 'LevelEditorSubsystem not available'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
    `.trim()
  },
  SAVE_ALL_DIRTY_PACKAGES: {
    name: 'save_dirty_packages',
    script: `
import unreal
import json

try:
   # Use UE 5.6 enhanced saving with better error handling
   saved = unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
   print(f"RESULT:{json.dumps({'success': bool(saved), 'saved_count': saved if isinstance(saved, int) else 0, 'message': 'All dirty packages saved'})}")
except Exception as e:
   print(f"RESULT:{json.dumps({'success': False, 'error': str(e), 'message': 'Failed to save dirty packages'})}")
    `.trim()
  }
};

/**
 * Fill in template parameters with actual values
 * @param template The Python script template to fill
 * @param params Key-value pairs to substitute in the template
 * @returns The filled script string
 */
export function fillTemplate(template: PythonScriptTemplate, params: Record<string, any>): string {
  let script = template.script;
  for (const [key, value] of Object.entries(params)) {
    script = script.replaceAll(`{${key}}`, String(value));
  }
  return script;
}
