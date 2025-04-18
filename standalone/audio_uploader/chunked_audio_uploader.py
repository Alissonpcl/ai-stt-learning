import os
import asyncio
import aiohttp
import time
from pathlib import Path


class ChunkedAudioUploader:
    def __init__(self):
        # Configuration
        self.config = {
            'audio_file_path': './audio_file.mp3',  # Path to your audio file
            'chunk_size': 1024 * 1024,  # 1MB chunks
            'server_protocol': 'http',  # 'http' or 'https'
            'server_host': 'example.com',
            'server_port': 80,
            'upload_endpoint': '/upload',
            'max_concurrent_uploads': 3  # Maximum number of concurrent requests
        }
        self.semaphore = asyncio.Semaphore(self.config['max_concurrent_uploads'])

    async def upload_chunk(self, chunk, chunk_index, total_chunks, session):
        """Upload a chunk to the server asynchronously"""
        async with self.semaphore:
            file_name = Path(self.config['audio_file_path']).name
            url = f"{self.config['server_protocol']}://{self.config['server_host']}:{self.config['server_port']}{self.config['upload_endpoint']}"
            
            headers = {
                'Content-Type': 'application/octet-stream',
                'X-Chunk-Index': str(chunk_index),
                'X-Total-Chunks': str(total_chunks),
                'X-File-Name': file_name
            }
            
            print(f"Starting upload of chunk {chunk_index + 1}/{total_chunks} ({len(chunk)} bytes)")
            
            try:
                async with session.post(url, data=chunk, headers=headers) as response:
                    response_text = await response.text()
                    status_code = response.status
                    
                    print(f"Chunk {chunk_index + 1}/{total_chunks} uploaded. Server response:")
                    print(f"Status: {status_code}")
                    print(f"Response: {response_text}")
                    
                    return {'status_code': status_code, 'response': response_text}
            except Exception as e:
                print(f"Error uploading chunk {chunk_index + 1}: {str(e)}")
                raise e

    async def read_and_upload_file(self):
        """Read file in chunks and upload each chunk"""
        file_path = self.config['audio_file_path']
        chunk_size = self.config['chunk_size']
        
        file_size = os.path.getsize(file_path)
        total_chunks = (file_size + chunk_size - 1) // chunk_size  # Ceiling division
        
        print(f"File size: {file_size} bytes, Total chunks: {total_chunks}")
        
        upload_tasks = []
        
        async with aiohttp.ClientSession() as session:
            with open(file_path, 'rb') as file:
                chunk_index = 0
                
                while True:
                    chunk = file.read(chunk_size)
                    if not chunk:
                        break
                    
                    task = asyncio.create_task(
                        self.upload_chunk(chunk, chunk_index, total_chunks, session)
                    )
                    upload_tasks.append(task)
                    chunk_index += 1
                
                # Wait for all uploads to complete
                results = await asyncio.gather(*upload_tasks, return_exceptions=True)
                
                # Check for any exceptions
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        print(f"Upload task {i} failed with exception: {result}")
                
                return results

    async def run(self):
        """Main function to run the uploader"""
        try:
            print(f"Starting upload of file: {self.config['audio_file_path']}")
            print(f"Server: {self.config['server_protocol']}://{self.config['server_host']}:{self.config['server_port']}{self.config['upload_endpoint']}")
            print(f"Chunk size: {self.config['chunk_size']} bytes")
            print(f"Max concurrent uploads: {self.config['max_concurrent_uploads']}")
            
            start_time = time.time()
            
            await self.read_and_upload_file()
            
            end_time = time.time()
            print(f"Upload completed in {end_time - start_time:.2f} seconds")
            
        except Exception as e:
            print(f"Error: {str(e)}")


# Run the script
if __name__ == "__main__":
    uploader = ChunkedAudioUploader()
    asyncio.run(uploader.run())