/* Site behaviour: header state, mobile menu, reveal-on-scroll, workflow tabs, scroll-spy. No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* header shadow once the page scrolls */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* mobile menu */
    const btn = $('[data-menu]', header);
    const setOpen = (open, refocus) => {
      header.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (!open && refocus) btn.focus();
    };
    btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) setOpen(false, true);
    });
    document.addEventListener('click', (e) => {
      if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false);
    });
    $$('.nav a', header).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    window.matchMedia('(min-width: 880px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
  }

  /* in-page links scroll smoothly unless the visitor prefers reduced motion (CSS stays instant, so tools and no-JS behave) */
  if (!reduceMotion) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.getAttribute('href') === '#') return;
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', a.getAttribute('href'));
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* reveal on scroll (content is visible by default; CSS hides it only when JS runs) */
  const reveals = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  /* "How we work": turn the static list into a keyboard-operable tab set */
  $$('[data-process]').forEach((root) => {
    /* swap <ol>/<li> for plain divs: <li role="tabpanel"> is not valid ARIA, and the tab pattern replaces the list semantics */
    const ol = $('.steps', root);
    const list = document.createElement('div');
    list.className = ol.className;
    const steps = Array.from(ol.children).map((li) => {
      const d = document.createElement('div');
      d.className = li.className;
      d.id = li.id;
      d.dataset.step = li.dataset.step;
      while (li.firstChild) d.appendChild(li.firstChild);
      list.appendChild(d);
      return d;
    });
    ol.replaceWith(list);
    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.setAttribute('role', 'tablist');
    rail.setAttribute('aria-label', root.dataset.label || '');
    const tabs = steps.map((li) => {
      const id = li.dataset.step;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.id = 'tab-' + id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', li.id);
      const dot = document.createElement('span');
      dot.className = 'tab-dot';
      const ic = $('.step-icon svg', li);
      if (ic) dot.appendChild(ic.cloneNode(true));
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = $('.step-title', li).lastChild.textContent.trim();
      tab.append(dot, label);
      rail.appendChild(tab);
      li.setAttribute('role', 'tabpanel');
      li.setAttribute('aria-labelledby', tab.id);
      li.tabIndex = 0;
      return tab;
    });
    root.insertBefore(rail, list);
    root.classList.add('is-tabs');

    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle('is-done', k < i);
        steps[k].classList.toggle('is-active', on);
      });
      rail.style.setProperty('--p', String(i / (tabs.length - 1)));
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    rail.addEventListener('keydown', (e) => {
      const cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const n = tabs.length;
      const next = { ArrowRight: (cur + 1) % n, ArrowDown: (cur + 1) % n, ArrowLeft: (cur + n - 1) % n, ArrowUp: (cur + n - 1) % n, Home: 0, End: n - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(next, true);
    });
    const fromHash = () => steps.findIndex((li) => '#' + li.id === window.location.hash);
    select(Math.max(0, fromHash()));
    window.addEventListener('hashchange', () => { if (fromHash() >= 0) select(fromHash()); });
  });

  /* scroll-spy for the research side navigation */
  const spy = $('[data-spy]');
  if (spy && 'IntersectionObserver' in window) {
    const links = $$('a', spy);
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
        const a = map.get(en.target.id);
        if (a) { a.classList.add('is-current'); a.setAttribute('aria-current', 'location'); }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
})();
