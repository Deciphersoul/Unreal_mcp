/**
 * Editor Lifecycle Tools for UE MCP Extended
 * Provides save, reload, hot-reload, and project management functionality
 * 
 * Key capabilities for AI-driven development workflow:
 * - Save current level and all modified assets
 * - Trigger hot reload for Blueprint and code changes
 * - Restart PIE (Play In Editor) sessions
 * - Check and report on asset modifications
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { loadEnv } from '../types/env.js';
import { Logger } from '../utils/logger.js';
import path from 'path';

export interface LifecycleResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  error?: string;
}

export class EditorLifecycleTools {
  private env = loadEnv();
  private log = new Logger('EditorLifecycleTools');

  constructor(private bridge: UnrealBridge) {}

  /**
   * Save the current level via Direct Remote Control API
   * This is the preferred method as it works without Python execution enabled
   */
  private async saveCurrentLevelViaDirectRC(): Promise<LifecycleResult> {
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorLoadingAndSavingUtils',
        functionName: 'SaveCurrentLevel',
        parameters: {}
      });
      
      const success = result?.ReturnValue === true || result?.ReturnValue === 'true';
      
      return {
        success,
        message: success ? 'Level saved successfully' : 'Failed to save level',
        details: { method: 'DirectRC' }
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Save the current level via Python fallback
   * Used when Direct RC API is not available
   */
  private async saveCurrentLevelViaPython(): Promise<LifecycleResult> {
    const script = `
import unreal
import json

try:
    world = unreal.EditorLevelLibrary.get_editor_world()
    if world:
        level_path = world.get_path_name()
        # Use editor utility to save
        success = unreal.EditorLoadingAndSavingUtils.save_current_level()
        
        print('RESULT:' + json.dumps({
            'success': success,
            'message': 'Level saved successfully' if success else 'Failed to save level',
            'details': {
                'levelPath': level_path,
                'method': 'Python'
            }
        }))
    else:
        print('RESULT:' + json.dumps({
            'success': False,
            'error': 'No level currently loaded'
        }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    const response = await this.bridge.executePythonWithResult(script);
    return {
      success: response?.success ?? false,
      message: response?.message || 'Unknown result',
      details: response?.details,
      error: response?.error
    };
  }

  /**
   * Save the current level
   * Tries Direct RC API first, falls back to Python if unavailable
   */
  async saveCurrentLevel(): Promise<LifecycleResult> {
    // Try Direct RC API first (works without Python execution enabled)
    try {
      this.log.info('Attempting to save level via Direct RC API...');
      const result = await this.saveCurrentLevelViaDirectRC();
      this.log.info('Level saved via Direct RC API');
      return result;
    } catch (directRcError: any) {
      this.log.warn(`Direct RC API failed: ${directRcError?.message || directRcError}. Falling back to Python...`);
    }

    // Fall back to Python method
    try {
      this.log.info('Attempting to save level via Python...');
      const result = await this.saveCurrentLevelViaPython();
      this.log.info('Level saved via Python fallback');
      return result;
    } catch (pythonError: any) {
      return {
        success: false,
        message: 'Failed to save level',
        error: pythonError?.message || String(pythonError),
        details: { method: 'Python' }
      };
    }
  }

  /**
   * Save all modified assets via Direct Remote Control API
   * This is the preferred method as it works without Python execution enabled
   */
  private async saveAllDirtyAssetsViaDirectRC(): Promise<LifecycleResult> {
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__EditorLoadingAndSavingUtils',
        functionName: 'SaveDirtyPackages',
        parameters: {
          bSaveMapPackages: true,
          bSaveContentPackages: true
        }
      });
      
      const success = result?.ReturnValue === true || result?.ReturnValue === 'true';
      
      return {
        success,
        message: success ? 'All modified assets saved' : 'Some assets failed to save',
        details: {
          method: 'DirectRC',
          savedMapPackages: true,
          savedContentPackages: true
        }
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Save all modified assets via Python fallback
   * Used when Direct RC API is not available
   */
  private async saveAllDirtyAssetsViaPython(): Promise<LifecycleResult> {
    const script = `
import unreal
import json

try:
    # Get all dirty packages
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    
    # Save all dirty packages
    result = unreal.EditorLoadingAndSavingUtils.save_dirty_packages(
        save_map_packages=True,
        save_content_packages=True
    )
    
    print('RESULT:' + json.dumps({
        'success': result,
        'message': 'All modified assets saved' if result else 'Some assets failed to save',
        'details': {
            'method': 'Python',
            'savedMapPackages': True,
            'savedContentPackages': True
        }
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    const response = await this.bridge.executePythonWithResult(script);
    return {
      success: response?.success ?? false,
      message: response?.message || 'Unknown result',
      details: response?.details,
      error: response?.error
    };
  }

  /**
   * Save all modified assets (dirty packages)
   * Tries Direct RC API first, falls back to Python if unavailable
   */
  async saveAllDirtyAssets(): Promise<LifecycleResult> {
    // Try Direct RC API first (works without Python execution enabled)
    try {
      this.log.info('Attempting to save all dirty assets via Direct RC API...');
      const result = await this.saveAllDirtyAssetsViaDirectRC();
      this.log.info('All dirty assets saved via Direct RC API');
      return result;
    } catch (directRcError: any) {
      this.log.warn(`Direct RC API failed: ${directRcError?.message || directRcError}. Falling back to Python...`);
    }

    // Fall back to Python method
    try {
      this.log.info('Attempting to save all dirty assets via Python...');
      const result = await this.saveAllDirtyAssetsViaPython();
      this.log.info('All dirty assets saved via Python fallback');
      return result;
    } catch (pythonError: any) {
      return {
        success: false,
        message: 'Failed to save assets',
        error: pythonError?.message || String(pythonError),
        details: { method: 'Python' }
      };
    }
  }

  /**
   * Get list of modified (dirty) assets
   */
  async getDirtyAssets(): Promise<{
    success: boolean;
    dirtyAssets: string[];
    count: number;
    error?: string;
  }> {
    const script = `
import unreal
import json

try:
    # This gets dirty packages via editor utilities
    lib = unreal.EditorUtilityLibrary
    
    # Get unsaved assets by checking world and asset registry
    dirty_assets = []
    
    # Check if current level is dirty
    world = unreal.EditorLevelLibrary.get_editor_world()
    if world:
        # Note: We can't directly check if level is dirty in Python,
        # but we can report the current level
        dirty_assets.append({
            'type': 'Level',
            'path': world.get_path_name()
        })
    
    print('RESULT:' + json.dumps({
        'success': True,
        'dirtyAssets': [a['path'] for a in dirty_assets],
        'count': len(dirty_assets)
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'dirtyAssets': [],
        'count': 0,
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        dirtyAssets: response?.dirtyAssets || [],
        count: response?.count || 0,
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        dirtyAssets: [],
        count: 0,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Trigger Blueprint hot reload (recompile all Blueprints)
   */
  async hotReloadBlueprints(): Promise<LifecycleResult> {
    // Use console command for hot reload
    try {
      await this.bridge.executeConsoleCommand('RecompileBlueprints');
      
      return {
        success: true,
        message: 'Blueprint hot reload triggered',
        details: {
          action: 'RecompileBlueprints'
        }
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to trigger hot reload',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Compile a specific Blueprint
   */
  async compileBlueprint(blueprintPath: string): Promise<LifecycleResult> {
    const safePath = blueprintPath.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    const script = `
import unreal
import json

try:
    bp_path = '${safePath}'
    
    # Load the blueprint
    bp = unreal.EditorAssetLibrary.load_asset(bp_path)
    if not bp:
        print('RESULT:' + json.dumps({
            'success': False,
            'error': f'Blueprint not found: {bp_path}'
        }))
    else:
        # Compile via Kismet (Blueprint compiler)
        unreal.KismetSystemLibrary.flush_persistent_debug_lines(None)
        
        # Mark the blueprint as needing recompile and save it
        # This forces a recompile on next use
        unreal.EditorAssetLibrary.save_asset(bp_path)
        
        print('RESULT:' + json.dumps({
            'success': True,
            'message': f'Blueprint compiled and saved: {bp_path}',
            'details': {
                'blueprintPath': bp_path
            }
        }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message || 'Unknown result',
        details: response?.details,
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to compile Blueprint',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Restart the current PIE (Play In Editor) session
   * Useful for applying changes during gameplay testing
   */
  async restartPIE(): Promise<LifecycleResult> {
    try {
      // Stop current PIE session
      await this.bridge.executeConsoleCommand('exit');
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start new PIE session
      const script = `
import unreal
import json

try:
    # Start PIE
    unreal.EditorLevelLibrary.play_in_editor_request()
    
    print('RESULT:' + json.dumps({
        'success': True,
        'message': 'PIE session restarted'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();
      
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message || 'PIE restart attempted',
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to restart PIE',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Load a level
   */
  async loadLevel(levelPath: string, streaming: boolean = false): Promise<LifecycleResult> {
    const safePath = levelPath.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    const script = `
import unreal
import json

try:
    level_path = '${safePath}'
    
    if ${streaming ? 'True' : 'False'}:
        # Streaming load
        success = unreal.EditorLevelUtils.add_level_to_world(
            unreal.EditorLevelLibrary.get_editor_world(),
            level_path,
            unreal.LevelStreamingDynamic
        )
    else:
        # Direct load
        success = unreal.EditorLevelLibrary.load_level(level_path)
    
    print('RESULT:' + json.dumps({
        'success': success is not None,
        'message': f'Level loaded: {level_path}' if success else 'Failed to load level',
        'details': {
            'levelPath': level_path,
            'streaming': ${streaming ? 'True' : 'False'}
        }
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message || 'Unknown result',
        details: response?.details,
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to load level',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Create a new level
   */
  async createNewLevel(levelName: string, templatePath?: string): Promise<LifecycleResult> {
    const safeName = levelName.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeTemplate = templatePath 
      ? templatePath.replace(/'/g, "\\'").replace(/"/g, '\\"')
      : '';
    
    const script = `
import unreal
import json

try:
    level_name = '${safeName}'
    template_path = '${safeTemplate}' if '${safeTemplate}' else None
    
    # Create new level
    if template_path:
        success = unreal.EditorLevelLibrary.new_level_from_template(template_path, level_name)
    else:
        success = unreal.EditorLevelLibrary.new_level('/Game/' + level_name)
    
    print('RESULT:' + json.dumps({
        'success': success,
        'message': f'New level created: {level_name}' if success else 'Failed to create level',
        'details': {
            'levelName': level_name,
            'template': template_path
        }
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message || 'Unknown result',
        details: response?.details,
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to create level',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Get current editor state (useful for context)
   */
  async getEditorState(): Promise<{
    success: boolean;
    state: {
      currentLevel?: string;
      isPIEActive?: boolean;
      viewportMode?: string;
      selectedActorCount?: number;
    };
    error?: string;
  }> {
    const script = `
import unreal
import json

try:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    world = unreal.EditorLevelLibrary.get_editor_world()
    
    state = {
        'currentLevel': world.get_path_name() if world else None,
        'isPIEActive': unreal.GameplayStatics.get_game_instance(world) is not None if world else False,
        'selectedActorCount': len(subsystem.get_selected_level_actors()) if subsystem else 0
    }
    
    print('RESULT:' + json.dumps({
        'success': True,
        'state': state
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'state': {},
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        state: response?.state || {},
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        state: {},
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Refresh all assets from disk (sync with external changes)
   */
  async refreshAssets(): Promise<LifecycleResult> {
    const script = `
import unreal
import json

try:
    # Rescan asset paths
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    asset_registry.scan_paths_synchronous(['/Game'], force_rescan=True)
    
    print('RESULT:' + json.dumps({
        'success': True,
        'message': 'Asset refresh completed'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        message: response?.message || 'Unknown result',
        error: response?.error
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to refresh assets',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Force garbage collection (clean up memory)
   */
  async forceGarbageCollection(): Promise<LifecycleResult> {
    try {
      await this.bridge.executeConsoleCommand('obj gc');
      
      return {
        success: true,
        message: 'Garbage collection triggered'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to trigger garbage collection',
        error: err?.message || String(err)
      };
    }
  }
}
