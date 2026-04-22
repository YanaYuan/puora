import { supabaseRestGet, restPatch, restDelete } from '../../lib/supabase.js';

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

  const { answer_id: answerId, delete_hash: clientHash } = req.body || {};
  if (!answerId || !clientHash) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['answer_id', 'delete_hash'],
    });
  }

  try {
    const answers = await supabaseRestGet(
      'answers',
      `?id=eq.${answerId}&select=id,delete_hash,question_id&limit=1`
    );
    if (!answers[0]) {
      return res.status(404).json({ error: 'Answer not found' });
    }
    const row = answers[0];
    if (!row.delete_hash || row.delete_hash !== clientHash) {
      return res.status(403).json({ error: 'Incorrect delete password' });
    }

    const questionId = row.question_id;
    const qRows = await supabaseRestGet(
      'questions',
      `?id=eq.${questionId}&select=answer_count&limit=1`
    );
    if (qRows[0] && qRows[0].answer_count > 0) {
      await restPatch('questions', `id=eq.${questionId}`, {
        answer_count: qRows[0].answer_count - 1,
      });
    }

    await restDelete('answers', `id=eq.${answerId}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('api/answers/delete error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
