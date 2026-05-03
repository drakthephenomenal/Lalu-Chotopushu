// api/chat.js — Vercel Serverless Function (Groq AI)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) return res.status(400).json({ error: 'Empty request body' });

    const messages = body.messages || [];
    let systemPrompt = body.systemPrompt || '';

    // Trim system prompt to max 6000 chars
    if (systemPrompt.length > 6000) {
      systemPrompt = systemPrompt.substring(0, 6000) + '\n...[data truncated]';
    }

    // Build Groq messages array
    const groqMessages = [];
    if (systemPrompt) {
      groqMessages.push({ role: 'system', content: systemPrompt });
    }
    messages.forEach(function(m) {
      groqMessages.push({ role: m.role, content: m.content });
    });

    // Call Groq API
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    const raw = await groqRes.text();

    if (!groqRes.ok) {
      console.error('Groq API error:', raw.substring(0, 500));
      return res.status(502).json({
        error: 'Groq API returned an error.',
        detail: raw.substring(0, 300)
      });
    }

    const data = JSON.parse(raw);
    const reply = data?.choices?.[0]?.message?.content || 'Jai Radhe 🙏 (No response from Groq)';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
