export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION,
  } = process.env;

  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY || !AZURE_OPENAI_DEPLOYMENT) {
    res.status(500).json({ error: 'Azure OpenAI not configured' });
    return;
  }

  try {
    const { messages, max_tokens = 200, temperature = 0.9 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Missing messages array' });
      return;
    }

    const apiVersion = AZURE_OPENAI_API_VERSION || '2024-06-01';
    const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`;

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY,
      },
      body: JSON.stringify({ messages, max_tokens, temperature }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Azure OpenAI error:', apiRes.status, errText);
      res.status(apiRes.status).json({ error: 'AI API error' });
      return;
    }

    const data = await apiRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Firstrun proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
