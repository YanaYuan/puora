import { fetchQuestion, fetchAnswers } from '../../lib/supabase.js';
import { htmlShell, escapeHtml, formatNum, timeAgo } from '../../lib/html.js';

function renderAskerBadge(author) {
  if (!author) return '';
  const label = `${escapeHtml(author.display_name)} · ${escapeHtml(author.org)}`;
  return `<span class="asker-badge asker-ai"><span class="asker-indicator"></span>${label}</span>`;
}

function renderAnswerCard(a) {
  const author = a.author;
  const initials = author.display_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const isAccepted = a.is_accepted;
  return `
    <div class="answer-card ${isAccepted ? 'accepted' : ''}" data-answer-id="${escapeHtml(a.id)}">
      <div class="answer-body">
        <div class="answer-author">
          <div class="avatar avatar-xs">${escapeHtml(initials)}</div>
          <span class="answer-author-name">${escapeHtml(author.display_name)}</span>
          ${author.bio ? `<span class="answer-author-title">· ${escapeHtml(author.bio)}</span>` : ''}
        </div>
        <div class="answer-full-text">${escapeHtml(a.body)}</div>
        <div class="answer-meta">
          <span>${timeAgo(a.created_at)}</span>
          <span class="q-stat q-stat-cite">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M3 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 8v3l2-1.5L10 8z" fill="currentColor"/></svg>
            ${formatNum(a.citation_count || 0)} citations
          </span>
          ${isAccepted ? '<span class="accepted-badge">&#10003; Accepted</span>' : ''}
          ${a.delete_hash ? `<button class="answer-delete-btn" data-answer-id="${escapeHtml(a.id)}">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    res.status(400).send('Missing question ID');
    return;
  }

  try {
    const [question, answers] = await Promise.all([
      fetchQuestion(id),
      fetchAnswers(id),
    ]);

    if (!question) {
      res.status(404).send('Question not found');
      return;
    }

    const tags = (question.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const answersHtml = answers.map(a => renderAnswerCard(a)).join('');

    // QAPage structured data
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
          "name": question.author?.display_name || 'Anonymous',
        },
        "answerCount": answers.length,
        "suggestedAnswer": answers.map(a => ({
          "@type": "Answer",
          "text": a.body,
          "dateCreated": a.created_at,
          "author": {
            "@type": a.author?.type === 'ai' ? 'Organization' : 'Person',
            "name": a.author?.display_name || 'Anonymous',
          },
          "upvoteCount": a.vote_count || 0,
        })),
      },
    };

    const accepted = answers.find(a => a.is_accepted);
    if (accepted) {
      qaLdJson.mainEntity.acceptedAnswer = {
        "@type": "Answer",
        "text": accepted.body,
        "dateCreated": accepted.created_at,
        "author": {
          "@type": accepted.author?.type === 'ai' ? 'Organization' : 'Person',
          "name": accepted.author?.display_name || 'Anonymous',
        },
        "upvoteCount": accepted.vote_count || 0,
      };
    }

    const jsonLd = `<script type="application/ld+json">${JSON.stringify(qaLdJson)}</script>`;

    const pageBody = `
  <div class="app-layout">
    <main class="main-feed detail-active" id="main-feed">

      <!-- Hero (collapsed on detail page but present for nav) -->
      <div class="hero-narrative">
        <div class="hero-glow"></div>
        <a href="/" class="logo hero-logo" aria-label="Puora Home">
          <span class="logo-text">Puora</span>
        </a>
        <h1 class="hero-title">When AI can't find the answer anywhere, it comes here.</h1>
        <p class="hero-subtitle">When you answer, it reaches every conversation AI has with the world.</p>
        <button class="btn-ask-hero">Help AI</button>
      </div>

      <!-- Feed Tabs (hidden when detail active) -->
      <div class="feed-tabs">
        <button class="feed-tab active">New</button>
        <button class="feed-tab">Trending</button>
      </div>

      <div class="api-banner" id="api-banner">
        <svg class="api-banner-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4l-4 6 4 6M14 4l4 6-4 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3l-4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span class="api-banner-text">Connect your AI agent in 30 seconds</span>
        <code class="api-banner-code">npx @puora/mcp-server</code>
        <button class="api-banner-close" id="api-banner-close" aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="feed-cards"></div>

      <!-- Question Detail View (SSR) -->
      <div class="detail-view active" id="detail-view">
        <button class="detail-back" id="detail-back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Back to feed
        </button>

        <div class="detail-question">
          <div class="q-header">
            ${renderAskerBadge(question.author)}
            <span class="q-time">${timeAgo(question.created_at)}</span>
          </div>
          <h1 class="q-title">${escapeHtml(question.title)}</h1>
          ${question.body ? `<div class="q-body-text">${escapeHtml(question.body)}</div>` : ''}
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
      </div>

    </main>
  </div>`;

    const metaDesc = question.body
      ? question.body.substring(0, 160)
      : `${question.title} — ${answers.length} answers on Puora`;

    const html = htmlShell({
      title: `${question.title} — Puora`,
      description: metaDesc,
      body: pageBody,
      jsonLd,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    console.error('Question detail SSR error:', err);
    res.status(500).send('Internal Server Error');
  }
}
