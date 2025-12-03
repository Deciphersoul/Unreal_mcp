// C++ class templates for UE5
// Extracted from cpp.ts to keep files under 500 lines

export interface CppClassTemplate {
  parentClass: string;
  module: string;
  includes: string[];
  headerContent: string;
  sourceContent: string;
}

// Base UE5 class templates
export const CLASS_TEMPLATES: Record<string, CppClassTemplate> = {
  Actor: {
    parentClass: 'AActor',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/Actor.h'],
    headerContent: `
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	USceneComponent* RootSceneComponent;
`,
    sourceContent: `
	RootSceneComponent = CreateDefaultSubobject<USceneComponent>(TEXT("RootSceneComponent"));
	RootComponent = RootSceneComponent;
`
  },
  Character: {
    parentClass: 'ACharacter',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/Character.h'],
    headerContent: '',
    sourceContent: ''
  },
  Pawn: {
    parentClass: 'APawn',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/Pawn.h'],
    headerContent: '',
    sourceContent: ''
  },
  PlayerController: {
    parentClass: 'APlayerController',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/PlayerController.h'],
    headerContent: '',
    sourceContent: ''
  },
  GameMode: {
    parentClass: 'AGameModeBase',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/GameModeBase.h'],
    headerContent: '',
    sourceContent: ''
  },
  GameState: {
    parentClass: 'AGameStateBase',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/GameStateBase.h'],
    headerContent: `
	// Override for replication
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
`,
    sourceContent: ''
  },
  PlayerState: {
    parentClass: 'APlayerState',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'GameFramework/PlayerState.h'],
    headerContent: `
	// Override for replication
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
`,
    sourceContent: ''
  },
  ActorComponent: {
    parentClass: 'UActorComponent',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'Components/ActorComponent.h'],
    headerContent: '',
    sourceContent: ''
  },
  SceneComponent: {
    parentClass: 'USceneComponent',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'Components/SceneComponent.h'],
    headerContent: '',
    sourceContent: ''
  },
  Widget: {
    parentClass: 'UUserWidget',
    module: 'UMG',
    includes: ['CoreMinimal.h', 'Blueprint/UserWidget.h'],
    headerContent: '',
    sourceContent: ''
  },
  DataAsset: {
    parentClass: 'UDataAsset',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'Engine/DataAsset.h'],
    headerContent: '',
    sourceContent: ''
  },
  Subsystem: {
    parentClass: 'UGameInstanceSubsystem',
    module: 'Engine',
    includes: ['CoreMinimal.h', 'Subsystems/GameInstanceSubsystem.h'],
    headerContent: `
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
`,
    sourceContent: ''
  },
  // GAS Classes
  AttributeSet: {
    parentClass: 'UAttributeSet',
    module: 'GameplayAbilities',
    includes: ['CoreMinimal.h', 'AttributeSet.h', 'AbilitySystemComponent.h', 'Net/UnrealNetwork.h'],
    headerContent: `
	// Attribute macros - generates getter/setter/initter for each attribute
	#define ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \\
		GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \\
		GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName) \\
		GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName) \\
		GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)

	// Example: Health attribute with replication
	UPROPERTY(BlueprintReadOnly, Category = "Attributes", ReplicatedUsing = OnRep_Health)
	FGameplayAttributeData Health;
	ATTRIBUTE_ACCESSORS(U%CLASSNAME%, Health)

	UFUNCTION()
	void OnRep_Health(const FGameplayAttributeData& OldHealth);

	// Override for clamping and replication
	virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
	virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
`,
    sourceContent: `
	// Replication setup
	if (UAbilitySystemComponent* ASC = GetOwningAbilitySystemComponent())
	{
		ASC->GetGameplayAttributeValueChangeDelegate(GetHealthAttribute()).AddUObject(this, &U%CLASSNAME%::OnHealthChanged);
	}
`
  },
  GameplayAbility: {
    parentClass: 'UGameplayAbility',
    module: 'GameplayAbilities',
    includes: ['CoreMinimal.h', 'Abilities/GameplayAbility.h'],
    headerContent: `
	// Override activation logic
	virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, 
		const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData) override;
	
	virtual bool CanActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
		const FGameplayTagContainer* SourceTags, const FGameplayTagContainer* TargetTags, FGameplayTagContainer* OptionalRelevantTags) const override;

	virtual void EndAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
		const FGameplayAbilityActivationInfo ActivationInfo, bool bReplicateEndAbility, bool bWasCancelled) override;
`,
    sourceContent: ''
  },
  AbilitySystemComponent: {
    parentClass: 'UAbilitySystemComponent',
    module: 'GameplayAbilities',
    includes: ['CoreMinimal.h', 'AbilitySystemComponent.h'],
    headerContent: `
	// Initialize with owner - call from PlayerState::BeginPlay
	void InitAbilityActorInfo(AActor* InOwnerActor, AActor* InAvatarActor);
	
	// Grant abilities at startup
	void GrantDefaultAbilities();
	
	// Ability grant list (configure in Blueprint or constructor)
	UPROPERTY(EditDefaultsOnly, Category = "Abilities")
	TArray<TSubclassOf<UGameplayAbility>> DefaultAbilities;
	
	UPROPERTY(EditDefaultsOnly, Category = "Effects")
	TArray<TSubclassOf<UGameplayEffect>> DefaultEffects;
`,
    sourceContent: ''
  },
  // CommonUI Classes
  ActivatableWidget: {
    parentClass: 'UCommonActivatableWidget',
    module: 'CommonUI',
    includes: ['CoreMinimal.h', 'CommonActivatableWidget.h'],
    headerContent: `
	virtual void NativeOnActivated() override;
	virtual void NativeOnDeactivated() override;
	virtual UWidget* NativeGetDesiredFocusTarget() const override;
`,
    sourceContent: ''
  },
  ButtonBase: {
    parentClass: 'UCommonButtonBase',
    module: 'CommonUI',
    includes: ['CoreMinimal.h', 'CommonButtonBase.h'],
    headerContent: `
	virtual void NativeOnClicked() override;
	virtual void NativeOnHovered() override;
	virtual void NativeOnUnhovered() override;
`,
    sourceContent: ''
  }
};

// Property definition interface
export interface PropertyDefinition {
  name: string;
  type: string;
  specifiers?: string[];
  defaultValue?: string;
  comment?: string;
  isReplicated?: boolean;
  repNotifyFunc?: string;
}

// Function definition interface
export interface FunctionDefinition {
  name: string;
  returnType: string;
  parameters?: Array<{ name: string; type: string }>;
  specifiers?: string[];
  isRPC?: boolean;
  rpcType?: 'Server' | 'Client' | 'NetMulticast';
  isReliable?: boolean;
  hasValidation?: boolean;
  body?: string;
  comment?: string;
}

// Create class parameters
export interface CreateClassParams {
  className: string;
  classType: keyof typeof CLASS_TEMPLATES;
  moduleName?: string;
  properties?: PropertyDefinition[];
  functions?: FunctionDefinition[];
  interfaces?: string[];
  includeReplication?: boolean;
}
