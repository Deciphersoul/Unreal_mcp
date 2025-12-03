/**
 * Safe console commands for common Unreal Engine operations
 * These commands are validated as safe and won't cause crashes or data loss
 */

/**
 * Dictionary of safe console commands categorized by function
 */
export const SAFE_COMMANDS: Record<string, string> = {
  // Health check (safe, no side effects)
  'HealthCheck': 'echo MCP Server Health Check',
  
  // Performance monitoring (safe)
  'ShowFPS': 'stat unit',  // Use 'stat unit' instead of 'stat fps'
  'ShowMemory': 'stat memory',
  'ShowGame': 'stat game',
  'ShowRendering': 'stat scenerendering',
  'ClearStats': 'stat none',
  
  // Safe viewmodes
  'ViewLit': 'viewmode lit',
  'ViewUnlit': 'viewmode unlit',
  'ViewWireframe': 'viewmode wireframe',
  'ViewDetailLighting': 'viewmode detaillighting',
  'ViewLightingOnly': 'viewmode lightingonly',
  
  // Safe show flags
  'ShowBounds': 'show bounds',
  'ShowCollision': 'show collision',
  'ShowNavigation': 'show navigation',
  'ShowFog': 'show fog',
  'ShowGrid': 'show grid',
  
  // PIE controls
  'PlayInEditor': 'play',
  'StopPlay': 'stop',
  'PausePlay': 'pause',
  
  // Time control
  'SlowMotion': 'slomo 0.5',
  'NormalSpeed': 'slomo 1',
  'FastForward': 'slomo 2',
  
  // Camera controls
  'CameraSpeed1': 'camspeed 1',
  'CameraSpeed4': 'camspeed 4',
  'CameraSpeed8': 'camspeed 8',
  
  // Rendering quality (safe)
  'LowQuality': 'sg.ViewDistanceQuality 0',
  'MediumQuality': 'sg.ViewDistanceQuality 1',
  'HighQuality': 'sg.ViewDistanceQuality 2',
  'EpicQuality': 'sg.ViewDistanceQuality 3'
};

/**
 * Commands that are known to cause crashes and should never be executed
 */
export const CRASH_COMMANDS = [
  'buildpaths',           // Causes access violation 0x0000000000000060
  'rebuildnavigation',    // Can crash without nav system
  'buildhierarchicallod', // Can crash without proper setup
  'buildlandscapeinfo',   // Can crash without landscape
  'rebuildselectednavigation' // Nav-related crash
];

/**
 * Commands that are dangerous and should be blocked
 */
export const DANGEROUS_COMMANDS = [
  'quit', 'exit', 'delete', 'destroy', 'kill', 'crash',
  'viewmode visualizebuffer basecolor',
  'viewmode visualizebuffer worldnormal',
  'r.gpucrash'
];

/**
 * Patterns that indicate dangerous command content
 */
export const DANGEROUS_PATTERNS = [
  'quit', 'exit', 'r.gpucrash', 'debug crash',
  'viewmode visualizebuffer' // These can crash in certain states
];

/**
 * Forbidden tokens that should never appear in commands
 */
export const FORBIDDEN_TOKENS = [
  'rm ', 'rm-', 'del ', 'format ', 'shutdown', 'reboot',
  'rmdir', 'mklink', 'copy ', 'move ', 'start "', 'system(',
  'import os', 'import subprocess', 'subprocess.', 'os.system',
  'exec(', 'eval(', '__import__', 'import sys', 'import importlib',
  'with open', 'open('
];

/**
 * Check if a command is in the crash commands list
 */
export function isCrashCommand(command: string): boolean {
  const cmdLower = command.trim().toLowerCase();
  return CRASH_COMMANDS.some(dangerous => 
    cmdLower === dangerous || cmdLower.startsWith(dangerous + ' ')
  );
}

/**
 * Check if a command contains dangerous patterns
 */
export function isDangerousCommand(command: string): boolean {
  const cmdLower = command.trim().toLowerCase();
  return DANGEROUS_PATTERNS.some(pattern => cmdLower.includes(pattern));
}

/**
 * Check if a command contains forbidden tokens
 */
export function containsForbiddenToken(command: string): boolean {
  const cmdLower = command.trim().toLowerCase();
  return FORBIDDEN_TOKENS.some(token => cmdLower.includes(token));
}

/**
 * Get a safe command by name
 */
export function getSafeCommand(name: string): string | undefined {
  return SAFE_COMMANDS[name];
}

/**
 * Get all safe command names
 */
export function getSafeCommandNames(): string[] {
  return Object.keys(SAFE_COMMANDS);
}
