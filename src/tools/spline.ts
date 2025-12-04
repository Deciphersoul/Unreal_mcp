import { UnrealBridge } from '../unreal-bridge.js';
import { interpretStandardResult } from '../utils/result-helpers.js';

export type VectorInput = { x?: number; y?: number; z?: number } | [number, number, number];
export type RotationInput = { pitch?: number; yaw?: number; roll?: number } | [number, number, number];

export interface SplinePointInput {
  location: VectorInput;
  tangent?: VectorInput;
  pointType?: string;
}

export interface CreateSplineParams {
  name: string;
  location?: VectorInput;
  rotation?: RotationInput;
  points?: SplinePointInput[];
  closedLoop?: boolean;
  replaceExisting?: boolean;
  space?: 'World' | 'Local';
}

export interface AddSplinePointParams {
  actorName: string;
  location: VectorInput;
  pointIndex?: number;
  tangent?: VectorInput;
  pointType?: string;
  space?: 'World' | 'Local';
  updateSpline?: boolean;
}

export interface UpdateSplinePointParams {
  actorName: string;
  pointIndex: number;
  location?: VectorInput;
  tangent?: VectorInput;
  arriveTangent?: VectorInput;
  leaveTangent?: VectorInput;
  pointType?: string;
  space?: 'World' | 'Local';
  updateSpline?: boolean;
}

export interface RemoveSplinePointParams {
  actorName: string;
  pointIndex: number;
  updateSpline?: boolean;
}

export interface GetSplinePointsParams {
  actorName: string;
  space?: 'World' | 'Local';
}

export interface SampleSplineParams {
  actorName: string;
  distance?: number;
  inputKey?: number;
  space?: 'World' | 'Local';
}

interface VectorStruct { x: number; y: number; z: number; }
interface RotationStruct { pitch: number; yaw: number; roll: number; }
interface SerializedPoint { location: VectorStruct; tangent?: VectorStruct; pointType?: string; }

export class SplineTools {
  constructor(private bridge: UnrealBridge) {}

