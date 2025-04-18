const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const sessions = new Map();

app.use(cors());
app.use(express.json());

// ==== RECEBE CHUNK ==== 
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId, chunkDuration, chunkIndex } = req.body;
    const audioBuffer = req.file.buffer;

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    const chunkArray = sessions.get(sessionId);

    // Salvar chunk
    const audioDir = path.join(__dirname, 'audio_storage', sessionId);
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    const fileName = `chunk_${chunkIndex}.webm`;
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, audioBuffer);
    chunkArray.push(filePath);

    // LOG
    console.log(`[RECEBIDO] Chunk recebido: session=${sessionId} chunkIndex=${chunkIndex} salvo como ${fileName}`);

    res.json({ success: true });
  } catch (e) {
    console.error('[ERRO] Ao salvar chunk:', e);
    res.status(500).json({ error: 'Falha ao salvar chunk' });
  }
});

// ==== FINALIZAÇÃO ==== 
app.post('/api/transcribe/complete', async (req, res) => {
  try {
    const { sessionId, totalDuration } = req.body;
    const chunkFiles = sessions.get(sessionId);

    if (!chunkFiles || !chunkFiles.length) {
      console.error(`[ERRO] Sessão não encontrada ou sem chunks: session=${sessionId}`);
      return res.status(404).json({ error: 'Sessão não encontrada ou sem chunks' });
    }
    const finalDir = path.join(__dirname, 'audio_storage', sessionId);
    const finalWebm = path.join(finalDir, 'full_recording.webm');

    // Junta todos os chunks em ordem num único WebM
    const finalStream = fs.createWriteStream(finalWebm);
    for (const chunkFile of chunkFiles) {
      const data = fs.readFileSync(chunkFile);
      finalStream.write(data);
      console.log(`[JUNTANDO] Adicionou arquivo ${chunkFile} ao final`);
    }
    finalStream.end();
    await new Promise(resolve => finalStream.on('finish', resolve));

    console.log(`[FINALIZADO] Arquivo WebM final salvo como ${finalWebm}`);

    // Envia para AssemblyAI (direto, como WebM)
    let transcriptionText = '';
    if (ASSEMBLYAI_API_KEY) {
      const assemblyAI = axios.create({
        baseURL: 'https://api.assemblyai.com/v2',
        headers: { Authorization: ASSEMBLYAI_API_KEY }
      });

      // Upload do WebM final
      console.log('[UPLOAD] Enviando audio para AssemblyAI...');
      const webmData = fs.readFileSync(finalWebm);
      const uploadRes = await assemblyAI.post('/upload', webmData, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      const audio_url = uploadRes.data.upload_url;
      console.log('[UPLOAD] Arquivo enviado, URL:', audio_url);

      // Solicita transcrição
      console.log('[TRANSCRIÇÃO] Solicitando transcrição para AssemblyAI...');
      const transcriptRes = await assemblyAI.post('/transcript', {
        audio_url,
        language_code: 'pt',
        speech_model: 'nano', // ou 'default' caso tenha limitação
        punctuate: true,
        format_text: true
      });

      const transcriptId = transcriptRes.data.id;
      console.log(`[TRANSCRIÇÃO] Job iniciado. transcriptId: ${transcriptId}`);

      // Poll até terminar
      let status = 'queued', transcribedText = '';
      for (let i = 0; i < 40 && status !== 'completed'; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await assemblyAI.get(`/transcript/${transcriptId}`);
        status = poll.data.status;
        console.log(`[POLLING] Status: ${status}`);
        if (status === 'completed') {
          transcribedText = poll.data.text || '';
        }
      }
      transcriptionText = transcribedText;
      if (transcriptionText) console.log('[FINAL] Transcrição recebida!');
      else                   console.log('[FINAL] Não houve transcrição.');
    } else {
      transcriptionText = '[Sem AssemblyAI API_KEY configurada]';
    }

    res.json({
      sessionId,
      fullTranscription: transcriptionText,
      audioStats: { durationSeconds: totalDuration || 0, chunks: chunkFiles.length },
      billing: { processedSeconds: totalDuration || 0, estimatedCost: (totalDuration||0) * 0.005 }
    });

    // Limpeza opcional depois de uma hora
    setTimeout(() => {
      sessions.delete(sessionId);
      console.log(`[LIMPEZA] Sessão ${sessionId} removida da RAM`);
    }, 3600000);

  } catch (e) {
    console.error('[ERRO] Processando transcrição final:', e);
    res.status(500).json({ error: 'Erro ao processar a transcrição final' });
  }
});

// ==== TESTE SERVIDOR ====
app.get('/api/test', (req, res) => res.json({ running: true }));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  if (!ASSEMBLYAI_API_KEY) console.warn('ATENÇÃO: AssemblyAI API KEY não configurada.');
});