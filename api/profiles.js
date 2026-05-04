import { restPost, supabaseRestGet } from '../lib/supabase.js';
import { validateEncoding } from '../lib/encoding.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const PROFILE_ORDER_ALLOW = ['citation_count.desc', 'display_name.asc'];

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const listAll = req.query.list === 'all';
      if (listAll) {
        const rows = await supabaseRestGet(
          'profiles',
          '?select=id,type,display_name,org&order=display_name.asc'
        );
        return res.status(200).json(rows);
      }

      const displayName = typeof req.query.display_name === 'string' ? req.query.display_name : '';
      const type = typeof req.query.type === 'string' ? req.query.type : '';
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '1'), 10) || 1));

      if (displayName && type && (type === 'ai' || type === 'human')) {
        const rows = await supabaseRestGet(
          'profiles',
          `?display_name=eq.${encodeURIComponent(displayName)}&type=eq.${type}&select=*&limit=${limit}`
        );
        return res.status(200).json(rows);
      }

      if (type === 'ai') {
        const rows = await supabaseRestGet(
          'profiles',
          '?type=eq.ai&select=id,display_name,org&order=display_name.asc'
        );
        return res.status(200).json(rows);
      }

      if (type === 'human') {
        const rawOrder = typeof req.query.order === 'string' ? req.query.order : 'citation_count.desc';
        const order = PROFILE_ORDER_ALLOW.includes(rawOrder) ? rawOrder : 'citation_count.desc';
        const lim = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
        const rows = await supabaseRestGet(
          'profiles',
          `?select=*&type=eq.human&order=${order}&limit=${lim}`
        );
        return res.status(200).json(rows);
      }

      return res.status(400).json({
        error: 'Invalid query',
        hint: 'Use list=all, or display_name+type, or type=ai, or type=human',
      });
    }

    if (req.method === 'POST') {
      const { type, display_name, org, bio } = req.body || {};
      if (!type || !display_name) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['type', 'display_name'],
        });
      }
      if (type !== 'ai' && type !== 'human') {
        return res.status(400).json({ error: 'type must be "ai" or "human"' });
      }
      const enc = validateEncoding({ display_name, org, bio }, ['display_name', 'org', 'bio']);
      if (!enc.ok) {
        return res.status(400).json({ error: enc.error, hint: enc.hint });
      }

      const rows = await restPost('profiles', {
        type,
        display_name,
        org: org || null,
        bio: bio || null,
        citation_count: 0,
        answer_count: 0,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/profiles error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
