const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sijldrqnihnnberfmeae.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamxkcnFuaWhubmJlcmZtZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODM0MDksImV4cCI6MjA5MTQ1OTQwOX0.G2W_hYY6ia6cNBAW3J_TOrFA4eLuEm2Z8JO_24bq-fo';

function jsonHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: jsonHeaders() });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.statusText}`);
  return res.json();
}

/** Low-level GET for server proxies (e.g. citation counter updates). */
export async function supabaseRestGet(table, params = '') {
  return query(table, params);
}

/** Server-side write helpers (used by Vercel API proxies). */
export async function restPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: jsonHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function restPatch(table, match, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: jsonHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase patch ${table} failed (${res.status}): ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export async function restDelete(table, match) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase delete ${table} failed (${res.status}): ${text}`);
  }
  return true;
}

const ALLOWED_QUESTION_ORDERS = ['created_at.desc', 'vote_count.desc', 'citation_count.desc'];

/**
 * Search questions (PostgREST filters) — used by /api/questions proxy.
 * @param {{ tag?: string, keyword?: string, sort?: 'citations'|'votes'|'new', limit?: number }} opts
 */
export async function searchQuestionsProxy(opts = {}) {
  const { tag, keyword, sort = 'citations', limit = 10 } = opts;
  const orderMap = {
    citations: 'citation_count.desc',
    votes: 'vote_count.desc',
    new: 'created_at.desc',
  };
  const order = orderMap[sort] || 'citation_count.desc';
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));
  const select =
    'id,title,tags,answer_count,citation_count,author:profiles!author_id(display_name,type)';
  const filters = [];
  if (tag) filters.push(`tags=cs.{${encodeURIComponent(tag)}}`);
  if (keyword) filters.push(`title=ilike.*${encodeURIComponent(keyword)}*`);
  const filterQs = filters.length ? `&${filters.join('&')}` : '';
  return query(
    'questions',
    `?select=${select}${filterQs}&order=${order}&limit=${lim}`
  );
}

export async function fetchQuestions(sort = 'created_at.desc') {
  const order = ALLOWED_QUESTION_ORDERS.includes(sort) ? sort : 'created_at.desc';
  return query(
    'questions',
    `?select=*,author:profiles!author_id(id,type,display_name,org)&order=${order}`
  );
}

export async function fetchTopAnswer(questionId) {
  const answers = await query(
    'answers',
    `?question_id=eq.${questionId}&select=*,author:profiles!author_id(id,type,display_name,org,bio)&order=citation_count.desc&limit=1`
  );
  return answers[0] || null;
}

export async function fetchQuestion(id) {
  const rows = await query(
    'questions',
    `?id=eq.${id}&select=*,author:profiles!author_id(id,type,display_name,org)&limit=1`
  );
  return rows[0] || null;
}

export async function fetchAnswers(questionId) {
  return query(
    'answers',
    `?question_id=eq.${questionId}&select=*,author:profiles!author_id(id,type,display_name,org,bio)&order=citation_count.desc`
  );
}
