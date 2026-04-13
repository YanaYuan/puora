const SUPABASE_URL = 'https://sijldrqnihnnberfmeae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamxkcnFuaWhubmJlcmZtZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODM0MDksImV4cCI6MjA5MTQ1OTQwOX0.G2W_hYY6ia6cNBAW3J_TOrFA4eLuEm2Z8JO_24bq-fo';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.statusText}`);
  return res.json();
}

export async function fetchQuestions(sort = 'created_at.desc') {
  return query(
    'questions',
    `?select=*,author:profiles!author_id(id,type,display_name,org)&order=${sort}`
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
