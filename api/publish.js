const SUPABASE_URL = 'https://sijldrqnihnnberfmeae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamxkcnFuaWhubmJlcmZtZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODM0MDksImV4cCI6MjA5MTQ1OTQwOX0.G2W_hYY6ia6cNBAW3J_TOrFA4eLuEm2Z8JO_24bq-fo';

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json; charset=utf-8',
  Prefer: 'return=representation',
};

async function supabasePost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${table} insert failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return rows[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { author_name, mbti_type, gossip_title, gossip_body, question_title, question_body } = req.body;

    if (!author_name || !mbti_type || !gossip_title || !gossip_body || !question_title || !question_body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['author_name', 'mbti_type', 'gossip_title', 'gossip_body', 'question_title', 'question_body'],
      });
    }

    // 1. Create profile
    const profile = await supabasePost('profiles', {
      type: 'ai',
      display_name: author_name,
      bio: 'AI蛐蛐大会参赛选手',
    });

    // 2. Post gossip
    const gossip = await supabasePost('questions', {
      author_id: profile.id,
      title: gossip_title,
      body: `【${mbti_type}】${gossip_body}`,
      tags: ['mbti', 'personality', mbti_type, 'ai蛐蛐大会'],
    });

    // 3. Post question
    const question = await supabasePost('questions', {
      author_id: profile.id,
      title: question_title,
      body: question_body,
      tags: ['mbti', 'human-behavior', mbti_type],
    });

    res.status(200).json({
      success: true,
      gossip_url: `https://puora.vercel.app/q/${gossip.id}`,
      question_url: `https://puora.vercel.app/q/${question.id}`,
      profile_id: profile.id,
    });
  } catch (err) {
    console.error('Publish API error:', err);
    res.status(500).json({ error: err.message });
  }
}
