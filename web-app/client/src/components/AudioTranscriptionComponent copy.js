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
  const audioRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);
  const totalAudioSecondsRef = useRef(0);
  const transcriptionOutputRef = useRef(null);

  // Configuration options
  const CONFIG = {
    CHUNK_DURATION_MS: 2000,  // Send chunks every 2 seconds
    AUDIO_FORMAT: 'audio/webm',
    SAMPLE_RATE: 16000,
    API_ENDPOINT: '/api/transcribe'
  };

  // Initialize audio recorder
  // const initializeRecorder = async () => {
  //   try {
  //     // Request microphone access
  //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  //     streamRef.current = stream;
      
  //     // audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
  //     //   sampleRate: CONFIG.SAMPLE_RATE
  //     // });
      
  //     // Create recorder
  //     audioRecorderRef.current = new MediaRecorder(stream, { 
  //       mimeType: CONFIG.AUDIO_FORMAT 
  //     });      
      
  //     // Set up event handler for data availability
  //     audioRecorderRef.current.ondataavailable = handleAudioChunk;

  //     audioRecorderRef.current.onerror = (event) => {
  //       console.error("MediaRecorder error:", event.error);
  //       // setRecordingStatus(`Recording error: ${event.error.message}`);
  //       // setIsRecording(false);
  //     };
      
  //     console.log("Audio recorder initialized successfully");
  //     return true;
  //   } catch (error) {
  //     console.error("Error initializing audio recorder:", error);
  //     setRecordingStatus(`Error: ${error.message}`);
  //     return false;
  //   }
  // };

  const initializeRecorder = async () => {
    try {
      // Request microphone access with explicit constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Important: Check if we actually received tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error("No audio tracks received");
        setRecordingStatus("Error: No audio tracks available");
        return false;
      }
      
      console.log("Audio track received:", audioTracks[0].label, "- Ready state:", audioTracks[0].readyState);
      
      // Store the stream in the ref
      streamRef.current = stream;
      
      // Use a simpler MIME type approach - often audio/webm is most reliable
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';  // Let the browser choose the default
        console.log("Using browser default MIME type");
      }
      
      // Create recorder with minimal options to avoid compatibility issues
      const options = mimeType ? { mimeType } : {};
      audioRecorderRef.current = new MediaRecorder(stream, options);
      
      // Add more comprehensive event handlers
      audioRecorderRef.current.ondataavailable = handleAudioChunk;
      audioRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        setRecordingStatus(`Recording error: ${event.error.message}`);
        setIsRecording(false);
      };
      
      audioRecorderRef.current.onstart = () => {
        console.log("MediaRecorder started successfully at:", new Date().toISOString());
      };
      
      audioRecorderRef.current.onstop = () => {
        console.log("MediaRecorder stopped at:", new Date().toISOString());
        // Only show message if it wasn't intentionally stopped
        if (isRecording) {
          setIsRecording(false);
          setRecordingStatus('Recording stopped unexpectedly');
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

  // Handle incoming audio chunks
  const handleAudioChunk = (event) => {
    console.log("Audio chunk received:", event.data);
    if (event.data.size > 0 && isRecording) {
      sendAudioChunk([event.data]);
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

  // Start recording in chunks
  const startRecording = async () => {
    if (isRecording) return;
    
    if (!audioRecorderRef.current) {
      const initialized = await initializeRecorder();
      if (!initialized) return;
    }
    
    // Generate a unique session ID for this recording
    sessionIdRef.current = generateUUID();
    totalAudioSecondsRef.current = 0;
    
    // Reset states
    setTranscription([]);
    setFinalTranscription('');
    setUsageMetrics({ processedSeconds: 0, estimatedCost: 0 });
    
    // Start the recorder
    console.log("MediaRecorder state before starting:", audioRecorderRef.current.state);
    audioRecorderRef.current.start(1000);
    console.log("MediaRecorder state after starting:", audioRecorderRef.current.state);
    setIsRecording(true);    
    setRecordingStatus('Recording in progress...');
    
    console.log("Recording started with session ID:", sessionIdRef.current);
  };

  useEffect(() => {
    let keepAliveInterval;
    
    if (isRecording) {
      // Set up a keepalive to prevent the browser from shutting down the audio stream
      keepAliveInterval = setInterval(() => {
        if (streamRef.current && streamRef.current.active) {
          const tracks = streamRef.current.getAudioTracks();
          if (tracks.length > 0) {
            console.log("Keep-alive: Audio track state:", tracks[0].readyState);
          }
        }
      }, 1000);
    }
    
    return () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    };
  }, [isRecording]);

  // Stop recording
  const stopRecording = () => {
    if (!isRecording) return;
    
    audioRecorderRef.current.stop();
    setIsRecording(false);
    setRecordingStatus('Processing final transcription...');
    
    // Send an end-of-stream signal
    signalEndOfStream();
    
    console.log("Recording stopped. Total audio duration:", formatTime(totalAudioSecondsRef.current));
  };

  // Send audio chunk to server
  const sendAudioChunk = async (chunks) => {
    try {
      const blob = new Blob(chunks, { type: CONFIG.AUDIO_FORMAT });
      const formData = new FormData();
      
      // Calculate this chunk's duration (approximate)
      const chunkDuration = CONFIG.CHUNK_DURATION_MS / 1000;
      totalAudioSecondsRef.current += chunkDuration;
      
      formData.append('audio', blob);
      formData.append('sessionId', sessionIdRef.current);
      formData.append('chunkDuration', chunkDuration.toString());
      formData.append('chunkIndex', (totalAudioSecondsRef.current / chunkDuration).toString());
      
      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.transcription && result.transcription.trim() !== '') {
          setTranscription(prev => [...prev, result.transcription]);
        }
        setUsageMetrics(result.usage);
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
        setFinalTranscription(result.fullTranscription);
        setUsageMetrics(result.billing);
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
      if (audioRecorderRef.current && isRecording) {
        audioRecorderRef.current.stop();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

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