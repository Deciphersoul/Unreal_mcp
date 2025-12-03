import { UnrealBridge } from '../unreal-bridge.js';
import { coerceBoolean, coerceString, interpretStandardResult } from '../utils/result-helpers.js';

export class AssetResources {
  constructor(private bridge: UnrealBridge) {}

  // Simple in-memory cache for asset listing
  private cache = new Map<string, { timestamp: number; data: any }>();
  private get ttlMs(): number { return Number(process.env.ASSET_LIST_TTL_MS || 10000); }
  private makeKey(dir: string, recursive: boolean, page?: number) { 
    return page !== undefined ? `${dir}::${recursive ? 1 : 0}::${page}` : `${dir}::${recursive ? 1 : 0}`; 
  }

  // Normalize UE content paths:
  // - Map '/Content' -> '/Game'
  // - Ensure forward slashes
  private normalizeDir(dir: string): string {
    try {
      if (!dir || typeof dir !== 'string') return '/Game';
      let d = dir.replace(/\\/g, '/');
      if (!d.startsWith('/')) d = '/' + d;
      if (d.toLowerCase().startsWith('/content')) {
        d = '/Game' + d.substring('/Content'.length);
      }
      // Collapse multiple slashes
      d = d.replace(/\/+/g, '/');
      // Remove trailing slash except root
      if (d.length > 1) d = d.replace(/\/$/, '');
      return d;
    } catch {
      return '/Game';
    }
  }

  async list(dir = '/Game', _recursive = false, limit = 50) {
    // ALWAYS use non-recursive listing to show only immediate children
    // This prevents timeouts and makes navigation clearer
    _recursive = false; // Force non-recursive
    
    // Normalize directory first
    dir = this.normalizeDir(dir);

    // Cache fast-path
    try {
      const key = this.makeKey(dir, false);
      const entry = this.cache.get(key);
      const now = Date.now();
      if (entry && (now - entry.timestamp) < this.ttlMs) {
        return entry.data;
      }
    } catch {}
    
    // Check if bridge is connected
    if (!this.bridge.isConnected) {
      return {
        assets: [],
        warning: 'Unreal Engine is not connected. Please ensure Unreal Engine is running with Remote Control enabled.',
        connectionStatus: 'disconnected'
      };
    }
    
    // Always use directory-only listing (immediate children)
    return this.listDirectoryOnly(dir, false, limit);
    // End of list method - all logic is now in listDirectoryOnly
  }

  /**
   * List assets with pagination support
   * @param dir Directory to list assets from
   * @param page Page number (0-based)
   * @param pageSize Number of assets per page (max 50 to avoid socket failures)
   */
  async listPaged(dir = '/Game', page = 0, pageSize = 30, recursive = false) {
    // Ensure pageSize doesn't exceed safe limit
    const safePageSize = Math.min(pageSize, 50);
    const offset = page * safePageSize;
    
    // Normalize directory and check cache for this specific page
    dir = this.normalizeDir(dir);
    const cacheKey = this.makeKey(dir, recursive, page);
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.ttlMs) {
      return cached.data;
    }
    
    if (!this.bridge.isConnected) {
      return {
        assets: [],
        page,
        pageSize: safePageSize,
        warning: 'Unreal Engine is not connected.',
        connectionStatus: 'disconnected'
      };
    }
    
    try {
      // Use search API with pagination
      // Use the same directory listing approach but with pagination
      const allAssets = await this.listDirectoryOnly(dir, false, 1000);
      
      // Paginate the results
      const start = offset;
      const end = offset + safePageSize;
      const pagedAssets = allAssets.assets ? allAssets.assets.slice(start, end) : [];
      
      const result = {
        assets: pagedAssets,
        page,
        pageSize: safePageSize,
        count: pagedAssets.length,
        totalCount: allAssets.assets ? allAssets.assets.length : 0,
        hasMore: end < (allAssets.assets ? allAssets.assets.length : 0),
        method: 'directory_listing_paged'
      };
      
      this.cache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (err: any) {
      console.warn(`Asset listing page ${page} failed:`, err.message);
    }
    
    return {
      assets: [],
      page,
      pageSize: safePageSize,
      error: 'Failed to fetch page'
    };
  }

