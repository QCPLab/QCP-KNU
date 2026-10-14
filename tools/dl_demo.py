#!/usr/bin/env python3
"""Regenerate assets/data/dl-mlp.json and assets/data/dl-gnn.json for the "How deep learning computes" widget.

Everything here is a TEACHING EXAMPLE: synthetic data (MLP) and a small public molecule set (GNN).
Neither model is meant to predict real pharmacokinetics or ADME properties.

Requirements (CPU only, no torch):  Python >= 3.9, numpy, scipy, rdkit
  tested with: see "meta.versions" inside the two JSON files (numpy 2.5.3, scipy 1.18.1, rdkit 2026.09.1, Python 3.13)
Run from the repository root:
  python tools/dl_demo.py            # writes assets/data/dl-mlp.json and assets/data/dl-gnn.json (about 1-3 min)
  python tools/dl_demo.py --quick    # fewer epochs, prints metrics only, writes nothing (smoke test)

Data
  MLP : 2000 synthetic virtual patients drawn here from a known formula (seeded). No real subjects.
  GNN : molecules from the file Data/NCI/first_5K.smi that ships inside the installed RDKit package
        (structures from the NCI Open Database; RDKit itself is BSD-3-Clause). The file is read in place and is
        NOT copied into this repository. Target = RDKit Crippen logP (Descriptors.MolLogP), a calculated value.
        If the file is missing, set the environment variable DL_DEMO_SMILES to any tab/space separated .smi file
        (first column = SMILES) or reinstall rdkit; the script exits with a clear message otherwise.

Training is plain NumPy with hand-written back-propagation. Both back-prop implementations are checked against
central finite differences before anything is written (numbers are printed and stored in the JSON "gradcheck").
Hyper-parameters are fixed constants below; they were chosen on the validation split only. The test split is used
once, for the reported metrics.
"""
import json
import math
import os
import platform
import sys
from pathlib import Path

import numpy as np
import scipy
import scipy.sparse as sp

try:
    import rdkit
    from rdkit import Chem, RDConfig, RDLogger, rdBase
    from rdkit.Chem import Descriptors, rdDepictor, rdMolDescriptors
except ImportError:  # pragma: no cover
    sys.exit("rdkit is required (pip install rdkit).")

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "data"
QUICK = "--quick" in sys.argv

# ----------------------------------------------------------------------------------------------- MLP constants
MLP_DATA_SEED = 11          # synthetic population + split
MLP_INIT_SEED = 7           # weight initialisation
MLP_SHUFFLE_SEED = 5        # mini-batch order
N_POP = 2000
NOISE_SD = 0.10             # SD of the lognormal noise on CL (ln scale)
CL0, WT_REF, EGFR_REF = 4.5, 70.0, 90.0
G_CLASS = (0.55, 1.0, 1.35)  # poor / normal / rapid
CLASS_P = (0.10, 0.70, 0.20)
MLP_SIZES = (5, 8, 6, 1)
MLP_EPOCHS = 40 if QUICK else 400
MLP_LR, MLP_BATCH = 0.003, 32
SNAP_EPOCHS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 400]
if QUICK:
    SNAP_EPOCHS = [0, 1, 2, 5, 10, 20, 30, 35, 38, 40]
PD_WT = [30 + 2.5 * i for i in range(37)]       # 30 ... 120 kg
PD_AGE, PD_EGFR, PD_CLASS = 50.0, 90.0, 1       # partial-dependence reference patient (normal metabolizer)
N_SCATTER = 120

# ----------------------------------------------------------------------------------------------- GNN constants
GNN_SEED = 7
GNN_HIDDEN = 8
GNN_EPOCHS = 30 if QUICK else 200
GNN_LR, GNN_BATCH = 0.01, 64
GNN_ELEMENTS = {6, 7, 8, 9, 15, 16, 17, 35, 53}  # C N O F P S Cl Br I (organic subset; others are dropped)
GNN_MAX_HEAVY = 50
FEATURE_NAMES = ["C", "N", "O", "other element", "aromatic", "degree/4", "formal charge", "in ring"]
DISPLAY = [
    ("caffeine", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "RYYVLZVUVIJVGH-UHFFFAOYSA-N"),
    ("ibuprofen", "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O", "HEFNNWSXXWATRW-UHFFFAOYSA-N"),
    ("propranolol", "CC(C)NCC(COC1=CC=CC2=CC=CC=C21)O", "AQHHHDLHHXJYJD-UHFFFAOYSA-N"),
]


def versions():
    return {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__,
            "rdkit": rdkit.__version__ if hasattr(rdkit, "__version__") else rdBase.rdkitVersion}


