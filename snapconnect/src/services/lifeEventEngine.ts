/**
 * Life Event Engine
 * Generates realistic life events for digital humans to create authentic human experiences
 */

import { supabase } from './supabase';
import { 
  LifeEvent, 
  DigitalHuman, 
  LifeEventType, 
  LifeDomain,
  CorePersonality 
} from '../types/digitalHuman';

export interface LifeEventTemplate {
  id: string;
  event_type: LifeEventType;
  title: string;
  description_template: string;
  probability_base: number; // 0-1
  personality_modifiers: PersonalityModifier[];
  life_domain_effects: LifeDomainEffect[];
  duration_range: [number, number]; // days
  impact_magnitude_range: [number, number]; // 1-10
  prerequisites?: Prerequisite[];
  exclusions?: Exclusion[];
}

export interface PersonalityModifier {
  trait_name: string;
  trait_range: [number, number];
  probability_multiplier: number;
}

export interface LifeDomainEffect {
  domain: LifeDomain;
  effect_type: 'positive' | 'negative' | 'neutral' | 'mixed';
  intensity: number; // 1-10
}

export class LifeEventEngine {
  private static instance: LifeEventEngine;

  public static getInstance(): LifeEventEngine {
    if (!LifeEventEngine.instance) {
      LifeEventEngine.instance = new LifeEventEngine();
    }
    return LifeEventEngine.instance;
  }

  /**
   * Generate life events for all digital humans
   */
  async generateDailyLifeEvents(): Promise<void> {
    try {
      console.log('🎭 Generating daily life events for digital humans');

      // Get all active digital humans
      const digitalHumans = await this.getActiveDigitalHumans();
      
      for (const digitalHuman of digitalHumans) {
        await this.generateLifeEventsForDigitalHuman(digitalHuman);
      }

      console.log(`✅ Generated life events for ${digitalHumans.length} digital humans`);
    } catch (error) {
      console.error('❌ Failed to generate daily life events:', error);
      throw error;
    }
  }

  /**
   * Generate life events for a specific digital human
   */
  async generateLifeEventsForDigitalHuman(digitalHuman: DigitalHuman): Promise<LifeEvent[]> {
    try {
      const events: LifeEvent[] = [];
      
      // Get applicable event templates
      const templates = this.getApplicableEventTemplates(digitalHuman);
      
      for (const template of templates) {
        const probability = this.calculateEventProbability(template, digitalHuman);
        
        if (Math.random() < probability) {
          const event = await this.generateEventFromTemplate(template, digitalHuman);
          events.push(event);
          
          // Store event in database
          await this.storeLifeEvent(digitalHuman.id, event);
          
          console.log(`🎯 Generated life event: ${event.event_type} for ${digitalHuman.id}`);
        }
      }

      return events;
    } catch (error) {
      console.error('❌ Failed to generate life events for digital human:', error);
      return [];
    }
  }

  /**
   * Get life event templates based on personality and life context
   */
  private getApplicableEventTemplates(digitalHuman: DigitalHuman): LifeEventTemplate[] {
    return LIFE_EVENT_TEMPLATES.filter(template => {
      // Check prerequisites
      if (template.prerequisites) {
        const meetsPrerequisites = template.prerequisites.every(prereq => 
          this.checkPrerequisite(prereq, digitalHuman)
        );
        if (!meetsPrerequisites) return false;
      }

      // Check exclusions
      if (template.exclusions) {
        const hasExclusions = template.exclusions.some(exclusion =>
          this.checkExclusion(exclusion, digitalHuman)
        );
        if (hasExclusions) return false;
      }

      return true;
    });
  }

  /**
   * Calculate event probability based on personality and context
   */
  private calculateEventProbability(template: LifeEventTemplate, digitalHuman: DigitalHuman): number {
    let probability = template.probability_base;

    // Apply personality modifiers
    for (const modifier of template.personality_modifiers) {
      const traitValue = this.getPersonalityTraitValue(digitalHuman.personality, modifier.trait_name);
      
      if (traitValue >= modifier.trait_range[0] && traitValue <= modifier.trait_range[1]) {
        probability *= modifier.probability_multiplier;
      }
    }

    // Apply life context modifiers
    probability *= this.getLifeContextModifier(template, digitalHuman);

    // Apply recent events modifier (avoid clustering)
    probability *= this.getRecentEventsModifier(template, digitalHuman);

    return Math.min(1, Math.max(0, probability));
  }

