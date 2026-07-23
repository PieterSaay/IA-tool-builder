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

  const resolvers = window.ThirdUmpireResolvers;

  let activeRulesetId = null;
  let activeRulesetName = null;
  let content = null; // { rulesets, laws, playingConditions, scenarios }

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

  async function loadContent() {
    const [rulesets, laws, playingConditions, scenarios] = await Promise.all([
      fetch('./data/rulesets.json').then((r) => r.json()),
      fetch('./data/laws.json').then((r) => r.json()),
      fetch('./data/playingConditions.json').then((r) => r.json()),
      fetch('./data/scenarios.json').then((r) => r.json()),
    ]);
    return { rulesets, laws, playingConditions, scenarios };
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

  function renderAnswer(result) {
    answerArea.innerHTML = '';
    const card = el('div', 'answer-card');

    if (!result.matched) {
      card.appendChild(el('p', 'no-match', "No confident match in this ruleset's library — try rephrasing, or this may fall outside what's covered so far."));
      answerArea.appendChild(card);
      return;
    }

    const answer = resolvers.formatAnswerEntry(result.entry);
    card.appendChild(el('p', 'answer-eyebrow', 'Ruling'));
    card.appendChild(el('p', 'answer-headline', answer.summary));
    card.appendChild(el('span', `tag ${answer.type}`, answer.type === 'law' ? 'Law' : 'Playing condition'));
    card.appendChild(el('hr', 'divider'));
    card.appendChild(el('p', 'citation', answer.citation));
    card.appendChild(el('p', 'explanation', answer.explanation));

    const actions = el('div', 'card-actions');
    actions.appendChild(exportButton([
      'THIRD UMPIRE — RULING',
      `Match Mode: ${activeRulesetName || ''}`,
      `Ruling: ${answer.summary}`,
      `Source: ${answer.citation}`,
      `Explanation: ${answer.explanation}`,
      `Generated: ${new Date().toISOString()}`,
    ], `ruling-${answer.id}.txt`));
    card.appendChild(actions);

    answerArea.appendChild(card);
  }

  function submitQuery(event) {
    if (event) event.preventDefault();
    if (!activeRulesetId || !content) return;
    const question = queryInput.value.trim();
    if (!question) return;
    const result = resolvers.findBestAnswer(question, activeRulesetId, content.laws, content.playingConditions);
    renderAnswer(result);
  }

  function renderVerdict(result) {
    scenarioArea.innerHTML = '';
    const card = el('div', 'answer-card');

    if (!result.matched) {
      card.appendChild(el('p', 'no-match', "This doesn't match anything in the curated scenario library yet."));
      scenarioArea.appendChild(card);
      return;
    }

    const verdict = resolvers.formatScenarioEntry(result.entry);
    card.appendChild(el('p', 'answer-eyebrow', 'Verdict'));

    const pill = el('span', `verdict-pill ${verdict.verdictType}`);
    pill.appendChild(el('span', 'dot'));
    pill.appendChild(el('span', null, verdict.verdictLabel));
    card.appendChild(pill);

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
    actions.appendChild(exportButton([
      'THIRD UMPIRE — SCENARIO RULING',
      `Verdict: ${verdict.verdictLabel}`,
      `Summary: ${verdict.summary}`,
      'Reasoning:',
      ...verdict.steps.map((s, i) => `  ${i + 1}. ${s.text} (${s.cite})`),
      `Source: ${verdict.citation}`,
      `Generated: ${new Date().toISOString()}`,
    ], `scenario-${verdict.id}.txt`));
    card.appendChild(actions);

    scenarioArea.appendChild(card);
  }

  function submitScenario(event) {
    if (event) event.preventDefault();
    if (!content) return;
    const description = scenarioInput.value.trim();
    if (!description) return;
    const result = resolvers.findBestScenario(description, content.scenarios);
    renderVerdict(result);
  }

  scenarioChipRow.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    scenarioInput.value = chip.getAttribute('data-q');
    submitScenario();
  });

  queryForm.addEventListener('submit', submitQuery);
  scenarioForm.addEventListener('submit', submitScenario);

  loadContent()
    .then((loaded) => {
      content = loaded;
      renderRulesets(content.rulesets);
    })
    .catch(() => {
      rulesetList.textContent = 'Could not load content data.';
    });
})();
