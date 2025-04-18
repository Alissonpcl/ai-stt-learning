🏗️ WORK IN PROGRESS

**Next Steps**

1. Improve overall quality of the source code applying good coding practices


# About

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

## Running on GPU
Faster Whisper needs NVIDIA drivers to run on GPU. So if your machine (eg: Mac M Series) doesn't have a NVIDIA GPU it is possible to run just the backend application in an another machine (eg.: another phisical machine or a VMM on Cloud) and the front locally.