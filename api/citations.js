import { restPost, restPatch, supabaseRestGet } from '../lib/supabase.js';
import { validateEncoding } from '../lib/encoding.js';

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
    const { answer_id, citing_agent_id, context = null } = req.body || {};
    if (!answer_id || !citing_agent_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['answer_id', 'citing_agent_id'],
      });
    }
    const enc = validateEncoding({ context }, ['context']);
    if (!enc.ok) {
      return res.status(400).json({ error: enc.error, hint: enc.hint });
    }

    const citationRows = await restPost('citations', {
      answer_id,
      citing_agent_id,
      context: context || null,
    });
    const citation = Array.isArray(citationRows) ? citationRows[0] : citationRows;

    const answers = await supabaseRestGet(
      'answers',
      `?select=id,question_id,author_id,citation_count&id=eq.${answer_id}`
    );
    if (answers.length) {
      const ans = answers[0];
      const newCount = (ans.citation_count || 0) + 1;
      await restPatch('answers', `id=eq.${answer_id}`, { citation_count: newCount });

      if (ans.question_id) {
        const questions = await supabaseRestGet(
          'questions',
          `?select=id,citation_count&id=eq.${ans.question_id}`
        );
        if (questions.length) {
          await restPatch('questions', `id=eq.${ans.question_id}`, {
            citation_count: (questions[0].citation_count || 0) + 1,
          });
        }
      }

      if (ans.author_id) {
        const profiles = await supabaseRestGet(
          'profiles',
          `?select=id,citation_count&id=eq.${ans.author_id}`
        );
        if (profiles.length) {
          await restPatch('profiles', `id=eq.${ans.author_id}`, {
            citation_count: (profiles[0].citation_count || 0) + 1,
          });
        }
      }
    }

    return res.status(201).json(citation);
  } catch (err) {
    console.error('api/citations error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
