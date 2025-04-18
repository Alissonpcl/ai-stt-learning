import React, { useState, useRef, useEffect } from 'react';
import './AudioTranscription.css';

const AudioTranscriptionComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('Ready to record');
  const [finalTranscription, setFinalTranscription] = useState('');
  const [usageMetrics, setUsageMetrics] = useState({ processedSeconds: 0, estimatedCost: 0 });

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null); // <== manter referência do MediaStream
  const sessionIdRef = useRef(null);
  const totalAudioSecondsRef = useRef(0);

  const CONFIG = {
    CHUNK_DURATION_MS: 2000,
    AUDIO_FORMAT: 'audio/webm;codecs=opus',
    API_ENDPOINT: '/api/transcribe',
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Inicializa gravador
  const initializeRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const options = { mimeType: CONFIG.AUDIO_FORMAT };
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          sendAudioChunk(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        setRecordingStatus('Processando transcrição...');
        finalizeRecording();
        // Libera o microfone
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      return true;
    } catch (err) {
      setRecordingStatus(`Erro: ${err.message}`);
      return false;
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    if (!(await initializeRecorder())) return;

    sessionIdRef.current = generateUUID();
    totalAudioSecondsRef.current = 0;
    setFinalTranscription('');
    setUsageMetrics({ processedSeconds: 0, estimatedCost: 0 });
    setIsRecording(true);
    setRecordingStatus('Gravando...');

    mediaRecorderRef.current.start(CONFIG.CHUNK_DURATION_MS);
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    setRecordingStatus('Parando...');
    mediaRecorderRef.current.stop();
  };

  const sendAudioChunk = async (blob) => {
    const chunkDuration = CONFIG.CHUNK_DURATION_MS / 1000;
    totalAudioSecondsRef.current += chunkDuration;

    const formData = new FormData();
    formData.append('audio', blob);
    formData.append('sessionId', sessionIdRef.current);
    formData.append('chunkDuration', chunkDuration.toString());
    formData.append('chunkIndex', Math.floor(totalAudioSecondsRef.current / chunkDuration).toString());

    try {
      await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      setRecordingStatus(`Erro ao enviar chunk: ${err.message}`);
    }
  };

  const finalizeRecording = async () => {
    try {
      const response = await fetch(`${CONFIG.API_ENDPOINT}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          totalDuration: totalAudioSecondsRef.current
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setFinalTranscription(result.fullTranscription || '');
        setUsageMetrics({
          processedSeconds: result.audioStats.durationSeconds,
          estimatedCost: result.billing.estimatedCost
        });
        setRecordingStatus('Transcrição concluída!');
      } else {
        setRecordingStatus('Erro ao finalizar/transcrever.');
      }
    } catch (err) {
      setRecordingStatus(`Erro: ${err.message}`);
    }
  };

  useEffect(() => {
    return () => {
      // Ao desmontar, pare e libere recursos
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="audio-transcription-container">
      <h2>Real-time Audio Transcription</h2>
      <div className="controls">
        <button 
          onClick={startRecording} 
          disabled={isRecording}
          className={`control-button ${isRecording ? 'disabled' : 'record'}`}>
          Start Recording
        </button>
        <button 
          onClick={stopRecording} 
          disabled={!isRecording}
          className={`control-button ${!isRecording ? 'disabled' : 'stop'}`}>
          Stop Recording
        </button>
      </div>
      <div className="status">
        <p>{recordingStatus}</p>
        {isRecording && (
          <p>Recording time: {formatTime(totalAudioSecondsRef.current)}</p>
        )}
      </div>
      <div className="final-transcription">
        <h3>Final Transcription</h3>
        <div className="transcription-content">
          <p>{finalTranscription}</p>
        </div>
      </div>
      <div className="usage-metrics">
        <p>Audio processed: {formatTime(usageMetrics.processedSeconds)}</p>
        <p>Estimated cost: ${usageMetrics.estimatedCost?.toFixed(4)}</p>
      </div>
    </div>
  );
};

export default AudioTranscriptionComponent;