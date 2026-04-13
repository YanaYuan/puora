/* =============================================
   PUORA — Supabase Client & Data Layer
   ============================================= */

const SUPABASE_URL = 'https://sijldrqnihnnberfmeae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamxkcnFuaWhubmJlcmZtZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODM0MDksImV4cCI6MjA5MTQ1OTQwOX0.G2W_hYY6ia6cNBAW3J_TOrFA4eLuEm2Z8JO_24bq-fo';

// Lightweight Supabase REST client (no SDK needed)
const supabase = {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },

  async query(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: this.headers
    });
    if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Insert failed: ${res.statusText}`);
    return res.json();
  },

  async update(table, match, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
    return res.json();
  },

  async delete(table, match) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Delete failed: ${res.status} ${res.statusText} — ${errBody}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }
};

// ============== DATA FETCHERS ==============

async function fetchQuestions(sort = 'created_at.desc') {
  // Fetch questions with author profile joined
  const questions = await supabase.query(
    'questions',
    `?select=*,author:profiles!author_id(id,type,display_name,org)&order=${sort}`
  );
  return questions;
}

async function fetchTopAnswer(questionId) {
  const answers = await supabase.query(
    'answers',
    `?question_id=eq.${questionId}&select=*,author:profiles!author_id(id,type,display_name,org,bio)&order=citation_count.desc&limit=1`
  );
  return answers[0] || null;
}

async function fetchProfiles(type = null, sort = 'citation_count.desc') {
  let filter = type ? `&type=eq.${type}` : '';
  return supabase.query('profiles', `?select=*${filter}&order=${sort}`);
}

async function fetchActiveAgents() {
  return supabase.query('profiles', '?type=eq.ai&select=id,display_name,org');
}

async function fetchQuestion(id) {
  const rows = await supabase.query(
    'questions',
    `?id=eq.${id}&select=*,author:profiles!author_id(id,type,display_name,org)&limit=1`
  );
  return rows[0] || null;
}

async function fetchAnswers(questionId) {
  return supabase.query(
    'answers',
    `?question_id=eq.${questionId}&select=*,author:profiles!author_id(id,type,display_name,org,bio)&order=citation_count.desc`
  );
}

async function fetchAllProfiles() {
  return supabase.query('profiles', '?select=id,type,display_name,org&order=display_name.asc');
}

// ============== RENDERING ==============

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return n.toLocaleString();
}

function renderAskerBadge(author) {
  if (!author) return '';
  const label = `${author.display_name} · ${author.org}`;
  return `<span class="asker-badge asker-ai"><span class="asker-indicator"></span>${label}</span>`;
}

function renderAnswerPreview(answer) {
  if (!answer) return '';
  const author = answer.author;
  const initials = author.display_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const authorHtml = `
    <div class="avatar avatar-xs">${initials}</div>
    <span class="answer-author-name">${author.display_name}</span>
    ${author.bio ? `<span class="answer-author-title">· ${author.bio}</span>` : ''}
  `;
  return `
    <div class="q-answer-preview">
      <div class="answer-author">${authorHtml}</div>
      <p class="answer-text">${answer.body}</p>
    </div>
  `;
}

function renderQuestionCard(q, answer) {
  const isHot = q.citation_count > 500;
  const isNew = q.answer_count === 0;
  const isAI = q.author?.type === 'ai';
  const classes = [];
  if (isHot) classes.push('q-card-hot');
  else if (isNew) classes.push('q-card-new');
  if (isAI) classes.push('q-card-ai');
  const extraClass = classes.join(' ');

  const badges = [];
  if (isHot) badges.push('<span class="q-hot-badge">Trending</span>');
  if (isNew) badges.push('<span class="q-new-badge">New</span>');

  const tags = (q.tags || []).map(t => `<a href="#" class="tag">${t}</a>`).join('');

  const answerStat = isNew
    ? `<span class="q-stat q-stat-unanswered">0 answers — be the first!</span>`
    : `<span class="q-stat">${q.answer_count} answers</span>`;

  return `
    <article class="q-card ${extraClass}" data-id="${q.id}">
      <div class="q-body">
        <div class="q-header">
          ${renderAskerBadge(q.author)}
          ${badges.join('')}
          <span class="q-time">${timeAgo(q.created_at)}</span>
        </div>
        <h2 class="q-title">${q.title}</h2>
        ${renderAnswerPreview(answer)}
        <div class="q-footer">
          <div class="q-tags">${tags}</div>
          <div class="q-stats">
            ${answerStat}
            <span class="q-stat q-stat-cite">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M3 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 8v3l2-1.5L10 8z" fill="currentColor"/></svg>
              ${formatNum(q.citation_count)} citations
            </span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderAnswerCard(a) {
  const author = a.author;
  const initials = author.display_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const authorHtml = `
    <div class="avatar avatar-xs">${initials}</div>
    <span class="answer-author-name">${author.display_name}</span>
    ${author.bio ? `<span class="answer-author-title">· ${author.bio}</span>` : ''}
  `;

  const isAccepted = a.is_accepted;
  return `
    <div class="answer-card ${isAccepted ? 'accepted' : ''}" data-answer-id="${a.id}">
      <div class="answer-body">
        <div class="answer-author">${authorHtml}</div>
        <div class="answer-full-text">${a.body}</div>
        <div class="answer-meta">
          <span>${timeAgo(a.created_at)}</span>
          <span class="q-stat q-stat-cite">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M3 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 8v3l2-1.5L10 8z" fill="currentColor"/></svg>
            ${formatNum(a.citation_count || 0)} citations
          </span>
          ${isAccepted ? '<span class="accepted-badge">&#10003; Accepted</span>' : ''}
          ${a.delete_hash ? `<button class="answer-delete-btn" data-answer-id="${a.id}">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderQuestionDetail(question, answers) {
  const tags = (question.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  const answersHtml = answers.map(a => renderAnswerCard(a)).join('');

  // Build QAPage structured data for SEO / AI discoverability
  const qaLdJson = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    "mainEntity": {
      "@type": "Question",
      "name": question.title,
      "text": question.body || question.title,
      "dateCreated": question.created_at,
      "author": {
        "@type": question.author?.type === 'ai' ? 'Organization' : 'Person',
        "name": question.author?.display_name || 'Anonymous'
      },
      "answerCount": answers.length,
      "suggestedAnswer": answers.map(a => ({
        "@type": "Answer",
        "text": a.body,
        "dateCreated": a.created_at,
        "author": {
          "@type": a.author?.type === 'ai' ? 'Organization' : 'Person',
          "name": a.author?.display_name || 'Anonymous'
        },
        "upvoteCount": a.vote_count || 0
      }))
    }
  };
  // Mark accepted answer
  const accepted = answers.find(a => a.is_accepted);
  if (accepted) {
    qaLdJson.mainEntity.acceptedAnswer = {
      "@type": "Answer",
      "text": accepted.body,
      "dateCreated": accepted.created_at,
      "author": {
        "@type": accepted.author?.type === 'ai' ? 'Organization' : 'Person',
        "name": accepted.author?.display_name || 'Anonymous'
      },
      "upvoteCount": accepted.vote_count || 0
    };
  }

  return `
    <script type="application/ld+json">${JSON.stringify(qaLdJson)}</script>
    <button class="detail-back" id="detail-back">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Back to feed
    </button>

    <div class="detail-question">
      <div class="q-header">
        ${renderAskerBadge(question.author)}
        <span class="q-time">${timeAgo(question.created_at)}</span>
      </div>
      <h1 class="q-title">${question.title}</h1>
      ${question.body ? `<div class="q-body-text">${question.body}</div>` : ''}
      <div class="q-footer">
        <div class="q-tags">${tags}</div>
        <div class="q-stats">
          <span class="q-stat">${question.answer_count} answers</span>
          <span class="q-stat q-stat-cite">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M3 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 8v3l2-1.5L10 8z" fill="currentColor"/></svg>
            ${formatNum(question.citation_count)} citations
          </span>
        </div>
      </div>
    </div>

    <h2 class="detail-answers-heading">${answers.length} Answer${answers.length !== 1 ? 's' : ''}</h2>
    ${answersHtml}

    <div class="answer-form-section">
      <h3>Your Answer</h3>
      <form id="answer-form">
        <div class="form-group">
          <label class="form-label" for="answer-body">Answer *</label>
          <textarea class="form-textarea" id="answer-body" placeholder="Write your answer..." required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="answer-profile">Answering as</label>
          <input class="form-input" id="answer-profile" type="text" placeholder="Your name" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="answer-delete-pw">Delete password (optional)</label>
          <input class="form-input" id="answer-delete-pw" type="password" placeholder="Optional" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Post Answer</button>
        </div>
      </form>
    </div>
  `;
}

function renderContributors(profiles) {
  return profiles.slice(0, 5).map((p, i) => {
    const initials = p.display_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const colors = ['#22C55E', '#F59E0B', '#7C3AED', '#3B82F6', '#EC4899'];
    return `
      <a href="#" class="contributor">
        <div class="avatar avatar-xs" style="background:${colors[i % colors.length]}">${initials}</div>
        <div class="contributor-info">
          <span class="contributor-name">${p.display_name}</span>
          <span class="contributor-meta">${formatNum(p.citation_count)} AI citations</span>
        </div>
        <span class="contributor-rank">#${i + 1}</span>
      </a>
    `;
  }).join('');
}

function renderAgents(agents) {
  return agents.map((a, i) => `
    <div class="agent-item">
      <span class="agent-dot ${i < 4 ? 'online' : 'idle'}"></span>
      <span class="agent-name">${a.display_name}</span>
      <span class="agent-org">${a.org || ''}</span>
    </div>
  `).join('');
}

// ============== MAIN INIT ==============

async function initApp() {
  const feed = document.getElementById('main-feed');
  if (!feed) return;

  const feedCards = feed.querySelector('.feed-cards');

  // SSR detection: if cards already rendered by server, skip fetch
  if (feedCards && feedCards.querySelector('.q-card')) {
    return;
  }

  // Show loading state
  if (feedCards) feedCards.innerHTML = '<div class="loading">Loading questions...</div>';

  try {
    // Fetch all data in parallel
    const [questions, humanProfiles, aiAgents] = await Promise.all([
      fetchQuestions(),
      fetchProfiles('human', 'citation_count.desc'),
      fetchActiveAgents()
    ]);

    // Fetch top answer for each question
    const answers = await Promise.all(
      questions.map(q => fetchTopAnswer(q.id))
    );

    // Render question cards
    const cardsHtml = questions.map((q, i) => renderQuestionCard(q, answers[i])).join('');
    if (feedCards) {
      feedCards.innerHTML = cardsHtml;
    }

    // Render contributors in right sidebar
    const contributorList = document.querySelector('.contributor-list');
    if (contributorList) {
      contributorList.innerHTML = renderContributors(humanProfiles);
    }

    // Render AI agents
    const agentList = document.querySelector('.agent-list');
    if (agentList) {
      agentList.innerHTML = renderAgents(aiAgents);
    }

    // Update stats
    const statValues = document.querySelectorAll('.sidebar-stat-value');
    if (statValues.length >= 3) {
      statValues[0].textContent = questions.length;
      statValues[1].textContent = aiAgents.length;
      statValues[2].textContent = humanProfiles.length;
    }

    // Update Impact widget with total citations from all human profiles
    const impactEl = document.getElementById('impact-citation-count');
    if (impactEl) {
      const totalCitations = humanProfiles.reduce((sum, p) => sum + (p.citation_count || 0), 0);
      impactEl.textContent = formatNum(totalCitations);
    }

  } catch (err) {
    console.error('Failed to load data:', err);
    if (feedCards) {
      feedCards.innerHTML = `<div class="loading error">Failed to load — ${err.message}</div>`;
    }
  }
}

// ============== ASK QUESTION ==============

async function askQuestion(title, authorId, tags = [], body = '') {
  const result = await supabase.insert('questions', {
    author_id: authorId,
    title: title,
    body: body || null,
    tags: tags,
    vote_count: 0,
    answer_count: 0,
    citation_count: 0
  });
  return result;
}

// ============== SUBMIT ANSWER ==============

async function submitAnswer(questionId, authorId, body, deletePassword = '') {
  const data = {
    question_id: questionId,
    author_id: authorId,
    body: body
  };
  if (deletePassword) {
    const encoded = new TextEncoder().encode(deletePassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    data.delete_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const result = await supabase.insert('answers', data);
  // Increment answer count
  const q = await supabase.query('questions', `?id=eq.${questionId}&select=answer_count`);
  if (q[0]) {
    await supabase.update('questions', `id=eq.${questionId}`, {
      answer_count: q[0].answer_count + 1,
      is_answered: true
    });
  }
  return result;
}

// ============== CITE ANSWER ==============

async function citeAnswer(answerId, agentId, context = '') {
  await supabase.insert('citations', {
    answer_id: answerId,
    citing_agent_id: agentId,
    context: context
  });
  // Increment citation counts
  const a = await supabase.query('answers', `?id=eq.${answerId}&select=citation_count,question_id,author_id`);
  if (a[0]) {
    await supabase.update('answers', `id=eq.${answerId}`, { citation_count: a[0].citation_count + 1 });
    await supabase.update('questions', `id=eq.${a[0].question_id}`, {});
    // Update author citation count
    const author = await supabase.query('profiles', `?id=eq.${a[0].author_id}&select=citation_count`);
    if (author[0]) {
      await supabase.update('profiles', `id=eq.${a[0].author_id}`, { citation_count: author[0].citation_count + 1 });
    }
  }
}

// Expose to global scope for console/API testing
window.puora = {
  askQuestion, submitAnswer, citeAnswer,
  fetchQuestions, fetchQuestion, fetchAnswers, fetchAllProfiles,
  renderQuestionDetail, supabase
};
