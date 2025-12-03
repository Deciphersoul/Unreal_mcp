/**
 * Shared utilities for tool handlers
 * Extracted from consolidated-tool-handlers.ts to reduce file sizes
 */

import { cleanObject } from '../../utils/safe-json.js';
import { Logger } from '../../utils/logger.js';

export const log = new Logger('ToolHandler');

export const ACTION_REQUIRED_ERROR = 'Missing required parameter: action';

export function ensureArgsPresent(args: any) {
  if (args === null || args === undefined) {
    throw new Error('Invalid arguments: null or undefined');
  }
}

export function requireAction(args: any): string {
  ensureArgsPresent(args);
  const action = args.action;
  if (typeof action !== 'string' || action.trim() === '') {
    throw new Error(ACTION_REQUIRED_ERROR);
  }
  return action;
}

export function requireNonEmptyString(value: any, field: string, message?: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message ?? `Invalid ${field}: must be a non-empty string`);
  }
  return value;
}

export function requirePositiveNumber(value: any, field: string, message?: string): number {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    throw new Error(message ?? `Invalid ${field}: must be a positive number`);
  }
  return value;
}

export function requireVector3Components(
  vector: any,
  message: string
): [number, number, number] {
  if (
    !vector ||
    typeof vector.x !== 'number' ||
    typeof vector.y !== 'number' ||
    typeof vector.z !== 'number'
  ) {
    throw new Error(message);
  }
  return [vector.x, vector.y, vector.z];
}

export function getElicitationTimeoutMs(tools: any): number | undefined {
  if (!tools) return undefined;
  const direct = tools.elicitationTimeoutMs;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct;
  }
  if (typeof tools.getElicitationTimeoutMs === 'function') {
    const value = tools.getElicitationTimeoutMs();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export async function elicitMissingPrimitiveArgs(
  tools: any,
  args: any,
  prompt: string,
  fieldSchemas: Record<string, { 
    type: 'string' | 'number' | 'integer' | 'boolean'; 
    title?: string; 
    description?: string; 
    enum?: string[]; 
    enumNames?: string[]; 
    minimum?: number; 
    maximum?: number; 
    minLength?: number; 
    maxLength?: number; 
    pattern?: string; 
    format?: string; 
    default?: unknown 
  }>
) {
  if (
    !tools ||
    typeof tools.supportsElicitation !== 'function' ||
    !tools.supportsElicitation() ||
    typeof tools.elicit !== 'function'
  ) {
    return;
  }

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, schema] of Object.entries(fieldSchemas)) {
    const value = args?.[key];
    const missing =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '');
    if (missing) {
      properties[key] = schema;
      required.push(key);
    }
  }

  if (required.length === 0) return;

  const timeoutMs = getElicitationTimeoutMs(tools);
  const options: any = {
    fallback: async () => ({ ok: false, error: 'missing-params' })
  };
  if (typeof timeoutMs === 'number') {
    options.timeoutMs = timeoutMs;
  }

  try {
    const elicited = await tools.elicit(
      prompt,
      { type: 'object', properties, required },
      options
    );

    if (elicited?.ok && elicited.value) {
      for (const key of required) {
        const value = elicited.value[key];
        if (value === undefined || value === null) continue;
        args[key] = typeof value === 'string' ? value.trim() : value;
      }
    }
  } catch (err) {
    log.debug('Special elicitation fallback skipped', {
      prompt,
      err: (err as any)?.message || String(err)
    });
  }
}

// Re-export cleanObject for convenience
export { cleanObject };

// Handler result type
export interface HandlerResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
  [key: string]: any;
}

// Tool context type passed to handlers
export interface ToolContext {
  actorTools: any;
  assetTools: any;
  editorTools: any;
  materialTools: any;
  animationTools: any;
  physicsTools: any;
  niagaraTools: any;
  blueprintTools: any;
  levelTools: any;
  lightingTools: any;
  landscapeTools: any;
  foliageTools: any;
  buildEnvAdvanced: any;
  debugTools: any;
  performanceTools: any;
  audioTools: any;
  uiTools: any;
  rcTools: any;
  sequenceTools: any;
  introspectionTools: any;
  visualTools: any;
  engineTools: any;
  logTools: any;
  queryLevelTools: any;
  manageSelectionTools: any;
  debugToolsExtended: any;
  editorLifecycleTools: any;
  projectBuildTools: any;
  cppTools: any;
  renderingTools: any;
  inputTools: any;
  collisionTools: any;
  assetResources: any;
  actorResources: any;
  levelResources: any;
  bridge: any;
  elicit: any;
  supportsElicitation: () => boolean;
  elicitationTimeoutMs?: number;
}
