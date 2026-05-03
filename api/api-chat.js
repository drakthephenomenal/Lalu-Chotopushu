// api/chat.js — Vercel Serverless Function

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) return res.status(400).json({ error: 'Empty body' });

    const messages = body.messages || [];
    let systemPrompt = body.systemPrompt || '';

    // Trim system prompt to max 6000 chars to avoid Gemini limits
    if (systemPrompt.length > 6000) {
      systemPrompt = systemPrompt.substring(0, 6000) + '\n...[data truncated]';
    }

    const geminiContents = [];
    if (systemPrompt) {
      geminiContents.push({ role: 'user', parts: [{ text: '[SYSTEM]\n' + systemPrompt }] });
      geminiContents.push({ role: 'model', parts: [{ text: 'Understood. Jai Radhe 🙏' }] });
    }
    messages.forEach(function(m) {
      geminiContents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    });

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

    const raw = await geminiRes.text();
    if (!geminiRes.ok) {
      return res.status(502).json({ error: 'Gemini API error', detail: raw.substring(0, 300) });
    }

    const data = JSON.parse(raw);
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Jai Radhe 🙏 No response.';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
