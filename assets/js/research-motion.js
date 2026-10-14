/* Research in motion: five small animations of the lab's research topics. Vanilla JS, no dependencies, no network.
   Everything that moves is computed from the equations given in the figure captions (closed form, or RK4 for the
   saturable transporter); nothing is keyed by hand. All numbers are simulated, not laboratory data. */
(() => {
  'use strict';
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
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
  const TP = { vmax: 0.5, km: 0.8, inh: [0, 1, 3, 10], T: 24, dt: 0.01, tend: 240 };
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

  /* ------------------------------------------------------------------ axes, legend and shapes */
  /* o: xd, yd (real values), xlog / ylog, xticks, yticks, xfmt / yfmt, xlabel, ylabel, letter, legend, ml / mr (margins) */
  function plotPanel(g, box, o) {
    const id = 'rmc' + ++uid, ml = o.ml || 40, mr = o.mr == null ? 12 : o.mr, items = o.legend || [];
    let lx = box.x, ly = box.y + 36;
    if (o.letter) text(g, box.x, box.y + 14, o.letter, 'ink letter');
    if (o.ylabel) text(g, box.x + (o.letter ? 22 : 0), box.y + 14, o.ylabel);
    items.forEach((it) => {
      const lab = text(g, 0, ly, it.label, 'key'), w = lab.getComputedTextLength(), sw = it.kind === 'area' ? 14 : 20;
      if (lx + sw + 6 + w > box.x + box.w && lx > box.x) { lx = box.x; ly += 18; }
      if (it.kind === 'dot') el('circle', { cx: lx + sw / 2, cy: ly - 4, r: 3.5, class: it.cls }, g);
      else if (it.kind === 'area') el('rect', { x: lx, y: ly - 9, width: sw, height: 9, class: it.cls }, g);
      else if (it.kind === 'ghost') {
        el('line', { x1: lx, x2: lx + sw, y1: ly - 7, y2: ly - 7, class: 'rm-curve c-a ghost' }, g);
        el('line', { x1: lx, x2: lx + sw, y1: ly - 2, y2: ly - 2, class: 'rm-curve c-b ghost' }, g);
      } else el('line', { x1: lx, x2: lx + sw, y1: ly - 4, y2: ly - 4, class: 'rm-curve ' + it.cls + (it.kind === 'dash' ? ' dash' : '') + (it.kind === 'thin' ? ' thin' : '') }, g);
      lab.setAttribute('x', lx + sw + 6); lab.setAttribute('y', ly);
      lx += sw + 6 + w + 16;
    });
    const top = items.length ? ly + 12 : box.y + 28, x0 = box.x + ml, w = box.w - ml - mr, y0 = box.y + box.h - (o.xlabel ? 38 : 22), h = y0 - top;
    const fx = o.xlog ? Math.log : (v) => v, fy = o.ylog ? Math.log : (v) => v;
    const X0 = fx(o.xd[0]), X1 = fx(o.xd[1]), Y0 = fy(o.yd[0]), Y1 = fy(o.yd[1]);
    const sx = (v) => x0 + ((fx(v) - X0) / (X1 - X0)) * w, sy = (v) => y0 - ((fy(v) - Y0) / (Y1 - Y0)) * h;
    o.yticks.forEach((v) => {
      if (fy(v) > Y0 + 1e-9) el('line', { x1: x0, x2: x0 + w, y1: sy(v), y2: sy(v), class: 'rm-grid' }, g);
      el('line', { x1: x0 - 4, x2: x0, y1: sy(v), y2: sy(v), class: 'rm-axis' }, g);
      text(g, x0 - 8, sy(v) + 4, o.yfmt ? o.yfmt(v) : String(v), '', 'end');
    });
    o.xticks.forEach((v) => {
      el('line', { x1: sx(v), x2: sx(v), y1: y0, y2: y0 + 4, class: 'rm-axis' }, g);
      text(g, sx(v), y0 + 18, o.xfmt ? o.xfmt(v) : String(v), '', 'middle');
    });
    el('line', { x1: x0, x2: x0, y1: top, y2: y0, class: 'rm-axis' }, g);
    el('line', { x1: x0, x2: x0 + w, y1: y0, y2: y0, class: 'rm-axis' }, g);
    if (o.xlabel) text(g, x0 + w, y0 + 34, o.xlabel, '', 'end');
    el('clipPath', { id }, el('defs', null, g)).appendChild(el('rect', { x: x0 - 4, y: top - 4, width: w + 8, height: h + 8 }));
    const dyn = el('g', { 'clip-path': `url(#${id})` }, g);
    return { sx, sy, dyn, x0, y0, w, h, top, g };
  }
  const curve = (dyn, cls) => el('path', { class: 'rm-curve ' + cls, d: '' }, dyn);
  const dot = (dyn, cls, r) => el('circle', { r: r || 4, class: cls, cx: -20, cy: -20 }, dyn);
  const vline = (dyn, y0, top) => el('line', { class: 'rm-cursor', x1: -20, x2: -20, y1: y0, y2: top }, dyn);
  const hide = (e, on) => e.setAttribute('opacity', on ? 1 : 0);
  const move = (e, x, y) => { e.setAttribute('cx', x); e.setAttribute('cy', y); };
  const xpos = (e, x) => { e.setAttribute('x1', x); e.setAttribute('x2', x); };
  const P2 = (x, y) => nf(x, 1) + ' ' + nf(y, 1);
  /* closed path between two functions of t over [t0, t1] (fb = baseline function or number) */
  const areaBetween = (fa, fb, sx, sy, t0, t1, step) => {
    const lo = typeof fb === 'function' ? fb : () => fb;
    let d = '', t = t0;
    for (; t < t1; t += step) d += (d ? 'L' : 'M') + P2(sx(t), sy(fa(t)));
    d += (d ? 'L' : 'M') + P2(sx(t1), sy(fa(t1)));
    d += 'L' + P2(sx(t1), sy(lo(t1)));
    for (t = t1 - ((t1 - t0) % step || step); t > t0; t -= step) d += 'L' + P2(sx(t), sy(lo(t)));
    return d + 'L' + P2(sx(t0), sy(lo(t0))) + 'Z';
  };
  const hairline = (g, x1, y1, x2, y2, cls) => el('line', { x1, y1, x2, y2, class: cls }, g);
  const xt = (W, wide, narrow) => (W >= 560 ? wide : narrow);
  const GP = 22; // gap between panels

  /* ------------------------------------------------------------------ strings shared by the scenes */
  const UI = {
    play: { en: 'Play', ko: '재생' }, pause: { en: 'Pause', ko: '일시정지' }, replay: { en: 'Replay', ko: '다시 재생' },
    time: { en: 'Time', ko: '시간' }, cond: { en: 'Condition', ko: '조건' }, result: { en: 'Result', ko: '결과' },
    tlabel: { en: 'Time (h)', ko: '시간 (h)' }, loading: { en: 'Loading the simulation data…', ko: '시뮬레이션 자료를 불러오는 중…' },
    failed: { en: 'The data file could not be loaded; the caption below describes the figure.', ko: '자료 파일을 불러오지 못했습니다. 아래 설명을 참고하십시오.' }
  };
  const SCENES = {};
  const eliminated = (dep, cen) => 1 - dep - cen;

  /* ================================================================== 1 · pharmacokinetics: AUC, semilog terminal phase, compartments + NCA table */
  SCENES.pk = {
    dur: 12, poster: 0.5,
    alt: { en: 'Animation: concentration–time curve with the area under the curve filling in, the same curve on a semilog axis with its terminal phase, and the share of the dose at the dose site, in plasma and eliminated beside a table of exposure parameters.',
           ko: '애니메이션: 곡선하면적이 채워지는 농도–시간 곡선, 같은 곡선의 반로그 그림과 말기 소실 구간, 투여 부위·혈장·소실 비율과 노출 지표 표.' },
    opts: [{ en: 'Reference', ko: '기준' }, { en: 'Clearance halved', ko: '청소율 절반' }],
    build({ svg, W, opt }) {
      const wide = W >= 560, keRef = PK.ke[0], ke = PK.ke[opt], st = pkStats(ke), ref = pkStats(keRef), norm = pkRef.cmax;
      const fRef = (t) => pkConc(keRef)(t) / norm, fCur = (t) => pkConc(ke)(t) / norm, step = PK.T / 240;
      const A0 = PK.ka / (PK.ka - ke) / norm, A0r = PK.ka / (PK.ka - keRef) / norm; // terminal-phase intercepts
      const bA = { x: 0, y: 0, w: W, h: wide ? 232 : 250 };
      const hw = Math.floor((W - GP) / 2);
      const bB = wide ? { x: 0, y: bA.h + GP, w: hw, h: 276 } : { x: 0, y: bA.h + GP, w: W, h: 236 };
      const bC = wide ? { x: hw + GP, y: bA.h + GP, w: W - hw - GP, h: 276 } : { x: 0, y: bB.y + bB.h + GP, w: W, h: 276 };
      const H = bC.y + bC.h;
      const curLab = tr(opt ? { en: 'Clearance halved', ko: '청소율 절반' } : { en: 'Reference', ko: '기준' });
      const pa = plotPanel(svg, bA, { letter: 'A', ylabel: tr({ en: 'Plasma concentration (relative)', ko: '혈장 농도 (상대값)' }), xlabel: tr(UI.tlabel),
        xd: [0, PK.T], yd: [0, 1.3], xticks: xt(W, [0, 3, 6, 9, 12, 15, 18, 21, 24], [0, 6, 12, 18, 24]), yticks: [0, 0.5, 1], yfmt: (v) => nf(v, 1),
        legend: [{ kind: 'area', cls: 'area-a', label: 'AUC(0–t)' }, { kind: 'dot', cls: 'dot-a', label: 'Cmax, tmax' }].concat(opt ? [{ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Reference', ko: '기준' }) }] : [], [{ kind: 'line', cls: 'c-a', label: curLab }]) });
      const aucA = el('path', { class: 'area-a', d: '' }, pa.dyn), rA = opt ? curve(pa.dyn, 'c-grey dash') : null, cA = curve(pa.dyn, 'c-a'), curA = vline(pa.dyn, pa.y0, pa.top);
      const pj1 = hairline(pa.dyn, -20, 0, -20, 0, 'rm-grid dash'), pj2 = hairline(pa.dyn, -20, 0, -20, 0, 'rm-grid dash'), pk = dot(pa.dyn, 'dot-a', 4.5);
      const pb = plotPanel(svg, bB, { letter: 'B', ylabel: tr({ en: 'Concentration (log scale)', ko: '농도 (로그 척도)' }), xlabel: tr(UI.tlabel),
        xd: [0, PK.T], yd: [0.01, 2], ylog: true, xticks: [0, 6, 12, 18, 24], yticks: [0.01, 0.1, 1], yfmt: (v) => String(v),
        legend: [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Plasma', ko: '혈장' }) }, { kind: 'dash', cls: 'c-ink', label: tr({ en: 'Terminal phase (slope –ke)', ko: '말기 소실 구간 (기울기 –ke)' }) }].concat(opt ? [{ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Reference', ko: '기준' }) }] : []) });
      const rB = opt ? curve(pb.dyn, 'c-grey dash') : null, cB = curve(pb.dyn, 'c-a'), tB = curve(pb.dyn, 'c-ink dash'), curB = vline(pb.dyn, pb.y0, pb.top);
      // C: compartments as bars + parameter table
      text(svg, bC.x, bC.y + 14, 'C', 'ink letter');
      const bars = [], titles = [tr({ en: 'Dose site', ko: '투여 부위' }), tr({ en: 'Plasma', ko: '혈장' }), tr({ en: 'Eliminated (= AUC(0–t) / AUC(0–∞))', ko: '소실됨 (= AUC(0–t) / AUC(0–∞))' })], cls = ['sq-blue', 'sq-a', 'sq-grey'];
      const vals = [];
      titles.forEach((tt, i) => {
        const y = bC.y + 26 + i * 40;
        text(svg, bC.x, y + 12, tt, 'ink'); vals.push(text(svg, bC.x + bC.w, y + 12, '', 'val', 'end'));
        el('rect', { x: bC.x, y: y + 18, width: bC.w, height: 12, class: 'sq-0' }, svg);
        bars.push(el('rect', { x: bC.x, y: y + 18, width: 0, height: 12, class: cls[i] }, svg));
      });
      const ty = bC.y + 26 + 3 * 40 + 10, c2 = bC.x + bC.w, c1 = c2 - (opt ? 84 : 0), rows = [
        ['Cmax (' + tr({ en: 'rel.', ko: '상대' }) + ')', nf(1, 2), nf(st.cmax / ref.cmax, 2)], ['tmax', U(ref.tmax, 1, 'h'), U(st.tmax, 1, 'h')],
        ['AUC(0–∞) (' + tr({ en: 'rel.', ko: '상대' }) + ')', nf(1, 2), nf(st.auc / ref.auc, 2)], ['t½', U(ref.t12, 1, 'h'), U(st.t12, 1, 'h')],
        ['CL/F (' + tr({ en: 'rel.', ko: '상대' }) + ')', nf(1, 2), nf(ref.auc / st.auc, 2)]];
      text(svg, c1 - (opt ? 0 : 0), ty, tr({ en: 'Reference', ko: '기준' }), '', 'end');
      if (opt) text(svg, c2, ty, 'CL ×0.5', '', 'end');
      el('line', { x1: bC.x, x2: bC.x + bC.w, y1: ty + 6, y2: ty + 6, class: 'rm-grid' }, svg);
      rows.forEach((r, i) => { const y = ty + 24 + i * 18; text(svg, bC.x, y, r[0], 'ink'); text(svg, c1, y, r[1], 'val', 'end'); if (opt) text(svg, c2, y, r[2], 'val', 'end'); });
      const tLog0 = 0.02;
      return {
        H,
        draw(u) {
          const t = u * PK.T, dep = Math.exp(-PK.ka * t), cen = (PK.ka / (PK.ka - ke)) * (Math.exp(-ke * t) - Math.exp(-PK.ka * t)), el_ = eliminated(dep, cen);
          aucA.setAttribute('d', areaBetween(fCur, 0, pa.sx, pa.sy, 0, Math.max(t, 1e-6), step));
          if (rA) rA.setAttribute('d', pathOf(fRef, pa.sx, pa.sy, 0, t, step));
          cA.setAttribute('d', pathOf(fCur, pa.sx, pa.sy, 0, t, step));
          xpos(curA, pa.sx(t)); move(pk, pa.sx(st.tmax), pa.sy(st.cmax / norm)); const reached = t >= st.tmax;
          hide(pk, reached); hide(pj1, reached); hide(pj2, reached);
          pj1.setAttribute('x1', pa.sx(st.tmax)); pj1.setAttribute('x2', pa.sx(st.tmax)); pj1.setAttribute('y1', pa.y0); pj1.setAttribute('y2', pa.sy(st.cmax / norm));
          pj2.setAttribute('x1', pa.x0); pj2.setAttribute('x2', pa.sx(st.tmax)); pj2.setAttribute('y1', pa.sy(st.cmax / norm)); pj2.setAttribute('y2', pa.sy(st.cmax / norm));
          if (rB) rB.setAttribute('d', pathOf(fRef, pb.sx, pb.sy, tLog0, Math.max(t, tLog0), step));
          cB.setAttribute('d', pathOf(fCur, pb.sx, pb.sy, tLog0, Math.max(t, tLog0), step));
          tB.setAttribute('d', t > 4 ? pathOf((x) => A0 * Math.exp(-ke * x), pb.sx, pb.sy, 4, t, step) : '');
          xpos(curB, pb.sx(t));
          [dep, cen, el_].forEach((f, i) => { bars[i].setAttribute('width', nf(bC.w * clamp(f, 0, 1), 1)); setText(vals[i], pct(f)); });
          this.auc = el_;
        },
        readout(u) { return nf(u * PK.T, 1) + ' h · AUC ' + pct(this.auc || 0); }
      };
    }
  };
  SCENES.pk.result = (opt) => {
    const st = pkStats(PK.ke[opt]), ref = pkStats(PK.ke[0]);
    return opt
      ? tr({ en: `Clearance halved: AUC(0–∞) ×${nf(st.auc / ref.auc, 1)}, half-life ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, peak concentration ×${nf(st.cmax / ref.cmax, 2)}, tmax ${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')}.`,
            ko: `청소율 절반: AUC(0–∞) ×${nf(st.auc / ref.auc, 1)}, 반감기 ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, 최고 농도 ×${nf(st.cmax / ref.cmax, 2)}, tmax ${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')}.` })
      : tr({ en: `Reference: peak at ${U(st.tmax, 1, 'h')}, half-life ${U(st.t12, 1, 'h')}.`, ko: `기준: 최고 농도 시점 ${U(st.tmax, 1, 'h')}, 반감기 ${U(st.t12, 1, 'h')}.` });
  };

  /* ================================================================== 2 · metabolism: pathway strip + stacked mass balance */
  SCENES.metabolism = {
    dur: 12, poster: 0.5,
    alt: { en: 'Animation: a pathway from parent drug to metabolite to eliminated, with arrow width following the rate, above a stacked area chart of where the dose is over time.',
           ko: '애니메이션: 모약물에서 대사체, 소실로 이어지는 경로와 속도에 비례하는 화살표 굵기, 시간에 따른 투여량 분포를 쌓아 보인 면적 그림.' },
    opts: [{ en: 'Typical metabolism', ko: '기준 대사' }, { en: 'Enzyme inhibited', ko: '대사효소 저해' }],
    build({ svg, W, opt }) {
      const wide = W >= 560, k1 = MET.k1[opt], P0 = metP(MET.k1[0]), M0 = metM(MET.k1[0]), P1 = metP(k1), M1 = metM(k1), step = MET.T / 240;
      const gapA = wide ? 80 : 26, bw = (W - 2 * gapA) / 3, by = 26, bh = 60, ax = (i) => i * (bw + gapA);
      text(svg, 0, 14, 'A', 'ink letter');
      const names = [tr({ en: 'Parent drug', ko: '모약물' }), tr({ en: 'Metabolite', ko: '대사체' }), tr({ en: 'Eliminated', ko: '소실됨' })], cols = ['sq-a', 'sq-b', 'sq-grey'], valEls = [];
      names.forEach((n, i) => {
        el('rect', { x: ax(i) + 0.5, y: by + 0.5, width: bw - 1, height: bh - 1, class: 'bx' }, svg);
        el('rect', { x: ax(i), y: by, width: 4, height: bh, class: cols[i] }, svg);
        text(svg, ax(i) + 12, by + 22, n, 'ink'); valEls.push(text(svg, ax(i) + 12, by + 47, '', 'big'));
      });
      const arrows = [0, 1].map((i) => {
        const x1 = ax(i) + bw + 4, x2 = ax(i + 1) - 4, y = by + bh / 2;
        const ln = el('line', { x1, x2: x2 - 7, y1: y, y2: y, class: 'arrow', 'stroke-width': 1 }, svg);
        el('polygon', { points: `${x2 - 8},${y - 4.5} ${x2 - 8},${y + 4.5} ${x2},${y}`, class: 'arrow-head' }, svg); return ln;
      });
      text(svg, ax(1) - gapA / 2, by + bh + 18, tr(opt ? { en: 'metabolism, inhibited', ko: '대사 (저해)' } : { en: 'metabolism', ko: '대사' }), 'key', 'middle');
      text(svg, ax(2) - gapA / 2, by + bh + 18, tr({ en: 'elimination', ko: '소실' }), 'key', 'middle');
      const by2 = by + bh + 36, hB = wide ? 252 : 262;
      const legend = [{ kind: 'area', cls: 'fill-a', label: names[0] }, { kind: 'area', cls: 'fill-b', label: names[1] }, { kind: 'area', cls: 'fill-grey', label: names[2] }];
      if (opt) legend.push({ kind: 'ghost', label: tr({ en: 'Typical metabolism (boundaries)', ko: '기준 대사 (경계선)' }) });
      const pl = plotPanel(svg, { x: 0, y: by2, w: W, h: hB }, { letter: 'B', ylabel: tr({ en: 'Share of the dose (%, molar)', ko: '투여량의 비율 (%, 몰 기준)' }), xlabel: tr(UI.tlabel),
        xd: [0, MET.T], yd: [0, 100], xticks: xt(W, [0, 3, 6, 9, 12, 15, 18, 21, 24], [0, 6, 12, 18, 24]), yticks: [0, 25, 50, 75, 100], legend });
      const s = (f) => (t) => 100 * f(t), sP = s(P1), sPM = (t) => 100 * (P1(t) + M1(t)), gP = s(P0), gPM = (t) => 100 * (P0(t) + M0(t)), top100 = () => 100;
      const aP = el('path', { class: 'fill-a', d: '' }, pl.dyn), aM = el('path', { class: 'fill-b', d: '' }, pl.dyn), aE = el('path', { class: 'fill-grey', d: '' }, pl.dyn);
      const g1 = opt ? curve(pl.dyn, 'c-a ghost') : null, g2 = opt ? curve(pl.dyn, 'c-b ghost') : null, l1 = curve(pl.dyn, 'c-a'), l2 = curve(pl.dyn, 'c-b'), cur = vline(pl.dyn, pl.y0, pl.top);
      const fluxMax = MET.k1[0], fluxMaxE = MET.k2 * Math.max(metStats(MET.k1[0]).peak, metStats(MET.k1[1]).peak);
      return {
        H: by2 + hB,
        draw(u) {
          const t = u * MET.T, p = P1(t), m = M1(t), tt = Math.max(t, 1e-6);
          [p, m, 1 - p - m].forEach((f, i) => setText(valEls[i], pct(f)));
          arrows[0].setAttribute('stroke-width', nf(1 + 5 * (k1 * p) / fluxMax, 2)); arrows[1].setAttribute('stroke-width', nf(1 + 5 * (MET.k2 * m) / fluxMaxE, 2));
          aP.setAttribute('d', areaBetween(sP, 0, pl.sx, pl.sy, 0, tt, step)); aM.setAttribute('d', areaBetween(sPM, sP, pl.sx, pl.sy, 0, tt, step)); aE.setAttribute('d', areaBetween(top100, sPM, pl.sx, pl.sy, 0, tt, step));
          if (g1) { g1.setAttribute('d', pathOf(gP, pl.sx, pl.sy, 0, t, step)); g2.setAttribute('d', pathOf(gPM, pl.sx, pl.sy, 0, t, step)); }
          l1.setAttribute('d', pathOf(sP, pl.sx, pl.sy, 0, t, step)); l2.setAttribute('d', pathOf(sPM, pl.sx, pl.sy, 0, t, step)); xpos(cur, pl.sx(t));
        },
        readout: (u) => nf(u * MET.T, 1) + ' h'
      };
    }
  };
  SCENES.metabolism.result = (opt) => {
    const st = metStats(MET.k1[opt]), ref = metStats(MET.k1[0]);
    return opt
      ? tr({ en: `Enzyme inhibited: parent half-life ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}; metabolite peak ${nf(100 * ref.peak, 0)} → ${nf(100 * st.peak, 0)} % of the dose, at ${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')}.`,
            ko: `대사효소 저해: 모약물 반감기 ${nf(ref.t12, 1)} → ${U(st.t12, 1, 'h')}, 대사체 최고량은 투여량의 ${nf(100 * ref.peak, 0)} → ${nf(100 * st.peak, 0)}%(최고 시점 ${nf(ref.tmax, 1)} → ${U(st.tmax, 1, 'h')}).` })
      : tr({ en: `Typical metabolism: parent half-life ${U(st.t12, 1, 'h')}; the metabolite peaks at ${U(st.tmax, 1, 'h')} with ${nf(100 * st.peak, 0)} % of the dose.`,
            ko: `기준 대사: 모약물 반감기 ${U(st.t12, 1, 'h')}, 대사체는 ${U(st.tmax, 1, 'h')}에 최고(투여량의 ${nf(100 * st.peak, 0)}%).` });
  };

  /* ================================================================== 3 · transporters and interactions: sites, curves, AUC ratio against [I]/Ki */
  const aucRatio = (x) => (TP.km * (1 + x) + 0.5) / (TP.km + 0.5); // closed form for this model (IV bolus, C0 = 1, no other elimination)
  SCENES.transport = {
    dur: 13, poster: 0.3,
    alt: { en: 'Animation: transporter sites occupied by substrate and inhibitor with the share of the dose in plasma and liver, the plasma concentration over time, and the AUC ratio against the inhibitor level with weak, moderate and strong bands.',
           ko: '애니메이션: 기질과 저해제가 차지하는 수송체 결합 부위와 혈장·간의 투여량 비율, 시간에 따른 혈장 농도, 저해제 수준에 따른 AUC 비와 약함·중간·강함 구간.' },
    opts: [{ en: 'Substrate alone', ko: '단독 투여' }, { en: '[I]/Ki = 1', ko: '[I]/Ki = 1' }, { en: '[I]/Ki = 3', ko: '[I]/Ki = 3' }, { en: '[I]/Ki = 10', ko: '[I]/Ki = 10' }],
    build({ svg, W, opt }) {
      const wide = W >= 560, sol = tp()[opt], alone = tp()[0], inh = TP.inh[opt];
      const flow = flowPanel(svg, 0, 0, 'A', [
        { kind: 'fill', title: tr({ en: 'Plasma', ko: '혈장 (기질)' }), cls: 'sq-a' },
        { kind: 'sites', title: tr({ en: 'Transporter sites', ko: '수송체 결합 부위' }),
          key: [{ cls: 'sq-a', label: tr({ en: 'substrate', ko: '기질' }) }, { cls: 'sq-b', label: tr({ en: 'inhibitor', ko: '저해제' }) }, { cls: 'sq-free', label: tr({ en: 'free', ko: '빈 자리' }) }] },
        { kind: 'fill', title: tr({ en: 'Taken up (liver)', ko: '간으로 흡수' }), cls: 'sq-blue' }], geoFor(W));
      const rx = FW + GP + 4, rw = W - rx, hh = 182;
      const bB = wide ? { x: rx, y: 0, w: rw, h: hh } : { x: 0, y: flow.H + GP, w: W, h: 230 };
      const bC = wide ? { x: rx, y: hh + GP, w: rw, h: hh + 6 } : { x: 0, y: bB.y + bB.h + GP, w: W, h: 250 };
      const H = Math.max(wide ? flow.H : 0, bC.y + bC.h);
      const pb = plotPanel(svg, bB, { letter: 'B', ylabel: tr({ en: 'Plasma concentration (relative)', ko: '혈장 농도 (상대값)' }), xlabel: tr(UI.tlabel), xd: [0, TP.T], yd: [0, 1],
        xticks: xt(W, [0, 6, 12, 18, 24], [0, 12, 24]), yticks: [0, 0.5, 1], yfmt: (v) => nf(v, 1),
        legend: opt ? [{ kind: 'dash', cls: 'c-grey', label: tr({ en: 'Substrate alone', ko: '단독 투여' }) }, { kind: 'line', cls: 'c-a', label: '[I]/Ki = ' + inh }] : [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Substrate alone', ko: '단독 투여' }) }] });
      const rB = opt ? curve(pb.dyn, 'c-grey dash') : null, cB = curve(pb.dyn, 'c-a'), curB = vline(pb.dyn, pb.y0, pb.top), ptB = dot(pb.dyn, 'dot-a'), step = TP.T / 240;
      // C: AUC ratio against [I]/Ki
      const pc = plotPanel(svg, bC, { letter: 'C', ylabel: tr({ en: 'AUC ratio (with / without inhibitor)', ko: 'AUC 비 (저해제 병용 / 단독)' }), xlabel: '[I]/Ki', xd: [0, 10], yd: [1, 7.5], mr: xt(W, 78, 76),
        xticks: [0, 2, 4, 6, 8, 10], yticks: [1, 2, 5], yfmt: (v) => String(v), legend: [{ kind: 'line', cls: 'c-ink', label: tr({ en: 'This model', ko: '이 모형' }) }, { kind: 'dot', cls: 'dot-a', label: tr({ en: 'Selected', ko: '선택' }) }] });
      const bands = [[1.25, 2, 'band-1', tr({ en: 'weak', ko: '약함' })], [2, 5, 'band-2', tr({ en: 'moderate', ko: '중간' })], [5, 7.5, 'band-3', tr({ en: 'strong', ko: '강함' })]];
      bands.forEach((b) => {
        el('rect', { x: pc.x0, y: pc.sy(b[1]), width: pc.w, height: pc.sy(b[0]) - pc.sy(b[1]), class: b[2] }, pc.dyn);
        text(svg, pc.x0 + pc.w + 6, (pc.sy(b[0]) + pc.sy(b[1])) / 2 + 4, b[3], 'key');
      });
      el('path', { class: 'rm-curve c-ink', d: pathOf(aucRatio, pc.sx, pc.sy, 0, 10, 0.5) }, pc.dyn);
      TP.inh.forEach((x, i) => { el('circle', { cx: pc.sx(x), cy: pc.sy(tp()[i].auc / alone.auc), r: 3, class: 'dot-grey' }, pc.dyn); });
      const sel = { x: pc.sx(inh), y: pc.sy(sol.auc / alone.auc) };
      const sh = hairline(pc.dyn, sel.x, pc.y0, sel.x, sel.y, 'rm-grid dash'), sv = hairline(pc.dyn, pc.x0, sel.y, sel.x, sel.y, 'rm-grid dash'), sd = dot(pc.dyn, 'dot-a', 5);
      move(sd, sel.x, sel.y);
      return {
        H,
        draw(u) {
          const t = u * TP.T, c = sol.C(t), th = theta(inh, c), na = Math.round(th.s * 10), nb = Math.min(10 - na, Math.round(th.i * 10));
          flow.setFill(0, c); flow.setFill(2, sol.U(t)); flow.setSites(1, na, nb);
          const w = 1 + 5 * (th.s / thetaMax); flow.setArrow(0, w); flow.setArrow(1, w);
          if (rB) rB.setAttribute('d', pathOf(alone.C, pb.sx, pb.sy, 0, t, step));
          cB.setAttribute('d', pathOf(sol.C, pb.sx, pb.sy, 0, t, step)); xpos(curB, pb.sx(t)); move(ptB, pb.sx(t), pb.sy(c));
          const show = clamp((u - 0.82) / 0.1, 0, 1); [sh, sv, sd].forEach((e) => e.setAttribute('opacity', show));
        },
        readout: (u) => nf(u * TP.T, 1) + ' h'
      };
    }
  };
  SCENES.transport.result = (opt) => {
    const sol = tp()[opt], alone = tp()[0], x = TP.inh[opt], cls = sol.auc / alone.auc;
    const band = cls >= 5 ? tr({ en: 'strong', ko: '강함' }) : cls >= 2 ? tr({ en: 'moderate', ko: '중간' }) : cls >= 1.25 ? tr({ en: 'weak', ko: '약함' }) : tr({ en: 'none', ko: '해당 없음' });
    return opt
      ? tr({ en: `[I]/Ki = ${x}: AUC(0–∞) ×${nf(cls, 1)} (${band} band); the concentration falls to 50 % at ${nf(alone.t50, 1)} → ${U(sol.t50, 1, 'h')}.`,
            ko: `[I]/Ki = ${x}: AUC(0–∞) ×${nf(cls, 1)}(${band} 구간), 농도가 50%로 떨어지는 시점 ${nf(alone.t50, 1)} → ${U(sol.t50, 1, 'h')}.` })
      : tr({ en: `Substrate alone: the concentration falls to 50 % at ${U(sol.t50, 1, 'h')}.`, ko: `단독 투여: 농도가 50%로 떨어지는 시점 ${U(sol.t50, 1, 'h')}.` });
  };

  /* ================================================================== 4 · modelling: fit, objective landscape with the optimiser path, prediction */
  const LAND = { lcl: [Math.log(2), Math.log(12)], lv: [Math.log(15), Math.log(80)], n: 36 };
  let landCache = null;
  const landscape = () => {
    if (landCache) return landCache;
    const { obs } = fitData(), n = LAND.n;
    const ssq = (th) => { let s = 0; for (let i = 0; i < FIT.times.length; i++) { const d = Math.log(obs[i]) - Math.log(Math.max(fitConc(th, FIT.times[i]), 1e-12)); s += d * d; } return s; };
    const phi = (Math.sqrt(5) - 1) / 2;
    const profile = (lcl, lv) => { // minimum over ln ka (with ka > ke, the flip-flop branch is excluded)
      const f = (lk) => ssq([lk, lcl, lv]); let a = Math.log(Math.exp(lcl - lv) * 1.02), b = Math.log(40), c = b - phi * (b - a), d = a + phi * (b - a), fc = f(c), fd = f(d);
      for (let i = 0; i < 32; i++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = f(d); } }
      return Math.min(fc, fd);
    };
    const z = []; let zmin = Infinity;
    for (let i = 0; i < n; i++) { z.push([]); for (let j = 0; j < n; j++) { const v = profile(LAND.lcl[0] + (j / (n - 1)) * (LAND.lcl[1] - LAND.lcl[0]), LAND.lv[0] + (i / (n - 1)) * (LAND.lv[1] - LAND.lv[0])); z[i].push(v); if (v < zmin) zmin = v; } }
    return (landCache = { z, zmin, profile, ssq });
  };
  const contourPath = (L, level, sx, sy) => { // marching squares: z[i][j], i = ln V index, j = ln CL index
    const n = LAND.n, z = L.z, X = (j) => Math.exp(LAND.lcl[0] + (j / (n - 1)) * (LAND.lcl[1] - LAND.lcl[0])), Y = (i) => Math.exp(LAND.lv[0] + (i / (n - 1)) * (LAND.lv[1] - LAND.lv[0]));
    const lerpP = (a, b, za, zb) => (level - za) / (zb - za) * (b - a) + a;
    let d = '';
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      const v = [z[i][j], z[i][j + 1], z[i + 1][j + 1], z[i + 1][j]], idx = (v[0] > level ? 1 : 0) | (v[1] > level ? 2 : 0) | (v[2] > level ? 4 : 0) | (v[3] > level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const pts = [];
      const edge = (e) => { // 0 bottom (i), 1 right, 2 top (i+1), 3 left
        if (e === 0) return [lerpP(Math.log(X(j)), Math.log(X(j + 1)), v[0], v[1]), Math.log(Y(i))];
        if (e === 1) return [Math.log(X(j + 1)), lerpP(Math.log(Y(i)), Math.log(Y(i + 1)), v[1], v[2])];
        if (e === 2) return [lerpP(Math.log(X(j)), Math.log(X(j + 1)), v[3], v[2]), Math.log(Y(i + 1))];
        return [Math.log(X(j)), lerpP(Math.log(Y(i)), Math.log(Y(i + 1)), v[0], v[3])];
      };
      const cross = [(v[0] > level) !== (v[1] > level), (v[1] > level) !== (v[2] > level), (v[3] > level) !== (v[2] > level), (v[0] > level) !== (v[3] > level)];
      [0, 1, 2, 3].forEach((e) => { if (cross[e]) pts.push(edge(e)); });
      for (let k = 0; k + 1 < pts.length; k += 2) d += 'M' + P2(sx(Math.exp(pts[k][0])), sy(Math.exp(pts[k][1]))) + 'L' + P2(sx(Math.exp(pts[k + 1][0])), sy(Math.exp(pts[k + 1][1])));
    }
    return d;
  };
  SCENES.modeling = {
    dur: 16, poster: 1,
    alt: { en: 'Animation: simulated measurements with a model curve moving towards them, the sum-of-squares landscape over clearance and volume with the optimiser path, a table of the parameters, then a prediction for repeated dosing.',
           ko: '애니메이션: 모의 측정값과 이에 다가가는 모형 곡선, 청소율·분포용적에 대한 잔차제곱합 지형과 최적화 경로, 모수 표, 반복 투여 예측.' },
    opts: null,
    build({ svg, W }) {
      const wide = W >= 560, { obs, path } = fitData(), L = landscape(), fin = path[path.length - 1];
      const stepAt = (q) => { const x = clamp(q, 0, path.length - 1), i = Math.min(Math.floor(x), path.length - 2); return { i, f: x - i }; };
      const thAt = (q) => { const k = stepAt(q); return path[k.i].th.map((v, j) => v + (path[k.i + 1].th[j] - v) * k.f); };
      const aw = Math.floor(W * 0.55), rx = aw + GP, rw = W - rx;
      const bA = wide ? { x: 0, y: 0, w: aw, h: 372 } : { x: 0, y: 0, w: W, h: 270 };
      const bB = wide ? { x: rx, y: 0, w: rw, h: 244 } : { x: 0, y: bA.h + GP, w: W, h: 290 };
      const bC = wide ? { x: rx, y: bB.h + GP, w: rw, h: 106 } : { x: 0, y: bB.y + bB.h + GP, w: W, h: 130 };
      const H = Math.max(bA.h, bC.y + bC.h);
      let top = 0; const mm = fitMulti(fin.th); for (let t = 0; t <= FIT.T; t += 0.1) top = Math.max(top, mm(t));
      const ymax = Math.ceil((top * 1.08) / 0.5) * 0.5;
      const pa = plotPanel(svg, bA, { letter: 'A', ylabel: tr({ en: 'Concentration (mg/L)', ko: '농도 (mg/L)' }), xlabel: tr(UI.tlabel), xd: [0, FIT.T], yd: [0, ymax],
        xticks: xt(W, [0, 12, 24, 36, 48], [0, 24, 48]), yticks: Array.from({ length: Math.floor(ymax) + 1 }, (_, i) => i),
        legend: [{ kind: 'dot', cls: 'dot-b', label: tr({ en: 'Measured (simulated)', ko: '모의 측정값' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Model', ko: '모형' }) }, { kind: 'dash', cls: 'c-a', label: tr({ en: 'Prediction: 100 mg every 12 h', ko: '예측: 12 h마다 100 mg' }) }] });
      el('line', { class: 'rm-grid dash', x1: pa.sx(24), x2: pa.sx(24), y1: pa.top, y2: pa.y0 }, pa.dyn);
      const pts = FIT.times.map((t, i) => el('circle', { cx: pa.sx(t), cy: pa.sy(obs[i]), r: 4, class: 'dot-b', 'fill-opacity': 0 }, pa.dyn));
      const cFit = curve(pa.dyn, 'c-a'), cPred = curve(pa.dyn, 'c-a dash'), step = FIT.T / 240;
      // B: landscape
      const pbp = plotPanel(svg, bB, { letter: 'B', ylabel: tr({ en: 'V/F (L)', ko: 'V/F (L)' }), xlabel: tr({ en: 'CL/F (L/h)', ko: 'CL/F (L/h)' }), xd: [2, 12], yd: [15, 80], xlog: true, ylog: true,
        xticks: [2, 4, 8], yticks: [20, 40, 80], legend: [{ kind: 'thin', cls: 'c-grey', label: tr({ en: 'Sum-of-squares contours', ko: '잔차제곱합 등고선' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Optimiser path', ko: '최적화 경로' }) }, { kind: 'dot', cls: 'dot-hollow', label: tr({ en: 'Simulated truth', ko: '모의 참값' }) }] });
      [1.5, 3, 8, 25, 80].forEach((m) => el('path', { class: 'rm-curve thin c-grey', d: contourPath(L, L.zmin * m, pbp.sx, pbp.sy) }, pbp.dyn));
      el('circle', { cx: pbp.sx(FIT.truth[1]), cy: pbp.sy(FIT.truth[2]), r: 4.5, class: 'dot-hollow' }, pbp.dyn);
      const cp = el('path', { class: 'rm-curve c-a', d: '' }, pbp.dyn), stepDots = path.map((p) => el('circle', { cx: pbp.sx(Math.exp(p.th[1])), cy: pbp.sy(Math.exp(p.th[2])), r: 2.5, class: 'dot-a', opacity: 0 }, pbp.dyn)), cur = dot(pbp.dyn, 'dot-a', 5);
      // C: phase row and table
      text(svg, bC.x, bC.y + 14, 'C', 'ink letter');
      const phases = [tr({ en: '1 Measure', ko: '1 측정' }), tr({ en: '2 Fit', ko: '2 적합' }), tr({ en: '3 Predict', ko: '3 예측' })], ph = []; let px = bC.x + 24;
      phases.forEach((s, i) => { const e = text(svg, px, bC.y + 14, s, 'phase'); px += e.getComputedTextLength() + 16; ph.push(e); });
      const rows = [['ka (h⁻¹)', 2], ['CL/F (L/h)', 2], ['V/F (L)', 1], [tr({ en: 'Sum of squares', ko: '잔차제곱합' }), 3]];
      el('line', { x1: bC.x, x2: bC.x + bC.w, y1: bC.y + 24, y2: bC.y + 24, class: 'rm-grid' }, svg);
      const vals = rows.map((r, i) => { const y = bC.y + 42 + i * 17; text(svg, bC.x, y, r[0], 'ink'); return text(svg, bC.x + bC.w, y, '', 'val', 'end'); });
      return {
        H,
        draw(u) {
          const a = seg(u, 0.02, 0.22), q = smooth(seg(u, 0.26, 0.64)) * (path.length - 1), th = thAt(q), kk = stepAt(q);
          pts.forEach((p, i) => p.setAttribute('fill-opacity', clamp(a * FIT.times.length - i, 0, 1).toFixed(2)));
          cFit.setAttribute('d', u >= 0.22 ? pathOf((t) => fitConc(th, t), pa.sx, pa.sy, 0, 24, 0.2) : '');
          const tpred = u > 0.7 ? FIT.T * seg(u, 0.7, 0.96) : 0;
          cPred.setAttribute('d', u > 0.7 ? pathOf(fitMulti(fin.th), pa.sx, pa.sy, 0, tpred, step) : '');
          // path in the (CL/F, V/F) plane
          let d = '', started = u >= 0.22;
          for (let i = 0; i <= kk.i && started; i++) d += (d ? 'L' : 'M') + P2(pbp.sx(Math.exp(path[i].th[1])), pbp.sy(Math.exp(path[i].th[2])));
          if (started) d += (d ? 'L' : 'M') + P2(pbp.sx(Math.exp(th[1])), pbp.sy(Math.exp(th[2])));
          cp.setAttribute('d', started ? d : '');
          stepDots.forEach((e, i) => e.setAttribute('opacity', started && i <= kk.i ? 1 : 0));
          move(cur, pbp.sx(Math.exp(th[1])), pbp.sy(Math.exp(th[2]))); hide(cur, true);
          const active = u < 0.22 ? 0 : u < 0.7 ? 1 : 2;
          ph.forEach((e, i) => e.setAttribute('class', 'rm-t phase' + (i === active ? ' on' : '')));
          const v = [Math.exp(th[0]), Math.exp(th[1]), Math.exp(th[2]), path[kk.i].s + (path[kk.i + 1].s - path[kk.i].s) * kk.f];
          vals.forEach((e, i) => setText(e, nf(v[i], rows[i][1])));
          this.step = Math.round(q);
        },
        readout(u) { return u < 0.22 ? tr({ en: 'Measuring', ko: '측정' }) : u < 0.7 ? tr({ en: 'Step ', ko: '단계 ' }) + this.step + '/' + (path.length - 1) : tr({ en: 'Predicting', ko: '예측' }); }
      };
    }
  };
  SCENES.modeling.result = () => {
    const thF = fitData().path.slice(-1)[0].th, m = fitMulti(thF);
    let pk = 0; for (let t = 36; t <= 48; t += 0.05) pk = Math.max(pk, m(t));
    const tro = m(48), ka = nf(Math.exp(thF[0]), 2), cl = nf(Math.exp(thF[1]), 1), v = nf(Math.exp(thF[2]), 0), tru = 'ka ' + nf(FIT.truth[0], 1) + ', CL/F ' + nf(FIT.truth[1], 1) + ', V/F ' + nf(FIT.truth[2], 0);
    return tr({ en: `Fitted ka ${ka} h⁻¹, CL/F ${cl} L/h, V/F ${v} L (values used to simulate: ${tru}). Predicted between 36 and 48 h: peak ${nf(pk, 1)}, trough ${U(tro, 1, 'mg/L')}.`,
                ko: `적합 결과 ka ${ka} h⁻¹, CL/F ${cl} L/h, V/F ${v} L (모의에 쓴 값: ${tru}). 36~48 h 예측: 최고 농도 ${nf(pk, 1)}, 최저 농도 ${U(tro, 1, 'mg/L')}.` });
  };

  /* ================================================================== 5 · population modelling (NLME): the replay of a FOCE-I run on 30 simulated subjects */
  const NL = { data: null, loading: null, error: null };
  const NL_URL = SCRIPT_SRC ? new URL('../data/nlme-demo.json', SCRIPT_SRC).href : 'assets/data/nlme-demo.json';
  const nlLoad = () => {
    if (NL.data) return Promise.resolve(NL.data);
    if (!NL.loading) NL.loading = fetch(NL_URL).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then((d) => (NL.data = d)).catch((e) => { NL.error = e; throw e; });
    return NL.loading;
  };
  const NL_KEYS = ['rich', 'moderate', 'sparse'];
  const conc100 = (cl, v, ka, t) => { const ke = cl / v, d = Math.abs(ka - ke) < 1e-7 ? 1e-7 : ka - ke; return (100 * ka) / (v * d) * (Math.exp(-ke * t) - Math.exp(-ka * t)); };
  const ZPI = (() => { const r = mulberry(31337); return Array.from({ length: 240 }, () => [gauss(r), gauss(r), gauss(r)]); })();
  const piBand = (th, om, ts) => {
    const lo = [], hi = [], buf = new Float64Array(ZPI.length), K = ZPI.length;
    const par = ZPI.map((z) => [th[0] * Math.exp(om[0] * z[0]), th[1] * Math.exp(om[1] * z[1]), th[2] * Math.exp(om[2] * z[2])]);
    ts.forEach((t) => { for (let k = 0; k < K; k++) buf[k] = conc100(par[k][0], par[k][1], par[k][2], t); const s = buf.slice().sort(); lo.push(s[Math.floor(0.05 * K)]); hi.push(s[Math.floor(0.95 * K)]); });
    return { lo, hi };
  };
  const nlState = (opt) => {
    const D = NL.data, sc = D.scenarios[NL_KEYS[opt]], F = sc.frames;
    return { D, sc, F, final: sc.final, n: F.length - 1, truth: D.truth };
  };
  SCENES.nlme = {
    dur: 17, poster: 1, defaultOpt: 1, load: nlLoad, ready: () => !!NL.data, failed: () => !!NL.error,
    alt: { en: 'Animation: a population PK model estimated on 30 simulated subjects. Individual and population curves move towards the data as the optimiser iterates, with the objective function, the parameter estimates and the individual random effects shown beside them.',
           ko: '애니메이션: 가상 개체 30명에 대한 집단 약동학 모형 추정. 최적화 반복에 따라 개체별·집단 곡선이 자료에 다가가며, 목적함수·모수 추정값·개체별 확률효과가 함께 표시됩니다.' },
    opts: [{ en: 'Rich: 10 samples', ko: '풍부: 10회 채혈' }, { en: 'Moderate: 5 samples', ko: '보통: 5회 채혈' }, { en: 'Sparse: 3 samples', ko: '희소: 3회 채혈' }],
    build({ svg, W, opt }) {
      const wide = W >= 560, S = nlState(opt), F = S.F, n = S.n, nSub = S.D.subjects.length, tg = []; for (let t = 0; t <= 24.001; t += 0.5) tg.push(t);
      const aw = Math.floor(W * 0.55), rx = aw + GP, rw = W - rx, sub = S.D.subjects;
      const bA = wide ? { x: 0, y: 0, w: aw, h: 468 } : { x: 0, y: 0, w: W, h: 300 };
      const hS = wide ? 140 : 200, hD = wide ? 166 : 250;
      const bB = wide ? { x: rx, y: 0, w: rw, h: hS } : { x: 0, y: bA.h + GP, w: W, h: hS };
      const bC = wide ? { x: rx, y: hS + GP, w: rw, h: hS } : { x: 0, y: bB.y + bB.h + GP, w: W, h: hS + 10 };
      const bD = wide ? { x: rx, y: 2 * hS + 2 * GP, w: rw, h: hD } : { x: 0, y: bC.y + bC.h + GP, w: W, h: hD };
      const H = Math.max(bA.h, bD.y + bD.h);
      let ymax = 0; sub.forEach((s, i) => S.sc.sampling[i].forEach((k) => { ymax = Math.max(ymax, s.y[k]); }));
      ymax = Math.ceil((ymax * 1.12) / 0.5) * 0.5;
      const T = S.truth, trueC = (t) => conc100(T.theta[0], T.theta[1], T.theta[2], t);
      const pa = plotPanel(svg, bA, { letter: 'A', ylabel: tr({ en: 'Concentration (mg/L)', ko: '농도 (mg/L)' }), xlabel: tr(UI.tlabel), xd: [0, 24], yd: [0, ymax], xticks: [0, 6, 12, 18, 24],
        yticks: Array.from({ length: Math.floor(ymax) + 1 }, (_, i) => i),
        legend: [{ kind: 'dot', cls: 'dot-b', label: tr({ en: 'Observations', ko: '관측값' }) }, { kind: 'thin', cls: 'c-blue', label: tr({ en: 'Individual fits', ko: '개체별 적합' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Population (typical)', ko: '집단 (전형값)' }) },
          { kind: 'dash', cls: 'c-grey', label: tr({ en: 'Simulated truth', ko: '모의 참값' }) }, { kind: 'area', cls: 'band', label: tr({ en: '90 % prediction interval', ko: '90% 예측구간' }) }] });
      const band = el('path', { class: 'band', d: '' }, pa.dyn), indPaths = sub.map(() => el('path', { class: 'rm-curve thin c-blue ind', d: '' }, pa.dyn));
      curve(pa.dyn, 'c-grey dash').setAttribute('d', pathOf(trueC, pa.sx, pa.sy, 0, 24, 0.25));
      const obsDots = []; sub.forEach((s, i) => S.sc.sampling[i].forEach((k) => obsDots.push({ i, c: el('circle', { cx: pa.sx(S.D.times_rich[k]), cy: pa.sy(s.y[k]), r: 2.6, class: 'dot-b', 'fill-opacity': 0 }, pa.dyn) })));
      const popC = curve(pa.dyn, 'c-a thick');
      const its = []; for (let i = 0; i <= n; i += n > 16 ? 6 : 5) its.push(i);
      const ofvs = F.map((f) => f.ofv);
      const oLo = Math.min.apply(null, ofvs), oHi = Math.max.apply(null, ofvs), oSpan = oHi - oLo, oStep = [10, 20, 50, 100, 200, 500].filter((q) => oSpan / q <= 4)[0] || 500;
      const oD = [Math.floor((oLo - 0.04 * oSpan) / oStep) * oStep, Math.ceil((oHi + 0.04 * oSpan) / oStep) * oStep], oT = []; for (let v = oD[0]; v <= oD[1] + 1e-9; v += oStep) oT.push(v);
      const pb = plotPanel(svg, bB, { letter: 'B', ylabel: tr({ en: 'Objective function value (OFV)', ko: '목적함수값 (OFV)' }), xlabel: tr({ en: 'Iteration', ko: '반복' }), xd: [0, n], yd: oD, xticks: its, yticks: oT });
      const ofvLine = curve(pb.dyn, 'c-a'), ofvDot = dot(pb.dyn, 'dot-a', 4);
      const pc = plotPanel(svg, bC, { letter: 'C', ylabel: tr({ en: 'Estimate ÷ simulated truth', ko: '추정값 ÷ 모의 참값' }), xlabel: tr({ en: 'Iteration', ko: '반복' }), xd: [0, n], yd: [0, 2.2], xticks: its, yticks: [0, 1, 2],
        legend: [{ kind: 'line', cls: 'c-a', label: 'CL/F' }, { kind: 'line', cls: 'c-b', label: 'V/F' }, { kind: 'line', cls: 'c-blue', label: 'ka' }] });
      hairline(pc.dyn, pc.x0, pc.sy(1), pc.x0 + pc.w, pc.sy(1), 'rm-grid dash');
      const thL = [curve(pc.dyn, 'c-a'), curve(pc.dyn, 'c-b'), curve(pc.dyn, 'c-blue')];
      const pd = plotPanel(svg, bD, { letter: 'D', ylabel: tr({ en: 'Individual random effects η', ko: '개체별 확률효과 η' }), xlabel: 'η CL/F', xd: [-1.2, 1.2], yd: [-1.2, 1.2], xticks: [-1, 0, 1], yticks: [-1, 0, 1], yfmt: (v) => String(v),
        legend: [{ kind: 'dot', cls: 'dot-blue', label: tr({ en: 'η V/F of each subject', ko: '개체별 η V/F' }) }, { kind: 'line', cls: 'c-ink', label: tr({ en: '±2 SD of ω', ko: 'ω의 ±2 SD' }) }] });
      const ell = el('ellipse', { class: 'ellipse', cx: pd.sx(0), cy: pd.sy(0), rx: 1, ry: 1 }, pd.dyn), etaDots = sub.map(() => el('circle', { r: 3, class: 'dot-blue', cx: -20, cy: -20 }, pd.dyn));
      hairline(pd.dyn, pd.sx(0), pd.top, pd.sx(0), pd.y0, 'rm-grid'); hairline(pd.dyn, pd.x0, pd.sy(0), pd.x0 + pd.w, pd.sy(0), 'rm-grid');
      const lerpF = (x) => { const q = clamp(x, 0, n), i = Math.min(Math.floor(q), n - 1), f = q - i, a = F[i], b = F[i + 1]; const gm = (p, r) => p * Math.pow(r / p, f);
        return { i, f, th: a.theta.map((v, j) => gm(v, b.theta[j])), om: a.omega.map((v, j) => gm(v, b.omega[j])), eta: a.eta.map((e, k) => e.map((v, j) => v + (b.eta[k][j] - v) * f)), ofv: a.ofv + (b.ofv - a.ofv) * f }; };
      return {
        H,
        draw(u) {
          const x = seg(u, 0.14, 0.88) * n, s = lerpF(x), a = seg(u, 0.02, 0.12), show = u >= 0.12;
          obsDots.forEach((o) => o.c.setAttribute('fill-opacity', clamp(a * nSub - o.i, 0, 1).toFixed(2) * 0.8));
          popC.setAttribute('d', show ? pathOf((t) => conc100(s.th[0], s.th[1], s.th[2], t), pa.sx, pa.sy, 0.05, 24, 0.25) : '');
          if (show) {
            const pi = piBand(s.th, s.om, tg); let d = 'M' + P2(pa.sx(tg[0]), pa.sy(pi.hi[0]));
            for (let k = 1; k < tg.length; k++) d += 'L' + P2(pa.sx(tg[k]), pa.sy(pi.hi[k]));
            for (let k = tg.length - 1; k >= 0; k--) d += 'L' + P2(pa.sx(tg[k]), pa.sy(pi.lo[k]));
            band.setAttribute('d', d + 'Z');
            indPaths.forEach((p, k) => { const e = s.eta[k]; p.setAttribute('d', pathOf((t) => conc100(s.th[0] * Math.exp(e[0]), s.th[1] * Math.exp(e[1]), s.th[2] * Math.exp(e[2]), t), pa.sx, pa.sy, 0.05, 24, 0.5)); });
          } else { band.setAttribute('d', ''); indPaths.forEach((p) => p.setAttribute('d', '')); }
          let d = ''; for (let i = 0; i <= s.i && show; i++) d += (d ? 'L' : 'M') + P2(pb.sx(i), pb.sy(ofvs[i]));
          if (show) d += (d ? 'L' : 'M') + P2(pb.sx(x), pb.sy(s.ofv)); ofvLine.setAttribute('d', show ? d : '');
          move(ofvDot, pb.sx(x), pb.sy(s.ofv)); hide(ofvDot, show);
          thL.forEach((c, j) => { let dd = ''; for (let i = 0; i <= s.i && show; i++) dd += (dd ? 'L' : 'M') + P2(pc.sx(i), pc.sy(F[i].theta[j] / T.theta[j])); if (show) dd += (dd ? 'L' : 'M') + P2(pc.sx(x), pc.sy(s.th[j] / T.theta[j])); c.setAttribute('d', show ? dd : ''); });
          ell.setAttribute('rx', nf(Math.abs(pd.sx(2 * s.om[0]) - pd.sx(0)), 2)); ell.setAttribute('ry', nf(Math.abs(pd.sy(2 * s.om[1]) - pd.sy(0)), 2)); hide(ell, show);
          etaDots.forEach((c, k) => { move(c, pd.sx(s.eta[k][0]), pd.sy(s.eta[k][1])); hide(c, show); });
          this.it = Math.round(x); this.ofv = s.ofv;
        },
        readout(u) { return u < 0.12 ? tr({ en: 'Data', ko: '자료' }) : tr({ en: 'Iter ', ko: '반복 ' }) + this.it + '/' + n + ' · OFV ' + nf(this.ofv, 1); }
      };
    }
  };
  SCENES.nlme.result = (opt) => {
    if (!NL.data) return '';
    const S = nlState(opt), f = S.final, lab = tr(SCENES.nlme.opts[opt]), e0 = 100 * (f.theta[0] / S.truth.theta[0] - 1);
    return tr({ en: `${lab} per subject: CL/F ${nf(f.theta[0], 2)} L/h (${e0 > 0 ? '+' : ''}${nf(e0, 1)} % from the simulated truth), V/F ${nf(f.theta[1], 1)} L, ka ${nf(f.theta[2], 2)} h⁻¹; OFV ${nf(S.F[0].ofv, 0)} → ${nf(f.ofv, 1)} in ${f.n_iter} iterations; η-shrinkage ${nf(100 * f.shrinkage[0], 0)} / ${nf(100 * f.shrinkage[1], 0)} / ${nf(100 * f.shrinkage[2], 0)} % (CL/F, V/F, ka).`,
                ko: `${lab}: CL/F ${nf(f.theta[0], 2)} L/h(모의 참값 대비 ${e0 > 0 ? '+' : ''}${nf(e0, 1)}%), V/F ${nf(f.theta[1], 1)} L, ka ${nf(f.theta[2], 2)} h⁻¹, OFV ${nf(S.F[0].ofv, 0)} → ${nf(f.ofv, 1)}(${f.n_iter}회 반복), η 수축 ${nf(100 * f.shrinkage[0], 0)} / ${nf(100 * f.shrinkage[1], 0)} / ${nf(100 * f.shrinkage[2], 0)}%(CL/F, V/F, ka).` });
  };

  /* ================================================================== 6 · bioanalysis: instrument chain, chromatogram, calibration */
  SCENES.bioanalysis = {
    dur: 18, poster: 1,
    alt: { en: 'Animation: the LC-MS/MS instrument chain, the chromatogram of an analyte and its internal standard as it is recorded, then a calibration curve and the back-calculated sample concentration.',
           ko: '애니메이션: LC-MS/MS 장치 구성, 기록되는 분석물질과 내부표준물질의 크로마토그램, 검량선과 시료 농도 역산.' },
    opts: null,
    build({ svg, W }) {
      const D = bioData(), wide = W >= 560, labs = [tr({ en: 'Sample', ko: '시료' }), 'LC', 'ESI', 'Q1', 'q2', 'Q3', tr({ en: 'Detector', ko: '검출기' })];
      text(svg, 0, 14, 'A', 'ink letter');
      const per = wide ? 7 : 4, gap = wide ? 16 : 14, bw = (W - (per - 1) * gap) / per, bh = 30, boxes = [];
      labs.forEach((l, i) => {
        const r = Math.floor(i / per), c = i % per, x = c * (bw + gap), y = 26 + r * (bh + 14);
        boxes.push(el('rect', { x: x + 0.5, y: y + 0.5, width: bw - 1, height: bh - 1, class: 'bx' }, svg));
        if (i === labs.length - 1) boxes.det = el('rect', { x: x + 1, y: y + 1, width: bw - 2, height: bh - 2, class: 'sq-a', 'fill-opacity': 0 }, svg);
        text(svg, x + bw / 2, y + 19, l, 'ink', 'middle');
        if (c < per - 1 && i < labs.length - 1) { const ay = y + bh / 2; el('line', { x1: x + bw + 2, x2: x + bw + gap - 7, y1: ay, y2: ay, class: 'arrow', 'stroke-width': 1.2 }, svg); el('polygon', { points: `${x + bw + gap - 8},${ay - 3.5} ${x + bw + gap - 8},${ay + 3.5} ${x + bw + gap - 1},${ay}`, class: 'arrow-head' }, svg); }
      });
      const hA = 26 + (wide ? 1 : 2) * (bh + (wide ? 0 : 14)) + 8, ph = wide ? 292 : 252, y1 = hA + 16;
      const boxA = { x: 0, y: y1, w: wide ? Math.floor((W - 30) / 2) : W, h: ph }, boxB = wide ? { x: boxA.w + 30, y: y1, w: W - boxA.w - 30, h: ph } : { x: 0, y: y1 + ph + 20, w: W, h: ph };
      const A = plotPanel(svg, boxA, { letter: 'B', ylabel: tr({ en: 'Intensity (% of internal standard peak)', ko: '강도 (내부표준물질 피크 대비 %)' }), xlabel: tr({ en: 'Retention time (min)', ko: '머무름 시간 (min)' }),
        xd: [0, BIO.Tmax], yd: [0, 110], xticks: [0, 1, 2, 3], yticks: [0, 50, 100],
        legend: [{ kind: 'line', cls: 'c-a', label: tr({ en: 'Analyte', ko: '분석물질' }) }, { kind: 'line', cls: 'c-ink', label: tr({ en: 'Internal standard (SIL-IS)', ko: '내부표준물질 (SIL-IS)' }) }] });
      const B = plotPanel(svg, boxB, { letter: 'C', ylabel: tr({ en: 'Analyte / IS peak-area ratio', ko: '분석물질/내부표준물질 피크 면적비' }), xlabel: tr({ en: 'Concentration (ng/mL)', ko: '농도 (ng/mL)' }),
        xd: [0, 60], yd: [0, 2.5], xticks: [0, 20, 40, 60], yticks: [0, 1, 2],
        legend: [{ kind: 'dot', cls: 'dot-b', label: tr({ en: 'Calibrators', ko: '검량선 표준시료' }) }, { kind: 'line', cls: 'c-a', label: tr({ en: 'Weighted fit (1/x²)', ko: '가중 회귀 (1/x²)' }) }, { kind: 'dash', cls: 'c-ink', label: tr({ en: 'Sample', ko: '측정 시료' }) }] });
      const aI = el('path', { class: 'area-ink', d: '' }, A.dyn), aA = el('path', { class: 'area-a', d: '' }, A.dyn);
      const tI = curve(A.dyn, 'c-ink thin'), tA = curve(A.dyn, 'c-a thin'), cur = vline(A.dyn, A.y0, A.top);
      const pts = BIO.cal.map((c, i) => el('circle', { cx: B.sx(c), cy: B.sy(D.calRatio[i]), r: 4, class: 'dot-b', 'fill-opacity': 0 }, B.dyn));
      const fit = curve(B.dyn, 'c-a'), hl = el('line', { class: 'rm-cursor dash2', x1: B.x0, x2: B.x0, y1: 0, y2: 0 }, B.dyn), vl = el('line', { class: 'rm-cursor dash2', x1: 0, x2: 0, y1: B.y0, y2: B.y0 }, B.dyn);
      const mk = el('rect', { class: 'mk', width: 9, height: 9, x: -4.5, y: -4.5, transform: 'translate(-20 -20) rotate(45)' }, B.dyn);
      const area = (arr, base, tEnd) => {
        let d = '', first = null, last = null;
        for (let i = 0; i < D.ts.length; i++) { const t = D.ts[i]; if (t < BIO.win[0] || t > Math.min(BIO.win[1], tEnd)) continue; const y = Math.max(arr[i], base); if (first === null) first = t; last = t; d += (d ? 'L' : 'M') + P2(A.sx(t), A.sy(y)); }
        return d ? d + `L${P2(A.sx(last), A.sy(base))}L${P2(A.sx(first), A.sy(base))}Z` : '';
      };
      const trace = (arr, tEnd) => { let d = ''; for (let i = 0; i < D.ts.length && D.ts[i] <= tEnd; i++) d += (d ? 'L' : 'M') + P2(A.sx(D.ts[i]), A.sy(arr[i])); return d; };
      const U1 = 0.4, U2 = 0.72; let cal = 0;
      const idxAt = (t) => clamp(Math.round(t / BIO.dt), 0, D.ts.length - 1);
      return {
        H: boxB.y + boxB.h,
        draw(u) {
          const te = BIO.Tmax * seg(u, 0.02, U1), i = idxAt(te);
          tI.setAttribute('d', trace(D.is, te)); tA.setAttribute('d', trace(D.an, te)); aI.setAttribute('d', area(D.is, D.bI, te)); aA.setAttribute('d', area(D.an, D.bA, te));
          xpos(cur, A.sx(te)); cur.setAttribute('opacity', u < U1 && u > 0.02 ? 1 : 0);
          boxes.det.setAttribute('fill-opacity', nf(clamp((D.is[i] - D.bI) / 100, 0, 1) * (u < U1 ? 1 : 0), 2));
          cal = clamp(seg(u, U1 + 0.02, U2 - 0.1) * BIO.cal.length, 0, BIO.cal.length);
          pts.forEach((p, k) => p.setAttribute('fill-opacity', clamp(cal - k, 0, 1).toFixed(2)));
          const f = seg(u, U2 - 0.1, U2); fit.setAttribute('d', f > 0 ? pathOf((x) => D.a + D.b * x, B.sx, B.sy, 0, 50 * f, 1) : '');
          const g = seg(u, U2 + 0.02, U2 + 0.14), h = seg(u, U2 + 0.14, U2 + 0.26), xs = B.sx(D.back), ys = B.sy(D.sample);
          hl.setAttribute('x1', B.x0); hl.setAttribute('y1', ys); hl.setAttribute('y2', ys); hl.setAttribute('x2', B.x0 + (xs - B.x0) * g);
          vl.setAttribute('x1', xs); vl.setAttribute('x2', xs); vl.setAttribute('y1', ys); vl.setAttribute('y2', ys + (B.y0 - ys) * h);
          mk.setAttribute('transform', `translate(${xs} ${ys}) rotate(45)`); mk.setAttribute('opacity', g >= 1 ? 1 : 0);
        },
        readout: (u) => (u < U1 ? tr({ en: 'Retention time ', ko: '머무름 시간 ' }) + nf(BIO.Tmax * seg(u, 0.02, U1), 2) + ' min'
          : u < U2 ? tr({ en: 'Calibrators ', ko: '검량선 표준시료 ' }) + Math.floor(cal + 1e-9) + '/' + BIO.cal.length
          : u < U2 + 0.26 ? tr({ en: 'Ratio ', ko: '면적비 ' }) + nf(D.sample, 2) : tr({ en: 'Sample ', ko: '시료 ' }) + nf(D.back, 1) + ' ng/mL')
      };
    }
  };
  SCENES.bioanalysis.result = () => {
    const D = bioData();
    return tr({ en: `Peak-area ratio ${nf(D.sample, 2)} → ${U(D.back, 1, 'ng/mL')} (concentration set for the simulated sample: ${BIO.conc} ng/mL).`,
                ko: `피크 면적비 ${nf(D.sample, 2)} → ${U(D.back, 1, 'ng/mL')} (모의 시료의 설정 농도: ${BIO.conc} ng/mL).` });
  };

  class Fig {
    constructor(root) {
      this.root = root; this.id = root.getAttribute('data-rm'); this.sc = SCENES[this.id];
      this.opt = (this.sc && this.sc.defaultOpt) || 0; this.u = 0; this.playing = false; this.auto = false; this.mounted = false; this.w = 0; this.view = null; this.raf = 0; this.rz = 0; this.last = 0;
      root.__rm = this;
    }
    poster() { return this.sc.poster == null ? 1 : this.sc.poster; }
    active() { const p = this.root.closest('[data-rm-panel]'); return !p || p.getAttribute('data-active') !== 'false'; }
    canAuto() { return !this.auto && !reduced() && this.w > 0 && this.active() && !document.hidden; }
    inView() { // at least 45 % of the figure, or half of the window when the figure is taller than that (large zoom)
      const r = this.stage.getBoundingClientRect(), vis = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      return vis >= Math.min(0.45 * r.height, 0.5 * window.innerHeight);
    }
    maybeAuto() { // a scene shown by the visitor (tab) resumes where it was, or starts when it is on screen
      if (!this.mounted) return;
      if (this.parked) { this.parked = false; if (!this.playing && this.u < 1) this.play(); return; }
      if (this.canAuto() && this.inView()) { this.auto = true; this.play(); }
    }
    park() { if (this.playing) { this.pause(); this.parked = true; } }
    mount() {
      if (this.mounted || !this.sc) return;
      this.mounted = true;
      const r = this.root, cap = $('figcaption', r);
      this.stage = document.createElement('div'); this.stage.className = 'rm-stage';
      this.svg = el('svg', { class: 'rm-svg', role: 'img', 'aria-label': tr(this.sc.alt), focusable: 'false' });
      this.stage.appendChild(this.svg);
      const bar = document.createElement('div'); bar.className = 'rm-bar';
      this.btn = document.createElement('button'); this.btn.type = 'button'; this.btn.className = 'rm-btn';
      this.scrub = document.createElement('input'); this.scrub.type = 'range'; this.scrub.min = 0; this.scrub.max = 1000; this.scrub.step = 'any'; this.scrub.value = 0;
      this.scrub.className = 'rm-scrub'; this.scrub.setAttribute('aria-label', tr(UI.time));
      this.time = document.createElement('span'); this.time.className = 'rm-time'; this.time.setAttribute('aria-hidden', 'true');
      bar.append(this.btn, this.scrub, this.time);
      const parts = [this.stage, bar];
      if (this.sc.opts) {
        const o = document.createElement('div'); o.className = 'rm-opts'; o.setAttribute('role', 'group'); o.setAttribute('aria-label', tr(UI.cond));
        const lab = document.createElement('span'); lab.textContent = tr(UI.cond); lab.setAttribute('aria-hidden', 'true'); o.appendChild(lab);
        this.optBtns = this.sc.opts.map((t, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'rm-btn rm-opt'; b.textContent = tr(t); b.setAttribute('aria-pressed', String(i === this.opt));
          b.addEventListener('click', () => this.setOpt(i)); o.appendChild(b); return b;
        });
        parts.push(o);
      }
      this.res = document.createElement('p'); this.res.className = 'rm-result'; this.res.setAttribute('role', 'status');
      parts.push(this.res);
      const frag = document.createDocumentFragment(); parts.forEach((p) => frag.appendChild(p));
      r.insertBefore(frag, cap);
      const ph = $('.rm-ph', r); if (ph) ph.remove();
      this.btn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
      this.scrub.addEventListener('input', () => { const v = this.scrub.value / 1000; this.pause(); this.seek(v); });
      this.scrub.addEventListener('keydown', (e) => { // same steps in every browser: arrows 2 %, PageUp/PageDown 10 %
        const d = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, PageDown: -0.1, PageUp: 0.1 }[e.key];
        if (d === undefined && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault(); this.pause();
        this.seek(e.key === 'Home' ? 0 : e.key === 'End' ? 1 : this.u + d);
      });
      const later = () => { cancelAnimationFrame(this.rz); this.rz = requestAnimationFrame(() => this.layout()); }; // not inside the observer callback: the svg height changes
      if (window.ResizeObserver) new ResizeObserver(later).observe(this.stage); else window.addEventListener('resize', later);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.layout(true));
      const start = () => { this.layout(true); this.setResult(); if (reduced()) this.seek(this.poster()); else this.render(); };
      if (this.sc.load && !this.sc.ready()) { // scenes that replay a stored run fetch their data file first
        const note = document.createElement('p'); note.className = 'rm-loading'; note.textContent = tr(UI.loading); this.stage.appendChild(note);
        this.sc.load().then(() => { note.remove(); start(); this.maybeAuto(); }).catch(() => { note.textContent = tr(UI.failed); });
      } else start();
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => es.forEach((e) => {
          if (e.isIntersecting && this.canAuto() && this.inView()) { this.auto = true; this.play(); io.disconnect(); }
        }), { threshold: [0.1, 0.25, 0.45] });
        io.observe(this.stage);
      }
    }
    layout(force) {
      if (!this.stage) return;
      const w = Math.round(this.stage.getBoundingClientRect().width);
      if (w < 200 || (w === this.w && !force)) return;
      if (this.sc.ready && !this.sc.ready()) return;
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
      this.scrub.value = u * 1000;
      const ro = this.view.readout(u);
      setText(this.time, ro);
      const pc = Math.round(u * 100);
      if (!this.playing || pc !== this.pc) this.scrub.setAttribute('aria-valuetext', ro); // at most once per percent while playing
      this.pc = pc;
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
      this.mount();
      if (!this.optBtns || !this.optBtns[i] || i === this.opt) return;
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
      panels.forEach((p, k) => { const f = $('figure.rm', p); if (f && f.__rm && k !== i) f.__rm.park(); });
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
    chk('pk eliminated share = AUC(0-t)/AUC(0-inf) (numeric)', PK.ke.every((ke) => { const f = pkConc(ke); let a = 0; for (let i = 0; i < 10000; i++) { const t = i * 0.001; a += 0.001 * (f(t) + f(t + 0.001)) / 2; }
      const dep = Math.exp(-PK.ka * 10), cen = (PK.ka / (PK.ka - ke)) * (Math.exp(-ke * 10) - Math.exp(-PK.ka * 10)); return Math.abs((1 - dep - cen) - a / (1 / ke)) < 1e-6; }));
    // metabolism: ODE dP = -k1 P, dM = k1 P - k2 M
    MET.k1.forEach((k1) => { const y = rk4((t, v) => [-k1 * v[0], k1 * v[0] - MET.k2 * v[1]], [1, 0], 0, 24, 2400);
      chk('metabolite closed form = ODE (k1=' + k1 + ')', Math.abs(y[0] - metP(k1)(24)) < 1e-8 && Math.abs(y[1] - metM(k1)(24)) < 1e-8); });
    // transport: mass balance C + U = 1, closed-form AUC = numeric AUC, AUC ratio line
    tp().forEach((s, i) => { let mb = 0; for (let t = 0; t <= 240; t += 1) mb = Math.max(mb, Math.abs(s.C(t) + s.U(t) - 1)); chk('transport mass balance (I/Ki=' + TP.inh[i] + ')', mb < 1e-5, mb);
      chk('transport AUC: closed form (Km(1+I/Ki)+0.5)/Vmax = numeric (I/Ki=' + TP.inh[i] + ')', Math.abs(s.auc - (TP.km * (1 + TP.inh[i]) + 0.5) / TP.vmax) < 1e-4, [s.auc, (TP.km * (1 + TP.inh[i]) + 0.5) / TP.vmax]); });
    chk('transport: AUC ratio line = numeric ratios', TP.inh.every((x, i) => Math.abs(aucRatio(x) - tp()[i].auc / tp()[0].auc) < 1e-4));
    chk('transport: inhibitor raises AUC and t50', tp()[2].auc > tp()[0].auc && tp()[2].t50 > tp()[0].t50);
    chk('transport: occupancies sum <= 1 and rate = Vmax x theta_S', (() => { const q = theta(3, 1), c = 0.7, v = (TP.vmax * c) / (TP.km * 4 + c); return q.s + q.i <= 1 && Math.abs(v - TP.vmax * theta(3, c).s) < 1e-12; })());
    // modelling
    const F = fitData(), last = F.path[F.path.length - 1];
    chk('fit: sum of squares decreases monotonically', F.path.every((p, i) => i === 0 || p.s < F.path[i - 1].s));
    chk('fit: ends below start and near the truth (<15 %)', last.s < F.path[0].s && last.th.every((v, j) => Math.abs(Math.exp(v) / FIT.truth[j] - 1) < 0.15), last.th.map(Math.exp));
    chk('fit: more than 4 steps shown', F.path.length > 4, F.path.length);
    chk('landscape: profile at the optimum equals the fitted sum of squares', Math.abs(landscape().profile(last.th[1], last.th[2]) - last.s) < 1e-3 * last.s + 1e-6, [landscape().profile(last.th[1], last.th[2]), last.s]);
    chk('landscape: minimum on the grid is near the optimum', landscape().zmin >= last.s * 0.999 && landscape().zmin < last.s * 1.6, [landscape().zmin, last.s]);
    // bioanalysis
    const B = bioData();
    chk('bio: back-calculated concentration within 8 % of 12', Math.abs(B.back / BIO.conc - 1) < 0.08, B.back);
    chk('bio: calibration slope within 8 %', Math.abs(B.b / BIO.slope - 1) < 0.08, B.b);
    chk('bio: peak area ratio is analyte/IS', B.aA > 0 && B.aI > B.aA, [B.aA, B.aI]);
    // population model (needs the data file)
    if (NL.data) NL_KEYS.forEach((k, o) => {
      const S = nlState(o), f = S.F[S.F.length - 1];
      chk('nlme ' + k + ': last frame = reported final estimates', f.theta.every((v, j) => Math.abs(v - S.final.theta[j]) < 1e-6) && Math.abs(f.ofv - S.final.ofv) < 1e-3);
      chk('nlme ' + k + ': OFV non-increasing over the frames', S.F.every((x, i) => i === 0 || x.ofv <= S.F[i - 1].ofv + 1e-9));
      chk('nlme ' + k + ': 30 subjects, 3 etas per frame', S.F.every((x) => x.eta.length === 30 && x.eta[0].length === 3));
      chk('nlme ' + k + ': prediction band is ordered', (() => { const b = piBand(f.theta, f.omega, [1, 4, 12, 24]); return b.lo.every((v, i) => v < b.hi[i]); })());
    });
    if (NL.data) chk('nlme: conc100 equals the one-compartment equation at a test point', Math.abs(conc100(4, 35, 1.1, 2) - (100 * 1.1) / (35 * (1.1 - 4 / 35)) * (Math.exp(-(4 / 35) * 2) - Math.exp(-1.1 * 2))) < 1e-12);
    else chk('nlme: data file not loaded yet (call LabMotion.ready first)', false);
    return { ok: res.every((r) => r.ok), checks: res };
  }

  /* ------------------------------------------------------------------ boot */
  const figs = $$('figure.rm[data-rm]').filter((f) => SCENES[f.getAttribute('data-rm')]);
  figs.forEach((f) => new Fig(f));
  $$('[data-rm-viewer]').forEach(viewer);
  figs.forEach((f) => f.__rm.mount()); // all figures are built at once, so the page height is final before anyone scrolls (jump links stay accurate)
  document.documentElement.classList.remove('rm-pending');
  document.documentElement.classList.add('rm-on');
  window.addEventListener('beforeprint', () => figs.forEach((f) => { const g = f.__rm; if (g.mounted) { g.wasPlaying = g.playing; g.pause(); g.seek(g.poster()); } }));
  window.addEventListener('afterprint', () => figs.forEach((f) => { const g = f.__rm; if (g.mounted && g.wasPlaying) { g.wasPlaying = false; g.play(); } }));
  window.LabMotion = { selfTest, scenes: SCENES, figs: () => figs.map((f) => f.__rm), models: { pkStats, metStats, tp, fitData, bioData, landscape, nlState, piBand }, ready: nlLoad().catch(() => null) };
})();
