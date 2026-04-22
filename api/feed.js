import {
  fetchQuestions,
  fetchTopAnswer,
  supabaseRestGet,
} from '../lib/supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const ALLOWED_ORDER = ['created_at.desc', 'vote_count.desc', 'citation_count.desc'];

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawOrder = typeof req.query.order === 'string' ? req.query.order : 'created_at.desc';
  const order = ALLOWED_ORDER.includes(rawOrder) ? rawOrder : 'created_at.desc';

  try {
    const questions = await fetchQuestions(order);
    const topAnswers = await Promise.all(questions.map((q) => fetchTopAnswer(q.id)));
    const humanProfiles = await supabaseRestGet(
      'profiles',
      '?select=*&type=eq.human&order=citation_count.desc'
    );
    const aiAgents = await supabaseRestGet(
      'profiles',
      '?type=eq.ai&select=id,display_name,org&order=display_name.asc'
    );

    return res.status(200).json({
      questions,
      topAnswers,
      humanProfiles,
      aiAgents,
    });
  } catch (err) {
    console.error('api/feed error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
