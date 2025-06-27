import { supabase } from './supabase';
import { LocationCoordinates, locationService } from './locationService';

export interface EventCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category?: EventCategory;
  
  // Location
  location_name: string | null;
  location_address: string | null;
  location_coordinates: any; // PostGIS Point
  location_details: string | null;
  
  // Timing
  start_time: string;
  end_time: string | null;
  timezone: string;
  
  // Capacity
  max_participants: number | null;
  min_participants: number;
  current_participants: number;
  waitlist_enabled: boolean;
  
  // Requirements
  fitness_levels: string[];
  equipment_needed: string[];
  cost_cents: number;
  cost_currency: string;
  
  // Management
  creator_id: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  visibility: 'public' | 'friends' | 'private';
  
  // Media
  cover_image: string | null;
  images: string[];
  
  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: 'going' | 'maybe' | 'not_going' | 'waitlist';
  previous_status: string | null;
  checked_in: boolean;
  check_in_time: string | null;
  no_show: boolean;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  category_id: string;
  location_name: string;
  location_address?: string;
  location_coordinates: LocationCoordinates;
  location_details?: string;
  start_time: string;
  end_time?: string;
  timezone?: string;
  max_participants?: number;
  min_participants?: number;
  fitness_levels?: string[];
  equipment_needed?: string[];
  cost_cents?: number;
  cost_currency?: string;
  visibility?: 'public' | 'friends' | 'private';
  cover_image?: string;
}

export interface EventFilters {
  category_id?: string;
  fitness_levels?: string[];
  location_radius_km?: number;
  user_location?: LocationCoordinates;
  start_date?: string;
  end_date?: string;
  max_cost_cents?: number;
  status?: string[];
}

class EventService {
  async getEventCategories(): Promise<EventCategory[]> {
    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching event categories:', error);
      throw new Error('Failed to fetch event categories');
    }

