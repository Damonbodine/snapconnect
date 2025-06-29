/**
 * Voice Integration Test Script
 * Tests the connection between React Native app and Python voice service
 */

const WebSocket = require('ws');

// Test configuration
const VOICE_SERVICE_URL = 'ws://localhost:8002';
const TEST_TIMEOUT = 30000; // 30 seconds

console.log('🎙️ Testing Voice Integration...');
console.log('🔗 Connecting to:', VOICE_SERVICE_URL);

// Test WebSocket connection
function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(VOICE_SERVICE_URL);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, TEST_TIMEOUT);

    ws.on('open', () => {
      console.log('✅ WebSocket connection successful');
      clearTimeout(timeout);
      
      // Send test message
      const testMessage = {
        type: 'text_input',
        data: {
          text: "Hello Coach Alex, this is a test message",
          timestamp: Date.now(),
          session_id: 'test_session_' + Date.now()
        }
      };
      
      ws.send(JSON.stringify(testMessage));
      console.log('📤 Test message sent');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received response:', message.type);
        if (message.data) {
          console.log('💬 Response data:', message.data);
        }
      } catch (e) {
        console.log('📥 Received binary data:', data.length, 'bytes');
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      clearTimeout(timeout);
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });

    // Close connection after 10 seconds
    setTimeout(() => {
      ws.close();
    }, 10000);
  });
}

// Run the test
async function runTest() {
  try {
    console.log('\n🧪 Starting voice integration test...\n');
    
    // Test 1: WebSocket Connection
    console.log('🔹 Test 1: WebSocket Connection');
    await testWebSocketConnection();
    console.log('✅ WebSocket test completed\n');
    
    console.log('🎉 Voice integration test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the Python voice service: cd voice-service && python main.py');
    console.log('2. Start the React Native app: npm start');
    console.log('3. Test the voice call button in the Coach tab');
    
  } catch (error) {
    console.error('❌ Voice integration test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure Python voice service is running: cd voice-service && python main.py');
    console.log('2. Check that all API keys are set in .env file');
    console.log('3. Verify WebSocket port 8002 is available');
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

runTest();