def meta(kind, seeds):
    return {"widget": "dl-explorer", "kind": kind, "generator": "tools/dl_demo.py", "command": "python tools/dl_demo.py",
            "versions": versions(), "seeds": seeds, "float": "float64",
            "purpose": "Teaching example. Synthetic or public data, small models, not for prediction."}


def rnd(a, nd=6):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


def relu(z):
    return np.maximum(z, 0.0)


def r2_rmse(y, p):
    y, p = np.asarray(y, float), np.asarray(p, float)
    sse = float(np.sum((y - p) ** 2))
    sst = float(np.sum((y - y.mean()) ** 2))
    return 1.0 - sse / sst, math.sqrt(sse / len(y))


def adam_step(params, grads, state, lr, t, b1=0.9, b2=0.999, eps=1e-8):
    for k, g in grads.items():
        m = state["m"].setdefault(k, np.zeros_like(g))
        v = state["v"].setdefault(k, np.zeros_like(g))
        m *= b1; m += (1 - b1) * g
        v *= b2; v += (1 - b2) * g * g
        params[k] -= lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + eps)


# =============================================================================================== MLP (covariates -> ln CL)
def true_lncl(wt, egfr, cls):
    return (math.log(CL0) + 0.75 * np.log(np.asarray(wt) / WT_REF) + 0.4 * np.log(np.asarray(egfr) / EGFR_REF)
            + np.log(np.asarray(G_CLASS)[np.asarray(cls, dtype=int)]))


def trunc_normal(rng, n, mu, sd, lo, hi):
    out = np.empty(0)
    while out.size < n:
        x = rng.normal(mu, sd, size=2 * n)
        out = np.concatenate([out, x[(x >= lo) & (x <= hi)]])
    return out[:n]


def make_population(rng):
    wt = trunc_normal(rng, N_POP, 72, 14, 30, 120)
    age = trunc_normal(rng, N_POP, 52, 16, 20, 85)
    egfr = np.clip(110 - 0.85 * np.maximum(age - 30, 0) + rng.normal(0, 12, N_POP), 20, 120)
    cls = rng.choice(3, size=N_POP, p=CLASS_P)
    y_typ = true_lncl(wt, egfr, cls)
    y = y_typ + rng.normal(0, NOISE_SD, N_POP)
    raw = np.column_stack([wt, age, egfr, (cls == 0).astype(float), (cls == 2).astype(float)])
    return raw, cls, y_typ, y


def mlp_init(rng):
    P = {}
    for i in range(3):
        fi, fo = MLP_SIZES[i], MLP_SIZES[i + 1]
        scale = math.sqrt((2.0 if i < 2 else 1.0) / fi)
        P[f"W{i+1}"] = rng.normal(0, scale, size=(fo, fi))
        P[f"b{i+1}"] = np.zeros(fo)
    return P


def mlp_forward(P, X):
    Z1 = X @ P["W1"].T + P["b1"]; A1 = relu(Z1)
    Z2 = A1 @ P["W2"].T + P["b2"]; A2 = relu(Z2)
    Z3 = A2 @ P["W3"].T + P["b3"]
    return Z1, A1, Z2, A2, Z3[:, 0]


def mlp_loss_grads(P, X, y):
    """Loss = mean squared error of ln CL. Returns loss and gradients of every parameter."""
    B = X.shape[0]
    Z1, A1, Z2, A2, yh = mlp_forward(P, X)
    loss = float(np.mean((yh - y) ** 2))
    d3 = (2.0 * (yh - y) / B)[:, None]
    G = {"W3": d3.T @ A2, "b3": d3.sum(0)}
    d2 = (d3 @ P["W3"]) * (Z2 > 0)
    G["W2"] = d2.T @ A1; G["b2"] = d2.sum(0)
    d1 = (d2 @ P["W2"]) * (Z1 > 0)
    G["W1"] = d1.T @ X; G["b1"] = d1.sum(0)
    return loss, G


def finite_diff_check(params, loss_fn, grads, h=1e-6, floor=1e-7):
    """Central finite differences over EVERY scalar parameter. Returns max relative and max absolute error."""
    max_rel, max_abs, n = 0.0, 0.0, 0
    for k, p in params.items():
        flat = p.reshape(-1)
        for i in range(flat.size):
            old = flat[i]
            flat[i] = old + h; lp = loss_fn()
            flat[i] = old - h; lm = loss_fn()
            flat[i] = old
            num = (lp - lm) / (2 * h)
            ana = grads[k].reshape(-1)[i]
            err = abs(num - ana)
            max_abs = max(max_abs, err)
            if abs(num) + abs(ana) > floor:
                max_rel = max(max_rel, err / (abs(num) + abs(ana)))
            n += 1
    return max_rel, max_abs, n


