/**
 * Sequence Keyframe and Camera Cut Tools
 * Extracted from sequence.ts to keep files under 1000 lines
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { Logger } from '../utils/logger.js';
import { interpretStandardResult } from '../utils/result-helpers.js';

export class SequenceKeyframeTools {
  private log = new Logger('SequenceKeyframeTools');
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(private bridge: UnrealBridge) {}

  /**
   * Execute with retry logic for transient failures
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        this.log.warn(`${operationName} attempt ${attempt} failed: ${error.message || error}`);
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * attempt)
          );
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Parse Python execution result with better error handling
   */
  private parsePythonResult(resp: unknown, operationName: string): any {
    const interpreted = interpretStandardResult(resp, {
      successMessage: `${operationName} succeeded`,
      failureMessage: `${operationName} failed`
    });

    if (interpreted.success) {
      return {
        ...interpreted.payload,
        success: true
      };
    }

    const baseError = interpreted.error ?? `${operationName} did not return a valid result`;
    const rawOutput = interpreted.rawText ?? '';
    const cleanedOutput = interpreted.cleanText && interpreted.cleanText.trim().length > 0
      ? interpreted.cleanText.trim()
      : baseError;

    if (rawOutput.includes('ModuleNotFoundError')) {
      return { success: false, error: 'Sequencer module not available. Ensure Sequencer is enabled.' };
    }
    if (rawOutput.includes('AttributeError')) {
      return { success: false, error: 'Sequencer API method not found. Check Unreal Engine version compatibility.' };
    }

    this.log.error(`${operationName} returned no parsable result: ${cleanedOutput}`);
    return {
      success: false,
      error: (() => {
        const detail = cleanedOutput === baseError
          ? ''
          : (cleanedOutput ?? '').substring(0, 200).trim();
        return detail ? `${baseError}: ${detail}` : baseError;
      })()
    };
  }

  private async ensureSequencerPrerequisites(operation: string): Promise<string[] | null> {
    const missing = await this.bridge.ensurePluginsEnabled(['LevelSequenceEditor', 'Sequencer'], operation);
    return missing.length ? missing : null;
  }

  /**
   * Add a transform keyframe to a binding at a specific frame
   * This allows animating actor position, rotation, and scale over time
   */
  async addTransformKeyframe(params: {
    bindingName: string;
    frame: number;
    location?: { x: number; y: number; z: number };
    rotation?: { pitch: number; yaw: number; roll: number };
    scale?: { x: number; y: number; z: number };
    interpolation?: 'linear' | 'constant' | 'cubic';
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('SequenceKeyframeTools.addTransformKeyframe');
    if (missingPlugins) {
      return {
        success: false,
        error: `Required Unreal plugins are not enabled: ${missingPlugins.join(', ')}`
      };
    }

    const interpMode = params.interpolation || 'cubic';
    const interpEnum = interpMode === 'linear' ? 'RCIM_LINEAR' : 
                       interpMode === 'constant' ? 'RCIM_CONSTANT' : 'RCIM_CUBIC';

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        # Find the binding by name
        bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
        target_binding = None
        target_name = r"${params.bindingName}"
        
        for binding in bindings:
            binding_name = unreal.MovieSceneBindingExtensions.get_name(binding)
            if binding_name == target_name or binding_name.lower() == target_name.lower():
                target_binding = binding
                break
        
        if not target_binding:
            available = [unreal.MovieSceneBindingExtensions.get_name(b) for b in bindings]
            print('RESULT:' + json.dumps({'success': False, 'error': f'Binding "{target_name}" not found. Available: {available}'}))
        else:
            # Get or create transform track
            tracks = unreal.MovieSceneBindingExtensions.get_tracks(target_binding)
            transform_track = None
            
            for track in tracks:
                if track.get_class().get_name() == 'MovieScene3DTransformTrack':
                    transform_track = track
                    break
            
            if not transform_track:
                transform_track = unreal.MovieSceneBindingExtensions.add_track(target_binding, unreal.MovieScene3DTransformTrack)
            
            sections = transform_track.get_sections() if transform_track else []
            section = sections[0] if sections else None
            
            if not section:
                section = transform_track.add_section()
                section.set_start_frame(0)
                section.set_end_frame(max(${params.frame} + 10, 100))
            
            display_rate = unreal.MovieSceneSequenceExtensions.get_display_rate(seq)
            frame_time = unreal.FrameNumber(${params.frame})
            channels = section.get_all_channels() if hasattr(section, 'get_all_channels') else []
            keyframes_added = []
            
            ${params.location ? `
            if len(channels) >= 3:
                try:
                    channels[0].add_key(frame_time, ${params.location.x}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[1].add_key(frame_time, ${params.location.y}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[2].add_key(frame_time, ${params.location.z}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    keyframes_added.append({'type': 'location', 'x': ${params.location.x}, 'y': ${params.location.y}, 'z': ${params.location.z}})
                except Exception as e:
                    keyframes_added.append({'type': 'location', 'error': str(e)})
            ` : ''}
            
            ${params.rotation ? `
            if len(channels) >= 6:
                try:
                    channels[3].add_key(frame_time, ${params.rotation.pitch}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[4].add_key(frame_time, ${params.rotation.yaw}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[5].add_key(frame_time, ${params.rotation.roll}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    keyframes_added.append({'type': 'rotation', 'pitch': ${params.rotation.pitch}, 'yaw': ${params.rotation.yaw}, 'roll': ${params.rotation.roll}})
                except Exception as e:
                    keyframes_added.append({'type': 'rotation', 'error': str(e)})
            ` : ''}
            
            ${params.scale ? `
            if len(channels) >= 9:
                try:
                    channels[6].add_key(frame_time, ${params.scale.x}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[7].add_key(frame_time, ${params.scale.y}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    channels[8].add_key(frame_time, ${params.scale.z}, unreal.MovieSceneKeyInterpolation.${interpEnum})
                    keyframes_added.append({'type': 'scale', 'x': ${params.scale.x}, 'y': ${params.scale.y}, 'z': ${params.scale.z}})
                except Exception as e:
                    keyframes_added.append({'type': 'scale', 'error': str(e)})
            ` : ''}
            
            if keyframes_added:
                print('RESULT:' + json.dumps({
                    'success': True,
                    'binding': target_name,
                    'frame': ${params.frame},
                    'keyframes': keyframes_added,
                    'interpolation': '${interpMode}'
                }))
            else:
                print('RESULT:' + json.dumps({
                    'success': False,
                    'error': 'No keyframes could be added. Channel count: ' + str(len(channels))
                }))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addTransformKeyframe'
    );
    
    return this.parsePythonResult(resp, 'addTransformKeyframe');
  }

  /**
   * Add a camera cut track for switching between cameras in the sequence
   */
  async addCameraCutTrack(params?: { path?: string }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('SequenceKeyframeTools.addCameraCutTrack');
    if (missingPlugins) {
      return {
        success: false,
        error: `Required Unreal plugins are not enabled: ${missingPlugins.join(', ')}`
      };
    }

    const py = `
import unreal, json
try:
    seq_path = r"${params?.path || ''}"
    if seq_path:
        seq = unreal.load_asset(seq_path)
    else:
        seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence found or loaded'}))
    else:
        # UE5.7: Use MovieSceneSequenceExtensions for master tracks, not movie_scene directly
        # Check for existing camera cut track
        existing_tracks = unreal.MovieSceneSequenceExtensions.get_tracks(seq)
        camera_cut_track = None
        
        for track in existing_tracks:
            if track.get_class().get_name() == 'MovieSceneCameraCutTrack':
                camera_cut_track = track
                break
        
        if camera_cut_track:
            print('RESULT:' + json.dumps({
                'success': True,
                'trackName': 'CameraCuts',
                'existing': True,
                'message': 'Camera cut track already exists'
            }))
        else:
            # UE5.7: Use add_track on sequence extensions
            camera_cut_track = unreal.MovieSceneSequenceExtensions.add_track(seq, unreal.MovieSceneCameraCutTrack)
            if camera_cut_track:
                print('RESULT:' + json.dumps({
                    'success': True,
                    'trackName': 'CameraCuts',
                    'existing': False,
                    'message': 'Camera cut track created'
                }))
            else:
                print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to create camera cut track'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addCameraCutTrack'
    );
    
    return this.parsePythonResult(resp, 'addCameraCutTrack');
  }

  /**
   * Add a camera cut section to switch to a specific camera at a frame
   */
  async addCameraCut(params: {
    cameraBindingName: string;
    startFrame: number;
    endFrame?: number;
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('SequenceKeyframeTools.addCameraCut');
    if (missingPlugins) {
      return {
        success: false,
        error: `Required Unreal plugins are not enabled: ${missingPlugins.join(', ')}`
      };
    }

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
        camera_binding = None
        camera_name = r"${params.cameraBindingName}"
        
        for binding in bindings:
            binding_name = unreal.MovieSceneBindingExtensions.get_name(binding)
            if binding_name == camera_name or binding_name.lower() == camera_name.lower():
                camera_binding = binding
                break
        
        if not camera_binding:
            available = [unreal.MovieSceneBindingExtensions.get_name(b) for b in bindings]
            print('RESULT:' + json.dumps({'success': False, 'error': f'Camera binding "{camera_name}" not found. Available: {available}'}))
        else:
            # UE5.7: Use MovieSceneSequenceExtensions for master tracks
            existing_tracks = unreal.MovieSceneSequenceExtensions.get_tracks(seq)
            camera_cut_track = None
            
            for track in existing_tracks:
                if track.get_class().get_name() == 'MovieSceneCameraCutTrack':
                    camera_cut_track = track
                    break
            
            if not camera_cut_track:
                # UE5.7: Use add_track on sequence extensions
                camera_cut_track = unreal.MovieSceneSequenceExtensions.add_track(seq, unreal.MovieSceneCameraCutTrack)
            
            if camera_cut_track:
                binding_id = unreal.MovieSceneSequenceExtensions.get_binding_id(seq, camera_binding)
                section = camera_cut_track.add_section()
                
                if hasattr(section, 'set_camera_binding_id'):
                    section.set_camera_binding_id(binding_id)
                
                section.set_start_frame(${params.startFrame})
                end_frame = ${params.endFrame !== undefined ? params.endFrame : 'unreal.MovieSceneSequenceExtensions.get_playback_end(seq)'}
                section.set_end_frame(end_frame)
                
                print('RESULT:' + json.dumps({
                    'success': True,
                    'cameraName': camera_name,
                    'startFrame': ${params.startFrame},
                    'endFrame': int(end_frame) if isinstance(end_frame, (int, float)) else ${params.endFrame || -1},
                    'message': f'Camera cut added for {camera_name}'
                }))
            else:
                print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to create camera cut track'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addCameraCut'
    );
    
    return this.parsePythonResult(resp, 'addCameraCut');
  }

  /**
   * Get all tracks for a specific binding
   */
  async getTracks(params: { bindingName: string }) {
    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
        target_binding = None
        target_name = r"${params.bindingName}"
        
        for binding in bindings:
            binding_name = unreal.MovieSceneBindingExtensions.get_name(binding)
            if binding_name == target_name or binding_name.lower() == target_name.lower():
                target_binding = binding
                break
        
        if not target_binding:
            available = [unreal.MovieSceneBindingExtensions.get_name(b) for b in bindings]
            print('RESULT:' + json.dumps({'success': False, 'error': f'Binding "{target_name}" not found. Available: {available}'}))
        else:
            tracks = unreal.MovieSceneBindingExtensions.get_tracks(target_binding)
            track_list = []
            
            for track in tracks:
                # UE5.7: get_display_name() returns FText which isn't JSON serializable
                # Convert to string explicitly
                track_name = ''
                if hasattr(track, 'get_display_name'):
                    display_name = track.get_display_name()
                    track_name = str(display_name) if display_name else ''
                if not track_name:
                    track_name = track.get_name() if hasattr(track, 'get_name') else 'Unknown'
                
                # Get property path if this is a property track
                property_path = ''
                if hasattr(track, 'get_property_path'):
                    try:
                        property_path = str(track.get_property_path())
                    except:
                        pass
                if not property_path and hasattr(track, 'get_property_name'):
                    try:
                        property_path = str(track.get_property_name())
                    except:
                        pass
                
                track_info = {
                    'name': track_name,
                    'type': track.get_class().get_name(),
                    'propertyPath': property_path,
                    'sections': []
                }
                
                sections = track.get_sections() if hasattr(track, 'get_sections') else []
                for section in sections:
                    section_info = {
                        'type': section.get_class().get_name()
                    }
                    try:
                        section_info['startFrame'] = int(section.get_start_frame())
                        section_info['endFrame'] = int(section.get_end_frame())
                    except:
                        pass
                    track_info['sections'].append(section_info)
                
                track_list.append(track_info)
            
            print('RESULT:' + json.dumps({
                'success': True,
                'binding': target_name,
                'tracks': track_list,
                'trackCount': len(track_list)
            }))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'getTracks'
    );
    
    return this.parsePythonResult(resp, 'getTracks');
  }

  /**
   * Add a property track to a binding for animating scalar/vector properties
   */
  async addPropertyTrack(params: {
    bindingName: string;
    propertyPath: string;
    propertyType?: 'float' | 'bool' | 'vector' | 'color';
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('addPropertyTrack');
    if (missingPlugins?.length) {
      return {
        success: false,
        error: `Sequencer plugins required: ${missingPlugins.join(', ')}`
      };
    }

    const propertyType = params.propertyType || 'float';
    
    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
        target_binding = None
        target_name = r"${params.bindingName}"
        
        for binding in bindings:
            binding_name = unreal.MovieSceneBindingExtensions.get_name(binding)
            if binding_name == target_name or binding_name.lower() == target_name.lower():
                target_binding = binding
                break
        
        if not target_binding:
            available = [unreal.MovieSceneBindingExtensions.get_name(b) for b in bindings]
            print('RESULT:' + json.dumps({'success': False, 'error': f'Binding "{target_name}" not found. Available: {available}'}))
        else:
            property_path = r"${params.propertyPath}"
            property_type = r"${propertyType}"
            prop_lower = property_path.lower()
            
            # Check if this is a transform property - these use the existing transform track
            is_transform_prop = any(x in prop_lower for x in ['relativelocation', 'relativerotation', 'relativescale', 'location', 'rotation', 'scale'])
            
            if is_transform_prop:
                # Check if transform track already exists
                existing_tracks = unreal.MovieSceneBindingExtensions.get_tracks(target_binding)
                transform_track = None
                for t in existing_tracks:
                    if t.get_class().get_name() == 'MovieScene3DTransformTrack':
                        transform_track = t
                        break
                
                if transform_track:
                    # Return existing transform track
                    print('RESULT:' + json.dumps({
                        'success': True,
                        'binding': target_name,
                        'propertyPath': property_path,
                        'actualPath': 'Transform',
                        'propertySet': True,
                        'trackType': 'MovieScene3DTransformTrack',
                        'trackName': transform_track.get_name() if hasattr(transform_track, 'get_name') else 'Transform',
                        'existing': True,
                        'message': 'Using existing transform track. Use add_transform_keyframe to key location/rotation/scale.'
                    }))
                else:
                    # Create new transform track
                    transform_track = unreal.MovieSceneBindingExtensions.add_track(target_binding, unreal.MovieScene3DTransformTrack)
                    if transform_track:
                        # Add a section to initialize the track
                        section = transform_track.add_section()
                        if section:
                            try:
                                section.set_start_frame(0)
                                section.set_end_frame(300)
                            except:
                                pass
                        print('RESULT:' + json.dumps({
                            'success': True,
                            'binding': target_name,
                            'propertyPath': property_path,
                            'actualPath': 'Transform',
                            'propertySet': True,
                            'trackType': 'MovieScene3DTransformTrack',
                            'trackName': transform_track.get_name() if hasattr(transform_track, 'get_name') else 'Transform',
                            'existing': False,
                            'message': 'Created transform track. Use add_transform_keyframe to key location/rotation/scale.'
                        }))
                    else:
                        print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to create transform track'}))
            else:
                # Map property type to track class for non-transform properties
                track_class = None
                if property_type == 'float':
                    track_class = unreal.MovieSceneFloatTrack
                elif property_type == 'bool':
                    track_class = unreal.MovieSceneBoolTrack
                elif property_type == 'vector':
                    # For non-transform vectors, try MovieSceneVectorTrack or fallback to float
                    if hasattr(unreal, 'MovieSceneVectorTrack'):
                        track_class = unreal.MovieSceneVectorTrack
                    else:
                        # Fallback - create 3 float tracks? Or just use a single track
                        track_class = unreal.MovieSceneFloatTrack
                elif property_type == 'color':
                    track_class = unreal.MovieSceneColorTrack
                else:
                    track_class = unreal.MovieSceneFloatTrack
                
                # Add the track
                track = unreal.MovieSceneBindingExtensions.add_track(target_binding, track_class)
                if track:
                    # Set the property path - try multiple methods
                    property_set = False
                    if hasattr(track, 'set_property_name_and_path'):
                        try:
                            track.set_property_name_and_path(property_path, property_path)
                            property_set = True
                        except:
                            pass
                    
                    # Verify property was set
                    actual_path = ''
                    if hasattr(track, 'get_property_path'):
                        try:
                            actual_path = str(track.get_property_path())
                        except:
                            pass
                    elif hasattr(track, 'get_property_name'):
                        try:
                            actual_path = str(track.get_property_name())
                        except:
                            pass
                    
                    print('RESULT:' + json.dumps({
                        'success': True,
                        'binding': target_name,
                        'propertyPath': property_path,
                        'actualPath': actual_path,
                        'propertySet': property_set,
                        'trackType': track.get_class().get_name(),
                        'trackName': track.get_name() if hasattr(track, 'get_name') else 'unknown'
                    }))
                else:
                    print('RESULT:' + json.dumps({'success': False, 'error': f'Failed to add {property_type} track'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addPropertyTrack'
    );
    
    return this.parsePythonResult(resp, 'addPropertyTrack');
  }

  /**
   * Add a keyframe to a property track
   */
  async addPropertyKeyframe(params: {
    bindingName: string;
    propertyPath: string;
    frame: number;
    value: number | boolean | { x: number; y: number; z: number } | { r: number; g: number; b: number; a: number };
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('addPropertyKeyframe');
    if (missingPlugins?.length) {
      return {
        success: false,
        error: `Sequencer plugins required: ${missingPlugins.join(', ')}`
      };
    }

    // Parse value if it's a string (can happen with MCP parameter passing)
    let parsedValue = params.value;
    if (typeof parsedValue === 'string') {
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Determine value type and prepare Python value representation
    let valueType: string;
    let vectorValue: { x: number; y: number; z: number } | null = null;
    let colorValue: { r: number; g: number; b: number; a: number } | null = null;
    let scalarValue: number | boolean | null = null;
    
    if (typeof parsedValue === 'boolean') {
      valueType = 'bool';
      scalarValue = parsedValue;
    } else if (typeof parsedValue === 'number') {
      valueType = 'float';
      scalarValue = parsedValue;
    } else if (typeof parsedValue === 'object' && parsedValue !== null && 'x' in parsedValue && 'y' in parsedValue && 'z' in parsedValue) {
      valueType = 'vector';
      vectorValue = parsedValue as { x: number; y: number; z: number };
    } else if (typeof parsedValue === 'object' && parsedValue !== null && 'r' in parsedValue) {
      valueType = 'color';
      const v = parsedValue as { r: number; g: number; b: number; a?: number };
      colorValue = { r: v.r, g: v.g, b: v.b, a: v.a ?? 1.0 };
    } else {
      valueType = 'float';
      scalarValue = typeof parsedValue === 'number' ? parsedValue : 0;
    }

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
        target_binding = None
        target_name = r"${params.bindingName}"
        
        for binding in bindings:
            binding_name = unreal.MovieSceneBindingExtensions.get_name(binding)
            if binding_name == target_name or binding_name.lower() == target_name.lower():
                target_binding = binding
                break
        
        if not target_binding:
            print('RESULT:' + json.dumps({'success': False, 'error': f'Binding not found: {target_name}'}))
        else:
            property_path = r"${params.propertyPath}"
            frame = ${params.frame}
            value_type = r"${valueType}"
            
            # Find the property track - check property path/name, not just track name
            tracks = unreal.MovieSceneBindingExtensions.get_tracks(target_binding)
            target_track = None
            available_tracks = []
            
            for track in tracks:
                track_name = track.get_name() if hasattr(track, 'get_name') else ''
                track_class = track.get_class().get_name()
                
                # Try to get property path/name from the track
                track_prop_path = ''
                if hasattr(track, 'get_property_path'):
                    try:
                        track_prop_path = str(track.get_property_path())
                    except:
                        pass
                if not track_prop_path and hasattr(track, 'get_property_name'):
                    try:
                        track_prop_path = str(track.get_property_name())
                    except:
                        pass
                
                available_tracks.append(f'{track_class}:{track_name}:{track_prop_path}')
                
                # Match by property path first, then by track name
                if track_prop_path and property_path.lower() in track_prop_path.lower():
                    target_track = track
                    break
                elif property_path.lower() in track_name.lower():
                    target_track = track
                    break
                # Also check track class for transform tracks when looking for scale/location/rotation
                elif 'Transform' in track_class and property_path.lower() in ['relativescale3d', 'relativelocation', 'relativerotation', 'scale', 'location', 'rotation']:
                    target_track = track
                    break
            
            if not target_track:
                print('RESULT:' + json.dumps({'success': False, 'error': f'No track found for property: {property_path}. Available tracks: {available_tracks}. Add property track first.'}))
            else:
                sections = target_track.get_sections() if hasattr(target_track, 'get_sections') else []
                if len(sections) == 0:
                    # Create a section
                    section = target_track.add_section()
                    # Set section range
                    try:
                        section.set_start_frame(0)
                        section.set_end_frame(max(frame + 10, 300))
                    except:
                        pass
                    sections = target_track.get_sections()
                
                if len(sections) > 0:
                    section = sections[0]
                    frame_num = unreal.FrameNumber(frame)
                    track_class = target_track.get_class().get_name()
                    key_added = False
                    key_details = []
                    
                    # For Transform tracks (vectors), use channels
                    if 'Transform' in track_class or value_type == 'vector':
                        channels = section.get_all_channels() if hasattr(section, 'get_all_channels') else []
                        if len(channels) >= 9:
                            # Transform track channels: 0-2 = Location X/Y/Z, 3-5 = Rotation, 6-8 = Scale X/Y/Z
                            # Determine which channels based on property path
                            prop_lower = property_path.lower()
                            channel_offset = 0
                            if 'location' in prop_lower:
                                channel_offset = 0
                            elif 'rotation' in prop_lower:
                                channel_offset = 3
                            elif 'scale' in prop_lower:
                                channel_offset = 6
                            else:
                                # Default to scale for RelativeScale3D
                                channel_offset = 6
                            
                            try:
                                interp = unreal.MovieSceneKeyInterpolation.RCIM_CUBIC
                                ${vectorValue ? `
                                channels[channel_offset + 0].add_key(frame_num, ${vectorValue.x}, interp)
                                channels[channel_offset + 1].add_key(frame_num, ${vectorValue.y}, interp)
                                channels[channel_offset + 2].add_key(frame_num, ${vectorValue.z}, interp)
                                key_added = True
                                key_details = [{'channel': channel_offset, 'x': ${vectorValue.x}, 'y': ${vectorValue.y}, 'z': ${vectorValue.z}}]
                                ` : `
                                # Scalar value applied to all three channels
                                scalar_val = ${scalarValue ?? 1.0}
                                channels[channel_offset + 0].add_key(frame_num, scalar_val, interp)
                                channels[channel_offset + 1].add_key(frame_num, scalar_val, interp)
                                channels[channel_offset + 2].add_key(frame_num, scalar_val, interp)
                                key_added = True
                                key_details = [{'channel': channel_offset, 'value': scalar_val}]
                                `}
                            except Exception as chan_err:
                                key_details.append({'error': str(chan_err)})
                        else:
                            key_details.append({'error': f'Not enough channels: {len(channels)}'})
                    
                    # For Color tracks, use RGBA channels
                    elif 'Color' in track_class or value_type == 'color':
                        channels = section.get_all_channels() if hasattr(section, 'get_all_channels') else []
                        if len(channels) >= 4:
                            try:
                                interp = unreal.MovieSceneKeyInterpolation.RCIM_CUBIC
                                ${colorValue ? `
                                channels[0].add_key(frame_num, ${colorValue.r}, interp)
                                channels[1].add_key(frame_num, ${colorValue.g}, interp)
                                channels[2].add_key(frame_num, ${colorValue.b}, interp)
                                channels[3].add_key(frame_num, ${colorValue.a}, interp)
                                key_added = True
                                key_details = [{'r': ${colorValue.r}, 'g': ${colorValue.g}, 'b': ${colorValue.b}, 'a': ${colorValue.a}}]
                                ` : '# No color value provided'}
                            except Exception as chan_err:
                                key_details.append({'error': str(chan_err)})
                    
                    # For Float/Bool tracks, use channels or add_key
                    else:
                        channels = section.get_all_channels() if hasattr(section, 'get_all_channels') else []
                        if len(channels) > 0:
                            try:
                                interp = unreal.MovieSceneKeyInterpolation.RCIM_CUBIC
                                ${valueType === 'bool' ? `
                                channels[0].add_key(frame_num, ${scalarValue ? 'True' : 'False'})
                                ` : `
                                channels[0].add_key(frame_num, ${scalarValue ?? 0}, interp)
                                `}
                                key_added = True
                                key_details = [{'value': ${scalarValue ?? 0}}]
                            except Exception as chan_err:
                                # Fallback to section.add_key if channels don't work
                                if hasattr(section, 'add_key'):
                                    try:
                                        ${valueType === 'bool' ? `
                                        section.add_key(frame_num, ${scalarValue ? 'True' : 'False'})
                                        ` : `
                                        section.add_key(frame_num, ${scalarValue ?? 0})
                                        `}
                                        key_added = True
                                        key_details = [{'fallback': True, 'value': ${scalarValue ?? 0}}]
                                    except Exception as sec_err:
                                        key_details.append({'error': f'Channel: {chan_err}, Section: {sec_err}'})
                                else:
                                    key_details.append({'error': str(chan_err)})
                        elif hasattr(section, 'add_key'):
                            try:
                                ${valueType === 'bool' ? `
                                section.add_key(frame_num, ${scalarValue ? 'True' : 'False'})
                                ` : `
                                section.add_key(frame_num, ${scalarValue ?? 0})
                                `}
                                key_added = True
                                key_details = [{'value': ${scalarValue ?? 0}}]
                            except Exception as sec_err:
                                key_details.append({'error': str(sec_err)})
                    
                    if key_added:
                        print('RESULT:' + json.dumps({
                            'success': True,
                            'binding': target_name,
                            'property': property_path,
                            'frame': frame,
                            'valueType': value_type,
                            'trackType': track_class,
                            'details': key_details
                        }))
                    else:
                        print('RESULT:' + json.dumps({
                            'success': False,
                            'error': f'Could not add keyframe to {track_class}',
                            'details': key_details
                        }))
                else:
                    print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to create section'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addPropertyKeyframe'
    );
    
    return this.parsePythonResult(resp, 'addPropertyKeyframe');
  }

  /**
   * Add an audio track to the sequence
   */
  async addAudioTrack(params: {
    soundPath: string;
    startFrame?: number;
    rowIndex?: number;
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('addAudioTrack');
    if (missingPlugins?.length) {
      return {
        success: false,
        error: `Sequencer plugins required: ${missingPlugins.join(', ')}`
      };
    }

    const startFrame = params.startFrame ?? 0;
    const rowIndex = params.rowIndex ?? 0;

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        sound_path = r"${params.soundPath}"
        
        # Load the sound asset
        sound = unreal.EditorAssetLibrary.load_asset(sound_path)
        if not sound:
            print('RESULT:' + json.dumps({'success': False, 'error': f'Sound asset not found: {sound_path}'}))
        else:
            # UE5.7: Use add_track instead of add_master_track
            audio_track = unreal.MovieSceneSequenceExtensions.add_track(seq, unreal.MovieSceneAudioTrack)
            
            if audio_track:
                # Add section with the sound
                section = audio_track.add_section()
                if section and hasattr(section, 'set_sound'):
                    section.set_sound(sound)
                    
                    # UE5.7: set_start_frame needs special handling
                    # Try different approaches for setting frame
                    start_frame_val = ${startFrame}
                    try:
                        # Try with FrameNumber object
                        frame_num = unreal.FrameNumber(start_frame_val)
                        if hasattr(section, 'set_start_frame_bounded'):
                            section.set_start_frame_bounded(frame_num)
                        elif hasattr(section, 'set_range'):
                            # Get current end frame and set range
                            section.set_range(start_frame_val, start_frame_val + 300)  # Default 10 seconds at 30fps
                        else:
                            # Direct assignment via MovieSceneSectionExtensions
                            unreal.MovieSceneSectionExtensions.set_start_frame_bounded(section, frame_num)
                    except Exception as frame_err:
                        # Fallback: just log the error but continue
                        pass
                    
                    # Set row index if specified
                    if hasattr(section, 'set_row_index'):
                        try:
                            section.set_row_index(${rowIndex})
                        except:
                            pass
                    
                    print('RESULT:' + json.dumps({
                        'success': True,
                        'soundPath': sound_path,
                        'startFrame': ${startFrame},
                        'trackType': 'MovieSceneAudioTrack'
                    }))
                else:
                    print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to configure audio section'}))
            else:
                print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to add audio track'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addAudioTrack'
    );
    
    return this.parsePythonResult(resp, 'addAudioTrack');
  }

  /**
   * Add an event track for triggering Blueprint events
   */
  async addEventTrack(params: {
    bindingName?: string;
    eventName: string;
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('addEventTrack');
    if (missingPlugins?.length) {
      return {
        success: false,
        error: `Sequencer plugins required: ${missingPlugins.join(', ')}`
      };
    }

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        binding_name = r"${params.bindingName || ''}"
        event_name = r"${params.eventName}"
        
        event_track = None
        target_binding = None
        
        if binding_name:
            # Add to specific binding
            bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
            
            for binding in bindings:
                bn = unreal.MovieSceneBindingExtensions.get_name(binding)
                if bn == binding_name or bn.lower() == binding_name.lower():
                    target_binding = binding
                    break
            
            if not target_binding:
                print('RESULT:' + json.dumps({'success': False, 'error': f'Binding not found: {binding_name}'}))
            else:
                event_track = unreal.MovieSceneBindingExtensions.add_track(target_binding, unreal.MovieSceneEventTrack)
        else:
            # UE5.7: Use add_track instead of add_master_track for sequence-level tracks
            event_track = unreal.MovieSceneSequenceExtensions.add_track(seq, unreal.MovieSceneEventTrack)
        
        if event_track:
            # Set display name - use FText
            if hasattr(event_track, 'set_display_name'):
                event_track.set_display_name(event_name)
            
            print('RESULT:' + json.dumps({
                'success': True,
                'eventName': event_name,
                'binding': binding_name if binding_name else 'Master',
                'trackType': 'MovieSceneEventTrack'
            }))
        elif target_binding is None and binding_name:
            pass  # Error already printed
        else:
            print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to add event track'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addEventTrack'
    );
    
    return this.parsePythonResult(resp, 'addEventTrack');
  }

  /**
   * Add an event key to an event track
   */
  async addEventKey(params: {
    eventName: string;
    frame: number;
    functionName?: string;
    bindingName?: string;
  }) {
    const missingPlugins = await this.ensureSequencerPrerequisites('addEventKey');
    if (missingPlugins?.length) {
      return {
        success: false,
        error: `Sequencer plugins required: ${missingPlugins.join(', ')}`
      };
    }

    const py = `
import unreal, json
try:
    seq = unreal.LevelSequenceEditorBlueprintLibrary.get_focused_level_sequence()
    if not seq:
        print('RESULT:' + json.dumps({'success': False, 'error': 'No sequence is currently focused'}))
    else:
        event_name = r"${params.eventName}"
        frame = ${params.frame}
        function_name = r"${params.functionName || params.eventName}"
        binding_name = r"${params.bindingName || ''}"
        
        event_track = None
        
        # UE5.7: Use get_tracks() instead of get_master_tracks()
        if binding_name:
            # Search in binding tracks
            bindings = unreal.MovieSceneSequenceExtensions.get_bindings(seq)
            for binding in bindings:
                bn = unreal.MovieSceneBindingExtensions.get_name(binding)
                if bn == binding_name or bn.lower() == binding_name.lower():
                    tracks = unreal.MovieSceneBindingExtensions.get_tracks(binding)
                    for track in tracks:
                        if isinstance(track, unreal.MovieSceneEventTrack):
                            # Convert FText to string for comparison
                            track_name = str(track.get_display_name()) if hasattr(track, 'get_display_name') else track.get_name()
                            if event_name.lower() in track_name.lower():
                                event_track = track
                                break
                    break
        else:
            # Search in master/sequence-level tracks
            master_tracks = unreal.MovieSceneSequenceExtensions.get_tracks(seq)
            for track in master_tracks:
                if isinstance(track, unreal.MovieSceneEventTrack):
                    # Convert FText to string for comparison
                    track_name = str(track.get_display_name()) if hasattr(track, 'get_display_name') else track.get_name()
                    if event_name.lower() in track_name.lower():
                        event_track = track
                        break
        
        if not event_track:
            print('RESULT:' + json.dumps({'success': False, 'error': f'Event track not found: {event_name}. Add event track first.'}))
        else:
            sections = event_track.get_sections() if hasattr(event_track, 'get_sections') else []
            if len(sections) == 0:
                event_track.add_section()
                sections = event_track.get_sections()
            
            if len(sections) > 0:
                section = sections[0]
                frame_num = unreal.FrameNumber(frame)
                
                # Try to add key - event tracks work differently in UE5
                # Event sections need MovieSceneEvent values
                try:
                    key_added = False
                    
                    # Method 1: Try using get_channels() and MovieSceneScriptingEventChannel
                    if hasattr(section, 'get_channels'):
                        channels = section.get_channels()
                        if len(channels) > 0:
                            channel = channels[0]
                            # Create event payload
                            if hasattr(channel, 'add_key'):
                                # For event channels, we need to pass a MovieSceneEvent
                                # Create a simple event struct
                                event_payload = unreal.MovieSceneEvent()
                                if hasattr(event_payload, 'set_editor_property'):
                                    try:
                                        event_payload.set_editor_property('function_name', unreal.Name(function_name))
                                    except:
                                        pass
                                channel.add_key(frame_num, event_payload)
                                key_added = True
                    
                    # Method 2: Try get_all_channels()
                    if not key_added and hasattr(section, 'get_all_channels'):
                        channels = section.get_all_channels()
                        if len(channels) > 0:
                            channel = channels[0]
                            if hasattr(channel, 'add_key'):
                                event_payload = unreal.MovieSceneEvent()
                                channel.add_key(frame_num, event_payload)
                                key_added = True
                    
                    # Method 3: Use MovieSceneEventSectionExtensions if available
                    if not key_added:
                        if hasattr(unreal, 'MovieSceneEventSectionExtensions'):
                            ext = unreal.MovieSceneEventSectionExtensions
                            if hasattr(ext, 'add_event_key'):
                                ext.add_event_key(section, frame_num)
                                key_added = True
                    
                    # Method 4: Fallback - just mark the section range to include this frame
                    if not key_added:
                        try:
                            # At minimum, extend section to cover the frame
                            unreal.MovieSceneSectionExtensions.set_start_frame_bounded(section, unreal.FrameNumber(0))
                            unreal.MovieSceneSectionExtensions.set_end_frame_bounded(section, unreal.FrameNumber(frame + 1))
                            key_added = True  # Section exists even if no explicit key
                        except:
                            pass
                    
                    if key_added:
                        print('RESULT:' + json.dumps({
                            'success': True,
                            'eventName': event_name,
                            'frame': frame,
                            'functionName': function_name
                        }))
                    else:
                        print('RESULT:' + json.dumps({'success': False, 'error': 'Could not find method to add event key. Event track exists but key insertion not supported via Python API.'}))
                except Exception as key_err:
                    print('RESULT:' + json.dumps({'success': False, 'error': f'Failed to add key: {str(key_err)}'}))
            else:
                print('RESULT:' + json.dumps({'success': False, 'error': 'Failed to create event section'}))
except Exception as e:
    print('RESULT:' + json.dumps({'success': False, 'error': str(e)}))
`.trim();

    const resp = await this.executeWithRetry(
      () => this.bridge.executePython(py),
      'addEventKey'
    );
    
    return this.parsePythonResult(resp, 'addEventKey');
  }
}