  /**
   * Directory-based listing of immediate children using AssetRegistry.
   * Returns both subfolders and assets at the given path.
   */
  private async listDirectoryOnly(dir: string, _recursive: boolean, limit: number) {
    // Always return only immediate children to avoid timeout and improve navigation
    try {
      const py = `
import unreal
import json

_dir = r"${this.normalizeDir(dir)}"

try:
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    # Immediate subfolders
    sub_paths = ar.get_sub_paths(_dir, False)
    folders_list = []
    for p in sub_paths:
        try:
            name = p.split('/')[-1]
            folders_list.append({'n': name, 'p': p})
        except Exception:
            pass

    # Immediate assets at this path
    assets_data = ar.get_assets_by_path(_dir, False)
    assets = []
    for a in assets_data[:${limit}]:
        try:
            assets.append({
                'n': str(a.asset_name),
                'p': str(a.object_path),
                'c': str(a.asset_class)
            })
        except Exception:
            pass

    print("RESULT:" + json.dumps({
        'success': True,
        'path': _dir,
        'folders': len(folders_list),
        'files': len(assets),
        'folders_list': folders_list,
        'assets': assets
    }))
except Exception as e:
    print("RESULT:" + json.dumps({'success': False, 'error': str(e), 'path': _dir}))
`.trim();

      const resp = await this.bridge.executePython(py);
      const interpreted = interpretStandardResult(resp, {
        successMessage: 'Directory contents retrieved',
        failureMessage: 'Failed to list directory contents'
      });

      if (interpreted.success) {
        const payload = interpreted.payload as Record<string, unknown>;

        const foldersArr = Array.isArray(payload.folders_list)
          ? payload.folders_list.map((f: any) => ({
              Name: coerceString(f?.n) ?? '',
              Path: coerceString(f?.p) ?? '',
              Class: 'Folder',
              isFolder: true
            }))
          : [];

        const assetsArr = Array.isArray(payload.assets)
          ? payload.assets.map((a: any) => ({
              Name: coerceString(a?.n) ?? '',
              Path: coerceString(a?.p) ?? '',
              Class: coerceString(a?.c) ?? 'Asset',
              isFolder: false
            }))
          : [];

        const total = foldersArr.length + assetsArr.length;
        const summary = {
          total,
          folders: foldersArr.length,
          assets: assetsArr.length
        };

        const resolvedPath = coerceString(payload.path) ?? this.normalizeDir(dir);

        return {
          success: true,
          path: resolvedPath,
          summary,
          foldersList: foldersArr,
          assets: assetsArr,
          count: total,
          note: `Immediate children of ${resolvedPath}: ${foldersArr.length} folder(s), ${assetsArr.length} asset(s)`,
          method: 'asset_registry_listing'
        };
      }
    } catch (err: any) {
      console.warn('Engine asset listing failed:', err.message);
    }
    
    // Fallback: return empty with explanation
    return {
      success: true,
      path: this.normalizeDir(dir),
      summary: { total: 0, folders: 0, assets: 0 },
      foldersList: [],
      assets: [],
      warning: 'No items at this path or failed to query AssetRegistry.',
      method: 'asset_registry_fallback'
    };
  }

   async find(assetPath: string) {
    // Guard against invalid paths (trailing slash, empty, whitespace)
    if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '' || assetPath.endsWith('/')) {
      return false;
    }

    // Normalize asset path (support users passing /Content/...)
    const ap = this.normalizeDir(assetPath);
    const py = `
import unreal
apath = r"${ap}"
try:
    exists = unreal.EditorAssetLibrary.does_asset_exist(apath)
    print("RESULT:{'success': True, 'exists': %s}" % ('True' if exists else 'False'))
except Exception as e:
    print("RESULT:{'success': False, 'error': '" + str(e) + "'}")
`.trim();
    const resp = await this.bridge.executePython(py);
    const interpreted = interpretStandardResult(resp, {
      successMessage: 'Asset existence verified',
      failureMessage: 'Failed to verify asset existence'
    });

    if (interpreted.success) {
      return coerceBoolean(interpreted.payload.exists, false) ?? false;
    }

