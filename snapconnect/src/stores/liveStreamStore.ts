import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Database } from '../services/supabase';

// Type definitions from database
export type LiveStream = Database['public']['Tables']['live_streams']['Row'];
export type StreamParticipant = Database['public']['Tables']['stream_participants']['Row'];
export type LiveStreamInsert = Database['public']['Tables']['live_streams']['Insert'];
export type StreamParticipantInsert = Database['public']['Tables']['stream_participants']['Insert'];

// Extended types for UI
export interface LiveStreamWithHost extends LiveStream {
  host: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    fitness_level: string;
  };
}

export interface StreamParticipantWithUser extends StreamParticipant {
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateStreamParams {
  title: string;
  description?: string;
  quality?: 'low' | 'medium' | 'high';
  isPrivate?: boolean;
  eventId?: string | null;
}

export interface JoinStreamParams {
  streamId: string;
  role?: 'viewer' | 'co_host';
}

export interface LiveStreamState {
  // Stream data (following messagesStore pattern)
  liveStreams: LiveStreamWithHost[];
  currentStream: LiveStreamWithHost | null;
  streamParticipants: StreamParticipantWithUser[];
  
  // My participation state
  myParticipation: StreamParticipant | null;
  myRole: 'host' | 'co_host' | 'viewer' | null;
  
  // UI state (same pattern as messagesStore)
  isLoading: boolean;
  isRefreshing: boolean;
  isStreaming: boolean;
  isJoiningStream: boolean;
  isCreatingStream: boolean;
  
  // Error handling
  error: string | null;
  hasError: boolean;
  
  // Real-time subscriptions (identical to messagesStore pattern)
  streamSubscription: RealtimeChannel | null;
  participantSubscription: RealtimeChannel | null;
  
  // Agora-specific state
  agoraEngine: any | null; // RtcEngine from react-native-agora
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  localVideoEnabled: boolean;
  localAudioEnabled: boolean;
  
  // Cache management
  lastFetchTime: number;
  streamCache: Map<string, LiveStreamWithHost>; // streamId -> stream
  activeStreamsCount: number;
  
  // Current streaming session
  currentChannelName: string | null;
  currentAgoraUID: number | null;
  currentAgoraToken: string | null;
  tokenExpiresAt: number | null;
}

export interface LiveStreamActions {
  // Core streaming operations (following messagesStore naming)
  createStream: (params: CreateStreamParams) => Promise<LiveStreamWithHost>;
  joinStream: (params: JoinStreamParams) => Promise<void>;
  leaveStream: () => Promise<void>;
  endStream: (streamId: string) => Promise<void>;
  
  // Stream management
  updateStreamTitle: (streamId: string, title: string) => Promise<void>;
  updateStreamDescription: (streamId: string, description: string) => Promise<void>;
  toggleStreamPrivacy: (streamId: string) => Promise<void>;
  
  // Participant management
  promoteToCoHost: (streamId: string, userId: string) => Promise<void>;
  removeParticipant: (streamId: string, userId: string) => Promise<void>;
  transferHostRole: (streamId: string, newHostId: string) => Promise<void>;
  
  // Data fetching
  fetchActiveStreams: () => Promise<void>;
  fetchStreamDetails: (streamId: string) => Promise<void>;
  fetchStreamParticipants: (streamId: string) => Promise<void>;
  refreshActiveStreams: () => Promise<void>;
  
  // Real-time operations (identical to messagesStore pattern)
  setupRealTimeSubscriptions: (userId: string) => void;
  teardownRealTimeSubscriptions: () => void;
  
  // Agora operations
  initializeAgoraEngine: () => Promise<void>;
  destroyAgoraEngine: () => Promise<void>;
  toggleLocalVideo: () => Promise<void>;
  toggleLocalAudio: () => Promise<void>;
  switchCamera: () => Promise<void>;
  
  
  // State management (same as messagesStore)
  setCurrentStream: (stream: LiveStreamWithHost | null) => void;
  setError: (error: string) => void;
  clearError: () => void;
  resetStore: () => void;
  
  // Cache management
  clearStreamCache: () => void;
  updateStreamCache: (streamId: string, stream: LiveStreamWithHost) => void;
  
