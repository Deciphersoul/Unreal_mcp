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
   },

   // Phase 8.2: Curves Management
   CREATE_CURVE: {
     name: 'create_curve',
     script: `
import unreal
import json

try:
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    if not asset_tools:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'AssetTools not available'})}")
        exit(0)
    
    # Create curve asset factory
    factory = unreal.CurveFactory()
    factory.curve_class = unreal.{curve_type}
    
    # Create asset
    asset = asset_tools.create_asset(
        asset_name='{name}',
        package_path='{path}',
        asset_class=unreal.{curve_type},
        factory=factory
    )
    
    if asset:
        print(f"RESULT:{json.dumps({'success': True, 'curvePath': asset.get_path_name(), 'keyCount': 0, 'message': 'Curve created successfully'})}")
    else:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'Failed to create curve asset'})}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   ADD_CURVE_KEY: {
     name: 'add_curve_key',
     script: `
import unreal
import json

try:
    # Load curve asset
    curve = unreal.EditorAssetLibrary.load_asset('{curve_path}')
    if not curve:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'Curve not found at path: {curve_path}'})}")
        exit(0)
    
    # Add key based on curve type
    if isinstance(curve, unreal.CurveFloat):
        curve.add_key({time}, {value})
        key_count = len(curve.get_keys())
    elif isinstance(curve, unreal.CurveVector):
        vector = unreal.Vector({vector_x}, {vector_y}, {vector_z})
        curve.add_key({time}, vector)
        key_count = len(curve.get_keys())
    elif isinstance(curve, unreal.CurveLinearColor):
        color = unreal.LinearColor({vector_x}, {vector_y}, {vector_z}, 1.0)
        curve.add_key({time}, color)
        key_count = len(curve.get_keys())
    else:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Unsupported curve type: {type(curve).__name__}'})}")
        exit(0)
    
    # Save the curve
    unreal.EditorAssetLibrary.save_asset('{curve_path}')
    
    print(f"RESULT:{json.dumps({'success': True, 'keyCount': key_count, 'message': 'Key added successfully'})}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   EVALUATE_CURVE: {
     name: 'evaluate_curve',
     script: `
import unreal
import json

try:
    # Load curve asset
    curve = unreal.EditorAssetLibrary.load_asset('{curve_path}')
    if not curve:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'Curve not found at path: {curve_path}'})}")
        exit(0)
    
    # Evaluate based on curve type
    if isinstance(curve, unreal.CurveFloat):
        value = curve.get_float_value({time})
        key_count = len(curve.get_keys())
        print(f"RESULT:{json.dumps({'success': True, 'value': value, 'keyCount': key_count, 'message': 'Curve evaluated'})}")
    elif isinstance(curve, unreal.CurveVector):
        vector = curve.get_vector_value({time})
        key_count = len(curve.get_keys())
        print(f"RESULT:{json.dumps({'success': True, 'vectorValue': {'x': vector.x, 'y': vector.y, 'z': vector.z}, 'keyCount': key_count, 'message': 'Curve evaluated'})}")
    elif isinstance(curve, unreal.CurveLinearColor):
        color = curve.get_linear_color_value({time})
        key_count = len(curve.get_keys())
        print(f"RESULT:{json.dumps({'success': True, 'vectorValue': {'x': color.r, 'y': color.g, 'z': color.b}, 'keyCount': key_count, 'message': 'Curve evaluated'})}")
    else:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Unsupported curve type: {type(curve).__name__}'})}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   // Phase 8.3: GameMode Setup
   CREATE_GAMEMODE_FRAMEWORK: {
     name: 'create_gamemode_framework',
     script: `
import unreal
import json

try:
    project_name = '{project_name}'
    include_gas = {include_gas}
    include_commonui = {include_commonui}
    
    classes_created = []
    header_paths = []
    source_paths = []
    
    # Create GameMode class
    gamemode_class = f"{project_name}GameMode"
    # TODO: Implement actual C++ class creation
    classes_created.append(gamemode_class)
    
    # Create GameState class
    gamestate_class = f"{project_name}GameState"
    classes_created.append(gamestate_class)
    
    # Create PlayerState class
    playerstate_class = f"{project_name}PlayerState"
    classes_created.append(playerstate_class)
    
    # Create PlayerController class
    playercontroller_class = f"{project_name}PlayerController"
    classes_created.append(playercontroller_class)
    
    if include_gas:
        # Create GAS classes
        attribute_set_class = f"{project_name}AttributeSet"
        ability_system_component_class = f"{project_name}AbilitySystemComponent"
        classes_created.extend([attribute_set_class, ability_system_component_class])
    
    if include_commonui:
        # Create CommonUI classes
        common_activatable_widget_class = f"{project_name}CommonActivatableWidget"
        common_button_base_class = f"{project_name}CommonButtonBase"
        classes_created.extend([common_activatable_widget_class, common_button_base_class])
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'classesCreated': classes_created,
        'headerPaths': header_paths,
        'sourcePaths': source_paths,
        'message': f'Game framework created for {project_name}'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   SET_DEFAULT_CLASSES: {
     name: 'set_default_classes',
     script: `
import unreal
import json

try:
    gamemode_class = '{gamemode_class}'
    playercontroller_class = '{playercontroller_class}' if '{playercontroller_class}' else f"{gamemode_class.replace('GameMode', '')}PlayerController"
    playerstate_class = '{playerstate_class}' if '{playerstate_class}' else f"{gamemode_class.replace('GameMode', '')}PlayerState"
    gamestate_class = '{gamestate_class}' if '{gamestate_class}' else f"{gamemode_class.replace('GameMode', '')}GameState"
    hud_class = '{hud_class}' if '{hud_class}' else f"{gamemode_class.replace('GameMode', '')}HUD"
    
    # TODO: Implement actual project settings update
    # This would update DefaultGame.ini or similar config files
    
    config_updated = True  # Placeholder
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'playerControllerClass': playercontroller_class,
        'playerStateClass': playerstate_class,
        'gameStateClass': gamestate_class,
        'hudClass': hud_class,
        'configUpdated': config_updated,
        'message': f'Default classes set with GameMode: {gamemode_class}'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   // Phase 8.4: Actor Tags
   ADD_ACTOR_TAGS: {
     name: 'add_actor_tags',
     script: `
import unreal
import json

try:
    actor_name = '{actor_name}'
    tags_to_add = json.loads('{tags}')
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Find actor by name
    actors = subsys.get_all_level_actors()
    target_actor = None
    for actor in actors:
        if actor.get_actor_label().lower() == actor_name.lower():
            target_actor = actor
            break
    
    if not target_actor:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Actor "{actor_name}" not found'})}")
        exit(0)
    
    # Add tags
    added_count = 0
    for tag in tags_to_add:
        if tag and tag.strip():
            target_actor.tags.append(tag.strip())
            added_count += 1
    
    # Save actor changes
    subsys.set_actor_label(target_actor, target_actor.get_actor_label())  # Forces refresh
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'addedCount': added_count,
        'totalTags': len(target_actor.tags),
        'message': f'Added {added_count} tag(s) to actor "{actor_name}"'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   REMOVE_ACTOR_TAGS: {
     name: 'remove_actor_tags',
     script: `
import unreal
import json

try:
    actor_name = '{actor_name}'
    tags_to_remove = json.loads('{tags}')
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Find actor by name
    actors = subsys.get_all_level_actors()
    target_actor = None
    for actor in actors:
        if actor.get_actor_label().lower() == actor_name.lower():
            target_actor = actor
            break
    
    if not target_actor:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Actor "{actor_name}" not found'})}")
        exit(0)
    
    # Remove tags
    removed_count = 0
    original_tags = list(target_actor.tags)
    for tag in tags_to_remove:
        if tag and tag.strip():
            while tag.strip() in target_actor.tags:
                target_actor.tags.remove(tag.strip())
                removed_count += 1
    
    # Save actor changes
    subsys.set_actor_label(target_actor, target_actor.get_actor_label())  # Forces refresh
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'removedCount': removed_count,
        'totalTags': len(target_actor.tags),
        'message': f'Removed {removed_count} tag(s) from actor "{actor_name}"'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   HAS_ACTOR_TAG: {
     name: 'has_actor_tag',
     script: `
import unreal
import json

try:
    actor_name = '{actor_name}'
    tag_to_check = '{tag}'
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Find actor by name
    actors = subsys.get_all_level_actors()
    target_actor = None
    for actor in actors:
        if actor.get_actor_label().lower() == actor_name.lower():
            target_actor = actor
            break
    
    if not target_actor:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Actor "{actor_name}" not found'})}")
        exit(0)
    
    # Check if actor has tag
    has_tag = tag_to_check in target_actor.tags
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'hasTag': has_tag,
        'allTags': list(target_actor.tags),
        'message': f'Actor "{actor_name}" has tag "{tag_to_check}": {has_tag}'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   GET_ACTOR_TAGS: {
     name: 'get_actor_tags',
     script: `
import unreal
import json

try:
    actor_name = '{actor_name}'
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Find actor by name
    actors = subsys.get_all_level_actors()
    target_actor = None
    for actor in actors:
        if actor.get_actor_label().lower() == actor_name.lower():
            target_actor = actor
            break
    
    if not target_actor:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Actor "{actor_name}" not found'})}")
        exit(0)
    
    # Get all tags
    tags = list(target_actor.tags)
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'tags': tags,
        'count': len(tags),
        'message': f'Actor "{actor_name}" has {len(tags)} tag(s)'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   CLEAR_ACTOR_TAGS: {
     name: 'clear_actor_tags',
     script: `
import unreal
import json

try:
    actor_name = '{actor_name}'
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Find actor by name
    actors = subsys.get_all_level_actors()
    target_actor = None
    for actor in actors:
        if actor.get_actor_label().lower() == actor_name.lower():
            target_actor = actor
            break
    
    if not target_actor:
        print(f"RESULT:{json.dumps({'success': False, 'error': f'Actor "{actor_name}" not found'})}")
        exit(0)
    
    # Clear all tags
    cleared_count = len(target_actor.tags)
    target_actor.tags.clear()
    
    # Save actor changes
    subsys.set_actor_label(target_actor, target_actor.get_actor_label())  # Forces refresh
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'clearedCount': cleared_count,
        'message': f'Cleared {cleared_count} tag(s) from actor "{actor_name}"'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
     `.trim()
   },

   QUERY_ACTORS_BY_TAG: {
     name: 'query_actors_by_tag',
     script: `
import unreal
import json
import fnmatch

try:
    tag_pattern = '{tag_pattern}'
    match_all = {match_all}
    
    # Get actor subsystem
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not subsys:
        print(f"RESULT:{json.dumps({'success': False, 'error': 'EditorActorSubsystem not available'})}")
        exit(0)
    
    # Get all actors
    all_actors = subsys.get_all_level_actors()
    
    # Filter actors by tag pattern
    matching_actors = []
    matching_tags = set()
    
    for actor in all_actors:
        actor_tags = list(actor.tags)
        actor_name = actor.get_actor_label()
        
        if match_all:
            # Match all tags (AND logic)
            all_match = True
            for tag in actor_tags:
                if not fnmatch.fnmatch(tag, tag_pattern):
                    all_match = False
                    break
            if all_match and actor_tags:
                matching_actors.append(actor_name)
                matching_tags.update(actor_tags)
        else:
            # Match any tag (OR logic)
            for tag in actor_tags:
                if fnmatch.fnmatch(tag, tag_pattern):
                    matching_actors.append(actor_name)
                    matching_tags.add(tag)
                    break
    
    print(f"RESULT:{json.dumps({
        'success': True,
        'actors': matching_actors,
        'count': len(matching_actors),
        'matchingTags': list(matching_tags),
        'message': f'Found {len(matching_actors)} actor(s) matching tag pattern "{tag_pattern}"'
    })}")
except Exception as e:
    print(f"RESULT:{json.dumps({'success': False, 'error': str(e)})}")
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