  /**
   * Generate specific life event from template
   */
  private async generateEventFromTemplate(template: LifeEventTemplate, digitalHuman: DigitalHuman): Promise<LifeEvent> {
    const duration = this.randomInRange(template.duration_range[0], template.duration_range[1]);
    const impact = this.randomInRange(template.impact_magnitude_range[0], template.impact_magnitude_range[1]);

    return {
      event_id: `${digitalHuman.id}_${template.id}_${Date.now()}`,
      event_type: template.event_type,
      trigger_source: 'life_simulation',
      impact_magnitude: impact,
      duration: {
        type: 'days',
        value: duration,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
      },
      life_domains_affected: template.life_domain_effects.map(effect => effect.domain),
      emotional_journey: this.generateEmotionalJourney(template, digitalHuman),
      personality_effects: this.generatePersonalityEffects(template, digitalHuman),
      relationship_effects: this.generateRelationshipEffects(template, digitalHuman),
      growth_outcomes: this.generateGrowthOutcomes(template, digitalHuman),
      support_utilization: this.generateSupportUtilization(template, digitalHuman),
    };
  }

  /**
   * Generate emotional journey for life event
   */
  private generateEmotionalJourney(template: LifeEventTemplate, digitalHuman: DigitalHuman): any[] {
    const journey = [];
    const personality = digitalHuman.personality;

    // Initial emotional response
    const initialEmotion = this.determineInitialEmotionalResponse(template, personality);
    journey.push({
      phase: 'initial_reaction',
      primary_emotion: initialEmotion,
      intensity: this.calculateEmotionalIntensity(template, personality),
      duration_hours: this.calculateEmotionalDuration(personality),
    });

    // Processing phase
    journey.push({
      phase: 'processing',
      primary_emotion: this.determineProcessingEmotion(template, personality),
      intensity: Math.max(1, journey[0].intensity - 2),
      duration_hours: this.calculateProcessingDuration(personality),
    });

    // Resolution phase
    journey.push({
      phase: 'resolution',
      primary_emotion: this.determineResolutionEmotion(template, personality),
      intensity: Math.max(1, journey[0].intensity - 4),
      duration_hours: this.calculateResolutionDuration(personality),
    });

    return journey;
  }

  /**
   * Determine how life event affects personality traits
   */
  private generatePersonalityEffects(template: LifeEventTemplate, digitalHuman: DigitalHuman): any[] {
    const effects = [];
    const personality = digitalHuman.personality;

    // Different event types affect different traits
    switch (template.event_type) {
      case 'career':
        if (template.life_domain_effects.some(e => e.effect_type === 'positive')) {
          effects.push({
            trait: 'conscientiousness',
            change: this.calculateTraitChange(personality.conscientiousness, 3),
            reason: 'Career success builds confidence in work habits',
          });
        }
        break;
      
      case 'relationship':
        effects.push({
          trait: 'trust_building_speed',
          change: this.calculateTraitChange(personality.trust_building_speed, 
            template.life_domain_effects[0].effect_type === 'positive' ? 2 : -2),
          reason: 'Relationship experiences affect trust patterns',
        });
        break;

      case 'health':
        effects.push({
          trait: 'resilience_level',
          change: this.calculateTraitChange(personality.resilience_level, 2),
          reason: 'Health challenges build resilience',
        });
        break;

      case 'crisis':
        effects.push({
          trait: 'emotional_regulation',
          change: this.calculateTraitChange(personality.emotional_regulation, 3),
          reason: 'Crisis situations develop emotional regulation skills',
        });
        break;
    }

    return effects;
  }