def mlp_case(P, norm, raw_x, target):
    """Single-sample reference used by the in-browser self test (forward + backward of L = (yhat-y)^2)."""
    x = (np.asarray(raw_x, float) - norm["mean"]) / norm["sd"]
    X = x[None, :]
    Z1, A1, Z2, A2, yh = mlp_forward(P, X)
    d3 = np.array([[2.0 * (yh[0] - target)]])
    d2 = (d3 @ P["W3"]) * (Z2 > 0)
    d1 = (d2 @ P["W2"]) * (Z1 > 0)
    return {"x_raw": list(map(float, raw_x)), "target": float(target), "x": x.tolist(),
            "z1": Z1[0].tolist(), "a1": A1[0].tolist(), "z2": Z2[0].tolist(), "a2": A2[0].tolist(), "yhat": float(yh[0]),
            "loss": float((yh[0] - target) ** 2),
            "d3": d3[0].tolist(), "d2": d2[0].tolist(), "d1": d1[0].tolist(),
            "dW3": (d3.T @ A2).tolist(), "db3": d3[0].tolist(), "dW2": (d2.T @ A1).tolist(), "db2": d2[0].tolist(),
            "dW1": (d1.T @ X).tolist(), "db1": d1[0].tolist()}


def build_mlp():
    rng = np.random.default_rng(MLP_DATA_SEED)
    raw, cls, y_typ, y = make_population(rng)
    perm = rng.permutation(N_POP)
    n_tr, n_va = int(0.70 * N_POP), int(0.15 * N_POP)
    itr, iva, ite = perm[:n_tr], perm[n_tr:n_tr + n_va], perm[n_tr + n_va:]
    mean, sd = raw[itr].mean(0), raw[itr].std(0)
    norm = {"mean": mean, "sd": sd}
    Xs = (raw - mean) / sd
    print(f"[MLP] n={N_POP} train/val/test = {len(itr)}/{len(iva)}/{len(ite)}; corr(age,eGFR)={np.corrcoef(raw[:,1], raw[:,2])[0,1]:.2f}")

    P = mlp_init(np.random.default_rng(MLP_INIT_SEED))
    state = {"m": {}, "v": {}}
    shuf = np.random.default_rng(MLP_SHUFFLE_SEED)
    snaps, tr_loss, va_loss = {}, [], []

    def mse(idx):
        return float(np.mean((mlp_forward(P, Xs[idx])[-1] - y[idx]) ** 2))

    def record(ep):
        tr_loss.append(mse(itr)); va_loss.append(mse(iva))
        if ep in SNAP_EPOCHS:
            snaps[ep] = {k: v.copy() for k, v in P.items()}

    record(0)
    t = 0
    for ep in range(1, MLP_EPOCHS + 1):
        order = shuf.permutation(itr)
        for s in range(0, len(order), MLP_BATCH):
            idx = order[s:s + MLP_BATCH]
            _, G = mlp_loss_grads(P, Xs[idx], y[idx])
            t += 1
            adam_step(P, G, state, MLP_LR, t)
        record(ep)
        if ep in (1, 10, 100, MLP_EPOCHS):
            print(f"  epoch {ep:3d}  train MSE {tr_loss[-1]:.4f}  val MSE {va_loss[-1]:.4f}")

    # --- gradient check (finite differences, all 109 parameters) at initial and final weights
    gc = {}
    gidx = itr[:24]
    for tag, params in (("epoch0", snaps[0]), ("final", snaps[MLP_EPOCHS])):
        Q = {k: v.copy() for k, v in params.items()}
        _, G = mlp_loss_grads(Q, Xs[gidx], y[gidx])
        rel, ab, n = finite_diff_check(Q, lambda: mlp_loss_grads(Q, Xs[gidx], y[gidx])[0], G)
        gc[tag] = {"max_rel_err": rel, "max_abs_err": ab, "n_params": n}
        print(f"  gradient check {tag}: {n} params, max rel err {rel:.2e}, max abs err {ab:.2e}")

    # --- metrics per snapshot (test split, all 300 samples) and partial dependence
    pd_truth = true_lncl(PD_WT, [PD_EGFR] * len(PD_WT), [PD_CLASS] * len(PD_WT))
    central = np.array([45 <= w <= 100 for w in PD_WT])
    pd_x = np.column_stack([PD_WT, [PD_AGE] * len(PD_WT), [PD_EGFR] * len(PD_WT), np.zeros(len(PD_WT)), np.zeros(len(PD_WT))])
    pd_xs = (pd_x - mean) / sd
    sc_idx = np.sort(np.random.default_rng(MLP_DATA_SEED + 1).choice(ite, size=N_SCATTER, replace=False))
    sc_x = np.round(raw[sc_idx], 4)              # shipped rounded; predictions below use the SAME rounded inputs
    sc_xs = (sc_x - mean) / sd
    per_snap, pd_net, sc_pred, weights = [], [], [], []
    for ep in SNAP_EPOCHS:
        Q = snaps[ep]
        pt = mlp_forward(Q, Xs[ite])[-1]
        r2, rm = r2_rmse(y[ite], pt)
        pdn = mlp_forward(Q, pd_xs)[-1]
        dev = np.abs(pdn - pd_truth)
        per_snap.append({"epoch": ep, "train_mse": tr_loss[ep], "val_mse": va_loss[ep], "test_r2": r2, "test_rmse": rm,
                         "pd_max_abs_dev_lncl": float(dev.max()), "pd_mean_abs_dev_lncl": float(dev.mean()),
                         "pd_max_abs_dev_central": float(dev[central].max())})
        pd_net.append(rnd(pdn)); sc_pred.append(rnd(mlp_forward(Q, sc_xs)[-1]))
        weights.append({k: v.tolist() for k, v in Q.items()})
    fin = per_snap[-1]
    r2_or, rm_or = r2_rmse(y[ite], y_typ[ite])
    r2_mean, rm_mean = r2_rmse(y[ite], np.full(len(ite), y[itr].mean()))
    best_val = int(np.argmin(va_loss))
    final_dev_pct = float(np.max(np.abs(np.exp(mlp_forward(snaps[MLP_EPOCHS], pd_xs)[-1] - pd_truth) - 1)) * 100)
    print(f"  final test R2 {fin['test_r2']:.3f} RMSE(lnCL) {fin['test_rmse']:.3f} | oracle (true function) R2 {r2_or:.3f} RMSE {rm_or:.3f}"
          f" | mean-only R2 {r2_mean:.3f}")
    print(f"  partial dependence deviation at final: max |dlnCL| {fin['pd_max_abs_dev_lncl']:.3f} ({final_dev_pct:.1f} % in CL), "
          f"mean {fin['pd_mean_abs_dev_lncl']:.3f}, 45-100 kg max {fin['pd_max_abs_dev_central']:.3f}; best-val epoch {best_val}")

    # --- self-test references (full precision) from three stored snapshots
    cases = []
    for si, rx in ((0, [85.0, 63.0, 72.0, 1.0, 0.0]), (5, [48.0, 29.0, 110.0, 0.0, 1.0]), (len(SNAP_EPOCHS) - 1, [68.0, 71.0, 55.0, 0.0, 0.0])):
        cls_i = 0 if rx[3] else (2 if rx[4] else 1)
        target = float(true_lncl(rx[0], rx[2], cls_i))
        c = mlp_case(snaps[SNAP_EPOCHS[si]], norm, rx, target)
        c["snapshot"] = si
        cases.append(c)

    out = {
        "meta": meta("mlp", {"data": MLP_DATA_SEED, "init": MLP_INIT_SEED, "minibatch_shuffle": MLP_SHUFFLE_SEED}),
        "data": {
            "synthetic": True, "n": N_POP, "split": {"train": len(itr), "val": len(iva), "test": len(ite)}, "split_unit": "virtual patient",
            "truth": "CL = 4.5*(WT/70)^0.75*(eGFR/90)^0.4*g(class); g = 0.55 / 1.0 / 1.35 (poor / normal / rapid)",
            "noise": f"lognormal, SD {NOISE_SD} on ln CL", "classes": {"poor": CLASS_P[0], "normal": CLASS_P[1], "rapid": CLASS_P[2]},
            "weight": "N(72,14) truncated to 30-120 kg", "age": "N(52,16) truncated to 20-85 y",
            "egfr": "110 - 0.85*max(age-30,0) + N(0,12), clipped to 20-120 mL/min/1.73 m2 (correlated with age)",
            "corr_age_egfr": float(np.corrcoef(raw[:, 1], raw[:, 2])[0, 1]),
            "ranges": {"wt": [30, 120], "age": [20, 85], "egfr": [20, 120]},
        },
        "arch": list(MLP_SIZES),
        "training": {"optimizer": "Adam", "lr": MLP_LR, "batch": MLP_BATCH, "epochs": MLP_EPOCHS, "loss": "MSE of ln CL",
                     "init": "He normal (ReLU layers), zero biases", "best_val_epoch": best_val},
        "inputs": ["body weight (kg)", "age (y)", "eGFR (mL/min/1.73 m2)", "poor metabolizer (0/1)", "rapid metabolizer (0/1)"],
        "norm": {"mean": mean.tolist(), "sd": sd.tolist(), "note": "all five inputs are z-scored with training-split mean and SD"},
        "snapshots": SNAP_EPOCHS,
        "weights": weights,
        "loss": {"train": rnd(tr_loss, 7), "val": rnd(va_loss, 7)},
        "test_scatter": {"x_raw": sc_x.tolist(), "y_obs": rnd(y[sc_idx]), "y_typ": rnd(y_typ[sc_idx]), "pred": sc_pred,
                         "note": f"{N_SCATTER} fixed samples drawn from the {len(ite)} held-out test patients"},
        "pd": {"wt": PD_WT, "age": PD_AGE, "egfr": PD_EGFR, "class": "normal", "truth": rnd(pd_truth), "net": pd_net},
        "metrics": {"per_snapshot": per_snap, "final": fin,
                    "oracle_true_function": {"test_r2": r2_or, "test_rmse": rm_or,
                                             "note": "R2 reached by the noise-free true function on the same test set (ceiling set by the noise)"},
                    "mean_only_baseline": {"test_r2": r2_mean, "test_rmse": rm_mean},
                    "pd_final_max_rel_dev_percent_CL": final_dev_pct, "pd_central_range_wt_kg": [45, 100]},
        "selftest": {"tol": 1e-5, "cases": cases},
        "gradcheck": {"method": "central finite differences, h=1e-6, all parameters, mean-squared-error loss on 24 training patients", **gc},
    }
    return out


