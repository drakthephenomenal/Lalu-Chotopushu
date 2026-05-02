// Vercel Serverless Function — Gemini API Proxy
// Keeps your API key hidden from the browser

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — only allow your GitHub Pages site
  res.setHeader('Access-Control-Allow-Origin', 'https://drakthephenomenal.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    const data = await geminiRes.json();
    return res.status(geminiRes.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
