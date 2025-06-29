#!/usr/bin/env python3

"""
Coach Alex Voice Service - Pipecat-powered Fitness Coach
Based on official Pipecat documentation and WordWise AI implementation
"""

import asyncio
import logging
import os
import sys
import time
from typing import List, Dict, Any

from dotenv import load_dotenv
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.transports.network.websocket_server import WebsocketServerTransport, WebsocketServerParams
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService

from voice_debug_logger import VoiceDebugLogger

# Load environment variables
load_dotenv()

# Initialize debug logger
debug_logger = VoiceDebugLogger(log_level="DEBUG")

class CoachAlexVoiceService:
    """Main voice service class for Coach Alex fitness coaching"""
    
    def __init__(self):
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        self.openai_api_key = os.getenv("EXPO_PUBLIC_OPENAI_API_KEY") 
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        self.elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")
        self.elevenlabs_model = os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5")
        self.deepgram_model = os.getenv("DEEPGRAM_MODEL", "nova-2")
        
        # Validate API keys
        if not all([self.deepgram_api_key, self.openai_api_key, self.elevenlabs_api_key]):
            raise ValueError("Missing required API keys. Check your .env file.")
    
    def create_fitness_coaching_prompt(self) -> str:
        """Create the system prompt for Coach Alex fitness coaching"""
        return """You are Coach Alex, an enthusiastic and supportive AI fitness coach for SnapConnect. 

Your personality:
- Motivational and encouraging, but never pushy
- Knowledgeable about fitness, nutrition, and wellness
- Adaptable to different fitness levels and goals
- Uses positive reinforcement and celebrates small wins
- Speaks conversationally and energetically
- Keeps responses concise for voice interaction (under 150 words)

Your capabilities:
- Provide workout guidance and form corrections
- Offer motivational coaching during exercises  
- Track workout progress and celebrate achievements
- Answer fitness and nutrition questions
- Help with goal setting and planning
- Provide real-time encouragement and support

Context: You're having a voice conversation with a user during or about their fitness journey. Be supportive, specific, and actionable in your responses. If you need more context about their current workout or goals, ask clarifying questions.

Remember: Keep responses concise and conversational for voice interaction. Focus on being helpful and motivational."""

    async def create_pipeline(self, host: str = "0.0.0.0", port: int = 8002):
        """Create the Pipecat pipeline for voice processing"""
        
        with debug_logger.create_debug_context("Pipeline Creation"):
            # Initialize transport
            debug_logger.log_pipeline_event("Initializing WebSocket transport", {
                "host": host, 
                "port": port
            })
            
            # Create WebSocket server parameters
            ws_params = WebsocketServerParams()
            
            transport = WebsocketServerTransport(
                params=ws_params,
                host=host,
                port=port
            )
            
            # Initialize services with debugging
            debug_logger.log_pipeline_event("Initializing Deepgram STT", {
                "model": self.deepgram_model
            })
            stt = DeepgramSTTService(
                api_key=self.deepgram_api_key,
                model=self.deepgram_model,
                language="en-US"
            )
            
            debug_logger.log_pipeline_event("Initializing OpenAI LLM", {
                "model": "gpt-4o-mini"
            })
            llm = OpenAILLMService(
                api_key=self.openai_api_key,
                model="gpt-4o-mini",
                system_message=self.create_fitness_coaching_prompt()
            )
            
            debug_logger.log_pipeline_event("Initializing ElevenLabs TTS", {
                "voice_id": self.elevenlabs_voice_id,
                "model": self.elevenlabs_model
            })
            tts = ElevenLabsTTSService(
                api_key=self.elevenlabs_api_key,
                voice_id=self.elevenlabs_voice_id,
                model=self.elevenlabs_model
            )
            
            # Create pipeline
            debug_logger.log_pipeline_event("Assembling voice pipeline")
            voice_pipeline = Pipeline([
                transport.input(),
                stt,
                llm,
                tts,
                transport.output()
            ])
            
            debug_logger.log_pipeline_event("Pipeline created successfully")
            return voice_pipeline

    async def run_service(self, host: str = "0.0.0.0", port: int = 8002):
        """Run the voice service"""
        
        config = {
            "host": host,
            "port": port,
            "deepgram_model": self.deepgram_model,
            "elevenlabs_voice_id": self.elevenlabs_voice_id,
            "elevenlabs_model": self.elevenlabs_model
        }
        
        debug_logger.log_session_start(config)
        
        try:
            # Create pipeline
            with debug_logger.create_debug_context("Service Startup"):
                voice_pipeline = await self.create_pipeline(host, port)
                
                debug_logger.log_websocket_event("Starting WebSocket server", f"{host}:{port}")
                
                # Create pipeline task and runner
                debug_logger.log_pipeline_event("Creating pipeline task")
                task = PipelineTask(voice_pipeline)
                
                debug_logger.log_pipeline_event("Starting pipeline runner")
                runner = PipelineRunner()
                
                # Run the pipeline
                await runner.run(task)
            
        except KeyboardInterrupt:
            debug_logger.voice_logger.info("🛑 Received interrupt signal, shutting down...")
        except Exception as e:
            debug_logger.log_error(e, "Service Runtime", {"host": host, "port": port})
            raise
        finally:
            debug_logger.log_session_end()

async def main():
    """Main entry point"""
    try:
        # Get configuration from environment
        host = os.getenv("WEBSOCKET_HOST", "0.0.0.0")
        port = int(os.getenv("WEBSOCKET_PORT", "8002"))
        
        debug_logger.voice_logger.info("🎙️ Coach Alex Voice Service Starting...")
        debug_logger.voice_logger.info(f"📡 WebSocket Server: {host}:{port}")
        
        # Create and run voice service
        service = CoachAlexVoiceService()
        await service.run_service(host=host, port=port)
        
    except Exception as e:
        debug_logger.log_error(e, "Main Entry Point")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())