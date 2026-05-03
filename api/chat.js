// api/chat.js — Vercel Serverless Function (CommonJS)
// Secure proxy: GEMINI_API_KEY never exposed to frontend

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables' });

  try {
    const { messages, systemPrompt } = req.body;
    const geminiContents = [];

    if (systemPrompt) {
      geminiContents.push({ role: 'user', parts: [{ text: '[SYSTEM CONTEXT]\n\n' + systemPrompt }] });
      geminiContents.push({ role: 'model', parts: [{ text: 'Understood. Jai Radhe 🙏 Ready to help.' }] });
    }

    if (messages && Array.isArray(messages)) {
      messages.forEach(function(m) {
        geminiContents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });
    }

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: 'Gemini API error', detail: errText });
    }

    const data = await geminiRes.json();
    const text = data && data.candidates && data.candidates[0] &&
                 data.candidates[0].content && data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text
                 ? data.candidates[0].content.parts[0].text
                 : 'Jai Radhe 🙏 No response received.';

    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
