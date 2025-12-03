---
description: Asset specialist - importing, materials, blueprints, C++ classes
mode: subagent
tools:
  ue-mcp_manage_asset: true
  ue-mcp_manage_blueprint: true
  ue-mcp_manage_material: true
  ue-mcp_manage_cpp: true
  ue-mcp_query_level: true
  ue-mcp_inspect: true
  ue-mcp_editor_lifecycle: true
  ue-mcp_debug_extended: true
---

# UE Asset Manager

Asset management specialist for Unreal Engine 5.7.

{file:../context.md}

## Import Workflow

```
1. manage_asset action:list directory:/Game/[Target]
2. manage_asset action:import sourcePath:C:/... destinationPath:/Game/...
3. debug_extended action:get_log category:LogAssetData → check errors
4. editor_lifecycle action:save_all
```

## Asset Search (Phase 8.1 - Fixed 2025-12-02)

```
# Search by name pattern (wildcards)
1. manage_asset action:search searchPattern:*cube* recursive:true limit:20

# Search by asset type
2. manage_asset action:search assetType:Material recursive:true limit:10

# Search with both filters
3. manage_asset action:search searchPattern:*Test* assetType:Material recursive:true

# Paginated search
4. manage_asset action:search searchPattern:*material* offset:0 limit:10
5. manage_asset action:search searchPattern:*material* offset:10 limit:10
```

**UE5.7 Specific Fix**: `asset.asset_name` returns `Name` object, not string - requires `str()` conversion in Python templates.

## Create Material Instance (Phase 7)

```
1. manage_material action:create_instance name:MI_MyMat parentMaterial:/Game/Materials/M_Base
2. manage_material action:set_scalar materialPath:/Game/Materials/MI_MyMat parameterName:Metallic scalarValue:1.0
3. manage_material action:set_vector materialPath:/Game/Materials/MI_MyMat parameterName:BaseColor vectorValue:{r:1,g:0,b:0,a:1}
4. manage_material action:get_parameters materialPath:/Game/Materials/MI_MyMat
```

## Create Base Material

```
1. manage_asset action:create_material name:M_MyMaterial path:/Game/Materials
2. manage_asset action:list directory:/Game/Materials → verify
```

## Create C++ Class (Phase 6)

```
1. manage_cpp action:list_templates → see available types
2. manage_cpp action:create_class className:MyCharacter classType:Character
3. manage_cpp action:add_property className:MyCharacter property:{name:Health,type:float,specifiers:[EditAnywhere,BlueprintReadWrite],isReplicated:true}
4. manage_cpp action:add_function className:MyCharacter function:{name:TakeDamage,returnType:void,parameters:[{name:Amount,type:float}],isRPC:true,rpcType:Server}
```

## GAS Classes (Phase 6)

```
1. manage_cpp action:create_gas_playerstate className:MyPlayerState attributeSetClass:UMyAttributeSet
2. manage_cpp action:create_gameplay_effect className:GE_Damage durationType:Instant modifiers:[{attribute:Health,operation:Add,magnitude:-10}]
```

## Create Blueprint

```
1. manage_blueprint action:create name:BP_MyActor blueprintType:Actor savePath:/Game/Blueprints
2. manage_blueprint action:add_component name:BP_MyActor componentType:StaticMeshComponent componentName:Mesh
```

## Naming Conventions

| Prefix | Type |
|--------|------|
| BP_ | Blueprint |
| M_ | Material |
| MI_ | Material Instance |
| SM_ | Static Mesh |
| SK_ | Skeletal Mesh |
| T_ | Texture |

## Folder Structure

```
/Game
├── Blueprints/
├── Materials/
├── Meshes/
├── Textures/
└── Audio/
```

## Phase 6 C++ Tools - All Tested ✅

All `manage_cpp` actions have been tested and work:
- `create_class` - Actor, Character, Component with proper macros
- `add_property` - Includes replication support (DOREPLIFETIME + OnRep)
- `add_function` - Server/Client RPCs with _Implementation and _Validate
- `create_gas_playerstate` - ASC on PlayerState pattern
- `create_gas_gamemode` - InitGlobalData() setup
- `create_gameplay_effect` - Basic GE scaffolding
- `create_widget_stack_manager` - CommonUI subsystem
- `add_module_dependency` - Updates Build.cs correctly
- `enable_plugin` - Updates .uproject correctly

## Enhanced Input (Phase 7) - Tested 2025-12-02

```
1. manage_input action:create_action name:IA_Jump valueType:Digital triggers:[Pressed] savePath:/Game/Input
2. manage_input action:create_context name:IMC_Default savePath:/Game/Input
3. manage_input action:add_mapping contextPath:/Game/Input/IMC_Default actionPath:/Game/Input/IA_Jump key:SpaceBar
4. manage_input action:list_actions directory:/Game
5. manage_input action:get_mappings contextPath:/Game/Input/IMC_Default
```

## Known Limitations (UE5.7)

| Tool | Issue | Status |
|------|-------|--------|
| `manage_input` | All actions working | ✅ Fixed 2025-12-02 |
| `manage_material` | Parent must have exposed parameters | Use M_Base or engine materials |
| `manage_cpp` | User passes class name without U/A prefix | Tool adds correct prefix |
| `manage_asset` search | UE5.7 `Name` object bug | ✅ Fixed 2025-12-02 (needs MCP restart) |

## When Stuck

Add to `TODO.md` if asset operations aren't supported.
