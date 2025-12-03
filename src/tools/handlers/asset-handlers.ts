/**
 * Asset-related tool handlers
 * Handles: manage_asset, manage_material
 */

import {
  requireAction,
  requireNonEmptyString,
  elicitMissingPrimitiveArgs,
  cleanObject,
  ToolContext
} from './handler-utils.js';

export async function handleManageAsset(args: any, tools: ToolContext) {
  switch (requireAction(args)) {
    case 'list': {
      if (args.directory !== undefined && args.directory !== null && typeof args.directory !== 'string') {
        throw new Error('Invalid directory: must be a string');
      }
      const res = await tools.assetResources.list(args.directory || '/Game', false);
      return cleanObject({ success: true, ...res });
    }
    case 'import': {
      let sourcePath = typeof args.sourcePath === 'string' ? args.sourcePath.trim() : '';
      let destinationPath = typeof args.destinationPath === 'string' ? args.destinationPath.trim() : '';

      if ((!sourcePath || !destinationPath) && typeof tools.supportsElicitation === 'function' && tools.supportsElicitation() && typeof tools.elicit === 'function') {
        const schemaProps: Record<string, any> = {};
        const required: string[] = [];

        if (!sourcePath) {
          schemaProps.sourcePath = {
            type: 'string',
            title: 'Source File Path',
            description: 'Full path to the asset file on disk to import'
          };
          required.push('sourcePath');
        }

        if (!destinationPath) {
          schemaProps.destinationPath = {
            type: 'string',
            title: 'Destination Path',
            description: 'Content path where the asset should be imported'
          };
          required.push('destinationPath');
        }

        if (required.length > 0) {
          try {
            const elicited = await tools.elicit(
              'Provide the import details for manage_asset.import',
              { type: 'object', properties: schemaProps, required },
              { fallback: async () => ({ ok: false, error: 'missing-params' }) }
            );
            if (elicited?.ok && elicited.value) {
              if (elicited.value.sourcePath) sourcePath = String(elicited.value.sourcePath).trim();
              if (elicited.value.destinationPath) destinationPath = String(elicited.value.destinationPath).trim();
            }
          } catch {
            // Elicitation failed, continue with validation
          }
        }
      }

      const sourcePathValidated = requireNonEmptyString(sourcePath || args.sourcePath, 'sourcePath', 'Invalid sourcePath');
      const destinationPathValidated = requireNonEmptyString(destinationPath || args.destinationPath, 'destinationPath', 'Invalid destinationPath');
      const res = await tools.assetTools.importAsset(sourcePathValidated, destinationPathValidated);
      return cleanObject(res);
    }
    case 'create_material': {
      await elicitMissingPrimitiveArgs(
        tools,
        args,
        'Provide the material details for manage_asset.create_material',
        {
          name: {
            type: 'string',
            title: 'Material Name',
            description: 'Name for the new material asset'
          },
          path: {
            type: 'string',
            title: 'Save Path',
            description: 'Optional Unreal content path where the material should be saved'
          }
        }
      );
      const sanitizedName = typeof args.name === 'string' ? args.name.trim() : args.name;
      const sanitizedPath = typeof args.path === 'string' ? args.path.trim() : args.path;
      const name = requireNonEmptyString(sanitizedName, 'name', 'Invalid name: must be a non-empty string');
      const res = await tools.materialTools.createMaterial(name, sanitizedPath || '/Game/Materials');
      return cleanObject(res);
    }
    default:
      throw new Error(`Unknown asset action: ${args.action}`);
  }
}

export async function handleManageMaterial(args: any, tools: ToolContext) {
  switch (requireAction(args)) {
    case 'create_instance': {
      await elicitMissingPrimitiveArgs(
        tools,
        args,
        'Provide details for manage_material.create_instance',
        {
          name: {
            type: 'string',
            title: 'Instance Name',
            description: 'Name for the new Material Instance'
          },
          parentMaterial: {
            type: 'string',
            title: 'Parent Material',
            description: 'Content path to parent material'
          }
        }
      );
      const name = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
      const parentMaterial = requireNonEmptyString(args.parentMaterial, 'parentMaterial', 'Missing required parameter: parentMaterial');
      const res = await tools.materialTools.createMaterialInstance({
        name,
        parentMaterial,
        savePath: args.savePath,
        scalarParameters: args.scalarParameters,
        vectorParameters: args.vectorParameters,
        textureParameters: args.textureParameters
      });
      return cleanObject(res);
    }
    case 'set_scalar': {
      const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
      const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
      if (args.scalarValue === undefined) throw new Error('Missing required parameter: scalarValue');
      const res = await tools.materialTools.setScalarParameter({
        materialPath,
        parameterName,
        value: args.scalarValue
      });
      return cleanObject(res);
    }
    case 'set_vector': {
      const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
      const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
      if (!args.vectorValue) throw new Error('Missing required parameter: vectorValue');
      const res = await tools.materialTools.setVectorParameter({
        materialPath,
        parameterName,
        value: args.vectorValue
      });
      return cleanObject(res);
    }
    case 'set_texture': {
      const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
      const parameterName = requireNonEmptyString(args.parameterName, 'parameterName', 'Missing required parameter: parameterName');
      const texturePath = requireNonEmptyString(args.texturePath, 'texturePath', 'Missing required parameter: texturePath');
      const res = await tools.materialTools.setTextureParameter({
        materialPath,
        parameterName,
        texturePath
      });
      return cleanObject(res);
    }
    case 'get_parameters': {
      const materialPath = requireNonEmptyString(args.materialPath, 'materialPath', 'Missing required parameter: materialPath');
      const res = await tools.materialTools.getParameters({ materialPath });
      return cleanObject(res);
    }
    case 'copy': {
      const sourcePath = requireNonEmptyString(args.sourcePath, 'sourcePath', 'Missing required parameter: sourcePath');
      const name = requireNonEmptyString(args.name, 'name', 'Missing required parameter: name');
      const res = await tools.materialTools.copyMaterialInstance({
        sourcePath,
        name,
        savePath: args.savePath,
        overrideScalars: args.overrideScalars,
        overrideVectors: args.overrideVectors
      });
      return cleanObject(res);
    }
    default:
      throw new Error(`Unknown manage_material action: ${args.action}`);
  }
}
