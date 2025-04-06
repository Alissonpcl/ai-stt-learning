import React, { useState, useEffect, useRef } from 'react';
import './AudioTranscription.css';

const AudioTranscriptionComponent = () => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState('Ready to record');
  const [usageMetrics, setUsageMetrics] = useState({ processedSeconds: 0, estimatedCost: 0 });
  const [finalTranscription, setFinalTranscription] = useState('');
  
  // Refs for audio recording
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);
  const totalAudioSecondsRef = useRef(0);
  const transcriptionOutputRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Configuration options
  const CONFIG = {
    CHUNK_DURATION_MS: 5000,  // Process chunks every 2 seconds
    API_ENDPOINT: '/api/transcribe'
  };

  // Initialize audio recorder
  const initializeRecorder = async () => {
    try {
      // Stop any existing streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Request microphone access with explicit constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Store the stream
      streamRef.current = stream;
      
      // Test which MIME type is supported
      const mimeTypes = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log(`Using supported MIME type: ${type}`);
          break;
        }
      }
      
      if (!selectedMimeType) {
        console.warn("No preferred MIME types supported. Using browser default.");
      }
      
      // Create recorder with optimized options
      mediaRecorderRef.current = new MediaRecorder(stream, 
        selectedMimeType ? { mimeType: selectedMimeType } : {});
      
      // Set up event handlers
      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log("Audio chunk received:", event.data, "Size:", event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      console.log("Audio recorder initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing audio recorder:", error);
      setRecordingStatus(`Error: ${error.message}`);
      return false;
    }
  };

  // Generate a UUID for session tracking
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Process audio chunks at regular intervals
  const processChunks = async () => {
    if (audioChunksRef.current.length > 0) {
      const chunksToProcess = [...audioChunksRef.current];
      audioChunksRef.current = [];
      
      try {
        await sendAudioChunk(chunksToProcess);
      } catch (error) {
        console.error("Error processing audio chunks:", error);
      }
    }
  };

  // Start recording
  const startRecording = async () => {
    if (isRecording) return;
    
    // Reset state
    audioChunksRef.current = [];
    setTranscription([]);
    setFinalTranscription('');
    setUsageMetrics({ processedSeconds: 0, estimatedCost: 0 });
    
    // Initialize or reinitialize recorder
    const initialized = await initializeRecorder();
    if (!initialized) return;
    
    try {
      // Generate a unique session ID
      sessionIdRef.current = generateUUID();
      totalAudioSecondsRef.current = 0;
      
      // Start recording
      console.log("Starting MediaRecorder...");
      mediaRecorderRef.current.start(100); // Request data every 100ms for more reliable chunks
      
      setIsRecording(true);
      setRecordingStatus('Recording in progress...');
      
      // Set up interval to process chunks periodically
      recordingIntervalRef.current = setInterval(() => {
        processChunks();
        totalAudioSecondsRef.current += CONFIG.CHUNK_DURATION_MS / 1000;
      }, CONFIG.CHUNK_DURATION_MS);
      
      console.log("Recording started with session ID:", sessionIdRef.current);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setRecordingStatus(`Failed to start: ${err.message}`);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!isRecording) return;
    
    try {
      // Clear processing interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        console.log("MediaRecorder stopped");
      }
      
      // Process any remaining chunks
      await processChunks();
      
      // Signal end of stream
      await signalEndOfStream();
      
      // Update state
      setIsRecording(false);
      setRecordingStatus('Processing final transcription...');
      
      // Release microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      console.log("Recording stopped. Total audio duration:", formatTime(totalAudioSecondsRef.current));
    } catch (error) {
      console.error("Error stopping recording:", error);
      setRecordingStatus('Error stopping recording');
      setIsRecording(false);
    }
  };

  // Send audio chunk to server
  const sendAudioChunk = async (chunks) => {
    try {
      const blob = new Blob(chunks, { type: mediaRecorderRef.current.mimeType });
      console.log("Sending blob of size:", blob.size, "Type:", blob.type);
      
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('sessionId', sessionIdRef.current);
      formData.append('chunkDuration', (CONFIG.CHUNK_DURATION_MS / 1000).toString());
      formData.append('chunkIndex', Math.floor(totalAudioSecondsRef.current / (CONFIG.CHUNK_DURATION_MS / 1000)).toString());
      
      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.transcription && result.transcription.trim() !== '') {
          setTranscription(prev => [...prev, result.transcription]);
        }
        setUsageMetrics(result.usage || { processedSeconds: totalAudioSecondsRef.current, estimatedCost: 0 });
      } else {
        console.error("Error sending audio chunk:", await response.text());
      }
    } catch (error) {
      console.error("Error processing audio chunk:", error);
    }
  };

  // Signal to the server that the recording has ended
  const signalEndOfStream = async () => {
    try {
      const response = await fetch(`${CONFIG.API_ENDPOINT}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId: sessionIdRef.current, 
          totalDuration: totalAudioSecondsRef.current 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setFinalTranscription(result.fullTranscription || '');
        setUsageMetrics(result.billing || { processedSeconds: totalAudioSecondsRef.current, estimatedCost: 0 });
        setRecordingStatus('Recording completed');
      }
    } catch (error) {
      console.error("Error signaling end of stream:", error);
      setRecordingStatus('Error completing transcription');
    }
  };

  // Helper function to format seconds as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to the bottom of transcription output
  useEffect(() => {
    if (transcriptionOutputRef.current) {
      transcriptionOutputRef.current.scrollTop = transcriptionOutputRef.current.scrollHeight;
    }
  }, [transcription]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="audio-transcription-container">
      <h2>Real-time Audio Transcription</h2>
      
      <div className="controls">
        <button 
          onClick={startRecording} 
          disabled={isRecording}
          className={`control-button ${isRecording ? 'disabled' : 'record'}`}
        >
          Start Recording
        </button>
        
        <button 
          onClick={stopRecording} 
          disabled={!isRecording}
          className={`control-button ${!isRecording ? 'disabled' : 'stop'}`}
        >
          Stop Recording
        </button>
      </div>
      
      <div className="status-bar">
        <div className="status">
          <span className={`status-indicator ${isRecording ? 'recording' : ''}`}></span>
          <span className="status-text">{recordingStatus}</span>
        </div>
        
        <div className="metrics">
          <span>
            Processed: {formatTime(usageMetrics.processedSeconds)} | 
            Est. cost: ${usageMetrics.estimatedCost?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>
      
      <div className="transcription-container">
        <h3>Live Transcription</h3>
        <div className="transcription-output" ref={transcriptionOutputRef}>
          {transcription.map((text, index) => (
            <p key={index} className="transcription-segment">{text}</p>
          ))}
        </div>
      </div>
      
      {finalTranscription && (
        <div className="final-transcription">
          <h3>Final Transcription</h3>
          <div className="final-transcription-content">
            {finalTranscription}
          </div>
          
          <div className="usage-summary">
            <strong>Session Summary:</strong> Total audio: {formatTime(totalAudioSecondsRef.current)} | 
            Cost: ${usageMetrics.estimatedCost?.toFixed(2) || '0.00'}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioTranscriptionComponent;