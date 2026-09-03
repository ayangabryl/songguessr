// Hacker News front page, rethought. Static HTML/CSS/vanilla JS, no framework, no build step, no network
// request beyond the local items.json. The one new mechanism (concept.md): a velocity signal computed
// against a cached previous snapshot doubles as the since-last-visit signal — a story absent from the
// snapshot is the maximal case of the same computation and is labelled "new" instead of a number.

const SNAPSHOT_KEY = 'hn-snapshot';
const LAST_VISIT_KEY = 'hn-last-visit';
const THEME_KEY = 'hn-theme';
const RISE_POINTS = 60;   // point delta at or above this puts a story in the Rising band
const RISE_COMMENTS = 30; // comment delta at or above this puts a story in the Rising band

let itemsCache = null;

// --- Deterministic pseudo-random, keyed by item id, so the seeded demo snapshot is stable across reloads
// and across QA captures instead of producing a different screenshot every run.
function seeded(id, salt) {
  let h = 2166136261;
  for (const ch of String(id) + salt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h = h >>> 0;
  return (h % 100000) / 100000;
}

// For the demo: seed a plausible previous snapshot on the first-ever load, so the mechanism this build
// exists to show is visible without waiting for a real second visit. A real deployment would instead leave
// this empty until the reader's actual first return; the honest first-run state (brief.md) is what renders
// when this snapshot is absent, and `window.__hnDemo.simulateFirstRun()` reproduces it for QA.
function seedDemoSnapshot(items) {
  const snap = {};
  for (const item of items) {
    if (seeded(item.id, 'new') < 0.18) continue; // ~18% of stories are "new" (absent from the snapshot)
    const pointsGrowth = 1.05 + seeded(item.id, 'p') * 0.45;
    const commentsGrowth = 1.05 + seeded(item.id, 'c') * 0.55;
    snap[item.id] = {
      points: item.points == null ? null : Math.max(1, Math.round(item.points / pointsGrowth)),
      comments: Math.max(0, Math.round(item.comments / commentsGrowth)),
    };
  }
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  localStorage.setItem(LAST_VISIT_KEY, String(Date.now() - 2 * 60 * 60 * 1000)); // simulated: 2 hours ago
}

function getSnapshot() {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
}

// The one new mechanism: velocity against a cached snapshot. A story with no entry returns isNew: true,
// which is the same "nothing to compare against" case the first-run state produces for the whole page —
// one function, not two features.
function velocity(item, snapshot) {
  const prev = snapshot[item.id];
  if (!prev) return { isNew: true, pointsDelta: null, commentsDelta: null };
  const pointsDelta = item.points != null && prev.points != null ? item.points - prev.points : null;
  const commentsDelta = item.comments - prev.comments;
  return { isNew: false, pointsDelta, commentsDelta };
}

function isRising(v) {
  if (v.isNew) return true;
  if (v.pointsDelta != null && v.pointsDelta >= RISE_POINTS) return true;
  if (v.commentsDelta != null && v.commentsDelta >= RISE_COMMENTS) return true;
  return false;
}

function relativeTime(fromTs) {
  const mins = Math.round((Date.now() - fromTs) / 60000);
  if (mins < 1) return 'moments ago';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

function resolveHref(item) {
  if (!item.url) return '#';
  return item.url.startsWith('item?id=') ? `https://news.ycombinator.com/${item.url}` : item.url;
}

function commentsHref(item) {
  return `https://news.ycombinator.com/item?id=${item.id}`;
}

function deltaMarkup(delta, unit) {
  if (delta == null || delta <= 0) return '';
  // Thin space (U+2009), not a regular word space: the delta reads as a quiet aside on the figure it
  // modifies, not a second value with equal spacing weight (loop 3, S3-3).
  return `\u2009<span class="delta num" aria-label="up ${delta} ${unit} since your last visit">+${delta}</span>`;
}

function rowMarkup(item, band, v) {
  const href = resolveHref(item);
  const pointsText = item.points == null ? '' : `<span class="points num">${item.points} pts${v.isNew ? '' : deltaMarkup(v.pointsDelta, 'points')}</span>`;
  const commentsDelta = v.isNew ? '' : deltaMarkup(v.commentsDelta, 'comments');
  const domain = item.site ? `<span class="domain">${item.site}</span>` : '';
  const newBadge = v.isNew ? '<span class="new-badge">new</span>' : '';
  // Domain and "new" travel as one nowrap unit so a narrow line wraps them together, never leaving "new"
  // stranded alone on its own line (loop 3, S2-2).
  const domainGroup = domain || newBadge ? `<span class="domain-group">${domain}${newBadge}</span>` : '';
  const by = item.user ? `<span class="by">${item.user}</span><span class="sep" aria-hidden="true">·</span>` : '';
  return `
    <li class="story-row" data-band="${band}">
      <div class="story-body">
        <div class="story-title-line">
          <a class="title-link" href="${href}">${item.title}</a>${domainGroup}
        </div>
        <div class="story-meta">
          ${pointsText}
          <span class="sep" aria-hidden="true">·</span>
          <a class="comments" href="${commentsHref(item)}">${item.comments} comments${commentsDelta}</a>
          <span class="sep" aria-hidden="true">·</span>
          ${by}
          <span class="age">${item.age}</span>
        </div>
      </div>
    </li>`;
}

function render(items) {
  const app = document.getElementById('app');
  const snapshot = getSnapshot();
  const lastVisit = Number(localStorage.getItem(LAST_VISIT_KEY)) || null;

  if (!snapshot) {
    // First run: no history to compare against. The flat, undivided list — divergence option 1 — not a
    // half-built "Rising" band with nothing in it (concept.md, decisions nobody else made #3).
    app.innerHTML = `<ol class="story-list band-flat">${items.map((item) => rowMarkup(item, 'flat', { isNew: false, pointsDelta: null, commentsDelta: null })).join('')}</ol>`;
    document.getElementById('story-count').textContent = String(items.length);
    return;
  }

  const rising = [];
  const steady = [];
  for (const item of items) {
    const v = velocity(item, snapshot);
    (isRising(v) ? rising : steady).push({ item, v });
  }

  const risingHtml = rising.map(({ item, v }) => rowMarkup(item, 'rising', v)).join('');
  const steadyHtml = steady.map(({ item, v }) => rowMarkup(item, 'steady', v)).join('');
  const tideText = rising.length > 0
    ? `Since your last visit, ${relativeTime(lastVisit)} — ${rising.length} new or picking up`
    : `Nothing new since your last visit, ${relativeTime(lastVisit)}`;

  app.innerHTML = `
    ${rising.length ? `<ol class="story-list band-rising">${risingHtml}</ol>` : ''}
    <div class="tide-mark">
      <span class="tide-line" aria-hidden="true"></span>
      <p class="tide-text">${tideText}</p>
    </div>
    <ol class="story-list band-steady" style="--steady-start: ${rising.length}">${steadyHtml}</ol>
  `;
  document.getElementById('story-count').textContent = String(items.length);
}

function initTheme() {
  const button = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-toggle-label');
  const sync = () => {
    const theme = document.documentElement.getAttribute('data-theme');
    const switchTo = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    // aria-label is the button's accessible name on every viewport, including mobile where the text
    // label is visually hidden behind the icon (loop 3, S3-2); it always names the action, not the state.
    button.setAttribute('aria-label', `Switch to ${switchTo} theme`);
    label.textContent = theme === 'dark' ? 'Light' : 'Dark';
  };
  button.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    sync();
  });
  sync();
}

