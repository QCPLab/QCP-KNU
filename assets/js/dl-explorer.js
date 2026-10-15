/* dl-explorer.js — "How deep learning computes": a small MLP (covariates -> ln CL, synthetic data) and a small
   message-passing GNN (molecule -> Crippen logP). Vanilla ES2020, SVG + DOM, no libraries, no network use except
   fetching the two JSON files named in data-mlp / data-gnn. The browser recomputes the forward AND backward pass
   (MLP) and the message passing (GNN) from the shipped weights; window.LabWidgets.dlSelfTest() checks them against
   the NumPy reference stored in the JSON (tolerance 1e-5). Teaching example only: not for prediction. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  let UID = 0;
  const LW = (window.LabWidgets = window.LabWidgets || {});

  /* ------------------------------------------------------------------ strings (EN / KO) */
  const DICT = {
    en: {
      title: 'How deep learning computes',
      badge: 'Teaching example: simulated patients and public molecule structures, small models — not for prediction',
      tab1: 'Neural network (MLP)', tab2: 'Graph neural network (GNN)', tablist: 'Choose a model',
      loading: 'Loading data…', loaderr: 'The widget data could not be loaded.',
      back: 'Back', next: 'Next', restart: 'Restart', stepOf: 'Step {0} of {1}',
      lede1: 'A small neural network learns apparent clearance (CL) from body weight, age, eGFR and metabolizer class. The 2,000 virtual patients are generated from a known formula plus noise, so what the network has learned can be compared with the truth. This is a synthetic teaching example, not a model of any real drug.',
      inH: 'Virtual patient', wt: 'Body weight', age: 'Age', egfr: 'eGFR', kg: 'kg', yr: 'y', egfrU: 'mL/min/1.73 m²',
      cls: 'Metabolizer class', c0: 'Poor', c1: 'Normal', c2: 'Rapid', lh: 'L/h',
      snapH: 'Training snapshot', snapVal: 'Epoch {0} (snapshot {1} of {2})',
      snapNote: 'Epoch 0 = random starting weights; the last snapshot is the end of training. The whole page uses the weights of the chosen snapshot.',
      pNet: 'Network output', pTrue: 'True function (typical value)', pRatio: 'Network ÷ true',
      pNote: 'Apparent clearance of a synthetic population. “True” is the formula that generated the data, without noise. The 2,000 virtual patients (1,400 of them used for training) were mostly 45–100 kg and their eGFR falls with age; far outside that range (for example 30 kg, 20 y, eGFR 20) the network is extrapolating and can be far from the true function.',
      netH: 'Network 5 → 8 → 6 → 1',
      legF: 'Edge width = |weight|. Blue solid = positive, red-brown dashed = negative. Node size = |value| (relative within a layer).',
      legB: 'Edge width = |gradient ∂L/∂w| for this patient (relative within a layer). Blue solid = positive, red-brown dashed = negative.',
      netAlt: 'Network diagram: {0} inputs, hidden layers of 8 and 6 units, one output. Output ln CL = {1}, CL = {2} L/h.',
      colHead: ['inputs x', 'a₁', 'a₂', 'output'],
      inNames: ['Weight', 'Age', 'eGFR', 'Poor', 'Rapid'], inShort: ['WT', 'age', 'eGFR', 'poor', 'rapid'],
      fwdH: 'Forward pass',
      fwdIntro: 'Each layer multiplies by a weight matrix, adds a bias (z = W·a + b) and applies ReLU (a = max(0, z)). Focus or click a number to see how it was computed.',
      fSteps: ['Inputs, z-scored', 'z₁ = W₁x + b₁', 'a₁ = ReLU(z₁)', 'z₂ = W₂a₁ + b₂', 'a₂ = ReLU(z₂)', 'ŷ = W₃a₂ + b₃  (ln CL)', 'CL = exp(ŷ)'],
      fRows: ['x (z-scored)', 'z₁ = W₁x + b₁', 'a₁ = ReLU(z₁)', 'z₂ = W₂a₁ + b₂', 'a₂ = ReLU(z₂)', 'ŷ = W₃a₂ + b₃ = ln CL', 'CL = exp(ŷ) in L/h'],
      exHint: 'Select a number to see its calculation.',
      bwdH: 'Backward pass (back-propagation)',
      bwdIntro: 'For this one patient the loss is L = (ŷ − y)², with y the true typical ln CL. The chain rule passes the error δ backwards, layer by layer, and gives every weight matrix a gradient ∂L/∂W = δ·aᵀ. Training moves each weight a small step against its gradient (averaged over a mini-batch).',
      bSteps: ['Loss and output error δ₃', 'Layer 3: ∂L/∂W₃ and δ₂', 'Layer 2: ∂L/∂W₂ and δ₁', 'Layer 1: ∂L/∂W₁'],
      bLoss: 'Prediction ŷ (ln CL)', bY: 'Target y (true ln CL)', bL: 'Loss L = (ŷ − y)²', bD3: 'δ₃ = ∂L/∂ŷ = 2(ŷ − y)',
      bLayer: 'Layer {0}', bDelta: 'δ = error at z', bW: '∂L/∂W', bB: '∂L/∂b', bNorm: 'Bars: gradient size ‖∂L/∂W‖ (Frobenius norm) and ‖∂L/∂b‖, drawn on a square-root scale.',
      bFormula: ['δ₃ = 2(ŷ − y);  ∂L/∂W₃ = δ₃·a₂ᵀ', 'δ₂ = (W₃ᵀδ₃) ⊙ [z₂ > 0];  ∂L/∂W₂ = δ₂·a₁ᵀ', 'δ₁ = (W₂ᵀδ₂) ⊙ [z₁ > 0];  ∂L/∂W₁ = δ₁·xᵀ'],
      bNone: 'Not reached yet — press Next.',
      learnH: 'What the network has learned',
      sMetrics: 'Held-out test set ({0} patients) at this snapshot: R² = {1}, RMSE of ln CL = {2}. The noise-free true function would reach R² = {3} on the same patients (ceiling set by the noise). Weight dependence vs truth: largest deviation {4} % in CL ({5} % between 45 and 100 kg).',
      lossH: 'Loss during training', lossAlt: 'Training and validation mean squared error of ln CL against epoch (log scales). Marker at epoch {0}: training {1}, validation {2}.',
      scH: 'Predicted vs observed CL', scAlt: 'Scatter of predicted against observed clearance for {0} held-out test patients at epoch {1}; R² = {2} on all {3} test patients.',
      pdH: 'Effect of body weight', pdAlt: 'Clearance against body weight for age 50, eGFR 90, normal metabolizer: network at epoch {0} versus the true function. Largest deviation {1} % in CL.',
      xEpoch: 'epoch (log scale)', yMse: 'MSE of ln CL', xObs: 'observed CL (L/h)', yPred: 'predicted CL (L/h)', xWt: 'body weight (kg)', yCl: 'CL (L/h)',
      lgTrain: 'training', lgVal: 'validation', lgNet: 'network', lgTruth: 'true function', lgObs: 'test patient', lgId: 'identity',
      clipped: '{0} points lie outside the plotted range.',
      mol: 'Molecule', steps: ['Atom features', 'Round 1', 'Round 2', 'Readout'], stepsAria: 'Message-passing step', color: 'Color atoms by',
      nsum: 'norm ‖h‖', contrib: 'GNN atom contribution c', refContrib: 'RDKit Crippen atom contribution (reference)',
      molAlt: '{0}: {1} heavy atoms drawn as a graph. Step: {2}. Selected atom {3} ({4}).',
      molHint: 'Arrow keys move between atoms; Enter or Space replays the message flow. Colors are relative within the molecule.',
      replay: 'Replay message flow', atomH: 'Atom {0} · {1}', atomInfo: 'degree {0}, {1}, {2}',
      aromatic: 'aromatic', aliphatic: 'non-aromatic', inRing: 'in ring', noRing: 'not in ring',
      lede2: 'A drug molecule is a graph. Each atom starts with 8 numbers. In each of two rounds an atom adds the vectors of its bonded neighbors to its own, multiplies by a weight matrix, adds a bias and applies ReLU. The final atom vectors are averaged and turned into a logP per heavy atom; multiplied by the number of heavy atoms, this is the model’s estimate of RDKit’s Crippen logP — a calculated value, not a measurement.',
      dFeat: 'Features x of this atom (8 numbers)',
      dOwn: 'Own vector', dNb: 'Neighbor {0} ({1})', dSum: 'Sum: own + neighbors', dZ: 'z = W·sum + b', dH: 'h = ReLU(z)',
      dContribH: 'Contribution of this atom to the predicted logP', dHead: 'Head weights w', dProd: 'w · h per dimension', dC: 'c = Σ(w·h) + b = {0}',
      dRef: 'RDKit Crippen contribution of this atom (reference): {0}. The network was trained only on whole-molecule logP, so single-atom values need not agree with the reference.', dW: 'Weight matrix W and bias b of this round',
      rdH: 'Readout', rdPool: 'Mean of the {0} final atom vectors', rdW: 'Head weights w', rdProd: 'w · pooled', rdS: 's = Σ(w·pooled) + b = {0}  (logP per heavy atom)',
      rdPred: 'Predicted logP = {0} atoms × s', rdRef: 'RDKit Crippen logP (reference)', rdDiff: 'Difference',
      rdNote: 'This molecule was removed from the training data.',
      evFig: 'GNN vs RDKit logP', lgKept: 'weights kept (lowest validation RMSE)',
      evH: 'Held-out check', evTxt: '{0} molecules never used for fitting or model selection (split by molecule): R² = {1}, RMSE = {2} log units. Regression on element counts alone gives R² = {3}. The three display molecules are not among them.',
      evAlt: 'Scatter of GNN predicted logP against RDKit Crippen logP for {0} held-out molecules; R² = {1}.',
      xRef: 'RDKit Crippen logP', yGnn: 'GNN logP', lgHeld: 'held-out molecule', lgShown: 'molecule shown above',
      trH: 'Training of the GNN', trAlt: 'Training and validation RMSE of logP against epoch.', xEp: 'epoch', yRmse: 'RMSE (logP)',
      howH: 'How it is computed',
      how: ['Atom features x (8 numbers): one-hot element (C, N, O, other), aromatic (0/1), heavy-atom degree ÷ 4, formal charge, in ring (0/1).',
        'Message passing, rounds k = 1, 2:  m = h(v) + Σ h(u) over the bonded neighbors u;  z = Wₖ·m + bₖ;  h′(v) = ReLU(z) = max(0, z). Round 1 starts from h = x; each round has its own weights; hidden size 8.',
        'Readout: p = mean of h over all n heavy atoms;  s = w·p + b;  predicted logP = n × s. Equivalently every atom contributes c = w·h + b and the contributions add up to the prediction.',
        'Training happened once, offline, in plain NumPy (Adam, squared error against RDKit’s Crippen logP). The page only repeats the forward calculation from the stored weights and checks it against the NumPy numbers.'],
      adme: 'In the literature, graph networks of this kind are trained on thousands of measured compounds to predict ADME and toxicity properties (for example Yang et al., 2019, J Chem Inf Model); the model here is far smaller and learns only a calculated logP.',
      aboutH: 'About this example',
      what: 'What you see', whatTxt: 'Left to right, top to bottom: one virtual patient is passed through the network (forward pass), the error is passed back (backward pass), and the snapshot slider replays training. In the second tab a molecule is a graph; atoms exchange numbers with their neighbors, and the averaged result, scaled by the number of heavy atoms, is one logP value.',
      lim: 'Limitations', limTxt: 'Both models are small teaching examples. The MLP learns a formula that we wrote ourselves from simulated patients; its accuracy says nothing about real clearance, which depends on many other factors. The GNN imitates RDKit’s Crippen logP, a value calculated from atom-type contributions, on a few thousand structures from a public set; it is not a measured property and was not tested on other chemical series. Neither model should be used for prediction. R² and RMSE are for held-out data only (split by patient or by molecule).',
      selfOk: 'Self-test: browser calculation matches the NumPy reference (largest difference {0}, tolerance 1e-5; gradients also match finite differences).',
      selfBad: 'Self-test FAILED: browser and NumPy numbers differ by {0} (tolerance 1e-5).',
      live1: 'Weight {0} kg, age {1}, eGFR {2}, {3}. Epoch {4}: network {5} L/h, true function {6} L/h.',
      live2: '{0}, step {1}: {2}. Atom {3} selected.',
      selTag: 'selected', rowN: 'row {0}', reluOff: ' → 0 (ReLU off)', vsT: '{0}: {1} vs {2}'
    }
  };
  const fmtS = (str, a) => String(str).replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined ? m : a[+i]));

  /* ------------------------------------------------------------------ small helpers */
  function add(e, kids) {
    if (kids == null || kids === false) return;
    if (!Array.isArray(kids)) kids = [kids];
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) add(e, c); else e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
  }
  function fill(e, a, kids) {
    if (a) for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    add(e, kids);
    return e;
  }
  const h = (tag, a, kids) => fill(document.createElement(tag), a, kids);
  const s = (tag, a, kids) => fill(document.createElementNS(NS, tag), a, kids);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function f(v, d) {
    if (!isFinite(v)) return '–';
    let t = v.toFixed(d == null ? 3 : d);
    if (/^-0\.?0*$/.test(t)) t = t.slice(1);
    return t.replace('-', MINUS);
  }
  function fg(v) { // gradient numbers: fixed when readable, exponent when tiny
    if (v === 0) return '0';
    const a = Math.abs(v);
    return (a >= 0.01 ? v.toFixed(3) : v.toExponential(1)).replace('e-', 'e−').replace('-', MINUS).replace('e+', 'e');
  }
  const sub = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
  function hexRgb(c, fb) {
    c = (c || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [...m[1]].map((x) => parseInt(x + x, 16));
    return fb;
  }
  const lum = (c) => { const k = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  /* ------------------------------------------------------------------ numerics (the real computation) */
  const mv = (W, x, b) => W.map((r, i) => { let t = b[i]; for (let j = 0; j < r.length; j++) t += r[j] * x[j]; return t; });
  const relu = (v) => v.map((a) => (a > 0 ? a : 0));
  function mlpFwd(w, x) {
    const z1 = mv(w.W1, x, w.b1), a1 = relu(z1), z2 = mv(w.W2, a1, w.b2), a2 = relu(z2), z3 = mv(w.W3, a2, w.b3)[0];
    return { x, z1, a1, z2, a2, yhat: z3 };
  }
  // loss L = (yhat - y)^2 for ONE sample; returns the gradients that training averages over a mini-batch
  function mlpBwd(w, c, y) {
    const d3 = 2 * (c.yhat - y);
    const d2 = w.W3[0].map((wv, j) => (c.z2[j] > 0 ? d3 * wv : 0));
    const d1 = c.z1.map((z, j) => { if (!(z > 0)) return 0; let t = 0; for (let i = 0; i < d2.length; i++) t += w.W2[i][j] * d2[i]; return t; });
    const outer = (d, a) => d.map((di) => a.map((aj) => di * aj));
    return { L: (c.yhat - y) * (c.yhat - y), d3, d2, d1, dW3: [c.a2.map((a) => d3 * a)], db3: [d3], dW2: outer(d2, c.a1), db2: d2, dW1: outer(d1, c.x), db1: d1 };
  }
  const trueLn = (wt, egfr, cls) => Math.log(4.5) + 0.75 * Math.log(wt / 70) + 0.4 * Math.log(egfr / 90) + Math.log([0.55, 1, 1.35][cls]);
  const stdz = (M, raw) => raw.map((v, i) => (v - M.norm.mean[i]) / M.norm.sd[i]);
  const rawX = (wt, age, egfr, cls) => [wt, age, egfr, cls === 0 ? 1 : 0, cls === 2 ? 1 : 0];
  const frob = (M) => Math.sqrt(M.reduce((a, r) => a + r.reduce((b, v) => b + v * v, 0), 0));
  const l2 = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

  function gnnFeat(a) {
    return [a.el === 'C' ? 1 : 0, a.el === 'N' ? 1 : 0, a.el === 'O' ? 1 : 0, (a.el === 'C' || a.el === 'N' || a.el === 'O') ? 0 : 1, a.ar, a.deg / 4, a.chg, a.ring];
  }
  function nbrs(mol) {
    if (mol._nb) return mol._nb;
    const nb = mol.atoms.map(() => []);
    mol.bonds.forEach((b) => { nb[b.a].push(b.b); nb[b.b].push(b.a); });
    return (mol._nb = nb);
  }
  function mpRound(mol, H, W, b) {
    const nb = nbrs(mol), m = [], z = [];
    H.forEach((hv, v) => { const t = hv.slice(); nb[v].forEach((u) => H[u].forEach((x, k) => { t[k] += x; })); m.push(t); z.push(mv(W, t, b)); });
    return { m, z, h: z.map(relu) };
  }
  function gnnFwd(G, mol) {
    const x = mol.atoms.map(gnnFeat), r1 = mpRound(mol, x, G.weights.W1, G.weights.b1), r2 = mpRound(mol, r1.h, G.weights.W2, G.weights.b2);
    const n = x.length, pooled = r2.h[0].map((_, k) => r2.h.reduce((a, row) => a + row[k], 0) / n);
    const w = G.weights.w, b0 = G.weights.b0[0], sc = pooled.reduce((a, p, k) => a + p * w[k], 0) + b0;
    const contrib = r2.h.map((hv) => hv.reduce((a, p, k) => a + p * w[k], 0) + b0);
    return { x, r1, r2, h: [x, r1.h, r2.h], pooled, s: sc, n, pred: n * sc, contrib };
  }

  /* ------------------------------------------------------------------ self test */
  function cmp(a, b, acc, name) {
    if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) { acc.max = Infinity; acc.where = name + ' shape'; return; } a.forEach((v, i) => cmp(v, b[i], acc, name)); return; }
    const d = Math.abs(a - b);
    acc.n++;
    if (!(d <= acc.max)) { acc.max = d; acc.where = name; }
  }
  function selfTestData(M, G) {
    const out = { tol: 1e-5, mlp: { max: 0, n: 0, where: '' }, gnn: { max: 0, n: 0, where: '' }, fd: { max: 0, n: 0 } };
    const snaps = M.snapshots.length, wts = M.weights;
    M.selftest.cases.forEach((c, i) => {
      const w = wts[c.snapshot], fw = mlpFwd(w, stdz(M, c.x_raw)), bw = mlpBwd(w, fw, c.target), A = out.mlp, p = 'case' + i + '.';
      cmp(fw.x, c.x, A, p + 'x'); cmp(fw.z1, c.z1, A, p + 'z1'); cmp(fw.a1, c.a1, A, p + 'a1'); cmp(fw.z2, c.z2, A, p + 'z2'); cmp(fw.a2, c.a2, A, p + 'a2');
      cmp(fw.yhat, c.yhat, A, p + 'yhat'); cmp(bw.L, c.loss, A, p + 'loss'); cmp(bw.d3, c.d3[0], A, p + 'd3'); cmp(bw.d2, c.d2, A, p + 'd2'); cmp(bw.d1, c.d1, A, p + 'd1');
      ['dW3', 'db3', 'dW2', 'db2', 'dW1', 'db1'].forEach((k) => cmp(bw[k], c[k], A, p + k));
      if (i === M.selftest.cases.length - 1) { // finite-difference check of the browser back-propagation itself
        const base = JSON.parse(JSON.stringify(w)), x = fw.x, lossAt = (ww) => { const q = mlpFwd(ww, x).yhat - c.target; return q * q; };
        ['W1', 'b1', 'W2', 'b2', 'W3', 'b3'].forEach((k) => {
          const g = bw['d' + k], P = base[k], Pm = Array.isArray(P[0]) ? P : [P], Gm = Array.isArray(P[0]) ? g : [g];
          Pm.forEach((row, r) => row.forEach((v, j) => {
            const e = 1e-6; row[j] = v + e; const lp = lossAt(base); row[j] = v - e; const lm = lossAt(base); row[j] = v;
            const d = Math.abs((lp - lm) / (2 * e) - Gm[r][j]); out.fd.n++; if (d > out.fd.max) out.fd.max = d;
          }));
        });
      }
    });
    for (let si = 0; si < snaps; si++) {
      const w = wts[si];
      cmp(M.test_scatter.x_raw.map((r) => mlpFwd(w, stdz(M, r)).yhat), M.test_scatter.pred[si], out.mlp, 'scatter' + si);
      cmp(M.pd.wt.map((v) => mlpFwd(w, stdz(M, rawX(v, M.pd.age, M.pd.egfr, 1))).yhat), M.pd.net[si], out.mlp, 'pd' + si);
    }
    cmp(M.pd.wt.map((v) => trueLn(v, M.pd.egfr, 1)), M.pd.truth, out.mlp, 'pdtruth');
    G.molecules.concat(G.selftest.extra).forEach((m) => {
      const r = gnnFwd(G, m), A = out.gnn, p = m.id + '.';
      cmp(r.x, m.x, A, p + 'x'); cmp(r.r1.h, m.h1, A, p + 'h1'); cmp(r.r2.h, m.h2, A, p + 'h2'); cmp(r.pooled, m.pooled, A, p + 'pooled'); cmp(r.s, m.s, A, p + 's'); cmp(r.pred, m.pred, A, p + 'pred');
      cmp(r.contrib.reduce((a, b) => a + b, 0), m.pred, A, p + 'contribSum');
    });
    const mx = Math.max(out.mlp.max, out.gnn.max, out.fd.max);
    out.maxAbsDiff = mx; out.ok = mx <= out.tol && out.mlp.n > 0 && out.gnn.n > 0;
    return out;
  }

  /* ------------------------------------------------------------------ SVG charts */
  const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  const lgs = (d0, d1, r0, r1) => { const a = Math.log(d0), b = Math.log(d1); return (v) => r0 + ((Math.log(v) - a) / (b - a)) * (r1 - r0); };
  function chartFrame(o) {
    const W = 320, H = o.H || 236, m = { l: 46, r: 10, t: 10, b: 40 }, cid = 'dxc' + (++UID);
    const X = o.x.sc(m.l, W - m.r), Y = o.y.sc(H - m.b, m.t);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dx-chart', role: 'img', 'aria-label': o.label, focusable: 'false' });
    svg.append(s('defs', null, s('clipPath', { id: cid }, s('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }))));
    const g = s('g');
    o.y.ticks.forEach((t) => { const y = Y(t.v); g.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'dx-gl' }), s('text', { x: m.l - 5, y: y + 4, class: 'dx-tick', 'text-anchor': 'end', text: t.l })); });
    o.x.ticks.forEach((t) => { const x = X(t.v); g.append(s('line', { x1: x, x2: x, y1: m.t, y2: H - m.b, class: 'dx-gl' }), s('text', { x, y: H - m.b + 14, class: 'dx-tick', 'text-anchor': 'middle', text: t.l })); });
    g.append(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'dx-axis' }), s('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: 'dx-axis' }),
      s('text', { x: (m.l + W - m.r) / 2, y: H - 6, class: 'dx-axl', 'text-anchor': 'middle', text: o.x.label }),
      s('text', { transform: `translate(11 ${(m.t + H - m.b) / 2}) rotate(-90)`, class: 'dx-axl', 'text-anchor': 'middle', text: o.y.label }));
    const plot = s('g', { 'clip-path': `url(#${cid})` });
    svg.append(g, plot);
    return { svg, plot, X, Y, W, H, m };
  }
  const path = (pts, cls) => s('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''), class: cls, fill: 'none' });
  function legend(items) { // [{cls,label,dash}] as HTML so it wraps
    return h('ul', { class: 'dx-leg' }, items.map((it) => h('li', null, [h('span', { class: 'dx-sw ' + it.cls }), it.label])));
  }

  /* ------------------------------------------------------------------ the widget */
  function create(el, M, Gd) {
    const lang = 'en';
    const D = DICT[lang], T = (k, ...a) => fmtS(D[k] !== undefined ? D[k] : DICT.en[k], a);
    const id = 'dx' + (++UID), reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const root = h('div', { class: 'dx-root', lang });
    const pal = (() => { const cs = getComputedStyle(el); const g = (n, fb) => hexRgb(cs.getPropertyValue(n), fb); return { accent: g('--accent', [10, 125, 119]), accent2: g('--accent-2', [6, 94, 89]), data: g('--data', [200, 89, 15]), blue: g('--blue', [40, 89, 168]), ink: g('--ink', [16, 36, 58]), soft: g('--bg-soft', [243, 246, 249]) }; })();
    const tint = (v, vmax, act) => { const a = vmax > 0 ? Math.min(1, Math.abs(v) / vmax) : 0, c = act ? pal.accent : (v >= 0 ? pal.blue : pal.data); return `rgba(${c[0]},${c[1]},${c[2]},${(0.05 + 0.32 * a).toFixed(3)})`; };
    const W = M.weights, NS_ = M.snapshots.length, FIN = NS_ - 1;
    const st = { tab: 0, snap: FIN, wt: 70, age: 50, egfr: 90, cls: 1, fStep: 0, bStep: 0, diag: 'f', mi: 0, gStep: 0, gDim: [4, 0, 0, 0], gUser: {}, atom: 0 };
    let raf = 0, liveT = 0;

    const live = h('div', { class: 'dx-sr', role: 'status', 'aria-live': 'polite' });
    const announce = (txt) => { clearTimeout(liveT); liveT = setTimeout(() => { live.textContent = txt; }, 350); };

    /* ---- cell grids ------------------------------------------------------------------ */
    function nav(e, grid) { // roving tabindex with 2-D arrow keys
      const cells = [...grid.querySelectorAll('.dx-cell')], cols = +grid.getAttribute('data-cols'), i = cells.indexOf(document.activeElement);
      if (i < 0) return;
      let j = i;
      if (e.key === 'ArrowRight') j = Math.min(cells.length - 1, i + 1); else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
      else if (e.key === 'ArrowDown') j = Math.min(cells.length - 1, i + cols); else if (e.key === 'ArrowUp') j = Math.max(0, i - cols);
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = cells.length - 1; else return;
      e.preventDefault(); cells[i].tabIndex = -1; cells[j].tabIndex = 0; cells[j].focus();
    }
    // rows: array of arrays of numbers; o: {names, act, vmax, label, ex(r,c), fmt, dig}
    function grid(rows, o) {
      o = o || {};
      const nc = rows[0].length, all = [].concat(...rows), vmax = o.vmax || Math.max(1e-12, ...all.map(Math.abs)), nf = o.fmt || ((v) => f(v, o.dig));
      const g = h('div', { class: 'dx-cells' + (rows.length > 1 ? ' dx-mat' : ''), role: 'group', 'aria-label': o.label || '', 'data-cols': nc });
      g.style.setProperty('--n', nc); g.style.setProperty('--nm', nc <= 4 ? nc : Math.ceil(nc / 2));
      rows.forEach((row, r) => row.forEach((v, c) => {
        const nm = o.names ? o.names[c] : String(c + 1), ex = o.ex ? o.ex(r, c, v) : '';
        const cell = h('button', { type: 'button', class: 'dx-cell' + (o.act && v === 0 ? ' dx-zero' : ''), tabindex: r + c === 0 ? '0' : '-1', 'data-ex': ex, title: ex || null, 'aria-label': `${o.rowName ? o.rowName(r) + ' ' : ''}${nm}: ${nf(v)}${ex ? '. ' + ex : ''}` },
          [r === 0 || rows.length === 1 ? h('span', { class: 'dx-cn', 'aria-hidden': 'true', text: nm }) : null, h('span', { class: 'dx-cv', text: nf(v) })]);
        cell.style.background = tint(v, vmax, o.act);
        g.append(cell);
      }));
      g.addEventListener('keydown', (e) => nav(e, g));
      return g;
    }
    const scroller = (node, label) => h('div', { class: 'dx-scroll', tabindex: '0', role: 'region', 'aria-label': label }, node);
    function sumExpr(Wr, x, b, d) { // "w1*x1 + w2*x2 + ... + b = z"
      return Wr.map((w, j) => `${f(w, 2)}·${f(x[j], 2)}`).join(' + ') + ` + ${f(b, 2)}`;
    }
    function explainer() {
      const box = h('p', { class: 'dx-explain', text: T('exHint') });
      const show = (e) => { const c = e.target.closest && e.target.closest('.dx-cell'); if (c && c.dataset.ex) box.textContent = c.dataset.ex; };
      return { box, wire: (node) => { node.addEventListener('focusin', show); node.addEventListener('mouseover', show); node.addEventListener('click', show); } };
    }

    /* ---- header + tabs ---------------------------------------------------------------- */
    const tabBtns = [], panels = [];
    const tablist = h('div', { class: 'dx-tabs', role: 'tablist', 'aria-label': T('tablist') });
    ['tab1', 'tab2'].forEach((k, i) => {
      const b = h('button', { type: 'button', class: 'dx-tab', role: 'tab', id: `${id}-t${i}`, 'aria-controls': `${id}-p${i}`, 'aria-selected': i ? 'false' : 'true', tabindex: i ? '-1' : '0', text: T(k) });
      b.addEventListener('click', () => setTab(i));
      b.addEventListener('keydown', (e) => {
        const n = tabBtns.length; let j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % n; else if (e.key === 'ArrowLeft') j = (i + n - 1) % n; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
        if (j >= 0) { e.preventDefault(); setTab(j); tabBtns[j].focus(); }
      });
      tabBtns.push(b); tablist.append(b);
      panels.push(h('div', { class: 'dx-panel', role: 'tabpanel', id: `${id}-p${i}`, 'aria-labelledby': `${id}-t${i}`, tabindex: '0', hidden: i ? true : null }));
    });
    function setTab(i) {
      st.tab = i;
      tabBtns.forEach((b, k) => { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; });
      i ? refreshG() : refreshM();
    }
    root.append(
      h('header', { class: 'dx-head' }, [h('h3', { class: 'dx-title', text: T('title') }), h('p', { class: 'dx-badge', text: T('badge') })]),
      tablist, panels[0], panels[1], live);

    /* ================================================================== TAB 1: MLP */
    const P1 = panels[0];
    const mkSlider = (key, min, max, unit, label) => {
      const out = h('output', { class: 'dx-val', for: `${id}-${key}` }), inp = h('input', { type: 'range', id: `${id}-${key}`, min, max, step: 1, value: st[key] });
      inp.addEventListener('input', () => { st[key] = +inp.value; refreshM(); });
      return { row: h('div', { class: 'dx-row' }, [h('label', { for: inp.id, text: label }), out, inp]), out, inp, unit };
    };
    const sl = { wt: mkSlider('wt', 30, 120, T('kg'), T('wt')), age: mkSlider('age', 20, 85, T('yr'), T('age')), egfr: mkSlider('egfr', 20, 120, T('egfrU'), T('egfr')) };
    const snapOut = h('output', { class: 'dx-val', for: `${id}-snap` });
    const snapIn = h('input', { type: 'range', id: `${id}-snap`, min: 0, max: FIN, step: 1, value: FIN });
    snapIn.addEventListener('input', () => { st.snap = +snapIn.value; refreshM(); });
    const clsRadios = [0, 1, 2].map((k) => {
      const r = h('input', { type: 'radio', name: `${id}-cls`, id: `${id}-c${k}`, value: k, checked: k === 1 ? true : null });
      r.addEventListener('change', () => { st.cls = k; refreshM(); });
      return h('label', { class: 'dx-seg', for: r.id }, [r, h('span', { text: T('c' + k) })]);
    });
    const predNet = h('strong', { class: 'dx-big' }), predTrue = h('strong', { class: 'dx-big' }), predRatio = h('strong', { class: 'dx-big' });
    const ticks = h('div', { class: 'dx-snapticks', 'aria-hidden': 'true' }, M.snapshots.map((e) => h('span', { text: e })));
    const cardIn = h('section', { class: 'dx-card' }, [
      h('h3', { text: T('inH') }), sl.wt.row, sl.age.row, sl.egfr.row,
      h('fieldset', { class: 'dx-fs' }, [h('legend', { text: T('cls') }), h('div', { class: 'dx-segs' }, clsRadios)]),
      h('div', { class: 'dx-snapbox' }, [h('div', { class: 'dx-row' }, [h('label', { for: snapIn.id, text: T('snapH') }), snapOut, snapIn]), ticks, h('p', { class: 'dx-note', text: T('snapNote') })]),
      h('dl', { class: 'dx-pred' }, [h('div', null, [h('dt', { text: T('pNet') }), h('dd', null, [predNet, ' ', T('lh')])]), h('div', null, [h('dt', { text: T('pTrue') }), h('dd', null, [predTrue, ' ', T('lh')])]), h('div', null, [h('dt', { text: T('pRatio') }), h('dd', null, predRatio)])]),
      h('p', { class: 'dx-note', text: T('pNote') })]);

    // network diagram (built once, attributes updated)
    const VW = 360, VH = 330, LX = [92, 170, 248, 316], SIZES = [5, 8, 6, 1];
    const NY = SIZES.map((n) => { const sp = Math.min(36, 270 / n), t0 = 172 - (sp * (n - 1)) / 2; return Array.from({ length: n }, (_, i) => t0 + i * sp); });
    const net = s('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'dx-net', role: 'img', focusable: 'false' });
    const edges = [[], [], []], nodes = SIZES.map(() => []);
    for (let l = 0; l < 3; l++) { const gE = s('g'); for (let i = 0; i < SIZES[l + 1]; i++) for (let j = 0; j < SIZES[l]; j++) { const ln = s('line', { x1: LX[l], y1: NY[l][j], x2: LX[l + 1], y2: NY[l + 1][i], 'stroke-linecap': 'round' }); gE.append(ln); edges[l].push(ln); } net.append(gE); }
    SIZES.forEach((n, l) => { for (let i = 0; i < n; i++) { const c = s('circle', { cx: LX[l], cy: NY[l][i], r: 8, class: 'dx-node' }, s('title')); net.append(c); nodes[l].push(c); } });
    D.colHead.forEach((t, l) => net.append(s('text', { x: LX[l], y: 18, class: 'dx-nlab dx-nhead', 'text-anchor': l === 3 ? 'end' : 'middle', text: t })));
    D.inShort.forEach((t, i) => net.append(s('text', { x: LX[0] - 15, y: NY[0][i] + 5, class: 'dx-nlab', 'text-anchor': 'end', text: t })));
    const outLab = s('text', { x: VW - 4, y: NY[3][0] + 32, class: 'dx-nlab dx-nhalo', 'text-anchor': 'end' });
    net.append(outLab);
    const netCap = h('p', { class: 'dx-note' }), netDesc = h('p', { class: 'dx-sr', id: `${id}-nd` });
    net.setAttribute('aria-describedby', netDesc.id);
    const cardNet = h('section', { class: 'dx-card' }, [h('h3', { text: T('netH') }), h('div', { class: 'dx-figure' }, net), netCap, netDesc]);

    // forward + backward cards
    const exF = explainer(), exB = explainer();
    const fBody = h('div'), bBody = h('div');
    const stepper = (key, n, names, go) => {
      const lab = h('p', { class: 'dx-steplab', 'aria-live': 'polite' });
      const bk = h('button', { type: 'button', class: 'dx-btn', text: T('back') }), nx = h('button', { type: 'button', class: 'dx-btn dx-btn-p', text: T('next') }), rs = h('button', { type: 'button', class: 'dx-btn', text: T('restart') });
      bk.addEventListener('click', () => { st[key] = Math.max(0, st[key] - 1); st.diag = key === 'fStep' ? 'f' : 'b'; go(); });
      nx.addEventListener('click', () => { st[key] = Math.min(n - 1, st[key] + 1); st.diag = key === 'fStep' ? 'f' : 'b'; go(); });
      rs.addEventListener('click', () => { st[key] = 0; st.diag = key === 'fStep' ? 'f' : 'b'; go(); });
      const upd = () => { lab.textContent = `${T('stepOf', st[key] + 1, n)} — ${names[st[key]]}`; bk.setAttribute('aria-disabled', String(st[key] === 0)); nx.setAttribute('aria-disabled', String(st[key] === n - 1)); };
      return { node: h('div', { class: 'dx-stepper' }, [h('div', { class: 'dx-btns' }, [bk, nx, rs]), lab]), upd };
    };
    const fStep = stepper('fStep', 7, D.fSteps, () => refreshM()), bStep = stepper('bStep', 4, D.bSteps, () => refreshM());
    const cardF = h('section', { class: 'dx-card dx-fwd' }, [h('h3', { text: T('fwdH') }), h('p', { class: 'dx-note', text: T('fwdIntro') }), fStep.node, fBody, exF.box]);
    const cardB = h('section', { class: 'dx-card' }, [h('h3', { text: T('bwdH') }), h('p', { class: 'dx-note', text: T('bwdIntro') }), bStep.node, bBody, exB.box]);
    exF.wire(fBody); exB.wire(bBody);

    // learning charts
    const chLoss = h('div'), chSc = h('div'), chPd = h('div'), metTxt = h('p', { class: 'dx-note dx-metrics' });
    const fig = (title, body, leg) => h('figure', { class: 'dx-fig' }, [h('figcaption', { text: title }), body, leg]);
    const cardL = h('section', { class: 'dx-card dx-wide' }, [h('h3', { text: T('learnH') }), metTxt,
      h('div', { class: 'dx-charts' }, [
        fig(T('lossH'), chLoss, legend([{ cls: 'dx-sw-a', label: T('lgTrain') }, { cls: 'dx-sw-b', label: T('lgVal') }])),
        fig(T('scH'), chSc, legend([{ cls: 'dx-sw-dot', label: T('lgObs') }, { cls: 'dx-sw-id', label: T('lgId') }])),
        fig(T('pdH'), chPd, legend([{ cls: 'dx-sw-a', label: T('lgNet') }, { cls: 'dx-sw-d', label: T('lgTruth') }]))])]);
    const aboutM = h('details', { class: 'dx-details dx-wide' }, [h('summary', { text: T('aboutH') }),
      h('h4', { text: T('what') }), h('p', { text: T('whatTxt') }), h('h4', { text: T('lim') }), h('p', { text: T('limTxt') }), h('p', { class: 'dx-self', id: `${id}-self` })]);
    P1.append(h('p', { class: 'dx-lede', text: T('lede1') }), h('div', { class: 'dx-grid' }, [cardIn, cardNet, cardF, cardB, cardL]), aboutM);

    const selfLine = aboutM.querySelector('.dx-self');
    let cur = null;
    function compute() {
      const w = W[st.snap], raw = rawX(st.wt, st.age, st.egfr, st.cls), x = stdz(M, raw), c = mlpFwd(w, x), yT = trueLn(st.wt, st.egfr, st.cls);
      cur = { w, raw, x, c, yT, g: mlpBwd(w, c, yT) };
    }
    function drawNet() {
      const { w, c, g } = cur, bwd = st.diag === 'b', step = bwd ? st.bStep : st.fStep, mats = [w.W1, w.W2, w.W3];
      const gm = [g.dW1, g.dW2, g.dW3], gmax = Math.max(...mats.map((m) => Math.max(...m.flat().map(Math.abs))));
      // how much is "reached": fwd steps 0..6 ; bwd steps 0..3
      const reach = bwd ? [step >= 3, step >= 2, step >= 1] : [step >= 1, step >= 3, step >= 5];
      const nodeOn = bwd ? [step >= 3, step >= 2, step >= 1, true] : [true, step >= 2, step >= 4, step >= 5];
      for (let l = 0; l < 3; l++) {
        const M_ = bwd ? gm[l] : mats[l], mx = bwd ? Math.max(1e-12, ...M_.flat().map(Math.abs)) : gmax;
        edges[l].forEach((ln, k) => {
          const i = Math.floor(k / SIZES[l]), j = k % SIZES[l], v = M_[i][j], a = Math.abs(v) / mx;
          ln.setAttribute('stroke-width', (0.4 + 3.2 * a).toFixed(2)); ln.setAttribute('stroke-opacity', (reach[l] ? 0.22 + 0.7 * a : 0.07).toFixed(2));
          ln.setAttribute('class', v >= 0 ? 'dx-e-pos' : 'dx-e-neg');
        });
      }
      const acts = [c.x, c.a1, c.a2, [c.yhat]];
      acts.forEach((a, l) => {
        const mx = Math.max(1e-12, ...a.map(Math.abs));
        nodes[l].forEach((nd, i) => {
          const v = a[i], rr = l === 3 ? 12 : 5 + 8 * Math.min(1, Math.abs(v) / mx), col = l === 0 ? (v >= 0 ? pal.blue : pal.data) : l === 3 ? pal.data : pal.accent;
          nd.setAttribute('r', rr.toFixed(1)); nd.setAttribute('fill', `rgba(${col[0]},${col[1]},${col[2]},${(l === 3 ? 0.85 : 0.12 + 0.8 * Math.min(1, Math.abs(v) / mx)).toFixed(2)})`);
          nd.setAttribute('opacity', nodeOn[l] ? '1' : '0.2'); nd.setAttribute('class', 'dx-node' + (v === 0 && l > 0 && l < 3 ? ' dx-dead' : ''));
          nd.firstChild.textContent = `${l === 0 ? D.inNames[i] : l === 3 ? 'ln CL' : 'a' + sub(l) + '[' + (i + 1) + ']'} = ${f(v)}`;
        });
      });
      outLab.textContent = `ln CL = ${f(c.yhat, 2)}`;
      netCap.textContent = bwd ? T('legB') : T('legF');
      const alt = T('netAlt', 5, f(c.yhat), f(Math.exp(c.yhat), 2));
      net.setAttribute('aria-label', T('netH')); netDesc.textContent = alt;
    }
    const rowLab = (txt, cls) => h('div', { class: 'dx-rowlab' + (cls ? ' ' + cls : ''), text: txt });
    function drawForward() {
      const { w, c, x, raw } = cur, step = st.fStep, B = [w.b1, w.b2, w.b3[0]];
      const defs = [
        { v: c.x, names: D.inShort, ex: (r, k) => `x[${D.inShort[k]}] = (${f(raw[k], 1)} − ${f(M.norm.mean[k], 2)}) / ${f(M.norm.sd[k], 2)} = ${f(c.x[k])}` },
        { v: c.z1, ex: (r, k) => `z₁[${k + 1}] = ${sumExpr(w.W1[k], x, w.b1[k])} = ${f(c.z1[k])}` },
        { v: c.a1, act: true, ex: (r, k) => `a₁[${k + 1}] = max(0, ${f(c.z1[k])}) = ${f(c.a1[k])}` },
        { v: c.z2, ex: (r, k) => `z₂[${k + 1}] = ${sumExpr(w.W2[k], c.a1, w.b2[k])} = ${f(c.z2[k])}` },
        { v: c.a2, act: true, ex: (r, k) => `a₂[${k + 1}] = max(0, ${f(c.z2[k])}) = ${f(c.a2[k])}` },
        { v: [c.yhat], names: ['ln CL'], ex: () => `ŷ = ${sumExpr(w.W3[0], c.a2, B[2])} = ${f(c.yhat)}` },
        { v: [Math.exp(c.yhat)], names: ['L/h'], ex: () => `CL = exp(${f(c.yhat)}) = ${f(Math.exp(c.yhat))} L/h` }];
      const kids = defs.map((d, i) => {
        const on = i <= step, rowEl = h('div', { class: 'dx-trow' + (i === step ? ' dx-now' : '') + (on ? '' : ' dx-off'), 'aria-current': i === step ? 'step' : null });
        rowEl.append(rowLab(D.fRows[i]));
        if (on) rowEl.append(grid([d.v], { names: d.names, act: d.act, label: D.fRows[i], ex: d.ex, dig: i === 6 ? 2 : 3, vmax: i === 0 ? 2.5 : null }));
        else rowEl.append(h('div', { class: 'dx-pending', text: '…' }));
        return rowEl;
      });
      fBody.replaceChildren(...kids);
    }
    function deltaEx(n, j, dl) {
      const { w, c, g } = cur;
      if (n === 3) return `δ₃ = 2(ŷ − y) = ${fg(g.d3)}`;
      if (n === 2) return `δ₂[${j + 1}] = W₃[${j + 1}]·δ₃·[z₂>0] = ${f(w.W3[0][j], 3)}·${fg(g.d3)}${c.z2[j] > 0 ? '' : T('reluOff')} = ${fg(dl[j])}`;
      return `δ₁[${j + 1}] = (Σ W₂[i][${j + 1}]·δ₂[i])·[z₁>0]${c.z1[j] > 0 ? '' : T('reluOff')} = ${fg(dl[j])}`;
    }
    function drawBackward() {
      const { c, g, x, yT } = cur, step = st.bStep, kids = [];
      const top = h('div', { class: 'dx-trow' + (step === 0 ? ' dx-now' : '') }, [rowLab(T('bLoss') + ', ' + T('bY') + ', ' + T('bL')),
        grid([[c.yhat, yT, g.L, g.d3]], { names: ['ŷ', 'y', 'L', 'δ₃'], label: T('bL'), dig: 4, ex: (r, k) => [`ŷ = ${f(c.yhat, 4)}`, `y = ln(${f(Math.exp(yT), 3)} L/h) = ${f(yT, 4)}`, `L = (${f(c.yhat, 4)} − ${f(yT, 4)})² = ${f(g.L, 5)}`, `${T('bD3')} = ${f(g.d3, 4)}`][k] })]);
      kids.push(top);
      const layers = [{ n: 3, d: [g.d3], dW: g.dW3, db: g.db3, a: c.a2 }, { n: 2, d: g.d2, dW: g.dW2, db: g.db2, a: c.a1 }, { n: 1, d: g.d1, dW: g.dW1, db: g.db1, a: x }];
      const norms = layers.map((L) => ({ W: frob(L.dW), b: l2(L.db) })), nmax = Math.max(1e-12, ...norms.map((q) => Math.max(q.W, q.b)));
      layers.forEach((L, k) => {
        const reached = step >= k + 1;
        const sec = h('div', { class: 'dx-trow dx-lay' + (step === k + 1 ? ' dx-now' : '') + (reached ? '' : ' dx-off'), 'aria-current': step === k + 1 ? 'step' : null });
        sec.append(rowLab(`${T('bLayer', L.n)}: ${D.bFormula[k]}`, 'dx-lt'));
        if (!reached) { sec.append(h('div', { class: 'dx-pending', text: T('bNone') })); kids.push(sec); return; }
        const dl = L.d, mat = L.dW;
        sec.append(rowLab('δ' + sub(L.n) + ' (' + T('bDelta') + ')'), grid([dl], { label: 'δ' + sub(L.n), dig: 4, fmt: fg, ex: (r, j) => deltaEx(L.n, j, dl) }));
        sec.append(rowLab(T('bW') + sub(L.n) + ` (${mat.length}×${mat[0].length})`),
          scroller(grid(mat, { names: L.n === 1 ? D.inShort : L.n === 2 ? mat[0].map((_, j) => 'a' + sub(1) + (j + 1)) : mat[0].map((_, j) => 'a' + sub(2) + (j + 1)), label: T('bW') + sub(L.n), fmt: fg, rowName: (r) => T('rowN', r + 1), ex: (r, j) => `∂L/∂W${sub(L.n)}[${r + 1}][${j + 1}] = δ[${r + 1}]·${L.n === 1 ? 'x' : 'a'}[${j + 1}] = ${fg(dl[r])} · ${f(L.a[j], 3)} = ${fg(mat[r][j])}` }), T('bW') + sub(L.n)));
        const nW = norms[k].W, nB = norms[k].b;
        sec.append(h('div', { class: 'dx-bars' }, [['‖∂L/∂W' + sub(L.n) + '‖', nW], ['‖∂L/∂b' + sub(L.n) + '‖', nB]].map(([lab, v]) => {
          const fillB = h('span', { class: 'dx-bar-f' }); fillB.style.width = (100 * Math.sqrt(v / nmax)).toFixed(1) + '%';
          return h('div', { class: 'dx-bar' }, [h('span', { class: 'dx-bar-l', text: lab }), h('span', { class: 'dx-bar-t' }, fillB), h('span', { class: 'dx-bar-v', text: fg(v) })]);
        })));
        kids.push(sec);
      });
      kids.push(h('p', { class: 'dx-note', text: T('bNorm') }));
      bBody.replaceChildren(...kids);
    }
    const epLab = (si) => M.snapshots[si];
    function drawCharts() {
      const si = st.snap, ep = epLab(si), ms = M.metrics.per_snapshot[si], tr = M.loss.train, va = M.loss.val;
      // loss (log-log in epoch+1 and MSE)
      const ymin = Math.min(...tr, ...va) * 0.8, ymax = Math.max(...tr, ...va) * 1.25, last = tr.length - 1;
      const fr = chartFrame({ label: T('lossH'), x: { sc: (a, b) => lgs(1, last + 1, a, b), ticks: [0, 1, 10, 100, last].map((e) => ({ v: e + 1, l: String(e) })), label: T('xEpoch') }, y: { sc: (a, b) => lgs(ymin, ymax, a, b), ticks: [0.01, 0.1, 1].filter((v) => v > ymin && v < ymax).map((v) => ({ v, l: String(v) })), label: T('yMse') } });
      fr.plot.append(path(tr.map((v, e) => [fr.X(e + 1), fr.Y(v)]), 'dx-l-a'), path(va.map((v, e) => [fr.X(e + 1), fr.Y(v)]), 'dx-l-b'),
        s('line', { x1: fr.X(ep + 1), x2: fr.X(ep + 1), y1: fr.m.t, y2: fr.H - fr.m.b, class: 'dx-l-mark' }), s('circle', { cx: fr.X(ep + 1), cy: fr.Y(tr[ep]), r: 4, class: 'dx-pt-d' }));
      fr.svg.setAttribute('aria-label', T('lossAlt', ep, f(tr[ep], 4), f(va[ep], 4)));
      chLoss.replaceChildren(fr.svg);
      // scatter: observed vs predicted CL (log axes)
      const ts = M.test_scatter, pred = ts.x_raw.map((r) => mlpFwd(W[si], stdz(M, r)).yhat), lo = 0.5, hi = 16;
      const fs = chartFrame({ H: 260, label: T('scH'), x: { sc: (a, b) => lgs(lo, hi, a, b), ticks: [0.5, 1, 2, 4, 8, 16].map((v) => ({ v, l: String(v) })), label: T('xObs') }, y: { sc: (a, b) => lgs(lo, hi, a, b), ticks: [0.5, 1, 2, 4, 8, 16].map((v) => ({ v, l: String(v) })), label: T('yPred') } });
      fs.plot.append(s('line', { x1: fs.X(lo), y1: fs.Y(lo), x2: fs.X(hi), y2: fs.Y(hi), class: 'dx-id' }));
      let out = 0;
      pred.forEach((p, i) => { const o = Math.exp(ts.y_obs[i]), pc = Math.exp(p), cl = clamp(pc, lo, hi); if (cl !== pc) out++; fs.plot.append(s('circle', { cx: fs.X(o), cy: fs.Y(cl), r: 2.6, class: 'dx-pt' + (cl !== pc ? ' dx-pt-out' : '') })); });
      fs.svg.setAttribute('aria-label', T('scAlt', pred.length, ep, f(ms.test_r2, 3), M.data.split.test) + (out ? ' ' + T('clipped', out) : ''));
      chSc.replaceChildren(fs.svg);
      // partial dependence
      const net_ = M.pd.wt.map((v) => Math.exp(mlpFwd(W[si], stdz(M, rawX(v, M.pd.age, M.pd.egfr, 1))).yhat)), tru = M.pd.truth.map(Math.exp), yh = 10;
      const fp = chartFrame({ H: 260, label: T('pdH'), x: { sc: (a, b) => lin(30, 120, a, b), ticks: [30, 50, 70, 90, 110].map((v) => ({ v, l: String(v) })), label: T('xWt') }, y: { sc: (a, b) => lin(0, yh, a, b), ticks: [0, 2, 4, 6, 8, 10].map((v) => ({ v, l: String(v) })), label: T('yCl') } });
      fp.plot.append(path(M.pd.wt.map((v, i) => [fp.X(v), fp.Y(tru[i])]), 'dx-l-d'), path(M.pd.wt.map((v, i) => [fp.X(v), fp.Y(net_[i])]), 'dx-l-a'));
      const dev = Math.max(...net_.map((v, i) => Math.abs(v / tru[i] - 1))) * 100;
      fp.svg.setAttribute('aria-label', T('pdAlt', ep, f(dev, 1)));
      chPd.replaceChildren(fp.svg);
      const cen = M.metrics.pd_central_range_wt_kg;
      const devC = Math.max(...M.pd.wt.map((v, i) => (v >= cen[0] && v <= cen[1] ? Math.abs(net_[i] / tru[i] - 1) : 0))) * 100;
      metTxt.textContent = T('sMetrics', M.data.split.test, f(ms.test_r2, 3), f(ms.test_rmse, 3), f(M.metrics.oracle_true_function.test_r2, 3), f(dev, 1), f(devC, 1));
    }
    function refreshM() {
      compute();
      const { c } = cur, cl = Math.exp(c.yhat), tr = Math.exp(cur.yT), ep = epLab(st.snap);
      sl.wt.out.textContent = `${st.wt} ${T('kg')}`; sl.age.out.textContent = `${st.age} ${T('yr')}`; sl.egfr.out.textContent = `${st.egfr} ${T('egfrU')}`;
      snapOut.textContent = T('snapVal', ep, st.snap + 1, NS_);
      predNet.textContent = f(cl, 2); predTrue.textContent = f(tr, 2); predRatio.textContent = f(cl / tr, 2);
      Object.values(sl).forEach((q) => q.inp.setAttribute('aria-valuetext', q.out.textContent));
      snapIn.setAttribute('aria-valuetext', snapOut.textContent);
      fStep.upd(); bStep.upd();
      drawNet(); drawForward(); drawBackward(); drawCharts();
      announce(T('live1', st.wt, st.age, st.egfr, T('c' + st.cls), ep, f(cl, 2), f(tr, 2)));
    }

    /* ================================================================== TAB 2: GNN */
    const P2 = panels[1], mols = Gd.molecules, FN = D.feat || Gd.feature_names, SH = D.featS || ['C', 'N', 'O', 'oth', 'arom', 'deg', 'chg', 'ring'], mnm = (m) => (D.mn && D.mn[m.id]) || m.id;
    let fwd = null, mol = null, adom = [], bondEls = [], atomEls = [];
    const molSel = h('select', { id: `${id}-mol` }, mols.map((m, i) => h('option', { value: i, text: D.mn ? mnm(m) : m.id.charAt(0).toUpperCase() + m.id.slice(1) })));
    molSel.addEventListener('change', () => { st.mi = +molSel.value; buildMol(); refreshG(); });
    const colSel = h('select', { id: `${id}-col` });
    colSel.addEventListener('change', () => { st.gUser[st.mi + '-' + st.gStep] = true; st.gDim[st.gStep] = +colSel.value; paintMol(); detail(); });
    const stepBtns = D.steps.map((t, i) => { const b = h('button', { type: 'button', class: 'dx-btn dx-stepb', text: `${i + 1} · ${t}` }); b.addEventListener('click', () => { st.gStep = i; refreshG(); }); return b; });
    const gBack = h('button', { type: 'button', class: 'dx-btn', text: T('back') }), gNext = h('button', { type: 'button', class: 'dx-btn dx-btn-p', text: T('next') });
    gBack.addEventListener('click', () => { st.gStep = Math.max(0, st.gStep - 1); refreshG(); });
    gNext.addEventListener('click', () => { st.gStep = Math.min(3, st.gStep + 1); refreshG(); });
    const replay = h('button', { type: 'button', class: 'dx-btn', text: T('replay') });
    replay.addEventListener('click', () => flow(true));
    const molSvg = s('svg', { class: 'dx-mol', role: 'group', focusable: 'false' });
    const molDesc = h('p', { class: 'dx-sr', id: `${id}-md` }), legBox = h('div', { class: 'dx-legbar' });
    const dBox = h('div'), exG = explainer();
    const cardMol = h('section', { class: 'dx-card dx-wide' }, [
      h('div', { class: 'dx-ctrls' }, [h('div', { class: 'dx-fld' }, [h('label', { for: molSel.id, text: T('mol') }), molSel]),
        h('div', { class: 'dx-fld' }, [h('label', { for: colSel.id, text: T('color') }), colSel])]),
      h('div', { class: 'dx-stepper', role: 'group', 'aria-label': T('stepsAria') }, [h('div', { class: 'dx-btns' }, [gBack, ...stepBtns, gNext])]),
      h('div', { class: 'dx-split' }, [
        h('div', null, [h('div', { class: 'dx-figure' }, molSvg), legBox, h('p', { class: 'dx-note', text: T('molHint') }), replay, molDesc]),
        h('div', { class: 'dx-detail' }, [dBox, exG.box])])]);
    exG.wire(dBox);
    const rdBody = h('div'), scG = h('div'), trG = h('div'), evTxt = h('p', { class: 'dx-note' });
    const cardRd = h('section', { class: 'dx-card dx-wide' }, [h('h3', { text: T('rdH') }), rdBody]);
    const cardEv = h('section', { class: 'dx-card dx-wide' }, [h('h3', { text: T('evH') }), evTxt,
      h('div', { class: 'dx-charts dx-charts2' }, [fig(T('evFig'), scG, legend([{ cls: 'dx-sw-dot', label: T('lgHeld') }, { cls: 'dx-sw-d2', label: T('lgShown') }, { cls: 'dx-sw-id', label: T('lgId') }])), fig(T('trH'), trG, legend([{ cls: 'dx-sw-a', label: T('lgTrain') }, { cls: 'dx-sw-b', label: T('lgVal') }, { cls: 'dx-sw-m', label: T('lgKept') }]))])]);
    const how = h('details', { class: 'dx-details dx-wide' }, [h('summary', { text: T('howH') }), h('ol', null, D.how.map((t) => h('li', { text: t }))), h('p', { class: 'dx-note', text: T('adme') })]);
    P2.append(h('p', { class: 'dx-lede', text: T('lede2') }), h('div', { class: 'dx-grid dx-grid1' }, [cardMol, cardRd, cardEv]), how);

    const SC = 360, PAD = 30, R = 15;
    const xy = (a) => [PAD + a.x * SC, PAD + a.y * SC];
    function buildMol() {
      mol = mols[st.mi]; fwd = gnnFwd(Gd, mol); st.atom = 0; let bd = -1; mol.atoms.forEach((a, i) => { if (a.deg > bd) { bd = a.deg; st.atom = i; } });
      const Wd = mol.w * SC + 2 * PAD, Hd = mol.h * SC + 2 * PAD;
      molSvg.setAttribute('viewBox', `0 0 ${Wd.toFixed(0)} ${Hd.toFixed(0)}`);
      molSvg.setAttribute('role', 'group'); molSvg.replaceChildren();
      const defs = s('defs', null, s('marker', { id: `${id}-ah`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', class: 'dx-arrow-h' })));
      const gb = s('g', { class: 'dx-bonds' }), ga = s('g'), gf = s('g', { class: 'dx-flowl' });
      bondEls = mol.bonds.map((b) => {
        const A = xy(mol.atoms[b.a]), B = xy(mol.atoms[b.b]), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        const line = (o, k) => s('line', { x1: A[0] + nx * o, y1: A[1] + ny * o, x2: B[0] + nx * o, y2: B[1] + ny * o, class: 'dx-bond' + (k ? ' ' + k : '') });
        const ring = mol.rings.filter((r) => r.includes(b.a) && r.includes(b.b)).sort((p, q) => p.length - q.length)[0];
        let side = 0;
        if (ring) { const cx = ring.reduce((t, i) => t + xy(mol.atoms[i])[0], 0) / ring.length, cy = ring.reduce((t, i) => t + xy(mol.atoms[i])[1], 0) / ring.length; side = ((cx - A[0]) * nx + (cy - A[1]) * ny) >= 0 ? 1 : -1; }
        const g = s('g'), inner = (o, sh, k) => s('line', { x1: (A[0] + nx * o + dx * sh).toFixed(1), y1: (A[1] + ny * o + dy * sh).toFixed(1), x2: (B[0] + nx * o - dx * sh).toFixed(1), y2: (B[1] + ny * o - dy * sh).toFixed(1), class: 'dx-bond' + (k ? ' ' + k : '') });
        if (b.ar) g.append(line(0), inner(side * 5, 0.14, 'dx-bond-ar'));
        else if (b.o === 2) { if (ring) g.append(line(0), inner(side * 5, 0.1)); else g.append(line(-3), line(3)); }
        else if (b.o === 3) g.append(line(0), line(-4.5), line(4.5));
        else g.append(line(0));
        gb.append(g); return g;
      });
      atomEls = mol.atoms.map((a, i) => {
        const [x, y] = xy(a);
        const ring = s('circle', { cx: x, cy: y, r: R + 5, class: 'dx-atom-ring' }), dot = s('circle', { cx: x, cy: y, r: R, class: 'dx-atom-dot' }), lab = s('text', { x, y: y + 5, class: 'dx-atom-lab', 'text-anchor': 'middle', text: a.el }), sel = s('circle', { cx: x, cy: y, r: R + 3, class: 'dx-atom-sel' });
        const g = s('g', { class: 'dx-atom', tabindex: i === st.atom ? '0' : '-1', role: 'button', 'data-i': i }, [ring, sel, dot, lab, s('text', { x: x + R + 1, y: y - R + 4, class: 'dx-atom-idx', 'aria-hidden': 'true', text: i + 1 }), s('circle', { cx: x, cy: y, r: 19, class: 'dx-atom-hit' })]);
        g.addEventListener('focus', () => pick(i, true)); g.addEventListener('click', () => { pick(i, true); g.focus(); });
        g.addEventListener('keydown', (e) => atomKey(e, i));
        ga.append(g); return g;
      });
      molSvg.append(defs, gb, gf, ga);
      adom = mol.atoms.map(xy);
    }
    function atomKey(e, i) {
      const k = e.key, dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[k];
      if (k === 'Enter' || k === ' ') { e.preventDefault(); flow(true); return; }
      let j = -1;
      if (dir) { let best = Infinity; adom.forEach((p, q) => { if (q === i) return; const dx = p[0] - adom[i][0], dy = p[1] - adom[i][1], al = dx * dir[0] + dy * dir[1]; if (al <= 1) return; const perp = Math.abs(dx * dir[1] - dy * dir[0]), sc = Math.hypot(dx, dy) + 1.5 * perp; if (perp <= al * 1.6 && sc < best) { best = sc; j = q; } }); }
      else if (k === 'Home') j = 0; else if (k === 'End') j = adom.length - 1; else if (k === 'PageDown') j = (i + 1) % adom.length; else if (k === 'PageUp') j = (i + adom.length - 1) % adom.length;
      else return;
      e.preventDefault(); if (j >= 0) atomEls[j].focus();
    }
    function pick(i, user) {
      if (i === st.atom && !user) return;
      const same = i === st.atom; st.atom = i;
      atomEls.forEach((g, q) => { g.tabIndex = q === i ? 0 : -1; });
      paintMol(); detail();
      if (user && !same) flow(false);
    }
    // value shown for atom v at the current step and color dimension
    function atomVal(v) {
      const S = st.gStep, d = st.gDim[S];
      if (S === 3) return d === 0 ? fwd.contrib[v] : mol.ref_contrib[v];
      return d === 8 ? l2(fwd.h[S][v]) : fwd.h[S][v][d];
    }
    function dimOptions() {
      const S = st.gStep, o = [];
      if (S === 3) { o.push(T('contrib')); o.push(T('refContrib')); } else { for (let k = 0; k < 8; k++) o.push(S === 0 ? FN[k] : 'h' + sub(S) + '[' + (k + 1) + ']'); if (S > 0) o.push(T('nsum')); }
      return o;
    }
    function paintMol() {
      const S = st.gStep, vals = mol.atoms.map((_, v) => atomVal(v)), mn = Math.min(...vals), mx = Math.max(...vals), div = mn < 0, span = div ? Math.max(Math.abs(mn), Math.abs(mx)) || 1 : (mx - mn) || 1;
      const nb = nbrs(mol)[st.atom];
      atomEls.forEach((g, v) => {
        const t = div ? vals[v] / span : (vals[v] - mn) / span;
        const col = div ? (t >= 0 ? mix([255, 255, 255], pal.blue, Math.min(1, t)) : mix([255, 255, 255], pal.data, Math.min(1, -t))) : mix([248, 251, 252], pal.accent2, t);
        const dark = lum(col) < 0.2;
        const dot = g.children[2], lab = g.children[3];
        dot.setAttribute('fill', rgb(col)); lab.setAttribute('fill', dark ? '#ffffff' : rgb(pal.ink)); lab.setAttribute('class', 'dx-atom-lab ' + (dark ? 'dx-halo-d' : 'dx-halo-l'));
        g.classList.toggle('dx-selected', v === st.atom); g.classList.toggle('dx-nbr', nb.includes(v) && S > 0 && S < 3);
        g.setAttribute('aria-label', `${T('atomH', v + 1, mol.atoms[v].el)}: ${dimOptions()[st.gDim[S]]} = ${f(vals[v])}${v === st.atom ? ', ' + T('selTag') : ''}`);
        g.setAttribute('aria-pressed', v === st.atom ? 'true' : 'false');
      });
      // legend
      const c0 = div ? mix([255, 255, 255], pal.data, 1) : [248, 251, 252], c1 = div ? mix([255, 255, 255], pal.blue, 1) : pal.accent2;
      const bar = h('span', { class: 'dx-lbar' }); bar.style.background = `linear-gradient(90deg, ${rgb(c0)}, ${div ? '#fff,' : ''} ${rgb(c1)})`;
      legBox.replaceChildren(h('span', { text: f(div ? -span : mn, 3) }), bar, h('span', { text: f(div ? span : mx, 3) }));
      molDesc.textContent = T('molAlt', mnm(mol), mol.n, D.steps[S], st.atom + 1, mol.atoms[st.atom].el);
      molSvg.setAttribute('aria-label', molDesc.textContent); molSvg.setAttribute('aria-describedby', molDesc.id);
      drawArrows();
    }
    function drawArrows() { // static arrows neighbor -> selected atom (steps 1-2); also the fall-back under reduced motion
      const gf = molSvg.querySelector('.dx-flowl'); if (!gf) return; gf.replaceChildren();
      if (st.gStep < 1 || st.gStep > 2) return;
      const c = adom[st.atom];
      nbrs(mol)[st.atom].forEach((u) => { const p = adom[u], d = Math.hypot(c[0] - p[0], c[1] - p[1]), ux = (c[0] - p[0]) / d, uy = (c[1] - p[1]) / d;
        gf.append(s('line', { x1: p[0] + ux * (R + 4), y1: p[1] + uy * (R + 4), x2: c[0] - ux * (R + 5), y2: c[1] - uy * (R + 5), class: 'dx-arrow', 'marker-end': `url(#${id}-ah)` })); });
    }
    function flow(force) {
      cancelAnimationFrame(raf);
      const gf = molSvg.querySelector('.dx-flowl'); if (!gf) return;
      drawArrows();
      if (reduce() || st.gStep < 1 || st.gStep > 2) return;
      const c = adom[st.atom], nbl = nbrs(mol)[st.atom], dots = nbl.map(() => s('circle', { r: 4.5, class: 'dx-dotf' }));
      dots.forEach((d) => gf.append(d)); const t0 = performance.now(), dur = 950;
      const tick = (now) => { const t = Math.min(1, (now - t0) / dur), e = t * t * (3 - 2 * t);
        dots.forEach((d, k) => { const p = adom[nbl[k]]; d.setAttribute('cx', p[0] + (c[0] - p[0]) * e); d.setAttribute('cy', p[1] + (c[1] - p[1]) * e); });
        if (t < 1) raf = requestAnimationFrame(tick); else dots.forEach((d) => d.remove()); };
      raf = requestAnimationFrame(tick);
    }
    function detail() {
      const S = st.gStep, v = st.atom, a = mol.atoms[v], nb = nbrs(mol)[v], kids = [];
      kids.push(h('h3', { text: T('atomH', v + 1, a.el) }), h('p', { class: 'dx-note', text: T('atomInfo', a.deg, a.ar ? T('aromatic') : T('aliphatic'), a.ring ? T('inRing') : T('noRing')) }));
      const nm0 = FN.map((_, k) => SH[k]), nmH = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => String(k + 1)), g = (vec, lab, o) => grid([vec], Object.assign({ label: lab, dig: 3 }, o));
      const row = (lab, node, cls) => h('div', { class: 'dx-trow' + (cls ? ' ' + cls : '') }, [rowLab(lab), node]);
      if (S === 0) {
        kids.push(row(T('dFeat'), g(fwd.x[v], T('dFeat'), { names: nm0, act: false, vmax: 1, ex: (r, k) => `${FN[k]} = ${f(fwd.x[v][k], 3)}` })));
      } else if (S === 1 || S === 2) {
        const Hp = fwd.h[S - 1], R_ = S === 1 ? fwd.r1 : fwd.r2, Wm = Gd.weights[S === 1 ? 'W1' : 'W2'], bm = Gd.weights[S === 1 ? 'b1' : 'b2'], names = S === 1 ? nm0 : nmH, vm = S === 1 ? 1 : Math.max(1e-9, ...Hp.flat());
        kids.push(row(`${T('dOwn')} h${sub(S - 1)}(${v + 1})`, g(Hp[v], T('dOwn'), { names, act: true, vmax: vm, ex: (r, k) => `h${sub(S - 1)}(${v + 1})[${k + 1}] = ${f(Hp[v][k])}` })));
        nb.forEach((u) => kids.push(row(T('dNb', u + 1, mol.atoms[u].el), g(Hp[u], T('dNb', u + 1, mol.atoms[u].el), { names, act: true, vmax: vm, ex: (r, k) => `h${sub(S - 1)}(${u + 1})[${k + 1}] = ${f(Hp[u][k])}` }))));
        kids.push(row(T('dSum'), g(R_.m[v], T('dSum'), { names: nmH, act: true, vmax: vm * 2, ex: (r, k) => `${[Hp[v][k]].concat(nb.map((u) => Hp[u][k])).map((x) => f(x, 2)).join(' + ')} = ${f(R_.m[v][k])}` }), 'dx-sum'));
        kids.push(row(T('dZ'), g(R_.z[v], T('dZ'), { names: nmH, vmax: vm * 2, ex: (r, k) => `z[${k + 1}] = ${sumExpr(Wm[k], R_.m[v], bm[k])} = ${f(R_.z[v][k])}` })));
        kids.push(row(T('dH'), g(R_.h[v], T('dH'), { names: nmH, act: true, vmax: vm, ex: (r, k) => `h${sub(S)}[${k + 1}] = max(0, ${f(R_.z[v][k])}) = ${f(R_.h[v][k])}` }), 'dx-now'));
        kids.push(h('details', { class: 'dx-details dx-inner' }, [h('summary', { text: T('dW') }), scroller(grid(Wm, { names: nmH, label: T('dW'), dig: 2, rowName: (r) => T('rowN', r + 1), ex: (r, k) => `W[${r + 1}][${k + 1}] = ${f(Wm[r][k], 4)}` }), T('dW')), g(bm, 'b', { names: nmH, dig: 3 })]));
      } else {
        const w = Gd.weights.w, hv = fwd.h[2][v], prod = hv.map((x, k) => x * w[k]);
        kids.push(h('h4', { text: T('dContribH') }));
        kids.push(row(`h${sub(2)}(${v + 1})`, g(hv, 'h2', { names: nmH, act: true, vmax: Math.max(1e-9, ...fwd.h[2].flat()), ex: (r, k) => `h${sub(2)}[${k + 1}] = ${f(hv[k])}` })));
        kids.push(row(T('dHead'), g(w, T('dHead'), { names: nmH, vmax: Math.max(...w.map(Math.abs)), ex: (r, k) => `w[${k + 1}] = ${f(w[k], 4)}` })));
        kids.push(row(T('dProd'), g(prod, T('dProd'), { names: nmH, ex: (r, k) => `${f(w[k], 3)} · ${f(hv[k], 3)} = ${f(prod[k], 4)}` })));
        kids.push(h('p', { class: 'dx-eq', text: T('dC', f(fwd.contrib[v], 3)) + ` (b = ${f(Gd.weights.b0[0], 3)})` }));
        kids.push(h('p', { class: 'dx-note', text: T('dRef', f(mol.ref_contrib[v], 3)) }));
      }
      dBox.replaceChildren(...kids);
    }
    function drawReadout() {
      const w = Gd.weights.w, p = fwd.pooled, prod = p.map((x, k) => x * w[k]), nmH = p.map((_, k) => String(k + 1)), diff = fwd.pred - mol.ref;
      rdBody.replaceChildren(
        h('div', { class: 'dx-trow' }, [rowLab(T('rdPool', fwd.n)), grid([p], { names: nmH, act: true, label: T('rdPool', fwd.n), vmax: Math.max(1e-9, ...p), ex: (r, k) => `p[${k + 1}] = (1/${fwd.n}) Σ h₂[${k + 1}] = ${f(p[k])}` })]),
        h('div', { class: 'dx-trow' }, [rowLab(T('rdW')), grid([w], { names: nmH, label: T('rdW'), vmax: Math.max(...w.map(Math.abs)), ex: (r, k) => `w[${k + 1}] = ${f(w[k], 4)}` })]),
        h('div', { class: 'dx-trow' }, [rowLab(T('rdProd')), grid([prod], { names: nmH, label: T('rdProd'), ex: (r, k) => `${f(w[k], 3)} · ${f(p[k], 3)} = ${f(prod[k], 4)}` })]),
        h('dl', { class: 'dx-pred' }, [
          h('div', null, [h('dt', { text: T('rdS', f(fwd.s, 4)) }), h('dd', null, h('strong', { class: 'dx-big', text: f(fwd.s, 4) }))]),
          h('div', null, [h('dt', { text: T('rdPred', fwd.n) }), h('dd', null, h('strong', { class: 'dx-big', text: f(fwd.pred, 2) }))]),
          h('div', null, [h('dt', { text: T('rdRef') }), h('dd', null, h('strong', { class: 'dx-big', text: f(mol.ref, 2) }))]),
          h('div', null, [h('dt', { text: T('rdDiff') }), h('dd', null, h('strong', { class: 'dx-big', text: f(diff, 2) }))])]),
        h('p', { class: 'dx-note', text: T('rdNote') }));
    }
    function drawGCharts() {
      const ts = Gd.test_scatter, mt = Gd.metrics, lo = -6, hi = 12, tk = [-4, 0, 4, 8, 12].map((v) => ({ v, l: String(v) }));
      const fr = chartFrame({ H: 270, label: T('evAlt', ts.ref.length, f(mt.test_r2, 3)), x: { sc: (a, b) => lin(lo, hi, a, b), ticks: tk, label: T('xRef') }, y: { sc: (a, b) => lin(lo, hi, a, b), ticks: tk, label: T('yGnn') } });
      fr.plot.append(s('line', { x1: fr.X(lo), y1: fr.Y(lo), x2: fr.X(hi), y2: fr.Y(hi), class: 'dx-id' }));
      ts.ref.forEach((r, i) => fr.plot.append(s('circle', { cx: fr.X(r), cy: fr.Y(ts.pred[i]), r: 2, class: 'dx-pt' })));
      mols.forEach((m) => { const x = fr.X(m.ref), y = fr.Y(m.pred); fr.plot.append(s('path', { d: `M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}z`, class: 'dx-pt-d2' }, s('title', { text: T('vsT', mnm(m), f(m.pred, 2), f(m.ref, 2)) }))); });
      scG.replaceChildren(fr.svg);
      const tr = Gd.training.train_rmse, va = Gd.training.val_rmse, n = tr.length - 1, ymin = Math.min(...tr, ...va) * 0.9, ymax = Math.max(...tr, ...va) * 1.1;
      const ft = chartFrame({ H: 270, label: T('trAlt'), x: { sc: (a, b) => lin(0, n, a, b), ticks: [0, 50, 100, 150, 200].filter((v) => v <= n).map((v) => ({ v, l: String(v) })), label: T('xEp') }, y: { sc: (a, b) => lgs(ymin, ymax, a, b), ticks: [0.5, 1, 2, 5, 10].filter((v) => v > ymin && v < ymax).map((v) => ({ v, l: String(v) })), label: T('yRmse') } });
      ft.plot.append(path(tr.map((v, i) => [ft.X(i), ft.Y(v)]), 'dx-l-a'), path(va.map((v, i) => [ft.X(i), ft.Y(v)]), 'dx-l-b'), s('line', { x1: ft.X(Gd.training.kept_epoch), x2: ft.X(Gd.training.kept_epoch), y1: ft.m.t, y2: ft.H - ft.m.b, class: 'dx-l-mark' }));
      trG.replaceChildren(ft.svg);
      evTxt.textContent = T('evTxt', Gd.training.split.test, f(mt.test_r2, 3), f(mt.test_rmse, 2), f(mt.baseline_element_count_regression.test_r2, 2));
    }
    function refreshG() {
      const S = st.gStep;
      stepBtns.forEach((b, i) => { b.setAttribute('aria-current', i === S ? 'step' : 'false'); b.classList.toggle('dx-on', i === S); });
      gBack.setAttribute('aria-disabled', String(S === 0)); gNext.setAttribute('aria-disabled', String(S === 3));
      if (S >= 1 && S <= 2 && !st.gUser[st.mi + '-' + S]) { // default color: the hidden dimension that varies most across the atoms (never an all-zero one)
        let best = 0, bs = -1;
        for (let k = 0; k < 8; k++) { let lo = Infinity, hi = -Infinity; for (const r of fwd.h[S]) { lo = Math.min(lo, r[k]); hi = Math.max(hi, r[k]); } if (hi - lo > bs + 1e-12) { bs = hi - lo; best = k; } }
        st.gDim[S] = best;
      }
      const opts = dimOptions(); if (st.gDim[S] >= opts.length) st.gDim[S] = 0;
      colSel.replaceChildren(...opts.map((t, i) => h('option', { value: i, text: t, selected: i === st.gDim[S] ? true : null })));
      replay.hidden = reduce() || S < 1 || S > 2;
      paintMol(); detail(); drawReadout();
      announce(T('live2', mnm(mol), S + 1, D.steps[S], st.atom + 1));
    }
    buildMol(); drawGCharts();

    el.replaceChildren(root);
    refreshM();
    return { root, st, setTab, selfLine, T, refreshG, refreshM };
  }

  /* ------------------------------------------------------------------ mounting */
  const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  function mountOne(el) {
    if (el.__dxP) return el.__dxP;
    const lang0 = 'en';
    el.replaceChildren(h('p', { class: 'dx-loading', text: DICT[lang0].loading }));
    el.classList.add('dx-mount');
    el.__dxP = Promise.all([getJSON(new URL(el.getAttribute('data-mlp'), document.baseURI).href), getJSON(new URL(el.getAttribute('data-gnn'), document.baseURI).href)]).then(([M, G]) => {
      const inst = create(el, M, G);
      el.__dx = { M, G, inst };
      const r = selfTestData(M, G);
      inst.selfLine.textContent = r.ok ? inst.T('selfOk', r.maxAbsDiff.toExponential(1)) : inst.T('selfBad', r.maxAbsDiff.toExponential(1));
      el.__dx.self = r;
      return el.__dx;
    }).catch((err) => { el.replaceChildren(h('p', { class: 'dx-loading dx-err', role: 'alert', text: DICT[lang0].loaderr + ' (' + (err && err.message ? err.message : err) + ')' })); throw err; });
    el.__dxP.catch(() => {});
    return el.__dxP;
  }
  const isMine = (el) => el && el.getAttribute && el.getAttribute('data-lab-widget') === 'dl-explorer';
  const prev = LW.mount;
  LW.mount = function (el) { return isMine(el) ? mountOne(el) : (typeof prev === 'function' ? prev.apply(this, arguments) : undefined); };
  // dlSelfTest([el]) -> Promise<{ok, tol, maxAbsDiff, mlp, gnn, fd}>; mounts the widget(s) first if needed
  LW.dlSelfTest = function (el) {
    const els = el ? [el] : [...document.querySelectorAll('[data-lab-widget="dl-explorer"]')];
    if (!els.length) return Promise.reject(new Error('no dl-explorer element on this page'));
    return Promise.all(els.map((e) => mountOne(e).then((d) => selfTestData(d.M, d.G)))).then((rs) => rs[0]);
  };
  function lazy(el) {
    if (el.__dxLazy) return; el.__dxLazy = true;
    if (!('IntersectionObserver' in window)) { mountOne(el); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); mountOne(el); } }, { rootMargin: '300px' });
    io.observe(el);
  }
  function boot() { document.querySelectorAll('[data-lab-widget="dl-explorer"]').forEach(lazy); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