  async createSpline(params: CreateSplineParams) {
    const payload = {
      name: params.name,
      location: this.toVectorStruct(params.location),
      rotation: this.toRotationStruct(params.rotation),
      points: this.sanitizePoints(params.points),
      closedLoop: params.closedLoop === true,
      replaceExisting: params.replaceExisting !== false,
      space: this.sanitizeSpace(params.space)
    };

    const pythonBody = `
actor_label = payload.get('name')
if not actor_label:
    result['error'] = 'Missing spline name'
else:
    subsystem = get_actor_subsystem()
    if not subsystem:
        result['error'] = 'EditorActorSubsystem unavailable'
    else:
        actor = find_actor(actor_label)
        if actor and payload.get('replaceExisting'):
            if not destroy_actor(actor):
                result.setdefault('warnings', []).append(f"Failed to replace existing actor '{actor_label}'")
            actor = None
        if not actor:
            spawn_loc = vector_from_dict(payload.get('location') or {})
            spawn_rot = rotator_from_dict(payload.get('rotation') or {})
            actor = spawn_spline_actor(spawn_loc, spawn_rot)
        if actor:
            try:
                actor.set_actor_label(actor_label, True)
            except Exception:
                pass
            spline_comp = get_spline_component(actor, True)
            if not spline_comp:
                result['error'] = f"Unable to create spline component on '{actor_label}'"
            else:
                try:
                    spline_comp.clear_spline_points()
                except Exception:
                    pass
                points = payload.get('points') or []
                space = resolve_coordinate_space(payload.get('space'))
                added = 0
                for idx, point in enumerate(points):
                    try:
                        loc = vector_from_dict(point.get('location') or {})
                        spline_comp.add_spline_point(loc, space, False)
                        new_index = int(spline_comp.get_number_of_spline_points()) - 1
                        if new_index < 0:
                            new_index = 0
                        tangent = point.get('tangent')
                        if tangent:
                            spline_comp.set_tangent_at_spline_point(new_index, vector_from_dict(tangent), space, False)
                        pt_type = resolve_point_type(point.get('pointType'))
                        if pt_type:
                            spline_comp.set_spline_point_type(new_index, pt_type, False)
                        added += 1
                    except Exception as exc:
                        result.setdefault('warnings', []).append(f"Point {idx} failed: {exc}")
                try:
                    spline_comp.set_closed_loop(bool(payload.get('closedLoop')))
                except Exception:
                    pass
                try:
                    spline_comp.update_spline()
                except Exception:
                    pass
                result['success'] = True
                result['actorLabel'] = actor_label
                try:
                    result['actorPath'] = actor.get_path_name()
                    result['actorLocation'] = vector_to_dict(actor.get_actor_location())
                except Exception:
                    pass
                result['pointCount'] = int(spline_comp.get_number_of_spline_points())
                result['pointsAdded'] = added
                result['message'] = f"Spline '{actor_label}' ready with {result['pointCount']} points"
        else:
            result['error'] = 'Failed to spawn spline actor'
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline created',
      failureMessage: 'Failed to create spline'
    });
  }

  async addPoint(params: AddSplinePointParams) {
    const payload: Record<string, unknown> = {
      actorName: params.actorName,
      location: this.toVectorStruct(params.location),
      pointIndex: params.pointIndex,
      tangent: params.tangent ? this.toVectorStruct(params.tangent) : undefined,
      pointType: this.sanitizePointType(params.pointType),
      space: this.sanitizeSpace(params.space),
      updateSpline: params.updateSpline !== false
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
        spline_comp = get_spline_component(actor, False)
        if not spline_comp:
            result['error'] = f"Spline component not found on '{actor_label}'"
        else:
            space = resolve_coordinate_space(payload.get('space'))
            loc = vector_from_dict(payload.get('location') or {})
            idx_value = payload.get('pointIndex')
            try:
                if isinstance(idx_value, int) and idx_value >= 0:
                    spline_comp.add_spline_point_at_index(loc, int(idx_value), space, False)
                    point_index = int(idx_value)
                else:
                    spline_comp.add_spline_point(loc, space, False)
                    point_index = int(spline_comp.get_number_of_spline_points()) - 1
                    if point_index < 0:
                        point_index = 0
                tangent = payload.get('tangent')
                if tangent:
                    spline_comp.set_tangent_at_spline_point(point_index, vector_from_dict(tangent), space, False)
                pt_type = resolve_point_type(payload.get('pointType'))
                if pt_type:
                    spline_comp.set_spline_point_type(point_index, pt_type, False)
                if payload.get('updateSpline', True):
                    spline_comp.update_spline()
                result['success'] = True
                result['pointIndex'] = int(point_index)
                result['pointCount'] = int(spline_comp.get_number_of_spline_points())
                result['message'] = f"Point {point_index} added to '{actor_label}'"
            except Exception as exc:
                result['error'] = f"Failed to add spline point: {exc}"
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline point added',
      failureMessage: 'Failed to add spline point'
    });
  }

  async updatePoint(params: UpdateSplinePointParams) {

    const sanitizedIndex = this.ensurePointIndex(params.pointIndex);
    const payload: Record<string, unknown> = {
      actorName: params.actorName,
      pointIndex: sanitizedIndex,
      location: params.location ? this.toVectorStruct(params.location) : undefined,
      tangent: params.tangent ? this.toVectorStruct(params.tangent) : undefined,
      arriveTangent: params.arriveTangent ? this.toVectorStruct(params.arriveTangent) : undefined,
      leaveTangent: params.leaveTangent ? this.toVectorStruct(params.leaveTangent) : undefined,
      pointType: this.sanitizePointType(params.pointType),
      space: this.sanitizeSpace(params.space),
      updateSpline: params.updateSpline !== false
    };

    if (!payload.location && !payload.tangent && !payload.arriveTangent && !payload.leaveTangent && !payload.pointType) {
      throw new Error('Provide at least one property (location/tangent/pointType) to update a spline point');
    }

    const pythonBody = `
actor_label = payload.get('actorName')
index = payload.get('pointIndex')
if not actor_label:
    result['error'] = 'Missing actor name'
elif not isinstance(index, int):
    result['error'] = 'pointIndex must be an integer'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        spline_comp = get_spline_component(actor, False)
        if not spline_comp:
            result['error'] = f"Spline component not found on '{actor_label}'"
        else:
            count = int(spline_comp.get_number_of_spline_points())
            if index < 0 or index >= count:
                result['error'] = f"pointIndex {index} out of range (0-{max(count - 1, 0)})"
            else:
                space = resolve_coordinate_space(payload.get('space'))
                updated = False
                location = payload.get('location')
                if location:
                    spline_comp.set_location_at_spline_point(index, vector_from_dict(location), space, False)
                    updated = True
                tangent = payload.get('tangent')
                if tangent:
                    spline_comp.set_tangent_at_spline_point(index, vector_from_dict(tangent), space, False)
                    updated = True
                arrive = payload.get('arriveTangent')
                if arrive:
                    spline_comp.set_arrive_tangent_at_spline_point(index, vector_from_dict(arrive), space, False)
                    updated = True
                leave = payload.get('leaveTangent')
                if leave:
                    spline_comp.set_leave_tangent_at_spline_point(index, vector_from_dict(leave), space, False)
                    updated = True
                pt_type = resolve_point_type(payload.get('pointType'))
                if pt_type:
                    spline_comp.set_spline_point_type(index, pt_type, False)
                    updated = True
                if not updated:
                    result['error'] = 'No spline point properties were provided to update'
                else:
                    if payload.get('updateSpline', True):
                        spline_comp.update_spline()
                    result['success'] = True
                    result['pointIndex'] = int(index)
                    result['pointCount'] = count
                    result['message'] = f"Spline point {index} updated on '{actor_label}'"
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline point updated',
      failureMessage: 'Failed to update spline point'
    });
  }

  async removePoint(params: RemoveSplinePointParams) {
    const payload = {
      actorName: params.actorName,
      pointIndex: this.ensurePointIndex(params.pointIndex),
      updateSpline: params.updateSpline !== false
    };

    const pythonBody = `
actor_label = payload.get('actorName')
index = payload.get('pointIndex')
if not actor_label:
    result['error'] = 'Missing actor name'
elif not isinstance(index, int):
    result['error'] = 'pointIndex must be an integer'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        spline_comp = get_spline_component(actor, False)
        if not spline_comp:
            result['error'] = f"Spline component not found on '{actor_label}'"
        else:
            count = int(spline_comp.get_number_of_spline_points())
            if index < 0 or index >= count:
                result['error'] = f"pointIndex {index} out of range (0-{max(count - 1, 0)})"
            else:
                try:
                    spline_comp.remove_spline_point(index)
                    if payload.get('updateSpline', True):
                        spline_comp.update_spline()
                    result['success'] = True
                    result['pointIndex'] = int(index)
                    result['pointCount'] = int(spline_comp.get_number_of_spline_points())
                    result['message'] = f"Removed point {index} from '{actor_label}'"
                except Exception as exc:
                    result['error'] = f"Failed to remove spline point: {exc}"
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline point removed',
      failureMessage: 'Failed to remove spline point'
    });
  }

  async getPoints(params: GetSplinePointsParams) {
    const payload = {
      actorName: params.actorName,
      space: this.sanitizeSpace(params.space)
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
        spline_comp = get_spline_component(actor, False)
        if not spline_comp:
            result['error'] = f"Spline component not found on '{actor_label}'"
        else:
            space = resolve_coordinate_space(payload.get('space'))
            count = int(spline_comp.get_number_of_spline_points())
            points = []
            for idx in range(count):
                point_type = str(spline_comp.get_spline_point_type(idx))
                if '.' in point_type:
                    point_type = point_type.split('.')[-1]
                entry = {
                    'index': int(idx),
                    'location': vector_to_dict(spline_comp.get_location_at_spline_point(idx, space)),
                    'tangent': vector_to_dict(spline_comp.get_tangent_at_spline_point(idx, space)),
                    'arriveTangent': vector_to_dict(spline_comp.get_arrive_tangent_at_spline_point(idx, space)),
                    'leaveTangent': vector_to_dict(spline_comp.get_leave_tangent_at_spline_point(idx, space)),
                    'distance': float(spline_comp.get_distance_along_spline_at_spline_point(idx)),
                    'pointType': point_type
                }
                points.append(entry)
            result['success'] = True
            result['actorName'] = actor_label
            result['pointCount'] = len(points)
            result['points'] = points
            result['message'] = f"Retrieved {len(points)} spline points from '{actor_label}'"
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline points retrieved',
      failureMessage: 'Failed to get spline points'
    });
  }

  async sampleSpline(params: SampleSplineParams) {
    if (params.distance === undefined && params.inputKey === undefined) {
      throw new Error('Provide either distance or inputKey to sample a spline');
    }

    const payload = {
      actorName: params.actorName,
      distance: typeof params.distance === 'number' ? params.distance : undefined,
      inputKey: typeof params.inputKey === 'number' ? params.inputKey : undefined,
      space: this.sanitizeSpace(params.space)
    };

    const pythonBody = `
actor_label = payload.get('actorName')
use_distance = payload.get('distance') is not None
space = resolve_coordinate_space(payload.get('space'))
if not actor_label:
    result['error'] = 'Missing actor name'
else:
    actor = find_actor(actor_label)
    if not actor:
        result['error'] = f"Actor '{actor_label}' not found"
    else:
        spline_comp = get_spline_component(actor, False)
        if not spline_comp:
            result['error'] = f"Spline component not found on '{actor_label}'"
        else:
            try:
                if use_distance:
                    distance = float(payload.get('distance') or 0.0)
                    location = vector_to_dict(spline_comp.get_location_at_distance_along_spline(distance, space))
                    direction = vector_to_dict(spline_comp.get_direction_at_distance_along_spline(distance, space))
                    up_vector = vector_to_dict(spline_comp.get_up_vector_at_distance_along_spline(distance, space))
                    rotation = rotator_to_dict(spline_comp.get_rotation_at_distance_along_spline(distance, space))
                    result['distance'] = distance
                    result['sampleMode'] = 'distance'
                else:
                    input_key = float(payload.get('inputKey') or 0.0)
                    location = vector_to_dict(spline_comp.get_location_at_spline_input_key(input_key, space))
                    direction = vector_to_dict(spline_comp.get_direction_at_spline_input_key(input_key, space))
                    up_vector = vector_to_dict(spline_comp.get_up_vector_at_spline_input_key(input_key, space))
                    rotation = rotator_to_dict(spline_comp.get_rotation_at_spline_input_key(input_key, space))
                    result['inputKey'] = input_key
                    result['sampleMode'] = 'inputKey'
                result['success'] = True
                result['actorName'] = actor_label
                result['location'] = location
                result['direction'] = direction
                result['upVector'] = up_vector
                result['rotation'] = rotation
                result['message'] = f"Sampled spline '{actor_label}'"
            except Exception as exc:
                result['error'] = f"Failed to sample spline: {exc}"
`;

    return this.executeSplineCommand(payload, pythonBody, {
      successMessage: 'Spline sampled',
      failureMessage: 'Failed to sample spline'
    });
  }

  private async executeSplineCommand(
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
SPLINE_ACTOR_CLASS = None

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
    for actor in actors:
        try:
            if str(actor.get_actor_label()) == label:
                return actor
        except Exception:
            continue
    return None

def destroy_actor(actor):
    subsystem = get_actor_subsystem()
    if not subsystem or not actor:
        return False
    try:
        subsystem.destroy_actor(actor)
        return True
    except Exception:
        return False

def resolve_spline_actor_class():
    global SPLINE_ACTOR_CLASS
    if SPLINE_ACTOR_CLASS:
        return SPLINE_ACTOR_CLASS
    try:
        loaded = unreal.load_class(None, '/Script/Engine.SplineActor')
        if loaded:
            SPLINE_ACTOR_CLASS = loaded
            return loaded
    except Exception:
        pass
    SPLINE_ACTOR_CLASS = unreal.Actor
    return SPLINE_ACTOR_CLASS

def spawn_spline_actor(location, rotation):
    subsystem = get_actor_subsystem()
    if not subsystem:
        return None
    try:
        cls = resolve_spline_actor_class()
        return subsystem.spawn_actor_from_class(cls, location, rotation)
    except Exception:
        return None

def get_spline_component(actor, create_if_missing=False):
    if not actor:
        return None
    try:
        attr = getattr(actor, 'spline_component', None)
        if attr:
            return attr
    except Exception:
        pass
    try:
        comps = actor.get_components_by_class(unreal.SplineComponent)
        if comps:
            return comps[0]
    except Exception:
        pass
    if not create_if_missing:
        return None
    component = None
    try:
        component = unreal.SplineComponent(actor)
        actor.add_instance_component(component)
        component.register_component()
    except Exception:
        component = None
    if not component:
        return None
    attach_rules = unreal.AttachmentTransformRules.KEEP_RELATIVE
    try:
        root = actor.get_root_component()
    except Exception:
        root = None
    if root:
        try:
            component.attach_to_component(root, attach_rules)
        except Exception:
            pass
    else:
        try:
            actor.set_root_component(component)
        except Exception:
            pass
    return component

def vector_from_dict(data):
    if not isinstance(data, dict):
        data = {}
    def num(val):
        try:
            return float(val)
        except Exception:
            return 0.0
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

def resolve_coordinate_space(name):
    if isinstance(name, str) and name.strip().lower() == 'local':
        return unreal.SplineCoordinateSpace.LOCAL
    return unreal.SplineCoordinateSpace.WORLD

def resolve_point_type(name):
    if not isinstance(name, str):
        return None
    lookup = name.strip().upper()
    mapping = {
        'LINEAR': unreal.SplinePointType.LINEAR,
        'CURVE': unreal.SplinePointType.CURVE,
        'CONSTANT': unreal.SplinePointType.CONSTANT,
        'CURVECLAMPED': unreal.SplinePointType.CURVE_CLAMPED,
        'CURVE_CLAMPED': unreal.SplinePointType.CURVE_CLAMPED
    }
    return mapping.get(lookup)

${body}

print('RESULT:' + json.dumps(result))
`.trim();
  }

  private toVectorStruct(value?: VectorInput | null): VectorStruct {
    if (Array.isArray(value) && value.length === 3) {
      return {
        x: this.toNumber(value[0]),
        y: this.toNumber(value[1]),
        z: this.toNumber(value[2])
      };
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return {
        x: this.toNumber(obj.x),
        y: this.toNumber(obj.y),
        z: this.toNumber(obj.z)
      };
    }
    return { x: 0, y: 0, z: 0 };
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

  private sanitizeSpace(space?: string): 'World' | 'Local' {
    if (typeof space === 'string' && space.trim().toLowerCase() === 'local') {
      return 'Local';
    }
    return 'World';
  }

  private sanitizePoints(points?: SplinePointInput[]): SerializedPoint[] {
    if (!Array.isArray(points)) {
      return [];
    }
    return points.map((point) => ({
      location: this.toVectorStruct(point?.location),
      tangent: point?.tangent ? this.toVectorStruct(point.tangent) : undefined,
      pointType: this.sanitizePointType(point?.pointType)
    }));
  }

  private sanitizePointType(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private sanitizePointIndex(value: unknown): number | undefined {
    const parsed = this.toNumber(value, NaN);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.trunc(parsed);
  }

  private ensurePointIndex(value: unknown): number {
    const sanitized = this.sanitizePointIndex(value);
    if (sanitized === undefined) {
      throw new Error('pointIndex must be a finite integer');
    }
    return sanitized;
  }
}