async function boot() {
  initTheme();
  const app = document.getElementById('app');
  const skeletonTimer = setTimeout(() => {
    app.setAttribute('aria-busy', 'true');
    app.innerHTML = `<ol class="story-list band-flat">${Array.from({ length: 8 }, () => '<li class="story-row story-row--skeleton" aria-hidden="true"><div class="story-body"><div class="skeleton-line skeleton-line--title"></div><div class="skeleton-line skeleton-line--meta"></div></div></li>').join('')}</ol>`;
  }, 300);
  try {
    const res = await fetch('items.json');
    if (!res.ok) throw new Error(`items.json responded ${res.status}`);
    const items = await res.json();
    clearTimeout(skeletonTimer);
    app.removeAttribute('aria-busy');
    itemsCache = items;
    if (!localStorage.getItem(SNAPSHOT_KEY)) seedDemoSnapshot(items);
    render(items);
  } catch (err) {
    clearTimeout(skeletonTimer);
    app.removeAttribute('aria-busy');
    app.innerHTML = `
      <div class="state-message">
        <p>Could not load the front page. ${err.message}</p>
        <button type="button" class="retry" id="retry-btn">Retry</button>
      </div>`;
    document.getElementById('retry-btn').addEventListener('click', boot);
  }
}

// QA and demo hooks only; no part of the normal reader path. Used by scripts/capture.mjs states.json.
window.__hnDemo = {
  // Deterministic default: always the same modest-growth seeded snapshot, regardless of what a previous
  // capture state left in localStorage. QA's "idle" state calls this so every capture starts from the same data.
  resetToNormalReturn() {
    if (!itemsCache) return;
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(LAST_VISIT_KEY);
    seedDemoSnapshot(itemsCache);
    render(itemsCache);
  },
  forceDramaticReturn() {
    if (!itemsCache) return;
    const snap = {};
    itemsCache.forEach((item, i) => {
      if (i % 3 === 0) return; // a third of the list reads as new
      snap[item.id] = {
        points: item.points == null ? null : Math.max(1, Math.round(item.points * 0.5)),
        comments: Math.max(0, Math.round(item.comments * 0.35)),
      };
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now() - 5 * 60 * 60 * 1000));
    render(itemsCache);
  },
  simulateFirstRun() {
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(LAST_VISIT_KEY);
    if (itemsCache) render(itemsCache);
  },
  focusFirstRow() {
    const el = document.querySelector('.story-row .title-link');
    if (el) el.focus();
  },
};

boot();
