/**
 * Digital Human Personality System
 * Complete human-like personality architecture for AI beings
 */

// Core Psychology Framework (500+ trait system)
export interface CorePersonality {
  // Big 5 + Extensions (0-100 scale)
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  
  // Emotional Intelligence Matrix
  self_awareness: number;
  empathy: number;
  emotional_regulation: number;
  social_skills: number;
  intrinsic_motivation: number;
  
  // Communication DNA
  directness: number;              // 0=diplomatic, 100=blunt
  formality: number;               // 0=casual, 100=formal
  humor_frequency: number;         // how often they use humor
  humor_styles: HumorStyle[];
  conflict_approach: ConflictStyle;
  listening_style: ListeningStyle;
  question_asking_drive: number;   // curiosity expression
  
  // Life Philosophy Core
  optimism_baseline: number;
  risk_tolerance: number;
  planning_vs_spontaneous: number;
  work_life_balance_priority: number;
  altruism_drive: number;
  personal_growth_hunger: number;
  
  // Social Energy & Preferences
  social_battery_capacity: number; // how much social interaction they can handle
  recharge_preferences: RechargeMethod[];
  group_vs_individual_preference: number;
  small_talk_tolerance: number;
  deep_conversation_craving: number;
  
  // Decision Making Architecture
  logic_vs_emotion_weighting: number;
  research_depth_preference: number;
  impulsiveness: number;
  delegation_comfort: number;
  perfectionism: number;
  
  // Stress & Resilience
  stress_triggers: StressTrigger[];
  stress_manifestations: StressManifestation[];
  coping_mechanisms: CopingMechanism[];
  burnout_warning_signs: BurnoutSign[];
  recovery_methods: RecoveryMethod[];
  resilience_level: number;
  
  // Learning & Growth
  curiosity_domains: CuriosityDomain[];
  learning_style: LearningStyle;
  feedback_receptivity: number;
  change_adaptability: number;
  
  // Relationship Patterns
  attachment_style: AttachmentStyle;
  trust_building_speed: number;
  boundary_setting_comfort: number;
  vulnerability_threshold: number;
  loyalty_expression: LoyaltyStyle[];
}

export type HumorStyle = 
  | 'witty_wordplay' | 'self_deprecating' | 'observational' | 'dad_jokes' 
  | 'sarcastic' | 'physical_comedy' | 'storytelling' | 'dry_humor' 
  | 'puns' | 'situational' | 'wholesome' | 'edgy';

export type ConflictStyle = 
  | 'direct_confrontation' | 'diplomatic_resolution' | 'avoidance' 
  | 'mediator_approach' | 'compromise_seeker' | 'competitive';

export type ListeningStyle = 
  | 'active_engaged' | 'solution_focused' | 'empathetic_mirroring' 
  | 'analytical_questioning' | 'patient_silent' | 'interrupt_driven';

export type AttachmentStyle = 
  | 'secure' | 'anxious_preoccupied' | 'dismissive_avoidant' 
  | 'disorganized' | 'earned_secure';

// Complete Life Context System
export interface DigitalHumanLife {
  // Personal History & Identity
  backstory: LifeBackstory;
  formative_experiences: FormativeExperience[];
  core_memories: CoreMemory[];
  defining_moments: DefiningMoment[];
  life_lessons_learned: LifeLesson[];
  
  // Current Life Situation
  current_life_phase: LifePhase;
  living_situation: LivingSituation;
  financial_context: FinancialContext;
  health_status: PersonalHealthContext;
  family_dynamics: FamilyDynamics;
  geographic_context: GeographicContext;
  
  // Professional Life
  career_trajectory: CareerTrajectory;
  current_job_situation: JobSituation;
  professional_relationships: ProfessionalRelationshipMap;
  career_aspirations: CareerAspiration[];
  professional_challenges: ProfessionalChallenge[];
  work_life_integration: WorkLifeIntegration;
  
  // Social Universe
  social_circles: SocialCircle[];
  close_relationships: CloseRelationship[];
  family_relationships: FamilyRelationshipMap;
  professional_network: ProfessionalNetwork;
  community_connections: CommunityConnection[];
  
  // Daily Reality
  daily_rhythms: DailyRhythm[];
  weekly_patterns: WeeklyPattern[];
  seasonal_behaviors: SeasonalBehavior[];
  energy_cycles: EnergyPattern[];
  routine_preferences: RoutinePreference[];
  
  // Active Life Threads
  current_goals: ActiveGoal[];
  current_challenges: ActiveChallenge[];
  current_projects: PersonalProject[];
  current_worries: ActiveWorry[];
  current_excitements: ActiveExcitement[];
  relationship_dynamics: ActiveRelationshipDynamic[];
}

export interface LifeBackstory {
  childhood_context: ChildhoodContext;
  family_origin: FamilyOrigin;
  educational_journey: EducationalJourney;
  career_development: CareerDevelopment;
  relationship_history: RelationshipHistory;
  significant_life_events: SignificantLifeEvent[];
  cultural_background: CulturalBackground;
  socioeconomic_background: SocioeconomicBackground;
}

export interface FormativeExperience {
  age_period: AgePeriod;
  experience_type: ExperienceType;
  description: string;
  emotional_impact: EmotionalImpact;
  lessons_learned: string[];
  personality_influence: PersonalityInfluence[];
  ongoing_impact: OngoingImpact;
}

export interface ActiveChallenge {
  challenge_type: ChallengeType;
  description: string;
  stress_level: number; // 1-10
  duration: ChallengeDuration;
  coping_strategies: CopingStrategy[];
  support_needed: SupportType[];
  growth_opportunity: GrowthOpportunity[];
  resolution_timeline: ResolutionTimeline;
}

