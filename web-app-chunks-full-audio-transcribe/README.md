# About

This is an web application that doest the following:

1. Records audio using the users web browser
1. Sends audio in chunks to a web server app
1. The webserver stores each chunk as a separate file
1. When the user stops the audio recording it triggers the transcriptions process
1. The backend combine all the chunks files in one single file and send it to AssemblyAI to be transcribed
1. The audio transcription is then send back to the frontend and printed to the user

# Setup Guide

This guide provides step-by-step instructions to set up both the server-side and client-side components of the audio transcription application using AssemblyAI.

## Server Setup

### Prerequisites
- Node.js (v14.x or later)
- npm (v6.x or later)
- AssemblyAI account and API key

### Install required dependencies
```bash
cd web-app-chunks-full-audio-transcribe
npm install -r requirements.txt
```

### Set up AssemblyAI credentials
1. Create a `.env` file in the server directory with the following content:
   ```
   PORT=5000
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

### Start the server
```bash
node server.js
```

## Client

### Install additional dependencies
```bash
npm install
```

### Configure proxy for development
In the `package.json` file in the client directory, configure the proxy entry to the port where the server is listening:
```json
"proxy": "http://localhost:5000"
```

### Start the React development server
```bash
npm start
```

## AssemblyAI-Specific Information

### Pricing Considerations
- AssemblyAI charges per minute of audio processed (approximately $0.30 per minute)
- The application tracks usage to estimate costs for billing purposes
- In production, implement proper user authentication and rate limiting

### Security Considerations
- The API key should be kept secure and never exposed to the client-side code
- In production, implement proper authentication and authorization
- Consider using environment variables for all sensitive information

## Production Deployment

For production deployment, you'll want to:

1. Build the React app:
```bash
cd client
npm run build
```

2. Configure the server to serve the static build:
Add to server.js:
```javascript
// Serve static files from the React app
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});
```

3. Deploy to your preferred hosting provider (Heroku, AWS, Google Cloud, etc.)

## Notes on Scaling

For production use with multiple users:
- Consider using a database like MongoDB to store session data
- Implement authentication and user accounts
- Use Redis for session caching
- Deploy behind a load balancer for horizontal scaling