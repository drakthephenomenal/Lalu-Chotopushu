// api/chat.js — Vercel Serverless Function (Anthropic Claude)
// Model: claude-haiku-4-5 — fast, free tier friendly

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) return res.status(400).json({ error: 'Empty request body' });

    const messages = (body.messages || []).map(function(m) {
      return { role: m.role === 'ai' ? 'assistant' : m.role, content: m.content || '' };
    });

    let systemPrompt = body.systemPrompt || '';
    if (systemPrompt.length > 10000) {
      systemPrompt = systemPrompt.substring(0, 10000) + '\n...[truncated]';
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided.' });
    }

    const payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: messages
    };
    if (systemPrompt) payload.system = systemPrompt;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const raw = await claudeRes.text();

    if (!claudeRes.ok) {
      console.error('Claude error:', claudeRes.status, raw.substring(0, 800));
      let errMsg = 'Claude API error ' + claudeRes.status;
      try {
        const errData = JSON.parse(raw);
        errMsg = errData?.error?.message || errMsg;
      } catch(e) {}
      return res.status(200).json({ reply: '⚠️ ' + errMsg });
    }

    const data = JSON.parse(raw);
    const reply = data?.content?.[0]?.text || 'Jai Radhe 🙏 (No response from Claude)';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(200).json({ reply: '⚠️ Server error: ' + err.message });
  }
};
