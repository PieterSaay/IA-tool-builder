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

  let activeRulesetId = null;
  let activeRulesetName = null;

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

  // ---- wiring ----

  queryForm.addEventListener('submit', submitQuery);
  scenarioForm.addEventListener('submit', submitScenario);
  loadRulesets();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(() => {
        fetch('/api/content-bundle').catch(() => {});
      });
    });
  }
})();
