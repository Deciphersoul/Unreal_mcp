export function escapePythonString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Generate Python script to check plugin status
 * @param pluginNames Array of plugin names to check
 * @returns Python script that prints RESULT: with plugin status
 */
export function generatePluginCheckScript(pluginNames: string[]): string {
  return `
import unreal
import json

plugins = ${JSON.stringify(pluginNames)}
status = {}

def get_plugin_manager():
  try:
    return unreal.PluginManager.get()
  except AttributeError:
    return None
  except Exception:
    return None

def get_plugins_subsystem():
  try:
    return unreal.get_editor_subsystem(unreal.PluginsEditorSubsystem)
  except AttributeError:
    pass
  except Exception:
    pass
  try:
    return unreal.PluginsSubsystem()
  except Exception:
    return None

pm = get_plugin_manager()
ps = get_plugins_subsystem()

# If neither plugin manager nor subsystem is available, assume plugins are enabled
# This is the common case in UE 5.7 where these APIs aren't exposed to Python
no_api_available = (pm is None and ps is None)

def is_enabled(plugin_name):
  # If we can't check, assume enabled - let actual operation fail with real error
  if no_api_available:
    return True
  if pm:
    try:
      if pm.is_plugin_enabled(plugin_name):
        return True
    except Exception:
      try:
        plugin = pm.find_plugin(plugin_name)
        if plugin and plugin.is_enabled():
          return True
      except Exception:
        pass
  if ps:
    try:
      return bool(ps.is_plugin_enabled(plugin_name))
    except Exception:
      try:
        plugin = ps.find_plugin(plugin_name)
        if plugin and plugin.is_enabled():
          return True
      except Exception:
        pass
  # If API was available but check returned nothing, assume enabled
  return True

for plugin_name in plugins:
  enabled = True  # Default to enabled
  try:
    enabled = is_enabled(plugin_name)
  except Exception:
    enabled = True  # Assume enabled on error
  status[plugin_name] = bool(enabled)

print('RESULT:' + json.dumps(status))
`.trim();
}

/**
 * Python script to get engine version
 */
export const ENGINE_VERSION_SCRIPT = `
import unreal, json, re
ver = str(unreal.SystemLibrary.get_engine_version())
m = re.match(r'^(\\d+)\\.(\\d+)\\.(\\d+)', ver)
major = int(m.group(1)) if m else 0
minor = int(m.group(2)) if m else 0
patch = int(m.group(3)) if m else 0
print('RESULT:' + json.dumps({'version': ver, 'major': major, 'minor': minor, 'patch': patch}))
`.trim();

/**
 * Python script to get feature flags (Python availability, editor subsystems)
 */
export const FEATURE_FLAGS_SCRIPT = `
import unreal, json
flags = {}
try:
    _ = unreal.PythonScriptLibrary
    flags['pythonEnabled'] = True
except Exception:
    flags['pythonEnabled'] = False
try:
    flags['unrealEditor'] = bool(unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem))
except Exception:
    flags['unrealEditor'] = False
try:
    flags['levelEditor'] = bool(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem))
except Exception:
    flags['levelEditor'] = False
try:
    flags['editorActor'] = bool(unreal.get_editor_subsystem(unreal.EditorActorSubsystem))
except Exception:
    flags['editorActor'] = False
print('RESULT:' + json.dumps(flags))
`.trim();
