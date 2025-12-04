import { UnrealBridge } from '../unreal-bridge.js';
import { interpretStandardResult } from '../utils/result-helpers.js';

export type VectorInput = { x?: number; y?: number; z?: number } | [number, number, number];
export type RotationInput = { pitch?: number; yaw?: number; roll?: number } | [number, number, number];

export interface AddComponentParams {
  actorName: string;
  componentType: string;
  componentName?: string;
  parentComponent?: string;
  location?: VectorInput;
  rotation?: RotationInput;
  scale?: VectorInput;
  mobility?: 'Static' | 'Stationary' | 'Movable';
  registerComponent?: boolean;
  replaceExisting?: boolean;
}

export interface RemoveComponentParams {
  actorName: string;
  componentName?: string;
  componentType?: string;
}

export interface GetComponentsParams {
  actorName: string;
}

interface VectorStruct { x: number; y: number; z: number; }
interface RotationStruct { pitch: number; yaw: number; roll: number; }

export class ComponentTools {
  constructor(private bridge: UnrealBridge) {}

  async addComponent(params: AddComponentParams) {
    const payload = {
      actorName: params.actorName,
      componentType: params.componentType,
      componentName: typeof params.componentName === 'string' ? params.componentName : undefined,
      parentComponent: typeof params.parentComponent === 'string' ? params.parentComponent : undefined,
      location: this.toVectorStruct(params.location),
      rotation: this.toRotationStruct(params.rotation),
      scale: this.toVectorStruct(params.scale, 1),
      mobility: this.sanitizeMobility(params.mobility),
      registerComponent: params.registerComponent !== false,
      replaceExisting: params.replaceExisting === true
    };

    const pythonBody = `
actor_label = payload.get('actorName')
if not actor_label:
    result['error'] = 'Missing actor name'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        component_class = resolve_component_class(payload.get('componentType'))
        if not component_class:
            result['error'] = f"Component class not found: {payload.get('componentType')}"
        else:
            desired_name = sanitize_component_name(payload.get('componentName'))
            if desired_name and actor:
                if payload.get('replaceExisting'):
                    existing = find_component_by_name(actor, desired_name)
                    if existing:
                        try:
                            existing.destroy_component(existing)
                        except Exception as destroy_error:
                            result.setdefault('warnings', []).append(f"Failed to remove existing component '{desired_name}': {destroy_error}")
                            actor = None
                else:
                    if find_component_by_name(actor, desired_name):
                        result['error'] = f"Component '{desired_name}' already exists on '{actor_label}'"
                        actor = None
            if actor:
                component = None
                try:
                    component = component_class(actor)
                except Exception as inst_error:
                    result['error'] = f"Could not instantiate component: {inst_error}"
                    component = None
                if component:
                    if desired_name:
                        try:
                            tags = list(component.component_tags or [])
                            lower_tags = [str(tag).lower() for tag in tags]
                            if desired_name.lower() not in lower_tags:
                                tags.append(desired_name)
                                component.component_tags = tags
                        except Exception:
                            result.setdefault('warnings', []).append('Failed to record requested component name; removal will require componentType')
                    try:
                        actor.add_instance_component(component)
                    except Exception as attach_error:
                        result.setdefault('warnings', []).append(f"Failed to register component with actor; {attach_error}")
                    apply_transform(component, payload)
                    parent = resolve_parent_component(actor, payload.get('parentComponent'))
                    attach_component(component, parent)
                    apply_mobility(component, payload.get('mobility'))
                    if payload.get('registerComponent', True):
                        try:
                            component.register_component()
                        except Exception:
                            result.setdefault('warnings', []).append('Component registration failed; run manual register if needed')
                    result['success'] = True
                    result['componentName'] = desired_name or str(component.get_name())
                    result['componentClass'] = str(component.get_class().get_name())
                    result['actorName'] = actor_label
                    result['attachedTo'] = str(parent.get_name()) if parent else ''
                    result['message'] = f"Component '{result['componentName']}' added to '{actor_label}'"
`;



    return this.executeCommand(payload, pythonBody, {
      successMessage: 'Component added',
      failureMessage: 'Failed to add component'
    });
  }

