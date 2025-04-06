# About

This directory contains several tests of running Faster Whisper to transcribe audio.

## Directories structure

Each directory has its own README with detailed explanation. Below there is a resume of what is inside each directory.

### standalone
Many testes contain simple Python codes to try different approaches on using Whisper to transcribe text.

### web-app
A web app containing a front end and a back end code to capture audio using web browser, send it to the back end to store it, transcribe it using Whisper locally and return it to the front.

# Tips

## Running on GPU
Faster Whisper needs NVIDIA drivers to run on GPU. So if your machine (eg: Mac M Series) doesn't have a NVIDIA GPU it is possible to run just the backend application in an another machine (eg.: another phisical machine or a VMM on Cloud) and the front locally.