# Agora Main Documentation Analysis

## Document Source
- **URL**: https://appbuilder-docs.agora.io/
- **Focus**: Core Agora App Builder capabilities and integration patterns

## Overview

Agora App Builder provides multiple integration paths:
1. **Turnkey Solutions** - Ready-to-use applications
2. **Embed SDKs** - Integration into existing apps
3. **Server Side APIs** - Backend room management
4. **Customization APIs** - Deep UI/UX control

For SnapConnect, the **Embed SDKs + Customization APIs** combination is optimal.

## Integration Pathways Analysis

### 1. Embed SDKs (Recommended for SnapConnect)
```typescript
// Embed App Builder into existing React Native screens
import { AgoraAppBuilder } from '@appbuilder/react-native';

// Integration in SnapConnect screens
export const CliqueScreen = () => {
  return (
    <View style={snapConnectStyles.container}>
      {/* SnapConnect header */}
      <SnapConnectHeader title="Clique" />
      
      {/* Embedded Agora streaming */}
      <AgoraAppBuilder
        config={snapConnectStreamConfig}
        customize={snapConnectCustomizations}
      />
      
      {/* SnapConnect footer/controls */}
      <SnapConnectStreamControls />
    </View>
  );
};
```

**Benefits for SnapConnect:**
- Maintains existing navigation structure
- Preserves SnapConnect branding
- Integrates with existing Zustand state management

### 2. Server Side APIs
```typescript
// src/services/agoraRoomService.ts
export class AgoraRoomService {
  
  // Create streaming room via Agora REST API
  async createStreamingRoom(eventId: string, hostId: string) {
    const response = await fetch('https://api.agora.io/dev/v1/project/{appid}/rtc/room/create', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${agoraCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room: `snapconnect-${eventId}`,
        host: hostId,
        // SnapConnect-specific room configuration
      }),
    });
    
    return response.json();
  }
  
  // Integrate with SnapConnect events system
  async linkRoomToEvent(roomId: string, eventId: string) {
    // Update SnapConnect database
    await supabase
      .from('events')
      .update({ 
        stream_room_id: roomId,
        location_type: 'virtual'
      })
      .eq('id', eventId);
  }
}
```

**Integration with SnapConnect Events:**
- Server-side room creation when user schedules live stream event
- Automatic room management lifecycle
- Integration with existing event RSVP system

### 3. Customization APIs (Critical for SnapConnect)
```typescript
// src/config/agoraCustomization.ts
export const snapConnectCustomization = {
  components: {
    // Replace default video interface
    videoCall: {
      component: SnapConnectVideoInterface,
      props: {
        gradientTheme: 'primary', // SnapConnect gradient system
        showARFilters: true,      // Integrate existing AR filters
        fitnessContext: true,     // Fitness-specific UI elements
      }
    },
    
    // Custom participant list with SnapConnect user profiles
    participantList: {
      component: SnapConnectParticipantList,
      props: {
        showFitnessLevel: true,
        enableCoHostRequests: true,
      }
    },
    
    // SnapConnect-styled controls
    controls: {
      component: SnapConnectStreamControls,
      props: {
        showFilterToggle: true,    // AR filter controls
        showWorkoutTimer: true,    // Fitness-specific features
        enableShareToStories: true, // Integration with Stories tab
      }
    }
  },
  
  // SnapConnect theme integration
  theme: {
    primary: '#7C3AED',
    secondary: '#EC4899',
    background: '#000000',
    gradients: {
      primary: ['#7C3AED', '#EC4899'],
      secondary: ['#F472B6', '#FBBF24'],
    }
  },
  
  // SnapConnect-specific configuration
  config: {
    // Integrate with existing camera system
    videoSource: 'react-native-vision-camera',
    // Enable AR filter overlay
    enableCustomVideoProcessing: true,
    // Fitness-specific optimization
    videoProfile: 'fitness_streaming', // Custom profile for workout content
  }
};
```

## Key Implementation Steps

### Phase 1: Project Setup
```bash
# Install Agora App Builder
npm install @appbuilder/react-native

# Install required peer dependencies
npm install react-native-agora react-native-get-random-values
```

### Phase 2: SnapConnect Integration Architecture
```typescript
// src/services/agoraIntegrationService.ts
export class AgoraIntegrationService {
  
  // Initialize with SnapConnect user context
  async initialize() {
    const { user } = useAuthStore.getState();
    
    await AgoraAppBuilder.configure({
      appId: process.env.AGORA_APP_ID,
      // Integrate with SnapConnect authentication
      authProvider: new SnapConnectAuthProvider(user),
      // Use SnapConnect customizations
      customization: snapConnectCustomization,
    });
  }
  
  // Create stream linked to SnapConnect event
  async createEventStream(eventId: string) {
    const event = await eventService.getEvent(eventId);
    
    // Create Agora room
    const room = await this.createRoom({
      name: `snapconnect-event-${eventId}`,
      host: event.creator_id,
      maxParticipants: event.max_participants,
    });
    
    // Link to SnapConnect database
    await this.linkRoomToEvent(room.id, eventId);
    
    return room;
  }
  
  // Integrate with SnapConnect real-time system
  setupRealTimeSync() {
    // Sync Agora events with SnapConnect Supabase
    AgoraAppBuilder.on('participant-joined', (participant) => {
      // Update SnapConnect database
      this.updateStreamParticipants(participant);
    });
    
    AgoraAppBuilder.on('stream-ended', (streamData) => {
      // Update event status in SnapConnect
      this.updateEventStreamStatus(streamData.eventId, 'ended');
    });
  }
}
```