  async removeComponent(params: RemoveComponentParams) {
    const payload = {
      actorName: params.actorName,
      componentName: typeof params.componentName === 'string' ? params.componentName : undefined,
      componentType: typeof params.componentType === 'string' ? params.componentType : undefined
    };

    const pythonBody = `
actor_label = payload.get('actorName')
if not actor_label:
    result['error'] = 'Missing actor name'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        target_name = sanitize_component_name(payload.get('componentName'))
        target_class = resolve_component_class(payload.get('componentType')) if payload.get('componentType') else None
        component = None
        if target_name:
            component = find_component_by_name(actor, target_name)
        if not component and target_class:
            component = find_component_by_class(actor, target_class)
        if not component:
            result['error'] = 'Component not found on actor'
        else:
            try:
                component.destroy_component(component)
                result['success'] = True
                result['componentName'] = str(component.get_name())
                result['componentClass'] = str(component.get_class().get_name())
                result['actorName'] = actor_label
                result['message'] = f"Component '{result['componentName']}' removed from '{actor_label}'"
            except Exception as remove_error:
                result['error'] = f"Failed to remove component: {remove_error}"
`;

    return this.executeCommand(payload, pythonBody, {
      successMessage: 'Component removed',
      failureMessage: 'Failed to remove component'
    });
  }

  async getComponents(params: GetComponentsParams) {
    const payload = {
      actorName: params.actorName
    };

    const pythonBody = `
actor_label = payload.get('actorName')
if not actor_label:
    result['error'] = 'Missing actor name'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        components = []
        comps = actor.get_components_by_class(unreal.ActorComponent)
        for comp in comps:
            if not comp:
                continue
            is_registered = False
            try:
                is_registered = bool(comp.is_registered())
            except Exception:
                pass
            entry = {
                'name': str(comp.get_name()),
                'className': str(comp.get_class().get_name()),
                'isRegistered': is_registered,
                'isSceneComponent': isinstance(comp, unreal.SceneComponent),
                'isPrimitiveComponent': isinstance(comp, unreal.PrimitiveComponent)
            }
            if isinstance(comp, unreal.SceneComponent):
                entry['relativeLocation'] = safe_relative_location(comp)
                entry['relativeRotation'] = safe_relative_rotation(comp)
                entry['relativeScale'] = safe_relative_scale(comp)
                parent = comp.get_attach_parent()
                entry['attachedTo'] = str(parent.get_name()) if parent else ''
            if isinstance(comp, unreal.PrimitiveComponent):
                try:
                    entry['mobility'] = str(comp.get_mobility())
                except Exception:
                    try:
                        entry['mobility'] = str(comp.get_editor_property('mobility'))
                    except Exception:
                        entry['mobility'] = ''
            components.append(entry)
        result['success'] = True
        result['components'] = components
        result['count'] = len(components)
        result['actorName'] = actor_label
        result['message'] = f"Found {len(components)} components on '{actor_label}'"
`;

    return this.executeCommand(payload, pythonBody, {
      successMessage: 'Components listed',
      failureMessage: 'Failed to get components'
    });
  }

  private async executeCommand(
    payload: Record<string, unknown>,
    pythonBody: string,
    defaults: { successMessage: string; failureMessage: string }
  ) {
    const pythonCode = this.buildPython(payload, pythonBody);
    const rawResult = await this.bridge.executePython(pythonCode);
    const interpreted = interpretStandardResult(rawResult, defaults);
    const data = { ...interpreted.payload } as Record<string, unknown>;
    delete data.success;
    delete data.message;
    delete data.error;

    return {
      success: interpreted.success,
      message: interpreted.message,
      error: interpreted.error,
      warnings: interpreted.warnings,
      details: interpreted.details,
      ...data
    };
  }

