/**
 * Selection Management Tools for UE MCP Extended
 * Provides actor selection control in the editor
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { Logger } from '../utils/logger.js';

export interface SelectionResult {
  success: boolean;
  selectedCount: number;
  selectedActors: string[];
  message?: string;
  error?: string;
  method?: 'DirectRC' | 'Python';
}

export class ManageSelectionTools {
  private log = new Logger('ManageSelectionTools');

  constructor(private bridge: UnrealBridge) {}

  // Threshold for using Direct RC vs Python for selection
  private static readonly DIRECT_RC_SELECTION_THRESHOLD = 10;
  // Max actors to scan via Direct RC before falling back to Python
  private static readonly DIRECT_RC_MAX_SCAN_ACTORS = 50;

  /**
   * Select actors by name or path
   * Uses Direct RC API for small selections (< 10 actors), Python for larger ones
   */
  async selectActors(params: {
    actorNames?: string[];
    actorPaths?: string[];
    additive?: boolean; // Add to existing selection
  }): Promise<SelectionResult> {
    const actorNames = params.actorNames || [];
    const actorPaths = params.actorPaths || [];
    const additive = params.additive ?? false;

    if (actorNames.length === 0 && actorPaths.length === 0) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: 'Must provide actorNames or actorPaths'
      };
    }

    const totalRequested = actorNames.length + actorPaths.length;
    
    // For small selections with paths provided, try Direct RC first
    if (actorPaths.length > 0 && actorPaths.length <= ManageSelectionTools.DIRECT_RC_SELECTION_THRESHOLD && actorNames.length === 0) {
      try {
        return await this.selectActorsViaDirectRC(actorPaths, additive);
      } catch (directRcError: any) {
        this.log.debug('selectActors: Direct RC failed, falling back to Python', directRcError?.message);
      }
    }
    
    // For name-based selection or larger selections, we need to resolve names to paths first
    // This requires getting all actors, which is more efficient via Python in one call
    if (actorNames.length > 0 && totalRequested <= ManageSelectionTools.DIRECT_RC_SELECTION_THRESHOLD) {
      try {
        return await this.selectActorsByNameViaDirectRC(actorNames, actorPaths, additive);
      } catch (directRcError: any) {
        this.log.debug('selectActors: Direct RC name resolution failed, falling back to Python', directRcError?.message);
      }
    }

    // Fall back to Python for larger selections or if Direct RC failed
    return this.selectActorsViaPython(actorNames, actorPaths, additive);
  }

  /**
   * Select actors by path using Direct RC API
   */
  private async selectActorsViaDirectRC(actorPaths: string[], additive: boolean): Promise<SelectionResult> {
    // If not additive, clear selection first
    if (!additive) {
      await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'ClearActorSelectionSet',
        parameters: {}
      });
    }

    const selectedActors: string[] = [];
    
    // Select each actor individually via SetActorSelectionState
    for (const actorPath of actorPaths) {
      try {
        await this.bridge.call({
          objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
          functionName: 'SetActorSelectionState',
          parameters: {
            Actor: actorPath,
            bShouldBeSelected: true
          }
        });
        // Extract name from path for reporting
        const parts = actorPath.split('.');
        selectedActors.push(parts[parts.length - 1] || actorPath);
      } catch (err: any) {
        this.log.debug(`Failed to select actor ${actorPath}:`, err?.message);
      }
    }

    this.log.debug(`selectActors: succeeded via Direct RC, selected ${selectedActors.length} actors`);
    
    // Add warning if no actors were selected but some were requested
    const requestedCount = actorPaths.length;
    const warning = selectedActors.length === 0 && requestedCount > 0
      ? `Warning: None of the ${requestedCount} requested actors were found`
      : undefined;
    
    return {
      success: true, // Operation succeeded even if 0 matched
      selectedCount: selectedActors.length,
      selectedActors,
      message: warning || `Selected ${selectedActors.length} actors${additive ? ' (additive)' : ''}`,
      method: 'DirectRC'
    };
  }

  /**
   * Select actors by name using Direct RC API
   * First resolves names to paths by fetching actor labels
   * Note: This is slower than Python for many actors since we need individual GetActorLabel calls
   * Falls back to Python if there are too many actors to scan
   */
  private async selectActorsByNameViaDirectRC(
    actorNames: string[],
    actorPaths: string[],
    additive: boolean
  ): Promise<SelectionResult> {
    // Get all actors to resolve names to paths
    const allActorsResult = await this.bridge.call({
      objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
      functionName: 'GetAllLevelActors',
      parameters: {}
    });

    const allActorPaths: string[] = allActorsResult?.ReturnValue || [];
    
    // If too many actors in level, fall back to Python (more efficient for batch operations)
    if (allActorPaths.length > ManageSelectionTools.DIRECT_RC_MAX_SCAN_ACTORS) {
      this.log.debug(`selectActorsByNameViaDirectRC: ${allActorPaths.length} actors in level exceeds threshold, falling back to Python`);
      throw new Error('Too many actors to scan via Direct RC');
    }
    
    // Build a map of name -> path for quick lookup
    const targetNamesLower = new Set(actorNames.map(n => n.toLowerCase()));
    const targetPathsSet = new Set(actorPaths);
    const resolvedPaths: string[] = [...actorPaths];
    const targetCount = targetNamesLower.size;
    let matchedCount = 0;
    
    // For each actor path, get the actor label and check if it matches
    for (const path of allActorPaths) {
      if (targetPathsSet.has(path)) continue; // Already included
      
      // Early exit if we've found all requested actors
      if (matchedCount >= targetCount) break;
      
      try {
        // Get actor label (what user sees in editor) - this is different from internal name
        const labelResult = await this.bridge.call({
          objectPath: path,
          functionName: 'GetActorLabel',
          parameters: {}
        });
        
        const actorLabel = labelResult?.ReturnValue || '';
        
        if (targetNamesLower.has(actorLabel.toLowerCase())) {
          resolvedPaths.push(path);
          matchedCount++;
          this.log.debug(`Matched actor label "${actorLabel}" to path: ${path}`);
        }
      } catch (err: any) {
        // Skip actors that don't support GetActorLabel
        this.log.debug(`Failed to get label for ${path}:`, err?.message);
      }
    }

    if (resolvedPaths.length === 0) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: 'No matching actors found',
        method: 'DirectRC'
      };
    }

    // Now select the resolved paths
    return this.selectActorsViaDirectRC(resolvedPaths, additive);
  }

  /**
   * Select actors via Python (fallback for large selections or complex matching)
   */
  private async selectActorsViaPython(
    actorNames: string[],
    actorPaths: string[],
    additive: boolean
  ): Promise<SelectionResult> {
    // Escape strings for Python
    const escapeForPython = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const namesJson = JSON.stringify(actorNames.map(escapeForPython));
    const pathsJson = JSON.stringify(actorPaths.map(escapeForPython));

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_names = set(n.lower() for n in ${namesJson})
    target_paths = set(${pathsJson})
    additive = ${additive ? 'True' : 'False'}
    
    # Get current selection if additive
    actors_to_select = []
    if additive:
        actors_to_select = list(subsystem.get_selected_level_actors())
    
    # Find matching actors
    matched_names = []
    for actor in all_actors:
        try:
            actor_name = actor.get_name().lower()
            actor_label = actor.get_actor_label().lower()
            actor_path = actor.get_path_name()
            
            if actor_name in target_names or actor_label in target_names or actor_path in target_paths:
                if actor not in actors_to_select:
                    actors_to_select.append(actor)
                    matched_names.append(actor.get_actor_label())
        except:
            pass
    
    # Set selection
    subsystem.set_selected_level_actors(actors_to_select)
    
    # Get final selection
    final_selection = subsystem.get_selected_level_actors()
    selected_names = [a.get_actor_label() for a in final_selection]
    
    requested_count = len(target_names) + len(target_paths)
    warning = f'Warning: None of the {requested_count} requested actors were found' if len(matched_names) == 0 and requested_count > 0 else None
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': len(final_selection),
        'selectedActors': selected_names,
        'message': warning or (f'Selected {len(matched_names)} actors' + (' (additive)' if additive else ''))
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        message: response?.message,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  /**
   * Deselect specific actors
   * Note: Uses Python as it requires complex matching logic
   */
  async deselectActors(params: {
    actorNames?: string[];
    actorPaths?: string[];
  }): Promise<SelectionResult> {
    const actorNames = params.actorNames || [];
    const actorPaths = params.actorPaths || [];

    if (actorNames.length === 0 && actorPaths.length === 0) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: 'Must provide actorNames or actorPaths to deselect'
      };
    }

    // For small path-based deselections, try Direct RC
    if (actorPaths.length > 0 && actorPaths.length <= ManageSelectionTools.DIRECT_RC_SELECTION_THRESHOLD && actorNames.length === 0) {
      try {
        return await this.deselectActorsViaDirectRC(actorPaths);
      } catch (directRcError: any) {
        this.log.debug('deselectActors: Direct RC failed, falling back to Python', directRcError?.message);
      }
    }

    return this.deselectActorsViaPython(actorNames, actorPaths);
  }

  /**
   * Deselect actors by path using Direct RC API
   */
  private async deselectActorsViaDirectRC(actorPaths: string[]): Promise<SelectionResult> {
    const deselectedActors: string[] = [];
    
    for (const actorPath of actorPaths) {
      try {
        await this.bridge.call({
          objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
          functionName: 'SetActorSelectionState',
          parameters: {
            Actor: actorPath,
            bShouldBeSelected: false
          }
        });
        const parts = actorPath.split('.');
        deselectedActors.push(parts[parts.length - 1] || actorPath);
      } catch (err: any) {
        this.log.debug(`Failed to deselect actor ${actorPath}:`, err?.message);
      }
    }

    // Get current selection to report
    const selectionResult = await this.getSelection();
    
    this.log.debug(`deselectActors: succeeded via Direct RC, deselected ${deselectedActors.length} actors`);
    return {
      success: deselectedActors.length > 0,
      selectedCount: selectionResult.selectedCount,
      selectedActors: selectionResult.selectedActors,
      message: `Deselected ${deselectedActors.length} actors`,
      method: 'DirectRC'
    };
  }

  /**
   * Deselect actors via Python (fallback)
   */
  private async deselectActorsViaPython(actorNames: string[], actorPaths: string[]): Promise<SelectionResult> {
    const escapeForPython = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const namesJson = JSON.stringify(actorNames.map(escapeForPython));
    const pathsJson = JSON.stringify(actorPaths.map(escapeForPython));

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    
    target_names = set(n.lower() for n in ${namesJson})
    target_paths = set(${pathsJson})
    
    # Get current selection
    current_selection = list(subsystem.get_selected_level_actors())
    
    # Filter out actors to deselect
    new_selection = []
    deselected = []
    for actor in current_selection:
        try:
            actor_name = actor.get_name().lower()
            actor_label = actor.get_actor_label().lower()
            actor_path = actor.get_path_name()
            
            if actor_name in target_names or actor_label in target_names or actor_path in target_paths:
                deselected.append(actor.get_actor_label())
            else:
                new_selection.append(actor)
        except:
            new_selection.append(actor)
    
    # Set new selection
    subsystem.set_selected_level_actors(new_selection)
    
    selected_names = [a.get_actor_label() for a in new_selection]
    
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': len(new_selection),
        'selectedActors': selected_names,
        'message': f'Deselected {len(deselected)} actors'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        message: response?.message,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  /**
   * Clear all selection
   * Uses Direct RC API first, falls back to Python
   */
  async clearSelection(): Promise<SelectionResult> {
    // Try Direct RC first
    try {
      await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'ClearActorSelectionSet',
        parameters: {}
      });
      
      this.log.debug('clearSelection: succeeded via Direct RC');
      return {
        success: true,
        selectedCount: 0,
        selectedActors: [],
        message: 'Selection cleared',
        method: 'DirectRC'
      };
    } catch (directRcError: any) {
      this.log.debug('clearSelection: Direct RC failed, falling back to Python', directRcError?.message);
      return this.clearSelectionViaPython();
    }
  }

  /**
   * Clear selection via Python (fallback)
   */
  private async clearSelectionViaPython(): Promise<SelectionResult> {
    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    
    # Get count before clearing
    prev_count = len(subsystem.get_selected_level_actors())
    
    # Clear selection
    subsystem.select_nothing()
    
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': 0,
        'selectedActors': [],
        'message': f'Cleared selection ({prev_count} actors were selected)'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        message: response?.message,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  /**
   * Select all actors of a specific class
   * Note: Uses Python as it requires class filtering logic
   */
  async selectAllOfClass(className: string, additive: boolean = false): Promise<SelectionResult> {
    const safeClassName = className.replace(/'/g, "\\'").replace(/"/g, '\\"');

    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    
    target_class = '${safeClassName}'.lower()
    additive = ${additive ? 'True' : 'False'}
    
    # Get current selection if additive
    actors_to_select = []
    if additive:
        actors_to_select = list(subsystem.get_selected_level_actors())
    
    # Find matching actors
    for actor in all_actors:
        try:
            actor_class = actor.get_class().get_name().lower()
            if target_class in actor_class or actor_class in target_class:
                if actor not in actors_to_select:
                    actors_to_select.append(actor)
        except:
            pass
    
    # Set selection
    subsystem.set_selected_level_actors(actors_to_select)
    
    selected_names = [a.get_actor_label() for a in actors_to_select]
    
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': len(actors_to_select),
        'selectedActors': selected_names,
        'message': f'Selected {len(actors_to_select)} actors of class {target_class}'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        message: response?.message,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  /**
   * Invert current selection
   * Note: Uses Python as it requires iteration over all actors
   */
  async invertSelection(): Promise<SelectionResult> {
    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    all_actors = subsystem.get_all_level_actors()
    selected = set(subsystem.get_selected_level_actors())
    
    # Invert: select all that weren't selected
    new_selection = [a for a in all_actors if a not in selected]
    
    subsystem.set_selected_level_actors(new_selection)
    
    selected_names = [a.get_actor_label() for a in new_selection]
    
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': len(new_selection),
        'selectedActors': selected_names[:100],  # Limit to first 100 for response size
        'message': f'Inverted selection: {len(new_selection)} actors now selected'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        message: response?.message,
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }

  /**
   * Get current selection (convenience method)
   * Uses Direct RC API first, falls back to Python
   */
  async getSelection(): Promise<SelectionResult> {
    // Try Direct RC first
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorActorSubsystem',
        functionName: 'GetSelectedLevelActors',
        parameters: {}
      });
      
      // ReturnValue is an array of actor object paths
      const paths: string[] = result?.ReturnValue || [];
      // Extract actor names from paths (last segment after '.')
      const names = paths.map((p: string) => {
        const parts = p.split('.');
        return parts[parts.length - 1] || p;
      });
      
      this.log.debug(`getSelection: succeeded via Direct RC, found ${paths.length} actors`);
      return {
        success: true,
        selectedCount: paths.length,
        selectedActors: names,
        method: 'DirectRC'
      };
    } catch (directRcError: any) {
      this.log.debug('getSelection: Direct RC failed, falling back to Python', directRcError?.message);
      return this.getSelectionViaPython();
    }
  }

  /**
   * Get selection via Python (fallback)
   */
  private async getSelectionViaPython(): Promise<SelectionResult> {
    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    selected = subsystem.get_selected_level_actors()
    
    selected_names = [a.get_actor_label() for a in selected]
    
    print('RESULT:' + json.dumps({
        'success': True,
        'selectedCount': len(selected),
        'selectedActors': selected_names
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'selectedCount': 0,
        'selectedActors': [],
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        selectedCount: response?.selectedCount || 0,
        selectedActors: response?.selectedActors || [],
        error: response?.error,
        method: 'Python'
      };
    } catch (err: any) {
      return {
        success: false,
        selectedCount: 0,
        selectedActors: [],
        error: err?.message || String(err),
        method: 'Python'
      };
    }
  }
}
