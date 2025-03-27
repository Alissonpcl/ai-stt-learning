import React, {useState} from 'react';
import VoiceInput from './VoiceInput';
import TranscribedInput from "./TranscribedInput";

function App() {
    const [transcribedText, setTranscribedText] = useState('');

    return (
        <div style={styles.app}>
            <h1>Reconhecimento de Voz com React</h1>
            <VoiceInput setTranscribedText={setTranscribedText}/>
            <TranscribedInput transcribedText={transcribedText}/>
        </div>
    );
}

const styles = {
    app: {
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
    },
};

export default App;