  private buildPython(payload: Record<string, unknown>, body: string) {
    const serialized = JSON.stringify(payload ?? {});
    return `
import unreal, json

payload = json.loads(r'''${serialized}''')
result = {'success': False, 'message': '', 'error': '', 'warnings': [], 'details': []}

MOBILITY_MAP = {
    'STATIC': unreal.ComponentMobility.STATIC,
    'STATIONARY': unreal.ComponentMobility.STATIONARY,
    'MOVABLE': unreal.ComponentMobility.MOVABLE
}

def get_actor_subsystem():
    try:
        return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    except Exception:
        return None

def find_actor(label):
    subsystem = get_actor_subsystem()
    if not subsystem or not label:
        return None
    try:
        actors = subsystem.get_all_level_actors()
    except Exception:
        return None
    label_lower = label.lower()
    for actor in actors:
        if not actor:
            continue
        try:
            actor_label = (actor.get_actor_label() or '').strip()
            actor_name = actor.get_name() or ''
            if actor_label.lower() == label_lower or actor_name.lower() == label_lower or actor_label.lower().startswith(label_lower + '_'):
                return actor
        except Exception:
            continue
    return None

def sanitize_component_name(name):
    if not isinstance(name, str):
        return ''
    cleaned = ''.join(ch if ch.isalnum() or ch == '_' else '_' for ch in name.strip())
    if cleaned and cleaned[0].isdigit():
        cleaned = f"C_{cleaned}"
    return cleaned

def resolve_component_class(name):
    if not name or not isinstance(name, str):
        return None
    trimmed = name.strip()
    if not trimmed:
        return None
    if trimmed.startswith('/'):
        try:
            loaded = unreal.load_class(None, trimmed)
            if loaded and issubclass(loaded, unreal.ActorComponent):
                return loaded
        except Exception:
            return None
    try:
        attr = getattr(unreal, trimmed)
        if isinstance(attr, type) and issubclass(attr, unreal.ActorComponent):
            return attr
    except Exception:
        pass
    return None

def component_matches_name(comp, name_lower):
    try:
        actual = (comp.get_name() or '').lower()
        if actual == name_lower:
            return True
    except Exception:
        pass
    try:
        tags = comp.component_tags or []
        for tag in tags:
            tag_value = str(tag).lower()
            if tag_value == name_lower:
                return True
    except Exception:
        pass
    return False

def find_component_by_name(actor, name):
    if not actor or not name:
        return None
    comps = actor.get_components_by_class(unreal.ActorComponent)
    name_lower = name.lower()
    for comp in comps:
        try:
            if comp and component_matches_name(comp, name_lower):
                return comp
        except Exception:
            continue
    return None

def find_component_by_class(actor, comp_class):
    if not actor or not comp_class:
        return None
    comps = actor.get_components_by_class(unreal.ActorComponent)
    for comp in comps:
        try:
            if comp and (comp.get_class() == comp_class or comp.get_class().is_child_of(comp_class)):
                return comp
        except Exception:
            continue
    return None

def resolve_parent_component(actor, parent_name):
    if not actor:
        return None
    if parent_name:
        parent = find_component_by_name(actor, parent_name)
        if parent:
            return parent
    try:
        return actor.get_root_component()
    except Exception:
        return None

def vector_from_dict(data, default=0.0):
    if not isinstance(data, dict):
        data = {}
    def num(val):
        try:
            return float(val)
        except Exception:
            return default
    return unreal.Vector(num(data.get('x')), num(data.get('y')), num(data.get('z')))

def rotator_from_dict(data):
    if not isinstance(data, dict):
        data = {}
    def num(val):
        try:
            return float(val)
        except Exception:
            return 0.0
    return unreal.Rotator(num(data.get('pitch')), num(data.get('yaw')), num(data.get('roll')))

def vector_to_dict(vec):
    if not vec:
        return {'x': 0.0, 'y': 0.0, 'z': 0.0}
    return {'x': float(vec.x), 'y': float(vec.y), 'z': float(vec.z)}

def rotator_to_dict(rot):
    if not rot:
        return {'pitch': 0.0, 'yaw': 0.0, 'roll': 0.0}
    return {'pitch': float(rot.pitch), 'yaw': float(rot.yaw), 'roll': float(rot.roll)}

def safe_relative_location(component):
    try:
        return vector_to_dict(component.get_relative_location())
    except Exception:
        try:
            return vector_to_dict(component.get_editor_property('relative_location'))
        except Exception:
            return {'x': 0.0, 'y': 0.0, 'z': 0.0}

def safe_relative_rotation(component):
    try:
        return rotator_to_dict(component.get_relative_rotation())
    except Exception:
        try:
            return rotator_to_dict(component.get_editor_property('relative_rotation'))
        except Exception:
            return {'pitch': 0.0, 'yaw': 0.0, 'roll': 0.0}

def safe_relative_scale(component):
    try:
        return vector_to_dict(component.get_relative_scale3d())
    except Exception:
        try:
            return vector_to_dict(component.get_editor_property('relative_scale3d'))
        except Exception:
            return {'x': 1.0, 'y': 1.0, 'z': 1.0}

def apply_transform(component, payload):
    if not isinstance(component, unreal.SceneComponent):
        return
    loc = payload.get('location') or {}
    rot = payload.get('rotation') or {}
    scale = payload.get('scale') or {}
    teleport_mode = unreal.TeleportType.NONE
    component.set_relative_location(vector_from_dict(loc), False, False)
    component.set_relative_rotation(rotator_from_dict(rot), False, False)
    component.set_relative_scale3d(vector_from_dict(scale, 1.0))

def attach_component(component, parent):
    if not isinstance(component, unreal.SceneComponent):
        return
    if parent and parent != component:
        try:
            component.attach_to_component(parent, unreal.AttachmentTransformRules.KEEP_RELATIVE)
        except Exception:
            result.setdefault('warnings', []).append('Failed to attach component; keeping default parent')

def apply_mobility(component, mobility):
    if not mobility or not isinstance(component, unreal.PrimitiveComponent):
        return
    mob_enum = MOBILITY_MAP.get(str(mobility).upper())
    if mob_enum:
        try:
            component.set_mobility(mob_enum)
        except Exception:
            try:
                component.set_editor_property('mobility', mob_enum)
            except Exception:
                result.setdefault('warnings', []).append('Failed to set component mobility')

${body.trim()}

print('RESULT:' + json.dumps(result))
`.trim();
  }

