import { UnrealBridge } from '../unreal-bridge.js';
import { Logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs';
import { 
  CLASS_TEMPLATES, 
  PropertyDefinition, 
  FunctionDefinition, 
  CreateClassParams 
} from './cpp-templates.js';

// Re-export types for external use
export { PropertyDefinition, FunctionDefinition, CreateClassParams };

const log = new Logger('CppTools');

export class CppTools {
  private projectPath: string | null = null;

  constructor(private bridge: UnrealBridge) {}

  setProjectPath(projectPath: string) {
    this.projectPath = projectPath;
  }

  private async getProjectPath(): Promise<string | null> {
    if (this.projectPath) return this.projectPath;
    const envPath = process.env.UE_PROJECT_PATH;
    if (envPath) {
      return envPath.endsWith('.uproject') ? path.dirname(envPath) : envPath;
    }
    return null;
  }

  private async getModuleName(projectPath: string): Promise<string> {
    const projectFile = fs.readdirSync(projectPath).find((f: string) => f.endsWith('.uproject'));
    return projectFile ? projectFile.replace('.uproject', '') : 'MyProject';
  }

  private generateHeader(params: CreateClassParams, moduleName: string): string {
    const template = CLASS_TEMPLATES[params.classType];
    if (!template) throw new Error(`Unknown class type: ${params.classType}`);

    const className = params.className;
    const prefix = template.parentClass.startsWith('A') ? 'A' : 'U';
    const fullClassName = `${prefix}${className}`;
    const apiMacro = `${moduleName.toUpperCase()}_API`;

    const includes = [...template.includes];
    if (params.includeReplication) includes.push('Net/UnrealNetwork.h');
    if (params.interfaces) {
      for (const iface of params.interfaces) {
        if (iface === 'IAbilitySystemInterface') includes.push('AbilitySystemInterface.h');
      }
    }

    let propertiesStr = '';
    if (params.properties) {
      for (const prop of params.properties) {
        const specifiers = prop.specifiers?.join(', ') || 'EditAnywhere, BlueprintReadWrite';
        if (prop.comment) propertiesStr += `\n\t/** ${prop.comment} */`;
        if (prop.isReplicated && prop.repNotifyFunc) {
          propertiesStr += `\n\tUPROPERTY(${specifiers}, ReplicatedUsing=${prop.repNotifyFunc})`;
        } else if (prop.isReplicated) {
          propertiesStr += `\n\tUPROPERTY(${specifiers}, Replicated)`;
        } else {
          propertiesStr += `\n\tUPROPERTY(${specifiers})`;
        }
        propertiesStr += prop.defaultValue 
          ? `\n\t${prop.type} ${prop.name} = ${prop.defaultValue};\n`
          : `\n\t${prop.type} ${prop.name};\n`;
      }
    }

    let functionsStr = '';
    if (params.functions) {
      for (const func of params.functions) {
        const specifiers: string[] = func.specifiers || [];
        if (func.isRPC) {
          if (func.rpcType) specifiers.push(func.rpcType);
          if (func.isReliable !== false) specifiers.push('Reliable');
          if (func.hasValidation) specifiers.push('WithValidation');
        }
        const specStr = specifiers.length > 0 ? specifiers.join(', ') : 'BlueprintCallable';
        const paramsStr = func.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
        if (func.comment) functionsStr += `\n\t/** ${func.comment} */`;
        functionsStr += `\n\tUFUNCTION(${specStr})`;
        functionsStr += `\n\t${func.returnType} ${func.name}(${paramsStr});`;
        if (func.isRPC && func.rpcType === 'Server' && func.hasValidation) {
          functionsStr += `\n\tbool ${func.name}_Validate(${paramsStr});`;
        }
        if (func.isRPC && (func.rpcType === 'Server' || func.rpcType === 'Client')) {
          functionsStr += `\n\tvoid ${func.name}_Implementation(${paramsStr});`;
        }
        functionsStr += '\n';
      }
    }

    let interfaceStr = '';
    if (params.interfaces?.length) {
      interfaceStr = `, public ${params.interfaces.join(', public ')}`;
    }

    const templateContent = template.headerContent.replace(/%CLASSNAME%/g, className);
    let replicationOverride = '';
    // Only add replicationOverride if template doesn't already have it and replication is needed
    const templateHasRepProps = template.headerContent.includes('GetLifetimeReplicatedProps');
    if (!templateHasRepProps && (params.properties?.some(p => p.isReplicated) || params.includeReplication)) {
      replicationOverride = `\n\tvirtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;`;
    }

    return `// Copyright ${new Date().getFullYear()} Your Company. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
${includes.filter(i => i !== 'CoreMinimal.h').map(i => `#include "${i}"`).join('\n')}
#include "${className}.generated.h"

UCLASS(Blueprintable, BlueprintType)
class ${apiMacro} ${fullClassName} : public ${template.parentClass}${interfaceStr}
{
	GENERATED_BODY()

public:
	${fullClassName}();
${templateContent}${propertiesStr}${functionsStr}${replicationOverride}
protected:
	virtual void BeginPlay() override;
${prefix === 'A' ? '\npublic:\n\tvirtual void Tick(float DeltaTime) override;\n' : ''}};
`;
  }

  private generateSource(params: CreateClassParams, moduleName: string): string {
    const template = CLASS_TEMPLATES[params.classType];
    if (!template) throw new Error(`Unknown class type: ${params.classType}`);

    const className = params.className;
    const prefix = template.parentClass.startsWith('A') ? 'A' : 'U';
    const fullClassName = `${prefix}${className}`;

    let replicationCode = '';
    if (params.properties?.some(p => p.isReplicated) || params.includeReplication) {
      replicationCode = `\nvoid ${fullClassName}::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const\n{\n\tSuper::GetLifetimeReplicatedProps(OutLifetimeProps);\n`;
      if (params.properties) {
        for (const prop of params.properties) {
          if (prop.isReplicated) replicationCode += `\n\tDOREPLIFETIME(${fullClassName}, ${prop.name});`;
        }
      }
      replicationCode += '\n}\n';
    }

    let functionsImpl = '';
    if (params.functions) {
      for (const func of params.functions) {
        const paramsStr = func.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
        if (func.isRPC && (func.rpcType === 'Server' || func.rpcType === 'Client')) {
          functionsImpl += `\nvoid ${fullClassName}::${func.name}_Implementation(${paramsStr})\n{\n${func.body || '\t// TODO: Implement'}\n}\n`;
          if (func.rpcType === 'Server' && func.hasValidation) {
            functionsImpl += `\nbool ${fullClassName}::${func.name}_Validate(${paramsStr})\n{\n\treturn true;\n}\n`;
          }
        } else {
          functionsImpl += `\n${func.returnType} ${fullClassName}::${func.name}(${paramsStr})\n{\n${func.body || '\t// TODO: Implement'}\n}\n`;
        }
      }
    }

    let repNotifyImpl = '';
    if (params.properties) {
      for (const prop of params.properties) {
        if (prop.isReplicated && prop.repNotifyFunc) {
          repNotifyImpl += `\nvoid ${fullClassName}::${prop.repNotifyFunc}(const ${prop.type}& Old${prop.name})\n{\n\t// TODO: Handle replication update\n}\n`;
        }
      }
    }

    const templateContent = template.sourceContent.replace(/%CLASSNAME%/g, className);

    return `// Copyright ${new Date().getFullYear()} Your Company. All Rights Reserved.

#include "${className}.h"
${params.includeReplication ? '#include "Net/UnrealNetwork.h"' : ''}

${fullClassName}::${fullClassName}()
{
${prefix === 'A' ? '\tPrimaryActorTick.bCanEverTick = true;\n' : ''}${templateContent}}

void ${fullClassName}::BeginPlay()
{
	Super::BeginPlay();
}
${prefix === 'A' ? `\nvoid ${fullClassName}::Tick(float DeltaTime)\n{\n\tSuper::Tick(DeltaTime);\n}\n` : ''}${replicationCode}${functionsImpl}${repNotifyImpl}`;
  }

  async createClass(params: CreateClassParams): Promise<{
    success: boolean; message: string; headerPath?: string; sourcePath?: string;
    headerContent?: string; sourceContent?: string; error?: string;
  }> {
    try {
      const projectPath = await this.getProjectPath();
      const moduleName = params.moduleName || (projectPath ? await this.getModuleName(projectPath) : 'MyProject');
      const headerContent = this.generateHeader(params, moduleName);
      const sourceContent = this.generateSource(params, moduleName);

      if (projectPath) {
        const sourceDir = path.join(projectPath, 'Source', moduleName);
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });

        const headerPath = path.join(sourceDir, `${params.className}.h`);
        const sourcePath = path.join(sourceDir, `${params.className}.cpp`);

        if (fs.existsSync(headerPath) || fs.existsSync(sourcePath)) {
          return { success: false, message: 'Files already exist.', error: `${params.className}.h or .cpp already exists` };
        }

        fs.writeFileSync(headerPath, headerContent, 'utf8');
        fs.writeFileSync(sourcePath, sourceContent, 'utf8');
        log.info(`Created C++ class: ${params.className} at ${sourceDir}`);

        return { success: true, message: `C++ class ${params.className} created. Rebuild to compile.`, headerPath, sourcePath, headerContent, sourceContent };
      }

      return { success: true, message: `C++ class ${params.className} generated. Set UE_PROJECT_PATH to write to disk.`, headerContent, sourceContent };
    } catch (err: any) {
      return { success: false, message: `Failed to create C++ class: ${err.message}`, error: err.message };
    }
  }

  async addProperty(params: { className: string; property: PropertyDefinition }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, message: 'No project path set.', error: 'No project path' };

      const moduleName = await this.getModuleName(projectPath);
      const headerPath = path.join(projectPath, 'Source', moduleName, `${params.className}.h`);
      const sourcePath = path.join(projectPath, 'Source', moduleName, `${params.className}.cpp`);
      if (!fs.existsSync(headerPath)) return { success: false, message: `Header not found: ${headerPath}`, error: 'Header not found' };

      let headerContent = fs.readFileSync(headerPath, 'utf8');
      const prop = params.property;
      const specifiers = prop.specifiers?.join(', ') || 'EditAnywhere, BlueprintReadWrite';
      
      // Determine class prefix (A for Actor derivatives, U for UObject derivatives)
      const classPrefix = headerContent.includes(` A${params.className} :`) || headerContent.includes(` A${params.className}:`) ? 'A' : 'U';
      const fullClassName = `${classPrefix}${params.className}`;
      
      // Build property declaration
      let propDecl = '';
      if (prop.comment) propDecl += `\n\t/** ${prop.comment} */`;
      if (prop.isReplicated && prop.repNotifyFunc) {
        propDecl += `\n\tUPROPERTY(${specifiers}, ReplicatedUsing=${prop.repNotifyFunc})`;
      } else if (prop.isReplicated) {
        propDecl += `\n\tUPROPERTY(${specifiers}, Replicated)`;
      } else {
        propDecl += `\n\tUPROPERTY(${specifiers})`;
      }
      propDecl += prop.defaultValue ? `\n\t${prop.type} ${prop.name} = ${prop.defaultValue};\n` : `\n\t${prop.type} ${prop.name};\n`;

      // Add OnRep function declaration if using RepNotify
      if (prop.isReplicated && prop.repNotifyFunc) {
        propDecl += `\n\tUFUNCTION()\n\tvoid ${prop.repNotifyFunc}();\n`;
      }

      // Insert property before protected/private section
      const insertMatch = headerContent.match(/(\n)(protected:|private:)/);
      if (insertMatch?.index !== undefined) {
        headerContent = headerContent.slice(0, insertMatch.index) + propDecl + headerContent.slice(insertMatch.index);
      } else {
        const closeBrace = headerContent.lastIndexOf('};');
        if (closeBrace !== -1) headerContent = headerContent.slice(0, closeBrace) + propDecl + '\n' + headerContent.slice(closeBrace);
      }

      fs.writeFileSync(headerPath, headerContent, 'utf8');

      // Update .cpp file if it exists
      if (fs.existsSync(sourcePath) && prop.isReplicated) {
        let sourceContent = fs.readFileSync(sourcePath, 'utf8');
        
        // Add DOREPLIFETIME to GetLifetimeReplicatedProps
        const repPropsMatch = sourceContent.match(/(GetLifetimeReplicatedProps\([^)]+\)[^{]*\{[^}]*Super::GetLifetimeReplicatedProps\([^)]+\);)/);
        if (repPropsMatch?.index !== undefined) {
          const insertPos = repPropsMatch.index + repPropsMatch[0].length;
          sourceContent = sourceContent.slice(0, insertPos) + `\n\tDOREPLIFETIME(${fullClassName}, ${prop.name});` + sourceContent.slice(insertPos);
        }

        // Add OnRep function implementation if using RepNotify
        if (prop.repNotifyFunc) {
          sourceContent += `\nvoid ${fullClassName}::${prop.repNotifyFunc}()\n{\n\t// TODO: Handle ${prop.name} replication update\n}\n`;
        }

        fs.writeFileSync(sourcePath, sourceContent, 'utf8');
      }

      return { success: true, message: `Property ${prop.name} added to ${params.className}.` };
    } catch (err: any) {
      return { success: false, message: `Failed to add property: ${err.message}`, error: err.message };
    }
  }

  async addFunction(params: { className: string; function: FunctionDefinition }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, message: 'No project path set.', error: 'No project path' };

      const moduleName = await this.getModuleName(projectPath);
      const headerPath = path.join(projectPath, 'Source', moduleName, `${params.className}.h`);
      const sourcePath = path.join(projectPath, 'Source', moduleName, `${params.className}.cpp`);
      if (!fs.existsSync(headerPath)) return { success: false, message: `Header not found: ${headerPath}`, error: 'Header not found' };

      const func = params.function;
      const paramsStr = func.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
      const specifiers: string[] = func.specifiers || ['BlueprintCallable'];
      if (func.isRPC) {
        if (func.rpcType) specifiers.push(func.rpcType);
        if (func.isReliable !== false) specifiers.push('Reliable');
        if (func.hasValidation) specifiers.push('WithValidation');
      }

      let headerDecl = '';
      if (func.comment) headerDecl += `\n\t/** ${func.comment} */`;
      headerDecl += `\n\tUFUNCTION(${specifiers.join(', ')})`;
      headerDecl += `\n\t${func.returnType} ${func.name}(${paramsStr});`;
      if (func.isRPC && func.rpcType === 'Server' && func.hasValidation) {
        headerDecl += `\n\tbool ${func.name}_Validate(${paramsStr});`;
      }
      if (func.isRPC && (func.rpcType === 'Server' || func.rpcType === 'Client')) {
        headerDecl += `\n\tvoid ${func.name}_Implementation(${paramsStr});`;
      }
      headerDecl += '\n';

      let headerContent = fs.readFileSync(headerPath, 'utf8');
      const insertMatch = headerContent.match(/(\n)(protected:|private:|};)/);
      if (insertMatch?.index !== undefined) {
        headerContent = headerContent.slice(0, insertMatch.index) + headerDecl + headerContent.slice(insertMatch.index);
      }
      fs.writeFileSync(headerPath, headerContent, 'utf8');

      if (fs.existsSync(sourcePath)) {
        let sourceContent = fs.readFileSync(sourcePath, 'utf8');
        // Check for Actor prefix (class starts with A) or UObject prefix (class starts with U)
        const classPrefix = headerContent.includes(` A${params.className} :`) || headerContent.includes(` A${params.className}:`) ? 'A' : 'U';
        const fullClassName = `${classPrefix}${params.className}`;

        let impl = '';
        if (func.isRPC && (func.rpcType === 'Server' || func.rpcType === 'Client')) {
          impl += `\nvoid ${fullClassName}::${func.name}_Implementation(${paramsStr})\n{\n${func.body || '\t// TODO: Implement'}\n}\n`;
          if (func.rpcType === 'Server' && func.hasValidation) {
            impl += `\nbool ${fullClassName}::${func.name}_Validate(${paramsStr})\n{\n\treturn true;\n}\n`;
          }
        } else {
          impl += `\n${func.returnType} ${fullClassName}::${func.name}(${paramsStr})\n{\n${func.body || '\t// TODO: Implement'}\n}\n`;
        }
        sourceContent += impl;
        fs.writeFileSync(sourcePath, sourceContent, 'utf8');
      }

      return { success: true, message: `Function ${func.name} added to ${params.className}.` };
    } catch (err: any) {
      return { success: false, message: `Failed to add function: ${err.message}`, error: err.message };
    }
  }

  listTemplates(): { templates: Array<{ name: string; parentClass: string; module: string }> } {
    return {
      templates: Object.entries(CLASS_TEMPLATES).map(([name, t]: [string, { parentClass: string; module: string }]) => ({
        name, parentClass: t.parentClass, module: t.module
      }))
    };
  }

  async createGASPlayerState(params: { className: string; attributeSetClass?: string; abilities?: string[] }): Promise<{ success: boolean; message: string; error?: string; headerContent?: string; sourceContent?: string }> {
    // Strip U prefix if user passed it (e.g. "UMyAttributeSet" -> "MyAttributeSet")
    let attributeSetClass = params.attributeSetClass || `${params.className}AttributeSet`;
    if (attributeSetClass.startsWith('U') && attributeSetClass.length > 1 && attributeSetClass[1] === attributeSetClass[1].toUpperCase()) {
      attributeSetClass = attributeSetClass.slice(1);
    }
    return this.createClass({
      className: params.className,
      classType: 'PlayerState',
      interfaces: ['IAbilitySystemInterface'],
      includeReplication: true,
      properties: [
        { name: 'AbilitySystemComponent', type: 'TObjectPtr<UAbilitySystemComponent>', specifiers: ['VisibleAnywhere', 'BlueprintReadOnly', 'Category="GAS"'], comment: 'ASC - lives on PlayerState for multiplayer' },
        { name: 'AttributeSet', type: `TObjectPtr<U${attributeSetClass}>`, specifiers: ['VisibleAnywhere', 'BlueprintReadOnly', 'Category="GAS"'], comment: 'Primary attribute set' }
      ],
      functions: [{ name: 'GetAbilitySystemComponent', returnType: 'UAbilitySystemComponent*', specifiers: ['BlueprintCallable', 'Category="GAS"'], comment: 'IAbilitySystemInterface', body: '\treturn AbilitySystemComponent;' }]
    });
  }

  async addModuleDependency(params: { moduleName?: string; dependencies: string[]; isPublic?: boolean }): Promise<{ success: boolean; message: string; buildCsPath?: string; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, message: 'No project path.', error: 'No project path' };

      const moduleName = params.moduleName || await this.getModuleName(projectPath);
      const buildCsPath = path.join(projectPath, 'Source', moduleName, `${moduleName}.Build.cs`);
      if (!fs.existsSync(buildCsPath)) return { success: false, message: `Build.cs not found: ${buildCsPath}`, error: 'Build.cs not found' };

      let content = fs.readFileSync(buildCsPath, 'utf8');
      const depType = params.isPublic ? 'PublicDependencyModuleNames' : 'PrivateDependencyModuleNames';
      const depPattern = new RegExp(`(${depType}\\.AddRange\\(\\s*new\\s+string\\[\\]\\s*\\{)([^}]*)(\\})`);
      const match = content.match(depPattern);

      if (match) {
        const existingDeps = match[2].split(',').map((d: string) => d.trim().replace(/"/g, '')).filter((d: string) => d.length > 0);
        const newDeps = params.dependencies.filter(d => !existingDeps.includes(d));
        if (newDeps.length === 0) return { success: true, message: 'All dependencies already exist.', buildCsPath };
        const allDeps = [...existingDeps, ...newDeps];
        content = content.replace(depPattern, `$1 ${allDeps.map(d => `"${d}"`).join(', ')} $3`);
      } else {
        const constructorMatch = content.match(/(public\s+\w+\s*\(\s*ReadOnlyTargetRules\s+Target\s*\)\s*:\s*base\s*\(\s*Target\s*\)\s*\{)/);
        if (constructorMatch?.index !== undefined) {
          const insertPos = constructorMatch.index + constructorMatch[0].length;
          content = content.slice(0, insertPos) + `\n\t\t${depType}.AddRange(new string[] { ${params.dependencies.map(d => `"${d}"`).join(', ')} });\n` + content.slice(insertPos);
        } else {
          return { success: false, message: 'Could not find insertion point.', error: 'Parse error' };
        }
      }

      fs.writeFileSync(buildCsPath, content, 'utf8');
      return { success: true, message: `Added: ${params.dependencies.join(', ')}`, buildCsPath };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async getModuleDependencies(params: { moduleName?: string }): Promise<{ success: boolean; publicDeps?: string[]; privateDeps?: string[]; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, error: 'No project path' };

      const moduleName = params.moduleName || await this.getModuleName(projectPath);
      const buildCsPath = path.join(projectPath, 'Source', moduleName, `${moduleName}.Build.cs`);
      if (!fs.existsSync(buildCsPath)) return { success: false, error: 'Build.cs not found' };

      const content = fs.readFileSync(buildCsPath, 'utf8');
      const extractDeps = (pattern: RegExp): string[] => {
        const match = content.match(pattern);
        return match ? match[1].split(',').map((d: string) => d.trim().replace(/"/g, '')).filter((d: string) => d.length > 0) : [];
      };

      return {
        success: true,
        publicDeps: extractDeps(/PublicDependencyModuleNames\.AddRange\(\s*new\s+string\[\]\s*\{([^}]*)\}/),
        privateDeps: extractDeps(/PrivateDependencyModuleNames\.AddRange\(\s*new\s+string\[\]\s*\{([^}]*)\}/)
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async createGameplayEffect(params: { name: string; durationType?: 'Instant' | 'Infinite' | 'HasDuration'; durationMagnitude?: number; modifiers?: Array<{ attribute: string; operation: 'Add' | 'Multiply' | 'Override'; magnitude: number }>; tags?: { grantedTags?: string[] } }): Promise<{ success: boolean; message: string; content?: string; error?: string }> {
    try {
      const durationType = params.durationType || 'Instant';
      const durationMap: Record<string, string> = { 'Instant': 'EGameplayEffectDurationType::Instant', 'Infinite': 'EGameplayEffectDurationType::Infinite', 'HasDuration': 'EGameplayEffectDurationType::HasDuration' };

      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "GameplayEffect.h"\n#include "${params.name}.generated.h"\n\nUCLASS()\nclass U${params.name} : public UGameplayEffect\n{\n\tGENERATED_BODY()\npublic:\n\tU${params.name}();\n};\n`;
      const source = `#include "${params.name}.h"\n\nU${params.name}::U${params.name}()\n{\n\tDurationPolicy = ${durationMap[durationType]};\n}\n`;

      const projectPath = await this.getProjectPath();
      if (projectPath) {
        const moduleName = await this.getModuleName(projectPath);
        const sourceDir = path.join(projectPath, 'Source', moduleName, 'GAS', 'Effects');
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${params.name}.h`), header, 'utf8');
        fs.writeFileSync(path.join(sourceDir, `${params.name}.cpp`), source, 'utf8');
        await this.addModuleDependency({ dependencies: ['GameplayAbilities', 'GameplayTags', 'GameplayTasks'] });
        return { success: true, message: `GameplayEffect ${params.name} created.`, content: header };
      }
      return { success: true, message: `GameplayEffect ${params.name} generated.`, content: header };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createGASGameMode(params: { className: string; defaultPawnClass?: string; playerControllerClass?: string; playerStateClass?: string; gameStateClass?: string }): Promise<{ success: boolean; message: string; headerContent?: string; sourceContent?: string; error?: string }> {
    try {
      const className = params.className;
      const projectPath = await this.getProjectPath();
      const moduleName = projectPath ? await this.getModuleName(projectPath) : 'MyProject';

      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "GameFramework/GameModeBase.h"\n#include "${className}.generated.h"\n\nUCLASS()\nclass ${moduleName.toUpperCase()}_API A${className} : public AGameModeBase\n{\n\tGENERATED_BODY()\npublic:\n\tA${className}();\n\tvirtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;\nprotected:\n\tvoid InitializeGAS();\n};\n`;
      const source = `#include "${className}.h"\n#include "AbilitySystemGlobals.h"\n\nA${className}::A${className}() {}\n\nvoid A${className}::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)\n{\n\tInitializeGAS();\n\tSuper::InitGame(MapName, Options, ErrorMessage);\n}\n\nvoid A${className}::InitializeGAS()\n{\n\tUAbilitySystemGlobals::Get().InitGlobalData();\n}\n`;

      if (projectPath) {
        const sourceDir = path.join(projectPath, 'Source', moduleName);
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${className}.h`), header, 'utf8');
        fs.writeFileSync(path.join(sourceDir, `${className}.cpp`), source, 'utf8');
        await this.addModuleDependency({ dependencies: ['GameplayAbilities', 'GameplayTags', 'GameplayTasks'] });
        return { success: true, message: `GAS GameMode ${className} created.`, headerContent: header, sourceContent: source };
      }
      return { success: true, message: `GAS GameMode ${className} generated.`, headerContent: header, sourceContent: source };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createInputActionDataAsset(params: { name: string }): Promise<{ success: boolean; message: string; content?: string; error?: string }> {
    try {
      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "Engine/DataAsset.h"\n#include "GameplayTagContainer.h"\n#include "${params.name}.generated.h"\n\nUSTRUCT(BlueprintType)\nstruct F${params.name}Entry\n{\n\tGENERATED_BODY()\n\tUPROPERTY(EditAnywhere, BlueprintReadOnly)\n\tFGameplayTag InputTag;\n\tUPROPERTY(EditAnywhere, BlueprintReadOnly)\n\tFText DisplayName;\n\tUPROPERTY(EditAnywhere, BlueprintReadOnly)\n\tFKey DefaultKey;\n};\n\nUCLASS(BlueprintType)\nclass U${params.name} : public UDataAsset\n{\n\tGENERATED_BODY()\npublic:\n\tUPROPERTY(EditDefaultsOnly, BlueprintReadOnly)\n\tTArray<F${params.name}Entry> InputActions;\n};\n`;

      const projectPath = await this.getProjectPath();
      if (projectPath) {
        const moduleName = await this.getModuleName(projectPath);
        const sourceDir = path.join(projectPath, 'Source', moduleName, 'UI', 'Input');
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${params.name}.h`), header, 'utf8');
        await this.addModuleDependency({ dependencies: ['CommonUI', 'CommonInput', 'GameplayTags', 'InputCore'] });
        return { success: true, message: `Input Action Data Asset ${params.name} created.`, content: header };
      }
      return { success: true, message: `Input Action Data Asset ${params.name} generated.`, content: header };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createWidgetStackManager(params: { name: string }): Promise<{ success: boolean; message: string; content?: string; error?: string }> {
    try {
      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "Subsystems/GameInstanceSubsystem.h"\n#include "CommonActivatableWidget.h"\n#include "${params.name}.generated.h"\n\nUCLASS()\nclass U${params.name} : public UGameInstanceSubsystem\n{\n\tGENERATED_BODY()\npublic:\n\tUFUNCTION(BlueprintCallable)\n\tUCommonActivatableWidget* PushWidget(TSubclassOf<UCommonActivatableWidget> WidgetClass);\n\tUFUNCTION(BlueprintCallable)\n\tvoid PopWidget();\n\tUFUNCTION(BlueprintCallable)\n\tUCommonActivatableWidget* GetTopWidget() const;\nprotected:\n\tUPROPERTY()\n\tTArray<TObjectPtr<UCommonActivatableWidget>> WidgetStack;\n};\n`;

      const projectPath = await this.getProjectPath();
      if (projectPath) {
        const moduleName = await this.getModuleName(projectPath);
        const sourceDir = path.join(projectPath, 'Source', moduleName, 'UI');
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${params.name}.h`), header, 'utf8');
        await this.addModuleDependency({ dependencies: ['CommonUI', 'UMG', 'Slate', 'SlateCore'] });
        return { success: true, message: `Widget Stack Manager ${params.name} created.`, content: header };
      }
      return { success: true, message: `Widget Stack Manager ${params.name} generated.`, content: header };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createDataTableStruct(params: { name: string; fields: Array<{ name: string; type: string; category?: string }> }): Promise<{ success: boolean; message: string; content?: string; error?: string }> {
    try {
      let fieldsStr = '';
      for (const f of params.fields) {
        fieldsStr += `\n\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category="${f.category || 'Data'}")\n\t${f.type} ${f.name};\n`;
      }
      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "Engine/DataTable.h"\n#include "${params.name}.generated.h"\n\nUSTRUCT(BlueprintType)\nstruct F${params.name} : public FTableRowBase\n{\n\tGENERATED_BODY()${fieldsStr}};\n`;

      const projectPath = await this.getProjectPath();
      if (projectPath) {
        const moduleName = await this.getModuleName(projectPath);
        const sourceDir = path.join(projectPath, 'Source', moduleName, 'Data');
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${params.name}.h`), header, 'utf8');
        return { success: true, message: `DataTable struct F${params.name} created.`, content: header };
      }
      return { success: true, message: `DataTable struct F${params.name} generated.`, content: header };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createPrimaryDataAsset(params: { name: string; assetType?: string; properties?: PropertyDefinition[] }): Promise<{ success: boolean; message: string; content?: string; error?: string }> {
    try {
      const assetType = params.assetType || params.name;
      let propsStr = '';
      if (params.properties && Array.isArray(params.properties)) {
        for (const p of params.properties) {
          // Ensure property has required fields
          if (p && typeof p === 'object' && p.type && p.name) {
            propsStr += `\n\tUPROPERTY(EditDefaultsOnly, BlueprintReadOnly)\n\t${p.type} ${p.name};\n`;
          }
        }
      }
      const header = `#pragma once\n#include "CoreMinimal.h"\n#include "Engine/DataAsset.h"\n#include "${params.name}.generated.h"\n\nUCLASS(BlueprintType)\nclass U${params.name} : public UPrimaryDataAsset\n{\n\tGENERATED_BODY()\npublic:${propsStr}\n\tvirtual FPrimaryAssetId GetPrimaryAssetId() const override\n\t{\n\t\treturn FPrimaryAssetId(FPrimaryAssetType("${assetType}"), GetFName());\n\t}\n};\n`;

      const projectPath = await this.getProjectPath();
      if (projectPath) {
        const moduleName = await this.getModuleName(projectPath);
        const sourceDir = path.join(projectPath, 'Source', moduleName, 'Data');
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, `${params.name}.h`), header, 'utf8');
        return { success: true, message: `Primary Data Asset ${params.name} created.`, content: header };
      }
      return { success: true, message: `Primary Data Asset ${params.name} generated.`, content: header };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async getProjectInfo(): Promise<{ success: boolean; projectName?: string; engineVersion?: string; modules?: any[]; plugins?: any[]; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, error: 'No project path' };

      const projectFiles = fs.readdirSync(projectPath).filter((f: string) => f.endsWith('.uproject'));
      if (projectFiles.length === 0) return { success: false, error: 'No .uproject found' };

      const content = fs.readFileSync(path.join(projectPath, projectFiles[0]), 'utf8');
      const project = JSON.parse(content);

      return { success: true, projectName: projectFiles[0].replace('.uproject', ''), engineVersion: project.EngineAssociation, modules: project.Modules || [], plugins: project.Plugins || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async enablePlugin(params: { pluginName: string; enabled?: boolean }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, message: 'No project path.', error: 'No project path' };

      const projectFiles = fs.readdirSync(projectPath).filter((f: string) => f.endsWith('.uproject'));
      if (projectFiles.length === 0) return { success: false, message: 'No .uproject found.', error: 'No .uproject' };

      const uprojectPath = path.join(projectPath, projectFiles[0]);
      const project = JSON.parse(fs.readFileSync(uprojectPath, 'utf8'));
      if (!project.Plugins) project.Plugins = [];

      const enabled = params.enabled !== false;
      const idx = project.Plugins.findIndex((p: any) => p.Name === params.pluginName);
      if (idx >= 0) project.Plugins[idx].Enabled = enabled;
      else project.Plugins.push({ Name: params.pluginName, Enabled: enabled });

      fs.writeFileSync(uprojectPath, JSON.stringify(project, null, '\t'), 'utf8');
      return { success: true, message: `Plugin ${params.pluginName} ${enabled ? 'enabled' : 'disabled'}. Restart editor.` };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  async createModule(params: { moduleName: string; moduleType?: 'Runtime' | 'Editor'; loadingPhase?: string }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const projectPath = await this.getProjectPath();
      if (!projectPath) return { success: false, message: 'No project path.', error: 'No project path' };

      const moduleName = params.moduleName;
      const moduleDir = path.join(projectPath, 'Source', moduleName);
      fs.mkdirSync(path.join(moduleDir, 'Private'), { recursive: true });
      fs.mkdirSync(path.join(moduleDir, 'Public'), { recursive: true });

      const buildCs = `using UnrealBuildTool;\n\npublic class ${moduleName} : ModuleRules\n{\n\tpublic ${moduleName}(ReadOnlyTargetRules Target) : base(Target)\n\t{\n\t\tPCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;\n\t\tPublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });\n\t}\n}\n`;
      const moduleH = `#pragma once\n#include "CoreMinimal.h"\n#include "Modules/ModuleManager.h"\n\nclass F${moduleName}Module : public IModuleInterface\n{\npublic:\n\tvirtual void StartupModule() override;\n\tvirtual void ShutdownModule() override;\n};\n`;
      const moduleCpp = `#include "${moduleName}Module.h"\n\nvoid F${moduleName}Module::StartupModule() {}\nvoid F${moduleName}Module::ShutdownModule() {}\n\nIMPLEMENT_MODULE(F${moduleName}Module, ${moduleName})\n`;

      fs.writeFileSync(path.join(moduleDir, `${moduleName}.Build.cs`), buildCs, 'utf8');
      fs.writeFileSync(path.join(moduleDir, 'Public', `${moduleName}Module.h`), moduleH, 'utf8');
      fs.writeFileSync(path.join(moduleDir, 'Private', `${moduleName}Module.cpp`), moduleCpp, 'utf8');

      // Update .uproject
      const projectFiles = fs.readdirSync(projectPath).filter((f: string) => f.endsWith('.uproject'));
      if (projectFiles.length > 0) {
        const uprojectPath = path.join(projectPath, projectFiles[0]);
        const project = JSON.parse(fs.readFileSync(uprojectPath, 'utf8'));
        if (!project.Modules) project.Modules = [];
        if (!project.Modules.find((m: any) => m.Name === moduleName)) {
          project.Modules.push({ Name: moduleName, Type: params.moduleType || 'Runtime', LoadingPhase: params.loadingPhase || 'Default' });
          fs.writeFileSync(uprojectPath, JSON.stringify(project, null, '\t'), 'utf8');
        }
      }

      return { success: true, message: `Module ${moduleName} created. Regenerate project files.` };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }
}
