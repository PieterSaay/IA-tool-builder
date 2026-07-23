(function () {
  'use strict';

  const rulesetList = document.getElementById('rulesetList');
  const queryForm = document.getElementById('queryForm');
  const queryInput = document.getElementById('queryInput');
  const queryButton = document.getElementById('queryButton');
  const activeRulesetHint = document.getElementById('activeRulesetHint');
  const answerArea = document.getElementById('answerArea');

  const scenarioChipRow = document.getElementById('scenarioChipRow');
  const scenarioForm = document.getElementById('scenarioForm');
  const scenarioInput = document.getElementById('scenarioInput');
  const scenarioButton = document.getElementById('scenarioButton');
  const scenarioArea = document.getElementById('scenarioArea');

  const alertsChipRow = document.getElementById('alertsChipRow');
  const alertsFeed = document.getElementById('alertsFeed');
  const alertsSummary = document.getElementById('alertsSummary');
  const markAllReadBtn = document.getElementById('markAllRead');

  let activeRulesetId = null;
  let activeRulesetName = null;
  let loadedAlerts = [];
  let activeAlertsFilter = 'all';

  const QUERY_HISTORY_KEY = 'thirdUmpireQueryHistory';
  const READ_ALERTS_KEY = 'thirdUmpireReadAlerts';

  function readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // localStorage unavailable (private browsing, quota) — degrade silently
    }
  }

  function recordQueryHistory(answer) {
    const history = readLocal(QUERY_HISTORY_KEY, []);
    history.push({ id: answer.id, ref: answer.ref, title: answer.title, timestamp: new Date().toISOString() });
    writeLocal(QUERY_HISTORY_KEY, history);
  }

  function personalInsightAlert() {
    const history = readLocal(QUERY_HISTORY_KEY, []);
    if (history.length === 0) return null;

    const counts = new Map();
    history.forEach((entry) => {
      counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
    });
    let topId = null;
    let topCount = 0;
    counts.forEach((count, id) => {
      if (count > topCount) {
        topCount = count;
        topId = id;
      }
    });
    if (!topId || topCount < 2) return null;

    const topEntry = [...history].reverse().find((e) => e.id === topId);
    return {
      id: 'personal-top-query',
      category: 'personal',
      headline: `Your most-queried topic so far: ${topEntry.ref} — ${topEntry.title}`,
      summary: `Came up ${topCount} times in your Match Mode questions on this device.`,
      timestamp: new Date().toISOString(),
    };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportButton(reportLines, filename) {
    const btn = el('button', 'export-btn', 'Export ruling');
    btn.type = 'button';
    btn.addEventListener('click', () => downloadText(filename, reportLines.join('\n')));
    return btn;
  }

  // ---- Match Mode Q&A ----

  async function loadRulesets() {
    try {
      const res = await fetch('/api/rulesets');
      const data = await res.json();
      renderRulesets(data.rulesets);
    } catch (err) {
      rulesetList.textContent = 'Could not load rulesets. Is the server running?';
    }
  }

  function renderRulesets(rulesets) {
    rulesetList.innerHTML = '';
    rulesets.forEach((rs) => {
      const btn = el('button', 'ruleset-btn');
      btn.type = 'button';
      btn.appendChild(el('span', 'rs-name', rs.name));
      btn.appendChild(el('span', 'rs-desc', rs.description));
      btn.addEventListener('click', () => selectRuleset(rs, btn));
      rulesetList.appendChild(btn);
    });
  }

  function selectRuleset(rs, btnEl) {
    activeRulesetId = rs.id;
    activeRulesetName = rs.name;
    Array.from(rulesetList.querySelectorAll('.ruleset-btn')).forEach((b) => b.classList.remove('active'));
    btnEl.classList.add('active');
    activeRulesetHint.textContent = `Asking within: ${rs.name}`;
    queryButton.disabled = false;
    answerArea.innerHTML = '';
  }

  function renderAnswer(data) {
    answerArea.innerHTML = '';
    const card = el('div', 'answer-card');

    if (!data.matched) {
      card.appendChild(el('p', 'no-match', data.message));
      answerArea.appendChild(card);
      return;
    }

    const { answer } = data;
    recordQueryHistory(answer);
    card.appendChild(el('p', 'answer-eyebrow', 'Ruling'));
    card.appendChild(el('p', 'answer-headline', answer.summary));
    card.appendChild(el('span', `tag ${answer.type}`, answer.type === 'law' ? 'Law' : 'Playing condition'));
    if (data.offline) card.appendChild(el('span', 'offline-note', 'Answered offline'));
    card.appendChild(el('hr', 'divider'));
    card.appendChild(el('p', 'citation', answer.citation));
    card.appendChild(el('p', 'explanation', answer.explanation));

    const actions = el('div', 'card-actions');
    const reportLines = [
      'THIRD UMPIRE — RULING',
      `Match Mode: ${activeRulesetName || ''}`,
      `Ruling: ${answer.summary}`,
      `Source: ${answer.citation}`,
      `Explanation: ${answer.explanation}`,
      `Generated: ${new Date().toISOString()}`,
    ];
    actions.appendChild(exportButton(reportLines, `ruling-${answer.id}.txt`));
    card.appendChild(actions);

    answerArea.appendChild(card);
  }

  async function submitQuery(event) {
    event.preventDefault();
    if (!activeRulesetId) return;
    const question = queryInput.value.trim();
    if (!question) return;

    queryButton.disabled = true;
    answerArea.innerHTML = '<p class="loading">Checking…</p>';

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, rulesetId: activeRulesetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        answerArea.innerHTML = '';
        answerArea.appendChild(el('p', 'no-match', data.error || 'Something went wrong.'));
      } else {
        renderAnswer(data);
      }
    } catch (err) {
      answerArea.innerHTML = '';
      answerArea.appendChild(el('p', 'no-match', 'Network error, and no offline copy could be reached yet.'));
    } finally {
      queryButton.disabled = false;
    }
  }

  // ---- Scenario Simulator ----

  function renderVerdict(data) {
    scenarioArea.innerHTML = '';
    const card = el('div', 'answer-card');

    if (!data.matched) {
      card.appendChild(el('p', 'no-match', data.message));
      scenarioArea.appendChild(card);
      return;
    }

    const { verdict } = data;
    card.appendChild(el('p', 'answer-eyebrow', 'Verdict'));

    const pill = el('span', `verdict-pill ${verdict.verdictType}`);
    pill.appendChild(el('span', 'dot'));
    pill.appendChild(el('span', null, verdict.verdictLabel));
    card.appendChild(pill);
    if (data.offline) card.appendChild(el('span', 'offline-note', 'Answered offline'));

    card.appendChild(el('p', 'answer-sub', verdict.summary));
    card.appendChild(el('span', `tag ${verdict.tag}`, verdict.tag === 'law' ? 'Law' : 'Playing condition'));
    card.appendChild(el('hr', 'divider'));

    card.appendChild(el('p', 'answer-eyebrow', 'Reasoning'));
    const ol = document.createElement('ol');
    ol.className = 'reasoning';
    verdict.steps.forEach((step) => {
      const li = document.createElement('li');
      li.appendChild(el('span', 'step-text', step.text));
      li.appendChild(el('span', 'step-cite', step.cite));
      ol.appendChild(li);
    });
    card.appendChild(ol);

    card.appendChild(el('hr', 'divider'));
    card.appendChild(el('p', 'citation', verdict.citation));

    const actions = el('div', 'card-actions');
    const reportLines = [
      'THIRD UMPIRE — SCENARIO RULING',
      `Verdict: ${verdict.verdictLabel}`,
      `Summary: ${verdict.summary}`,
      'Reasoning:',
      ...verdict.steps.map((s, i) => `  ${i + 1}. ${s.text} (${s.cite})`),
      `Source: ${verdict.citation}`,
      `Generated: ${new Date().toISOString()}`,
    ];
    actions.appendChild(exportButton(reportLines, `scenario-${verdict.id}.txt`));
    card.appendChild(actions);

    scenarioArea.appendChild(card);
  }

  async function submitScenario(event) {
    event.preventDefault();
    const description = scenarioInput.value.trim();
    if (!description) return;

    scenarioButton.disabled = true;
    scenarioArea.innerHTML = '<p class="loading">Checking…</p>';

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) {
        scenarioArea.innerHTML = '';
        scenarioArea.appendChild(el('p', 'no-match', data.error || 'Something went wrong.'));
      } else {
        renderVerdict(data);
      }
    } catch (err) {
      scenarioArea.innerHTML = '';
      scenarioArea.appendChild(el('p', 'no-match', 'Network error, and no offline copy could be reached yet.'));
    } finally {
      scenarioButton.disabled = false;
    }
  }

  scenarioChipRow.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    scenarioInput.value = chip.getAttribute('data-q');
    submitScenario(new Event('submit', { cancelable: true }));
  });

  // ---- Change Alerts ----

  function catLabel(category) {
    if (category === 'law') return 'Law';
    if (category === 'playing_condition') return 'Playing condition';
    if (category === 'association') return 'Association';
    return 'Personal';
  }

  function renderAlerts() {
    const readIds = new Set(readLocal(READ_ALERTS_KEY, []));
    const combined = [...loadedAlerts];
    const personal = personalInsightAlert();
    if (personal) combined.push(personal);
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const visible = activeAlertsFilter === 'all' ? combined : combined.filter((a) => a.category === activeAlertsFilter);
    const unreadCount = combined.filter((a) => !readIds.has(a.id)).length;
    alertsSummary.textContent = `${combined.length} update${combined.length === 1 ? '' : 's'} · ${unreadCount} unread`;

    alertsFeed.innerHTML = '';
    if (visible.length === 0) {
      alertsFeed.appendChild(el('p', 'no-match', 'Nothing in this category yet.'));
      return;
    }

    visible.forEach((alert) => {
      const isRead = readIds.has(alert.id);
      const card = el('div', `alert-card${isRead ? ' is-read' : ''}`);
      card.dataset.alertId = alert.id;

      const top = el('div', 'alert-top');
      top.appendChild(el('span', `cat-tag ${alert.category}`, catLabel(alert.category)));
      top.appendChild(el('span', 'alert-time', new Date(alert.timestamp).toLocaleDateString()));
      card.appendChild(top);

      const headline = el('p', 'alert-headline');
      if (!isRead) headline.appendChild(el('span', 'unread-dot'));
      headline.appendChild(document.createTextNode(alert.headline));
      card.appendChild(headline);

      card.appendChild(el('p', 'alert-summary', alert.summary));

      if (alert.detail) {
        const details = document.createElement('details');
        details.className = 'alert-detail';
        const summary = document.createElement('summary');
        summary.textContent = 'Details';
        details.appendChild(summary);
        const full = el('p', 'alert-full', alert.detail);
        if (alert.citation) full.textContent += ` (${alert.citation})`;
        details.appendChild(full);
        card.appendChild(details);
      }

      card.addEventListener('click', () => markAlertRead(alert.id), { once: true });
      alertsFeed.appendChild(card);
    });
  }

  function markAlertRead(id) {
    const readIds = new Set(readLocal(READ_ALERTS_KEY, []));
    if (readIds.has(id)) return;
    readIds.add(id);
    writeLocal(READ_ALERTS_KEY, [...readIds]);
    renderAlerts();
  }

  function markAllRead() {
    const combined = [...loadedAlerts];
    const personal = personalInsightAlert();
    if (personal) combined.push(personal);
    writeLocal(READ_ALERTS_KEY, combined.map((a) => a.id));
    renderAlerts();
  }

  async function loadAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      loadedAlerts = data.alerts || [];
    } catch (err) {
      loadedAlerts = [];
      alertsSummary.textContent = 'Could not load updates. Is the server running?';
    }
    renderAlerts();
  }

  alertsChipRow.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    Array.from(alertsChipRow.querySelectorAll('.chip')).forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    activeAlertsFilter = chip.getAttribute('data-filter');
    renderAlerts();
  });

  markAllReadBtn.addEventListener('click', markAllRead);

  // ---- wiring ----

  queryForm.addEventListener('submit', submitQuery);
  scenarioForm.addEventListener('submit', submitScenario);
  loadRulesets();
  loadAlerts();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(() => {
        fetch('/api/content-bundle').catch(() => {});
      });
    });
  }
})();