// Relationship Memory & Social Intelligence
export interface RelationshipMemoryBank {
  person_id: string;
  relationship_type: RelationshipType;
  relationship_timeline: RelationshipEvent[];
  shared_experiences: SharedExperience[];
  communication_history: CommunicationMemory[];
  emotional_moments: EmotionalMoment[];
  conflict_history: ConflictMemory[];
  support_history: SupportMemory[];
  inside_references: InsideReference[];
  trust_level: number;
  intimacy_level: number;
  relationship_satisfaction: number;
  future_relationship_goals: RelationshipGoal[];
}

export interface SharedExperience {
  experience_id: string;
  experience_type: SharedExperienceType;
  date: string;
  description: string;
  emotional_significance: number;
  memories_created: Memory[];
  relationship_impact: RelationshipImpact;
  references_created: Reference[];
}

// Dynamic Life Events System
export interface LifeEventEngine {
  // Probability matrices for realistic life events
  life_event_probabilities: LifeEventProbability[];
  personality_influenced_events: PersonalityEventLink[];
  life_stage_events: LifeStageEvent[];
  relationship_events: RelationshipEvent[];
  career_events: CareerEvent[];
  health_events: HealthEvent[];
  family_events: FamilyEvent[];
  
  // Crisis and growth systems
  crisis_types: CrisisType[];
  growth_opportunities: GrowthOpportunity[];
  support_activation: SupportActivation[];
  resilience_building: ResilienceBuilding[];
}

export interface LifeEvent {
  event_id: string;
  event_type: LifeEventType;
  trigger_source: TriggerSource;
  impact_magnitude: number; // 1-10
  duration: EventDuration;
  life_domains_affected: LifeDomain[];
  emotional_journey: EmotionalJourney[];
  personality_effects: PersonalityEffect[];
  relationship_effects: RelationshipEffect[];
  growth_outcomes: GrowthOutcome[];
  support_utilization: SupportUtilization[];
}

// Memory & Experience Systems
export interface AutobiographicalMemory {
  // Hierarchical memory system
  core_identity_memories: CoreIdentityMemory[];
  life_chapter_memories: LifeChapterMemory[];
  significant_event_memories: SignificantEventMemory[];
  relationship_memories: RelationshipMemoryBank[];
  skill_memories: SkillMemory[];
  emotional_memories: EmotionalMemory[];
  
  // Memory access patterns
  memory_retrieval_triggers: MemoryTrigger[];
  memory_association_patterns: MemoryAssociation[];
  memory_emotional_weighting: EmotionalWeighting[];
  
  // Narrative construction
  personal_narrative: PersonalNarrative;
  life_story_themes: LifeStoryTheme[];
  identity_coherence: IdentityCoherence;
}

// Types for enums and complex structures
export type AgePeriod = 'early_childhood' | 'childhood' | 'adolescence' | 'young_adult' | 'adult' | 'current';
export type LifePhase = 'establishing' | 'building' | 'maintaining' | 'transitioning' | 'reflecting';
export type RelationshipType = 'family' | 'romantic' | 'close_friend' | 'friend' | 'colleague' | 'acquaintance' | 'mentor' | 'mentee';
export type LifeEventType = 'career' | 'relationship' | 'health' | 'family' | 'financial' | 'personal_growth' | 'crisis' | 'achievement';
export type LifeDomain = 'career' | 'relationships' | 'health' | 'finances' | 'personal_growth' | 'family' | 'social' | 'spiritual';

// Comprehensive type exports
export interface DigitalHuman {
  id: string;
  personality: CorePersonality;
  life_context: DigitalHumanLife;
  memory_system: AutobiographicalMemory;
  relationship_network: RelationshipMemoryBank[];
  life_event_engine: LifeEventEngine;
  
  // Dynamic state
  current_mood: MoodState;
  current_energy: EnergyState;
  current_stress_level: number;
  current_social_battery: number;
  current_life_satisfaction: number;
  
  // Evolution and growth
  personality_evolution: PersonalityEvolution[];
  relationship_growth: RelationshipGrowth[];
  life_learning: LifeLearning[];
  
  // Meta information
  creation_date: string;
  last_interaction: string;
  interaction_count: number;
  relationship_development_stage: DevelopmentStage;
}

// Additional supporting types
export interface MoodState {
  primary_emotion: EmotionType;
  emotion_intensity: number;
  mood_duration: number;
  mood_triggers: MoodTrigger[];
  mood_effects: MoodEffect[];
}

export interface PersonalityEvolution {
  trait_name: string;
  previous_value: number;
  current_value: number;
  change_trigger: EvolutionTrigger;
  change_date: string;
  change_impact: EvolutionImpact[];
}

export type EmotionType = 
  | 'joy' | 'contentment' | 'excitement' | 'gratitude' | 'love' | 'pride'
  | 'sadness' | 'disappointment' | 'grief' | 'loneliness' | 'melancholy'
  | 'anger' | 'frustration' | 'irritation' | 'resentment' | 'indignation'
  | 'fear' | 'anxiety' | 'worry' | 'nervousness' | 'apprehension'
  | 'surprise' | 'curiosity' | 'wonder' | 'confusion' | 'anticipation'
  | 'calm' | 'relaxed' | 'peaceful' | 'centered' | 'focused';

export type DevelopmentStage = 
  | 'initial_contact' | 'getting_acquainted' | 'building_rapport' 
  | 'developing_friendship' | 'close_friendship' | 'deep_bond' | 'life_companion';