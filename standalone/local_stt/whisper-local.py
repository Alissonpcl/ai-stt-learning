from faster_whisper import WhisperModel
import time

start_time = time.perf_counter()

model_size = "medium"
model = WhisperModel(model_size, device="cuda", compute_type="float16")
# model = WhisperModel(model_size, device="cpu", compute_type="int8")

# mp3_path = r'C:\Users\aliss\Documents\whisper-learning\data\restricted_1.mp3'
mp3_path = r'C:\Users\aliss\Documents\whisper-learning\data\restricted_1_sample_enhanced.mp3'
transcript = "" 

print('Starting transcription')
segments, info = model.transcribe(mp3_path, beam_size=5, language="pt")   

for segment in segments:
    transcript += segment.text.strip()    

end_time = time.perf_counter()

execution_time = end_time - start_time
print(f"Execution time for transcription: {execution_time:.4f} seconds")    

print("Transcription:\n", transcript)