🏗️ WORK IN PROGRESS

**Next Steps**

1. Improve overall quality of the source code applying good coding practices


# Sobre

Project build to try and learn  [Faster Whisper](https://github.com/SYSTRAN/faster-whisper)

## Components

### Frontend
React application that does the following:

1. Capture audio from device microfone using native Javascript feature of Speech to Text;
1. Sends the audio to a backend application
1. Display transcribed text sent back by the backend

### Backend

Flask API that:

1. Receives and incoming audio data
1. Transcribe it to text using Faster Whisper
1. Respond with the transcription to consumer

# Tips

See [README.md](../README.md) for tips about running Whisper locally.