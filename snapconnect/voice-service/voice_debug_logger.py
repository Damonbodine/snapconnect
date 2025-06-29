"""
Voice Agent Debug Logger
🐛 Comprehensive debugging and logging system for Coach Alex Voice Service
"""

import logging
import json
import os
import time
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

class VoiceDebugLogger:
    """Enhanced debugging logger for voice agent operations"""
    
    def __init__(self, log_level: str = "DEBUG"):
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        
        # Create session ID for this run
        self.session_id = f"voice_session_{int(time.time())}"
        
        # Setup loggers
        self._setup_loggers(log_level)
        
        # Performance tracking
        self.performance_metrics = {
            "session_start": time.time(),
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "average_response_time": 0,
            "response_times": [],
            "deepgram_calls": 0,
            "openai_calls": 0,
            "elevenlabs_calls": 0,
            "websocket_connections": 0,
            "errors": []
        }
        
    def _setup_loggers(self, log_level: str):
        """Setup multiple specialized loggers"""
        
        # Main voice agent logger
        self.voice_logger = logging.getLogger("voice_agent")
        self.voice_logger.setLevel(getattr(logging, log_level))
        
        # Pipeline logger
        self.pipeline_logger = logging.getLogger("pipeline")
        self.pipeline_logger.setLevel(getattr(logging, log_level))
        
        # Performance logger
        self.perf_logger = logging.getLogger("performance")
        self.perf_logger.setLevel(logging.INFO)
        
        # API logger
        self.api_logger = logging.getLogger("api_calls")
        self.api_logger.setLevel(logging.DEBUG)
        
        # WebSocket logger
        self.ws_logger = logging.getLogger("websocket")
        self.ws_logger.setLevel(logging.DEBUG)
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)-12s | %(message)s',
            datefmt='%H:%M:%S'
        )
        
        simple_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        )
        
        # File handlers
        self._add_file_handler(self.voice_logger, "voice_agent.log", detailed_formatter)
        self._add_file_handler(self.pipeline_logger, "pipeline.log", detailed_formatter)
        self._add_file_handler(self.perf_logger, "performance.log", simple_formatter)
        self._add_file_handler(self.api_logger, "api_calls.log", detailed_formatter)
        self._add_file_handler(self.ws_logger, "websocket.log", detailed_formatter)
        
        # Console handler (colorized)
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(self._get_colored_formatter())
        
        # Add console handler to main logger only
        self.voice_logger.addHandler(console_handler)
        
    def _add_file_handler(self, logger: logging.Logger, filename: str, formatter: logging.Formatter):
        """Add file handler to logger"""
        file_handler = logging.FileHandler(self.log_dir / filename)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
    def _get_colored_formatter(self):
        """Create colored console formatter"""
        class ColoredFormatter(logging.Formatter):
            COLORS = {
                'DEBUG': '\033[36m',    # Cyan
                'INFO': '\033[32m',     # Green
                'WARNING': '\033[33m',  # Yellow
                'ERROR': '\033[31m',    # Red
                'CRITICAL': '\033[35m', # Magenta
                'RESET': '\033[0m'      # Reset
            }
            
            def format(self, record):
                log_color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
                record.levelname = f"{log_color}{record.levelname}{self.COLORS['RESET']}"
                return super().format(record)
        
        return ColoredFormatter(
            '%(asctime)s | %(levelname)s | 🎙️  %(message)s',
            datefmt='%H:%M:%S'
        )
    
    # Voice Agent Specific Logging
    def log_session_start(self, config: Dict[str, Any]):
        """Log voice session initialization"""
        self.voice_logger.info(f"🚀 Starting Coach Alex Voice Session: {self.session_id}")
        self.voice_logger.info(f"📋 Configuration: {json.dumps(config, indent=2)}")
        self.performance_metrics["session_start"] = time.time()
        
    def log_session_end(self):
        """Log voice session termination"""
        duration = time.time() - self.performance_metrics["session_start"]
        self.voice_logger.info(f"🏁 Voice session ended after {duration:.2f} seconds")
        self._log_performance_summary()
        
    def log_api_call(self, service: str, method: str, duration: float, success: bool, details: Optional[Dict] = None):
        """Log API service calls with timing"""
        status = "✅" if success else "❌"
        self.api_logger.info(f"{status} {service}.{method} took {duration:.3f}s")
        
        if details:
            self.api_logger.debug(f"Details: {json.dumps(details, default=str)}")
            
        # Update metrics
        self.performance_metrics[f"{service.lower()}_calls"] += 1
        self.performance_metrics["response_times"].append(duration)
        
        if success:
            self.performance_metrics["successful_requests"] += 1
        else:
            self.performance_metrics["failed_requests"] += 1
            
    def log_pipeline_event(self, event: str, data: Optional[Dict] = None):
        """Log pipeline processing events"""
        self.pipeline_logger.info(f"🔄 Pipeline: {event}")
        if data:
            self.pipeline_logger.debug(f"Data: {json.dumps(data, default=str)}")
            
    def log_websocket_event(self, event: str, client_info: Optional[str] = None, data: Optional[Dict] = None):
        """Log WebSocket connection events"""
        client_str = f" [{client_info}]" if client_info else ""
        self.ws_logger.info(f"🔌 WebSocket{client_str}: {event}")
        
        if data:
            self.ws_logger.debug(f"Data: {json.dumps(data, default=str)}")
            
        if event == "connection_established":
            self.performance_metrics["websocket_connections"] += 1
            
    def log_voice_processing(self, stage: str, duration: float, metadata: Optional[Dict] = None):
        """Log voice processing stages"""
        self.perf_logger.info(f"🎤 {stage}: {duration:.3f}s")
        
        if metadata:
            if "confidence" in metadata:
                self.perf_logger.info(f"   Confidence: {metadata['confidence']:.2f}")
            if "transcript" in metadata:
                self.perf_logger.info(f"   Transcript: '{metadata['transcript'][:100]}...'")
            if "response_length" in metadata:
                self.perf_logger.info(f"   Response: {metadata['response_length']} chars")
                
    def log_error(self, error: Exception, context: str, additional_data: Optional[Dict] = None):
        """Log errors with full context"""
        error_info = {
            "context": context,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "timestamp": datetime.now().isoformat(),
            "session_id": self.session_id
        }
        
        if additional_data:
            error_info["additional_data"] = additional_data
            
        self.voice_logger.error(f"💥 Error in {context}: {error}")
        self.voice_logger.error(f"Error details: {json.dumps(error_info, indent=2)}")
        
        # Store for metrics
        self.performance_metrics["errors"].append(error_info)
        
    def log_user_interaction(self, interaction_type: str, user_input: str, bot_response: str, metadata: Optional[Dict] = None):
        """Log complete user interactions"""
        interaction = {
            "timestamp": datetime.now().isoformat(),
            "type": interaction_type,
            "user_input": user_input[:200] + "..." if len(user_input) > 200 else user_input,
            "bot_response": bot_response[:200] + "..." if len(bot_response) > 200 else bot_response,
            "session_id": self.session_id
        }
        
        if metadata:
            interaction["metadata"] = metadata
            
        self.voice_logger.info(f"💬 User interaction: {interaction_type}")
        self.voice_logger.debug(f"Interaction details: {json.dumps(interaction, indent=2)}")
        
    def _log_performance_summary(self):
        """Log comprehensive performance summary"""
        metrics = self.performance_metrics
        session_duration = time.time() - metrics["session_start"]
        
        if metrics["response_times"]:
            avg_response = sum(metrics["response_times"]) / len(metrics["response_times"])
            metrics["average_response_time"] = avg_response
        
        self.perf_logger.info("📊 Performance Summary:")
        self.perf_logger.info(f"   Session Duration: {session_duration:.2f}s")
        self.perf_logger.info(f"   Total Requests: {metrics['total_requests']}")
        self.perf_logger.info(f"   Success Rate: {metrics['successful_requests']}/{metrics['total_requests']}")
        self.perf_logger.info(f"   Average Response Time: {metrics['average_response_time']:.3f}s")
        self.perf_logger.info(f"   Deepgram Calls: {metrics['deepgram_calls']}")
        self.perf_logger.info(f"   OpenAI Calls: {metrics['openai_calls']}")
        self.perf_logger.info(f"   ElevenLabs Calls: {metrics['elevenlabs_calls']}")
        self.perf_logger.info(f"   WebSocket Connections: {metrics['websocket_connections']}")
        self.perf_logger.info(f"   Errors: {len(metrics['errors'])}")
        
        # Save detailed metrics to JSON
        metrics_file = self.log_dir / f"metrics_{self.session_id}.json"
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2, default=str)
            
    def create_debug_context(self, operation: str):
        """Create debug context manager for timing operations"""
        return DebugContext(self, operation)

class DebugContext:
    """Context manager for timing and debugging operations"""
    
    def __init__(self, logger: VoiceDebugLogger, operation: str):
        self.logger = logger
        self.operation = operation
        self.start_time = None
        
    def __enter__(self):
        self.start_time = time.time()
        self.logger.voice_logger.debug(f"🔄 Starting: {self.operation}")
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        
        if exc_type is None:
            self.logger.voice_logger.debug(f"✅ Completed: {self.operation} ({duration:.3f}s)")
        else:
            self.logger.voice_logger.error(f"❌ Failed: {self.operation} ({duration:.3f}s)")
            self.logger.log_error(exc_val, self.operation)
            
        return False  # Don't suppress exceptions