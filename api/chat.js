// api/chat.js — Vercel Serverless Function
// Secure proxy: keeps GEMINI_API_KEY hidden from frontend
// Deployed automatically by Vercel when file is in /api folder

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allow your app's domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured in Vercel environment variables' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    // Build Gemini request format
    // System prompt goes as first user turn with model acknowledgement
    const geminiContents = [];

    // Add system context as first exchange
    if (systemPrompt) {
      geminiContents.push({
        role: 'user',
        parts: [{ text: '[SYSTEM CONTEXT — read carefully before responding]\n\n' + systemPrompt }]
      });
      geminiContents.push({
        role: 'model',
        parts: [{ text: 'Understood. I am Guru-ji AI, fully aware of the app, its data structure, Firebase setup, and the user\'s complete sadhana data. I am ready to help. Jai Radhe 🙏' }]
      });
    }

    // Add conversation history
    if (messages && Array.isArray(messages)) {
      messages.forEach(m => {
        geminiContents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Gemini API error', detail: errText });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Jai Radhe 🙏 No response received.';

    return res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
