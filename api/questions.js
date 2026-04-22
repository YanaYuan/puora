import { searchQuestionsProxy, restPost, fetchQuestion, fetchAnswers } from '../lib/supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : undefined;
      if (id) {
        const [question, answers] = await Promise.all([fetchQuestion(id), fetchAnswers(id)]);
        if (!question) {
          return res.status(404).json({ error: 'Question not found' });
        }
        return res.status(200).json({ question, answers });
      }

      const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
      const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined;
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'citations';
      const limit = req.query.limit;
      const rows = await searchQuestionsProxy({ tag, keyword, sort, limit });
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { author_id, title, body = null, tags = [] } = req.body || {};
      if (!author_id || !title) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['author_id', 'title'],
        });
      }
      const rows = await restPost('questions', {
        author_id,
        title,
        body: body || null,
        tags: Array.isArray(tags) ? tags : [],
        vote_count: 0,
        answer_count: 0,
        citation_count: 0,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/questions error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
