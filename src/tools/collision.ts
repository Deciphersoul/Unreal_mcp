/**
 * Collision Management Tools for UE MCP Extended
 * Provides collision preset and channel configuration for actors
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { Logger } from '../utils/logger.js';

export interface CollisionResult {
  success: boolean;
  message?: string;
  error?: string;
  profile?: string;
  responses?: Record<string, string>;
}

// Common UE collision presets
export const COLLISION_PRESETS = [
  'NoCollision',
  'BlockAll',
  'OverlapAll',
  'BlockAllDynamic',
  'OverlapAllDynamic',
  'IgnoreOnlyPawn',
  'OverlapOnlyPawn',
  'Pawn',
  'Spectator',
  'CharacterMesh',
  'PhysicsActor',
  'Destructible',
  'InvisibleWall',
  'InvisibleWallDynamic',
  'Trigger',
  'Ragdoll',
  'Vehicle',
  'UI'
] as const;

// Common collision channels
export const COLLISION_CHANNELS = [
  'WorldStatic',
  'WorldDynamic',
  'Pawn',
  'Visibility',
  'Camera',
  'PhysicsBody',
  'Vehicle',
  'Destructible'
] as const;

// Collision response types
export const COLLISION_RESPONSES = ['Ignore', 'Overlap', 'Block'] as const;

export class CollisionTools {
  private log = new Logger('CollisionTools');

  constructor(private bridge: UnrealBridge) {}

  /**
   * Set collision profile preset on an actor
   */
  async setProfile(params: {
    actorName: string;
    profile: string;
  }): Promise<CollisionResult> {
    const { actorName, profile } = params;

    if (!actorName || actorName.trim() === '') {
      return { success: false, error: 'actorName is required' };
    }

    if (!profile || profile.trim() === '') {
      return { success: false, error: 'profile is required' };
    }

    const escapePy = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const script = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_name = '${escapePy(actorName)}'.lower()
    profile_name = '${escapePy(profile)}'
    found = False
    
    for actor in all_actors:
        try:
            actor_label = actor.get_actor_label().lower()
            actor_name = actor.get_name().lower()
            
            if target_name == actor_label or target_name == actor_name or target_name in actor_label:
                found = True
                root = actor.get_editor_property('root_component')
                
                if root and isinstance(root, unreal.PrimitiveComponent):
                    # Set collision profile by name
                    root.set_collision_profile_name(profile_name)
                    result["success"] = True
                    result["message"] = f"Set collision profile '{profile_name}' on {actor.get_actor_label()}"
                    result["profile"] = profile_name
                else:
                    result["error"] = f"Actor {actor.get_actor_label()} has no PrimitiveComponent"
                break
        except Exception as e:
            continue
    
    if not found:
        result["error"] = f"Actor not found: {target_name}"
        
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message,
        error: response?.error,
        profile: response?.profile
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Set collision response to a specific channel
   */
  async setResponse(params: {
    actorName: string;
    channel: string;
    response: 'Ignore' | 'Overlap' | 'Block';
  }): Promise<CollisionResult> {
    const { actorName, channel, response } = params;

    if (!actorName || actorName.trim() === '') {
      return { success: false, error: 'actorName is required' };
    }

    if (!channel || channel.trim() === '') {
      return { success: false, error: 'channel is required' };
    }

    if (!response || !['Ignore', 'Overlap', 'Block'].includes(response)) {
      return { success: false, error: 'response must be Ignore, Overlap, or Block' };
    }

    const escapePy = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const script = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_name = '${escapePy(actorName)}'.lower()
    channel_name = '${escapePy(channel)}'
    response_type = '${response}'
    
    # Map response string to enum - try multiple naming conventions for UE5.x compatibility
    response_enum = None
    for attr in ['IGNORE', 'ECR_IGNORE', 'Ignore']:
        if hasattr(unreal.CollisionResponseType, attr):
            response_enum = getattr(unreal.CollisionResponseType, attr) if response_type == 'Ignore' else None
            break
    if response_enum is None:
        for attr in ['OVERLAP', 'ECR_OVERLAP', 'Overlap']:
            if hasattr(unreal.CollisionResponseType, attr):
                response_enum = getattr(unreal.CollisionResponseType, attr) if response_type == 'Overlap' else None
                break
    if response_enum is None:
        for attr in ['BLOCK', 'ECR_BLOCK', 'Block']:
            if hasattr(unreal.CollisionResponseType, attr):
                response_enum = getattr(unreal.CollisionResponseType, attr) if response_type == 'Block' else None
                break
    
    # Fallback: get the enum by index (0=Ignore, 1=Overlap, 2=Block)
    if response_enum is None:
        try:
            response_idx = {'Ignore': 0, 'Overlap': 1, 'Block': 2}.get(response_type, 2)
            response_enum = list(unreal.CollisionResponseType)[response_idx]
        except:
            result["error"] = f"Cannot find CollisionResponseType enum values. Available: {dir(unreal.CollisionResponseType)}"
            print('RESULT:' + json.dumps(result))
    
    # Map channel string to enum - try multiple naming conventions
    channel_map = {}
    channel_names = [
        ('WorldStatic', ['ECC_WORLD_STATIC', 'WORLD_STATIC', 'WorldStatic']),
        ('WorldDynamic', ['ECC_WORLD_DYNAMIC', 'WORLD_DYNAMIC', 'WorldDynamic']),
        ('Pawn', ['ECC_PAWN', 'PAWN', 'Pawn']),
        ('Visibility', ['ECC_VISIBILITY', 'VISIBILITY', 'Visibility']),
        ('Camera', ['ECC_CAMERA', 'CAMERA', 'Camera']),
        ('PhysicsBody', ['ECC_PHYSICS_BODY', 'PHYSICS_BODY', 'PhysicsBody']),
        ('Vehicle', ['ECC_VEHICLE', 'VEHICLE', 'Vehicle']),
        ('Destructible', ['ECC_DESTRUCTIBLE', 'DESTRUCTIBLE', 'Destructible'])
    ]
    for user_name, enum_names in channel_names:
        for attr in enum_names:
            if hasattr(unreal.CollisionChannel, attr):
                channel_map[user_name] = getattr(unreal.CollisionChannel, attr)
                break
    
    found = False
    
    for actor in all_actors:
        try:
            actor_label = actor.get_actor_label().lower()
            actor_name = actor.get_name().lower()
            
            if target_name == actor_label or target_name == actor_name or target_name in actor_label:
                found = True
                root = actor.get_editor_property('root_component')
                
                if root and isinstance(root, unreal.PrimitiveComponent):
                    channel_enum = channel_map.get(channel_name)
                    if channel_enum is not None:
                        root.set_collision_response_to_channel(channel_enum, response_enum)
                        result["success"] = True
                        result["message"] = f"Set {channel_name} response to {response_type} on {actor.get_actor_label()}"
                    else:
                        result["error"] = f"Unknown channel: {channel_name}. Valid: {list(channel_map.keys())}"
                else:
                    result["error"] = f"Actor {actor.get_actor_label()} has no PrimitiveComponent"
                break
        except Exception as e:
            continue
    
    if not found:
        result["error"] = f"Actor not found: {target_name}"
        
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    try {
      const response_result = await this.bridge.executePythonWithResult(script);
      return {
        success: response_result?.success ?? false,
        message: response_result?.message,
        error: response_result?.error
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Set collision enabled state
   */
  async setEnabled(params: {
    actorName: string;
    enabled: boolean;
    type?: 'NoCollision' | 'QueryOnly' | 'PhysicsOnly' | 'QueryAndPhysics';
  }): Promise<CollisionResult> {
    const { actorName, enabled, type } = params;

    if (!actorName || actorName.trim() === '') {
      return { success: false, error: 'actorName is required' };
    }

    const escapePy = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const collisionType = type || (enabled ? 'QueryAndPhysics' : 'NoCollision');

    const script = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_name = '${escapePy(actorName)}'.lower()
    collision_type = '${collisionType}'
    
    # Map type string to enum
    type_map = {
        'NoCollision': unreal.CollisionEnabled.NO_COLLISION,
        'QueryOnly': unreal.CollisionEnabled.QUERY_ONLY,
        'PhysicsOnly': unreal.CollisionEnabled.PHYSICS_ONLY,
        'QueryAndPhysics': unreal.CollisionEnabled.QUERY_AND_PHYSICS
    }
    
    found = False
    
    for actor in all_actors:
        try:
            actor_label = actor.get_actor_label().lower()
            actor_name = actor.get_name().lower()
            
            if target_name == actor_label or target_name == actor_name or target_name in actor_label:
                found = True
                root = actor.get_editor_property('root_component')
                
                if root and isinstance(root, unreal.PrimitiveComponent):
                    collision_enum = type_map.get(collision_type, unreal.CollisionEnabled.QUERY_AND_PHYSICS)
                    root.set_collision_enabled(collision_enum)
                    result["success"] = True
                    result["message"] = f"Set collision to {collision_type} on {actor.get_actor_label()}"
                else:
                    result["error"] = f"Actor {actor.get_actor_label()} has no PrimitiveComponent"
                break
        except Exception as e:
            continue
    
    if not found:
        result["error"] = f"Actor not found: {target_name}"
        
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message,
        error: response?.error
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Get current collision settings for an actor
   */
  async getSettings(params: {
    actorName: string;
  }): Promise<CollisionResult & { collisionEnabled?: string; objectType?: string }> {
    const { actorName } = params;

    if (!actorName || actorName.trim() === '') {
      return { success: false, error: 'actorName is required' };
    }

    const escapePy = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const script = `
import unreal
import json

result = {"success": False, "message": "", "error": ""}

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_name = '${escapePy(actorName)}'.lower()
    found = False
    
    for actor in all_actors:
        try:
            actor_label = actor.get_actor_label().lower()
            actor_name = actor.get_name().lower()
            
            if target_name == actor_label or target_name == actor_name or target_name in actor_label:
                found = True
                root = actor.get_editor_property('root_component')
                
                if root and isinstance(root, unreal.PrimitiveComponent):
                    profile = root.get_collision_profile_name()
                    collision_enabled = str(root.get_collision_enabled())
                    object_type = str(root.get_collision_object_type())
                    
                    result["success"] = True
                    result["profile"] = str(profile)
                    result["collisionEnabled"] = collision_enabled
                    result["objectType"] = object_type
                    result["message"] = f"Collision settings for {actor.get_actor_label()}"
                else:
                    result["error"] = f"Actor {actor.get_actor_label()} has no PrimitiveComponent"
                break
        except Exception as e:
            continue
    
    if not found:
        result["error"] = f"Actor not found: {target_name}"
        
except Exception as e:
    result["error"] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message,
        error: response?.error,
        profile: response?.profile,
        collisionEnabled: response?.collisionEnabled,
        objectType: response?.objectType
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}
