const record = require('node-record-lpcm16');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { BrowserWindow, screen } = require('electron');

let ws = null;
let recordingProcess = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// For debugging: save a few seconds of audio to verify format
let debugChunks = [];
let isRecordingDebug = false;
const DEBUG_DURATION_MS = 5000; // 5 seconds
let debugStartTime = null;

function saveDebugRecording() {
  if (debugChunks.length === 0) return;
  
  const debugDir = path.join(__dirname, '..', 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(debugDir, `debug-recording-${timestamp}.raw`);
  
  // Concatenate all chunks and save
  const buffer = Buffer.concat(debugChunks);
  fs.writeFileSync(filePath, buffer);
  console.log(`Saved debug recording to ${filePath}`);
  
  // Clear the chunks array
  debugChunks = [];
  isRecordingDebug = false;
}

function connectToBackend(onSuccess) {
  if (retryCount >= MAX_RETRIES) {
    console.error('Max retries reached. Could not connect to backend.');
    return;
  }

  console.log(`Attempting to connect to backend (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
  
  ws = new WebSocket('ws://localhost:8765');

  ws.on('open', () => { 
    console.log('Connected to wake word detection endpoint');
    retryCount = 0; // Reset retry count on successful connection
    if (onSuccess) onSuccess();
  });

  ws.on('message', (message) => { 
    const msg = message.toString();
    console.log('Received raw message from backend:', msg); 
    
    try {
        const data = JSON.parse(msg);
        
        if (data.type === 'WakeWord' && data.message === 'detected') {
            console.log('Wake word detected! Opening chat window...');
            showChatWindow();
        }
    } catch (err) {
        console.error('Error parsing message from backend:', err);
    }
  });

  ws.on('close', () => { 
    console.log('Wake word detection connection closed');
    ws = null;
  });

  ws.on('error', (err) => { 
    console.error('WebSocket error', err);
    ws = null;
    // Implement exponential backoff
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    retryCount++;
    console.log(`Retrying connection in ${delay/1000} seconds...`);
    setTimeout(() => connectToBackend(onSuccess), delay);
  });
}

function startRecording() {
  console.log('Starting audio recording...');
  try {
    recordingProcess = record.record({
      sampleRate: 16000,
      channels: 1,
      verbose: false,
      silence: '0:00.0',
      device: null,
      audioType: 'raw',
      encoding: 'signed-integer',
      endian: 'little'
    });

    const stream = recordingProcess.stream();
    
    // Start debug recording
    isRecordingDebug = true;
    debugStartTime = Date.now();

    stream.on('data', (chunk) => {
      // Store debug chunks for the first few seconds
      if (isRecordingDebug && Date.now() - debugStartTime < DEBUG_DURATION_MS) {
        debugChunks.push(chunk);
      } else if (isRecordingDebug) {
        saveDebugRecording();
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        // Convert Int16Array to Float32Array before sending
        const int16Data = new Int16Array(chunk.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
          // Convert 16-bit integer to float32 (-1.0 to 1.0)
          float32Data[i] = int16Data[i] / 32768.0;
        }
        ws.send(float32Data.buffer);
      }
    });

    stream.on('error', (err) => {
      console.error('Recording error:', err);
    });
  } catch (err) {
    console.error('Failed to start recording:', err);
  }
}

function startAudioStream() {
  retryCount = 0; // Reset retry count when starting new connection
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectToBackend(() => startRecording());
  } else {
    startRecording();
  }
}

function stopAudioStream() {
  console.log('Stopping audio recording...');
  if (recordingProcess) {
    try {
      recordingProcess.stop();
      recordingProcess = null;
      
      // Save any remaining debug recording
      if (isRecordingDebug && debugChunks.length > 0) {
        saveDebugRecording();
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  retryCount = 0; // Reset retry count when stopping
}

function showChatWindow() {
    // Get all windows
    const allWindows = BrowserWindow.getAllWindows();
    const existingChatWindow = allWindows.find(win => win.getTitle() === 'Bud');

    if (existingChatWindow) {
        // If chat window exists, just show it
        existingChatWindow.show();
        return;
    }

    // Otherwise create a new chat window
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const chatWindow = new BrowserWindow({
        width: 300,
        height: 400,
        x: width - 320, // Position near the right edge
        y: 40, // Position near the top
        frame: false, // Remove window frame
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        skipTaskbar: true,
        title: 'Bud'
    });

    chatWindow.loadFile(path.join(__dirname, 'chat.html'));
    chatWindow.show();

    // Temporarily stop audio stream while chat window is open
    stopAudioStream();

    chatWindow.on('closed', () => {
        // Resume audio stream when chat window is closed
        startAudioStream();
    });
}

module.exports = { startAudioStream, stopAudioStream }; 