    return data || [];
  }

  async createEvent(eventData: CreateEventData, creatorId: string): Promise<Event> {
    const insertData = {
      title: eventData.title,
      description: eventData.description || null,
      category_id: eventData.category_id,
      location_name: eventData.location_name,
      location_address: eventData.location_address || null,
      location_details: eventData.location_details || null,
      start_time: eventData.start_time,
      end_time: eventData.end_time || null,
      timezone: eventData.timezone || 'UTC',
      max_participants: eventData.max_participants || null,
      min_participants: eventData.min_participants || 1,
      fitness_levels: eventData.fitness_levels || [],
      equipment_needed: eventData.equipment_needed || [],
      cost_cents: eventData.cost_cents || 0,
      cost_currency: eventData.cost_currency || 'USD',
      creator_id: creatorId,
      status: 'published' as const,
      visibility: eventData.visibility || 'public' as const,
      cover_image: eventData.cover_image || null,
      // Now store coordinates as JSON string
      location_coordinates: JSON.stringify({
        latitude: eventData.location_coordinates.latitude,
        longitude: eventData.location_coordinates.longitude,
      }),
    };

    const { data, error } = await supabase
      .from('events')
      .insert(insertData)
      .select(`
        *,
        category:event_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create event');
    }

    return data;
  }

  async updateEvent(eventId: string, updates: Partial<CreateEventData>, userId: string): Promise<Event> {
    // First check if user is the creator
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('creator_id')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      console.error('Error fetching event for update:', fetchError);
      throw new Error('Event not found');
    }

    if (existingEvent.creator_id !== userId) {
      throw new Error('You can only edit events you created');
    }

    const updateData: any = { ...updates };
    
    if (updates.location_coordinates) {
      updateData.location_coordinates = JSON.stringify({
        latitude: updates.location_coordinates.latitude,
        longitude: updates.location_coordinates.longitude,
      });
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select(`
        *,
        category:event_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event');
    }

    return data;
  }

  async deleteEvent(eventId: string, userId: string): Promise<void> {
    // Check if user is the creator
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('creator_id')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      console.error('Error fetching event for deletion:', fetchError);
      throw new Error('Event not found');
    }

    if (existingEvent.creator_id !== userId) {
      throw new Error('You can only delete events you created');
    }

    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event');
    }
  }

  async getPublicEvents(filters?: EventFilters): Promise<Event[]> {
    let query = supabase
      .from('events')
      .select(`
        *,
        category:event_categories(*)
      `)
      .eq('status', 'published')
      .is('deleted_at', null)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters?.start_date) {
      query = query.gte('start_time', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('start_time', filters.end_date);
    }

    if (filters?.max_cost_cents !== undefined) {
      query = query.lte('cost_cents', filters.max_cost_cents);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching public events:', error);
      throw new Error('Failed to fetch events');
    }

    return data || [];
  }

  async getUserCreatedEvents(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        category:event_categories(*)
      `)
      .eq('creator_id', userId)
      .is('deleted_at', null)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching user created events:', error);
      throw new Error('Failed to fetch user events');
    }

    return data || [];
  }

  async getUserRSVPEvents(userId: string, status?: 'going' | 'maybe'): Promise<Event[]> {
    let query = supabase
      .from('event_participants')
      .select(`
        event:events(
          *,
          category:event_categories(*)
        )
      `)
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['going', 'maybe']);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user RSVP events:', error);
      throw new Error('Failed to fetch RSVP events');
    }

    return (data || []).map((item: any) => item.event).filter(Boolean);
  }

  async rsvpToEvent(eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going'): Promise<EventParticipant> {
    const { data, error } = await supabase
      .from('event_participants')
      .upsert({
        event_id: eventId,
        user_id: userId,
        status: status,
      }, {
        onConflict: 'event_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating RSVP:', error);
      throw new Error('Failed to update RSVP');
    }

    return data;
  }

  async getUserEventRSVP(eventId: string, userId: string): Promise<EventParticipant | null> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No RSVP found
        return null;
      }
      console.error('Error fetching user RSVP:', error);
      throw new Error('Failed to fetch RSVP status');
    }

    return data;
  }

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching event participants:', error);
      throw new Error('Failed to fetch event participants');
    }

    return data || [];
  }

  async getEventById(eventId: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        category:event_categories(*)
      `)
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching event:', error);
      throw new Error('Failed to fetch event');
    }

    return data;
  }

  async getNearbyEvents(userLocation: LocationCoordinates, radiusKm: number = 25): Promise<Event[]> {
    // Use the database function for efficient distance calculation
    try {
      const { data, error } = await supabase.rpc('find_events_within_radius', {
        user_lat: userLocation.latitude,
        user_lon: userLocation.longitude,
        radius_km: radiusKm,
      });

      if (error) {
        console.error('Error finding nearby events:', error);
        // Fallback to client-side filtering
        return this.getNearbyEventsClientSide(userLocation, radiusKm);
      }

      // Fetch full event details for the nearby events
      if (!data || data.length === 0) return [];

      const eventIds = data.map((item: any) => item.id);
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          category:event_categories(*)
        `)
        .in('id', eventIds)
        .eq('status', 'published')
        .is('deleted_at', null);

      if (eventsError) {
        console.error('Error fetching nearby event details:', eventsError);
        return [];
      }

      return events || [];
    } catch (error) {
      console.error('Error in getNearbyEvents:', error);
      return this.getNearbyEventsClientSide(userLocation, radiusKm);
    }
  }

  private async getNearbyEventsClientSide(userLocation: LocationCoordinates, radiusKm: number = 25): Promise<Event[]> {
    // Fallback: fetch all events and filter client-side
    const events = await this.getPublicEvents();
    
    return events.filter(event => {
      if (!event.location_coordinates) return false;
      
      const eventCoords = this.parseEventLocation(event);
      if (!eventCoords) return false;
      
      const distance = locationService.calculateDistance(userLocation, eventCoords);
      return distance <= radiusKm;
    });
  }

  parseEventLocation(event: Event): LocationCoordinates | null {
    if (!event.location_coordinates) return null;
    
    try {
      // Try parsing as JSON first (new format)
      if (typeof event.location_coordinates === 'string' && event.location_coordinates.startsWith('{')) {
        const coords = JSON.parse(event.location_coordinates);
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      }
      
      // Fallback to PostGIS parsing for existing data
      return locationService.parseCoordinatesFromDatabase(event.location_coordinates);
    } catch (error) {
      console.error('Error parsing event location:', error);
      return null;
    }
  }

  formatEventCost(costCents: number, currency: string = 'USD'): string {
    if (costCents === 0) return 'Free';
    
    const amount = costCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  formatEventDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  formatEventTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
}

export const eventService = new EventService();