(function () {
  'use strict';

  const rulesetList = document.getElementById('rulesetList');
  const queryForm = document.getElementById('queryForm');
  const queryInput = document.getElementById('queryInput');
  const queryButton = document.getElementById('queryButton');
  const activeRulesetHint = document.getElementById('activeRulesetHint');
  const answerArea = document.getElementById('answerArea');

  let activeRulesetId = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

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
    Array.from(rulesetList.querySelectorAll('.ruleset-btn')).forEach((b) => b.classList.remove('active'));
    btnEl.classList.add('active');
    activeRulesetHint.textContent = `Asking within: ${rs.name}`;
    queryButton.disabled = false;
    answerArea.innerHTML = '';
  }

  function renderAnswer(data) {
    answerArea.innerHTML = '';

    if (!data.matched) {
      const card = el('div', 'answer-card');
      card.appendChild(el('p', 'no-match', data.message));
      answerArea.appendChild(card);
      return;
    }

    const { answer } = data;
    const card = el('div', 'answer-card');
    card.appendChild(el('p', 'answer-eyebrow', 'Ruling'));
    card.appendChild(el('p', 'answer-headline', answer.summary));

    const tag = el('span', `tag ${answer.type}`, answer.type === 'law' ? 'Law' : 'Playing condition');
    card.appendChild(tag);

    card.appendChild(el('hr', 'divider'));
    card.appendChild(el('p', 'citation', answer.citation));
    card.appendChild(el('p', 'explanation', answer.explanation));

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
      answerArea.appendChild(el('p', 'no-match', 'Network error — is the server running?'));
    } finally {
      queryButton.disabled = false;
    }
  }

  queryForm.addEventListener('submit', submitQuery);
  loadRulesets();
})();