  private toVectorStruct(value?: VectorInput | null, fallback = 0): VectorStruct {

    if (Array.isArray(value) && value.length === 3) {
      return {
        x: this.toNumber(value[0], fallback),
        y: this.toNumber(value[1], fallback),
        z: this.toNumber(value[2], fallback)
      };
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return {
        x: this.toNumber(obj.x, fallback),
        y: this.toNumber(obj.y, fallback),
        z: this.toNumber(obj.z, fallback)
      };
    }
    return { x: fallback, y: fallback, z: fallback };
  }

  private toRotationStruct(value?: RotationInput | null): RotationStruct {
    if (Array.isArray(value) && value.length === 3) {
      return {
        pitch: this.toNumber(value[0]),
        yaw: this.toNumber(value[1]),
        roll: this.toNumber(value[2])
      };
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return {
        pitch: this.toNumber(obj.pitch),
        yaw: this.toNumber(obj.yaw),
        roll: this.toNumber(obj.roll)
      };
    }
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private sanitizeMobility(value?: string): 'Static' | 'Stationary' | 'Movable' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'static') {
      return 'Static';
    }
    if (normalized === 'stationary') {
      return 'Stationary';
    }
    if (normalized === 'movable') {
      return 'Movable';
    }
    return undefined;
  }
}
