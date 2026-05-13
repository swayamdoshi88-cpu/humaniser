import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { HUMANIZER_SYSTEM_PROMPT } from './src/lib/humanizer-prompt';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.post('/api/humanize', async (req, res) => {
    try {
      const { text, sample } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      let prompt = `Here is the text to humanize:\n\n${text}`;
      if (sample) {
        prompt = `Here is a sample of the user's natural writing style for voice calibration:\n\n${sample}\n\n${prompt}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: HUMANIZER_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (error) {
      console.error('Error humanizing text:', error);
      res.status(500).json({ error: 'Failed to humanize text' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
