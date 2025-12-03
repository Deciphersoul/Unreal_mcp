/**
 * Query Level Tools for UE MCP Extended
 * Provides actor querying capabilities to understand scene state
 * 
 * ARCHITECTURE: Direct RC API first, Python fallback for detailed info
 * - Direct RC: Fast but returns only actor paths
 * - Python: Slower but provides full actor details (location, rotation, class, etc.)
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { Logger } from '../utils/logger.js';

// Full actor info (requires Python)
export interface ActorInfo {
  name: string;
  label: string;
  class: string;
  path: string;
  location: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
  scale: { x: number; y: number; z: number };
  tags: string[];
  isHidden: boolean;
  isSelected: boolean;
  folder?: string;
}

// Basic actor info (Direct RC - paths only)
export interface BasicActorInfo {
  path: string;
  name: string;  // extracted from path
}

// Result with full actor details (Python)
export interface QueryResult {
  success: boolean;
  actors: ActorInfo[];
  count: number;
  totalCount?: number;
  error?: string;
  method?: 'DirectRC' | 'Python';
  limitedInfo?: boolean;
}

// Result with basic info only (Direct RC)
export interface QueryResultBasic {
  success: boolean;
  actors: BasicActorInfo[];
  count: number;
  totalCount?: number;
  error?: string;
  method: 'DirectRC' | 'Python';
  limitedInfo: boolean;  // true when using Direct RC (paths only)
  note?: string;
}

// Count result interface
export interface CountResult {
  success: boolean;
  total: number;
  byClass: Record<string, number>;
  selected: number;
  hidden: number;
  error?: string;
  method?: 'DirectRC' | 'Python';
  note?: string;
}

export class QueryLevelTools {
  private log = new Logger('QueryLevelTools');

  constructor(private bridge: UnrealBridge) {}

  // ============================================================================
  // DIRECT RC API METHODS (Fast, but limited info - paths only)
  // ============================================================================

  /**
   * Get all actors via Direct Remote Control API
   * Returns only actor paths (no detailed info like location/rotation)
   */
  private async getAllActorsViaDirectRC(params: { 
    limit?: number; 
    offset?: number 
  } = {}): Promise<QueryResultBasic> {
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'GetAllLevelActors',
        parameters: {}
      });

      const actorPaths: string[] = result?.ReturnValue || [];
      
      // Extract name from path (last segment after '.' or ':')
      const actors: BasicActorInfo[] = actorPaths.map((path: string) => ({
        path,
        name: this.extractNameFromPath(path)
      }));

      // Apply pagination
      const offset = params.offset || 0;
      const limit = params.limit || 500;
      const paginated = actors.slice(offset, offset + limit);

      return {
        success: true,
        actors: paginated,
        count: paginated.length,
        totalCount: actors.length,
        method: 'DirectRC',
        limitedInfo: true,
        note: 'Direct RC returns paths only. Use Python fallback for detailed actor info (location, rotation, class, etc.)'
      };
    } catch (err: any) {
      this.log.debug('Direct RC GetAllLevelActors failed:', err?.message);
      throw err; // Let caller handle fallback
    }
  }

  /**
   * Get selected actors via Direct Remote Control API
   * Returns only actor paths (no detailed info)
   */
  private async getSelectedActorsViaDirectRC(): Promise<QueryResultBasic> {
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'GetSelectedLevelActors',
        parameters: {}
      });

      const actorPaths: string[] = result?.ReturnValue || [];
      
      const actors: BasicActorInfo[] = actorPaths.map((path: string) => ({
        path,
        name: this.extractNameFromPath(path)
      }));

      return {
        success: true,
        actors,
        count: actors.length,
        method: 'DirectRC',
        limitedInfo: true,
        note: 'Direct RC returns paths only. Use Python fallback for detailed actor info.'
      };
    } catch (err: any) {
      this.log.debug('Direct RC GetSelectedLevelActors failed:', err?.message);
      throw err;
    }
  }

  /**
   * Extract actor name from full path
   * Example: "/Game/Maps/Level.Level:PersistentLevel.StaticMeshActor_0" -> "StaticMeshActor_0"
   */
  private extractNameFromPath(path: string): string {
    // Try splitting by '.' first (most common)
    const dotParts = path.split('.');
    if (dotParts.length > 1) {
      return dotParts[dotParts.length - 1];
    }
    // Try splitting by ':'
    const colonParts = path.split(':');
    if (colonParts.length > 1) {
      return colonParts[colonParts.length - 1];
    }
    // Return the path as-is if no delimiter found
    return path;
  }

  // ============================================================================
  // PYTHON FALLBACK METHODS (Slower, but provides full details)
  // ============================================================================

  /**
   * Get all actors via Python (full details)
   */
  private async getAllActorsViaPython(params: {
    includeHidden?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<QueryResult> {
    const limit = params.limit || 500;
    const offset = params.offset || 0;
    const includeHidden = params.includeHidden ?? false;

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected_actors = set(a.get_path_name() for a in subsystem.get_selected_level_actors())
    
    result = []
    for actor in all_actors:
        try:
            is_hidden = actor.is_hidden_ed()
            if not ${includeHidden ? 'True' : 'False'} and is_hidden:
                continue
                
            loc = actor.get_actor_location()
            rot = actor.get_actor_rotation()
            scale = actor.get_actor_scale3d()
            
            actor_info = {
                'name': actor.get_name(),
                'label': actor.get_actor_label(),
                'class': actor.get_class().get_name(),
                'path': actor.get_path_name(),
                'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
                'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
                'scale': {'x': scale.x, 'y': scale.y, 'z': scale.z},
                'tags': [str(t) for t in actor.tags] if hasattr(actor, 'tags') else [],
                'isHidden': is_hidden,
                'isSelected': actor.get_path_name() in selected_actors,
                'folder': actor.get_folder_path().path if hasattr(actor, 'get_folder_path') else None
            }
            result.append(actor_info)
        except Exception as e:
            pass  # Skip actors that can't be queried
    
    total_count = len(result)
    # Apply pagination
    paginated = result[${offset}:${offset + limit}]
    
    print('RESULT:' + json.dumps({
        'success': True,
        'actors': paginated,
        'count': len(paginated),
        'totalCount': total_count
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'actors': [],
        'count': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        actors: response?.actors || [],
        count: response?.count || 0,
        totalCount: response?.totalCount,
        error: response?.error,
        method: 'Python',
        limitedInfo: false
      };
    } catch (err: any) {
      return {
        success: false,
        actors: [],
        count: 0,
        error: err?.message || String(err),
        method: 'Python',
        limitedInfo: false
      };
    }
  }

  /**
   * Get selected actors via Python (full details)
   */
  private async getSelectedActorsViaPython(): Promise<QueryResult> {
    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    selected = subsystem.get_selected_level_actors()
    
    result = []
    for actor in selected:
        try:
            loc = actor.get_actor_location()
            rot = actor.get_actor_rotation()
            scale = actor.get_actor_scale3d()
            
            actor_info = {
                'name': actor.get_name(),
                'label': actor.get_actor_label(),
                'class': actor.get_class().get_name(),
                'path': actor.get_path_name(),
                'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
                'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
                'scale': {'x': scale.x, 'y': scale.y, 'z': scale.z},
                'tags': [str(t) for t in actor.tags] if hasattr(actor, 'tags') else [],
                'isHidden': actor.is_hidden_ed(),
                'isSelected': True
            }
            result.append(actor_info)
        except Exception as e:
            pass
    
    print('RESULT:' + json.dumps({
        'success': True,
        'actors': result,
        'count': len(result)
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'actors': [],
        'count': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        actors: response?.actors || [],
        count: response?.count || 0,
        error: response?.error,
        method: 'Python',
        limitedInfo: false
      };
    } catch (err: any) {
      return {
        success: false,
        actors: [],
        count: 0,
        error: err?.message || String(err),
        method: 'Python',
        limitedInfo: false
      };
    }
  }

  /**
   * Count actors via Python (detailed breakdown)
   */
  private async countActorsViaPython(): Promise<CountResult> {
    const script = `
import unreal
import json
from collections import defaultdict

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected_actors = subsystem.get_selected_level_actors()
    
    class_counts = defaultdict(int)
    hidden_count = 0
    
    for actor in all_actors:
        try:
            class_name = actor.get_class().get_name()
            class_counts[class_name] += 1
            if actor.is_hidden_ed():
                hidden_count += 1
        except:
            pass
    
    print('RESULT:' + json.dumps({
        'success': True,
        'total': len(all_actors),
        'byClass': dict(class_counts),
        'selected': len(selected_actors),
        'hidden': hidden_count
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'total': 0,
        'byClass': {},
        'selected': 0,
        'hidden': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        total: response?.total || 0,
        byClass: response?.byClass || {},
        selected: response?.selected || 0,
        hidden: response?.hidden || 0,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        total: 0,
        byClass: {},
        selected: 0,
        hidden: 0,
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  // ============================================================================
  // PUBLIC API METHODS (Try Direct RC first, fallback to Python)
  // ============================================================================

  /**
   * Get all actors in the current level
   * 
   * Strategy:
   * - If no filters needed (simple list): Try Direct RC first (fast, paths only)
   * - If detailed info or filters needed: Use Python (full actor details)
   * - Always indicate which method was used and if info is limited
   */
  async getAllActors(params: {
    includeHidden?: boolean;
    limit?: number;
    offset?: number;
    detailedInfo?: boolean;  // Force Python for full details
  } = {}): Promise<QueryResult | QueryResultBasic> {
    const needsDetailedInfo = params.includeHidden === true || params.detailedInfo === true;

    // If filters or detailed info requested, go straight to Python
    if (needsDetailedInfo) {
      this.log.debug('Using Python for detailed actor info (filters or detailedInfo requested)');
      return this.getAllActorsViaPython(params);
    }

    // Try Direct RC first (fast, but limited info)
    try {
      this.log.debug('Trying Direct RC for actor list (paths only)');
      return await this.getAllActorsViaDirectRC(params);
    } catch (rcError: any) {
      // If Direct RC fails (e.g., 400 error for remote access), fallback to Python
      this.log.debug('Direct RC failed, falling back to Python:', rcError?.message);
      const pythonResult = await this.getAllActorsViaPython(params);
      return pythonResult;
    }
  }

  /**
   * Get all actors with guaranteed full details (always uses Python)
   */
  async getAllActorsDetailed(params: {
    includeHidden?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<QueryResult> {
    return this.getAllActorsViaPython(params);
  }

  /**
   * Get currently selected actors
   * 
   * Strategy: Try Direct RC first, fallback to Python
   */
  async getSelectedActors(params: {
    detailedInfo?: boolean;  // Force Python for full details
  } = {}): Promise<QueryResult | QueryResultBasic> {
    if (params.detailedInfo === true) {
      this.log.debug('Using Python for detailed selected actor info');
      return this.getSelectedActorsViaPython();
    }

    // Try Direct RC first
    try {
      this.log.debug('Trying Direct RC for selected actors (paths only)');
      return await this.getSelectedActorsViaDirectRC();
    } catch (rcError: any) {
      this.log.debug('Direct RC failed for selection, falling back to Python:', rcError?.message);
      return this.getSelectedActorsViaPython();
    }
  }

  /**
   * Get selected actors with guaranteed full details (always uses Python)
   */
  async getSelectedActorsDetailed(): Promise<QueryResult> {
    return this.getSelectedActorsViaPython();
  }

  /**
   * Get actors by class name
   * Note: Always uses Python as Direct RC doesn't support filtering
   */
  async getActorsByClass(className: string, params: {
    includeHidden?: boolean;
    limit?: number;
  } = {}): Promise<QueryResult> {
    const limit = params.limit || 100;
    const includeHidden = params.includeHidden ?? false;

    // Escape the class name for Python
    const safeClassName = className.replace(/'/g, "\\'").replace(/"/g, '\\"');

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected_actors = set(a.get_path_name() for a in subsystem.get_selected_level_actors())
    
    target_class = '${safeClassName}'.lower()
    result = []
    
    for actor in all_actors:
        try:
            actor_class = actor.get_class().get_name().lower()
            if target_class not in actor_class and actor_class not in target_class:
                continue
                
            is_hidden = actor.is_hidden_ed()
            if not ${includeHidden ? 'True' : 'False'} and is_hidden:
                continue
            
            loc = actor.get_actor_location()
            rot = actor.get_actor_rotation()
            scale = actor.get_actor_scale3d()
            
            actor_info = {
                'name': actor.get_name(),
                'label': actor.get_actor_label(),
                'class': actor.get_class().get_name(),
                'path': actor.get_path_name(),
                'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
                'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
                'scale': {'x': scale.x, 'y': scale.y, 'z': scale.z},
                'tags': [str(t) for t in actor.tags] if hasattr(actor, 'tags') else [],
                'isHidden': is_hidden,
                'isSelected': actor.get_path_name() in selected_actors
            }
            result.append(actor_info)
            
            if len(result) >= ${limit}:
                break
        except Exception as e:
            pass
    
    print('RESULT:' + json.dumps({
        'success': True,
        'actors': result,
        'count': len(result),
        'className': '${safeClassName}'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'actors': [],
        'count': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        actors: response?.actors || [],
        count: response?.count || 0,
        error: response?.error,
        method: 'Python',
        limitedInfo: false
      };
    } catch (err: any) {
      return {
        success: false,
        actors: [],
        count: 0,
        error: err?.message || String(err),
        method: 'Python',
        limitedInfo: false
      };
    }
  }

  /**
   * Get actors by tag
   * Note: Always uses Python as Direct RC doesn't support filtering
   */
  async getActorsByTag(tag: string, params: {
    includeHidden?: boolean;
    limit?: number;
  } = {}): Promise<QueryResult> {
    const limit = params.limit || 100;
    const includeHidden = params.includeHidden ?? false;
    const safeTag = tag.replace(/'/g, "\\'").replace(/"/g, '\\"');

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected_actors = set(a.get_path_name() for a in subsystem.get_selected_level_actors())
    
    target_tag = '${safeTag}'
    result = []
    
    for actor in all_actors:
        try:
            if not hasattr(actor, 'tags'):
                continue
            
            actor_tags = [str(t) for t in actor.tags]
            if target_tag not in actor_tags:
                continue
                
            is_hidden = actor.is_hidden_ed()
            if not ${includeHidden ? 'True' : 'False'} and is_hidden:
                continue
            
            loc = actor.get_actor_location()
            rot = actor.get_actor_rotation()
            scale = actor.get_actor_scale3d()
            
            actor_info = {
                'name': actor.get_name(),
                'label': actor.get_actor_label(),
                'class': actor.get_class().get_name(),
                'path': actor.get_path_name(),
                'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
                'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
                'scale': {'x': scale.x, 'y': scale.y, 'z': scale.z},
                'tags': actor_tags,
                'isHidden': is_hidden,
                'isSelected': actor.get_path_name() in selected_actors
            }
            result.append(actor_info)
            
            if len(result) >= ${limit}:
                break
        except Exception as e:
            pass
    
    print('RESULT:' + json.dumps({
        'success': True,
        'actors': result,
        'count': len(result),
        'tag': '${safeTag}'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'actors': [],
        'count': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        actors: response?.actors || [],
        count: response?.count || 0,
        error: response?.error,
        method: 'Python',
        limitedInfo: false
      };
    } catch (err: any) {
      return {
        success: false,
        actors: [],
        count: 0,
        error: err?.message || String(err),
        method: 'Python',
        limitedInfo: false
      };
    }
  }

  /**
   * Get actors by name pattern (supports wildcards)
   * Note: Always uses Python as Direct RC doesn't support filtering
   */
  async getActorsByName(namePattern: string, params: {
    includeHidden?: boolean;
    limit?: number;
  } = {}): Promise<QueryResult> {
    const limit = params.limit || 100;
    const includeHidden = params.includeHidden ?? false;
    
    // Convert wildcard pattern to regex
    const safePattern = namePattern
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const script = `
import unreal
import json
import re

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected_actors = set(a.get_path_name() for a in subsystem.get_selected_level_actors())
    
    pattern = re.compile(r'^${safePattern}$', re.IGNORECASE)
    result = []
    
    for actor in all_actors:
        try:
            actor_name = actor.get_name()
            actor_label = actor.get_actor_label()
            
            if not (pattern.match(actor_name) or pattern.match(actor_label)):
                continue
                
            is_hidden = actor.is_hidden_ed()
            if not ${includeHidden ? 'True' : 'False'} and is_hidden:
                continue
            
            loc = actor.get_actor_location()
            rot = actor.get_actor_rotation()
            scale = actor.get_actor_scale3d()
            
            actor_info = {
                'name': actor_name,
                'label': actor_label,
                'class': actor.get_class().get_name(),
                'path': actor.get_path_name(),
                'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
                'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
                'scale': {'x': scale.x, 'y': scale.y, 'z': scale.z},
                'tags': [str(t) for t in actor.tags] if hasattr(actor, 'tags') else [],
                'isHidden': is_hidden,
                'isSelected': actor.get_path_name() in selected_actors
            }
            result.append(actor_info)
            
            if len(result) >= ${limit}:
                break
        except Exception as e:
            pass
    
    print('RESULT:' + json.dumps({
        'success': True,
        'actors': result,
        'count': len(result),
        'pattern': '${safePattern}'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e),
        'actors': [],
        'count': 0
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        actors: response?.actors || [],
        count: response?.count || 0,
        error: response?.error,
        method: 'Python',
        limitedInfo: false
      };
    } catch (err: any) {
      return {
        success: false,
        actors: [],
        count: 0,
        error: err?.message || String(err),
        method: 'Python',
        limitedInfo: false
      };
    }
  }

  /**
   * Count actors by type
   * 
   * Strategy: Try Direct RC for basic count, fallback to Python for breakdown
   */
  async countActors(): Promise<CountResult> {
    // Try Direct RC first for basic count
    try {
      this.log.debug('Trying Direct RC for actor count');
      
      // Get all actors via Direct RC
      const allResult = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'GetAllLevelActors',
        parameters: {}
      });
      
      const actorPaths: string[] = allResult?.ReturnValue || [];
      const total = actorPaths.length;

      // Get selected actors via Direct RC
      let selected = 0;
      try {
        const selectedResult = await this.bridge.call({
          objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
          functionName: 'GetSelectedLevelActors',
          parameters: {}
        });
        selected = (selectedResult?.ReturnValue || []).length;
      } catch {
        // Selected count failed, continue with 0
      }

      // Try to extract class info from paths (limited accuracy)
      const byClass: Record<string, number> = {};
      for (const path of actorPaths) {
        // Try to guess class from path pattern (e.g., "StaticMeshActor_0")
        const name = this.extractNameFromPath(path);
        // Extract potential class name (text before underscore + number)
        const classMatch = name.match(/^([A-Za-z]+)(?:_\d+)?$/);
        if (classMatch) {
          const className = classMatch[1];
          byClass[className] = (byClass[className] || 0) + 1;
        } else {
          byClass['Unknown'] = (byClass['Unknown'] || 0) + 1;
        }
      }

      return {
        success: true,
        total,
        byClass,
        selected,
        hidden: 0,  // Can't determine from Direct RC
        method: 'DirectRC',
        note: 'Detailed class breakdown and hidden count require Python. Class names extracted from paths may be approximate.'
      };
    } catch (rcError: any) {
      this.log.debug('Direct RC count failed, falling back to Python:', rcError?.message);
      return this.countActorsViaPython();
    }
  }

  /**
   * Count actors with guaranteed detailed breakdown (always uses Python)
   */
  async countActorsDetailed(): Promise<CountResult> {
    return this.countActorsViaPython();
  }
}
