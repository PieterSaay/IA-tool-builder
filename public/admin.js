(function () {
  'use strict';

  const rulesetSelect = document.getElementById('rulesetSelect');
  const contentForm = document.getElementById('contentForm');
  const titleInput = document.getElementById('titleInput');
  const summaryInput = document.getElementById('summaryInput');
  const explanationInput = document.getElementById('explanationInput');
  const citationInput = document.getElementById('citationInput');
  const keywordsInput = document.getElementById('keywordsInput');
  const publishButton = document.getElementById('publishButton');
  const publishResult = document.getElementById('publishResult');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function loadRulesets() {
    const res = await fetch('/api/rulesets');
    const data = await res.json();
    rulesetSelect.innerHTML = '';
    data.rulesets.forEach((rs) => {
      const option = document.createElement('option');
      option.value = rs.id;
      option.textContent = rs.name;
      rulesetSelect.appendChild(option);
    });
  }

  contentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    publishButton.disabled = true;
    publishResult.innerHTML = '<p class="loading">Publishing…</p>';

    const keywords = keywordsInput.value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rulesetId: rulesetSelect.value,
          title: titleInput.value.trim(),
          summary: summaryInput.value.trim(),
          explanation: explanationInput.value.trim(),
          citation: citationInput.value.trim(),
          keywords,
        }),
      });
      const data = await res.json();
      publishResult.innerHTML = '';

      if (!res.ok) {
        publishResult.appendChild(el('p', 'no-match', data.error || 'Something went wrong.'));
        return;
      }

      const card = el('div', 'answer-card');
      card.appendChild(el('p', 'answer-eyebrow', 'Published'));
      card.appendChild(el('p', 'answer-headline', data.content.summary));
      card.appendChild(el('span', 'tag playing_condition', 'Playing condition'));
      card.appendChild(el('hr', 'divider'));
      card.appendChild(el('p', 'citation', data.content.citation));
      card.appendChild(el('p', 'explanation', 'Now searchable in Match Mode for this ruleset, and added to the Change Alerts feed.'));
      publishResult.appendChild(card);

      contentForm.reset();
      await loadRulesets();
    } catch (err) {
      publishResult.innerHTML = '';
      publishResult.appendChild(el('p', 'no-match', 'Network error — is the server running?'));
    } finally {
      publishButton.disabled = false;
    }
  });

  loadRulesets();
})();