  /**
   * Generate how event affects relationships
   */
  private generateRelationshipEffects(template: LifeEventTemplate, digitalHuman: DigitalHuman): any[] {
    const effects = [];

    // Events often bring people together or create distance
    if (template.event_type === 'crisis') {
      effects.push({
        relationship_type: 'close_friend',
        effect_type: 'strengthening',
        reason: 'Crisis reveals who provides genuine support',
        impact_level: 3,
      });
    }

    if (template.event_type === 'achievement') {
      effects.push({
        relationship_type: 'acquaintance',
        effect_type: 'attraction',
        reason: 'Success attracts new social connections',
        impact_level: 2,
      });
    }

    return effects;
  }

  /**
   * Generate growth outcomes from life events
   */
  private generateGrowthOutcomes(template: LifeEventTemplate, digitalHuman: DigitalHuman): any[] {
    const outcomes = [];

    // Every significant event leads to some growth
    outcomes.push({
      growth_type: 'life_experience',
      description: `Gained deeper understanding of ${template.event_type} challenges`,
      wisdom_gained: this.generateWisdomGained(template, digitalHuman),
      applicable_situations: this.generateApplicableSituations(template),
    });

    // Specific growth based on event type
    if (template.event_type === 'relationship') {
      outcomes.push({
        growth_type: 'emotional_intelligence',
        description: 'Better understanding of relationship dynamics',
        skills_developed: ['empathy', 'communication', 'boundary_setting'],
      });
    }

    return outcomes;
  }

  /**
   * Helper methods
   */
  private getPersonalityTraitValue(personality: CorePersonality, traitName: string): number {
    return (personality as any)[traitName] || 50;
  }

  private getLifeContextModifier(template: LifeEventTemplate, digitalHuman: DigitalHuman): number {
    // Adjust probability based on current life situation
    let modifier = 1.0;

    // Stress level affects event probability
    if (digitalHuman.current_stress_level > 7) {
      modifier *= template.event_type === 'crisis' ? 1.5 : 0.7;
    }

    // Life satisfaction affects certain events
    if (digitalHuman.current_life_satisfaction < 5) {
      modifier *= template.event_type === 'personal_growth' ? 1.3 : 1.0;
    }

    return modifier;
  }

  private getRecentEventsModifier(template: LifeEventTemplate, digitalHuman: DigitalHuman): number {
    // TODO: Check recent events to avoid clustering
    // For now, return 1.0
    return 1.0;
  }

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private checkPrerequisite(prereq: any, digitalHuman: DigitalHuman): boolean {
    // TODO: Implement prerequisite checking
    return true;
  }

  private checkExclusion(exclusion: any, digitalHuman: DigitalHuman): boolean {
    // TODO: Implement exclusion checking
    return false;
  }

  private determineInitialEmotionalResponse(template: LifeEventTemplate, personality: CorePersonality): string {
    const eventType = template.event_type;
    const isPositive = template.life_domain_effects.some(e => e.effect_type === 'positive');
    
    if (isPositive) {
      return personality.optimism_baseline > 70 ? 'joy' : 'contentment';
    } else {
      return personality.neuroticism > 60 ? 'anxiety' : 'concern';
    }
  }

  private calculateEmotionalIntensity(template: LifeEventTemplate, personality: CorePersonality): number {
    const baseIntensity = template.impact_magnitude_range[1];
    const personalityModifier = personality.emotional_regulation / 100;
    return Math.round(baseIntensity * (2 - personalityModifier));
  }

  private calculateEmotionalDuration(personality: CorePersonality): number {
    return Math.round(24 * (1 + (100 - personality.emotional_regulation) / 100));
  }

  private calculateProcessingDuration(personality: CorePersonality): number {
    return Math.round(48 * (1 + (100 - personality.emotional_regulation) / 100));
  }

  private calculateResolutionDuration(personality: CorePersonality): number {
    return Math.round(72 * (1 + (100 - personality.resilience_level) / 100));
  }

  private determineProcessingEmotion(template: LifeEventTemplate, personality: CorePersonality): string {
    return 'contemplative';
  }

  private determineResolutionEmotion(template: LifeEventTemplate, personality: CorePersonality): string {
    return personality.optimism_baseline > 60 ? 'acceptance' : 'resignation';
  }

