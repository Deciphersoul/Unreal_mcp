/**
 * Viewmode handling utilities for safe view mode switching in Unreal Engine
 * Prevents crashes by validating and safely switching viewmodes
 */

/**
 * Unsafe viewmodes that can cause crashes or instability via visualizeBuffer
 */
export const UNSAFE_VIEWMODES = [
  'BaseColor', 'WorldNormal', 'Metallic', 'Specular',
  'Roughness',
  'SubsurfaceColor',
  'Opacity',
  'LightComplexity', 'LightmapDensity',
  'StationaryLightOverlap', 'CollisionPawn', 'CollisionVisibility'
];

/**
 * Hard-blocked viewmodes that will always be replaced with alternatives
 */
export const HARD_BLOCKED_VIEWMODES = new Set([
  'BaseColor', 'WorldNormal', 'Metallic', 'Specular', 'Roughness', 'SubsurfaceColor', 'Opacity'
]);

/**
 * Aliases for viewmode names (lowercase normalized -> canonical name)
 */
export const VIEWMODE_ALIASES = new Map<string, string>([
  ['lit', 'Lit'],
  ['unlit', 'Unlit'],
  ['wireframe', 'Wireframe'],
  ['brushwireframe', 'BrushWireframe'],
  ['brush_wireframe', 'BrushWireframe'],
  ['detaillighting', 'DetailLighting'],
  ['detail_lighting', 'DetailLighting'],
  ['lightingonly', 'LightingOnly'],
  ['lighting_only', 'LightingOnly'],
  ['lightonly', 'LightingOnly'],
  ['light_only', 'LightingOnly'],
  ['lightcomplexity', 'LightComplexity'],
  ['light_complexity', 'LightComplexity'],
  ['shadercomplexity', 'ShaderComplexity'],
  ['shader_complexity', 'ShaderComplexity'],
  ['lightmapdensity', 'LightmapDensity'],
  ['lightmap_density', 'LightmapDensity'],
  ['stationarylightoverlap', 'StationaryLightOverlap'],
  ['stationary_light_overlap', 'StationaryLightOverlap'],
  ['reflectionoverride', 'ReflectionOverride'],
  ['reflection_override', 'ReflectionOverride'],
  ['texeldensity', 'TexelDensity'],
  ['texel_density', 'TexelDensity'],
  ['vertexcolor', 'VertexColor'],
  ['vertex_color', 'VertexColor'],
  ['litdetail', 'DetailLighting'],
  ['lit_only', 'LightingOnly']
]);

/**
 * Safe alternatives for unsafe viewmodes
 */
const VIEWMODE_ALTERNATIVES: Record<string, string> = {
  'BaseColor': 'Unlit',
  'WorldNormal': 'Lit',
  'Metallic': 'Lit',
  'Specular': 'Lit',
  'Roughness': 'Lit',
  'SubsurfaceColor': 'Lit',
  'Opacity': 'Lit',
  'LightComplexity': 'LightingOnly',
  'ShaderComplexity': 'Wireframe',
  'CollisionPawn': 'Wireframe',
  'CollisionVisibility': 'Wireframe'
};

/**
 * Get safe alternative for unsafe viewmodes
 * @param unsafeMode The unsafe viewmode name
 * @returns A safe alternative viewmode name
 */
export function getSafeAlternative(unsafeMode: string): string {
  return VIEWMODE_ALTERNATIVES[unsafeMode] || 'Lit';
}

/**
 * Get a list of all accepted viewmode names
 * @returns Sorted array of accepted viewmode canonical names
 */
export function getAcceptedModes(): string[] {
  return Array.from(new Set(VIEWMODE_ALIASES.values())).sort();
}

/**
 * Normalize a viewmode input string to a key for lookup
 * @param mode Raw viewmode input
 * @returns Normalized key for VIEWMODE_ALIASES lookup
 */
export function normalizeViewmodeKey(mode: string): string {
  return mode.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Resolve a viewmode input to its canonical name
 * @param mode Raw viewmode input
 * @returns Canonical viewmode name or undefined if not found
 */
export function resolveViewmode(mode: string): string | undefined {
  const key = normalizeViewmodeKey(mode);
  return VIEWMODE_ALIASES.get(key);
}

/**
 * Check if a viewmode is hard-blocked
 * @param mode Canonical viewmode name
 * @returns true if the viewmode is hard-blocked
 */
export function isHardBlocked(mode: string): boolean {
  return HARD_BLOCKED_VIEWMODES.has(mode);
}

/**
 * Check if a viewmode is potentially unsafe
 * @param mode Canonical viewmode name
 * @returns true if the viewmode is unsafe
 */
export function isUnsafe(mode: string): boolean {
  return UNSAFE_VIEWMODES.includes(mode);
}

/**
 * Result of viewmode validation
 */
export interface ViewmodeValidationResult {
  valid: boolean;
  targetMode?: string;
  alternative?: string;
  error?: string;
  warning?: string;
  acceptedModes: string[];
}

/**
 * Validate a viewmode input and return resolution info
 * @param mode Raw viewmode input
 * @returns Validation result with resolved mode or error info
 */
export function validateViewmode(mode: string): ViewmodeValidationResult {
  const acceptedModes = getAcceptedModes();

  if (typeof mode !== 'string') {
    return {
      valid: false,
      error: 'View mode must be provided as a string',
      acceptedModes
    };
  }

  const key = normalizeViewmodeKey(mode);
  if (!key) {
    return {
      valid: false,
      error: 'View mode cannot be empty',
      acceptedModes
    };
  }

  const targetMode = VIEWMODE_ALIASES.get(key);
  if (!targetMode) {
    return {
      valid: false,
      error: `Unknown view mode '${mode}'`,
      acceptedModes
    };
  }

  if (isHardBlocked(targetMode)) {
    const alternative = getSafeAlternative(targetMode);
    return {
      valid: false,
      targetMode,
      alternative,
      error: `View mode '${targetMode}' is unsafe in remote sessions. Use '${alternative}' instead.`,
      acceptedModes
    };
  }

  const result: ViewmodeValidationResult = {
    valid: true,
    targetMode,
    acceptedModes
  };

  if (isUnsafe(targetMode)) {
    result.warning = `View mode '${targetMode}' may be unstable on some engine versions.`;
  }

  return result;
}
