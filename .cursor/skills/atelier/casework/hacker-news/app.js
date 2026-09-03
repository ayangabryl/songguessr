// Renders items.json into the story list. Vanilla JS, no build step, no external requests.
(function () {
  'use strict';

  var THEME_KEY = 'hn-theme';
  var html = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var targetLabel = document.getElementById('theme-target-label');

  function currentTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    html.setAttribute('data-theme', theme);
    if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} }
    var isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    targetLabel.textContent = isDark ? 'light' : 'dark';
  }

  applyTheme(currentTheme(), false);
  toggle.addEventListener('click', function () {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  });

  // ---- Story list -------------------------------------------------------
  var statusEl = document.getElementById('status');
  var listEl = document.getElementById('story-list');
  var errorEl = document.getElementById('error-state');
  var regionEl = document.getElementById('list-region');
  var retryBtn = document.getElementById('retry-btn');

  function itemHref(url, id) {
    if (!url) return 'https://news.ycombinator.com/item?id=' + encodeURIComponent(id);
    if (url.indexOf('item?id=') === 0) return 'https://news.ycombinator.com/' + url;
    return url;
  }

  function pluralize(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function buildRow(item, rank) {
    var li = document.createElement('li');
    li.className = 'story-row';

    var rankEl = document.createElement('span');
    rankEl.className = 'rank num';
    rankEl.textContent = rank + '.';
    li.appendChild(rankEl);

    var vote = document.createElement('button');
    vote.type = 'button';
    vote.className = 'vote';
    vote.setAttribute('aria-pressed', 'false');
    vote.setAttribute('aria-label', 'Upvote: ' + item.title);
    vote.innerHTML = '<svg class="vote-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 0.6 L9.4 8.6 L0.6 8.6 Z"></path></svg>';
    vote.addEventListener('click', function () {
      var pressed = vote.getAttribute('aria-pressed') === 'true';
      vote.setAttribute('aria-pressed', String(!pressed));
    });
    li.appendChild(vote);

    var content = document.createElement('div');
    content.className = 'story-content';

    var titleP = document.createElement('p');
    titleP.className = 'story-title';
    var link = document.createElement('a');
    link.className = 'title-link';
    link.href = itemHref(item.url, item.id);
    link.textContent = item.title;
    titleP.appendChild(link);
    if (item.site) {
      // Loop 2: dropped the parenthesised form — with the title link no longer forced into its own
      // flex box (styles.css .title-link), the domain now flows inline with the title text and wraps
      // with it; colour and size (not punctuation) carry the separation (direction audit S2).
      var domain = document.createElement('span');
      domain.className = 'domain';
      domain.textContent = item.site;
      titleP.appendChild(domain);
    }
    content.appendChild(titleP);

    var metaP = document.createElement('p');
    metaP.className = 'story-meta';
    var parts = [];

    if (item.points !== null && item.points !== undefined) {
      var pointsUser = document.createElement('span');
      var pointsSpan = document.createElement('span');
      pointsSpan.className = 'points num';
      pointsSpan.textContent = String(item.points);
      pointsUser.appendChild(pointsSpan);
      pointsUser.appendChild(document.createTextNode(' ' + (item.points === 1 ? 'point' : 'points')));
      if (item.user) {
        pointsUser.appendChild(document.createTextNode(' by '));
        // Author is data, not a required link (only title and comments are); kept as plain text
        // so the meta line does not carry a second small inline target per row (see qa-report.md).
        var userSpan = document.createElement('span');
        userSpan.className = 'user';
        userSpan.textContent = item.user;
        pointsUser.appendChild(userSpan);
      }
      parts.push(pointsUser);
    }

    var ageSpan = document.createElement('span');
    ageSpan.className = 'age';
    ageSpan.textContent = item.age;
    parts.push(ageSpan);

    var commentsLink = document.createElement('a');
    commentsLink.className = 'comments num';
    commentsLink.href = 'https://news.ycombinator.com/item?id=' + encodeURIComponent(item.id);
    commentsLink.textContent = item.comments === 0 ? 'discuss' : pluralize(item.comments, 'comment');
    parts.push(commentsLink);

    parts.forEach(function (part, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.className = 'sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = ' · ';
        metaP.appendChild(sep);
      }
      metaP.appendChild(part);
    });
    content.appendChild(metaP);

    li.appendChild(content);
    return li;
  }

  function render(items) {
    listEl.innerHTML = '';
    items.forEach(function (item, i) { listEl.appendChild(buildRow(item, i + 1)); });
    statusEl.hidden = true;
    errorEl.hidden = true;
    listEl.hidden = false;
    regionEl.setAttribute('aria-busy', 'false');
  }

  function showError() {
    statusEl.hidden = true;
    listEl.hidden = true;
    errorEl.hidden = false;
    regionEl.setAttribute('aria-busy', 'false');
  }

  function load() {
    statusEl.hidden = false;
    listEl.hidden = true;
    errorEl.hidden = true;
    regionEl.setAttribute('aria-busy', 'true');
    fetch('items.json')
      .then(function (res) { if (!res.ok) throw new Error('bad response'); return res.json(); })
      .then(render)
      .catch(showError);
  }

  retryBtn.addEventListener('click', load);
  load();
})();
