import { UnrealBridge } from '../unreal-bridge.js';
import { interpretStandardResult, coerceBoolean, coerceString } from '../utils/result-helpers.js';
import { escapePythonString } from '../utils/python.js';

/**
 * Phase 7.3: Rendering Settings Tool
 * 
 * Controls for Nanite, Lumen, Virtual Shadow Maps, and other UE5 rendering features.
 */
export class RenderingTools {
  constructor(private bridge: UnrealBridge) {}

  /**
   * Enable or disable Nanite on a static mesh
   */
  async setNaniteEnabled(params: { meshPath: string; enabled: boolean }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': ''}

mesh_path = r"${escapePythonString(params.meshPath)}"
enabled = ${params.enabled ? 'True' : 'False'}

try:
    mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
    if not mesh:
        result['error'] = f"Static mesh not found: {mesh_path}"
    elif not isinstance(mesh, unreal.StaticMesh):
        result['error'] = f"Asset is not a StaticMesh: {mesh_path}"
    else:
        # Nanite settings are in NaniteSettings
        nanite_settings = mesh.get_editor_property('nanite_settings')
        if nanite_settings:
            nanite_settings.set_editor_property('enabled', enabled)
            mesh.set_editor_property('nanite_settings', nanite_settings)
            unreal.EditorAssetLibrary.save_asset(mesh_path)
            result['success'] = True
            result['message'] = f"Nanite {'enabled' if enabled else 'disabled'} on {mesh_path}"
            result['naniteEnabled'] = enabled
        else:
            # Try alternative approach for older UE versions
            try:
                mesh.set_nanite_settings(unreal.MeshNaniteSettings(bEnabled=enabled))
                unreal.EditorAssetLibrary.save_asset(mesh_path)
                result['success'] = True
                result['message'] = f"Nanite {'enabled' if enabled else 'disabled'} on {mesh_path}"
                result['naniteEnabled'] = enabled
            except Exception as e2:
                result['error'] = f"Failed to set Nanite settings: {e2}"
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Nanite ${params.enabled ? 'enabled' : 'disabled'}`,
        failureMessage: 'Failed to set Nanite settings'
      });

      return {
        success: interpreted.success,
        naniteEnabled: params.enabled,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to set Nanite: ${err}` };
    }
  }

  /**
   * Get Nanite status for a mesh
   */
  async getNaniteStatus(params: { meshPath: string }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'naniteEnabled': False, 'triangleCount': 0}

mesh_path = r"${escapePythonString(params.meshPath)}"

