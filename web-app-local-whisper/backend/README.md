# Setup

Create a venv

```bash
python -m venv .venv

# Windows
# .\.venv\Scripts\Activate.ps1 

# Mac/Linux
# source venv/bin/activate  
```

Install Requirements

```bash
pip install -r requirements.txt 
```

**FFMPEG**

Utilizado para conversao do arquivo de audio de webm para mp3.

MacOS
```bash
brew install ffmpeg
```

Linux
```bash
sudo apt update
sudo apt install ffmpeg
```

Download dlls files from https://github.com/Purfview/whisper-standalone-win/releases/tag/libs

Put these files in the same folder as ctranslate2.dll. The command above shows the locations of ctranslate2:
```bash
pip show ctranslate2
```

Start app

```bash
python app.py
```

# Links

https://github.com/SYSTRAN/faster-whisper
https://github.com/Purfview/whisper-standalone-win/releases/tag/libs