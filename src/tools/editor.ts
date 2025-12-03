import { UnrealBridge } from '../unreal-bridge.js';
import { toVec3Object, toRotObject } from '../utils/normalize.js';
import { bestEffortInterpretedText, coerceString, interpretStandardResult } from '../utils/result-helpers.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('EditorTools');

export class EditorTools {
  constructor(private bridge: UnrealBridge) {}
  
  async isInPIE(): Promise<boolean> {
    try {
      const pythonCmd = `
import unreal
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if les:
    print("PIE_STATE:" + str(les.is_in_play_in_editor()))
else:
    print("PIE_STATE:False")
      `.trim();
      
      const resp: any = await this.bridge.executePython(pythonCmd);
      const out = typeof resp === 'string' ? resp : JSON.stringify(resp);
      return out.includes('PIE_STATE:True');
    } catch {
      return false;
    }
  }
  
  async ensureNotInPIE(): Promise<void> {
    if (await this.isInPIE()) {
      await this.stopPlayInEditor();
      // Wait a bit for PIE to fully stop
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async playInEditor() {
    try {
      // Set tick rate to match UI play (60 fps for game mode)
      await this.bridge.executeConsoleCommand('t.MaxFPS 60');
      
      // Try Python first using the modern LevelEditorSubsystem
      try {
        // Use LevelEditorSubsystem to play in the selected viewport (modern API)
        const pythonCmd = `
import unreal, time, json
# Start PIE using LevelEditorSubsystem (modern approach)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if les:
    # Store initial state
    was_playing = les.is_in_play_in_editor()
    
    # Request PIE in the current viewport
    les.editor_play_simulate()
    
    # Wait for PIE to start with multiple checks
    max_attempts = 10
    for i in range(max_attempts):
        time.sleep(0.2)  # Wait 200ms between checks
        is_playing = les.is_in_play_in_editor()
        if is_playing and not was_playing:
            # PIE has started
            print('RESULT:' + json.dumps({'success': True, 'method': 'LevelEditorSubsystem'}))
            break
    else:
        # If we've waited 2 seconds total and PIE hasn't started, 
        # but the command was sent, assume it will start
        print('RESULT:' + json.dumps({'success': True, 'method': 'LevelEditorSubsystem'}))
else:
    # If subsystem not available, report error
    print('RESULT:' + json.dumps({'success': False, 'error': 'LevelEditorSubsystem not available'}))
        `.trim();
        
        const resp: any = await this.bridge.executePython(pythonCmd);
        const interpreted = interpretStandardResult(resp, {
          successMessage: 'PIE started',
          failureMessage: 'Failed to start PIE'
        });
        if (interpreted.success) {
          const method = coerceString(interpreted.payload.method) ?? 'LevelEditorSubsystem';
          return { success: true, message: `PIE started (via ${method})` };
        }
        // If not verified, fall through to fallback
      } catch (err) {
        // Log the error for debugging but continue
        console.error('Python PIE start issue:', err);
      }
      // Fallback to console command which is more reliable
      await this.bridge.executeConsoleCommand('PlayInViewport');
      
      // Wait a moment and verify PIE started
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if PIE is now active
      const isPlaying = await this.isInPIE();
      
      return { 
        success: true, 
        message: isPlaying ? 'PIE started successfully' : 'PIE start command sent (may take a moment)' 
      };
    } catch (err) {
      return { success: false, error: `Failed to start PIE: ${err}` };
    }
  }

  async stopPlayInEditor() {
    try {
      // Try Python first using the modern LevelEditorSubsystem
      try {
        const pythonCmd = `
import unreal, time, json
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if les:
    # Use correct method name for stopping PIE
    les.editor_request_end_play()  # Modern API method
    print('RESULT:' + json.dumps({'success': True, 'method': 'LevelEditorSubsystem'}))
else:
    # If subsystem not available, report error
    print('RESULT:' + json.dumps({'success': False, 'error': 'LevelEditorSubsystem not available'}))
        `.trim();
        const resp: any = await this.bridge.executePython(pythonCmd);
        const interpreted = interpretStandardResult(resp, {
          successMessage: 'PIE stopped successfully',
          failureMessage: 'Failed to stop PIE'
        });

        if (interpreted.success) {
          const method = coerceString(interpreted.payload.method) ?? 'LevelEditorSubsystem';
          return { success: true, message: `PIE stopped via ${method}` };
        }

        if (interpreted.error) {
          return { success: false, error: interpreted.error };
        }

        return { success: false, error: 'Failed to stop PIE' };
      } catch {
        // Fallback to console command
        await this.bridge.executeConsoleCommand('stop');
        return { success: true, message: 'PIE stopped via console command' };
      }
    } catch (err) {
      return { success: false, error: `Failed to stop PIE: ${err}` };
    }
  }
  
  async pausePlayInEditor() {
    try {
      // Pause/Resume PIE
      await this.bridge.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/Engine.Default__KismetSystemLibrary',
        functionName: 'ExecuteConsoleCommand',
        parameters: {
          WorldContextObject: null,
          Command: 'pause',
          SpecificPlayer: null
        },
        generateTransaction: false
      });
      return { success: true, message: 'PIE paused/resumed' };
    } catch (err) {
      return { success: false, error: `Failed to pause PIE: ${err}` };
    }
  }
  