# =============================================================================================== GNN (molecule -> Crippen logP)
def featurize(mol):
    X = []
    for a in mol.GetAtoms():
        z = a.GetAtomicNum()
        X.append([float(z == 6), float(z == 7), float(z == 8), float(z not in (6, 7, 8)), float(a.GetIsAromatic()),
                  a.GetDegree() / 4.0, float(a.GetFormalCharge()), float(a.IsInRing())])
    return np.array(X)


def edges(mol):
    s, d = [], []
    for b in mol.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        s += [i, j]; d += [j, i]
    return np.array(s, dtype=np.int64), np.array(d, dtype=np.int64)


class Mol:
    def __init__(self, smi, mol):
        self.smi, self.mol = smi, mol
        self.x = featurize(mol)
        self.src, self.dst = edges(mol)
        self.n = mol.GetNumAtoms()
        self.y = float(Descriptors.MolLogP(mol))
        self.els = {a.GetAtomicNum() for a in mol.GetAtoms()}


def load_molecules():
    path = os.environ.get("DL_DEMO_SMILES") or os.path.join(RDConfig.RDDataDir, "NCI", "first_5K.smi")
    if not os.path.exists(path):
        sys.exit(f"SMILES source not found: {path}\nIt ships with RDKit (Data/NCI/first_5K.smi); reinstall rdkit or set DL_DEMO_SMILES to a .smi file.")
    shown = {Chem.MolToSmiles(Chem.MolFromSmiles(s)) for _, s, _ in DISPLAY}
    seen, mols = set(), []
    stats = {"lines": 0, "unparsable": 0, "multi_fragment": 0, "element_filter": 0, "size_filter": 0, "duplicate": 0, "display_removed": 0}
    with open(path) as fh:
        for line in fh:
            parts = line.split()
            if not parts:
                continue
            stats["lines"] += 1
            smi = parts[0]
            m = Chem.MolFromSmiles(smi)
            if m is None:
                stats["unparsable"] += 1; continue
            if "." in smi:
                stats["multi_fragment"] += 1; continue
            if not {a.GetAtomicNum() for a in m.GetAtoms()} <= GNN_ELEMENTS:
                stats["element_filter"] += 1; continue
            if not (3 <= m.GetNumAtoms() <= GNN_MAX_HEAVY):
                stats["size_filter"] += 1; continue
            can = Chem.MolToSmiles(m)
            if can in seen:
                stats["duplicate"] += 1; continue
            seen.add(can)
            if can in shown:
                stats["display_removed"] += 1; continue
            mols.append(Mol(can, m))
    stats["kept"] = len(mols)
    return mols, stats, os.path.basename(path)


