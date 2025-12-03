import { UnrealBridge } from '../unreal-bridge.js';
import { interpretStandardResult, coerceString, coerceBoolean } from '../utils/result-helpers.js';
import { escapePythonString } from '../utils/python.js';

/**
 * Phase 7.5: Enhanced Input System Tool
 * 
 * Creates and manages UE5 Enhanced Input assets (InputAction, InputMappingContext).
 */
export class InputTools {
  constructor(private bridge: UnrealBridge) {}

  /**
   * Create an Input Action asset
   */
  async createInputAction(params: {
    name: string;
    savePath?: string;
    valueType?: 'Digital' | 'Axis1D' | 'Axis2D' | 'Axis3D';
    triggers?: Array<'Pressed' | 'Released' | 'Hold' | 'Tap' | 'Pulse'>;
    consumeInput?: boolean;
  }) {
    try {
      const savePath = params.savePath?.trim() || '/Game/Input';
      const valueType = params.valueType || 'Digital';
      const triggers = JSON.stringify(params.triggers || []);
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'path': None}

action_name = r"${escapePythonString(params.name)}"
save_path = r"${escapePythonString(savePath)}"
action_path = f"{save_path}/{action_name}"
value_type_str = r"${valueType}"
triggers = json.loads(r'''${triggers}''')

try:
    # Ensure directory exists
    if not unreal.EditorAssetLibrary.does_directory_exist(save_path):
        unreal.EditorAssetLibrary.make_directory(save_path)
    
    # Check if asset exists
    if unreal.EditorAssetLibrary.does_asset_exist(action_path):
        result['success'] = True
        result['path'] = action_path
        result['message'] = f"Input Action already exists at {action_path}"
        result['exists'] = True
    else:
        # Create Input Action - UE5.7 approach without factory
        asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
        
        # UE5.7: create_asset with None factory lets UE auto-detect
        action = asset_tools.create_asset(
            asset_name=action_name,
            package_path=save_path,
            asset_class=unreal.InputAction,
            factory=None
        )
        
        if action:
            # Set value type
            # UE5.7 enum naming: BOOLEAN, AXIS_1D, AXIS_2D, AXIS_3D
            # But try both formats in case of version differences
            value_type_map = {}
            try:
                value_type_map['Digital'] = unreal.InputActionValueType.BOOLEAN
            except:
                pass
            try:
                value_type_map['Axis1D'] = unreal.InputActionValueType.AXIS_1D
            except:
                try:
                    value_type_map['Axis1D'] = unreal.InputActionValueType.AXIS1D
                except:
                    pass
            try:
                value_type_map['Axis2D'] = unreal.InputActionValueType.AXIS_2D
            except:
                try:
                    value_type_map['Axis2D'] = unreal.InputActionValueType.AXIS2D
                except:
                    pass
            try:
                value_type_map['Axis3D'] = unreal.InputActionValueType.AXIS_3D
            except:
                try:
                    value_type_map['Axis3D'] = unreal.InputActionValueType.AXIS3D
                except:
                    pass
            
            if value_type_str in value_type_map:
                try:
                    action.set_editor_property('value_type', value_type_map[value_type_str])
                except Exception as vt_err:
                    result.setdefault('warnings', []).append(f"Could not set value_type: {vt_err}")
            else:
                # Report what types are available for debugging
                available = list(value_type_map.keys())
                result.setdefault('warnings', []).append(f"Value type '{value_type_str}' not in available types: {available}")
            
            # Set consume input
            ${params.consumeInput !== undefined ? `
            try:
                action.set_editor_property('consume_input', ${params.consumeInput})
            except:
                pass
            ` : ''}
            
            # Add triggers if specified
            if triggers:
                try:
                    trigger_list = []
                    for t in triggers:
                        if t == 'Pressed':
                            trigger_list.append(unreal.InputTriggerPressed())
                        elif t == 'Released':
                            trigger_list.append(unreal.InputTriggerReleased())
                        elif t == 'Hold':
                            trigger_list.append(unreal.InputTriggerHold())
                        elif t == 'Tap':
                            trigger_list.append(unreal.InputTriggerTap())
                        elif t == 'Pulse':
                            trigger_list.append(unreal.InputTriggerPulse())
                    
                    if trigger_list:
                        action.set_editor_property('triggers', trigger_list)
                except Exception as trigger_err:
                    result.setdefault('warnings', []).append(f"Could not set triggers: {trigger_err}")
            
            # Save
            unreal.EditorAssetLibrary.save_asset(action_path)
            
            result['success'] = True
            result['path'] = action_path
            result['message'] = f"Input Action created at {action_path}"
            result['valueType'] = value_type_str
        else:
            result['error'] = 'Failed to create Input Action asset'
            
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Input Action ${params.name} created`,
        failureMessage: 'Failed to create Input Action'
      });

      return {
        success: interpreted.success,
        path: coerceString(interpreted.payload.path),
        valueType: coerceString(interpreted.payload.valueType),
        exists: coerceBoolean(interpreted.payload.exists, false),
        message: interpreted.message,
        error: interpreted.error,
        warnings: interpreted.warnings
      };
    } catch (err) {
      return { success: false, error: `Failed to create Input Action: ${err}` };
    }
  }

  /**
   * Create an Input Mapping Context asset
   */
  async createInputMappingContext(params: {
    name: string;
    savePath?: string;
    priority?: number;
  }) {
    try {
      const savePath = params.savePath?.trim() || '/Game/Input';
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'path': None}

context_name = r"${escapePythonString(params.name)}"
save_path = r"${escapePythonString(savePath)}"
context_path = f"{save_path}/{context_name}"

try:
    # Ensure directory exists
    if not unreal.EditorAssetLibrary.does_directory_exist(save_path):
        unreal.EditorAssetLibrary.make_directory(save_path)
    
    # Check if asset exists
    if unreal.EditorAssetLibrary.does_asset_exist(context_path):
        result['success'] = True
        result['path'] = context_path
        result['message'] = f"Input Mapping Context already exists at {context_path}"
        result['exists'] = True
    else:
        # Create Input Mapping Context - UE5.7 approach without factory
        asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
        
        # UE5.7: create_asset with None factory lets UE auto-detect
        context = asset_tools.create_asset(
            asset_name=context_name,
            package_path=save_path,
            asset_class=unreal.InputMappingContext,
            factory=None
        )
        
        if context:
            unreal.EditorAssetLibrary.save_asset(context_path)
            result['success'] = True
            result['path'] = context_path
            result['message'] = f"Input Mapping Context created at {context_path}"
        else:
            result['error'] = 'Failed to create Input Mapping Context asset'
            
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Input Mapping Context ${params.name} created`,
        failureMessage: 'Failed to create Input Mapping Context'
      });

      return {
        success: interpreted.success,
        path: coerceString(interpreted.payload.path),
        exists: coerceBoolean(interpreted.payload.exists, false),
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to create Input Mapping Context: ${err}` };
    }
  }

  /**
   * Add a mapping to an Input Mapping Context
   */
  async addMapping(params: {
    contextPath: string;
    actionPath: string;
    key: string;  // e.g., "W", "SpaceBar", "Gamepad_FaceButton_Bottom"
    modifiers?: Array<'Shift' | 'Ctrl' | 'Alt' | 'Cmd' | 'Negate' | 'Swizzle' | 'DeadZone' | 'Smooth'>;
  }) {
    try {
      const modifiers = JSON.stringify(params.modifiers || []);
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': ''}

context_path = r"${escapePythonString(params.contextPath)}"
action_path = r"${escapePythonString(params.actionPath)}"
key_name = r"${escapePythonString(params.key)}"
modifiers = json.loads(r'''${modifiers}''')

try:
    # Load context
    context = unreal.EditorAssetLibrary.load_asset(context_path)
    if not context:
        result['error'] = f"Input Mapping Context not found: {context_path}"
    elif not isinstance(context, unreal.InputMappingContext):
        result['error'] = f"Asset is not an InputMappingContext: {context_path}"
    else:
        # Load action
        action = unreal.EditorAssetLibrary.load_asset(action_path)
        if not action:
            result['error'] = f"Input Action not found: {action_path}"
        elif not isinstance(action, unreal.InputAction):
            result['error'] = f"Asset is not an InputAction: {action_path}"
        else:
            # Create key mapping
            # UE5.7: unreal.Key() doesn't accept constructor args, use set_editor_property
            key = unreal.Key()
            key.set_editor_property('key_name', key_name)
            
            # Create mapping
            mapping = unreal.EnhancedActionKeyMapping()
            mapping.set_editor_property('action', action)
            mapping.set_editor_property('key', key)
            
            # Add modifiers if specified
            if modifiers:
                modifier_list = []
                for m in modifiers:
                    if m == 'Negate':
                        modifier_list.append(unreal.InputModifierNegate())
                    elif m == 'DeadZone':
                        modifier_list.append(unreal.InputModifierDeadZone())
                    elif m == 'Smooth':
                        modifier_list.append(unreal.InputModifierSmooth())
                    elif m == 'Swizzle':
                        modifier_list.append(unreal.InputModifierSwizzleAxis())
                    # Shift/Ctrl/Alt are handled differently (chorded triggers)
                
                if modifier_list:
                    mapping.set_editor_property('modifiers', modifier_list)
            
            # Get existing mappings
            existing_mappings = list(context.get_editor_property('mappings'))
            existing_mappings.append(mapping)
            context.set_editor_property('mappings', existing_mappings)
            
            # Save
            unreal.EditorAssetLibrary.save_asset(context_path)
            
            result['success'] = True
            result['message'] = f"Added mapping: {key_name} -> {action_path}"
            result['mappingCount'] = len(existing_mappings)
            
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Added mapping: ${params.key} -> ${params.actionPath}`,
        failureMessage: 'Failed to add mapping'
      });

      return {
        success: interpreted.success,
        mappingCount: interpreted.payload.mappingCount,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to add mapping: ${err}` };
    }
  }

  /**
   * Get all mappings from an Input Mapping Context
   */
  async getMappings(params: { contextPath: string }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'mappings': []}

context_path = r"${escapePythonString(params.contextPath)}"

try:
    context = unreal.EditorAssetLibrary.load_asset(context_path)
    if not context:
        result['error'] = f"Input Mapping Context not found: {context_path}"
    elif not isinstance(context, unreal.InputMappingContext):
        result['error'] = f"Asset is not an InputMappingContext: {context_path}"
    else:
        mappings = context.get_editor_property('mappings')
        for m in mappings:
            action = m.get_editor_property('action')
            key = m.get_editor_property('key')
            modifiers = m.get_editor_property('modifiers')
            triggers = m.get_editor_property('triggers')
            
            mapping_info = {
                'actionPath': action.get_path_name() if action else None,
                'key': str(key.key_name) if key else None,
                'modifierCount': len(modifiers) if modifiers else 0,
                'triggerCount': len(triggers) if triggers else 0
            }
            result['mappings'].append(mapping_info)
        
        result['success'] = True
        result['message'] = f"Found {len(result['mappings'])} mappings"
        
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Retrieved mappings',
        failureMessage: 'Failed to get mappings'
      });

      return {
        success: interpreted.success,
        mappings: interpreted.payload.mappings || [],
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to get mappings: ${err}` };
    }
  }

  /**
   * Remove a mapping from an Input Mapping Context
   */
  async removeMapping(params: {
    contextPath: string;
    key: string;  // Key to remove
    actionPath?: string;  // Optional: only remove if action matches
  }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'removedCount': 0}