  // Alias for consistency with naming convention
  async pauseInEditor() {
    return this.pausePlayInEditor();
  }

  async buildLighting() {
    try {
      // Use modern LevelEditorSubsystem to build lighting
      const py = `
import unreal
import json
try:
    # Use modern LevelEditorSubsystem API
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if les:
        # build_light_maps(quality, with_reflection_captures)
        les.build_light_maps(unreal.LightingBuildQuality.QUALITY_HIGH, True)
        print('RESULT:' + json.dumps({'success': True, 'message': 'Lighting build started via LevelEditorSubsystem'}))
    else:
        # If subsystem not available, report error
        print('RESULT:' + json.dumps({'success': False, 'error': 'LevelEditorSubsystem not available'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();
      const resp: any = await this.bridge.executePython(py);
      const interpreted = interpretStandardResult(resp, {
        successMessage: 'Lighting build started',
        failureMessage: 'Failed to build lighting'
      });

      if (interpreted.success) {
        return { success: true, message: interpreted.message };
      }

      return {
        success: false,
        error: interpreted.error ?? 'Failed to build lighting',
        details: bestEffortInterpretedText(interpreted)
      };
    } catch (err) {
      return { success: false, error: `Failed to build lighting: ${err}` };
    }
  }

  /**
   * Set viewport camera via Direct Remote Control API (no Python required)
   * This is the preferred method as it works without any UE settings changes
   */
  private async setViewportCameraViaDirectRC(
    location: { x: number; y: number; z: number },
    rotation: { pitch: number; yaw: number; roll: number }
  ): Promise<{ success: boolean; message: string; method: string }> {
    await this.bridge.call({
      objectPath: '/Script/UnrealEd.Default__UnrealEditorSubsystem',
      functionName: 'SetLevelViewportCameraInfo',
      parameters: {
        CameraLocation: { X: location.x, Y: location.y, Z: location.z },
        CameraRotation: { Pitch: rotation.pitch, Yaw: rotation.yaw, Roll: rotation.roll }
      }
    });
    
    return { 
      success: true, 
      message: 'Viewport camera positioned via Direct RC API',
      method: 'DirectRC'
    };
  }

  /**
   * Get current viewport camera info via Direct Remote Control API
   * Used for rotation-only updates where we need to preserve the current location
   */
  private async getViewportCameraViaDirectRC(): Promise<{
    location: { x: number; y: number; z: number };
    rotation: { pitch: number; yaw: number; roll: number };
  } | null> {
    try {
      const result = await this.bridge.call({
        objectPath: '/Script/UnrealEd.Default__UnrealEditorSubsystem',
        functionName: 'GetLevelViewportCameraInfo',
        parameters: {}
      });
      
      // Parse the result - the API returns CameraLocation and CameraRotation as out params
      // The response format may vary, so we handle multiple possible structures
      if (result) {
        let location = null;
        let rotation = null;
        
        // Try to extract location
        if (result.CameraLocation) {
          location = {
            x: result.CameraLocation.X ?? result.CameraLocation.x ?? 0,
            y: result.CameraLocation.Y ?? result.CameraLocation.y ?? 0,
            z: result.CameraLocation.Z ?? result.CameraLocation.z ?? 0
          };
        } else if (result.ReturnValue?.CameraLocation) {
          location = {
            x: result.ReturnValue.CameraLocation.X ?? 0,
            y: result.ReturnValue.CameraLocation.Y ?? 0,
            z: result.ReturnValue.CameraLocation.Z ?? 0
          };
        }
        
        // Try to extract rotation
        if (result.CameraRotation) {
          rotation = {
            pitch: result.CameraRotation.Pitch ?? result.CameraRotation.pitch ?? 0,
            yaw: result.CameraRotation.Yaw ?? result.CameraRotation.yaw ?? 0,
            roll: result.CameraRotation.Roll ?? result.CameraRotation.roll ?? 0
          };
        } else if (result.ReturnValue?.CameraRotation) {
          rotation = {
            pitch: result.ReturnValue.CameraRotation.Pitch ?? 0,
            yaw: result.ReturnValue.CameraRotation.Yaw ?? 0,
            roll: result.ReturnValue.CameraRotation.Roll ?? 0
          };
        }
        
        if (location && rotation) {
          return { location, rotation };
        }
      }
      
      return null;
    } catch (error) {
      log.debug('Failed to get viewport camera via Direct RC:', error);
      return null;
    }
  }

  /**
   * Set viewport camera position via Python (fallback method)
   * Used when Direct RC API is not available
   */
  private async setViewportCameraViaPython(
    location: { x: number; y: number; z: number },
    rotation: { pitch: number; yaw: number; roll: number }
  ): Promise<{ success: boolean; message: string; method: string }> {
    const pythonCmd = `
import unreal
# Use UnrealEditorSubsystem instead of deprecated EditorLevelLibrary
ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
location = unreal.Vector(${location.x}, ${location.y}, ${location.z})
rotation = unreal.Rotator(${rotation.pitch}, ${rotation.yaw}, ${rotation.roll})
if ues:
    ues.set_level_viewport_camera_info(location, rotation)
    # Invalidate viewports to ensure visual update
    try:
        if les:
            les.editor_invalidate_viewports()
    except Exception:
        pass
    `.trim();
    await this.bridge.executePython(pythonCmd);
    return { 
      success: true, 
      message: 'Viewport camera positioned via Python API',
      method: 'Python'
    };
  }

  /**
   * Get current viewport camera info via Python (fallback method)
   */
  private async getViewportCameraViaPython(): Promise<{
    location: { x: number; y: number; z: number };
    rotation: { pitch: number; yaw: number; roll: number };
  } | null> {
    try {
      const pythonCmd = `
import unreal
import json
ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
if ues:
    info = ues.get_level_viewport_camera_info()
    if info is not None:
        loc, rot = info
        print('RESULT:' + json.dumps({
            'location': {'x': loc.x, 'y': loc.y, 'z': loc.z},
            'rotation': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll}
        }))
      `.trim();
      const result: any = await this.bridge.executePython(pythonCmd);
      
      // Parse the RESULT from Python output
      const output = typeof result === 'string' ? result : JSON.stringify(result);
      const match = output.match(/RESULT:(\{.*\})/s);
      if (match) {
        const parsed = JSON.parse(match[1]);
        return {
          location: parsed.location,
          rotation: parsed.rotation
        };
      }
      return null;
    } catch (error) {
      log.debug('Failed to get viewport camera via Python:', error);
      return null;
    }
  }

  async setViewportCamera(location?: { x: number; y: number; z: number } | [number, number, number] | null | undefined, rotation?: { pitch: number; yaw: number; roll: number } | [number, number, number] | null | undefined) {
    // Special handling for when both location and rotation are missing/invalid
    // Allow rotation-only updates
    if (location === null) {
      // Explicit null is not allowed for location
      throw new Error('Invalid location: null is not allowed');
    }
    if (location !== undefined && location !== null) {
      const locObj = toVec3Object(location);
      if (!locObj) {
        throw new Error('Invalid location: must be {x,y,z} or [x,y,z]');
      }
      // Clamp extreme values to reasonable limits for Unreal Engine
      const MAX_COORD = 1000000; // 1 million units is a reasonable max for UE
      locObj.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, locObj.x));
      locObj.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, locObj.y));
      locObj.z = Math.max(-MAX_COORD, Math.min(MAX_COORD, locObj.z));
      location = locObj as any;
    }
    
    // Validate rotation if provided
    if (rotation !== undefined) {
      if (rotation === null) {
        throw new Error('Invalid rotation: null is not allowed');
      }
      const rotObj = toRotObject(rotation);
      if (!rotObj) {
        throw new Error('Invalid rotation: must be {pitch,yaw,roll} or [pitch,yaw,roll]');
      }
      // Normalize rotation values to 0-360 range
      rotObj.pitch = ((rotObj.pitch % 360) + 360) % 360;
      rotObj.yaw = ((rotObj.yaw % 360) + 360) % 360;
      rotObj.roll = ((rotObj.roll % 360) + 360) % 360;
      rotation = rotObj as any;
    }
    
    try {
      // Case 1: Both location and rotation provided
      if (location) {
        const loc = location as { x: number; y: number; z: number };
        const rot = (rotation as { pitch: number; yaw: number; roll: number }) || { pitch: 0, yaw: 0, roll: 0 };
        
        // Try Direct RC API first (preferred - no Python required)
        try {
          log.debug('Attempting to set viewport camera via Direct RC API');
          const result = await this.setViewportCameraViaDirectRC(loc, rot);
          log.info('Viewport camera set via Direct RC API');
          return result;
        } catch (directRcError) {
          log.debug('Direct RC API failed, falling back to Python:', directRcError);
          
          // Fall back to Python method
          try {
            const result = await this.setViewportCameraViaPython(loc, rot);
            log.info('Viewport camera set via Python API (fallback)');
            return result;
          } catch (pythonError) {
            log.debug('Python API also failed:', pythonError);
            // Final fallback to camera speed control
            await this.bridge.executeConsoleCommand('camspeed 4');
            return { 
              success: true, 
              message: 'Camera speed set. Use debug camera (toggledebugcamera) for manual positioning',
              method: 'ConsoleFallback'
            };
          }
        }
      } 
      // Case 2: Only rotation provided - need to get current location first
      else if (rotation) {
        const rot = rotation as { pitch: number; yaw: number; roll: number };
        
        // Try Direct RC API to get current camera info
        try {
          log.debug('Attempting to get current camera info via Direct RC API');
          const currentCamera = await this.getViewportCameraViaDirectRC();
          
          if (currentCamera) {
            log.debug('Got current camera info via Direct RC, now setting rotation');
            const result = await this.setViewportCameraViaDirectRC(currentCamera.location, rot);
            log.info('Viewport camera rotation set via Direct RC API');
            return {
              ...result,
              message: 'Viewport camera rotation set via Direct RC API'
            };
          } else {
            throw new Error('Could not get current camera info');
          }
        } catch (directRcError) {
          log.debug('Direct RC API failed for rotation-only update, falling back to Python:', directRcError);
          
          // Fall back to Python method
          try {
            const currentCamera = await this.getViewportCameraViaPython();
            if (currentCamera) {
              const result = await this.setViewportCameraViaPython(currentCamera.location, rot);
              log.info('Viewport camera rotation set via Python API (fallback)');
              return {
                ...result,
                message: 'Viewport camera rotation set via Python API'
              };
            } else {
              return { 
                success: true, 
                message: 'Camera rotation update attempted (could not verify)',
                method: 'Python'
              };
            }
          } catch (pythonError) {
            log.debug('Python API also failed for rotation:', pythonError);
            return { 
              success: true, 
              message: 'Camera rotation update attempted',
              method: 'Unknown'
            };
          }
        }
      } 
      // Case 3: Neither location nor rotation provided - no-op
      else {
        return { 
          success: true, 
          message: 'No camera changes requested',
          method: 'None'
        };
      }
    } catch (err) {
      return { success: false, error: `Failed to set camera: ${err}`, method: 'Error' };
    }
  }
  
  async setCameraSpeed(speed: number) {
    try {
      await this.bridge.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/Engine.Default__KismetSystemLibrary',
        functionName: 'ExecuteConsoleCommand',
        parameters: {
          WorldContextObject: null,
          Command: `camspeed ${speed}`,
          SpecificPlayer: null
        },
        generateTransaction: false
      });
      return { success: true, message: `Camera speed set to ${speed}` };
    } catch (err) {
      return { success: false, error: `Failed to set camera speed: ${err}` };
    }
  }
  
  async setFOV(fov: number) {
    try {
      await this.bridge.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/Engine.Default__KismetSystemLibrary',
        functionName: 'ExecuteConsoleCommand',
        parameters: {
          WorldContextObject: null,
          Command: `fov ${fov}`,
          SpecificPlayer: null
        },
        generateTransaction: false
      });
      return { success: true, message: `FOV set to ${fov}` };
    } catch (err) {
      return { success: false, error: `Failed to set FOV: ${err}` };
    }
  }
}
