// SERVER-SIDE CODE (Node.js with Express)
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per chunk
});

// In-memory session storage (in production, use Redis or similar)
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure axios for AssemblyAI API
const assemblyAI = axios.create({
    baseURL: 'https://api.assemblyai.com/v2',
    headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
    }
});

// Endpoint to receive audio chunks
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const { sessionId, chunkDuration, chunkIndex } = req.body;
        const audioBuffer = req.file.buffer;        
        console.log('Audio buffer size:', audioBuffer.length);

        // Validate session
        if (!sessionId) {
            return res.status(400).json({ error: 'Missing sessionId' });
        }

        // Initialize session if it doesn't exist
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                id: sessionId,
                chunks: [],
                transcription: [],
                processingStart: Date.now(),
                totalAudioSeconds: 0,
                billing: {
                    processedSeconds: 0,
                    estimatedCost: 0
                },
                // For AssemblyAI - track upload URLs and transcript IDs
                assemblyAI: {
                    uploadUrls: [],
                    transcriptIds: []
                }
            });
        }

        const session = sessions.get(sessionId);

        // Update session with new chunk data
        const chunkMetadata = {
            index: parseInt(chunkIndex),
            duration: parseFloat(chunkDuration),
            buffer: audioBuffer,
            timestamp: Date.now()
        };

        session.chunks.push(chunkMetadata);
        session.totalAudioSeconds += chunkMetadata.duration;

        // Process audio chunk with AssemblyAI
        // const transcription = '';
        const transcription = await transcribeWithAssemblyAI(audioBuffer, session);

        // Update billing information
        updateBillingInfo(session, chunkMetadata.duration);

        // Send response back to client
        res.json({
            success: true,
            transcription: transcription,
            usage: {
                processedSeconds: session.billing.processedSeconds,
                estimatedCost: session.billing.estimatedCost
            }
        });

        // Log for monitoring
        console.log(`Processed chunk ${chunkIndex} for session ${sessionId}, duration: ${chunkDuration}s`);

    } catch (error) {
        console.error('Error processing audio chunk:', error);
        res.status(500).json({ error: 'Failed to process audio chunk' });
    }
});

// Endpoint to test the server
app.get('/api/test', (req, res) => {
    res.json({ message: 'Transcription server is running!' });
});

// Endpoint to signal completion of recording
app.post('/api/transcribe/complete', async (req, res) => {
    try {
        const { sessionId, totalDuration } = req.body;

        if (!sessions.has(sessionId)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = sessions.get(sessionId);

        // Wait for any pending transcriptions to complete
        await waitForPendingTranscriptions(session);

        // Finalize the session
        const fullTranscription = session.transcription.join(' ');
        const processingTime = (Date.now() - session.processingStart) / 1000; // in seconds

        // Prepare final response
        const response = {
            sessionId,
            fullTranscription,
            audioStats: {
                durationSeconds: session.totalAudioSeconds,
                chunks: session.chunks.length
            },
            processingStats: {
                timeSeconds: processingTime,
                averageProcessingRatio: processingTime / session.totalAudioSeconds
            },
            billing: {
                processedSeconds: session.billing.processedSeconds,
                estimatedCost: session.billing.estimatedCost
            }
        };

        // Store session data for later reference (in production, save to database)
        storeSessionData(session, fullTranscription);

        // Schedule session cleanup
        setTimeout(() => {
            if (sessions.has(sessionId)) {
                sessions.delete(sessionId);
                console.log(`Session ${sessionId} cleaned up after completion`);
            }
        }, 3600000); // Clean up after 1 hour

        res.json(response);

    } catch (error) {
        console.error('Error completing transcription session:', error);
        res.status(500).json({ error: 'Failed to complete transcription session' });
    }
});

// Function to transcribe audio with AssemblyAI
async function transcribeWithAssemblyAI(audioBuffer, session) {
    try {
        // Step 1: Upload the audio file to AssemblyAI
        const uploadResponse = await assemblyAI.post('/upload', audioBuffer, {
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        });
        console.log('Upload response:', uploadResponse.data);

        const uploadUrl = uploadResponse.data.upload_url;
        session.assemblyAI.uploadUrls.push(uploadUrl);

        // Step 2: Start transcription with the uploaded audio URL
        const transcriptResponse = await assemblyAI.post('/transcript', {
            audio_url: uploadUrl,
            language_code: 'en_us',
            punctuate: true,
            format_text: true
        });
        console.log('Transcription response:', transcriptResponse.data);

        const transcriptId = transcriptResponse.data.id;
        session.assemblyAI.transcriptIds.push(transcriptId);

        // Step 3: Poll for transcription completion
        let transcription = '';
        let status = 'processing';

        // Use a reasonable timeout (20 seconds for a small chunk)
        const maxRetries = 20;
        let retries = 0;

        while (status === 'processing' && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between polls

            const checkResponse = await assemblyAI.get(`/transcript/${transcriptId}`);
            console.log('Check response:', checkResponse.data);
            status = checkResponse.data.status;

            if (status === 'completed') {
                transcription = checkResponse.data.text || '';
                if (transcription.trim()) {
                    session.transcription.push(transcription);
                }
                break;
            }

            retries++;
        }

        return transcription;

    } catch (error) {
        console.error('AssemblyAI transcription error:', error.response?.data || error.message);
        return ''; // Return empty string on error
    }
}

// Wait for any pending transcriptions to complete
async function waitForPendingTranscriptions(session) {
    if (!session.assemblyAI || !session.assemblyAI.transcriptIds || session.assemblyAI.transcriptIds.length === 0) {
        return;
    }

    // Check the last few transcripts that might still be processing
    const pendingIds = session.assemblyAI.transcriptIds.slice(-3); // Check the last 3 at most

    for (const transcriptId of pendingIds) {
        try {
            const checkResponse = await assemblyAI.get(`/transcript/${transcriptId}`);
            const status = checkResponse.data.status;

            if (status === 'completed' && checkResponse.data.text) {
                // Check if this transcription is already in our array to avoid duplicates
                const existingIndex = session.transcription.findIndex(t =>
                    t.includes(checkResponse.data.text) || checkResponse.data.text.includes(t));

                if (existingIndex === -1) {
                    session.transcription.push(checkResponse.data.text);
                }
            }
        } catch (error) {
            console.error('Error checking transcript status:', error);
        }
    }
}

// Update billing information based on processed audio
function updateBillingInfo(session, chunkDuration) {
    // Update processed seconds
    session.billing.processedSeconds += chunkDuration;

    // Calculate cost (example rate for AssemblyAI: $0.005 per second)
    const RATE_PER_SECOND = 0.005;
    session.billing.estimatedCost = session.billing.processedSeconds * RATE_PER_SECOND;
}

// Store session data for analytics and billing
function storeSessionData(session, fullTranscription) {
    // In production, store in database
    // This is a simplified example using the filesystem
    const sessionData = {
        id: session.id,
        startTime: new Date(session.processingStart).toISOString(),
        endTime: new Date().toISOString(),
        totalAudioSeconds: session.totalAudioSeconds,
        chunkCount: session.chunks.length,
        transcriptionLength: fullTranscription.length,
        billing: session.billing
    };

    // Store metadata (not audio content)
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(logDir, `session-${session.id}.json`),
        JSON.stringify(sessionData, null, 2)
    );

    console.log(`Session ${session.id} data stored for billing and analytics`);
}

// Start server
app.listen(PORT, () => {
    console.log(`Transcription server running on port ${PORT}`);
    console.log(`AssemblyAI API integration active`);
}).on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});