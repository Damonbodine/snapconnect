/**
 * Digital Human Services
 * Centralized exports for all digital human functionality
 */

// Core services
export { digitalHumanAIService, type DigitalHumanRequest, type DigitalHumanResponse } from './aiService';
export { digitalHumanMemoryService, type ConversationMemory, type ConversationSnapshot, type HumanDetails } from './digitalHumanMemory';
export { DigitalHumanPersonality } from './digitalHumanPersonality';

// Legacy service (if needed)
export { digitalHumanService } from './digitalHumanService';