def batch_graph(ms):
    ns = np.array([m.n for m in ms]); off = np.concatenate([[0], np.cumsum(ns)[:-1]])
    N, B = int(ns.sum()), len(ms)
    X = np.vstack([m.x for m in ms])
    src = np.concatenate([m.src + o for m, o in zip(ms, off)]); dst = np.concatenate([m.dst + o for m, o in zip(ms, off)])
    rows = np.concatenate([dst, np.arange(N)]); cols = np.concatenate([src, np.arange(N)])
    S = sp.csr_matrix((np.ones(rows.size), (rows, cols)), shape=(N, N))          # S = I + A
    mol_id = np.repeat(np.arange(B), ns)
    Pm = sp.csr_matrix((1.0 / ns[mol_id], (mol_id, np.arange(N))), shape=(B, N))  # mean pooling
    y = np.array([m.y for m in ms])
    return X, S, Pm, ns.astype(float), y


def gnn_init(rng, h=GNN_HIDDEN):
    return {"W1": rng.normal(0, math.sqrt(2 / 8), (h, 8)), "b1": np.zeros(h), "W2": rng.normal(0, math.sqrt(2 / h), (h, h)),
            "b2": np.zeros(h), "w": rng.normal(0, math.sqrt(1 / h), h), "b0": np.zeros(1)}