context_path = r"${escapePythonString(params.contextPath)}"
key_name = r"${escapePythonString(params.key)}"
action_path = ${params.actionPath ? `r"${escapePythonString(params.actionPath)}"` : 'None'}

try:
    context = unreal.EditorAssetLibrary.load_asset(context_path)
    if not context:
        result['error'] = f"Input Mapping Context not found: {context_path}"
    elif not isinstance(context, unreal.InputMappingContext):
        result['error'] = f"Asset is not an InputMappingContext: {context_path}"
    else:
        mappings = list(context.get_editor_property('mappings'))
        original_count = len(mappings)
        
        # Filter out matching mappings
        new_mappings = []
        for m in mappings:
            key = m.get_editor_property('key')
            action = m.get_editor_property('action')
            
            key_matches = str(key.key_name).lower() == key_name.lower() if key else False
            action_matches = True
            if action_path and action:
                action_matches = action.get_path_name().lower() == action_path.lower()
            
            if not (key_matches and action_matches):
                new_mappings.append(m)
        
        removed_count = original_count - len(new_mappings)
        
        if removed_count > 0:
            context.set_editor_property('mappings', new_mappings)
            unreal.EditorAssetLibrary.save_asset(context_path)
            
        result['success'] = True
        result['removedCount'] = removed_count
        result['message'] = f"Removed {removed_count} mapping(s)"
        
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Mapping removed',
        failureMessage: 'Failed to remove mapping'
      });

      return {
        success: interpreted.success,
        removedCount: interpreted.payload.removedCount,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to remove mapping: ${err}` };
    }
  }

  /**
   * List all Input Action assets in a directory
   */
  async listInputActions(params: { directory?: string }) {
    try {
      const directory = params.directory?.trim() || '/Game';
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'actions': []}

directory = r"${escapePythonString(directory)}"

try:
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    
    # UE5.7: Use get_assets_by_class instead of ARFilter with package_paths
    # This gets ALL InputAction assets, then we filter by path
    all_assets = asset_registry.get_assets_by_class(unreal.TopLevelAssetPath('/Script/EnhancedInput', 'InputAction'))
    
    for asset_data in all_assets:
        try:
            package_name = str(asset_data.package_name)
            # Filter by directory
            if not package_name.startswith(directory):
                continue
                
            asset_name = str(asset_data.asset_name)
            path = f"{package_name}.{asset_name}"
            
            # Load to get value type
            asset = unreal.EditorAssetLibrary.load_asset(package_name)
            value_type = 'Unknown'
            if asset:
                try:
                    vt = asset.get_editor_property('value_type')
                    value_type = str(vt).split('.')[-1] if vt else 'Unknown'
                except:
                    pass
            
            result['actions'].append({
                'name': asset_name,
                'path': package_name,
                'valueType': value_type
            })
        except Exception as item_err:
            pass  # Skip problematic assets
    
    result['success'] = True
    result['message'] = f"Found {len(result['actions'])} Input Actions in {directory}"
    
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Listed Input Actions',
        failureMessage: 'Failed to list Input Actions'
      });

      return {
        success: interpreted.success,
        actions: interpreted.payload.actions || [],
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to list Input Actions: ${err}` };
    }
  }

  /**
   * List all Input Mapping Context assets in a directory
   */
  async listInputMappingContexts(params: { directory?: string }) {
    try {
      const directory = params.directory?.trim() || '/Game';
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'contexts': []}

directory = r"${escapePythonString(directory)}"

try:
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    
    # UE5.7: Use get_assets_by_class instead of ARFilter with package_paths
    all_assets = asset_registry.get_assets_by_class(unreal.TopLevelAssetPath('/Script/EnhancedInput', 'InputMappingContext'))
    
    for asset_data in all_assets:
        try:
            package_name = str(asset_data.package_name)
            # Filter by directory
            if not package_name.startswith(directory):
                continue
                
            asset_name = str(asset_data.asset_name)
            
            # Load to get mapping count
            asset = unreal.EditorAssetLibrary.load_asset(package_name)
            mapping_count = 0
            if asset:
                try:
                    mappings = asset.get_editor_property('mappings')
                    mapping_count = len(mappings) if mappings else 0
                except:
                    pass
            
            result['contexts'].append({
                'name': asset_name,
                'path': package_name,
                'mappingCount': mapping_count
            })
        except Exception as item_err:
            pass  # Skip problematic assets
    
    result['success'] = True
    result['message'] = f"Found {len(result['contexts'])} Input Mapping Contexts in {directory}"
    
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Listed Input Mapping Contexts',
        failureMessage: 'Failed to list Input Mapping Contexts'
      });

      return {
        success: interpreted.success,
        contexts: interpreted.payload.contexts || [],
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to list Input Mapping Contexts: ${err}` };
    }
  }
}
