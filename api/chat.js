// api/chat.js — Vercel Serverless Function (Google Gemini AI)
// Model: gemini-2.0-flash — free tier, 1500 req/day

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) return res.status(400).json({ error: 'Empty request body' });

    const messages = body.messages || [];
    let systemPrompt = body.systemPrompt || '';

    // Trim system prompt
    if (systemPrompt.length > 6000) {
      systemPrompt = systemPrompt.substring(0, 6000) + '\n...[truncated]';
    }

    // Build Gemini contents array
    // messages from frontend already includes the current user message
    const geminiContents = messages.map(function(m) {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      };
    });

    // Gemini requires at least one content entry
    if (geminiContents.length === 0) {
      return res.status(400).json({ error: 'No messages provided.' });
    }

    // Gemini requires conversation to START with user role
    if (geminiContents[0].role === 'model') {
      geminiContents.unshift({ role: 'user', parts: [{ text: '.' }] });
    }

    // Gemini requires alternating user/model roles — fix consecutive same roles
    const fixed = [geminiContents[0]];
    for (let i = 1; i < geminiContents.length; i++) {
      if (geminiContents[i].role === fixed[fixed.length - 1].role) {
        // Merge into previous
        fixed[fixed.length - 1].parts[0].text += '\n' + geminiContents[i].parts[0].text;
      } else {
        fixed.push(geminiContents[i]);
      }
    }

    const MODEL = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const payload = {
      contents: fixed,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7
      }
    };

    if (systemPrompt) {
      payload.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await geminiRes.text();

    if (!geminiRes.ok) {
      console.error('Gemini error:', geminiRes.status, raw.substring(0, 800));
      let errMsg = 'Gemini API error ' + geminiRes.status;
      try {
        const errData = JSON.parse(raw);
        errMsg = errData?.error?.message || errMsg;
      } catch(e) {}
      // Return the real error message so user can see it
      return res.status(200).json({ reply: '⚠️ ' + errMsg });
    }

    const data = JSON.parse(raw);

    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      return res.status(200).json({ reply: 'Jai Radhe 🙏 (Response blocked by safety filter)' });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Jai Radhe 🙏 (No text in Gemini response — finishReason: ' + finishReason + ')';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(200).json({ reply: '⚠️ Server error: ' + err.message });
  }
};
