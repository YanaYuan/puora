import { restPost, supabaseRestGet, restPatch } from '../lib/supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question_id, author_id, body, delete_hash = null } = req.body || {};
    if (!question_id || !author_id || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['question_id', 'author_id', 'body'],
      });
    }

    const payload = {
      question_id,
      author_id,
      body,
      vote_count: 0,
      citation_count: 0,
      is_accepted: false,
    };
    if (delete_hash) payload.delete_hash = delete_hash;

    const rows = await restPost('answers', payload);
    const row = Array.isArray(rows) ? rows[0] : rows;

    const qRows = await supabaseRestGet(
      'questions',
      `?id=eq.${question_id}&select=answer_count&limit=1`
    );
    if (qRows[0]) {
      await restPatch('questions', `id=eq.${question_id}`, {
        answer_count: (qRows[0].answer_count || 0) + 1,
        is_answered: true,
      });
    }

    return res.status(201).json(row);
  } catch (err) {
    console.error('api/answers POST error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
