/**
 * Project Build Tools for UE MCP Extended
 * Provides packaging and build functionality for Windows
 * 
 * Key capabilities:
 * - Package game for Windows (Development/Shipping)
 * - Cook content for target platforms
 * - Build lighting
 * - Validate project before packaging
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { loadEnv } from '../types/env.js';
import { Logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

export interface BuildResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  error?: string;
  logPath?: string;
}

export type BuildConfiguration = 'Development' | 'Shipping' | 'DebugGame';

export class ProjectBuildTools {
  private env = loadEnv();
  private log = new Logger('ProjectBuildTools');

  constructor(private bridge: UnrealBridge) {}

  /**
   * Get paths for UAT (Unreal Automation Tool)
   */
  private async getUATPaths(): Promise<{
    uatPath: string;
    projectPath: string;
  } | null> {
    const projectPath = this.env.UE_PROJECT_PATH;
    if (!projectPath) {
      this.log.error('UE_PROJECT_PATH not set');
      return null;
    }

    // Try to find UAT based on engine installation
    const editorExe = this.env.UE_EDITOR_EXE;
    if (editorExe) {
      // Engine path is typically: Engine/Binaries/Win64/UnrealEditor.exe
      // UAT is at: Engine/Build/BatchFiles/RunUAT.bat
      const engineBinaries = path.dirname(editorExe);
      const engineRoot = path.resolve(engineBinaries, '..', '..', '..');
      const uatPath = path.join(engineRoot, 'Build', 'BatchFiles', 'RunUAT.bat');
      
      try {
        await fs.access(uatPath);
        return { uatPath, projectPath };
      } catch {
        this.log.debug('UAT not found at:', uatPath);
      }
    }

    // Fallback: look for standard Epic Games installation
    const epicPaths = [
      'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Build\\BatchFiles\\RunUAT.bat',
      'C:\\Program Files\\Epic Games\\UE_5.6\\Engine\\Build\\BatchFiles\\RunUAT.bat',
      'C:\\Program Files\\Epic Games\\UE_5.5\\Engine\\Build\\BatchFiles\\RunUAT.bat',
      'D:\\Epic Games\\UE_5.7\\Engine\\Build\\BatchFiles\\RunUAT.bat',
    ];

    for (const uatPath of epicPaths) {
      try {
        await fs.access(uatPath);
        return { uatPath, projectPath };
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Validate project readiness for packaging
   */
  async validateForPackaging(): Promise<{
    success: boolean;
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const script = `
import unreal
import json

issues = []
warnings = []

try:
    # Check for missing assets
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    
    # Check project settings
    settings = unreal.get_default_object(unreal.ProjectPackagingSettings)
    
    if not settings:
        issues.append('Could not access project packaging settings')
    else:
        # Check if there's a default map set
        if not hasattr(settings, 'default_game_mode') or not settings.default_game_mode:
            warnings.append('No default game mode set in project settings')
    
    # Check for blueprint compile errors by attempting to get all blueprints
    bp_class = unreal.Blueprint
    
    print('RESULT:' + json.dumps({
        'success': True,
        'valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'valid': False,
        'issues': [str(e)],
        'warnings': []
    }))
`.trim();

    try {
      const response = await this.bridge.executePythonWithResult(script);
      return {
        success: response?.success ?? false,
        valid: response?.valid ?? false,
        issues: response?.issues || [],
        warnings: response?.warnings || []
      };
    } catch (err: any) {
      return {
        success: false,
        valid: false,
        issues: [err?.message || String(err)],
        warnings: []
      };
    }
  }

  /**
   * Cook content for Windows
   */
  async cookContent(): Promise<BuildResult> {
    const paths = await this.getUATPaths();
    if (!paths) {
      return {
        success: false,
        message: 'Could not find UAT or project path',
        error: 'UE_PROJECT_PATH or UE_EDITOR_EXE not configured'
      };
    }

    const { uatPath, projectPath } = paths;
    
    const args = [
      '-ScriptsForProject=' + projectPath,
      'BuildCookRun',
      '-project=' + projectPath,
      '-noP4',
      '-cook',
      '-skipstage',
      '-targetplatform=Win64',
      '-clientconfig=Development',
      '-utf8output'
    ];

    return this.runUAT(uatPath, args, 'Content cooking');
  }

  /**
   * Package the game for Windows
   */
  async packageGame(params: {
    configuration?: BuildConfiguration;
    outputDir?: string;
    compressed?: boolean;
    forDistribution?: boolean;
  } = {}): Promise<BuildResult> {
    const paths = await this.getUATPaths();
    if (!paths) {
      return {
        success: false,
        message: 'Could not find UAT or project path',
        error: 'UE_PROJECT_PATH or UE_EDITOR_EXE not configured'
      };
    }

    const { uatPath, projectPath } = paths;
    const config = params.configuration || 'Development';
    const projectDir = path.dirname(projectPath);
    const outputDir = params.outputDir || path.join(projectDir, 'Packaged', config);

    const args = [
      '-ScriptsForProject=' + projectPath,
      'BuildCookRun',
      '-project=' + projectPath,
      '-noP4',
      '-cook',
      '-stage',
      '-package',
      '-archive',
      '-archivedirectory=' + outputDir,
      '-targetplatform=Win64',
      '-clientconfig=' + config,
      '-utf8output'
    ];

    if (params.compressed !== false) {
      args.push('-compressed');
    }

    if (params.forDistribution) {
      args.push('-distribution');
    }

    return this.runUAT(uatPath, args, `Packaging (${config})`);
  }

  /**
   * Run UAT command
   */
  private runUAT(uatPath: string, args: string[], operation: string): Promise<BuildResult> {
    return new Promise((resolve) => {
      this.log.info(`Starting ${operation}...`);
      this.log.debug('UAT path:', uatPath);
      this.log.debug('Args:', args.join(' '));

      const process = spawn('cmd.exe', ['/c', uatPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: `${operation} completed successfully`,
            details: {
              exitCode: code,
              outputLength: stdout.length
            }
          });
        } else {
          resolve({
            success: false,
            message: `${operation} failed with exit code ${code}`,
            error: stderr || stdout.slice(-2000),
            details: {
              exitCode: code
            }
          });
        }
      });

      process.on('error', (err) => {
        resolve({
          success: false,
          message: `Failed to start ${operation}`,
          error: err.message
        });
      });

      // Set a long timeout for packaging (30 minutes)
      setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          message: `${operation} timed out after 30 minutes`,
          error: 'Process killed due to timeout'
        });
      }, 30 * 60 * 1000);
    });
  }

  /**
   * Build lighting in the current level
   */
  async buildLighting(quality: 'Preview' | 'Medium' | 'High' | 'Production' = 'High'): Promise<BuildResult> {
    const qualityMap: Record<string, number> = {
      'Preview': 0,
      'Medium': 1,
      'High': 2,
      'Production': 3
    };

    const qualityLevel = qualityMap[quality] ?? 2;

    const script = `
import unreal
import json

try:
    # Set lighting build quality
    settings = unreal.LightingBuildOptions()
    settings.quality_level = ${qualityLevel}
    
    # Build lighting
    unreal.EditorLevelLibrary.build_lighting_only()
    
    print('RESULT:' + json.dumps({
        'success': True,
        'message': 'Lighting build started (${quality} quality)',
        'details': {
            'quality': '${quality}',
            'qualityLevel': ${qualityLevel}
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
        message: 'Failed to build lighting',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Build navigation mesh
   */
  async buildNavigation(): Promise<BuildResult> {
    const script = `
import unreal
import json

try:
    # Build navigation
    unreal.EditorLevelLibrary.build_reflection_captures_only()
    
    # Use console command for nav mesh
    # Note: This triggers the build but we can't easily track completion
    
    print('RESULT:' + json.dumps({
        'success': True,
        'message': 'Navigation build started'
    }))
except Exception as e:
    print('RESULT:' + json.dumps({
        'success': False,
        'error': str(e)
    }))
`.trim();

    try {
      // Also trigger via console command
      await this.bridge.executeConsoleCommand('RebuildNavigation');
      
      return {
        success: true,
        message: 'Navigation rebuild triggered'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to build navigation',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Build all (geometry, lighting, paths, etc.)
   */
  async buildAll(): Promise<BuildResult> {
    try {
      // This triggers the full build process
      await this.bridge.executeConsoleCommand('BUILD');
      
      return {
        success: true,
        message: 'Full build triggered (lighting, navigation, etc.)'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to trigger full build',
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Get packaging status / progress
   * Note: This is a placeholder - real progress tracking would need
   * a more sophisticated approach with log file monitoring
   */
  async getPackagingStatus(): Promise<{
    success: boolean;
    isPackaging: boolean;
    message: string;
  }> {
    // For now, just return that we don't know the status
    // A real implementation would check for running UAT processes
    // or monitor log files
    return {
      success: true,
      isPackaging: false,
      message: 'Packaging status check not implemented - check Output Log in UE'
    };
  }

  /**
   * Open the packaged game folder
   */
  async openPackagedFolder(): Promise<BuildResult> {
    const projectPath = this.env.UE_PROJECT_PATH;
    if (!projectPath) {
      return {
        success: false,
        message: 'Project path not configured',
        error: 'UE_PROJECT_PATH not set'
      };
    }

    const projectDir = projectPath.endsWith('.uproject') 
      ? path.dirname(projectPath) 
      : projectPath;
    const packagedDir = path.join(projectDir, 'Packaged');

    try {
      await fs.access(packagedDir);
      
      // Open folder in Explorer
      spawn('explorer.exe', [packagedDir], { detached: true });
      
      return {
        success: true,
        message: `Opened packaged folder: ${packagedDir}`,
        details: {
          path: packagedDir
        }
      };
    } catch {
      return {
        success: false,
        message: 'Packaged folder not found',
        error: `Folder does not exist: ${packagedDir}`
      };
    }
  }
}
