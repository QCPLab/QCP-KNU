/* Site behaviour: mobile menu, anchor jumps on pages with the explainers, language switch. No dependencies. */
(() => {
  'use strict';
  try {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* mobile menu */
    const header = $('[data-header]');
    const btn = header && $('[data-menu]', header);
    if (header && btn) {
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
      const wide = window.matchMedia('(min-width: 880px)');
      const onWide = (m) => { if (m.matches) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }

    /* The explainers mount lazily, which changes the page height. Before jumping to an anchor, mount them all
       and jump afterwards, otherwise the target ends up far from where the link points. */
    const mountAll = () => {
      const LW = window.LabWidgets;
      const els = $$('[data-lab-widget]');
      if (!els.length || !LW || typeof LW.mount !== 'function') return Promise.resolve();
      return Promise.all(els.map((el) => Promise.resolve(LW.mount(el)).catch(() => null)));
    };
    const jump = (target, smooth) => target.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });

    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.getAttribute('href') === '#') return;
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!target) return;
      e.preventDefault();
      mountAll().then(() => {
        jump(target, true);
        history.pushState(null, '', a.getAttribute('href'));
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    /* arriving with #anchor on a page with explainers: wait for the mounts, then re-align (unless the visitor already moved) */
    window.addEventListener('DOMContentLoaded', () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !$$('[data-lab-widget]').length) return;
      let moved = false;
      ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, () => { moved = true; }, { once: true, passive: true }));
      mountAll().then(() => { const t = document.getElementById(id); if (t && !moved) jump(t, false); });
    });

    /* the language switch keeps the current anchor and filter state */
    const langLink = $('.nav .lang a');
    if (langLink) {
      const base = langLink.getAttribute('href');
      langLink.addEventListener('click', () => { langLink.setAttribute('href', base + window.location.search + window.location.hash); });
    }
  } catch (err) {
    /* if an enhancement fails, fall back to the plain page */
    document.documentElement.classList.remove('js');
    if (window.console) console.error('site.js:', err);
  }
})();