    return false;
  }

  /**
   * Search for assets with filters
   * @param params Search parameters
   */
  async search(params: {
    searchPattern?: string;
    assetType?: string;
    directory?: string;
    recursive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const {
      searchPattern,
      assetType,
      directory = '/Game',
      recursive = true,
      limit = 100,
      offset = 0
    } = params;

    // Normalize directory
    const normalizedDir = this.normalizeDir(directory);

    // Check if bridge is connected
    if (!this.bridge.isConnected) {
      return {
        success: true,
        assets: [],
        searchResults: {
          total: 0,
          returned: 0,
          hasMore: false,
          searchPattern,
          assetType,
          directory: normalizedDir
        },
        warning: 'Unreal Engine is not connected. Please ensure Unreal Engine is running with Remote Control enabled.',
        connectionStatus: 'disconnected'
      };
    }

    try {
      // Build Python script for UE5.7 asset registry search
      const py = `
import unreal
import json

# Get asset registry
registry = unreal.AssetRegistryHelpers.get_asset_registry()

# Prepare search parameters
search_dir = r"${normalizedDir}"
search_pattern = ${searchPattern ? `r"${searchPattern.replace(/"/g, '\\"')}"` : 'None'}
asset_type = ${assetType ? `"${assetType}"` : 'None'}
recursive = ${recursive ? 'True' : 'False'}
limit = ${limit}
offset = ${offset}

try:
    # For UE5.7, use get_assets_by_path with recursive flag
    if search_dir:
        if recursive:
            # Get all assets under directory
            assets = registry.get_assets_by_path(search_dir, True)
        else:
            # Get assets only in this directory
            assets = registry.get_assets_by_path(search_dir, False)
    else:
        # Search entire content - use scan_paths_synchronous first
        # Note: get_all_assets() can be slow for large projects
        # Try to get assets from root paths
        assets = []
        root_paths = ['/Game', '/Engine']
        for path in root_paths:
            try:
                path_assets = registry.get_assets_by_path(path, True)
                assets.extend(path_assets)
            except:
                pass
    
    # Apply filters
    filtered_assets = []
    
    for asset in assets:
        # Apply name pattern filter
        if search_pattern:
            import fnmatch
            asset_name = str(asset.asset_name)
            if not fnmatch.fnmatch(asset_name.lower(), search_pattern.lower()):
                continue
        
        # Apply asset type filter
        if asset_type:
            asset_class = str(asset.asset_class_path.asset_name)
            if asset_class != asset_type:
                # Also check for common aliases
                common_aliases = {
                    'StaticMesh': ['StaticMesh'],
                    'Material': ['Material', 'MaterialInstanceConstant', 'MaterialInstance'],
                    'Texture2D': ['Texture2D', 'Texture', 'TextureCube'],
                    'SoundWave': ['SoundWave', 'SoundCue'],
                    'Blueprint': ['Blueprint', 'BlueprintGeneratedClass', 'WidgetBlueprint'],
                    'World': ['World'],
                    'LevelSequence': ['LevelSequence'],
                    'SkeletalMesh': ['SkeletalMesh'],
                    'Animation': ['AnimSequence', 'AnimMontage', 'AnimBlueprint'],
                    'ParticleSystem': ['ParticleSystem', 'NiagaraSystem'],
                    'DataAsset': ['DataAsset', 'PrimaryDataAsset'],
                    'DataTable': ['DataTable']
                }
                if asset_type in common_aliases:
                    if asset_class not in common_aliases[asset_type]:
                        continue
                else:
                    continue
        
        filtered_assets.append(asset)
    
    # Apply pagination
    total_count = len(filtered_assets)
    paginated_assets = filtered_assets[offset:offset + limit]
    
    # Format results
    results = []
    for asset in paginated_assets:
        results.append({
            'Name': str(asset.asset_name),
            'Path': str(asset.package_name),
            'Class': str(asset.asset_class_path.asset_name),
            'PackagePath': str(asset.package_path)
        })
    
    # Return results
    output = {
        'success': True,
        'message': f'Found {len(paginated_assets)} assets (total: {total_count})',
        'assets': results,
        'searchResults': {
            'total': total_count,
            'returned': len(paginated_assets),
            'hasMore': (offset + len(paginated_assets)) < total_count,
            'searchPattern': search_pattern,
            'assetType': asset_type,
            'directory': search_dir
        }
    }
    
    print("RESULT:" + json.dumps(output))
    
except Exception as e:
    print("RESULT:" + json.dumps({
        'success': False,
        'message': f'Search failed: {str(e)}',
        'error': str(e),
        'assets': [],
        'searchResults': {
            'total': 0,
            'returned': 0,
            'hasMore': False,
            'searchPattern': search_pattern,
            'assetType': asset_type,
            'directory': search_dir
        }
    }))
`.trim();

      const resp = await this.bridge.executePython(py);
      const interpreted = interpretStandardResult(resp, {
        successMessage: 'Asset search completed',
        failureMessage: 'Asset search failed'
      });

      if (interpreted.success) {
        // Return a formatted response similar to list action
        const payload = interpreted.payload as Record<string, unknown>;
        const assets = Array.isArray(payload.assets) ? payload.assets : [];
        const searchResults = payload.searchResults as Record<string, unknown> || {};
        const total = typeof searchResults.total === 'number' ? searchResults.total : 0;
        const returned = typeof searchResults.returned === 'number' ? searchResults.returned : 0;
        const hasMore = typeof searchResults.hasMore === 'boolean' ? searchResults.hasMore : false;
        
        // Create a summary string like list action does
        const summary = `Found ${returned} assets${total !== returned ? ` (of ${total} total)` : ''}`;
        
        return {
          success: true,
          message: interpreted.message,
          summary,
          total,
          returned,
          hasMore,
          searchPattern: searchResults.searchPattern || searchPattern,
          assetType: searchResults.assetType || assetType,
          directory: searchResults.directory || normalizedDir,
          // Include assets but it might not be displayed
          assetsCount: assets.length
        };
      } else {
        return {
          success: false,
          message: interpreted.message,
          error: interpreted.error || 'Unknown search error',
          assets: [],
          searchResults: {
            total: 0,
            returned: 0,
            hasMore: false,
            searchPattern,
            assetType,
            directory: normalizedDir
          }
        };
      }
    } catch (error: any) {
      console.warn('Asset search failed:', error.message);
      return {
        success: false,
        error: error.message,
        assets: [],
        searchResults: {
          total: 0,
          returned: 0,
          hasMore: false,
          searchPattern,
          assetType,
          directory: normalizedDir
        }
      };
    }
  }
}