  private calculateTraitChange(currentValue: number, changeDirection: number): number {
    const maxChange = 5; // Limit trait changes
    const actualChange = Math.min(maxChange, Math.abs(changeDirection)) * Math.sign(changeDirection);
    return Math.max(0, Math.min(100, currentValue + actualChange));
  }

  private generateWisdomGained(template: LifeEventTemplate, digitalHuman: DigitalHuman): string[] {
    return [
      `${template.event_type} situations require patience and perspective`,
      'Every challenge is an opportunity for growth',
      'Support systems are crucial during difficult times',
    ];
  }

  private generateApplicableSituations(template: LifeEventTemplate): string[] {
    return [
      `Future ${template.event_type} challenges`,
      'Supporting others in similar situations',
      'Making decisions under pressure',
    ];
  }

  private generateSupportUtilization(template: LifeEventTemplate, digitalHuman: DigitalHuman): any[] {
    return [
      {
        support_type: 'emotional',
        source: 'close_friends',
        effectiveness: 8,
        duration_days: 7,
      },
      {
        support_type: 'practical',
        source: 'family',
        effectiveness: 7,
        duration_days: 14,
      },
    ];
  }

  /**
   * Database operations
   */
  private async getActiveDigitalHumans(): Promise<DigitalHuman[]> {
    try {
      const { data, error } = await supabase
        .from('digital_humans')
        .select('*');

      if (error) throw error;

      // Convert database records back to DigitalHuman objects
      return data.map(record => this.convertToDigitalHuman(record));
    } catch (error) {
      console.error('❌ Failed to get active digital humans:', error);
      return [];
    }
  }

