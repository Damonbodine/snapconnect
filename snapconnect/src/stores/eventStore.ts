import { create } from 'zustand';
import { eventService, Event, EventCategory, CreateEventData, EventParticipant, EventFilters } from '../services/eventService';
import { LocationCoordinates, locationService, LocationResult } from '../services/locationService';
import { supabase } from '../services/supabase';
import { walkSuggestionService } from '../services/walkSuggestionService';
import { 
  WalkSuggestion, 
  WalkSuggestionRequest,
  UserWalkingProfile,
  WalkPreferences,
  ContextualFactors,
  SuggestionFilters,
  SuggestionGenerationOptions,
  WalkType,
  WalkDifficulty,
} from '../types/walkSuggestion';

export interface RSVPStats {
  totalEventsRSVP: number;
  totalEventsCreated: number;
  totalEventsAttended: number;
  currentStreak: number; // days with activity
  bestStreak: number; // best streak ever achieved
  totalActivityDays: number; // total unique days with activity
  attendanceRate: number; // percentage of RSVP'd events attended
  favoriteEventCategories: Array<{
    category: string;
    count: number;
  }>;
  recentActivity: Array<{
    type: 'rsvp' | 'created' | 'attended';
    eventTitle: string;
    date: string;
  }>;
  upcomingEventsCount: number;
}

interface EventFormData {
  title: string;
  description: string;
  category_id: string;
  location_name: string;
  location_address: string;
  location_coordinates: LocationCoordinates | null;
  location_details: string;
  start_time: Date | null;
  end_time: Date | null;
  max_participants: string;
  fitness_levels: string[];
  equipment_needed: string[];
  cost_cents: string;
  visibility: 'public' | 'friends' | 'private';
}

interface EventStore {
  // Data
  events: Event[];
  userCreatedEvents: Event[];
  userRSVPEvents: Event[];
  categories: EventCategory[];
  currentEvent: Event | null;
  
  // Walk Suggestions
  walkSuggestions: WalkSuggestion[];
  currentSuggestion: WalkSuggestion | null;
  userWalkingProfile: UserWalkingProfile | null;
  walkPreferences: WalkPreferences;
  suggestionFilters: SuggestionFilters;
  
  // Form state
  formData: EventFormData;
  
  // UI state
  isLoading: boolean;
  isCreating: boolean;
  isLoadingLocation: boolean;
  isLoadingSuggestions: boolean;
  error: string | null;
  suggestionError: string | null;
  filters: EventFilters;
  activeTab: 'all' | 'going' | 'created' | 'nearby' | 'suggestions';
  
  // Location state
  userLocation: LocationCoordinates | null;
  locationResults: LocationResult[];
  