  // Optimistic updates
  optimisticallyUpdateViewerCount: (streamId: string, delta: number) => void;
  optimisticallyAddParticipant: (participant: StreamParticipantWithUser) => void;
  optimisticallyRemoveParticipant: (participantId: string) => void;
}

type LiveStreamStore = LiveStreamState & LiveStreamActions;

const initialState: LiveStreamState = {
  // Stream data
  liveStreams: [],
  currentStream: null,
  streamParticipants: [],
  
  // My participation
  myParticipation: null,
  myRole: null,
  
  // UI state
  isLoading: false,
  isRefreshing: false,
  isStreaming: false,
  isJoiningStream: false,
  isCreatingStream: false,
  
  // Error handling
  error: null,
  hasError: false,
  
  // Real-time subscriptions
  streamSubscription: null,
  participantSubscription: null,
  
  // Agora state
  agoraEngine: null,
  connectionState: 'disconnected',
  localVideoEnabled: true,
  localAudioEnabled: true,
  
  // Cache management
  lastFetchTime: 0,
  streamCache: new Map(),
  activeStreamsCount: 0,
  
  // Current session
  currentChannelName: null,
  currentAgoraUID: null,
  currentAgoraToken: null,
  tokenExpiresAt: null,
};

export const useLiveStreamStore = create<LiveStreamStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Core streaming operations
        createStream: async (params: CreateStreamParams) => {
          set({ isCreatingStream: true, error: null });
          
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Generate unique channel name
            const channelName = `stream_${Date.now()}_${user.id.substring(0, 8)}`;
            
            // Create stream record
            const streamData: LiveStreamInsert = {
              host_id: user.id,
              title: params.title,
              description: params.description || null,
              channel_id: channelName,
              agora_channel_name: channelName,
              agora_app_id: process.env.EXPO_PUBLIC_AGORA_APP_ID!,
              quality: params.quality || 'medium',
              is_private: params.isPrivate || false,
              event_id: params.eventId || null,
            };
            
            const { data: stream, error } = await supabase
              .from('live_streams')
              .insert(streamData)
              .select(`
                *,
                host:users(id, username, full_name, avatar_url, fitness_level)
              `)
              .single();
              
            if (error) throw error;
            
            const streamWithHost = stream as LiveStreamWithHost;
            
            // Update local state
            set(state => ({
              liveStreams: [streamWithHost, ...state.liveStreams],
              currentStream: streamWithHost,
              isCreatingStream: false,
            }));
            
            // Update cache
            get().updateStreamCache(streamWithHost.id, streamWithHost);
            
            console.log('✅ Stream created successfully:', streamWithHost.id);
            return streamWithHost;
            
          } catch (error) {
            console.error('❌ Failed to create stream:', error);
            set({ 
              error: `Failed to create stream: ${error.message}`,
              hasError: true,
              isCreatingStream: false 
            });
            throw error;
          }
        },
        
        joinStream: async (params: JoinStreamParams) => {
          set({ isJoiningStream: true, error: null });
          
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Get stream details
            const { data: stream, error: streamError } = await supabase
              .from('live_streams')
              .select('*')
              .eq('id', params.streamId)
              .single();
              
            if (streamError) throw streamError;
            if (!stream.is_active) throw new Error('Stream is not active');
            
            // Generate Agora UID
            const agoraUID = get().generateAgoraUID(user.id);
            
            // Create participant record
            const participantData: StreamParticipantInsert = {
              stream_id: params.streamId,
              user_id: user.id,
              role: params.role || 'viewer',
              agora_uid: agoraUID,
            };
            
            const { data: participant, error: participantError } = await supabase
              .from('stream_participants')
              .insert(participantData)
              .select()
              .single();
              
            if (participantError) throw participantError;
            
            // Update local state
            set({
              myParticipation: participant,
              myRole: participant.role as 'host' | 'co_host' | 'viewer',
              currentChannelName: stream.agora_channel_name,
              currentAgoraUID: agoraUID,
              isJoiningStream: false,
            });
            
            console.log('✅ Joined stream successfully:', params.streamId);
            
          } catch (error) {
            console.error('❌ Failed to join stream:', error);
            set({ 
              error: `Failed to join stream: ${error.message}`,
              hasError: true,
              isJoiningStream: false 
            });
            throw error;
          }
        },
        
        leaveStream: async () => {
          try {
            const { myParticipation } = get();
            if (!myParticipation) return;
            
            // Update participant record
            const { error } = await supabase
              .from('stream_participants')
              .update({ 
                is_active: false, 
                left_at: new Date().toISOString(),
                connection_state: 'disconnected'
              })
              .eq('id', myParticipation.id);
              
            if (error) throw error;
            
            // Cleanup Agora engine
            await get().destroyAgoraEngine();
            
            // Reset local state
            set({
              myParticipation: null,
              myRole: null,
              currentStream: null,
              currentChannelName: null,
              currentAgoraUID: null,
              currentAgoraToken: null,
              connectionState: 'disconnected',
              isStreaming: false,
            });
            
            console.log('✅ Left stream successfully');
            
          } catch (error) {
            console.error('❌ Failed to leave stream:', error);
            set({ 
              error: `Failed to leave stream: ${error.message}`,
              hasError: true 
            });
          }
        },
        
        // Data fetching (following messagesStore pattern)
        fetchActiveStreams: async () => {
          set({ isLoading: true, error: null });
          
          try {
            const { data: streams, error } = await supabase
              .from('live_streams')
              .select(`
                *,
                host:users(id, username, full_name, avatar_url, fitness_level)
              `)
              .eq('is_active', true)
              .eq('is_private', false)
              .order('created_at', { ascending: false });
              
            if (error) throw error;
            
            const streamsWithHost = streams as LiveStreamWithHost[];
            
            set({ 
              liveStreams: streamsWithHost,
              activeStreamsCount: streamsWithHost.length,
              isLoading: false,
              lastFetchTime: Date.now()
            });
            
            // Update cache
            streamsWithHost.forEach(stream => {
              get().updateStreamCache(stream.id, stream);
            });
            
          } catch (error) {
            console.error('❌ Failed to fetch streams:', error);
            set({ 
              error: `Failed to fetch streams: ${error.message}`,
              hasError: true,
              isLoading: false 
            });
          }
        },
        
        // Real-time subscriptions (adapted from messagesStore:290-346)
        setupRealTimeSubscriptions: (userId: string) => {
          console.log('🔔 Setting up live stream subscriptions for user:', userId);
          
          // Cleanup existing subscriptions
          get().teardownRealTimeSubscriptions();
          
          // Subscribe to stream updates
          const streamSubscription = supabase
            .channel('live_streams_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'live_streams' },
              (payload) => {
                console.log('📺 Stream update received:', payload);
                get().handleStreamUpdate(payload);
              }
            )
            .subscribe();
            
          // Subscribe to participant updates
          const participantSubscription = supabase
            .channel('stream_participants_changes')
            .on('postgres_changes',
              { event: '*', schema: 'public', table: 'stream_participants' },
              (payload) => {
                console.log('👥 Participant update received:', payload);
                get().handleParticipantUpdate(payload);
              }
            )
            .subscribe();
            
          set({ streamSubscription, participantSubscription });
        },
        
        // Teardown subscriptions (identical to messagesStore pattern)
        teardownRealTimeSubscriptions: () => {
          const { streamSubscription, participantSubscription } = get();
          
          if (streamSubscription) {
            streamSubscription.unsubscribe();
          }
          
          if (participantSubscription) {
            participantSubscription.unsubscribe();
          }
          
          set({
            streamSubscription: null,
            participantSubscription: null,
          });
        },
        
        // Real-time update handlers
        handleStreamUpdate: (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          set(state => {
            const updatedStreams = [...state.liveStreams];
            
            switch (eventType) {
              case 'INSERT':
                // New stream created
                if (newRecord.is_active && !newRecord.is_private) {
                  // Fetch full stream with host data
                  get().fetchStreamDetails(newRecord.id);
                }
                break;
                
              case 'UPDATE':
                // Stream updated
                const streamIndex = updatedStreams.findIndex(s => s.id === newRecord.id);
                if (streamIndex >= 0) {
                  if (newRecord.is_active && !newRecord.is_private) {
                    // Update existing stream
                    updatedStreams[streamIndex] = { ...updatedStreams[streamIndex], ...newRecord };
                  } else {
                    // Stream ended or made private, remove from list
                    updatedStreams.splice(streamIndex, 1);
                  }
                }
                break;
                
              case 'DELETE':
                // Stream deleted
                const deleteIndex = updatedStreams.findIndex(s => s.id === oldRecord.id);
                if (deleteIndex >= 0) {
                  updatedStreams.splice(deleteIndex, 1);
                }
                break;
            }
            
            return {
              liveStreams: updatedStreams,
              activeStreamsCount: updatedStreams.length,
            };
          });
        },
        
        handleParticipantUpdate: (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          set(state => {
            const updatedParticipants = [...state.streamParticipants];
            
            switch (eventType) {
              case 'INSERT':
                // New participant joined - fetch full participant data
                get().fetchStreamParticipants(newRecord.stream_id);
                break;
                
              case 'UPDATE':
                // Participant updated
                const participantIndex = updatedParticipants.findIndex(p => p.id === newRecord.id);
                if (participantIndex >= 0) {
                  updatedParticipants[participantIndex] = { 
                    ...updatedParticipants[participantIndex], 
                    ...newRecord 
                  };
                }
                break;
                
              case 'DELETE':
                // Participant left
                const deleteIndex = updatedParticipants.findIndex(p => p.id === oldRecord.id);
                if (deleteIndex >= 0) {
                  updatedParticipants.splice(deleteIndex, 1);
                }
                break;
            }
            
            return { streamParticipants: updatedParticipants };
          });
        },
        
        // Utility functions
        generateAgoraUID: (userId: string): number => {
          let hash = 0;
          for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          const uid = Math.abs(hash) || 1;
          return uid > 2147483647 ? uid % 2147483647 : uid;
        },
        
        // Agora engine management (safe implementations)
        initializeAgoraEngine: async () => {
          try {
            console.log('🎥 Initializing Agora engine...');
            // Only initialize if configured
            const { agoraAuthService } = await import('../services/agoraAuthService');
            if (!agoraAuthService.isConfigured()) {
              console.warn('⚠️ Agora not configured - skipping initialization');
              return;
            }
            // Actual initialization will happen when user tries to stream
          } catch (error) {
            console.error('❌ Failed to initialize Agora:', error);
          }
        },
        
        destroyAgoraEngine: async () => {
          console.log('🎥 Destroying Agora engine...');
          set({ agoraEngine: null, connectionState: 'disconnected' });
        },
        
        toggleLocalVideo: async () => {
          set(state => ({ localVideoEnabled: !state.localVideoEnabled }));
        },
        
        toggleLocalAudio: async () => {
          set(state => ({ localAudioEnabled: !state.localAudioEnabled }));
        },
        
        switchCamera: async () => {
          console.log('📱 Switching camera...');
        },
        
        // State management (same as messagesStore)
        setCurrentStream: (stream: LiveStreamWithHost | null) => {
          set({ currentStream: stream });
        },
        
        setError: (error: string) => {
          set({ error, hasError: true });
        },
        
        clearError: () => {
          set({ error: null, hasError: false });
        },
        
        resetStore: () => {
          get().teardownRealTimeSubscriptions();
          set(initialState);
        },
        
        // Cache management
        clearStreamCache: () => {
          set({ streamCache: new Map() });
        },
        
        updateStreamCache: (streamId: string, stream: LiveStreamWithHost) => {
          set(state => {
            const newCache = new Map(state.streamCache);
            newCache.set(streamId, stream);
            return { streamCache: newCache };
          });
        },
        
        // Placeholder implementations for remaining methods
        endStream: async (streamId: string) => { /* TODO */ },
        updateStreamTitle: async (streamId: string, title: string) => { /* TODO */ },
        updateStreamDescription: async (streamId: string, description: string) => { /* TODO */ },
        toggleStreamPrivacy: async (streamId: string) => { /* TODO */ },
        promoteToCoHost: async (streamId: string, userId: string) => { /* TODO */ },
        removeParticipant: async (streamId: string, userId: string) => { /* TODO */ },
        transferHostRole: async (streamId: string, newHostId: string) => { /* TODO */ },
        fetchStreamDetails: async (streamId: string) => { /* TODO */ },
        fetchStreamParticipants: async (streamId: string) => { /* TODO */ },
        refreshActiveStreams: async () => { /* TODO */ },
        optimisticallyUpdateViewerCount: (streamId: string, delta: number) => { /* TODO */ },
        optimisticallyAddParticipant: (participant: StreamParticipantWithUser) => { /* TODO */ },
        optimisticallyRemoveParticipant: (participantId: string) => { /* TODO */ },
      }),
      {
        // Persistence pattern (following messagesStore)
        name: 'live-stream-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          // Only persist essential data
          liveStreams: state.liveStreams,
          lastFetchTime: state.lastFetchTime,
          connectionState: state.connectionState,
          localVideoEnabled: state.localVideoEnabled,
          localAudioEnabled: state.localAudioEnabled,
        }),
      }
    ),
    {
      name: 'live-stream-store',
    }
  )
);