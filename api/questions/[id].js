import { fetchQuestion, fetchAnswers } from '../../lib/supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing question id' });
  }

  try {
    const [question, answers] = await Promise.all([fetchQuestion(id), fetchAnswers(id)]);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    return res.status(200).json({ question, answers });
  } catch (err) {
    console.error('api/questions/[id] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
