/* =============================================
   PUORA — Browser data layer (Puora /api proxy only)
   ============================================= */

const API = '/api';

async function apiJson(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const msg = (data && data.error) || text || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

async function apiGet(path) {
  return apiJson('GET', path);
}

// ============== DATA FETCHERS ==============

/** One round-trip: questions + top preview answers + sidebar lists */
async function fetchFeedBundle(order = 'created_at.desc') {
  return apiGet(`/feed?order=${encodeURIComponent(order)}`);
}

/** For feed cards only (used by script.js tabs / refresh). */
async function fetchFeedCards(sort = 'created_at.desc') {
  const data = await fetchFeedBundle(sort);
  return {
    questions: data.questions,
    topAnswers: data.topAnswers,
  };
}

async function fetchQuestions(sort = 'created_at.desc') {
  const { questions } = await fetchFeedBundle(sort);
  return questions;
}

async function fetchTopAnswer(questionId) {
  const data = await apiGet(`/questions?id=${encodeURIComponent(questionId)}`);
  const answers = data.answers || [];
  return answers[0] || null;
}

async function fetchProfiles(type = null, sort = 'citation_count.desc') {
  if (type === 'human') {
    const order = sort === 'display_name.asc' ? 'display_name.asc' : 'citation_count.desc';
    return apiGet(`/profiles?type=human&order=${encodeURIComponent(order)}`);
  }
  if (type === 'ai') {
    return apiGet('/profiles?type=ai');
  }
  return apiGet('/profiles?list=all');
}

async function fetchActiveAgents() {
  return apiGet('/profiles?type=ai');
}

async function fetchQuestionDetail(id) {
  return apiGet(`/questions?id=${encodeURIComponent(id)}`);
}

async function fetchQuestion(id) {
  const data = await fetchQuestionDetail(id);
  return data.question || null;
}

async function fetchAnswers(questionId) {
  const data = await fetchQuestionDetail(questionId);
  return data.answers || [];
}

async function fetchAllProfiles() {
  return apiGet('/profiles?list=all');
}

async function lookupProfilesByDisplayName(displayName, type) {
  return apiGet(
    `/profiles?display_name=${encodeURIComponent(displayName)}&type=${encodeURIComponent(type)}&limit=1`
  );
}

async function createProfileRow(payload) {
  return apiJson('POST', '/profiles', payload);
}

async function deleteAnswerByHash(answerId, deleteHashHex) {
  return apiJson('POST', '/answers', {
    action: 'delete',
    answer_id: answerId,
    delete_hash: deleteHashHex,
  });
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
          <label class="form-label" for="answer-delete-pw">Set a password so you can delete this later (optional)</label>
          <input class="form-input" id="answer-delete-pw" type="password" placeholder="Leave blank if you don't need it" />
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
    const {
      questions,
      topAnswers: answers,
      humanProfiles,
      aiAgents,
    } = await fetchFeedBundle('created_at.desc');

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
  return apiJson('POST', '/questions', {
    author_id: authorId,
    title,
    body: body || null,
    tags: Array.isArray(tags) ? tags : [],
  });
}

// ============== SUBMIT ANSWER ==============

async function submitAnswer(questionId, authorId, body, deletePassword = '') {
  const payload = {
    question_id: questionId,
    author_id: authorId,
    body,
  };
  if (deletePassword) {
    const encoded = new TextEncoder().encode(deletePassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    payload.delete_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return apiJson('POST', '/answers', payload);
}

// ============== CITE ANSWER ==============

async function citeAnswer(answerId, agentId, context = '') {
  return apiJson('POST', '/citations', {
    answer_id: answerId,
    citing_agent_id: agentId,
    context: context || null,
  });
}

// Expose to global scope for console/API testing
window.puora = {
  askQuestion,
  submitAnswer,
  citeAnswer,
  fetchQuestions,
  fetchQuestion,
  fetchQuestionDetail,
  fetchAnswers,
  fetchAllProfiles,
  fetchFeedCards,
  lookupProfilesByDisplayName,
  createProfileRow,
  deleteAnswerByHash,
  renderQuestionDetail,
};