try:
    mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
    if not mesh:
        result['error'] = f"Static mesh not found: {mesh_path}"
    elif not isinstance(mesh, unreal.StaticMesh):
        result['error'] = f"Asset is not a StaticMesh: {mesh_path}"
    else:
        nanite_settings = mesh.get_editor_property('nanite_settings')
        if nanite_settings:
            result['naniteEnabled'] = nanite_settings.get_editor_property('enabled')
        
        # Get triangle count if possible
        try:
            if mesh.get_num_lods() > 0:
                lod_info = mesh.get_editor_property('source_models')
                if lod_info and len(lod_info) > 0:
                    result['lodCount'] = len(lod_info)
        except:
            pass
            
        result['success'] = True
        result['message'] = f"Nanite is {'enabled' if result['naniteEnabled'] else 'disabled'} on {mesh_path}"
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Retrieved Nanite status',
        failureMessage: 'Failed to get Nanite status'
      });

      return {
        success: interpreted.success,
        naniteEnabled: coerceBoolean(interpreted.payload.naniteEnabled, false),
        lodCount: interpreted.payload.lodCount,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to get Nanite status: ${err}` };
    }
  }

  /**
   * Configure Lumen Global Illumination settings
   */
  async setLumenSettings(params: {
    method?: 'ScreenTraces' | 'HardwareRayTracing';
    quality?: 'Low' | 'Medium' | 'High' | 'Epic';
    finalGatherQuality?: number;
    reflectionsEnabled?: boolean;
    infiniteBounces?: boolean;
  }) {
    try {
      // Lumen is configured via console commands and project settings
      const commands: string[] = [];
      
      if (params.method) {
        const methodValue = params.method === 'HardwareRayTracing' ? 1 : 0;
        commands.push(`r.Lumen.HardwareRayTracing ${methodValue}`);
      }
      
      if (params.quality) {
        const qualityMap: Record<string, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Epic': 3 };
        commands.push(`r.Lumen.Quality ${qualityMap[params.quality] ?? 2}`);
      }
      
      if (params.finalGatherQuality !== undefined) {
        commands.push(`r.Lumen.FinalGatherQuality ${params.finalGatherQuality}`);
      }
      
      if (params.reflectionsEnabled !== undefined) {
        commands.push(`r.Lumen.Reflections.Allow ${params.reflectionsEnabled ? 1 : 0}`);
      }

      if (commands.length === 0) {
        return { success: false, error: 'No Lumen settings specified' };
      }

      // Execute all commands
      for (const cmd of commands) {
        await this.bridge.executeConsoleCommand(cmd);
      }

      return {
        success: true,
        message: `Lumen settings updated: ${commands.join(', ')}`,
        commandsExecuted: commands
      };
    } catch (err) {
      return { success: false, error: `Failed to set Lumen settings: ${err}` };
    }
  }

  /**
   * Get current Lumen configuration
   */
  async getLumenSettings() {
    try {
      // Use console variable queries instead of Python for reliability
      const commands = [
        'r.Lumen.Quality',
        'r.Lumen.HardwareRayTracing',
        'r.Lumen.Reflections.Allow'
      ];
      
      // Since we can't easily read console var values, just report what we know
      return {
        success: true,
        message: 'Lumen is configured via console commands. Use set_lumen to modify.',
        settings: {
          note: 'Use r.Lumen.Quality (0-3), r.Lumen.HardwareRayTracing (0/1), r.Lumen.Reflections.Allow (0/1)',
          qualityLevels: { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Epic' }
        }
      };
    } catch (err) {
      return { success: false, error: `Failed to get Lumen settings: ${err}` };
    }
  }

  /**
   * Configure Virtual Shadow Maps settings
   */
  async setVirtualShadowMaps(params: {
    enabled?: boolean;
    resolution?: 512 | 1024 | 2048 | 4096;
    pagePoolSize?: number;
  }) {
    try {
      const commands: string[] = [];
      
      if (params.enabled !== undefined) {
        commands.push(`r.Shadow.Virtual.Enable ${params.enabled ? 1 : 0}`);
      }
      
      if (params.resolution) {
        commands.push(`r.Shadow.Virtual.Resolution ${params.resolution}`);
      }
      
      if (params.pagePoolSize !== undefined) {
        commands.push(`r.Shadow.Virtual.MaxPhysicalPages ${params.pagePoolSize}`);
      }

      if (commands.length === 0) {
        return { success: false, error: 'No VSM settings specified' };
      }

      for (const cmd of commands) {
        await this.bridge.executeConsoleCommand(cmd);
      }

      return {
        success: true,
        message: `Virtual Shadow Maps settings updated`,
        commandsExecuted: commands
      };
    } catch (err) {
      return { success: false, error: `Failed to set VSM settings: ${err}` };
    }
  }

  /**
   * Set anti-aliasing method
   */
  async setAntiAliasing(params: {
    method: 'None' | 'FXAA' | 'TAA' | 'TSR' | 'MSAA';
    quality?: 0 | 1 | 2 | 3 | 4;
  }) {
    try {
      const methodMap: Record<string, number> = {
        'None': 0,
        'FXAA': 1,
        'TAA': 2,
        'TSR': 4,
        'MSAA': 3
      };

      const commands: string[] = [];
      commands.push(`r.AntiAliasingMethod ${methodMap[params.method] ?? 2}`);
      
      if (params.quality !== undefined) {
        commands.push(`r.PostProcessAAQuality ${params.quality}`);
      }

      for (const cmd of commands) {
        await this.bridge.executeConsoleCommand(cmd);
      }

      return {
        success: true,
        message: `Anti-aliasing set to ${params.method}`,
        method: params.method,
        quality: params.quality
      };
    } catch (err) {
      return { success: false, error: `Failed to set anti-aliasing: ${err}` };
    }
  }

  /**
   * Set screen percentage / resolution scale
   */
  async setScreenPercentage(params: { percentage: number }) {
    try {
      if (params.percentage < 10 || params.percentage > 200) {
        return { success: false, error: 'Screen percentage must be between 10 and 200' };
      }

      await this.bridge.executeConsoleCommand(`r.ScreenPercentage ${params.percentage}`);

      return {
        success: true,
        message: `Screen percentage set to ${params.percentage}%`,
        screenPercentage: params.percentage
      };
    } catch (err) {
      return { success: false, error: `Failed to set screen percentage: ${err}` };
    }
  }

  /**
   * Enable or disable ray tracing features
   */
  async setRayTracing(params: {
    globalIllumination?: boolean;
    reflections?: boolean;
    shadows?: boolean;
    ambientOcclusion?: boolean;
    translucency?: boolean;
  }) {
    try {
      const commands: string[] = [];
      
      if (params.globalIllumination !== undefined) {
        commands.push(`r.RayTracing.GlobalIllumination ${params.globalIllumination ? 1 : 0}`);
      }
      
      if (params.reflections !== undefined) {
        commands.push(`r.RayTracing.Reflections ${params.reflections ? 1 : 0}`);
      }
      
      if (params.shadows !== undefined) {
        commands.push(`r.RayTracing.Shadows ${params.shadows ? 1 : 0}`);
      }
      
      if (params.ambientOcclusion !== undefined) {
        commands.push(`r.RayTracing.AmbientOcclusion ${params.ambientOcclusion ? 1 : 0}`);
      }
      
      if (params.translucency !== undefined) {
        commands.push(`r.RayTracing.Translucency ${params.translucency ? 1 : 0}`);
      }

      if (commands.length === 0) {
        return { success: false, error: 'No ray tracing settings specified' };
      }

      for (const cmd of commands) {
        await this.bridge.executeConsoleCommand(cmd);
      }

      return {
        success: true,
        message: `Ray tracing settings updated`,
        commandsExecuted: commands,
        settings: params
      };
    } catch (err) {
      return { success: false, error: `Failed to set ray tracing: ${err}` };
    }
  }

  /**
   * Get current rendering stats/info
   */
  async getRenderingInfo() {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'info': {}}

try:
    # Get viewport info
    subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if subsystem:
        result['info']['activeViewport'] = True
    
    # Count post process volumes
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if actor_subsystem:
        actors = actor_subsystem.get_all_level_actors()
        ppv_count = sum(1 for a in actors if isinstance(a, unreal.PostProcessVolume))
        result['info']['postProcessVolumeCount'] = ppv_count
        
        # Check for global (unbound) PPV
        for a in actors:
            if isinstance(a, unreal.PostProcessVolume):
                if a.get_editor_property('unbound'):
                    result['info']['hasGlobalPostProcess'] = True
                    break
    
    result['info']['renderingCommands'] = {
        'lumen': 'r.Lumen.Quality (0-3)',
        'vsm': 'r.Shadow.Virtual.Enable (0/1)',
        'rayTracing': 'r.RayTracing.* commands',
        'antiAliasing': 'r.AntiAliasingMethod (0=None, 1=FXAA, 2=TAA, 4=TSR)'
    }
        
    result['success'] = True
    result['message'] = 'Retrieved rendering info'
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Retrieved rendering info',
        failureMessage: 'Failed to get rendering info'
      });

      return {
        success: interpreted.success,
        info: interpreted.payload.info || {},
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to get rendering info: ${err}` };
    }
  }

  /**
   * Set post process volume settings (exposure, bloom, etc.)
   */
  async setPostProcessSettings(params: {
    actorName?: string;  // If not provided, creates global settings
    autoExposure?: boolean;
    exposureCompensation?: number;
    bloomIntensity?: number;
    vignetteIntensity?: number;
    motionBlurAmount?: number;
    ambientOcclusionIntensity?: number;
  }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'settingsApplied': []}