  private async storeLifeEvent(digitalHumanId: string, event: LifeEvent): Promise<void> {
    try {
      const { error } = await supabase
        .from('digital_human_life_events')
        .insert({
          digital_human_id: digitalHumanId,
          event_id: event.event_id,
          event_type: event.event_type,
          event_data: event,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Failed to store life event:', error);
      throw error;
    }
  }

  private convertToDigitalHuman(record: any): DigitalHuman {
    // TODO: Implement proper conversion from database record to DigitalHuman
    return record as DigitalHuman;
  }
}

/**
 * Life Event Templates Database
 */
const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  // Career Events
  {
    id: 'work_promotion',
    event_type: 'career',
    title: 'Work Promotion Opportunity',
    description_template: 'Received an opportunity for promotion at work',
    probability_base: 0.02, // 2% daily chance
    personality_modifiers: [
      { trait_name: 'conscientiousness', trait_range: [70, 100], probability_multiplier: 1.5 },
      { trait_name: 'risk_tolerance', trait_range: [60, 100], probability_multiplier: 1.3 },
    ],
    life_domain_effects: [
      { domain: 'career', effect_type: 'positive', intensity: 7 },
      { domain: 'finances', effect_type: 'positive', intensity: 5 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 6 },
    ],
    duration_range: [30, 90],
    impact_magnitude_range: [6, 8],
  },
  
  {
    id: 'work_stress_project',
    event_type: 'career',
    title: 'High-Stress Work Project',
    description_template: 'Assigned to a challenging, high-pressure project',
    probability_base: 0.05, // 5% daily chance
    personality_modifiers: [
      { trait_name: 'conscientiousness', trait_range: [80, 100], probability_multiplier: 1.4 },
      { trait_name: 'neuroticism', trait_range: [60, 100], probability_multiplier: 1.2 },
    ],
    life_domain_effects: [
      { domain: 'career', effect_type: 'mixed', intensity: 6 },
      { domain: 'health', effect_type: 'negative', intensity: 4 },
      { domain: 'relationships', effect_type: 'negative', intensity: 3 },
    ],
    duration_range: [14, 60],
    impact_magnitude_range: [5, 7],
  },

  // Relationship Events
  {
    id: 'friendship_deepening',
    event_type: 'relationship',
    title: 'Friendship Deepening',
    description_template: 'A friendship has grown deeper through shared experiences',
    probability_base: 0.03,
    personality_modifiers: [
      { trait_name: 'extraversion', trait_range: [60, 100], probability_multiplier: 1.3 },
      { trait_name: 'agreeableness', trait_range: [70, 100], probability_multiplier: 1.4 },
    ],
    life_domain_effects: [
      { domain: 'relationships', effect_type: 'positive', intensity: 6 },
      { domain: 'social', effect_type: 'positive', intensity: 5 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 4 },
    ],
    duration_range: [7, 30],
    impact_magnitude_range: [4, 6],
  },

  {
    id: 'family_conflict',
    event_type: 'family',
    title: 'Family Disagreement',
    description_template: 'Experiencing tension with family members',
    probability_base: 0.04,
    personality_modifiers: [
      { trait_name: 'agreeableness', trait_range: [0, 40], probability_multiplier: 1.5 },
      { trait_name: 'neuroticism', trait_range: [60, 100], probability_multiplier: 1.3 },
    ],
    life_domain_effects: [
      { domain: 'family', effect_type: 'negative', intensity: 6 },
      { domain: 'health', effect_type: 'negative', intensity: 3 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 2 },
    ],
    duration_range: [3, 21],
    impact_magnitude_range: [4, 7],
  },

  // Health Events
  {
    id: 'fitness_breakthrough',
    event_type: 'health',
    title: 'Fitness Breakthrough',
    description_template: 'Achieved a significant fitness milestone',
    probability_base: 0.03,
    personality_modifiers: [
      { trait_name: 'conscientiousness', trait_range: [70, 100], probability_multiplier: 1.6 },
      { trait_name: 'personal_growth_hunger', trait_range: [70, 100], probability_multiplier: 1.4 },
    ],
    life_domain_effects: [
      { domain: 'health', effect_type: 'positive', intensity: 8 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 6 },
      { domain: 'social', effect_type: 'positive', intensity: 4 },
    ],
    duration_range: [7, 14],
    impact_magnitude_range: [5, 7],
  },

  // Personal Growth Events
  {
    id: 'new_skill_mastery',
    event_type: 'personal_growth',
    title: 'New Skill Mastery',
    description_template: 'Successfully learned and mastered a new skill',
    probability_base: 0.02,
    personality_modifiers: [
      { trait_name: 'openness', trait_range: [70, 100], probability_multiplier: 1.8 },
      { trait_name: 'personal_growth_hunger', trait_range: [80, 100], probability_multiplier: 1.5 },
    ],
    life_domain_effects: [
      { domain: 'personal_growth', effect_type: 'positive', intensity: 7 },
      { domain: 'career', effect_type: 'positive', intensity: 3 },
    ],
    duration_range: [14, 30],
    impact_magnitude_range: [4, 6],
  },

  // Financial Events
  {
    id: 'unexpected_expense',
    event_type: 'financial',
    title: 'Unexpected Major Expense',
    description_template: 'Faced with an unexpected significant financial expense',
    probability_base: 0.03,
    personality_modifiers: [
      { trait_name: 'neuroticism', trait_range: [60, 100], probability_multiplier: 1.4 },
      { trait_name: 'conscientiousness', trait_range: [0, 50], probability_multiplier: 1.3 },
    ],
    life_domain_effects: [
      { domain: 'finances', effect_type: 'negative', intensity: 7 },
      { domain: 'health', effect_type: 'negative', intensity: 4 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 3 },
    ],
    duration_range: [7, 60],
    impact_magnitude_range: [5, 8],
  },

  // Crisis Events
  {
    id: 'support_friend_crisis',
    event_type: 'crisis',
    title: 'Friend in Crisis',
    description_template: 'A close friend is going through a personal crisis',
    probability_base: 0.02,
    personality_modifiers: [
      { trait_name: 'empathy', trait_range: [70, 100], probability_multiplier: 1.8 },
      { trait_name: 'altruism_drive', trait_range: [70, 100], probability_multiplier: 1.6 },
    ],
    life_domain_effects: [
      { domain: 'relationships', effect_type: 'mixed', intensity: 6 },
      { domain: 'health', effect_type: 'negative', intensity: 3 },
      { domain: 'personal_growth', effect_type: 'positive', intensity: 5 },
    ],
    duration_range: [14, 90],
    impact_magnitude_range: [5, 8],
  },
];

export const lifeEventEngine = LifeEventEngine.getInstance();