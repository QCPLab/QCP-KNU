/* Research in motion: five small animations of the lab's research topics. Vanilla JS, no dependencies, no network.
   Everything that moves is computed from the equations given in the figure captions (closed form, or RK4 for the
   saturable transporter); nothing is keyed by hand. All numbers are simulated, not laboratory data. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KO = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2) === 'ko';
  const tr = (o) => (KO ? o.ko : o.en);
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => !!mq.matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ------------------------------------------------------------------ small helpers */
  let uid = 0;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const smooth = (x) => x * x * (3 - 2 * x);
  const nf = (x, d) => x.toFixed(d);
  const pct = (f) => Math.round(clamp(f, 0, 1) * 100) + (KO ? '%' : '\u00a0%');
  const U = (x, d, u) => nf(x, d) + '\u00a0' + u;
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const text = (parent, x, y, s, cls, anchor) => {
    const e = el('text', { x, y, class: 'rm-t' + (cls ? ' ' + cls : '') }, parent);
    if (anchor) e.setAttribute('text-anchor', anchor);
    e.textContent = s;
    return e;
  };
  const setText = (e, s) => { if (e.textContent !== s) e.textContent = s; };
  const mulberry = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const erfc = (x) => { // Numerical Recipes erfcc, |error| < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  };
  const pathOf = (fn, sx, sy, t0, t1, step) => {
    let d = '', t = t0;
    for (; t < t1; t += step) d += (d ? 'L' : 'M') + nf(sx(t), 1) + ' ' + nf(sy(fn(t)), 1);
    return d + (d ? 'L' : 'M') + nf(sx(t1), 1) + ' ' + nf(sy(fn(t1)), 1);
  };

  /* ------------------------------------------------------------------ models */
  /* 1 · one compartment, first-order absorption (dose = volume = 1): C(t) = ka/(ka-ke) (e^-ke t - e^-ka t) */
  const PK = { ka: 1.0, ke: [0.2, 0.1], T: 24 };
  const pkConc = (ke) => (t) => (PK.ka / (PK.ka - ke)) * (Math.exp(-ke * t) - Math.exp(-PK.ka * t));
  const pkStats = (ke) => {
    const tmax = Math.log(PK.ka / ke) / (PK.ka - ke);
    return { tmax, cmax: pkConc(ke)(tmax), t12: Math.LN2 / ke, auc: 1 / ke };
  };
  const pkRef = pkStats(PK.ke[0]);

  /* 2 · parent -> metabolite -> eliminated (IV bolus; first order): P = e^-k1 t, M = k1/(k2-k1) (e^-k1 t - e^-k2 t) */
  const MET = { k1: [0.36, 0.09], k2: 0.18, T: 24 };
  const metP = (k1) => (t) => Math.exp(-k1 * t);
  const metM = (k1) => (t) => (k1 / (MET.k2 - k1)) * (Math.exp(-k1 * t) - Math.exp(-MET.k2 * t));
  const metStats = (k1) => {
    const tmax = Math.log(MET.k2 / k1) / (MET.k2 - k1);
    return { tmax, peak: metM(k1)(tmax), t12: Math.LN2 / k1 };
  };

  /* 3 · saturable uptake with a competitive inhibitor (IV bolus, relative units):
         dC/dt = -Vmax C / (Km (1 + I/Ki) + C) = -Vmax * theta_S,  theta_S = (C/Km) / (1 + I/Ki + C/Km) */
  const TP = { vmax: 0.5, km: 0.8, inh: [0, 3], T: 24, dt: 0.01, tend: 240 };
  const tpSolve = (inh) => {
    const n = Math.round(TP.tend / TP.dt), C = new Float64Array(n + 1), U = new Float64Array(n + 1);
    const v = (c) => (TP.vmax * c) / (TP.km * (1 + inh) + c);
    C[0] = 1;
    for (let i = 0; i < n; i++) {
      const c = C[i], h = TP.dt;
      const k1 = v(c), k2 = v(c - 0.5 * h * k1), k3 = v(c - 0.5 * h * k2), k4 = v(c - h * k3);
      C[i + 1] = c - (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
      U[i + 1] = U[i] + (h * (v(C[i]) + v(C[i + 1]))) / 2; // cumulative uptake, integrated separately (mass-balance check)
    }
    let auc = 0, t50 = NaN;
    for (let i = 0; i < n; i++) {
      auc += (TP.dt * (C[i] + C[i + 1])) / 2;
      if (isNaN(t50) && C[i + 1] <= 0.5) t50 = (i + (C[i] - 0.5) / (C[i] - C[i + 1])) * TP.dt;
    }
    const at = (A) => (t) => { const x = clamp(t / TP.dt, 0, n - 1e-9), i = Math.floor(x); return A[i] + (A[i + 1] - A[i]) * (x - i); };
    return { C: at(C), U: at(U), auc, t50, inh, raw: { C, U } };
  };
  let tpCache = null;
  const tp = () => tpCache || (tpCache = TP.inh.map(tpSolve));
  const theta = (inh, c) => { const s = c / TP.km, d = 1 + inh + s; return { s: s / d, i: inh / d }; };
  const thetaMax = theta(0, 1).s;

  /* 4 · fit a one-compartment oral model to simulated data (Levenberg-Marquardt on log residuals), then predict */
  const FIT = { D: 100, T: 48, tau: 12, times: [0.5, 1, 2, 3, 4, 6, 8, 12, 24], truth: [1.1, 4.0, 30], start: [0.35, 9, 55], sigma: 0.08, seed: 20241014 };
  const fitConc = (th, t) => { // th = [ln ka, ln CL/F, ln V/F]
    const ka = Math.exp(th[0]), cl = Math.exp(th[1]), v = Math.exp(th[2]), ke = cl / v;
    const d = Math.abs(ka - ke) < 1e-7 ? 1e-7 : ka - ke;
    return ((FIT.D * ka) / (v * d)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
  };
  const solve3 = (A, b) => { // Gaussian elimination, 3x3, partial pivoting
    const M = A.map((r, i) => r.concat(b[i]));
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < 3; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = [0, 0, 0];
    for (let r = 2; r >= 0; r--) { let s = M[r][3]; for (let k = r + 1; k < 3; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  };
  let fitCache = null;
  const fitData = () => {
    if (fitCache) return fitCache;
    const rnd = mulberry(FIT.seed), th0 = FIT.truth.map(Math.log);
    const obs = FIT.times.map((t) => fitConc(th0, t) * Math.exp(FIT.sigma * gauss(rnd)));
    const resid = (th) => obs.map((o, i) => Math.log(o) - Math.log(Math.max(fitConc(th, FIT.times[i]), 1e-12)));
    const ssq = (r) => r.reduce((s, x) => s + x * x, 0);
    let th = FIT.start.map(Math.log), r = resid(th), s = ssq(r), lam = 0.01;
    const path = [{ th: th.slice(), s }];
    for (let it = 0; it < 80; it++) {
      const J = FIT.times.map(() => [0, 0, 0]);
      for (let j = 0; j < 3; j++) {
        const h = 1e-6, t2 = th.slice(); t2[j] += h;
        const r2 = resid(t2);
        for (let i = 0; i < J.length; i++) J[i][j] = (r2[i] - r[i]) / h;
      }
      const A = [0, 1, 2].map((a) => [0, 1, 2].map((b) => J.reduce((q, row) => q + row[a] * row[b], 0)));
      const g = [0, 1, 2].map((a) => J.reduce((q, row, i) => q + row[a] * r[i], 0));
      let gain = 0;
      for (let k = 0; k < 14 && !gain; k++) {
        const M = A.map((row, i) => row.map((v, j) => (i === j ? v * (1 + lam) : v)));
        const d = solve3(M, g.map((x) => -x));
        const th2 = th.map((x, j) => x + d[j]), r2 = resid(th2), s2 = ssq(r2);
        if (isFinite(s2) && s2 < s) { gain = s - s2; th = th2; r = r2; s = s2; lam = Math.max(lam / 3, 1e-9); path.push({ th: th.slice(), s }); }
        else lam *= 4;
      }
      if (!gain || gain < 1e-6 * (1 + s)) break;
    }
    return (fitCache = { obs, path });
  };
  const fitMulti = (th) => (t) => { // repeated dosing by superposition: D every tau h from t = 0
    let c = 0;
    for (let k = 0; k * FIT.tau <= t + 1e-9; k++) c += fitConc(th, t - k * FIT.tau);
    return c;
  };

  /* 5 · LC-MS/MS: peaks (exponentially modified Gaussian), weighted calibration, back-calculation */
  const BIO = { rt: 1.62, shift: -0.006, sigma: 0.028, tau: 0.05, Tmax: 3, dt: 0.006, win: [1.34, 2.05], conc: 12,
    cal: [1, 2, 5, 10, 25, 50], slope: 0.046, icpt: 0.004, seed: 4711 };
  const emg = (t, mu) => {
    const s = BIO.sigma, k = BIO.tau;
    return Math.exp((s * s) / (2 * k * k) - (t - mu) / k) * erfc((mu + (s * s) / k - t) / (s * Math.SQRT2));
  };
  let bioCache = null;
  const bioData = () => {
    if (bioCache) return bioCache;
    const rnd = mulberry(BIO.seed), n = Math.round(BIO.Tmax / BIO.dt), ts = [], an = [], is = [];
    let mx = 0;
    for (let t = BIO.rt - 0.5; t < BIO.rt + 0.5; t += 0.001) mx = Math.max(mx, emg(t, BIO.rt));
    const ratio = BIO.slope * BIO.conc + BIO.icpt;
    for (let i = 0; i <= n; i++) {
      const t = i * BIO.dt;
      ts.push(t);
      is.push(100 * emg(t, BIO.rt) / mx + 1 + 0.45 * gauss(rnd));
      an.push(100 * ratio * emg(t, BIO.rt + BIO.shift) / mx + 1 + 0.45 * gauss(rnd));
    }
    const base = (a) => { let s = 0, c = 0; for (let i = 0; i < ts.length; i++) if (ts[i] < 1.0) { s += a[i]; c++; } return s / c; };
    const bA = base(an), bI = base(is);
    const area = (a, b, tEnd) => { let s = 0; for (let i = 0; i < ts.length - 1; i++) if (ts[i] >= BIO.win[0] && ts[i + 1] <= Math.min(BIO.win[1], tEnd)) s += BIO.dt * ((a[i] - b + a[i + 1] - b) / 2); return s; };
    const aA = area(an, bA, 9), aI = area(is, bI, 9);
    const calRatio = BIO.cal.map((c) => (BIO.slope * c + BIO.icpt) * Math.exp(0.03 * gauss(rnd)));
    // weighted least squares, w = 1/x^2
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    BIO.cal.forEach((x, i) => { const w = 1 / (x * x), y = calRatio[i]; sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y; });
    const b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), a = (sy - b * sx) / sw;
    const sample = aA / aI;
    return (bioCache = { ts, an, is, bA, bI, area, aA, aI, calRatio, a, b, sample, back: (sample - a) / b });
  };

  /* ------------------------------------------------------------------ drawing blocks */
  const FW = 214, GAP = 26;
  /* wide: 10 x 4 squares in a 214 px column beside the plot; narrow: 20 x 2 squares across the full width above it */
  const geoFor = (W) => {
    if (W >= 560) return { cols: 10, rows: 4, P: 14, SQ: 11, TW: 137, W: FW, sw: 11, sh: 11, sp: 14 };
    const P = clamp(Math.floor(W / 20), 10, 18);
    return { cols: 20, rows: 2, P, SQ: P - 3, TW: 20 * P - 3, W, sw: 2 * P - 3, sh: 20, sp: 2 * P };
  };

  /* a column of 'trays' of unit squares (each square = 2.5 % of the dose) joined by arrows whose width follows the flux */
  function flowPanel(g, x, y, letter, blocks, G) {
    text(g, x, y + 14, letter, 'ink letter');
    let cy = y + 28;
    const out = { fill: {}, sites: {}, val: {}, arrow: {}, H: 0 };
    blocks.forEach((b, i) => {
      b.top = cy;
      text(g, x, cy + 12, b.title, 'ink');
      if (b.kind === 'fill') {
        const gy = cy + 20, sq = [];
        out.val[i] = text(g, x + G.TW, cy + 12, '', 'val', 'end');
        for (let k = 0; k < G.cols * G.rows; k++) {
          const sx = x + (k % G.cols) * G.P, sy = gy + (G.rows - 1 - Math.floor(k / G.cols)) * G.P;
          el('rect', { x: sx, y: sy, width: G.SQ, height: G.SQ, class: 'sq-0' }, g);
          sq.push(el('rect', { x: sx, y: sy, width: G.SQ, height: G.SQ, class: b.cls, 'fill-opacity': 0 }, g));
        }
        out.fill[i] = { sq, prev: new Array(sq.length).fill(-1) };
        b.bottom = gy + (G.rows - 1) * G.P + G.SQ;
      } else {
        const gy = cy + 26, A = [], B = [];
        el('rect', { x: x - 4, y: gy - 5, width: G.TW + 8, height: G.sh + 10, class: 'membrane' }, g);
        for (let k = 0; k < 10; k++) {
          const sx = x + k * G.sp + (G.TW - 9 * G.sp - G.sw) / 2;
          el('rect', { x: sx + 0.5, y: gy + 0.5, width: G.sw - 1, height: G.sh - 1, class: 'sq-free' }, g);
          A.push(el('rect', { x: sx, y: gy, width: G.sw, height: G.sh, class: 'sq-a', 'fill-opacity': 0 }, g));
          B.push(el('rect', { x: sx, y: gy, width: G.sw, height: G.sh, class: 'sq-b', 'fill-opacity': 0 }, g));
        }
        out.sites[i] = { A, B, pa: new Array(10).fill(-1), pb: new Array(10).fill(-1) };
        let kx = x, ky = gy + G.sh + 22;
        b.key.forEach((it) => {
          const lab = text(g, 0, ky, it.label, 'key'), w = lab.getComputedTextLength();
          if (kx + 14 + w > x + G.W && kx > x) { kx = x; ky += 17; }
          if (it.cls === 'sq-free') el('rect', { x: kx + 0.5, y: ky - 8.5, width: 8, height: 8, class: 'sq-free' }, g);
          else el('rect', { x: kx, y: ky - 9, width: 9, height: 9, class: it.cls }, g);
          lab.setAttribute('x', kx + 14); lab.setAttribute('y', ky);
          kx += 14 + w + 14;
        });
        b.bottom = ky + 3;
      }
      cy = b.bottom + 44;
    });
    out.H = blocks[blocks.length - 1].bottom + 2;
    blocks.forEach((b, i) => {
      if (i === blocks.length - 1) return;
      const ax = x + 10, y1 = b.bottom + 7, y2 = blocks[i + 1].top - 3;
      const line = el('line', { x1: ax, x2: ax, y1, y2: y2 - 7, class: 'arrow', 'stroke-width': 1 }, g);
      el('polygon', { points: `${ax - 4.5},${y2 - 8} ${ax + 4.5},${y2 - 8} ${ax},${y2}`, class: 'arrow-head' }, g);
      if (b.arrow) text(g, x + 26, (y1 + y2) / 2 + 3, b.arrow, 'key');
      out.arrow[i] = line;
    });
    out.setFill = (i, f) => {
      const F = out.fill[i], n = clamp(f, 0, 1) * F.sq.length;
      for (let k = 0; k < F.sq.length; k++) {
        const o = Math.round(clamp(n - k, 0, 1) * 100) / 100;
        if (F.prev[k] !== o) { F.prev[k] = o; F.sq[k].setAttribute('fill-opacity', o); }
      }
      setText(out.val[i], pct(f));
    };
    out.setSites = (i, a, b) => { // a, b: numbers of sites held by substrate / inhibitor (whole sites)
      const S = out.sites[i];
      for (let k = 0; k < 10; k++) {
        const oa = k < a ? 1 : 0, ob = k >= 10 - b ? 1 : 0;
        if (S.pa[k] !== oa) { S.pa[k] = oa; S.A[k].setAttribute('fill-opacity', oa); }
        if (S.pb[k] !== ob) { S.pb[k] = ob; S.B[k].setAttribute('fill-opacity', ob); }
      }
    };
    out.setArrow = (i, w) => out.arrow[i].setAttribute('stroke-width', nf(w, 2));
    return out;
  }

  /* axes, legend and a clipped layer for the moving parts */
  function plotPanel(g, box, o) {
    const id = 'rmc' + ++uid;
    let lx = box.x, ly = box.y + 36;
    if (o.letter) text(g, box.x, box.y + 14, o.letter, 'ink letter');
    text(g, box.x + (o.letter ? 22 : 0), box.y + 14, o.ylabel);
    (o.legend || []).forEach((it) => {
      const lab = text(g, 0, ly, it.label, 'key'), w = lab.getComputedTextLength(), sw = it.kind === 'area' ? 14 : 20;
      if (lx + sw + 6 + w > box.x + box.w && lx > box.x) { lx = box.x; ly += 18; }
      if (it.kind === 'dot') el('circle', { cx: lx + sw / 2, cy: ly - 4, r: 3.5, class: it.cls }, g);
      else if (it.kind === 'area') el('rect', { x: lx, y: ly - 9, width: sw, height: 9, class: it.cls }, g);
      else el('line', { x1: lx, x2: lx + sw, y1: ly - 4, y2: ly - 4, class: 'rm-curve ' + it.cls + (it.kind === 'dash' ? ' dash' : '') }, g);
      lab.setAttribute('x', lx + sw + 6); lab.setAttribute('y', ly);
      lx += sw + 6 + w + 16;
    });
    const top = ly + 12, x0 = box.x + 40, w = box.w - 40 - 12, y0 = box.y + box.h - 38, h = y0 - top;
    const sx = (v) => x0 + ((v - o.xd[0]) / (o.xd[1] - o.xd[0])) * w;
    const sy = (v) => y0 - ((v - o.yd[0]) / (o.yd[1] - o.yd[0])) * h;
    o.yticks.forEach((v) => {
      if (v > o.yd[0]) el('line', { x1: x0, x2: x0 + w, y1: sy(v), y2: sy(v), class: 'rm-grid' }, g);
      el('line', { x1: x0 - 4, x2: x0, y1: sy(v), y2: sy(v), class: 'rm-axis' }, g);
      text(g, x0 - 8, sy(v) + 4, o.yfmt ? o.yfmt(v) : String(v), '', 'end');
    });
    o.xticks.forEach((v) => {
      el('line', { x1: sx(v), x2: sx(v), y1: y0, y2: y0 + 4, class: 'rm-axis' }, g);
      text(g, sx(v), y0 + 18, String(v), '', 'middle');
    });
    el('line', { x1: x0, x2: x0, y1: top, y2: y0, class: 'rm-axis' }, g);
    el('line', { x1: x0, x2: x0 + w, y1: y0, y2: y0, class: 'rm-axis' }, g);
    text(g, x0 + w, y0 + 34, o.xlabel, '', 'end');
    el('clipPath', { id }, el('defs', null, g)).appendChild(el('rect', { x: x0 - 4, y: top - 4, width: w + 8, height: h + 8 }));
    const dyn = el('g', { 'clip-path': `url(#${id})` }, g);
    return { sx, sy, dyn, x0, y0, w, h, top };
  }
  const curve = (dyn, cls) => el('path', { class: 'rm-curve ' + cls, d: '' }, dyn);
  const dot = (dyn, cls, r) => el('circle', { r: r || 4, class: cls, cx: -20, cy: -20 }, dyn);
  const vline = (dyn, y0, top) => el('line', { class: 'rm-cursor', x1: -20, x2: -20, y1: y0, y2: top }, dyn);

  function twoPanels(W, flowH) {
    if (W >= 560) return { plot: { x: FW + GAP, y: 0, w: W - FW - GAP, h: Math.max(flowH, 300) }, H: Math.max(flowH, 300) };
    return { plot: { x: 0, y: flowH + 22, w: W, h: 270 }, H: flowH + 22 + 270 };
  }
  const xt = (W, wide, narrow) => (W >= 560 ? wide : narrow);

  /* ------------------------------------------------------------------ strings shared by the scenes */
  const UI = {
    play: { en: 'Play', ko: '재생' }, pause: { en: 'Pause', ko: '일시정지' }, replay: { en: 'Replay', ko: '다시 재생' },
    time: { en: 'Time', ko: '시간' }, cond: { en: 'Condition', ko: '조건' }, result: { en: 'Result', ko: '결과' },
    tlabel: { en: 'Time (h)', ko: '시간 (h)' }
  };

  /* ------------------------------------------------------------------ scenes */
  const SCENES = {};

  /* 1 · pharmacokinetics */
  SCENES.pk = {
    dur: 11,
    alt: { en: 'Animation: share of an oral dose at the dose site, in plasma and eliminated, beside the plasma concentration–time curve.', ko: '애니메이션: 경구 투여량이 투여 부위·혈장·소실로 옮겨 가는 비율과 혈장 농도–시간 곡선.' },
    opts: [{ en: 'Reference', ko: '기준' }, { en: 'Clearance halved', ko: '청소율 절반' }],
    build({ svg, W, opt }) {
      const ke = PK.ke[opt], st = pkStats(ke), ref = pkStats(PK.ke[0]);
      const C = (k) => { const f = pkConc(k); return (t) => f(t) / pkRef.cmax; };
      const flow = flowPanel(svg, 0, 0, 'A', [
        { kind: 'fill', title: tr({ en: 'Dose site', ko: '투여 부위' }), cls: 'sq-blue', arrow: tr({ en: 'absorption', ko: '흡수' }) },
        { kind: 'fill', title: tr({ en: 'Plasma', ko: '혈장' }), cls: 'sq-a', arrow: tr({ en: 'elimination', ko: '소실' }) },
        { kind: 'fill', title: tr({ en: 'Eliminated', ko: '소실됨' }), cls: 'sq-grey' }], geoFor(W));
      const L = twoPanels(W, flow.H);
      const pl = plotPanel(svg, L.plot, { letter: 'B', ylabel: tr({ en: 'Plasma concentration (relative)', ko: '혈장 농도 (상대값)' }),
        xlabel: tr(UI.tlabel), xd: [0, PK.T], yd: [0, 1.3], xticks: xt(W, [0, 6, 12, 18, 24], [0, 12, 24]), yticks: [0, 0.5, 1],
        yfmt: (v) => nf(v, 1), legend: opt ? [{ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Reference', ko: '기준' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Clearance halved', ko: '청소율 절반' }) }]
          : [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Reference', ko: '기준' }) }] });
      const cRef = opt ? curve(pl.dyn, 'c-grey dash') : null, cCur = curve(pl.dyn, 'c-a'), cur = vline(pl.dyn, pl.y0, pl.top), pt = dot(pl.dyn, 'dot-a');
      const fRef = C(PK.ke[0]), fCur = C(ke), step = PK.T / 240;
      const fluxA = PK.ka, fluxE = Math.max(PK.ke[0] * pkRef.cmax, PK.ke[1] * pkStats(PK.ke[1]).cmax);
      return {
        H: L.H,
        draw(u) {
          const t = u * PK.T, dep = Math.exp(-PK.ka * t), cen = (PK.ka / (PK.ka - ke)) * (Math.exp(-ke * t) - Math.exp(-PK.ka * t));
          flow.setFill(0, dep); flow.setFill(1, cen); flow.setFill(2, 1 - dep - cen);
          flow.setArrow(0, 1 + 5 * (PK.ka * dep) / fluxA); flow.setArrow(1, 1 + 5 * (ke * cen) / fluxE);
          if (cRef) cRef.setAttribute('d', pathOf(fRef, pl.sx, pl.sy, 0, t, step));
          cCur.setAttribute('d', pathOf(fCur, pl.sx, pl.sy, 0, t, step));
          cur.setAttribute('x1', pl.sx(t)); cur.setAttribute('x2', pl.sx(t));
          pt.setAttribute('cx', pl.sx(t)); pt.setAttribute('cy', pl.sy(fCur(t)));
        },
        readout: (u) => tr({ en: 't = ', ko: 't = ' }) + nf(u * PK.T, 1) + ' h'
      };
    }
  };

  SCENES.pk.poster = 0.35;
  SCENES.pk.result = (opt) => {
    const st = pkStats(PK.ke[opt]), ref = pkStats(PK.ke[0]);
    return opt
      ? tr({ en: `Clearance halved: AUC(0–∞) ×${nf(st.auc / ref.auc, 1)}, half-life ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, peak concentration ×${nf(st.cmax / ref.cmax, 2)}.`,
            ko: `청소율 절반: AUC(0–∞) ×${nf(st.auc / ref.auc, 1)}, 반감기 ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, 최고 농도 ×${nf(st.cmax / ref.cmax, 2)}.` })
      : tr({ en: `Reference: peak at ${U(st.tmax, 1, 'h')}, half-life ${U(st.t12, 1, 'h')}.`, ko: `기준: 최고 농도 시점 ${U(st.tmax, 1, 'h')}, 반감기 ${U(st.t12, 1, 'h')}.` });
  };

  /* 2 · metabolism */
  SCENES.metabolism = {
    dur: 11,
    alt: { en: 'Animation: share of the dose as parent drug, metabolite and eliminated, beside the amounts over time.', ko: '애니메이션: 투여량이 모약물·대사체·소실로 나뉘는 비율과 시간에 따른 양의 변화.' },
    opts: [{ en: 'Typical metabolism', ko: '기준 대사' }, { en: 'Enzyme inhibited', ko: '대사효소 억제' }],
    build({ svg, W, opt }) {
      const k1 = MET.k1[opt], st = metStats(k1), ref = metStats(MET.k1[0]);
      const flow = flowPanel(svg, 0, 0, 'A', [
        { kind: 'fill', title: tr({ en: 'Parent drug', ko: '모약물' }), cls: 'sq-a', arrow: tr({ en: 'metabolism', ko: '대사' }) },
        { kind: 'fill', title: tr({ en: 'Metabolite', ko: '대사체' }), cls: 'sq-b', arrow: tr({ en: 'elimination', ko: '소실' }) },
        { kind: 'fill', title: tr({ en: 'Eliminated', ko: '소실됨' }), cls: 'sq-grey' }], geoFor(W));
      const L = twoPanels(W, flow.H);
      const legend = [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Parent drug', ko: '모약물' }) }, { kind: 'line', cls: 'c-b', label: tr({ en: 'Metabolite', ko: '대사체' }) }];
      if (opt) legend.push({ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Typical metabolism', ko: '기준 대사' }) });
      const pl = plotPanel(svg, L.plot, { letter: 'B', ylabel: tr({ en: 'Amount (% of dose, molar)', ko: '양 (투여량의 %, 몰 기준)' }),
        xlabel: tr(UI.tlabel), xd: [0, MET.T], yd: [0, 100], xticks: xt(W, [0, 6, 12, 18, 24], [0, 12, 24]), yticks: [0, 25, 50, 75, 100], legend });
      const g1 = opt ? curve(pl.dyn, 'c-a ghost') : null, g2 = opt ? curve(pl.dyn, 'c-b ghost') : null;
      const cP = curve(pl.dyn, 'c-a'), cM = curve(pl.dyn, 'c-b'), cur = vline(pl.dyn, pl.y0, pl.top);
      const step = MET.T / 240, P0 = metP(MET.k1[0]), M0 = metM(MET.k1[0]), P1 = metP(k1), M1 = metM(k1);
      const sc = (f) => (t) => 100 * f(t);
      const fluxMax = MET.k1[0], fluxMaxE = MET.k2 * Math.max(metStats(MET.k1[0]).peak, metStats(MET.k1[1]).peak);
      return {
        H: L.H,
        draw(u) {
          const t = u * MET.T, p = P1(t), m = M1(t);
          flow.setFill(0, p); flow.setFill(1, m); flow.setFill(2, 1 - p - m);
          flow.setArrow(0, 1 + 5 * (k1 * p) / fluxMax); flow.setArrow(1, 1 + 5 * (MET.k2 * m) / fluxMaxE);
          if (g1) { g1.setAttribute('d', pathOf(sc(P0), pl.sx, pl.sy, 0, t, step)); g2.setAttribute('d', pathOf(sc(M0), pl.sx, pl.sy, 0, t, step)); }
          cP.setAttribute('d', pathOf(sc(P1), pl.sx, pl.sy, 0, t, step)); cM.setAttribute('d', pathOf(sc(M1), pl.sx, pl.sy, 0, t, step));
          cur.setAttribute('x1', pl.sx(t)); cur.setAttribute('x2', pl.sx(t));
        },
        readout: (u) => 't = ' + nf(u * MET.T, 1) + ' h'
      };
    }
  };

  SCENES.metabolism.poster = 0.35;
  SCENES.metabolism.result = (opt) => {
    const st = metStats(MET.k1[opt]), ref = metStats(MET.k1[0]);
    return opt
      ? tr({ en: `Enzyme inhibited: parent half-life ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}; metabolite peak ${nf(100 * ref.peak, 0)} → ${nf(100 * st.peak, 0)} % of the dose, at ${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')}.`,
            ko: `대사효소 억제: 모약물 반감기 ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, 대사체 최고량 투여량의 ${nf(100 * ref.peak, 0)} → ${nf(100 * st.peak, 0)}%(${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')} 시점).` })
      : tr({ en: `Typical metabolism: parent half-life ${U(st.t12, 1, 'h')}; the metabolite peaks at ${U(st.tmax, 1, 'h')} with ${nf(100 * st.peak, 0)} % of the dose.`,
            ko: `기준 대사: 모약물 반감기 ${U(st.t12, 1, 'h')}, 대사체는 ${U(st.tmax, 1, 'h')}에 투여량의 ${nf(100 * st.peak, 0)}%로 최고.` });
  };

  /* 3 · transporters and interactions */
  SCENES.transport = {
    dur: 12,
    alt: { en: 'Animation: transporter sites occupied by substrate and inhibitor, the share of the dose in plasma and taken up into the liver, and the plasma concentration–time curve.', ko: '애니메이션: 기질과 저해제가 차지하는 수송체 결합 부위, 혈장과 간으로 흡수된 투여량의 비율, 혈장 농도–시간 곡선.' },
    opts: [{ en: 'Substrate alone', ko: '단독 투여' }, { en: 'With inhibitor', ko: '저해제 병용' }],
    build({ svg, W, opt }) {
      const sol = tp()[opt], alone = tp()[0], inh = TP.inh[opt];
      const flow = flowPanel(svg, 0, 0, 'A', [
        { kind: 'fill', title: tr({ en: 'Plasma (substrate)', ko: '혈장 (기질)' }), cls: 'sq-a' },
        { kind: 'sites', title: tr({ en: 'Transporter sites', ko: '수송체 결합 부위' }),
          key: [{ cls: 'sq-a', label: tr({ en: 'substrate', ko: '기질' }) }, { cls: 'sq-b', label: tr({ en: 'inhibitor', ko: '저해제' }) }, { cls: 'sq-free', label: tr({ en: 'free', ko: '빈 자리' }) }] },
        { kind: 'fill', title: tr({ en: 'Taken up (liver)', ko: '간으로 흡수' }), cls: 'sq-blue' }], geoFor(W));
      const L = twoPanels(W, flow.H);
      const pl = plotPanel(svg, L.plot, { letter: 'B', ylabel: tr({ en: 'Plasma concentration (relative)', ko: '혈장 농도 (상대값)' }),
        xlabel: tr(UI.tlabel), xd: [0, TP.T], yd: [0, 1], xticks: xt(W, [0, 6, 12, 18, 24], [0, 12, 24]), yticks: [0, 0.5, 1], yfmt: (v) => nf(v, 1),
        legend: opt ? [{ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Substrate alone', ko: '단독 투여' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'With inhibitor', ko: '저해제 병용' }) }]
          : [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Substrate alone', ko: '단독 투여' }) }] });
      const cRef = opt ? curve(pl.dyn, 'c-grey dash') : null, cCur = curve(pl.dyn, 'c-a'), cur = vline(pl.dyn, pl.y0, pl.top), pt = dot(pl.dyn, 'dot-a');
      const step = TP.T / 240;
      return {
        H: L.H,
        draw(u) {
          const t = u * TP.T, c = sol.C(t), th = theta(inh, c);
          const na = Math.round(th.s * 10), nb = Math.min(10 - na, Math.round(th.i * 10));
          flow.setFill(0, c); flow.setFill(2, sol.U(t)); flow.setSites(1, na, nb);
          const w = 1 + 5 * (th.s / thetaMax);
          flow.setArrow(0, w); flow.setArrow(1, w);
          if (cRef) cRef.setAttribute('d', pathOf(alone.C, pl.sx, pl.sy, 0, t, step));
          cCur.setAttribute('d', pathOf(sol.C, pl.sx, pl.sy, 0, t, step));
          cur.setAttribute('x1', pl.sx(t)); cur.setAttribute('x2', pl.sx(t));
          pt.setAttribute('cx', pl.sx(t)); pt.setAttribute('cy', pl.sy(c));
        },
        readout: (u) => 't = ' + nf(u * TP.T, 1) + ' h'
      };
    }
  };

  SCENES.transport.poster = 0.3;
  SCENES.transport.result = (opt) => {
    const sol = tp()[opt], alone = tp()[0];
    return opt
      ? tr({ en: `With inhibitor: AUC(0–∞) ×${nf(sol.auc / alone.auc, 1)}; the concentration falls to 50 % at ${nf(alone.t50, 1)} → ${U(sol.t50, 1, 'h')}.`,
            ko: `저해제 병용: AUC(0–∞) ×${nf(sol.auc / alone.auc, 1)}, 농도가 50%로 떨어지는 시점 ${nf(alone.t50, 1)} → ${U(sol.t50, 1, 'h')}.` })
      : tr({ en: `Substrate alone: the concentration falls to 50 % at ${U(sol.t50, 1, 'h')}.`, ko: `단독 투여: 농도가 50%로 떨어지는 시점 ${U(sol.t50, 1, 'h')}.` });
  };

  /* 4 · modelling: fit, then predict */
  SCENES.modeling = {
    dur: 15,
    alt: { en: 'Animation: simulated measurements, a model curve converging on them as its parameters are fitted, then a prediction for repeated dosing.', ko: '애니메이션: 모의 측정값, 모형 매개변수를 적합하며 곡선이 측정값에 수렴하는 과정, 반복 투여 예측.' },
    opts: null,
    build({ svg, W }) {
      const { obs, path } = fitData();
      const thAt = (q) => { const x = clamp(q, 0, path.length - 1), i = Math.min(Math.floor(x), path.length - 2), f = x - i; return path[i].th.map((v, j) => v + (path[i + 1].th[j] - v) * f); };
      const ssqAt = (th) => FIT.times.reduce((s, t, i) => s + Math.pow(Math.log(obs[i]) - Math.log(fitConc(th, t)), 2), 0);
      const x = 0, fl = svg, tw = W >= 560 ? FW - 20 : W;
      text(fl, x, 14, 'A', 'ink letter');
      const phases = [tr({ en: '1 Measure', ko: '1 측정' }), tr({ en: '2 Fit', ko: '2 적합' }), tr({ en: '3 Predict', ko: '3 예측' })];
      const ph = []; let px = x + 24;
      phases.forEach((s, i) => { const e = text(fl, px, 14, s, 'phase'); px += e.getComputedTextLength() + 16; ph.push(e); });
      const rows = [['ka (h⁻¹)', 2], ['CL/F (L/h)', 2], ['V/F (L)', 1], [tr({ en: 'Sum of squares', ko: '잔차제곱합' }), 3]];
      const vals = rows.map((r, i) => { text(fl, x, 62 + i * 30, r[0], 'ink'); return text(fl, x + tw, 62 + i * 30, '', 'val', 'end'); });
      el('line', { x1: x, x2: x + tw, y1: 40, y2: 40, class: 'rm-grid' }, fl);
      const note = text(fl, x, 62 + rows.length * 30 + 4, '', 'key');
      const H0 = 62 + rows.length * 30 + 14;
      const L = W >= 560 ? { plot: { x: FW + GAP - 20, y: 0, w: W - FW - GAP + 20, h: 300 }, H: 300 } : { plot: { x: 0, y: H0 + 18, w: W, h: 280 }, H: H0 + 18 + 280 };
      let top = 0; const mm = fitMulti(path[path.length - 1].th);
      for (let t = 0; t <= FIT.T; t += 0.1) top = Math.max(top, mm(t));
      const ymax = Math.ceil((top * 1.08) / 0.5) * 0.5;
      const pl = plotPanel(svg, L.plot, { letter: 'B', ylabel: tr({ en: 'Concentration (mg/L)', ko: '농도 (mg/L)' }), xlabel: tr(UI.tlabel), xd: [0, FIT.T], yd: [0, ymax],
        xticks: xt(W, [0, 12, 24, 36, 48], [0, 24, 48]), yticks: Array.from({ length: Math.floor(ymax) + 1 }, (_, i) => i),
        legend: [{ kind: 'dot', cls: 'dot-b', label: tr({ en: 'Measured (simulated)', ko: '모의 측정값' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Model', ko: '모형' }) },
          { kind: 'dash', cls: 'c-a', label: tr({ en: 'Prediction: 100 mg every 12 h', ko: '예측: 12시간마다 100 mg' }) }] });
      const edge = el('line', { class: 'rm-grid dash', x1: pl.sx(24), x2: pl.sx(24), y1: pl.top, y2: pl.y0 }, pl.dyn);
      const pts = FIT.times.map((t, i) => el('circle', { cx: pl.sx(t), cy: pl.sy(obs[i]), r: 4, class: 'dot-b', 'fill-opacity': 0 }, pl.dyn));
      const cFit = curve(pl.dyn, 'c-a'), cPred = curve(pl.dyn, 'c-a dash'), step = FIT.T / 240;
      const final = path[path.length - 1], thF = final.th;
      return {
        H: L.H,
        draw(u) {
          const a = seg(u, 0.02, 0.22), qIdx = smooth(seg(u, 0.26, 0.64)) * (path.length - 1), th = thAt(qIdx);
          pts.forEach((p, i) => p.setAttribute('fill-opacity', clamp(a * FIT.times.length - i, 0, 1).toFixed(2)));
          const showCurve = u >= 0.22;
          cFit.setAttribute('d', showCurve ? pathOf((t) => fitConc(th, t), pl.sx, pl.sy, 0, 24, 0.2) : '');
          const tp_ = u > 0.7 ? FIT.T * seg(u, 0.7, 0.96) : 0, multi = fitMulti(thF);
          cPred.setAttribute('d', u > 0.7 ? pathOf(multi, pl.sx, pl.sy, 0, tp_, step) : '');
          const active = u < 0.22 ? 0 : u < 0.7 ? 1 : 2;
          ph.forEach((e, i) => e.setAttribute('class', 'rm-t phase' + (i === active ? ' on' : '')));
          const v = [Math.exp(th[0]), Math.exp(th[1]), Math.exp(th[2]), ssqAt(th)];
          vals.forEach((e, i) => setText(e, nf(v[i], rows[i][1])));
          setText(note, u < 0.22 ? tr({ en: 'Starting values (a guess)', ko: '초기 추정값' }) : u < 0.7 ? tr({ en: 'Levenberg–Marquardt steps', ko: 'Levenberg–Marquardt 반복' }) : tr({ en: 'Fitted values', ko: '적합 결과' }));
        },
        readout: (u) => (u < 0.22 ? tr({ en: 'Measuring', ko: '측정' }) : u < 0.7 ? tr({ en: 'Fitting', ko: '적합' }) : tr({ en: 'Predicting', ko: '예측' }))
      };
    }
  };

  SCENES.modeling.result = () => {
    const thF = fitData().path.slice(-1)[0].th, m = fitMulti(thF);
    let pk = 0; for (let t = 36; t <= 48; t += 0.05) pk = Math.max(pk, m(t));
    const tro = m(48), ka = nf(Math.exp(thF[0]), 2), cl = nf(Math.exp(thF[1]), 1), v = nf(Math.exp(thF[2]), 0);
    const tru = nf(FIT.truth[0], 1) + ', ' + nf(FIT.truth[1], 1) + ', ' + nf(FIT.truth[2], 0);
    return tr({ en: `Fitted ka ${ka} h⁻¹, CL/F ${cl} L/h, V/F ${v} L (values used to simulate: ${tru}). Predicted between 36 and 48\u00a0h: peak ${nf(pk, 1)}, trough ${nf(tro, 1)} mg/L.`,
                ko: `적합 결과 ka ${ka} h⁻¹, CL/F ${cl} L/h, V/F ${v} L (모의에 쓴 값: ${tru}). 36~48\u00a0h 예측: 최고 ${nf(pk, 1)}, 최저 ${nf(tro, 1)} mg/L.` });
  };

  /* 5 · bioanalysis */
  SCENES.bioanalysis = {
    dur: 17,
    alt: { en: 'Animation: LC-MS/MS chromatogram of an analyte and its internal standard, then a calibration curve and the back-calculated sample concentration.', ko: '애니메이션: 분석물질과 내부표준물질의 LC-MS/MS 크로마토그램, 검량선, 시료 농도 역산.' },
    opts: null,
    build({ svg, W }) {
      const D = bioData(), wide = W >= 560, hw = wide ? Math.floor((W - 30) / 2) : W, ph = wide ? 300 : 250;
      const boxA = { x: 0, y: 0, w: hw, h: ph }, boxB = wide ? { x: hw + 30, y: 0, w: W - hw - 30, h: ph } : { x: 0, y: ph + 20, w: W, h: ph };
      const H = wide ? ph : 2 * ph + 20;
      const A = plotPanel(svg, boxA, { letter: 'A', ylabel: tr({ en: 'Intensity (% of internal standard peak)', ko: '강도 (내부표준 피크 대비 %)' }), xlabel: tr({ en: 'Retention time (min)', ko: '머무름 시간 (min)' }),
        xd: [0, BIO.Tmax], yd: [0, 110], xticks: [0, 1, 2, 3], yticks: [0, 50, 100],
        legend: [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Analyte', ko: '분석물질' }) }, { kind: 'line', cls: 'c-ink', label: tr({ en: 'Internal standard (SIL-IS)', ko: '내부표준물질 (SIL-IS)' }) }] });
      const B = plotPanel(svg, boxB, { letter: 'B', ylabel: tr({ en: 'Analyte / IS peak-area ratio', ko: '분석물질/IS 피크 면적비' }), xlabel: tr({ en: 'Concentration (ng/mL)', ko: '농도 (ng/mL)' }),
        xd: [0, 60], yd: [0, 2.5], xticks: [0, 20, 40, 60], yticks: [0, 1, 2],
        legend: [{ kind: 'dot', cls: 'dot-b', label: tr({ en: 'Calibrators', ko: '검량선 표준시료' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Weighted fit (1/x²)', ko: '가중 회귀 (1/x²)' }) }, { kind: 'dash', cls: 'c-ink', label: tr({ en: 'Sample', ko: '측정 시료' }) }] });
      const aI = el('path', { class: 'area-ink', d: '' }, A.dyn), aA = el('path', { class: 'area-a', d: '' }, A.dyn);
      const tI = curve(A.dyn, 'c-ink thin'), tA = curve(A.dyn, 'c-a thin'), cur = vline(A.dyn, A.y0, A.top);
      const pts = BIO.cal.map((c, i) => el('circle', { cx: B.sx(c), cy: B.sy(D.calRatio[i]), r: 4, class: 'dot-b', 'fill-opacity': 0 }, B.dyn));
      const fit = curve(B.dyn, 'c-a'), hl = el('line', { class: 'rm-cursor dash2', x1: B.x0, x2: B.x0, y1: 0, y2: 0 }, B.dyn), vl = el('line', { class: 'rm-cursor dash2', x1: 0, x2: 0, y1: B.y0, y2: B.y0 }, B.dyn);
      const mk = el('rect', { class: 'mk', width: 9, height: 9, transform: 'rotate(45)', x: -20, y: -20 }, B.dyn);
      const area = (arr, base, tEnd) => {
        let d = '', first = null, last = null;
        for (let i = 0; i < D.ts.length; i++) {
          const t = D.ts[i]; if (t < BIO.win[0] || t > Math.min(BIO.win[1], tEnd)) continue;
          const y = Math.max(arr[i], base); if (first === null) first = t; last = t;
          d += (d ? 'L' : 'M') + nf(A.sx(t), 1) + ' ' + nf(A.sy(y), 1);
        }
        return d ? d + `L${nf(A.sx(last), 1)} ${nf(A.sy(base), 1)}L${nf(A.sx(first), 1)} ${nf(A.sy(base), 1)}Z` : '';
      };
      const trace = (arr, tEnd) => { let d = ''; for (let i = 0; i < D.ts.length && D.ts[i] <= tEnd; i++) d += (d ? 'L' : 'M') + nf(A.sx(D.ts[i]), 1) + ' ' + nf(A.sy(arr[i]), 1); return d; };
      const U1 = 0.4, U2 = 0.72;
      let cal = 0;
      return {
        H,
        draw(u) {
          const te = BIO.Tmax * seg(u, 0.02, U1);
          tI.setAttribute('d', trace(D.is, te)); tA.setAttribute('d', trace(D.an, te));
          aI.setAttribute('d', area(D.is, D.bI, te)); aA.setAttribute('d', area(D.an, D.bA, te));
          cur.setAttribute('x1', A.sx(te)); cur.setAttribute('x2', A.sx(te)); cur.setAttribute('opacity', u < U1 && u > 0.02 ? 1 : 0);
          cal = clamp(seg(u, U1 + 0.02, U2 - 0.1) * BIO.cal.length, 0, BIO.cal.length);
          pts.forEach((p, i) => p.setAttribute('fill-opacity', clamp(cal - i, 0, 1).toFixed(2)));
          const f = seg(u, U2 - 0.1, U2);
          fit.setAttribute('d', f > 0 ? pathOf((x) => D.a + D.b * x, B.sx, B.sy, 0, 50 * f, 1) : '');
          const g = seg(u, U2 + 0.02, U2 + 0.14), h = seg(u, U2 + 0.14, U2 + 0.26), xs = B.sx(D.back), ys = B.sy(D.sample);
          hl.setAttribute('x1', B.x0); hl.setAttribute('y1', ys); hl.setAttribute('y2', ys); hl.setAttribute('x2', B.x0 + (xs - B.x0) * g);
          vl.setAttribute('x1', xs); vl.setAttribute('x2', xs); vl.setAttribute('y1', ys); vl.setAttribute('y2', ys + (B.y0 - ys) * h);
          mk.setAttribute('transform', `translate(${xs} ${ys}) rotate(45)`); mk.setAttribute('x', -4.5); mk.setAttribute('y', -4.5); mk.setAttribute('opacity', g >= 1 ? 1 : 0);
        },
        readout: (u) => (u < U1 ? tr({ en: 'Retention time ', ko: '머무름 시간 ' }) + nf(BIO.Tmax * seg(u, 0.02, U1), 2) + ' min'
          : u < U2 ? tr({ en: 'Calibrators ', ko: '검량선 표준시료 ' }) + Math.floor(cal + 1e-9) + '/' + BIO.cal.length
          : u < U2 + 0.26 ? tr({ en: 'Ratio ', ko: '면적비 ' }) + nf(D.sample, 2) : tr({ en: 'Sample ', ko: '시료 ' }) + nf(D.back, 1) + ' ng/mL')
      };
    }
  };

  SCENES.bioanalysis.result = () => {
    const D = bioData();
    return tr({ en: `Peak-area ratio ${nf(D.sample, 2)} → ${U(D.back, 1, 'ng/mL')} (concentration set for the simulated sample: ${BIO.conc}\u00a0ng/mL).`,
                ko: `피크 면적비 ${nf(D.sample, 2)} → ${U(D.back, 1, 'ng/mL')} (모의 시료의 설정 농도: ${BIO.conc}\u00a0ng/mL).` });
  };

  /* ------------------------------------------------------------------ figure: svg stage, controls, timeline */
  class Fig {
    constructor(root) {
      this.root = root; this.id = root.getAttribute('data-rm'); this.sc = SCENES[this.id];
      this.opt = 0; this.u = 0; this.playing = false; this.auto = false; this.mounted = false; this.w = 0; this.view = null; this.raf = 0; this.rz = 0; this.last = 0;
      root.__rm = this;
    }
    poster() { return this.sc.poster == null ? 1 : this.sc.poster; }
    active() { const p = this.root.closest('[data-rm-panel]'); return !p || p.getAttribute('data-active') !== 'false'; }
    canAuto() { return !this.auto && !reduced() && this.w > 0 && this.active() && !document.hidden; }
    maybeAuto() { // a scene shown by the visitor (tab) starts when at least 45 % of it is on screen
      if (!this.mounted || !this.canAuto()) return;
      const r = this.stage.getBoundingClientRect(), vis = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (vis >= 0.45 * r.height) { this.auto = true; this.play(); }
    }
    mount() {
      if (this.mounted || !this.sc) return;
      this.mounted = true;
      const r = this.root, cap = $('figcaption', r);
      this.stage = document.createElement('div'); this.stage.className = 'rm-stage';
      this.svg = el('svg', { class: 'rm-svg', role: 'img', 'aria-label': tr(this.sc.alt), focusable: 'false' });
      this.stage.appendChild(this.svg);
      const bar = document.createElement('div'); bar.className = 'rm-bar';
      this.btn = document.createElement('button'); this.btn.type = 'button'; this.btn.className = 'rm-btn';
      this.scrub = document.createElement('input'); this.scrub.type = 'range'; this.scrub.min = 0; this.scrub.max = 1000; this.scrub.step = 20; this.scrub.value = 0;
      this.scrub.className = 'rm-scrub'; this.scrub.setAttribute('aria-label', tr(UI.time));
      this.time = document.createElement('span'); this.time.className = 'rm-time'; this.time.setAttribute('aria-hidden', 'true');
      bar.append(this.btn, this.scrub, this.time);
      const parts = [this.stage, bar];
      if (this.sc.opts) {
        const o = document.createElement('div'); o.className = 'rm-opts'; o.setAttribute('role', 'group'); o.setAttribute('aria-label', tr(UI.cond));
        const lab = document.createElement('span'); lab.textContent = tr(UI.cond); lab.setAttribute('aria-hidden', 'true'); o.appendChild(lab);
        this.optBtns = this.sc.opts.map((t, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'rm-btn rm-opt'; b.textContent = tr(t); b.setAttribute('aria-pressed', String(i === 0));
          b.addEventListener('click', () => this.setOpt(i)); o.appendChild(b); return b;
        });
        parts.push(o);
      }
      this.res = document.createElement('p'); this.res.className = 'rm-result'; this.res.setAttribute('role', 'status');
      parts.push(this.res);
      const frag = document.createDocumentFragment(); parts.forEach((p) => frag.appendChild(p));
      r.insertBefore(frag, cap);
      this.btn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
      this.scrub.addEventListener('input', () => { const v = this.scrub.value / 1000; this.pause(); this.seek(v); });
      const later = () => { cancelAnimationFrame(this.rz); this.rz = requestAnimationFrame(() => this.layout()); }; // not inside the observer callback: the svg height changes
      if (window.ResizeObserver) new ResizeObserver(later).observe(this.stage); else window.addEventListener('resize', later);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.layout(true));
      this.layout(true);
      this.setResult();
      if (reduced()) this.seek(this.poster()); else this.render();
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => es.forEach((e) => {
          if (e.isIntersecting && this.canAuto()) { this.auto = true; this.play(); io.disconnect(); }
        }), { threshold: 0.45 });
        io.observe(this.stage);
      }
    }
    layout(force) {
      if (!this.stage) return;
      const w = Math.round(this.stage.getBoundingClientRect().width);
      if (w < 200 || (w === this.w && !force)) return;
      this.w = w;
      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
      this.svg.setAttribute('class', 'rm-svg' + (w < 560 ? ' narrow' : ''));
      this.view = this.sc.build({ svg: this.svg, W: w, opt: this.opt });
      this.svg.setAttribute('viewBox', `0 0 ${w} ${Math.ceil(this.view.H)}`);
      this.svg.setAttribute('height', Math.ceil(this.view.H));
      this.reserveResult();
      this.render();
    }
    render() {
      if (!this.view) return;
      const u = this.u;
      this.view.draw(u);
      this.scrub.value = Math.round(u * 1000);
      const ro = this.view.readout(u);
      setText(this.time, ro);
      if (!this.playing) this.scrub.setAttribute('aria-valuetext', ro);
      const label = this.playing ? tr(UI.pause) : u >= 1 ? tr(UI.replay) : tr(UI.play);
      if (this.btn.textContent !== label) this.btn.textContent = label;
    }
    setResult() { const t = this.sc.result(this.opt); if (this.res.textContent !== t) this.res.textContent = t; }
    reserveResult() { // reserve the height of the longest result sentence (all scenarios), measured on a hidden copy, so nothing moves when the scenario changes
      const r = this.res, probe = r.cloneNode(false), n = this.sc.opts ? this.sc.opts.length : 1;
      probe.removeAttribute('role'); probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;margin:0;min-height:0;width:' + r.clientWidth + 'px';
      r.parentNode.insertBefore(probe, r);
      let h = 0;
      for (let i = 0; i < n; i++) { probe.textContent = this.sc.result(i); h = Math.max(h, probe.offsetHeight); }
      probe.remove();
      r.style.minHeight = h ? h + 'px' : '';
    }
    play() {
      if (!this.view) return;
      if (this.u >= 1) this.u = 0;
      this.playing = true; this.last = 0;
      cancelAnimationFrame(this.raf);
      const tick = (now) => {
        if (!this.playing) return;
        if (this.last) this.u = Math.min(1, this.u + Math.min(0.1, (now - this.last) / 1000) / this.sc.dur);
        this.last = now;
        if (this.u >= 1) { this.playing = false; this.render(); return; }
        this.render();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick); this.render();
    }
    pause() { this.playing = false; cancelAnimationFrame(this.raf); this.render(); }
    seek(u) { this.u = clamp(u, 0, 1); this.render(); }
    setOpt(i) {
      if (i === this.opt) return;
      this.opt = i; this.pause();
      this.optBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      this.layout(true); this.u = 0; this.setResult();
      this.auto = true; // the visitor chose this: play it now (or show the poster when motion is reduced)
      if (reduced()) this.seek(this.poster()); else this.play();
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) $$('figure.rm').forEach((f) => f.__rm && f.__rm.playing && f.__rm.pause()); });

  /* ------------------------------------------------------------------ tabbed viewer (home page) */
  function viewer(host) {
    const panels = $$('[data-rm-panel]', host);
    if (panels.length < 2) return;
    const list = document.createElement('div'); list.className = 'rm-tabs'; list.setAttribute('role', 'tablist'); list.setAttribute('aria-label', host.getAttribute('data-label') || '');
    const tabs = panels.map((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rm-tab'; b.setAttribute('role', 'tab');
      b.id = 'rm-tab-' + p.getAttribute('data-rm-panel'); b.setAttribute('aria-controls', p.id); b.textContent = p.getAttribute('data-title');
      p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      b.addEventListener('click', () => select(i, false));
      b.addEventListener('keydown', (e) => {
        const k = e.key, n = tabs.length; let j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n; else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i + n - 1) % n; else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
        if (j >= 0) { e.preventDefault(); select(j, true); }
      });
      list.appendChild(b); return b;
    });
    host.insertBefore(list, host.firstChild);
    const stack = document.createElement('div'); stack.className = 'rm-panels'; // all panels share one grid cell: one height, so the page does not move when the scene changes
    panels.forEach((q) => stack.appendChild(q)); host.appendChild(stack);
    function select(i, focus) {
      tabs.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; panels[k].setAttribute('data-active', String(k === i)); });
      panels.forEach((p, k) => { const f = $('figure.rm', p); if (f && f.__rm && k !== i) f.__rm.pause(); });
      const f = $('figure.rm', panels[i]);
      if (f && f.__rm) { f.__rm.mount(); f.__rm.maybeAuto(); }
      if (focus) tabs[i].focus();
    }
    select(0, false);
  }

  /* ------------------------------------------------------------------ self test (used by the QA scripts) */
  const rk4 = (f, y, t0, t1, n) => { const h = (t1 - t0) / n; for (let i = 0; i < n; i++) { const t = t0 + i * h, k1 = f(t, y), k2 = f(t + h / 2, y.map((v, j) => v + h / 2 * k1[j])), k3 = f(t + h / 2, y.map((v, j) => v + h / 2 * k2[j])), k4 = f(t + h, y.map((v, j) => v + h * k3[j])); y = y.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); } return y; };
  function selfTest() {
    const res = [], chk = (name, ok, info) => res.push({ name, ok: !!ok, info });
    // pk: closed form vs RK4 of the ODEs  dA1/dt = -ka A1, dA2/dt = ka A1 - ke A2
    PK.ke.forEach((ke) => { const y = rk4((t, v) => [-PK.ka * v[0], PK.ka * v[0] - ke * v[1]], [1, 0], 0, 24, 2400);
      chk('pk closed form = ODE (ke=' + ke + ')', Math.abs(y[1] - (PK.ka / (PK.ka - ke)) * (Math.exp(-ke * 24) - Math.exp(-PK.ka * 24))) < 1e-8); });
    chk('pk tmax maximises C', (() => { const s = pkStats(0.2), f = pkConc(0.2); return f(s.tmax) >= f(s.tmax - 0.01) && f(s.tmax) >= f(s.tmax + 0.01); })());
    chk('pk AUC = 1/ke (numeric)', (() => { const f = pkConc(0.1); let a = 0; for (let t = 0; t < 400; t += 0.01) a += 0.01 * (f(t) + f(t + 0.01)) / 2; return Math.abs(a - 10) < 1e-3; })());
    // metabolism: ODE dP = -k1 P, dM = k1 P - k2 M
    MET.k1.forEach((k1) => { const y = rk4((t, v) => [-k1 * v[0], k1 * v[0] - MET.k2 * v[1]], [1, 0], 0, 24, 2400);
      chk('metabolite closed form = ODE (k1=' + k1 + ')', Math.abs(y[0] - metP(k1)(24)) < 1e-8 && Math.abs(y[1] - metM(k1)(24)) < 1e-8); });
    // transport: mass balance C + U = 1, monotone, inhibitor slows
    tp().forEach((s, i) => { let mb = 0; for (let t = 0; t <= 240; t += 1) mb = Math.max(mb, Math.abs(s.C(t) + s.U(t) - 1)); chk('transport mass balance (I/Ki=' + TP.inh[i] + ')', mb < 1e-5, mb); });
    chk('transport: inhibitor raises AUC and t50', tp()[1].auc > tp()[0].auc && tp()[1].t50 > tp()[0].t50, [tp()[0].auc, tp()[1].auc, tp()[0].t50, tp()[1].t50]);
    chk('transport: occupancies sum <= 1', (() => { const q = theta(3, 1); return q.s + q.i <= 1 && q.s > 0; })());
    // fit
    const F = fitData(), last = F.path[F.path.length - 1];
    chk('fit: sum of squares decreases monotonically', F.path.every((p, i) => i === 0 || p.s < F.path[i - 1].s));
    chk('fit: ends below start and near the truth (<15 %)', last.s < F.path[0].s && last.th.every((v, j) => Math.abs(Math.exp(v) / FIT.truth[j] - 1) < 0.15), last.th.map(Math.exp));
    chk('fit: more than 4 steps shown', F.path.length > 4, F.path.length);
    // bio
    const B = bioData();
    chk('bio: back-calculated concentration within 8 % of 12', Math.abs(B.back / BIO.conc - 1) < 0.08, B.back);
    chk('bio: calibration slope within 8 %', Math.abs(B.b / BIO.slope - 1) < 0.08, B.b);
    chk('bio: peak area ratio is analyte/IS', B.aA > 0 && B.aI > B.aA, [B.aA, B.aI]);
    return { ok: res.every((r) => r.ok), checks: res };
  }

  /* ------------------------------------------------------------------ boot */
  const figs = $$('figure.rm[data-rm]').filter((f) => SCENES[f.getAttribute('data-rm')]);
  figs.forEach((f) => new Fig(f));
  $$('[data-rm-viewer]').forEach(viewer);
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.__rm.mount(); near.unobserve(e.target); } }), { rootMargin: '900px 0px' });
    figs.forEach((f) => near.observe(f));
  } else figs.forEach((f) => f.__rm.mount());
  window.LabMotion = { selfTest, scenes: SCENES, figs: () => figs.map((f) => f.__rm), models: { pkStats, metStats, tp, fitData, bioData } };
})();