### Phase 3: UI Component Integration
```typescript
// src/components/streaming/SnapConnectVideoInterface.tsx
import { AgoraVideoView } from '@appbuilder/react-native';

export const SnapConnectVideoInterface = ({ participants, localUser }) => {
  return (
    <View style={styles.snapConnectVideoContainer}>
      {/* SnapConnect gradient background */}
      <LinearGradient colors={gradients.primary} style={styles.background}>
        
        {/* Main host video with SnapConnect styling */}
        <View style={styles.hostVideoContainer}>
          <AgoraVideoView uid={localUser.uid} style={styles.hostVideo} />
          
          {/* SnapConnect AR filter overlay */}
          <ARFilterOverlay 
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
          />
          
          {/* SnapConnect branding */}
          <View style={styles.hostLabel}>
            <Text style={styles.hostName}>{localUser.username}</Text>
            <FitnessLevelBadge level={localUser.fitnessLevel} />
          </View>
        </View>
        
        {/* Participant grid with SnapConnect styling */}
        <ScrollView horizontal style={styles.participantStrip}>
          {participants.map(participant => (
            <SnapConnectParticipantVideo 
              key={participant.uid}
              participant={participant}
            />
          ))}
        </ScrollView>
        
      </LinearGradient>
    </View>
  );
};
```

## Authentication Integration Strategy

### 1. Custom Auth Provider
```typescript
// src/services/SnapConnectAuthProvider.ts
export class SnapConnectAuthProvider {
  constructor(private user: SnapConnectUser) {}
  
  async getAgoraToken(channelId: string, role: 'host' | 'audience'): Promise<string> {
    // Call SnapConnect token service
    return await agoraTokenService.generateToken({
      userId: this.user.id,
      channelId,
      role,
    });
  }
  
  async validatePermissions(action: string): Promise<boolean> {
    // Check SnapConnect user permissions
    switch (action) {
      case 'create_stream':
        return this.user.canCreateStreams;
      case 'request_cohost':
        return this.user.canRequestCoHost;
      default:
        return true;
    }
  }
}
```

### 2. Supabase Integration
```typescript
// src/services/agoraSupabaseSync.ts
export class AgoraSupabaseSync {
  
  // Sync stream events to SnapConnect database
  async syncStreamEvent(eventType: string, data: any) {
    switch (eventType) {
      case 'stream_started':
        await supabase
          .from('live_streams')
          .update({ 
            is_active: true,
            started_at: new Date().toISOString()
          })
          .eq('agora_channel_name', data.channelId);
        break;
        
      case 'participant_joined':
        await supabase
          .from('stream_participants')
          .insert({
            stream_id: data.streamId,
            user_id: data.userId,
            agora_uid: data.agoraUid,
            role: data.role,
          });
        break;
    }
  }
}
```

## Performance Considerations

### 1. Bundle Size Optimization
```javascript
// metro.config.js - Optimize Agora imports
module.exports = {
  resolver: {
    alias: {
      // Use specific Agora modules only
      '@appbuilder/react-native': '@appbuilder/react-native/lite'
    }
  }
};
```

### 2. SnapConnect Feature Integration
```typescript
// Integrate with existing SnapConnect camera system
const integrateWithSnapConnectCamera = () => {
  // Use existing react-native-vision-camera as Agora video source
  AgoraAppBuilder.setVideoSource('external');
  
  // Forward SnapConnect camera frames to Agora
  cameraService.onFrame((frame) => {
    AgoraAppBuilder.sendVideoFrame(frame);
  });
};
```

## Decision Points

### 1. App Builder vs Raw SDK
**Use App Builder if:**
- UI customization meets SnapConnect requirements
- Development speed is priority
- Bundle size increase is acceptable

**Use Raw SDK if:**
- Need deeper camera integration
- Custom video processing required
- Tighter bundle size control needed

### 2. Integration Depth
**Shallow Integration:** Embed App Builder in dedicated screens
**Deep Integration:** Replace App Builder components entirely with SnapConnect components

## Next Steps

1. **Prototype Integration** (1 day)
   - Basic App Builder embed in test screen
   - Validate customization capabilities

2. **Authentication Testing** (1 day)
   - Integrate with Supabase auth
   - Test token generation flow

3. **UI Customization** (2-3 days)
   - Apply SnapConnect design system
   - Test AR filter integration

4. **Production Decision** (1 day)
   - Evaluate if App Builder meets all requirements
   - Decide on App Builder vs Raw SDK approach