actor_name = ${params.actorName ? `r"${escapePythonString(params.actorName)}"` : 'None'}

try:
    post_process = None
    
    if actor_name:
        # Find existing post process volume
        actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
        for actor in actors:
            if actor.get_actor_label() == actor_name:
                if isinstance(actor, unreal.PostProcessVolume):
                    post_process = actor
                    break
                else:
                    result['error'] = f"Actor '{actor_name}' is not a PostProcessVolume"
                    break
        
        if not post_process and not result['error']:
            result['error'] = f"PostProcessVolume not found: {actor_name}"
    else:
        # Create or find global post process
        actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
        for actor in actors:
            if isinstance(actor, unreal.PostProcessVolume):
                if actor.get_editor_property('unbound'):
                    post_process = actor
                    break
        
        if not post_process:
            # Spawn a new global post process volume
            actor_class = unreal.PostProcessVolume
            post_process = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(
                actor_class,
                unreal.Vector(0, 0, 0),
                unreal.Rotator(0, 0, 0)
            )
            if post_process:
                post_process.set_editor_property('unbound', True)
                post_process.set_editor_property('priority', 100)
                post_process.set_actor_label('GlobalPostProcess')
                result['settingsApplied'].append('Created global PostProcessVolume')
    
    if post_process:
        settings = post_process.get_editor_property('settings')
        
        ${params.autoExposure !== undefined ? `
        settings.set_editor_property('override_auto_exposure_method', True)
        settings.set_editor_property('auto_exposure_method', unreal.EAutoExposureMethod.AEM_MANUAL if not ${params.autoExposure} else unreal.EAutoExposureMethod.AEM_HISTOGRAM)
        result['settingsApplied'].append('autoExposure')
        ` : ''}
        
        ${params.exposureCompensation !== undefined ? `
        settings.set_editor_property('override_auto_exposure_bias', True)
        settings.set_editor_property('auto_exposure_bias', ${params.exposureCompensation})
        result['settingsApplied'].append('exposureCompensation')
        ` : ''}
        
        ${params.bloomIntensity !== undefined ? `
        settings.set_editor_property('override_bloom_intensity', True)
        settings.set_editor_property('bloom_intensity', ${params.bloomIntensity})
        result['settingsApplied'].append('bloomIntensity')
        ` : ''}
        
        ${params.vignetteIntensity !== undefined ? `
        settings.set_editor_property('override_vignette_intensity', True)
        settings.set_editor_property('vignette_intensity', ${params.vignetteIntensity})
        result['settingsApplied'].append('vignetteIntensity')
        ` : ''}
        
        ${params.motionBlurAmount !== undefined ? `
        settings.set_editor_property('override_motion_blur_amount', True)
        settings.set_editor_property('motion_blur_amount', ${params.motionBlurAmount})
        result['settingsApplied'].append('motionBlurAmount')
        ` : ''}
        
        ${params.ambientOcclusionIntensity !== undefined ? `
        settings.set_editor_property('override_ambient_occlusion_intensity', True)
        settings.set_editor_property('ambient_occlusion_intensity', ${params.ambientOcclusionIntensity})
        result['settingsApplied'].append('ambientOcclusionIntensity')
        ` : ''}
        
        post_process.set_editor_property('settings', settings)
        result['success'] = True
        result['message'] = f"Post process settings updated on {post_process.get_actor_label()}"
        result['actorName'] = post_process.get_actor_label()
        
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Post process settings updated',
        failureMessage: 'Failed to set post process settings'
      });

      return {
        success: interpreted.success,
        actorName: coerceString(interpreted.payload.actorName),
        settingsApplied: interpreted.payload.settingsApplied || [],
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to set post process settings: ${err}` };
    }
  }
}