def gnn_forward(P, X, S, Pm):
    M1 = S @ X; Z1 = M1 @ P["W1"].T + P["b1"]; H1 = relu(Z1)
    M2 = S @ H1; Z2 = M2 @ P["W2"].T + P["b2"]; H2 = relu(Z2)
    pooled = Pm @ H2
    s = pooled @ P["w"] + P["b0"][0]
    return M1, Z1, H1, M2, Z2, H2, pooled, s


def gnn_loss_grads(P, X, S, Pm, ns, y):
    """Prediction = (number of heavy atoms) * (linear head of the mean-pooled vector); loss = MSE of logP."""
    M1, Z1, H1, M2, Z2, H2, pooled, s = gnn_forward(P, X, S, Pm)
    pred = ns * s
    B = len(y)
    loss = float(np.mean((pred - y) ** 2))
    ds = 2.0 * (pred - y) / B * ns
    G = {"w": pooled.T @ ds, "b0": np.array([ds.sum()])}
    dH2 = Pm.T @ np.outer(ds, P["w"])
    dZ2 = dH2 * (Z2 > 0)
    G["W2"] = dZ2.T @ M2; G["b2"] = dZ2.sum(0)
    dH1 = S.T @ (dZ2 @ P["W2"])
    dZ1 = dH1 * (Z1 > 0)
    G["W1"] = dZ1.T @ M1; G["b1"] = dZ1.sum(0)
    return loss, G


def gnn_predict(P, ms):
    X, S, Pm, ns, y = batch_graph(ms)
    return ns * gnn_forward(P, X, S, Pm)[-1], y


def crippen_atom_contribs(mol):
    """Per-heavy-atom Crippen logP contribution, including the hydrogens attached to that atom."""
    mh = Chem.AddHs(mol)
    c = [t[0] for t in rdMolDescriptors._CalcCrippenContribs(mh)]
    out = list(c[:mol.GetNumAtoms()])
    for a in mh.GetAtoms():
        if a.GetAtomicNum() == 1:
            out[a.GetNeighbors()[0].GetIdx()] += c[a.GetIdx()]
    assert abs(sum(out) - Descriptors.MolLogP(mol)) < 1e-9
    return out


def mol_record(P, name, smi, mol, key=None):
    mol = Chem.Mol(mol)
    rdDepictor.SetPreferCoordGen(False)
    rdDepictor.Compute2DCoords(mol)
    xy = np.array([[mol.GetConformer().GetAtomPosition(i).x, mol.GetConformer().GetAtomPosition(i).y] for i in range(mol.GetNumAtoms())])
    lo, hi = xy.min(0), xy.max(0)
    L = float((hi - lo).max())
    nx = (xy[:, 0] - lo[0]) / L
    ny = (hi[1] - xy[:, 1]) / L          # flip y for SVG
    m = Mol(smi, mol)
    X, S, Pm, ns, y = batch_graph([m])
    M1, Z1, H1, M2, Z2, H2, pooled, s = gnn_forward(P, X, S, Pm)
    contrib = crippen_atom_contribs(mol)
    return {
        "id": name, "smiles": smi, "canonical": Chem.MolToSmiles(mol), "inchikey": key,
        "w": float((hi[0] - lo[0]) / L), "h": float((hi[1] - lo[1]) / L),
        "atoms": [{"el": a.GetSymbol(), "x": round(float(nx[a.GetIdx()]), 4), "y": round(float(ny[a.GetIdx()]), 4),
                   "ar": int(a.GetIsAromatic()), "deg": a.GetDegree(), "chg": a.GetFormalCharge(), "ring": int(a.IsInRing())}
                  for a in mol.GetAtoms()],
        "bonds": [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "o": b.GetBondTypeAsDouble(), "ar": int(b.GetIsAromatic())}
                  for b in mol.GetBonds()],
        "rings": [list(r) for r in mol.GetRingInfo().AtomRings()],
        "x": X.tolist(), "h1": H1.tolist(), "h2": H2.tolist(), "pooled": pooled[0].tolist(), "s": float(s[0]),
        "n": m.n, "pred": float(m.n * s[0]), "ref": m.y, "ref_contrib": rnd(contrib, 4),
    }


