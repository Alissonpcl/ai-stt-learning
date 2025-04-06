# Setup Guide for Audio Transcription with AssemblyAI

This guide provides step-by-step instructions to set up both the server-side and client-side components of the audio transcription application using AssemblyAI.

## Server-Side Setup

### Prerequisites
- Node.js (v14.x or later)
- npm (v6.x or later)
- AssemblyAI account and API key

### Step 1: Create a new project directory
```bash
mkdir audio-transcription-app
cd audio-transcription-app
mkdir server
cd server
```

### Step 2: Initialize Node.js project
```bash
npm init -y
```

### Step 3: Install required dependencies
```bash
npm install express multer axios uuid cors dotenv
```

### Step 4: Set up AssemblyAI credentials
1. Create an account at [AssemblyAI](https://www.assemblyai.com/) if you don't have one
2. Navigate to your account dashboard and copy your API key
3. Create a `.env` file in the server directory with the following content:
   ```
   PORT=5000
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

### Step 5: Create server code
Create a file named `server.js` in the server directory and copy the server-side code from the "Server-Side Code Using AssemblyAI" artifact.

### Step 6: Create logs directory
```bash
mkdir logs
```

### Step 7: Start the server
```bash
node server.js
```

## React Client Setup

### Step 1: Create a new React application
Navigate back to the project root directory and create a new React app:
```bash
cd ..
npx create-react-app client
cd client
```

### Step 2: Install additional dependencies
```bash
npm install axios react-icons
```

### Step 3: Configure proxy for development
In the `package.json` file in the client directory, add a proxy to direct API requests to your backend:
```json
"proxy": "http://localhost:5000"
```

### Step 4: Create component files
1. Create the component file:
```bash
mkdir -p src/components
touch src/components/AudioTranscriptionComponent.js
touch src/components/AudioTranscription.css
```

2. Copy the React component code into `AudioTranscriptionComponent.js`
3. Copy the CSS code into `AudioTranscription.css`

### Step 5: Update App.js
Replace the content of `src/App.js` with:
```jsx
import React from 'react';
import AudioTranscriptionComponent from './components/AudioTranscriptionComponent';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Audio Transcription with AssemblyAI</h1>
      </header>
      <main>
        <AudioTranscriptionComponent />
      </main>
      <footer>
        <p>© 2025 Audio Transcription Service</p>
      </footer>
    </div>
  );
}

export default App;
```

### Step 6: Update App.css
Add some basic styling to `src/App.css`:
```css
.App {
  text-align: center;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.App-header {
  margin-bottom: 30px;
}

h1 {
  color: #2c3e50;
}

footer {
  margin-top: 50px;
  padding: 20px;
  color: #7f8c8d;
  font-size: 14px;
}
```

### Step 7: Start the React development server
```bash
npm start
```

## Full-Stack Setup with Concurrently (Optional)

For a better development experience, you can set up concurrent running of both server and client:

### Step 1: Navigate back to the project root
```bash
cd ..
```

### Step 2: Create a package.json in the root directory
```bash
npm init -y
```

### Step 3: Install concurrently
```bash
npm install concurrently
```

### Step 4: Update the package.json scripts
```json
"scripts": {
  "server": "cd server && node server.js",
  "client": "cd client && npm start",
  "dev": "concurrently \"npm run server\" \"npm run client\"",
  "install-all": "npm install && cd server && npm install && cd ../client && npm install"
}
```

### Step 5: Install all dependencies and start development
```bash
npm run install-all
npm run dev
```

## AssemblyAI-Specific Information

### How AssemblyAI works in this application
1. **Audio Chunking**: The application breaks audio into smaller chunks for more efficient processing
2. **Upload Process**: Each chunk is uploaded to AssemblyAI via their `/upload` endpoint
3. **Transcription Request**: After uploading, we request transcription via the `/transcript` endpoint
4. **Polling for Results**: The server polls AssemblyAI for completed transcriptions
5. **Session Management**: All chunks from a session are tracked and combined for the final result

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