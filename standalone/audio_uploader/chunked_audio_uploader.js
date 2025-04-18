const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const config = {
  audioFilePath: '../data/restricted_consulta_30_min.m4a', // Path to your audio file
  chunkSize: 1024 * 1024, // 1MB chunks
  serverProtocol: 'http', // 'http' or 'https'
  serverHost: 'example.com',
  serverPort: 80,
  uploadEndpoint: '/upload',
  maxConcurrentUploads: 3 // Maximum number of concurrent requests
};

/**
 * Reads a file in chunks and processes each chunk
 * @param {string} filePath - Path to the file to read
 * @param {number} chunkSize - Size of each chunk in bytes
 * @param {function} processChunk - Function to process each chunk
 */
async function readFileInChunks(filePath, chunkSize, processChunk) {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    console.log(`File size: ${fileSize} bytes, Total chunks: ${totalChunks}`);
    
    const fileStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
    let chunkIndex = 0;
    const pendingUploads = [];
    let activeUploads = 0;
    
    fileStream.on('data', (chunk) => {
      // Pause the stream if we have too many active uploads
      if (activeUploads >= config.maxConcurrentUploads) {
        fileStream.pause();
      }
      
      const currentChunk = chunkIndex++;
      activeUploads++;
      
      // Process this chunk and add to pending uploads
      const uploadPromise = processChunk(chunk, currentChunk, totalChunks)
        .finally(() => {
          activeUploads--;
          // Resume the stream if it was paused and we're below the limit
          if (fileStream.isPaused() && activeUploads < config.maxConcurrentUploads) {
            fileStream.resume();
          }
        });
      
      pendingUploads.push(uploadPromise);
    });
    
    fileStream.on('end', () => {
      // Wait for all pending uploads to complete
      Promise.all(pendingUploads)
        .then(() => resolve())
        .catch(err => reject(err));
    });
    
    fileStream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Uploads a chunk to the server
 * @param {Buffer} chunk - The chunk of data to upload
 * @param {number} chunkIndex - The index of this chunk
 * @param {number} totalChunks - The total number of chunks
 */
async function uploadChunk(chunk, chunkIndex, totalChunks) {
  return new Promise((resolve, reject) => {
    // Prepare request options
    const requestOptions = {
      hostname: config.serverHost,
      port: config.serverPort,
      path: config.uploadEndpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': chunk.length,
        'X-Chunk-Index': chunkIndex,
        'X-Total-Chunks': totalChunks,
        'X-File-Name': path.basename(config.audioFilePath)
      }
    };
    
    // Choose http or https based on config
    const requestModule = config.serverProtocol === 'https' ? https : http;
    
    console.log(`Starting upload of chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} bytes)`);
    
    const req = requestModule.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (data) => {
        responseData += data;
      });
      
      res.on('end', () => {
        console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded. Server response:`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${responseData}`);
        resolve({ statusCode: res.statusCode, data: responseData });
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error uploading chunk ${chunkIndex + 1}: ${error.message}`);
      reject(error);
    });
    
    // Send the chunk data and end the request
    req.write(chunk);
    req.end();
  });
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log(`Starting upload of file: ${config.audioFilePath}`);
    console.log(`Server: ${config.serverProtocol}://${config.serverHost}:${config.serverPort}${config.uploadEndpoint}`);
    console.log(`Chunk size: ${config.chunkSize} bytes`);
    console.log(`Max concurrent uploads: ${config.maxConcurrentUploads}`);
    
    const startTime = Date.now();
    
    await readFileInChunks(
      config.audioFilePath,
      config.chunkSize,
      uploadChunk
    );
    
    const endTime = Date.now();
    console.log(`Upload completed in ${(endTime - startTime) / 1000} seconds`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();