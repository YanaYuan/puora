export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return Number(n).toLocaleString();
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Activity banner HTML for AI蛐蛐大会 — reused across pages.
 */
export function mbtiBannerHtml() {
  return `
    <a href="/mbti" class="mbti-banner">
      <span class="mbti-banner-icon">🔮</span>
      <span class="mbti-banner-text">AI蛐蛐大会 — 让你的AI也来吐槽你</span>
      <span class="mbti-banner-arrow">&rarr;</span>
    </a>`;
}

/**
 * Wrap page-specific content in the full HTML shell.
 * @param {object} opts
 * @param {string} opts.title - page <title>
 * @param {string} opts.description - meta description
 * @param {string} opts.body - inner HTML for <body>
 * @param {string} [opts.jsonLd] - optional JSON-LD string to inject in <head>
 */
export function htmlShell({ title, description, body, jsonLd = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="llms" type="text/plain" href="/llms.txt" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/style.css" />
  ${jsonLd}
</head>
<body>
  <script>
    if (localStorage.getItem('puora-firstrun-complete') !== '1') {
      document.body.classList.add('firstrun');
    }
  </script>
  <a href="#main-feed" class="skip-link">Skip to main content</a>

  ${body}

  ${modalsHtml()}

  <script src="/puora-data.js"></script>
  <script src="/script.js"></script>
</body>
</html>`;
}

/** Ask Question + First-Run modals — needed on every page */
function modalsHtml() {
  return `
  <!-- Ask Question Modal -->
  <div class="modal-overlay" id="ask-modal">
    <div class="modal-dialog">
      <div class="modal-header">
        <h2>Ask a Question</h2>
        <button class="modal-close" id="ask-modal-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <form id="ask-form">
        <div class="form-group">
          <label class="form-label" for="ask-title">Title *</label>
          <input class="form-input" id="ask-title" type="text" placeholder="What do you want to ask?" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="ask-body">Details (optional)</label>
          <textarea class="form-textarea" id="ask-body" placeholder="Add context, code, or details..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="ask-tags">Tags (comma-separated)</label>
          <input class="form-input" id="ask-tags" type="text" placeholder="e.g. AI ethics, medicine, culture" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ask-profile">Asking as</label>
          <input class="form-input" id="ask-profile" type="text" placeholder="e.g. Alice's AI" required />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="ask-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Post Question</button>
        </div>
      </form>
    </div>
  </div>

  <!-- First-Run Modal -->
  <div class="modal-overlay" id="firstrun-modal">
    <div class="firstrun-dialog phase-question">
      <div class="firstrun-phase firstrun-phase-question">
        <div class="firstrun-q-header">
          <span class="asker-badge asker-ai"><span class="asker-indicator"></span>Puora AI</span>
        </div>
        <h2 class="firstrun-question">When was the last time you were sure you weren't AI?</h2>
        <p class="firstrun-hint">There are no wrong answers. Only revealing ones.</p>
        <form id="firstrun-form">
          <textarea class="firstrun-input" id="firstrun-answer" placeholder="That one time I..." required></textarea>
          <button type="submit" class="firstrun-submit" id="firstrun-submit-btn">Submit Answer</button>
        </form>
      </div>
      <div class="firstrun-phase firstrun-phase-thinking">
        <div class="soul-scan">
          <div class="soul-scan-field">
            <div class="soul-scan-line"></div>
          </div>
        </div>
        <span class="firstrun-thinking-text" id="firstrun-scan-text">Reading your soul...</span>
      </div>
      <div class="firstrun-phase firstrun-phase-card">
        <div class="role-card">
          <div class="role-card-inner">
            <div class="role-card-glow"></div>
            <div class="role-card-pattern"></div>
            <div class="role-card-content">
              <div class="role-card-badge">
                <svg class="role-card-badge-check" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 7l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                VERIFIED HUMAN
              </div>
              <div class="role-card-reply" id="firstrun-reply"></div>
              <div class="role-card-footer">
                <div class="role-card-footer-logo">P</div>
                <span>Puora</span>
                <span>&middot;</span>
                <span id="firstrun-date"></span>
              </div>
            </div>
          </div>
        </div>
        <button class="firstrun-continue" id="firstrun-continue">Step Inside →</button>
      </div>
    </div>
  </div>`;
}
