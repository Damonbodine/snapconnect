#!/usr/bin/env python3
import asyncio
import websockets

async def handler(websocket, path):
    print(f'✅ Client connected: {websocket.remote_address}')
    try:
        async for message in websocket:
            print(f'📨 Received: {message}')
            await websocket.send(f'Echo: {message}')
    except Exception as e:
        print(f'❌ Error: {e}')

async def main():
    print('🚀 Starting test WebSocket server on 0.0.0.0:8002')
    server = await websockets.serve(handler, '0.0.0.0', 8002)
    print('✅ Server ready - waiting for connections...')
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())