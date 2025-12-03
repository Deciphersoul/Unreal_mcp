import { UnrealBridge } from '../unreal-bridge.js';
import { coerceBoolean, interpretStandardResult, coerceString, coerceNumber } from '../utils/result-helpers.js';
import { escapePythonString } from '../utils/python.js';

/**
 * Material parameter types for Material Instances
 */
export interface ScalarParameter {
  name: string;
  value: number;
}

export interface VectorParameter {
  name: string;
  value: { r: number; g: number; b: number; a?: number };
}

export interface TextureParameter {
  name: string;
  texturePath: string;
}

export interface MaterialInstanceParams {
  name: string;
  parentMaterial: string;
  savePath?: string;
  scalarParameters?: ScalarParameter[];
  vectorParameters?: VectorParameter[];
  textureParameters?: TextureParameter[];
}

export class MaterialTools {
  constructor(private bridge: UnrealBridge) {}

  async createMaterial(name: string, path: string) {
    try {
      if (!name || name.trim() === '') {
        return { success: false, error: 'Material name cannot be empty' };
      }

      if (name.length > 100) {
        return { success: false, error: `Material name too long (${name.length} chars). Maximum is 100 characters.` };
      }

      const invalidChars = /[\s./<>|{}[\]()@#\\]/;
      if (invalidChars.test(name)) {
        const foundChars = name.match(invalidChars);
        return { success: false, error: `Material name contains invalid characters: '${foundChars?.[0]}'. Avoid spaces, dots, slashes, backslashes, brackets, and special symbols.` };
      }

      if (typeof path !== 'string') {
        return { success: false, error: `Invalid path type: expected string, got ${typeof path}` };
      }

      const trimmedPath = path.trim();
      const effectivePath = trimmedPath.length === 0 ? '/Game' : trimmedPath;
      const cleanPath = effectivePath.replace(/\/$/, '');

      if (!cleanPath.startsWith('/Game') && !cleanPath.startsWith('/Engine')) {
        return { success: false, error: `Invalid path: must start with /Game or /Engine, got ${cleanPath}` };
      }

      const normalizedPath = cleanPath.toLowerCase();
      const restrictedPrefixes = ['/engine/restricted', '/engine/generated', '/engine/transient'];
      if (restrictedPrefixes.some(prefix => normalizedPath.startsWith(prefix))) {
        const errorMessage = `Destination path is read-only and cannot be used for material creation: ${cleanPath}`;
        return { success: false, error: errorMessage, message: errorMessage };
      }

    const materialPath = `${cleanPath}/${name}`;
    const payload = { name, cleanPath, materialPath };
    const escapedName = escapePythonString(name);
      const pythonCode = `
import unreal, json

payload = json.loads(r'''${JSON.stringify(payload)}''')
result = {
    'success': False,
    'message': '',
    'error': '',
    'warnings': [],
    'details': [],
    'name': payload.get('name') or "${escapedName}",
    'path': payload.get('materialPath')
}

material_path = result['path']
clean_path = payload.get('cleanPath') or '/Game'

try:
    if unreal.EditorAssetLibrary.does_asset_exist(material_path):
        result['success'] = True
        result['exists'] = True
        result['message'] = f"Material already exists at {material_path}"
    else:
        asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
        factory = unreal.MaterialFactoryNew()
        asset = asset_tools.create_asset(
            asset_name=payload.get('name'),
            package_path=clean_path,
            asset_class=unreal.Material,
            factory=factory
        )
        if asset:
            unreal.EditorAssetLibrary.save_asset(material_path)
            result['success'] = True
            result['created'] = True
            result['message'] = f"Material created at {material_path}"
        else:
            result['error'] = 'Failed to create material'
            result['message'] = result['error']
except Exception as exc:
    result['error'] = str(exc)
    if not result['message']:
        result['message'] = result['error']

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Material ${name} processed`,
        failureMessage: 'Failed to create material'
      });

      if (interpreted.success) {
        const exists = coerceBoolean(interpreted.payload.exists, false) === true;
        const created = coerceBoolean(interpreted.payload.created, false) === true;
        if (exists) {
          return { success: true, path: materialPath, message: `Material ${name} already exists at ${materialPath}` };
        }
        if (created) {
          return { success: true, path: materialPath, message: `Material ${name} created at ${materialPath}` };
        }
        return { success: true, path: materialPath, message: interpreted.message };
      }

      if (interpreted.error) {
        const exists = await this.assetExists(materialPath);
        if (exists) {
          return {
            success: true,
            path: materialPath,
            message: `Material ${name} created at ${materialPath}`,
            warnings: interpreted.warnings,
            details: interpreted.details
          };
        }
        return {
          success: false,
          error: interpreted.error,
          warnings: interpreted.warnings,
          details: interpreted.details
        };
      }

      const exists = await this.assetExists(materialPath);
      if (exists) {
        return {
          success: true,
          path: materialPath,
          message: `Material ${name} created at ${materialPath}`,
          warnings: interpreted.warnings,
          details: interpreted.details
        };
      }

      return {
        success: false,
        error: interpreted.message,
        warnings: interpreted.warnings,
        details: interpreted.details
      };
    } catch (err) {
      return { success: false, error: `Failed to create material: ${err}` };
    }
  }

  async applyMaterialToActor(actorPath: string, materialPath: string, slotIndex = 0) {
    try {
      await this.bridge.httpCall('/remote/object/property', 'PUT', {
        objectPath: actorPath,
        propertyName: `StaticMeshComponent.Materials[${slotIndex}]`,
        propertyValue: materialPath
      });
      return { success: true, message: 'Material applied' };
    } catch (err) {
      return { success: false, error: `Failed to apply material: ${err}` };
    }
  }

  private async assetExists(assetPath: string): Promise<boolean> {
    try {
      const response = await this.bridge.call({
        objectPath: '/Script/EditorScriptingUtilities.Default__EditorAssetLibrary',
        functionName: 'DoesAssetExist',
        parameters: {
          AssetPath: assetPath
        }
      });
      return coerceBoolean(response?.ReturnValue ?? response?.Result ?? response, false) === true;
    } catch {
      return false;
    }
  }

  // ==================== PHASE 7.6: MATERIAL INSTANCES ====================

  /**
   * Create a Material Instance from a parent material
   */
  async createMaterialInstance(params: MaterialInstanceParams) {
    try {
      if (!params.name || params.name.trim() === '') {
        return { success: false, error: 'Material Instance name cannot be empty' };
      }

      if (!params.parentMaterial || params.parentMaterial.trim() === '') {
        return { success: false, error: 'Parent material path is required' };
      }

      const savePath = params.savePath?.trim() || '/Game/Materials';
      const instancePath = `${savePath}/${params.name}`;
      
      // Prepare parameters for Python
      const scalarParams = JSON.stringify(params.scalarParameters || []);
      const vectorParams = JSON.stringify(params.vectorParameters || []);
      const textureParams = JSON.stringify(params.textureParameters || []);

      const pythonCode = `
import unreal, json

result = {
    'success': False,
    'message': '',
    'error': '',
    'path': None,
    'parametersSet': []
}

parent_path = r"${escapePythonString(params.parentMaterial)}"
instance_name = r"${escapePythonString(params.name)}"
save_path = r"${escapePythonString(savePath)}"
instance_path = f"{save_path}/{instance_name}"

scalar_params = json.loads(r'''${scalarParams}''')
vector_params = json.loads(r'''${vectorParams}''')
texture_params = json.loads(r'''${textureParams}''')

try:
    # Check if parent material exists
    if not unreal.EditorAssetLibrary.does_asset_exist(parent_path):
        result['error'] = f"Parent material not found: {parent_path}"
        result['message'] = result['error']
    else:
        # Load parent material
        parent = unreal.EditorAssetLibrary.load_asset(parent_path)
        if not parent:
            result['error'] = f"Failed to load parent material: {parent_path}"
            result['message'] = result['error']
        elif not isinstance(parent, (unreal.Material, unreal.MaterialInstance)):
            result['error'] = f"Asset is not a material: {parent_path}"
            result['message'] = result['error']
        else:
            # Create Material Instance
            asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
            factory = unreal.MaterialInstanceConstantFactoryNew()
            
            # Ensure directory exists
            if not unreal.EditorAssetLibrary.does_directory_exist(save_path):
                unreal.EditorAssetLibrary.make_directory(save_path)
            
            # Create the material instance
            mi = asset_tools.create_asset(
                asset_name=instance_name,
                package_path=save_path,
                asset_class=unreal.MaterialInstanceConstant,
                factory=factory
            )
            
            if mi:
                # Set parent material
                mi.set_editor_property('parent', parent)
                
                # Set scalar parameters
                for param in scalar_params:
                    try:
                        mi.set_scalar_parameter_value_editor_only(param['name'], param['value'])
                        result['parametersSet'].append({'type': 'scalar', 'name': param['name']})
                    except Exception as e:
                        result.setdefault('warnings', []).append(f"Failed to set scalar {param['name']}: {e}")
                
                # Set vector parameters
                for param in vector_params:
                    try:
                        v = param['value']
                        color = unreal.LinearColor(v.get('r', 0), v.get('g', 0), v.get('b', 0), v.get('a', 1))
                        mi.set_vector_parameter_value_editor_only(param['name'], color)
                        result['parametersSet'].append({'type': 'vector', 'name': param['name']})
                    except Exception as e:
                        result.setdefault('warnings', []).append(f"Failed to set vector {param['name']}: {e}")
                
                # Set texture parameters
                for param in texture_params:
                    try:
                        tex = unreal.EditorAssetLibrary.load_asset(param['texturePath'])
                        if tex and isinstance(tex, unreal.Texture):
                            mi.set_texture_parameter_value_editor_only(param['name'], tex)
                            result['parametersSet'].append({'type': 'texture', 'name': param['name']})
                        else:
                            result.setdefault('warnings', []).append(f"Texture not found: {param['texturePath']}")
                    except Exception as e:
                        result.setdefault('warnings', []).append(f"Failed to set texture {param['name']}: {e}")
                
                # Save the asset
                unreal.EditorAssetLibrary.save_asset(instance_path)
                
                result['success'] = True
                result['path'] = instance_path
                result['message'] = f"Material Instance created at {instance_path}"
            else:
                result['error'] = 'Failed to create Material Instance'
                result['message'] = result['error']
                
except Exception as e:
    result['error'] = str(e)
    result['message'] = result['error']

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Material Instance ${params.name} created`,
        failureMessage: 'Failed to create Material Instance'
      });

      if (interpreted.success) {
        return {
          success: true,
          path: coerceString(interpreted.payload.path) ?? instancePath,
          parametersSet: interpreted.payload.parametersSet || [],
          message: interpreted.message,
          warnings: interpreted.warnings
        };
      }

      return {
        success: false,
        error: interpreted.error ?? 'Failed to create Material Instance',
        warnings: interpreted.warnings
      };
    } catch (err) {
      return { success: false, error: `Failed to create Material Instance: ${err}` };
    }
  }

  /**
   * Set a scalar (float) parameter on a Material Instance
   */
  async setScalarParameter(params: { materialPath: string; parameterName: string; value: number }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': ''}

mi_path = r"${escapePythonString(params.materialPath)}"
param_name = r"${escapePythonString(params.parameterName)}"
value = ${params.value}

try:
    mi = unreal.EditorAssetLibrary.load_asset(mi_path)
    if not mi:
        result['error'] = f"Material Instance not found: {mi_path}"
    elif not isinstance(mi, unreal.MaterialInstanceConstant):
        result['error'] = f"Asset is not a Material Instance: {mi_path}"
    else:
        mi.set_scalar_parameter_value_editor_only(param_name, value)
        unreal.EditorAssetLibrary.save_asset(mi_path)
        result['success'] = True
        result['message'] = f"Set {param_name} = {value}"
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Set ${params.parameterName} = ${params.value}`,
        failureMessage: 'Failed to set scalar parameter'
      });

      return {
        success: interpreted.success,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to set scalar parameter: ${err}` };
    }
  }

  /**
   * Set a vector (color) parameter on a Material Instance
   */
  async setVectorParameter(params: { materialPath: string; parameterName: string; value: { r: number; g: number; b: number; a?: number } }) {
    try {
      const { r, g, b, a = 1 } = params.value;
      
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': ''}

mi_path = r"${escapePythonString(params.materialPath)}"
param_name = r"${escapePythonString(params.parameterName)}"
color = unreal.LinearColor(${r}, ${g}, ${b}, ${a})

try:
    mi = unreal.EditorAssetLibrary.load_asset(mi_path)
    if not mi:
        result['error'] = f"Material Instance not found: {mi_path}"
    elif not isinstance(mi, unreal.MaterialInstanceConstant):
        result['error'] = f"Asset is not a Material Instance: {mi_path}"
    else:
        mi.set_vector_parameter_value_editor_only(param_name, color)
        unreal.EditorAssetLibrary.save_asset(mi_path)
        result['success'] = True
        result['message'] = f"Set {param_name} = ({${r}}, {${g}}, {${b}}, {${a}})"
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Set ${params.parameterName}`,
        failureMessage: 'Failed to set vector parameter'
      });

      return {
        success: interpreted.success,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to set vector parameter: ${err}` };
    }
  }

  /**
   * Set a texture parameter on a Material Instance
   */
  async setTextureParameter(params: { materialPath: string; parameterName: string; texturePath: string }) {
    try {
      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': ''}

mi_path = r"${escapePythonString(params.materialPath)}"
param_name = r"${escapePythonString(params.parameterName)}"
tex_path = r"${escapePythonString(params.texturePath)}"

try:
    mi = unreal.EditorAssetLibrary.load_asset(mi_path)
    if not mi:
        result['error'] = f"Material Instance not found: {mi_path}"
    elif not isinstance(mi, unreal.MaterialInstanceConstant):
        result['error'] = f"Asset is not a Material Instance: {mi_path}"
    else:
        tex = unreal.EditorAssetLibrary.load_asset(tex_path)
        if not tex:
            result['error'] = f"Texture not found: {tex_path}"
        elif not isinstance(tex, unreal.Texture):
            result['error'] = f"Asset is not a Texture: {tex_path}"
        else:
            mi.set_texture_parameter_value_editor_only(param_name, tex)
            unreal.EditorAssetLibrary.save_asset(mi_path)
            result['success'] = True
            result['message'] = f"Set {param_name} = {tex_path}"
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Set ${params.parameterName}`,
        failureMessage: 'Failed to set texture parameter'
      });

      return {
        success: interpreted.success,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to set texture parameter: ${err}` };
    }
  }

  /**
   * Get all parameters from a Material Instance
   */
  async getParameters(params: { materialPath: string }) {
    try {
      const pythonCode = `
import unreal, json

result = {
    'success': False,
    'message': '',
    'error': '',
    'scalarParameters': [],
    'vectorParameters': [],
    'textureParameters': []
}

mi_path = r"${escapePythonString(params.materialPath)}"

try:
    mi = unreal.EditorAssetLibrary.load_asset(mi_path)
    if not mi:
        result['error'] = f"Material not found: {mi_path}"
    elif isinstance(mi, unreal.MaterialInstanceConstant):
        # Get scalar parameters
        scalars = mi.get_editor_property('scalar_parameter_values')
        if scalars:
            for param in scalars:
                info = param.get_editor_property('parameter_info')
                result['scalarParameters'].append({
                    'name': str(info.get_editor_property('name')),
                    'value': param.get_editor_property('parameter_value')
                })
        
        # Get vector parameters  
        vectors = mi.get_editor_property('vector_parameter_values')
        if vectors:
            for param in vectors:
                info = param.get_editor_property('parameter_info')
                val = param.get_editor_property('parameter_value')
                result['vectorParameters'].append({
                    'name': str(info.get_editor_property('name')),
                    'value': {'r': val.r, 'g': val.g, 'b': val.b, 'a': val.a}
                })
        
        # Get texture parameters
        textures = mi.get_editor_property('texture_parameter_values')
        if textures:
            for param in textures:
                info = param.get_editor_property('parameter_info')
                tex = param.get_editor_property('parameter_value')
                result['textureParameters'].append({
                    'name': str(info.get_editor_property('name')),
                    'texturePath': tex.get_path_name() if tex else None
                })
        
        result['success'] = True
        result['message'] = f"Found {len(result['scalarParameters'])} scalar, {len(result['vectorParameters'])} vector, {len(result['textureParameters'])} texture parameters"
    elif isinstance(mi, unreal.Material):
        result['success'] = True
        result['message'] = "This is a base Material, not a Material Instance. Cannot get overridden parameters."
        result['isMaterial'] = True
    else:
        result['error'] = f"Asset is not a Material or Material Instance: {mi_path}"
        
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: 'Retrieved material parameters',
        failureMessage: 'Failed to get parameters'
      });

      if (interpreted.success) {
        return {
          success: true,
          scalarParameters: interpreted.payload.scalarParameters || [],
          vectorParameters: interpreted.payload.vectorParameters || [],
          textureParameters: interpreted.payload.textureParameters || [],
          isMaterial: interpreted.payload.isMaterial || false,
          message: interpreted.message
        };
      }

      return {
        success: false,
        error: interpreted.error ?? 'Failed to get parameters'
      };
    } catch (err) {
      return { success: false, error: `Failed to get parameters: ${err}` };
    }
  }

  /**
   * Copy a Material Instance with optional parameter overrides
   */
  async copyMaterialInstance(params: {
    sourcePath: string;
    newName: string;
    savePath?: string;
    overrideScalars?: ScalarParameter[];
    overrideVectors?: VectorParameter[];
  }) {
    try {
      const savePath = params.savePath?.trim() || '/Game/Materials';
      const destPath = `${savePath}/${params.newName}`;
      
      const overrideScalars = JSON.stringify(params.overrideScalars || []);
      const overrideVectors = JSON.stringify(params.overrideVectors || []);

      const pythonCode = `
import unreal, json

result = {'success': False, 'message': '', 'error': '', 'path': None}

source_path = r"${escapePythonString(params.sourcePath)}"
new_name = r"${escapePythonString(params.newName)}"
save_path = r"${escapePythonString(savePath)}"
dest_path = f"{save_path}/{new_name}"

override_scalars = json.loads(r'''${overrideScalars}''')
override_vectors = json.loads(r'''${overrideVectors}''')

try:
    # Duplicate the asset
    if unreal.EditorAssetLibrary.duplicate_asset(source_path, dest_path):
        result['path'] = dest_path
        
        # Apply overrides if any
        mi = unreal.EditorAssetLibrary.load_asset(dest_path)
        if mi and isinstance(mi, unreal.MaterialInstanceConstant):
            for param in override_scalars:
                try:
                    mi.set_scalar_parameter_value_editor_only(param['name'], param['value'])
                except:
                    pass
                    
            for param in override_vectors:
                try:
                    v = param['value']
                    color = unreal.LinearColor(v.get('r', 0), v.get('g', 0), v.get('b', 0), v.get('a', 1))
                    mi.set_vector_parameter_value_editor_only(param['name'], color)
                except:
                    pass
            
            unreal.EditorAssetLibrary.save_asset(dest_path)
        
        result['success'] = True
        result['message'] = f"Material Instance copied to {dest_path}"
    else:
        result['error'] = f"Failed to duplicate {source_path}"
        
except Exception as e:
    result['error'] = str(e)

print('RESULT:' + json.dumps(result))
`.trim();

      const pyResult = await this.bridge.executePython(pythonCode);
      const interpreted = interpretStandardResult(pyResult, {
        successMessage: `Material Instance copied to ${destPath}`,
        failureMessage: 'Failed to copy Material Instance'
      });

      return {
        success: interpreted.success,
        path: coerceString(interpreted.payload.path) ?? destPath,
        message: interpreted.message,
        error: interpreted.error
      };
    } catch (err) {
      return { success: false, error: `Failed to copy Material Instance: ${err}` };
    }
  }
}