def build_gnn():
    mols, stats, srcname = load_molecules()
    print(f"[GNN] source {srcname}: {stats}")
    rng = np.random.default_rng(GNN_SEED)
    perm = rng.permutation(len(mols))
    n_tr, n_va = int(0.70 * len(mols)), int(0.15 * len(mols))
    itr, iva, ite = perm[:n_tr], perm[n_tr:n_tr + n_va], perm[n_tr + n_va:]
    sets = {k: [mols[i] for i in idx] for k, idx in (("train", itr), ("val", iva), ("test", ite))}
    graphs = {k: batch_graph(v) for k, v in sets.items()}
    print(f"  split by molecule: train {len(itr)} / val {len(iva)} / test {len(ite)}; logP mean {np.mean([m.y for m in mols]):.2f} SD {np.std([m.y for m in mols]):.2f}")

    P = gnn_init(rng)
    state = {"m": {}, "v": {}}
    shuf = np.random.default_rng(GNN_SEED + 1)
    tr_rmse, va_rmse, best, best_ep, t = [], [], None, 0, 0

    def rmse(split):
        X, S, Pm, ns, y = graphs[split]
        return math.sqrt(float(np.mean((ns * gnn_forward(P, X, S, Pm)[-1] - y) ** 2)))

    tr_rmse.append(rmse("train")); va_rmse.append(rmse("val"))
    best = {k: v.copy() for k, v in P.items()}
    best_val = va_rmse[0]
    train_ms = sets["train"]
    for ep in range(1, GNN_EPOCHS + 1):
        order = shuf.permutation(len(train_ms))
        lr = GNN_LR * (0.5 * (1 + math.cos(math.pi * (ep - 1) / GNN_EPOCHS)) * 0.95 + 0.05)  # cosine decay to 5 %
        for s in range(0, len(order), GNN_BATCH):
            X, S, Pm, ns, y = batch_graph([train_ms[i] for i in order[s:s + GNN_BATCH]])
            _, G = gnn_loss_grads(P, X, S, Pm, ns, y)
            t += 1
            adam_step(P, G, state, lr, t)
        tr_rmse.append(rmse("train")); va_rmse.append(rmse("val"))
        if va_rmse[-1] < best_val:
            best_val, best_ep, best = va_rmse[-1], ep, {k: v.copy() for k, v in P.items()}
        if ep in (1, 10, 50, 100, GNN_EPOCHS):
            print(f"  epoch {ep:3d}  train RMSE {tr_rmse[-1]:.3f}  val RMSE {va_rmse[-1]:.3f}")
    P = best
    print(f"  weights kept from epoch {best_ep} (lowest validation RMSE {best_val:.3f})")

    # --- gradient check on 6 molecules, every parameter
    X, S, Pm, ns, y = batch_graph(sets["train"][:6])
    Q = {k: v.copy() for k, v in P.items()}
    _, G = gnn_loss_grads(Q, X, S, Pm, ns, y)
    rel, ab, npar = finite_diff_check(Q, lambda: gnn_loss_grads(Q, X, S, Pm, ns, y)[0], G, h=1e-6)
    gc = {"method": "central finite differences, h=1e-6, all parameters, MSE of logP on 6 training molecules",
          "max_rel_err": rel, "max_abs_err": ab, "n_params": npar}
    print(f"  gradient check: {npar} params, max rel err {rel:.2e}, max abs err {ab:.2e}")

    # --- held-out metrics (test split used once)
    pt, yt = gnn_predict(P, sets["test"])
    r2, rm = r2_rmse(yt, pt)
    ntest = np.array([m.n for m in sets["test"]])
    r2_pa, rm_pa = r2_rmse(yt / ntest, pt / ntest)
    ytr = np.array([m.y for m in sets["train"]]); ntr = np.array([m.n for m in sets["train"]])
    per_atom_mean = ytr.sum() / ntr.sum()
    r2_b1, rm_b1 = r2_rmse(yt, per_atom_mean * ntest)
    cnt = lambda ms: np.array([[sum(a.GetAtomicNum() == z for a in m.mol.GetAtoms()) for z in (6, 7, 8)] +
                               [sum(a.GetAtomicNum() not in (6, 7, 8) for a in m.mol.GetAtoms()), 1] for m in ms], float)
    coef = np.linalg.lstsq(cnt(sets["train"]), ytr, rcond=None)[0]
    r2_b2, rm_b2 = r2_rmse(yt, cnt(sets["test"]) @ coef)
    chno = np.array([m.els <= {6, 7, 8} for m in sets["test"]])
    r2_c, rm_c = r2_rmse(yt[chno], pt[chno]) if chno.sum() > 5 else (float("nan"), float("nan"))
    print(f"  TEST ({len(ite)} molecules): R2 {r2:.3f} RMSE {rm:.3f} logP units | per-atom target R2 {r2_pa:.3f} | "
          f"baselines: atoms x mean R2 {r2_b1:.3f}, element-count regression R2 {r2_b2:.3f} | CHNO-only subset (n={int(chno.sum())}) R2 {r2_c:.3f} RMSE {rm_c:.3f}")

    # --- display molecules (never in training: removed from the data by canonical SMILES)
    disp = []
    for name, smi, key in DISPLAY:
        m = Chem.MolFromSmiles(smi)
        assert m is not None, name
        try:
            ik = Chem.MolToInchiKey(m)
            assert ik == key, (name, ik, key)
        except AttributeError:
            pass
        disp.append(mol_record(P, name, smi, m, key))
        print(f"  {name}: GNN {disp[-1]['pred']:.2f} vs RDKit Crippen {disp[-1]['ref']:.2f}")

    # extra graphs for the browser self test: three held-out test molecules of different size
    srt = sorted(range(len(sets["test"])), key=lambda i: sets["test"][i].n)
    extra = []
    for i in (srt[len(srt) // 6], srt[len(srt) // 2], srt[5 * len(srt) // 6]):
        extra.append(mol_record(P, f"test{i}", sets["test"][i].smi, sets["test"][i].mol))

    out = {
        "meta": meta("gnn", {"split_and_init": GNN_SEED, "minibatch_shuffle": GNN_SEED + 1}),
        "task": "Predict RDKit Crippen logP (a calculated value, not a measurement) from the molecular graph",
        "source": {"file": "Data/NCI/first_5K.smi inside the installed RDKit package", "origin": "NCI Open Database structures as bundled with RDKit",
                   "licence_note": "RDKit is BSD-3-Clause. The training structures come from the NCI Open Database file shipped inside RDKit (Data/NCI/first_5K.smi); that file is not copied here, but this JSON contains the SMILES and 2D coordinates of six molecules: caffeine, ibuprofen and propranolol (display molecules) and three NCI-derived molecules used only by the self-test. The terms of use of the NCI structure set could not be checked (the NCI host returned 403 through the proxy); confirm them before the page is made public.",
                   "filter": stats, "elements_kept": "C N O F P S Cl Br I", "max_heavy_atoms": GNN_MAX_HEAVY},
        "feature_names": FEATURE_NAMES,
        "feature_doc": "8 numbers per heavy atom: one-hot element (C, N, O, other), aromatic flag, degree/4 (heavy-atom neighbours), formal charge, in-ring flag",
        "hidden": GNN_HIDDEN,
        "weights": {k: v.tolist() for k, v in P.items()},
        "readout": "pooled = mean over atoms of h2; s = w . pooled + b0 (logP per heavy atom); predicted logP = (number of heavy atoms) * s",
        "training": {"optimizer": "Adam, cosine learning-rate decay to 5 %", "lr": GNN_LR, "batch": GNN_BATCH, "epochs": GNN_EPOCHS,
                     "kept_epoch": best_ep, "loss": "MSE of logP", "split": {"train": len(itr), "val": len(iva), "test": len(ite)},
                     "split_unit": "molecule", "train_rmse": rnd(tr_rmse, 4), "val_rmse": rnd(va_rmse, 4)},
        "metrics": {"test_r2": r2, "test_rmse": rm, "test_r2_per_atom_target": r2_pa, "test_rmse_per_atom_target": rm_pa,
                    "baseline_atoms_x_mean": {"test_r2": r2_b1, "test_rmse": rm_b1},
                    "baseline_element_count_regression": {"test_r2": r2_b2, "test_rmse": rm_b2},
                    "chno_only_subset": {"n": int(chno.sum()), "test_r2": r2_c, "test_rmse": rm_c},
                    "val_rmse_kept": best_val},
        "test_scatter": {"ref": rnd(yt, 3), "pred": rnd(pt, 3), "n_atoms": ntest.tolist()},
        "molecules": disp,
        "selftest": {"tol": 1e-5, "extra": extra},
        "gradcheck": gc,
    }
    return out


def dump(obj, path):
    def default(o):
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        raise TypeError(type(o))
    text = json.dumps(obj, separators=(",", ":"), default=default, allow_nan=False)
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}  {len(text)/1024:.1f} KB")


def main():
    mlp = build_mlp()
    gnn = build_gnn()
    if QUICK:
        print("quick mode: nothing written")
        return
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dump(mlp, OUT_DIR / "dl-mlp.json")
    dump(gnn, OUT_DIR / "dl-gnn.json")


if __name__ == "__main__":
    main()
