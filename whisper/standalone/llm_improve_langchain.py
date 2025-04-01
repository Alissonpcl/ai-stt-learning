'''
WORK IN PROGRESS
Although it is tracked it is not finished yet
'''

from faster_whisper import WhisperModel
from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
import time

def transcribe_to_text():

    # A transcricao de audio para texto é feita direto com Whisper
    # pois usando um parser Langchain é muito mais lento (ex.: FasterWhisperParser)    
    model_size = "base"
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    mp3_path = r'C:\Users\aliss\Documents\whisper-learning\data\videoplayback.m4a'
    transcript = "" 

    segments, info = model.transcribe(mp3_path, beam_size=5, language="pt")   

    for segment in segments:
        transcript += segment.text.strip()
    
    return transcript        

def improve_text(text: str):
    template = """Transcript: {text}

    Given the transcript above, write a better version of it.
    Keep the same language or the source.
    Doesn't explain. Just return the improved text."""

    prompt = ChatPromptTemplate.from_template(template)

    model = OllamaLLM(model="llama3.1:latest")

    chain = prompt | model

    return chain.invoke({'text': text})
    


start_time = time.perf_counter()

transcript = transcribe_to_text()

end_time = time.perf_counter()

execution_time = end_time - start_time
print(f"Execution time for transcription: {execution_time:.4f} seconds")    

start_time = time.perf_counter()

improved = improve_text(text=transcript)

end_time = time.perf_counter()

execution_time = end_time - start_time
print(f"Execution time for improvement: {execution_time:.4f} seconds")    

print("Texto melhorado:\n", improved)