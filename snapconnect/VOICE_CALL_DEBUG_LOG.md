# Coach Alex Voice Call System - Debug Log

## 🔍 Current Status Analysis

### System Architecture Overview
```
React Native App (Client)
    ↓ WebSocket Connection
Python Voice Service (Server) - Pipecat Pipeline
    ↓ API Calls
External Services (Deepgram STT, OpenAI LLM, ElevenLabs TTS)
```

### Key Components Analyzed

#### ✅ **Working Components**
1. **Python Voice Service (main.py)**
   - ✅ Pipecat pipeline initialized successfully
   - ✅ WebSocket server running on `0.0.0.0:8002`
   - ✅ All AI services (Deepgram, OpenAI, ElevenLabs) connected
   - ✅ API keys loaded correctly

2. **Voice Services Architecture**
   - ✅ `speechService.ts` - Local speech-to-text and text-to-speech
   - ✅ `voiceCoachService.ts` - AI conversation logic
   - ✅ `pychatVoiceService.ts` - WebSocket client for Pipecat

#### ❌ **Identified Issues**

### Issue #1: Network Connectivity
**Problem**: WebSocket connection from React Native to Python server fails immediately

**Root Cause**: 
- React Native cannot connect to `localhost:8002` 
- Need to use host machine IP address (`192.168.1.66`)

**Evidence**:
```
Python Server Logs: ✅ "Starting websocket server on 0.0.0.0:8002"
Client Logs: ❌ "Connection failed immediately"
```

**Current Fix Applied**:
- Updated `pychatVoiceService.ts` to use IP `192.168.1.66:8002` for React Native
- Added detailed connection debugging

### Issue #2: Missing Database Schema
**Problem**: Code references non-existent Supabase functions

**Missing Components**:
- `voice_coaching_sessions` table
- `voice_commands` table  
- `create_voice_coaching_session()` function
- `update_voice_session_status()` function
- `record_voice_command()` function

**Impact**: Database operations fail silently

### Issue #3: Service Architecture Disconnect
**Problem**: Multiple voice services that don't work together

**Current Services**:
1. `pychatVoiceService` - WebSocket to Python (real-time pipeline)
2. `voiceCoachService` - Direct OpenAI calls (fallback)
3. `speechService` - Local audio handling

**Solution Created**: `unifiedVoiceService.ts` - Single interface with fallback logic

### Issue #4: Call State Management
**Problem**: Multiple UI components with different state management

**Components**:
- `VoiceCallInterface.tsx` - Phone call UI
- `VoiceCoachingPanel.tsx` - Panel UI  
- `CoachCallButton.tsx` - Trigger button
- `coach-chat.tsx` - Chat with voice

## 🛠️ Debugging Steps

### Step 1: Test Network Connectivity

#### Test Python Server Accessibility
```bash
# From your machine
curl -I http://192.168.1.66:8002
# Expected: Connection successful or WebSocket upgrade

# Test WebSocket connection (install wscat if needed)
npm install -g wscat
wscat -c ws://192.168.1.66:8002
# Expected: Connection established
```

#### Debug React Native WebSocket
Add this test function to your app:
```typescript
// Add to any component for testing
const testWebSocketConnection = async () => {
  const testUrls = [
    'ws://localhost:8002',
    'ws://192.168.1.66:8002',
    'ws://127.0.0.1:8002',
    'ws://10.0.2.2:8002'  // Android emulator
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`Testing ${url}...`);
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log(`✅ ${url} - Connection successful`);
        ws.close();
      };
      
      ws.onerror = (error) => {
        console.log(`❌ ${url} - Connection failed:`, error);
      };
      
      // Wait 3 seconds then try next
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log(`❌ ${url} - Exception:`, error);
    }
  }
};
```

### Step 2: Database Schema Setup

