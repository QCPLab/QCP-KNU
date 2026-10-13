/* Publications: instant search + year filter. The full list is in the HTML, so it also works without JavaScript. */
(() => {
  'use strict';
  const form = document.querySelector('[data-pub-filter]');
  if (!form) return;
  const list = document.querySelector('[data-pub-list]');
  const items = Array.from(list.querySelectorAll('.pub'));
  const groups = Array.from(list.querySelectorAll('.pub-group'));
  const count = form.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  const counts = groups.map((g) => g.querySelector('.pub-group-year small'));
  const q = form.elements.q;
  const year = form.elements.year;

  const apply = () => {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((it) => {
      const ok = (!year.value || it.dataset.year === year.value) && terms.every((t) => it.dataset.text.includes(t));
      it.hidden = !ok;
      if (ok) shown += 1;
    });
    groups.forEach((g, i) => {
      const n = g.querySelectorAll('.pub:not([hidden])').length;
      g.hidden = n === 0;
      if (counts[i]) counts[i].textContent = n === 1 ? form.dataset.one : form.dataset.many.replace('{n}', n);
    });
    count.textContent = count.dataset.tpl.replace('{shown}', shown).replace('{total}', items.length);
    empty.hidden = shown > 0;
    const p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    if (year.value) p.set('year', year.value);
    const qs = p.toString();
    try { history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash); } catch (e) { /* file:// */ }
  };

  const init = new URLSearchParams(window.location.search);
  if (init.get('q')) q.value = init.get('q');
  if (init.get('year') && Array.from(year.options).some((o) => o.value === init.get('year'))) year.value = init.get('year');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  form.addEventListener('reset', () => window.setTimeout(apply, 0));
  apply();
})();