  // Actions - Data Loading
  loadEvents: () => Promise<void>;
  loadUserCreatedEvents: (userId: string) => Promise<void>;
  loadUserRSVPEvents: (userId: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  loadEventById: (eventId: string) => Promise<void>;
  
  // Actions - Event Management
  createEvent: (userId: string) => Promise<string>;
  updateEvent: (eventId: string, userId: string) => Promise<void>;
  deleteEvent: (eventId: string, userId: string) => Promise<void>;
  
  // Actions - RSVP Management
  rsvpToEvent: (eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going') => Promise<void>;
  getUserEventRSVP: (eventId: string, userId: string) => Promise<EventParticipant | null>;
  
  // Actions - RSVP Statistics
  getUserRSVPStats: (userId: string) => Promise<RSVPStats>;
  getUpcomingUserEvents: (userId: string) => Promise<Event[]>;
  getUserEventHistory: (userId: string) => Promise<Event[]>;
  
  // Actions - Walk Suggestions
  generateWalkSuggestions: (userId: string, options?: SuggestionGenerationOptions) => Promise<void>;
  loadWalkSuggestion: (suggestionId: string) => Promise<void>;
  updateUserWalkingProfile: (profile: UserWalkingProfile) => void;
  updateWalkPreferences: (preferences: Partial<WalkPreferences>) => void;
  setSuggestionFilters: (filters: Partial<SuggestionFilters>) => void;
  createEventFromSuggestion: (suggestion: WalkSuggestion, userId: string) => Promise<string>;
  dismissSuggestion: (suggestionId: string) => void;
  rateSuggestion: (suggestionId: string, rating: number, feedback?: string) => Promise<void>;
  clearSuggestions: () => void;
  
  // Actions - Form Management
  updateFormData: (updates: Partial<EventFormData>) => void;
  resetFormData: () => void;
  validateForm: () => boolean;
  
  // Actions - Location
  getCurrentLocation: () => Promise<void>;
  searchLocations: (query: string) => Promise<void>;
  setUserLocation: (location: LocationCoordinates | null) => void;
  
  // Actions - UI State
  setActiveTab: (tab: 'all' | 'going' | 'created' | 'nearby' | 'suggestions') => void;
  setFilters: (filters: Partial<EventFilters>) => void;
  setSuggestionError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

const initialFormData: EventFormData = {
  title: '',
  description: '',
  category_id: '',
  location_name: '',
  location_address: '',
  location_coordinates: null,
  location_details: '',
  start_time: null,
  end_time: null,
  max_participants: '',
  fitness_levels: [],
  equipment_needed: [],
  cost_cents: '0',
  visibility: 'public',
};

const initialWalkPreferences: WalkPreferences = {
  preferredTypes: [],
  avoidBusyAreas: false,
  requireShade: false,
  preferPavedPaths: false,
  includeRestStops: true,
  preferredTimeOfDay: 'any',
};

export const useEventStore = create<EventStore>((set, get) => ({
  // Initial state
  events: [],
  userCreatedEvents: [],
  userRSVPEvents: [],
  categories: [],
  currentEvent: null,
  
  // Walk Suggestions initial state
  walkSuggestions: [],
  currentSuggestion: null,
  userWalkingProfile: null,
  walkPreferences: initialWalkPreferences,
  suggestionFilters: {},
  
  formData: initialFormData,
  
  isLoading: false,
  isCreating: false,
  isLoadingLocation: false,
  isLoadingSuggestions: false,
  error: null,
  suggestionError: null,
  filters: {},
  activeTab: 'all',
  
  userLocation: null,
  locationResults: [],

  // Data Loading Actions
  loadEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const events = await eventService.getPublicEvents(filters);
      set({ events, isLoading: false });
    } catch (error: any) {
      console.error('Error loading events:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadUserCreatedEvents: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const userCreatedEvents = await eventService.getUserCreatedEvents(userId);
      set({ userCreatedEvents, isLoading: false });
    } catch (error: any) {
      console.error('Error loading user created events:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadUserRSVPEvents: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const userRSVPEvents = await eventService.getUserRSVPEvents(userId);
      set({ userRSVPEvents, isLoading: false });
    } catch (error: any) {
      console.error('Error loading user RSVP events:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await eventService.getEventCategories();
      set({ categories });
    } catch (error: any) {
      console.error('Error loading categories:', error);
      set({ error: error.message });
    }
  },

  loadEventById: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const event = await eventService.getEventById(eventId);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      console.error('Error loading event:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Event Management Actions
  createEvent: async (userId: string) => {
    const { formData } = get();
    
    if (!get().validateForm()) {
      throw new Error('Please fill in all required fields');
    }

    set({ isCreating: true, error: null });
    
    try {
      const createData: CreateEventData = {
        title: formData.title,
        description: formData.description || undefined,
        category_id: formData.category_id,
        location_name: formData.location_name,
        location_address: formData.location_address || undefined,
        location_coordinates: formData.location_coordinates!,
        location_details: formData.location_details || undefined,
        start_time: formData.start_time!.toISOString(),
        end_time: formData.end_time?.toISOString(),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : undefined,
        fitness_levels: formData.fitness_levels,
        equipment_needed: formData.equipment_needed,
        cost_cents: parseInt(formData.cost_cents),
        visibility: formData.visibility,
      };

      const event = await eventService.createEvent(createData, userId);
      
      // Update relevant event lists
      const { events, userCreatedEvents } = get();
      set({ 
        events: [event, ...events],
        userCreatedEvents: [event, ...userCreatedEvents],
        isCreating: false 
      });
      
      // Reset form
      get().resetFormData();
      
      return event.id;
    } catch (error: any) {
      console.error('Error creating event:', error);
      set({ error: error.message, isCreating: false });
      throw error;
    }
  },

  updateEvent: async (eventId: string, userId: string) => {
    const { formData } = get();
    
    if (!get().validateForm()) {
      throw new Error('Please fill in all required fields');
    }

    set({ isCreating: true, error: null });
    
    try {
      const updateData: Partial<CreateEventData> = {
        title: formData.title,
        description: formData.description || undefined,
        category_id: formData.category_id,
        location_name: formData.location_name,
        location_address: formData.location_address || undefined,
        location_coordinates: formData.location_coordinates!,
        location_details: formData.location_details || undefined,
        start_time: formData.start_time!.toISOString(),
        end_time: formData.end_time?.toISOString(),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : undefined,
        fitness_levels: formData.fitness_levels,
        equipment_needed: formData.equipment_needed,
        cost_cents: parseInt(formData.cost_cents),
        visibility: formData.visibility,
      };

      const updatedEvent = await eventService.updateEvent(eventId, updateData, userId);
      
      // Update event in all relevant arrays
      const { events, userCreatedEvents } = get();
      const updateEventInArray = (arr: Event[]) => 
        arr.map(e => e.id === eventId ? updatedEvent : e);
      
      set({ 
        events: updateEventInArray(events),
        userCreatedEvents: updateEventInArray(userCreatedEvents),
        currentEvent: updatedEvent,
        isCreating: false 
      });
    } catch (error: any) {
      console.error('Error updating event:', error);
      set({ error: error.message, isCreating: false });
      throw error;
    }
  },

  deleteEvent: async (eventId: string, userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await eventService.deleteEvent(eventId, userId);
      
      // Remove event from all arrays
      const { events, userCreatedEvents } = get();
      const filterEventFromArray = (arr: Event[]) => arr.filter(e => e.id !== eventId);
      
      set({ 
        events: filterEventFromArray(events),
        userCreatedEvents: filterEventFromArray(userCreatedEvents),
        isLoading: false 
      });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // RSVP Management Actions
  rsvpToEvent: async (eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going') => {
    try {
      await eventService.rsvpToEvent(eventId, userId, status);
      
      // Refresh user RSVP events if needed
      if (status === 'going' || status === 'maybe') {
        get().loadUserRSVPEvents(userId);
      }
    } catch (error: any) {
      console.error('Error updating RSVP:', error);
      set({ error: error.message });
      throw error;
    }
  },

  getUserEventRSVP: async (eventId: string, userId: string) => {
    try {
      return await eventService.getUserEventRSVP(eventId, userId);
    } catch (error: any) {
      console.error('Error getting user RSVP:', error);
      return null;
    }
  },

  // RSVP Statistics Actions
  getUserRSVPStats: async (userId: string): Promise<RSVPStats> => {
    try {
      // Use the new database function to get comprehensive stats
      const { data, error } = await supabase.rpc('get_user_rsvp_stats', {
        target_user_id: userId,
      });

      if (error) {
        console.error('Error calling get_user_rsvp_stats:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        // Return default stats if no data
        return {
          totalEventsRSVP: 0,
          totalEventsCreated: 0,
          totalEventsAttended: 0,
          currentStreak: 0,
          bestStreak: 0,
          totalActivityDays: 0,
          attendanceRate: 0,
          favoriteEventCategories: [],
          recentActivity: [],
          upcomingEventsCount: 0,
        };
      }

      const stats = data[0];

      // Parse JSONB data from database
      const favoriteEventCategories = stats.favorite_categories || [];
      const recentActivity = stats.recent_activity || [];

      return {
        totalEventsRSVP: stats.total_events_rsvp || 0,
        totalEventsCreated: stats.total_events_created || 0,
        totalEventsAttended: stats.total_events_attended || 0,
        currentStreak: stats.current_streak || 0,
        bestStreak: stats.best_streak || 0,
        totalActivityDays: stats.total_activity_days || 0,
        attendanceRate: stats.attendance_rate || 0,
        favoriteEventCategories,
        recentActivity,
        upcomingEventsCount: stats.upcoming_events_count || 0,
      };
    } catch (error: any) {
      console.error('Error getting RSVP stats:', error);
      throw new Error(`Failed to get RSVP statistics: ${error.message}`);
    }
  },

  getUpcomingUserEvents: async (userId: string): Promise<Event[]> => {
    try {
      const userRSVPEvents = await eventService.getUserRSVPEvents(userId, 'going');
      const now = new Date().toISOString();
      
      return userRSVPEvents
        .filter(event => event.start_time > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 10); // Limit to next 10 events
    } catch (error: any) {
      console.error('Error getting upcoming events:', error);
      throw new Error(`Failed to get upcoming events: ${error.message}`);
    }
  },

  getUserEventHistory: async (userId: string): Promise<Event[]> => {
    try {
      const userRSVPEvents = await eventService.getUserRSVPEvents(userId);
      const now = new Date().toISOString();
      
      return userRSVPEvents
        .filter(event => event.start_time <= now)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, 20); // Limit to last 20 events
    } catch (error: any) {
      console.error('Error getting event history:', error);
      throw new Error(`Failed to get event history: ${error.message}`);
    }
  },

  // Walk Suggestions Actions
  generateWalkSuggestions: async (userId: string, options?: SuggestionGenerationOptions) => {
    const { userLocation, userWalkingProfile, walkPreferences } = get();
    
    if (!userLocation) {
      set({ suggestionError: 'Location is required to generate walk suggestions' });
      return;
    }

    if (!userWalkingProfile) {
      // Create a default profile based on available data
      const defaultProfile: UserWalkingProfile = {
        userId,
        fitnessLevel: 'intermediate',
        preferredDistance: { min: 1, max: 5 },
        preferredDuration: { min: 20, max: 90 },
        interests: ['nature', 'fitness'],
        socialPreference: 'any',
      };
      set({ userWalkingProfile: defaultProfile });
    }

    set({ isLoadingSuggestions: true, suggestionError: null });

    try {
      const currentTime = new Date();
      const timeOfDay = currentTime.getHours() < 12 ? 'morning' : 
                       currentTime.getHours() < 17 ? 'afternoon' : 'evening';
      
      const request: WalkSuggestionRequest = {
        userLocation,
        userProfile: userWalkingProfile || get().userWalkingProfile!,
        preferences: walkPreferences,
        contextualFactors: {
          timeOfDay,
          dayOfWeek: currentTime.getDay() === 0 || currentTime.getDay() === 6 ? 'weekend' : 'weekday',
          season: 'summer', // TODO: Calculate from date
        },
      };

      const suggestions = await walkSuggestionService.generateWalkSuggestions(
        request,
        options || { count: 3, diversityFactor: 0.7, useCache: true, forceRefresh: false }
      );

      set({ 
        walkSuggestions: suggestions, 
        isLoadingSuggestions: false 
      });

    } catch (error: any) {
      console.error('Error generating walk suggestions:', error);
      set({ 
        suggestionError: error.message, 
        isLoadingSuggestions: false 
      });
    }
  },

  loadWalkSuggestion: async (suggestionId: string) => {
    const { walkSuggestions } = get();
    const suggestion = walkSuggestions.find(s => s.id === suggestionId);
    
    if (suggestion) {
      set({ currentSuggestion: suggestion });
    }
  },

  updateUserWalkingProfile: (profile: UserWalkingProfile) => {
    set({ userWalkingProfile: profile });
  },

  updateWalkPreferences: (preferences: Partial<WalkPreferences>) => {
    set(state => ({
      walkPreferences: { ...state.walkPreferences, ...preferences }
    }));
  },

  setSuggestionFilters: (filters: Partial<SuggestionFilters>) => {
    set(state => ({
      suggestionFilters: { ...state.suggestionFilters, ...filters }
    }));
  },

  createEventFromSuggestion: async (suggestion: WalkSuggestion, userId: string) => {
    set({ isCreating: true, error: null });
    
    try {
      // Convert suggestion to event data
      const eventData: CreateEventData = {
        title: suggestion.suggestedEventTitle || suggestion.title,
        description: suggestion.suggestedEventDescription || suggestion.description,
        category_id: '', // TODO: Get walking/outdoor category ID
        location_name: `${suggestion.title} Starting Point`,
        location_address: undefined,
        location_coordinates: suggestion.startLocation,
        location_details: `Walk Distance: ${(suggestion.distance / 1000).toFixed(1)}km, Duration: ~${suggestion.estimatedDuration} minutes`,
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        max_participants: suggestion.suggestedGroupSize,
        fitness_levels: [suggestion.fitnessLevel],
        equipment_needed: [],
        cost_cents: 0,
        visibility: 'public',
      };

      const event = await eventService.createEvent(eventData, userId);
      
      // Update suggestion status
      const updatedSuggestions = get().walkSuggestions.map(s => 
        s.id === suggestion.id 
          ? { ...s, status: 'saved' as const }
          : s
      );
      
      set({ 
        walkSuggestions: updatedSuggestions,
        isCreating: false 
      });
      
      return event.id;
    } catch (error: any) {
      console.error('Error creating event from suggestion:', error);
      set({ error: error.message, isCreating: false });
      throw error;
    }
  },

  dismissSuggestion: (suggestionId: string) => {
    const updatedSuggestions = get().walkSuggestions.map(s => 
      s.id === suggestionId 
        ? { ...s, status: 'dismissed' as const }
        : s
    );
    
    set({ walkSuggestions: updatedSuggestions });
  },

  rateSuggestion: async (suggestionId: string, rating: number, feedback?: string) => {
    try {
      const updatedSuggestions = get().walkSuggestions.map(s => 
        s.id === suggestionId 
          ? { ...s, userRating: rating, status: 'completed' as const }
          : s
      );
      
      set({ walkSuggestions: updatedSuggestions });

      // Submit feedback to service
      await walkSuggestionService.submitFeedback({
        suggestionId,
        userId: get().userWalkingProfile?.userId || '',
        completed: true,
        rating,
        feedback,
        wouldRecommend: rating >= 4,
        submittedAt: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('Error rating suggestion:', error);
      set({ suggestionError: error.message });
    }
  },

  clearSuggestions: () => {
    set({ 
      walkSuggestions: [], 
      currentSuggestion: null,
      suggestionError: null 
    });
  },

  // Form Management Actions
  updateFormData: (updates: Partial<EventFormData>) => {
    set(state => ({
      formData: { ...state.formData, ...updates }
    }));
  },

  resetFormData: () => {
    set({ formData: initialFormData });
  },

  validateForm: () => {
    const { formData } = get();
    
    return !!(
      formData.title.trim() &&
      formData.category_id &&
      formData.location_name.trim() &&
      formData.location_coordinates &&
      formData.start_time
    );
  },

  // Location Actions
  getCurrentLocation: async () => {
    set({ isLoadingLocation: true, error: null });
    
    try {
      const result = await locationService.getCurrentLocationWithAddress();
      
      set({ 
        userLocation: result.coordinates,
        isLoadingLocation: false 
      });
      
      // Update form data if location fields are empty
      const { formData } = get();
      if (!formData.location_name && result.address) {
        get().updateFormData({
          location_name: result.address,
          location_address: result.address,
          location_coordinates: result.coordinates,
        });
      }
    } catch (error: any) {
      console.error('Error getting current location:', error);
      set({ error: error.message, isLoadingLocation: false });
    }
  },

  searchLocations: async (query: string) => {
    if (!query.trim()) {
      set({ locationResults: [] });
      return;
    }
    
    set({ isLoadingLocation: true });
    
    try {
      const results = await locationService.searchLocations(query);
      set({ locationResults: results, isLoadingLocation: false });
    } catch (error: any) {
      console.error('Error searching locations:', error);
      set({ isLoadingLocation: false });
    }
  },

  setUserLocation: (location: LocationCoordinates | null) => {
    set({ userLocation: location });
    
    // If we have a location and are on the nearby tab, reload events
    if (location && get().activeTab === 'nearby') {
      get().loadEvents();
    }
  },

  // UI State Actions
  setActiveTab: (tab: 'all' | 'going' | 'created' | 'nearby' | 'suggestions') => {
    set({ activeTab: tab });
    
    // Load appropriate data based on tab
    // This would be called from the component with userId
  },

  setFilters: (filters: Partial<EventFilters>) => {
    set(state => ({
      filters: { ...state.filters, ...filters }
    }));
    
    // Reload events with new filters
    get().loadEvents();
  },

  setSuggestionError: (error: string | null) => {
    set({ suggestionError: error });
  },

  clearError: () => {
    set({ error: null, suggestionError: null });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));