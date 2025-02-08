import asyncio
import websockets
import numpy as np
import logging
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import queue
from heybuddy import WakeWordModelThread
import traceback

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Disable websockets debug logging
logging.getLogger('websockets').setLevel(logging.WARNING)
logging.getLogger('websockets.server').setLevel(logging.WARNING)
logging.getLogger('websockets.protocol').setLevel(logging.WARNING)

# Global variables
active_connections = set()

class WakeWordProcessor:
    def __init__(self, model_paths, threshold=0.5, websocket=None):
        self.CHUNK = 1024 * 2
        self.RATE = 16000
        self.RECORD_SECONDS = 1
        self.threshold = threshold
        self.websocket = websocket
        self.loop = None  # Will store the event loop
        
        # Initialize wake word detectors
        self.wake_word_threads = {}
        try:
            for model_path in model_paths:
                model_name = os.path.splitext(os.path.basename(model_path))[0]
                thread = WakeWordModelThread(
                    model_path,
                    device_id=None,
                    threshold=threshold,
                    return_scores=True
                )
                # Start the model thread
                thread.start()
                self.wake_word_threads[model_name] = thread
            logger.info("Wake word detectors initialized and started successfully")
        except Exception as e:
            logger.error(f"Failed to initialize wake word detectors: {str(e)}")
            logger.error(traceback.format_exc())
            raise

        # Create audio processing queue and executor
        self.audio_queue = asyncio.Queue(maxsize=100)
        self.executor = ThreadPoolExecutor(max_workers=len(model_paths) + 1)
        self.running = True

    def process_chunk(self, audio_segment):
        """Process a single audio chunk through all wake word detectors"""
        try:
            if audio_segment is None or audio_segment.size == 0:
                return

            logger.debug(f"Processing audio chunk of size: {audio_segment.size}")
            
            # Check if all threads are alive
            for model_name, thread in self.wake_word_threads.items():
                if not thread.is_alive():
                    logger.error(f"Wake word detector thread {model_name} is not alive, restarting...")
                    thread.start()
            
            # Split into 1-second segments if longer than 16000 samples
            samples_per_second = self.RATE
            if audio_segment.size > samples_per_second:
                # Create overlapping windows of 1 second each
                for i in range(0, audio_segment.size - samples_per_second + 1, samples_per_second // 2):
                    segment = audio_segment[i:i + samples_per_second]
                    if segment.size == samples_per_second:  # Only process complete segments
                        self._process_segment(segment)
            else:
                # Process single segment if it's already 1 second or less
                self._process_segment(audio_segment)
            
        except Exception as e:
            logger.error(f"Error processing chunk: {str(e)}")
            logger.error(traceback.format_exc())

    def _process_segment(self, segment):
        """Process a single segment through all models"""
        for model_name, thread in self.wake_word_threads.items():
            try:
                thread.put(segment)
                prediction = thread.get(block=True, timeout=2.0)
                
                if prediction is None:
                    continue
                    
                score = prediction[0][0]
                logger.debug(f"Prediction score for {model_name}: {score}")
                
                if score > self.threshold:
                    logger.info(f"Wake word '{model_name}' detected! (confidence: {score:.2f})")
                    # Send detection to client if websocket is available
                    if self.websocket and self.websocket in active_connections and self.loop:
                        try:
                            # Use the stored event loop and send structured message
                            message = '{"type": "WakeWord", "message": "detected"}'
                            future = asyncio.run_coroutine_threadsafe(
                                self.websocket.send(message),
                                self.loop
                            )
                            # Wait for the send to complete
                            future.result(timeout=1.0)
                        except Exception as e:
                            logger.error(f"Failed to send wake word detection: {str(e)}")
            
            except queue.Empty:
                logger.debug(f"No prediction available within timeout for {model_name}")
            except queue.Full:
                logger.warning(f"Model input queue full for {model_name}, skipping segment")
            except Exception as e:
                logger.error(f"Error in model prediction for {model_name}: {str(e)}")
                logger.error(traceback.format_exc())

    async def process_audio(self):
        """Process audio chunks and detect wake word"""
        # Store the event loop for use in threads
        self.loop = asyncio.get_running_loop()
        logger.info("Starting audio processing loop")
        
        while self.running:
            try:
                audio_chunks = []
                chunks_needed = int(self.RATE / self.CHUNK * self.RECORD_SECONDS)
                logger.debug(f"Collecting chunks. Need {chunks_needed} chunks")
                
                # Collect chunks for duration
                for _ in range(chunks_needed):
                    try:
                        chunk = await asyncio.wait_for(self.audio_queue.get(), timeout=0.1)
                        if chunk is not None and chunk.size > 0:
                            logger.debug(f"Got chunk of size: {chunk.size}")
                            audio_chunks.append(chunk)
                            self.audio_queue.task_done()
                    except asyncio.TimeoutError:
                        continue
                
                if len(audio_chunks) >= chunks_needed // 2:
                    try:
                        logger.debug(f"Concatenating {len(audio_chunks)} chunks")
                        segment = np.concatenate(audio_chunks)
                        if segment.size > 0:
                            logger.info(f"Processing segment of size: {segment.size}")
                            # Process the segment in a thread
                            await self.loop.run_in_executor(
                                self.executor,
                                self.process_chunk,
                                segment
                            )
                        else:
                            logger.warning("Empty segment after concatenation")
                    except Exception as e:
                        logger.error(f"Error processing audio segment: {str(e)}")
                        logger.error(traceback.format_exc())
                else:
                    logger.debug(f"Not enough chunks: got {len(audio_chunks)}/{chunks_needed}")

                await asyncio.sleep(0.01)
            except Exception as e:
                logger.error(f"Error in process_audio loop: {str(e)}")
                logger.error(traceback.format_exc())

    async def stop(self):
        """Stop and clean up"""
        self.running = False
        # Stop all wake word detector threads
        for model_name, thread in self.wake_word_threads.items():
            try:
                thread.stop()
                logger.info(f"Wake word detector thread {model_name} stopped")
            except Exception as e:
                logger.error(f"Error stopping wake word detector thread {model_name}: {str(e)}")
        
        self.executor.shutdown(wait=False)
        logger.info("Wake word processor stopped")

async def handle_wake_word_connection(websocket):
    """Handle a WebSocket connection for wake word detection"""
    try:
        # Add the connection to the set of active connections
        active_connections.add(websocket)
        logger.info("Client connected to wake word endpoint")
        
        # Initialize wake word processor
        model_paths = [
            "server/models/models/hey-buddy.onnx",
            "server/models/models/hi-buddy.onnx",
            "server/models/models/hello-buddy.onnx",
            "server/models/models/yo-buddy.onnx",
            'server/models/models/buddy.onnx',
            'server/models/models/sup-buddy.onnx'
        ]
        processor = WakeWordProcessor(model_paths=model_paths, threshold=0.5, websocket=websocket)
        
        # Start audio processing task
        process_task = asyncio.create_task(processor.process_audio())
        
        # Keep the connection alive and process incoming audio data
        async for message in websocket:
            try:
                # Convert the incoming buffer to float32 numpy array
                audio_chunk = np.frombuffer(message, dtype=np.float32)
                logger.debug(f"Received audio chunk of size: {audio_chunk.size}")
                await processor.audio_queue.put(audio_chunk)
            except Exception as e:
                logger.error(f"Error processing audio chunk: {str(e)}")
                logger.error(traceback.format_exc())
                
    except websockets.ConnectionClosed:
        logger.info("Client disconnected from wake word endpoint")
    finally:
        # Clean up
        await processor.stop()
        process_task.cancel()
        active_connections.remove(websocket)

async def main():
    """Start the WebSocket server"""
    try:
        # Create the WebSocket server
        async with websockets.serve(
            handler=handle_wake_word_connection,
            host='localhost',
            port=8765,
            
        ) as server:
            logger.info("WebSocket server started on ws://localhost:8765/wake-word")
            # Keep the server running
            await asyncio.Future()  # run forever
            
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        raise 