#### Create Missing Tables and Functions
```sql
-- Run this in Supabase SQL Editor
-- Voice coaching sessions table
CREATE TABLE IF NOT EXISTS voice_coaching_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('connecting', 'active', 'paused', 'completed', 'error')),
  workout_context jsonb DEFAULT '{}',
  total_duration integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  session_metrics jsonb DEFAULT '{}'
);

-- Voice commands table  
CREATE TABLE IF NOT EXISTS voice_commands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES voice_coaching_sessions(id) ON DELETE CASCADE,
  command_type text NOT NULL,
  command_intent text,
  command_parameters jsonb DEFAULT '{}',
  confidence_score float,
  created_at timestamptz DEFAULT now()
);

-- Create RPC functions
CREATE OR REPLACE FUNCTION create_voice_coaching_session(
  target_user_id uuid,
  session_token text,
  workout_context jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id uuid;
BEGIN
  INSERT INTO voice_coaching_sessions (user_id, session_token, workout_context)
  VALUES (target_user_id, session_token, workout_context)
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_voice_session_status(
  session_token text,
  new_status text,
  duration_update integer DEFAULT NULL,
  metrics_update jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE voice_coaching_sessions 
  SET 
    status = new_status,
    total_duration = COALESCE(duration_update, total_duration),
    session_metrics = COALESCE(metrics_update, session_metrics),
    ended_at = CASE WHEN new_status = 'completed' THEN now() ELSE ended_at END
  WHERE session_token = update_voice_session_status.session_token;
END;
$$;

CREATE OR REPLACE FUNCTION record_voice_command(
  session_token text,
  command_type text,
  command_intent text,
  command_parameters jsonb DEFAULT '{}',
  confidence_score float DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
DECLARE
  session_id uuid;
BEGIN
  SELECT id INTO session_id 
  FROM voice_coaching_sessions 
  WHERE voice_coaching_sessions.session_token = record_voice_command.session_token;
  
  IF session_id IS NOT NULL THEN
    INSERT INTO voice_commands (
      session_id, command_type, command_intent, 
      command_parameters, confidence_score
    )
    VALUES (
      session_id, command_type, command_intent,
      command_parameters, confidence_score
    );
  END IF;
END;
$$;
```

### Step 3: Unified Service Testing

#### Test Voice Services Individually
```typescript
// Test each service independently
import { speechService } from './src/services/speechService';
import { voiceCoachService } from './src/services/voiceCoachService';
import { pychatVoiceService } from './src/services/pychatVoiceService';

// Test 1: Speech Service
const testSpeechService = async () => {
  console.log('Testing speechService...');
  
  // Test TTS
  const ttsResult = await speechService.speak("Hello, this is a test");
  console.log('TTS Result:', ttsResult);
  
  // Test STT (mock)
  const sttResult = await speechService.startSpeechToText();
  console.log('STT Start:', sttResult);
  
  setTimeout(async () => {
    const transcript = await speechService.stopSpeechToText();
    console.log('STT Result:', transcript);
  }, 3000);
};

// Test 2: Voice Coach Service  
const testVoiceCoachService = async () => {
  console.log('Testing voiceCoachService...');
  
  const greeting = await voiceCoachService.generateVoiceGreeting();
  console.log('Greeting:', greeting);
  
  const response = await voiceCoachService.processVoiceMessage("How are you today?", false);
  console.log('Response:', response);
};

// Test 3: Pypecat Service
const testPychatService = async () => {
  console.log('Testing pychatVoiceService...');
  
  try {
    const session = await pychatVoiceService.startVoiceSession();
    console.log('Pypecat Session:', session);
    
    if (pychatVoiceService.isConnected()) {
      await pychatVoiceService.sendTextMessage("Hello Coach Alex!");
    }
    
    setTimeout(() => {
      pychatVoiceService.endSession();
    }, 5000);
  } catch (error) {
    console.log('Pypecat Error:', error);
  }
};
```

### Step 4: Component Integration Testing

