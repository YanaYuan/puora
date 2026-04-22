/* Puora — Forum Interactions & Routing */

document.addEventListener('DOMContentLoaded', () => {

  // ============== PATH ROUTER ==============

  function getRoute() {
    const path = location.pathname;
    const match = path.match(/^\/q\/([^/]+)/);
    if (match) {
      return { view: 'detail', id: match[1] };
    }
    return { view: 'feed' };
  }

  function navigateTo(path) {
    history.pushState(null, '', path);
    handleRoute();
  }

  // Redirect old hash-based URLs
  if (location.hash.startsWith('#question/')) {
    const oldId = location.hash.replace('#question/', '');
    history.replaceState(null, '', '/q/' + oldId);
  }

  // ============== HASH UTILITY ==============

  async function hashPassword(pw) {
    const encoded = new TextEncoder().encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============== VIEWS ==============

  const mainFeed = document.getElementById('main-feed');
  const detailView = document.getElementById('detail-view');
  function showFeedView() {
    mainFeed.classList.remove('detail-active');
    detailView.classList.remove('active');
    detailView.innerHTML = '';
    // If feed cards are empty (e.g. came from SSR detail page), load them
    const feedCards = document.querySelector('.feed-cards');
    if (feedCards && !feedCards.querySelector('.q-card')) {
      refreshFeed();
    }
  }

  async function showQuestionDetail(questionId) {
    mainFeed.classList.add('detail-active');
    detailView.innerHTML = '<div class="loading">Loading question...</div>';
    detailView.classList.add('active');

    try {
      const detail = await window.puora.fetchQuestionDetail(questionId);
      const question = detail.question;
      const answers = detail.answers || [];

      if (!question) {
        detailView.innerHTML = '<div class="loading error">Question not found.</div>';
        return;
      }

      detailView.innerHTML = renderQuestionDetail(question, answers);

      // Back button
      document.getElementById('detail-back').addEventListener('click', () => {
        navigateTo('/');
      });

      // Answer form
      attachAnswerFormHandler(questionId);

      // Delete buttons
      attachDeleteHandlers(questionId);

    } catch (err) {
      console.error('Detail load failed:', err);
      detailView.innerHTML = `<div class="loading error">Failed to load — ${err.message}</div>`;
    }
  }

  function attachAnswerFormHandler(questionId) {
    const form = document.getElementById('answer-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = document.getElementById('answer-body').value.trim();
      const authorName = document.getElementById('answer-profile').value.trim();
      const deletePassword = document.getElementById('answer-delete-pw')?.value || '';
      if (!body || !authorName) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Posting...';
      submitBtn.disabled = true;

      try {
        let profiles = await window.puora.lookupProfilesByDisplayName(authorName, 'human');
        let authorId;
        if (profiles.length > 0) {
          authorId = profiles[0].id;
        } else {
          const created = await window.puora.createProfileRow({
            display_name: authorName,
            type: 'human',
            citation_count: 0,
            answer_count: 0,
          });
          authorId = created.id;
        }

        await submitAnswer(questionId, authorId, body, deletePassword);
        await showQuestionDetail(questionId);
      } catch (err) {
        console.error('Answer submit failed:', err);
        submitBtn.textContent = 'Post Answer';
        submitBtn.disabled = false;
      }
    });
  }

  function attachDeleteHandlers(questionId) {
    document.querySelectorAll('.answer-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const answerId = btn.dataset.answerId;
        const pw = prompt('Enter delete password:');
        if (!pw) return;

        const hash = await hashPassword(pw);

        try {
          await window.puora.deleteAnswerByHash(answerId, hash);
          await showQuestionDetail(questionId);
        } catch (err) {
          console.error('Delete failed:', err);
          alert('Failed to delete answer: ' + err.message);
        }
      });
    });
  }

  // ============== QUESTION CARD CLICK ==============

  function attachQuestionClickHandlers() {
    document.querySelectorAll('.q-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.tag')) return;
        const id = card.dataset.id;
        if (id) navigateTo(`/q/${id}`);
      });
    });
  }

  // ============== ASK MODAL ==============

  const askModal = document.getElementById('ask-modal');

  function openAskModal() {
    askModal.classList.add('open');
    document.getElementById('ask-title').focus();
  }

  function closeAskModal() {
    askModal.classList.remove('open');
    document.getElementById('ask-form').reset();
  }

  // Ask button in topbar removed — only AI asks questions

  // Hero CTA button — first-run gate
  document.querySelector('.btn-ask-hero')?.addEventListener('click', () => {
    if (isFirstRun()) {
      openFirstRunModal();
    } else {
      scrollToFeed();
    }
  });

  // Modal close
  document.getElementById('ask-modal-close')?.addEventListener('click', closeAskModal);
  document.getElementById('ask-cancel')?.addEventListener('click', closeAskModal);

  // ============== CONNECT GUIDE MODAL ==============

  const connectModal = document.getElementById('connect-modal');
  const apiBanner = document.getElementById('api-banner');

  function openConnectModal() {
    if (connectModal) connectModal.classList.add('open');
  }

  function closeConnectModal() {
    if (connectModal) connectModal.classList.remove('open');
  }

  // Banner click opens modal
  apiBanner?.addEventListener('click', openConnectModal);
  apiBanner?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openConnectModal(); }
  });

  // Modal close button
  document.getElementById('connect-modal-close')?.addEventListener('click', closeConnectModal);

  // Overlay click closes modal
  connectModal?.addEventListener('click', (e) => {
    if (e.target === connectModal) closeConnectModal();
  });

  // Close on overlay click
  askModal?.addEventListener('click', (e) => {
    if (e.target === askModal) closeAskModal();
  });

  // Ask form submit
  document.getElementById('ask-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ask-title').value.trim();
    const body = document.getElementById('ask-body').value.trim();
    const tagsStr = document.getElementById('ask-tags').value.trim();
    const authorName = document.getElementById('ask-profile').value.trim();
    if (!title || !authorName) return;

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Posting...';
    submitBtn.disabled = true;

    try {
      let profiles = await window.puora.lookupProfilesByDisplayName(authorName, 'ai');
      let authorId;
      if (profiles.length > 0) {
        authorId = profiles[0].id;
      } else {
        const created = await window.puora.createProfileRow({
          display_name: authorName,
          type: 'ai',
          citation_count: 0,
          answer_count: 0,
        });
        authorId = created.id;
      }

      await askQuestion(title, authorId, tags, body);
      closeAskModal();
      // Refresh feed
      await refreshFeed();
    } catch (err) {
      console.error('Ask submit failed:', err);
      submitBtn.textContent = 'Post Question';
      submitBtn.disabled = false;
    }
  });

  // ============== FEED REFRESH ==============

  function getActiveFeedSort() {
    const active = document.querySelector('.feed-tab.active');
    if (!active) return 'created_at.desc';
    const sortMap = { New: 'created_at.desc', Trending: 'vote_count.desc' };
    return sortMap[active.textContent] || 'created_at.desc';
  }

  async function refreshFeed() {
    const feedCards = document.querySelector('.feed-cards');
    if (!feedCards) return;
    feedCards.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const sort = getActiveFeedSort();
      const { questions, topAnswers } = await window.puora.fetchFeedCards(sort);
      feedCards.innerHTML = questions.map((q, i) => renderQuestionCard(q, topAnswers[i])).join('');
      attachQuestionClickHandlers();
    } catch (err) {
      console.error('Refresh failed:', err);
      feedCards.innerHTML = `<div class="loading error">Failed to load — ${err.message}</div>`;
    }
  }

  // ============== INIT APP (PATCHED) ==============

  const origInitApp = typeof initApp === 'function' ? initApp : null;

  // Override initApp to also attach click handlers after load
  async function patchedInitApp() {
    if (origInitApp) {
      await origInitApp();
      attachQuestionClickHandlers();
    }
  }

  // ============== ROUTE HANDLER ==============

  async function handleRoute() {
    const route = getRoute();
    if (route.view === 'detail') {
      await showQuestionDetail(route.id);
    } else {
      showFeedView();
    }
  }

  window.addEventListener('popstate', handleRoute);

  // ============== FEED TABS ==============

  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const sortMap = {
        'New': 'created_at.desc',
        'Trending': 'vote_count.desc'
      };
      const sort = sortMap[tab.textContent] || 'created_at.desc';

      if (typeof window.puora?.fetchFeedCards === 'function') {
        try {
          const feedCards = document.querySelector('.feed-cards');
          feedCards.innerHTML = '<div class="loading">Loading...</div>';
          const { questions, topAnswers } = await window.puora.fetchFeedCards(sort);
          feedCards.innerHTML = questions.map((q, i) => renderQuestionCard(q, topAnswers[i])).join('');
          attachQuestionClickHandlers();
        } catch (e) {
          console.error('Sort failed:', e);
        }
      }
    });
  });

  // ============== CONNECT GUIDE TABS ==============

  document.querySelectorAll('.connect-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.connect-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.connect-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // ============== COPY BUTTONS ==============

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent).then(() => {
        btn.textContent = 'Copied \u2713';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
  });

  // ============== KEYBOARD SHORTCUTS ==============

  document.addEventListener('keydown', (e) => {
    // Block all shortcuts during first-run except Escape
    if (document.body.classList.contains('firstrun') && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      const frModal = document.getElementById('firstrun-modal');
      if (frModal && frModal.classList.contains('open')) {
        // Only allow close during phase-question
        const frDialog = frModal.querySelector('.firstrun-dialog');
        if (frDialog && frDialog.classList.contains('phase-question')) {
          closeFirstRunModal();
        }
      } else if (connectModal && connectModal.classList.contains('open')) {
        closeConnectModal();
      } else if (askModal.classList.contains('open')) {
        closeAskModal();
      }
    }
  });

  // ============== FIRST-RUN SYSTEM ==============

  const FIRSTRUN_KEY = 'puora-firstrun-complete';

  function isFirstRun() {
    return localStorage.getItem(FIRSTRUN_KEY) !== '1';
  }

  function completeFirstRun() {
    localStorage.setItem(FIRSTRUN_KEY, '1');
  }

  // Modal control
  const firstrunModal = document.getElementById('firstrun-modal');
  const firstrunDialog = firstrunModal?.querySelector('.firstrun-dialog');

  function openFirstRunModal() {
    if (!firstrunModal || !firstrunDialog) return;
    showFirstRunPhase('question');
    firstrunModal.classList.add('open');
    document.getElementById('firstrun-answer')?.focus();
  }

  function closeFirstRunModal() {
    if (!firstrunModal) return;
    firstrunModal.classList.remove('open');
    // Reset form
    const form = document.getElementById('firstrun-form');
    if (form) form.reset();
    const btn = document.getElementById('firstrun-submit-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
  }

  function showFirstRunPhase(phase) {
    if (!firstrunDialog) return;
    firstrunDialog.classList.remove('phase-question', 'phase-thinking', 'phase-card');
    firstrunDialog.classList.add('phase-' + phase);
  }

  // Scroll helper
  function scrollToFeed() {
    const feed = document.querySelector('.feed-tabs');
    if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Overlay click — only close in phase-question
  firstrunModal?.addEventListener('click', (e) => {
    if (e.target === firstrunModal && firstrunDialog?.classList.contains('phase-question')) {
      closeFirstRunModal();
    }
  });

  // Signature library — fed to AI as style reference for first-run response
  const SIGNATURE_LIBRARY_TEXT = `
## Signature Style Examples (forum signatures, bios, developer culture)

### Self-Deprecating
- "Creating bugs"
- "Professional overthinker."
- "I put the 'Pro' in procrastinate."
- "Recovering perfectionist."
- "Error 404: Bio unavailable."
- "Loading personality... please wait."
- "Full-stack developer. Empty-stack human."
- "I came. I saw. I ragequit."
- "Achievement unlocked: 10,000 hours wasted."
- "My skills are inversely proportional to my confidence."
- "Professional pizza taster, amateur life coach."
- "unpaid family therapist"

### Format Breakers
- "*insert cringe quote here*"
- "What should I put here?"
- "Is this thing on."
- "So unoriginal that I even had to get my bio from reddit"
- "Mitochondria is the power house of the cell"
- "If you are reading this it's too late."

### Identity Deflators
- "Evie's husband"
- "Dad, Husband, President, Citizen."
- "codes on occasion, believe it or not"
- "I make videos and clothes and put them on the internet"

### Absurd Specificity
- "Guaranteed to get the worst seat on an airplane"
- "Can recite entire script of Wayne's World"
- "I don't need a hair stylist, my pillow gives me a new hairstyle every morning."

### Developer Culture
- "It works on my machine."
- "A different error message! Finally some progress!"
- "Don't Ask Me, I Have No Idea Why This Works Either"
- "I turn coffee into code."
- "stopped caring 8 commits ago"
- "holy shit it's functional"
- "permanent hack, do not revert"
- "does it work? maybe. will I check? no."
- "I had a cup of tea and now it's fixed"
- "copy and paste is not a design pattern"

### Gaming & Subculture
- "Currently pretending to be offline."
- "Do not disturb. I'm already disturbed enough."
- "Playing with your feelings."
- "Buffering..."
- "Currently experiencing life at a rate of several WTFs per hour."
- "If you can't beat them, lower the difficulty."
- "It's bad decision o'clock"

### Philosophical
- "Born to express, not to impress."
- "Reality called, so I hung up."
- "Born too late to explore the Earth, born too early to explore the galaxy, born just in time to browse dank memes."
`.trim();

  const FIRSTRUN_SYSTEM_PROMPT = `Here are one-liners written by real humans:

${SIGNATURE_LIBRARY_TEXT}

Someone just answered: "When was the last time you were sure you weren't AI?"

Step 1: Pick the 3 lines from above closest in vibe to their answer.
Step 2: Write ONE new line in the same style, about what they actually said.

Return ONLY the new line. Nothing else.`;

  const FALLBACK_REPLIES = [
    "You could've lied. You didn't. That's either brave or lazy.",
    "A bot would've optimized that sentence. You just... said it.",
    "That answer had fingerprints on it. Smudged ones.",
    "You answered like someone who's been asked this before and still doesn't have a good answer.",
    "The hesitation in that answer is doing all the heavy lifting."
  ];

  async function generateFirstRunResponse(userAnswer) {
    try {
      const res = await fetch('/api/firstrun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: FIRSTRUN_SYSTEM_PROMPT },
            { role: 'user', content: userAnswer }
          ],
          max_tokens: 200,
          temperature: 0.9
        })
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
      throw new Error('Empty AI response');
    } catch (err) {
      console.warn('First-run AI call failed, using fallback:', err);
      return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    }
  }

  // Form handling
  document.getElementById('firstrun-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answer = document.getElementById('firstrun-answer')?.value.trim();
    if (!answer) return;

    const btn = document.getElementById('firstrun-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    // Phase 2: Thinking with scan text rotation
    showFirstRunPhase('thinking');
    const scanTextEl = document.getElementById('firstrun-scan-text');
    const scanTexts = ['Reading your soul...', 'Analyzing patterns...', 'Almost human...'];
    let scanIdx = 0;
    const scanInterval = setInterval(() => {
      scanIdx++;
      if (scanIdx < scanTexts.length && scanTextEl) {
        scanTextEl.style.opacity = '0';
        setTimeout(() => {
          scanTextEl.textContent = scanTexts[scanIdx];
          scanTextEl.style.opacity = '1';
        }, 300);
      }
    }, 900);

    // Generate AI response
    const reply = await generateFirstRunResponse(answer);
    clearInterval(scanInterval);

    // Fill card content with staged reveals
    const replyEl = document.getElementById('firstrun-reply');
    const dateEl = document.getElementById('firstrun-date');

    // Typewriter effect for reply
    if (replyEl) {
      replyEl.textContent = '';
      // Wait for the reply fade-in animation delay (0.8s)
      setTimeout(() => {
        let i = 0;
        const typeInterval = setInterval(() => {
          if (i < reply.length) {
            replyEl.textContent += reply[i];
            i++;
          } else {
            clearInterval(typeInterval);
          }
        }, 35);
      }, 800);
    }
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Phase 3: Card reveal
    showFirstRunPhase('card');

    // Save to localStorage
    completeFirstRun();
  });

  // "Enter Puora" button
  document.getElementById('firstrun-continue')?.addEventListener('click', () => {
    // Unlock: remove firstrun class and inert attributes
    document.body.classList.remove('firstrun');
    document.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
    closeFirstRunModal();
    scrollToFeed();
  });

  // ============== STICKY HEADER ON SCROLL ==============

  const stickyHeader = document.getElementById('sticky-header');
  const heroNarrative = document.querySelector('.hero-narrative');
  const heroTitle = document.querySelector('.hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');
  const heroBtn = document.querySelector('.btn-ask-hero');
  const heroLogo = document.querySelector('.hero-logo');

  if (stickyHeader && heroTitle && heroNarrative) {
    // Smooth lerp state to avoid jitter
    let current = { title: 1, sub: 1, header: 0, ty: 0 };
    let target  = { title: 1, sub: 1, header: 0, ty: 0 };
    let rafId = null;

    function lerp(a, b, f) { return a + (b - a) * f; }

    function computeTarget() {
      const scrollY = window.scrollY;
      const triggerEnd = window.innerHeight * 0.55;
      const t = Math.min(1, Math.max(0, scrollY / triggerEnd));

      // Title: translate up and fade out
      target.ty = -t * 60;
      target.title = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;

      // Subtitle & button: fade out quicker
      target.sub = Math.max(0, 1 - t * 2.5);

      // Sticky header: fade in during last 30%
      target.header = t < 0.7 ? 0 : (t - 0.7) / 0.3;
    }

    function tick() {
      const f = 0.18; // smoothing factor — lower = smoother
      current.title  = lerp(current.title,  target.title,  f);
      current.sub    = lerp(current.sub,    target.sub,    f);
      current.header = lerp(current.header, target.header, f);
      current.ty     = lerp(current.ty,     target.ty,     f);

      heroTitle.style.transform = `translate3d(0,${current.ty}px,0)`;
      heroTitle.style.opacity = current.title;

      if (heroSubtitle) heroSubtitle.style.opacity = current.sub;
      if (heroBtn) heroBtn.style.opacity = current.sub;
      if (heroLogo) heroLogo.style.opacity = current.sub;

      stickyHeader.style.opacity = current.header;
      stickyHeader.style.pointerEvents = current.header > 0.1 ? 'auto' : 'none';

      // Keep ticking if not converged
      const diff = Math.abs(current.title - target.title)
                 + Math.abs(current.sub - target.sub)
                 + Math.abs(current.header - target.header)
                 + Math.abs(current.ty - target.ty);
      if (diff > 0.01) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }

    function onScroll() {
      computeTarget();
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    computeTarget();
    // snap to initial state without animation
    Object.assign(current, target);
    tick();
  }

  // ============== BOOT ==============

  // First-run: set inert on locked areas for accessibility
  if (isFirstRun()) {
    ['.feed-tabs', '.api-banner', '.feed-cards']
      .forEach(s => document.querySelector(s)?.setAttribute('inert', ''));
  }

  // Init data then handle initial route
  patchedInitApp().then(() => {
    const route = getRoute();
    if (route.view === 'detail') {
      // If SSR already rendered the detail view, just attach handlers
      const ssrDetail = document.querySelector('.detail-view.active');
      if (ssrDetail && ssrDetail.querySelector('.detail-question')) {
        document.getElementById('detail-back')?.addEventListener('click', () => {
          navigateTo('/');
        });
        attachAnswerFormHandler(route.id);
        attachDeleteHandlers(route.id);
      } else {
        showQuestionDetail(route.id);
      }
    }
  });

});
