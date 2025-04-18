import React from 'react';
import AudioTranscriptionComponent from './components/AudioTranscription';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Audio Transcription with AssemblyAI</h1>
      </header>
      <main>
        <AudioTranscriptionComponent />
      </main>
      <footer>
        <p>© 2025 Audio Transcription Service</p>
      </footer>
    </div>
  );
}

export default App;