#### Test Call Flow
```typescript
// Add this to VoiceCallInterface.tsx for debugging
const debugCallFlow = async () => {
  console.log('🔍 DEBUG: Starting call flow test...');
  
  try {
    // Test 1: Unified Service
    console.log('1️⃣ Testing unified voice service...');
    const session = await unifiedVoiceService.startCall(workoutContext);
    console.log('Session created:', session);
    
    // Test 2: State Changes
    unifiedVoiceService.onStateChange('debug', (state) => {
      console.log('🔄 State changed to:', state);
    });
    
    // Test 3: Message Flow
    unifiedVoiceService.onMessage('debug', (message) => {
      console.log('📨 Message received:', message);
    });
    
    // Test 4: Recording (after 3 seconds)
    setTimeout(async () => {
      console.log('2️⃣ Testing recording...');
      await unifiedVoiceService.startRecording();
      
      setTimeout(async () => {
        await unifiedVoiceService.stopRecording();
      }, 3000);
    }, 3000);
    
    // Test 5: End call (after 10 seconds)
    setTimeout(async () => {
      console.log('3️⃣ Ending test call...');
      await unifiedVoiceService.endCall();
    }, 10000);
    
  } catch (error) {
    console.error('🚨 Debug test failed:', error);
  }
};
```

## 📊 Testing Checklist

### Phase 1: Infrastructure
- [ ] Python voice service starts without errors
- [ ] WebSocket server accessible from React Native
- [ ] All API keys working (Deepgram, OpenAI, ElevenLabs)
- [ ] Database schema created in Supabase

### Phase 2: Individual Services
- [ ] speechService TTS works
- [ ] speechService STT works (mock mode)
- [ ] voiceCoachService generates responses
- [ ] pychatVoiceService connects to Python server

### Phase 3: Integration
- [ ] unifiedVoiceService starts call successfully
- [ ] State changes propagate correctly
- [ ] Recording → transcript → AI response flow works
- [ ] Call end cleanup works

### Phase 4: UI Components
- [ ] CoachCallButton opens VoiceCallInterface
- [ ] VoiceCallInterface shows correct states
- [ ] Voice recording visual feedback works
- [ ] Call end returns to previous screen

## 🔧 Common Issues & Solutions

### Issue: "Connection Refused"
**Symptoms**: WebSocket fails immediately
**Solutions**:
1. Check Python server is running: `python main.py`
2. Verify IP address in code matches your machine
3. Check firewall settings
4. Test with `wscat -c ws://IP:8002`

### Issue: "API Key Invalid"
**Symptoms**: Service starts but API calls fail
**Solutions**:
1. Check `.env` file exists in voice-service directory
2. Verify API keys are not wrapped in quotes
3. Check API key permissions/billing

### Issue: "Database Function Not Found"
**Symptoms**: Supabase RPC errors
**Solutions**:
1. Run the SQL schema creation script
2. Check function permissions
3. Verify table creation

### Issue: "Audio Permissions Denied"
**Symptoms**: Recording fails to start
**Solutions**:
1. Check iOS simulator/device permissions
2. Test with physical device (simulators have audio limitations)
3. Verify Audio.requestPermissionsAsync() succeeds

## 🎯 Next Steps

1. **Fix Network Connection**: Test and confirm WebSocket connectivity
2. **Setup Database**: Run SQL schema creation
3. **Test Individual Services**: Verify each service works independently
4. **Integration Testing**: Test unified service with fallback logic
5. **UI Polish**: Ensure smooth state transitions and error handling

## 📝 Debug Logs Location

- **Python Server**: Console output from `python main.py`
- **React Native**: Metro bundler console and device logs
- **WebSocket**: Network tab in React Native debugger
- **Database**: Supabase dashboard logs

## 🚀 Success Criteria

- [ ] Call starts without errors
- [ ] Voice recording works (even with mock transcription)
- [ ] AI responds appropriately
- [ ] Call ends cleanly
- [ ] Fallback works when Pipecat unavailable
- [ ] UI reflects all state changes correctly

---

**Current Priority**: Fix WebSocket connection between React Native and Python server