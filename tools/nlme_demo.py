#!/usr/bin/env python3
"""Regenerates assets/data/nlme-demo.json for the NLME explorer widget.

What it does (everything is real computation on SIMULATED data; no patient data, no network):
  * simulates 30 virtual subjects (one-compartment, first-order absorption, 100 mg oral dose, log-normal BSV, proportional error)
  * fits them with our own FOCE-I implementation (inner MAP eta problem per subject + Laplace objective, outer BFGS on log-transformed
    theta / omega / sigma) for three sampling scenarios (rich 10, moderate 5, sparse 3 samples per subject), same starting values
  * records every accepted outer iteration (thinned to <= 60 frames if more were needed), an OFV surface over (ln CL/F, ln V/F),
    and the validation / cross-check numbers that the page displays.

Reproduce:   python3 tools/nlme_demo.py                      (writes assets/data/nlme-demo.json; ~ a few minutes, numpy + scipy only)
Options:     --out PATH   --csv PATH (export the rich data set for an external nlmixr2 run)   --no-validation   --replicates N
Verified with: Python 3.13.16, numpy 2.5.3, scipy 1.18.1 (the versions used for a run are also written to meta.numpy / meta.scipy).
Seed: SEED below, fixed in advance and not tuned.
"""
import argparse
import json
import math
import os
import platform
import shutil
import sys
import time

import numpy as np
import scipy
from scipy.optimize import minimize
from scipy.special import logsumexp

SEED = 20261013
RUN_COMMAND = "python3 tools/nlme_demo.py"
DOSE = 100.0
N_SUBJ = 30
T_RICH = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0, 6.0, 8.0, 12.0, 24.0]
TRUE_THETA = np.array([4.0, 35.0, 1.1])      # CL/F (L/h), V/F (L), ka (1/h)
TRUE_OMEGA = np.array([0.30, 0.25, 0.50])    # SD of log-normal BSV
TRUE_SIGMA = 0.15                            # proportional residual SD
START_THETA = np.array([8.0, 70.0, 0.4])
START_OMEGA = np.sqrt(np.array([0.1, 0.1, 0.1]))   # omega^2 = 0.1 each
START_SIGMA = 0.3
MAX_FRAMES = 60
MAX_ITER = 400
GTOL = 1e-3
LOG2PI = math.log(2.0 * math.pi)
PNAMES = ["CL/F", "V/F", "ka"]


# --------------------------------------------------------------------------------------------- model + sensitivities
def _g_gp(x):
    """g(x) = (1 - exp(-x))/x and g'(x), stable near x = 0 (ka ~ ke)."""
    small = np.abs(x) < 0.02
    xs = np.where(small, 1.0, x)
    g_big = -np.expm1(-xs) / xs
    gp_big = (np.exp(-xs) * (xs + 1.0) - 1.0) / xs ** 2
    g_s = 1 - x / 2 + x ** 2 / 6 - x ** 3 / 24 + x ** 4 / 120 - x ** 5 / 720 + x ** 6 / 5040
    gp_s = -0.5 + x / 3 - x ** 2 / 8 + x ** 3 / 30 - 5 * x ** 4 / 720 + 6 * x ** 5 / 5040
    return np.where(small, g_s, g_big), np.where(small, gp_s, gp_big)


def conc(cl, v, ka, t, dose=DOSE):
    """f(t) = D ka / (V (ka - ke)) (exp(-ke t) - exp(-ka t)), written as D ka/V * t * exp(-ke t) * g((ka-ke) t)."""
    ke = cl / v
    g, _ = _g_gp((ka - ke) * t)
    return dose * ka / v * t * np.exp(-ke * t) * g


def conc_L(cl, v, ka, t, dose=DOSE):
    """Returns f and L = d ln f / d eta (shape (..., 3)); eta are log-scale deviations of (CL, V, ka)."""
    ke = cl / v
    x = (ka - ke) * t
    g, gp = _g_gp(x)
    r = gp / g
    f = dose * ka / v * t * np.exp(-ke * t) * g
    l_cl = -ke * t * (1.0 + r)
    l_v = -1.0 + ke * t * (1.0 + r)
    l_ka = 1.0 + r * ka * t
    return f, np.stack([l_cl, l_v, l_ka], axis=-1)


# --------------------------------------------------------------------------------------------- FOCE-I
class FoceI:
    """FOCE with interaction for the proportional-error one-compartment model.

    x = [ln CL/F, ln V/F, ln ka, ln w_CL, ln w_V, ln w_ka, ln sigma]  (unconstrained outer parameters)
    Per subject: eta_hat = argmin_eta sum_j [ln var_j + (y_j - f_j)^2/var_j] + eta' Omega^-1 eta, var_j = sigma^2 f_j(eta)^2
    (interaction: the variance is evaluated at eta). Laplace objective, constants included:
    OFV_i = m ln 2pi + sum_j [ln var_j + res_j^2/var_j] + eta_hat' Omega^-1 eta_hat + ln|I + Omega J' R^-1 J|,
    J = d f/d eta at eta_hat, R = diag(var). The Hessian is the Gauss-Newton one (d var/d eta and d2 f/d eta2 are neglected).
    """

    def __init__(self, t, y):
        self.t, self.y = np.asarray(t, float), np.asarray(y, float)
        self.n, self.m = self.t.shape
        self.warm = np.zeros((self.n, 3))
        self.nfev = 0
        self.inner_failures = 0      # objective evaluations in which at least one subject's inner problem had |grad| > 1e-5
        self.last_gmax = 0.0

    def inner(self, lnth, om, sig, eta0=None, tol=1e-7, maxit=60):
        t, y = self.t, self.y
        inv, s2 = 1.0 / om ** 2, sig ** 2

        def ev(eta):
            p = np.exp(lnth + eta)
            with np.errstate(all="ignore"):
                f, L = conc_L(p[:, 0:1], p[:, 1:2], p[:, 2:3], t)
                o = (2.0 * np.log(f) + (y / f - 1.0) ** 2 / s2).sum(1) + (eta ** 2 * inv).sum(1)
            return f, L, np.where(np.isfinite(o), o, np.inf)

        eta = np.zeros((self.n, 3)) if eta0 is None else eta0.copy()
        f, L, O = ev(eta)
        if not np.all(np.isfinite(O)):
            eta = np.zeros((self.n, 3))
            f, L, O = ev(eta)
        gmax = np.full(self.n, np.inf)
        for _ in range(maxit):
            z = y / f
            grad = (2.0 * L * (1.0 - z * (z - 1.0) / s2)[..., None]).sum(1) + 2.0 * eta * inv
            gmax = np.abs(grad).max(1)
            todo = gmax > tol
            if not todo.any():
                break
            # Newton step with the exact Hessian of the inner objective: sum_j [c_j d2u_j + c'_j L_j L_j'] + 2/omega^2, u = ln f.
            # d2u (second derivatives of ln f) = central difference (h = 1e-5) of the analytic first derivatives L.
            # If that Hessian is not positive definite (far from the optimum) fall back to Fisher scoring (expected information).
            c = 2.0 - 2.0 * z * (z - 1.0) / s2
            cp = (2.0 / s2) * (2.0 * z ** 2 - z)
            H = np.einsum("nm,nmi,nmj->nij", cp, L, L)
            for b in range(3):
                e = np.zeros(3); e[b] = 1e-5
                pp, pm = np.exp(lnth + eta + e), np.exp(lnth + eta - e)
                with np.errstate(all="ignore"):
                    Lp = conc_L(pp[:, 0:1], pp[:, 1:2], pp[:, 2:3], t)[1]
                    Lm = conc_L(pm[:, 0:1], pm[:, 1:2], pm[:, 2:3], t)[1]
                H[:, :, b] += np.einsum("nm,nmi->ni", c, (Lp - Lm) / 2e-5)
            H = 0.5 * (H + np.transpose(H, (0, 2, 1))) + 2.0 * np.diag(inv)[None]
            Afish = 2.0 * ((1.0 / s2 + 2.0) * np.einsum("nmi,nmj->nij", L, L) + np.diag(inv)[None])
            okH = np.isfinite(H).all((1, 2))
            okH &= np.linalg.eigvalsh(np.where(okH[:, None, None], H, np.eye(3)[None])).min(1) > 1e-8
            Hs = np.where(okH[:, None, None], H, Afish)
            step = -np.linalg.solve(Hs, grad[..., None])[..., 0]
            alpha = np.ones(self.n)
            for _ls in range(30):
                et = eta + alpha[:, None] * step
                f2, L2, O2 = ev(et)
                ok = todo & (O2 <= O + 1e-12)
                eta[ok], f[ok], L[ok], O[ok] = et[ok], f2[ok], L2[ok], O2[ok]
                todo &= ~ok
                if not todo.any():
                    break
                alpha[todo] *= 0.5
        z = y / f
        grad = (2.0 * L * (1.0 - z * (z - 1.0) / s2)[..., None]).sum(1) + 2.0 * eta * inv
        gmax = np.abs(grad).max(1)
        return eta, f, L, gmax

    def subject_ofv(self, x, warm=True):
        lnth, om, sig = x[0:3], np.exp(x[3:6]), math.exp(x[6])
        eta, f, L, gmax = self.inner(lnth, om, sig, self.warm if warm else None)
        self.nfev += 1
        if np.all(np.isfinite(eta)) and gmax.max() < 1e-4:
            self.warm = eta.copy()
        self.last_gmax = float(gmax.max())
        self.inner_failures += int(gmax.max() > 1e-5)
        with np.errstate(all="ignore"):
            res2 = ((self.y - f) / (sig * f)) ** 2
            M = np.einsum("nmi,nmj->nij", L, L) / sig ** 2
            B = np.eye(3)[None] + (om ** 2)[None, :, None] * M
            sign, logdet = np.linalg.slogdet(B)
            o = (self.m * LOG2PI + (2.0 * math.log(sig) + 2.0 * np.log(f) + res2).sum(1)
                 + (eta ** 2 / om ** 2).sum(1) + logdet)
        return o, eta

    def total(self, x):
        o, _ = self.subject_ofv(x)
        v = float(o.sum())
        return v if math.isfinite(v) else 1e12

    def grad_fd(self, x, h=1e-5):
        g = np.zeros(len(x))
        for k in range(len(x)):
            e = np.zeros(len(x)); e[k] = h
            g[k] = (self.total(x + e) - self.total(x - e)) / (2 * h)
        return g

    def hessian_fd(self, x, h=2e-3):
        n = len(x)
        H = np.zeros((n, n))
        f0 = self.total(x)
        for i in range(n):
            ei = np.zeros(n); ei[i] = h
            H[i, i] = (self.total(x + ei) - 2 * f0 + self.total(x - ei)) / h ** 2
            for j in range(i + 1, n):
                ej = np.zeros(n); ej[j] = h
                H[i, j] = H[j, i] = (self.total(x + ei + ej) - self.total(x + ei - ej)
                                     - self.total(x - ei + ej) + self.total(x - ei - ej)) / (4 * h * h)
        return H


def pack(theta, omega, sigma):
    return np.concatenate([np.log(theta), np.log(omega), [math.log(sigma)]])


def unpack(x):
    return np.exp(x[0:3]), np.exp(x[3:6]), math.exp(x[6])


def shrinkage(eta, omega):
    return 1.0 - np.std(eta, axis=0, ddof=1) / omega


def fit(model, x0, record=True, maxiter=MAX_ITER, gtol=GTOL):
    """Outer minimisation of the summed Laplace OFV with scipy BFGS (central-difference gradient).
    Returns dict(states=[...], res=OptimizeResult). states[k] = iteration k (0 = starting values)."""
    model.warm = np.zeros((model.n, 3)); model.nfev = 0; model.inner_failures = 0
    states = []

    def snap(x):
        o, eta = model.subject_ofv(x, warm=True)
        th, om, sg = unpack(x)
        states.append(dict(x=x.copy(), theta=th, omega=om, sigma=sg, ofv=float(o.sum()), eta=eta.copy(), inner_gmax=model.last_gmax))

    if record:
        snap(x0)

    def cb(xk):
        if record:
            snap(np.array(xk))

    res = minimize(model.total, x0, jac=model.grad_fd, method="BFGS", callback=cb,
                   options=dict(gtol=gtol, maxiter=maxiter))
    if not record:
        o = model.total(res.x)
    return dict(states=states, res=res, nfev=model.nfev)


# --------------------------------------------------------------------------------------------- data
def simulate(seed, n=N_SUBJ):
    rng = np.random.default_rng(seed)
    eta = rng.normal(0.0, 1.0, (n, 3)) * TRUE_OMEGA
    eps = rng.normal(0.0, 1.0, (n, len(T_RICH)))
    p = TRUE_THETA * np.exp(eta)
    f = conc(p[:, 0:1], p[:, 1:2], p[:, 2:3], np.array(T_RICH)[None, :])
    y = np.round(f * (1.0 + TRUE_SIGMA * eps), 5)
    return eta, y


def sampling_sets(n=N_SUBJ):
    rich = [list(range(len(T_RICH))) for _ in range(n)]
    moderate = [[1, 3, 5, 7, 9] for _ in range(n)]              # 0.5, 1.5, 4, 8, 24 h
    early, mid, late = [0, 1, 2, 3], [4, 5, 6], [7, 8, 9]       # 0.25-1.5 h | 2-6 h | 8-24 h
    sparse = [[early[i % 4], mid[(i + i // 3) % 3], late[(i // 2) % 3]] for i in range(n)]
    return {"rich": rich, "moderate": moderate, "sparse": sparse}


def design_arrays(y_rich, idx):
    t = np.array([[T_RICH[k] for k in row] for row in idx])
    y = np.array([[y_rich[i][k] for k in row] for i, row in enumerate(idx)])
    return t, y


def thin_frames(n_states):
    """Indices of the states to ship: all if <= MAX_FRAMES, else first 10, last 10 and evenly spaced in between."""
    if n_states <= MAX_FRAMES:
        return list(range(n_states))
    mid_n = MAX_FRAMES - 20
    mid = np.unique(np.round(np.linspace(10, n_states - 11, mid_n)).astype(int)).tolist()
    keep = sorted(set(range(10)) | set(mid) | set(range(n_states - 10, n_states)))
    return keep


# --------------------------------------------------------------------------------------------- validation helpers
def jacobian_check(rng, n_sets=400):
    """Analytic L / J = f*L versus central finite differences in eta (step 1e-6). Includes ka ~ ke cases."""
    worst_rel, worst_abs = 0.0, 0.0
    for k in range(n_sets):
        cl = 4.0 * math.exp(rng.normal(0, 0.6)); v = 35.0 * math.exp(rng.normal(0, 0.6)); ka = 1.1 * math.exp(rng.normal(0, 0.8))
        if k % 10 == 0:
            ka = cl / v * (1.0 + (1 if k % 20 else -1) * 10.0 ** rng.uniform(-9, -2))   # near-singular ka ~ ke (both sides)
        t = np.array(T_RICH + [0.1, 36.0])
        f, L = conc_L(cl, v, ka, t)
        J = f[:, None] * L
        h = 1e-6
        Jfd = np.zeros_like(J)
        base = np.array([cl, v, ka])
        for c in range(3):
            e = np.zeros(3); e[c] = h
            fp = conc(*(base * np.exp(e)), t)
            fm = conc(*(base * np.exp(-e)), t)
            Jfd[:, c] = (fp - fm) / (2 * h)
        err = np.abs(J - Jfd)
        worst_abs = max(worst_abs, float(err.max()))
        worst_rel = max(worst_rel, float((err / np.maximum(np.abs(J), 1e-3 * np.abs(J).max())).max()))
    return dict(n_parameter_sets=n_sets, step=1e-6, max_abs_err=worst_abs, max_rel_err=worst_rel,
                note="analytic J = f * d ln f / d eta vs central differences of f; every 10th set has ka within 1e-9..1e-2 (relative) of ke")


def exact_m2ll(y, t, theta, omega, sigma, ngrid=121, half=6.0):
    """Brute-force -2 ln of the individual marginal likelihood: tensor-grid quadrature of the exact 3-D integral over eta
    (prior N(0, Omega), likelihood prod_j N(y_j; f_j(eta), (sigma f_j(eta))^2)), box +-half*omega around 0. No Laplace step."""
    axes = [np.linspace(-half * omega[k], half * omega[k], ngrid) for k in range(3)]
    d = [a[1] - a[0] for a in axes]
    E1, E2 = np.meshgrid(axes[0], axes[1], indexing="ij")
    e12 = np.stack([E1.ravel(), E2.ravel()], 1)
    parts = []
    for e3 in axes[2]:
        eta = np.column_stack([e12, np.full(len(e12), e3)])
        p = theta * np.exp(eta)
        f = conc(p[:, 0:1], p[:, 1:2], p[:, 2:3], t[None, :])
        ll = -0.5 * (len(t) * LOG2PI + (2 * math.log(sigma) + 2 * np.log(f) + ((y[None, :] - f) / (sigma * f)) ** 2).sum(1))
        lp = -0.5 * (3 * LOG2PI + 2 * np.log(omega).sum() + ((eta / omega) ** 2).sum(1))
        parts.append(logsumexp(ll + lp))
    return float(-2.0 * (logsumexp(parts) + math.log(d[0] * d[1] * d[2])))


def laplace_i(model, i, x, eta_i):
    """Laplace OFV_i at given (x, eta_i) recomputed from scratch for a single subject (independent of the vectorised code path)."""
    th, om, sg = unpack(x)
    t, y = model.t[i], model.y[i]
    p = th * np.exp(eta_i)
    f, L = conc_L(p[0], p[1], p[2], t)
    var = sg ** 2 * f ** 2
    Jm = f[:, None] * L
    Rinv = 1.0 / var
    Mx = Jm.T @ (Jm * Rinv[:, None])
    return float(len(t) * LOG2PI + np.sum(np.log(var) + (y - f) ** 2 / var) + np.sum(eta_i ** 2 / om ** 2)
                 + np.linalg.slogdet(np.eye(3) + np.diag(om ** 2) @ Mx)[1])


def random_start(rng):
    while True:
        th = TRUE_THETA * np.exp(rng.uniform(-1.0, 1.0, 3))
        if th[2] > 1.5 * th[0] / th[1]:          # keep ka > ke (flip-flop excluded by construction)
            break
    om = np.exp(rng.uniform(math.log(0.1), math.log(1.0), 3))
    sg = math.exp(rng.uniform(math.log(0.05), math.log(0.5)))
    return pack(th, om, sg)


def rnd(a, nd):
    return np.round(np.asarray(a, float), nd).tolist()


# --------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "data", "nlme-demo.json"))
    ap.add_argument("--csv", default="")
    ap.add_argument("--no-validation", action="store_true")
    ap.add_argument("--replicates", type=int, default=10)
    a = ap.parse_args()
    t_start = time.time()
    np.seterr(all="ignore")

    eta_true, y_rich = simulate(SEED)
    idx = sampling_sets()
    if a.csv:
        with open(a.csv, "w") as fh:
            fh.write("ID,TIME,DV,AMT,EVID\n")
            for i in range(N_SUBJ):
                fh.write(f"{i+1},0,.,{DOSE:g},1\n")
                for k, tt in enumerate(T_RICH):
                    fh.write(f"{i+1},{tt:g},{y_rich[i][k]:g},.,0\n")
        print("wrote", a.csv)

    x0 = pack(START_THETA, START_OMEGA, START_SIGMA)
    scen_out, runs = {}, {}
    labels = {"rich": "Rich (10 samples/subject)", "moderate": "Moderate (5 samples/subject)", "sparse": "Sparse (3 samples/subject)"}
    for name in ["rich", "moderate", "sparse"]:
        t0 = time.time()
        t_arr, y_arr = design_arrays(y_rich, idx[name])
        mdl = FoceI(t_arr, y_arr)
        out = fit(mdl, x0)
        st, res = out["states"], out["res"]
        keep = thin_frames(len(st))
        last = st[-1]
        xf = last["x"]
        gnorm = float(np.abs(mdl.grad_fd(xf)).max())
        # OFV monotone check over accepted iterations
        ofvs = np.array([s["ofv"] for s in st])
        monotone = bool(np.all(np.diff(ofvs) <= 1e-9))
        # asymptotic SE (inverse FD Hessian of the Laplace OFV; cov = 2 H^-1 for -2LL)
        H = mdl.hessian_fd(xf)
        ev_ = np.linalg.eigvalsh(0.5 * (H + H.T))
        pd = bool(ev_.min() > 1e-8)
        if pd:
            se = np.sqrt(np.diag(2.0 * np.linalg.inv(H)))
        else:
            se = np.full(7, np.nan)
        th, om, sg = last["theta"], last["omega"], last["sigma"]
        est = np.concatenate([th, om, [sg]])
        tru = np.concatenate([TRUE_THETA, TRUE_OMEGA, [TRUE_SIGMA]])
        shr = shrinkage(last["eta"], om)
        # surface
        n_g, half = 31, 0.6
        gl = np.linspace(-half, half, n_g)
        Z = np.zeros((n_g, n_g))
        mdl.warm = last["eta"].copy()
        for iv, dv in enumerate(gl):
            for ic, dc in enumerate(gl):
                xx = xf.copy(); xx[0] += dc; xx[1] += dv
                Z[iv, ic] = mdl.total(xx)
        scen_out[name] = dict(
            label=labels[name], n_per_subject=len(idx[name][0]), sampling=idx[name],
            n_iter_total=len(st) - 1, n_frames=len(keep), thinned=len(keep) < len(st),
            thinning_rule=("first 10 and last 10 iterations kept, the rest evenly spaced; frames carry their original iteration index"
                           if len(keep) < len(st) else "none (every accepted iteration is stored)"),
            frames=[dict(iter=int(k), theta=rnd(st[k]["theta"], 6), omega=rnd(st[k]["omega"], 6), sigma=round(float(st[k]["sigma"]), 6),
                         ofv=round(st[k]["ofv"], 4), eta=rnd(st[k]["eta"], 5)) for k in keep],
            final=dict(theta=rnd(th, 6), omega=rnd(om, 6), sigma=round(float(sg), 6), ofv=round(last["ofv"], 4),
                       truth=dict(theta=TRUE_THETA.tolist(), omega=TRUE_OMEGA.tolist(), sigma=TRUE_SIGMA),
                       err_pct=rnd((est / tru - 1) * 100, 2), shrinkage=rnd(shr, 4),
                       realised_sd_true_eta=rnd(np.std(eta_true, axis=0, ddof=1), 4),
                       rse_pct=(rnd(se * 100, 1) if pd else None), hessian_positive_definite=pd,
                       z_vs_truth=(rnd((np.log(est) - np.log(tru)) / se, 2) if pd else None),
                       n_iter=len(st) - 1, nfev_total=out["nfev"], optimiser_success=bool(res.success),
                       termination=str(res.message), max_abs_gradient=round(gnorm, 5), ofv_monotone=monotone,
                       inner_max_abs_grad_at_accepted=float(f"{max(q['inner_gmax'] for q in st):.3g}"),
                       evals_with_unconverged_inner=int(mdl.inner_failures)),
            surface=dict(axes="z[i][j]: i = ln V/F index, j = ln CL/F index; offsets from the final estimate",
                         n=n_g, half_width=half, centre=rnd(xf[0:2], 6), z=np.round(Z, 2).tolist(),
                         held_fixed="ka, omega, sigma at their final values; eta_hat re-optimised at every grid point"),
        )
        runs[name] = dict(model=mdl, x=xf, states=st, ofv=last["ofv"], eta=last["eta"], t=t_arr, y=y_arr)
        print(f"[{name}] iters={len(st)-1} frames={len(keep)} OFV={last['ofv']:.3f} success={res.success} ({res.message}) "
              f"|g|max={gnorm:.2e} monotone={monotone} {time.time()-t0:.0f}s")
        print("   est", np.round(est, 4), "err% ", np.round((est / tru - 1) * 100, 1), "shrink", np.round(shr, 3),
              "RSE%", np.round(se * 100, 1))

    validation, crosscheck = {}, {}
    if not a.no_validation:
        rng = np.random.default_rng(SEED + 1)
        validation["jacobian_vs_finite_difference"] = jacobian_check(rng)
        print("jacobian:", validation["jacobian_vs_finite_difference"])

        # (b) inner problem vs scipy L-BFGS-B (bounded, from a different start); Laplace per subject recomputed independently
        inner_chk = {}
        lap_chk = {}
        for name in runs:
            r = runs[name]; mdl = r["model"]
            th, om, sg = unpack(r["x"])
            lnth = np.log(th)
            worst = 0.0
            worst_o = 0.0
            lap_worst = 0.0
            o_vec, _ = mdl.subject_ofv(r["x"])
            for i in range(0, N_SUBJ, 5):
                def fo(e, i=i):
                    p = th * np.exp(e)
                    f = conc(p[0], p[1], p[2], mdl.t[i])
                    v = float(np.sum(2 * np.log(f) + (mdl.y[i] / f - 1) ** 2 / sg ** 2) + np.sum(e ** 2 / om ** 2))
                    return v if math.isfinite(v) else 1e10
                e0 = np.random.default_rng(SEED + 7 + i).normal(0, 0.4, 3)
                rr = minimize(fo, e0, method="L-BFGS-B", bounds=[(-3, 3)] * 3, options=dict(ftol=1e-15, gtol=1e-10, maxiter=500))
                worst = max(worst, float(np.abs(rr.x - r["eta"][i]).max()))
                worst_o = max(worst_o, abs(rr.fun - fo(r["eta"][i])))
                lap_worst = max(lap_worst, abs(laplace_i(mdl, i, r["x"], r["eta"][i]) - o_vec[i]))
            inner_chk[name] = dict(subjects_checked=len(range(0, N_SUBJ, 5)), max_abs_eta_diff=worst, max_abs_inner_objective_diff=worst_o,
                                   max_abs_ofv_i_diff_vectorised_vs_single_subject=lap_worst)
        validation["inner_problem_vs_scipy_lbfgsb"] = inner_chk
        print("inner:", inner_chk)

        # (c) Laplace vs brute-force integration
        lap_ex = {}
        for name in runs:
            r = runs[name]; mdl = r["model"]
            th, om, sg = unpack(r["x"])
            o_vec, _ = mdl.subject_ofv(r["x"])
            rows = []
            for i in range(N_SUBJ):
                ex = exact_m2ll(mdl.y[i], mdl.t[i], th, om, sg)
                rows.append((i + 1, float(o_vec[i]), ex))
            gaps = np.array([r_[1] - r_[2] for r_ in rows])
            lap_ex[name] = dict(
                at="final estimates of this scenario", n_subjects=N_SUBJ, n_obs_per_subject=int(mdl.m), grid=121, box_sd=6,
                subjects=[dict(id=r_[0], laplace=round(r_[1], 4), exact=round(r_[2], 4), gap=round(r_[1] - r_[2], 4)) for r_ in rows[:10]],
                gap_mean=round(float(gaps.mean()), 4), gap_sd=round(float(gaps.std(ddof=1)), 4),
                gap_min=round(float(gaps.min()), 4), gap_max=round(float(gaps.max()), 4),
                gap_max_abs=round(float(np.abs(gaps).max()), 4), sum_gap=round(float(gaps.sum()), 3),
                sum_laplace=round(float(sum(r_[1] for r_ in rows)), 3), sum_exact=round(float(sum(r_[2] for r_ in rows)), 3))
            print(name, "Laplace-exact gap per subject: mean %.4f sd %.4f range [%.4f, %.4f]; sum gap %.3f of OFV %.2f" % (
                gaps.mean(), gaps.std(ddof=1), gaps.min(), gaps.max(), gaps.sum(), sum(r_[1] for r_ in rows)))
        # same comparison at the (poor) starting values for the rich design: how the gap behaves away from the optimum
        r = runs["rich"]; mdl = r["model"]
        o_vec, _ = mdl.subject_ofv(x0)
        gaps0 = []
        th0, om0, sg0 = unpack(x0)
        for i in range(N_SUBJ):
            gaps0.append(float(o_vec[i]) - exact_m2ll(mdl.y[i], mdl.t[i], th0, om0, sg0))
        gaps0 = np.array(gaps0)
        lap_ex["rich_at_start_values"] = dict(gap_mean=round(float(gaps0.mean()), 4), gap_min=round(float(gaps0.min()), 4),
                                              gap_max=round(float(gaps0.max()), 4), gap_max_abs=round(float(np.abs(gaps0).max()), 4))
        print("rich at start values: gap mean %.3f range [%.3f, %.3f]" % (gaps0.mean(), gaps0.min(), gaps0.max()))
        # quadrature convergence for three subjects
        conv = []
        th, om, sg = unpack(r["x"])
        for i in (0, 1, 2):
            conv.append(dict(subject=i + 1, **{f"n{n}": round(exact_m2ll(mdl.y[i], mdl.t[i], th, om, sg, ngrid=n), 6) for n in (61, 91, 121, 161)}))
        lap_ex["quadrature_convergence_rich"] = conv
        validation["laplace_vs_bruteforce"] = lap_ex
        print("quadrature convergence:", conv)

        # (d) independent starting values
        restarts = {}
        for name in runs:
            r = runs[name]; mdl = r["model"]
            rr_rng = np.random.default_rng(SEED + 100)
            rows = []
            for k in range(4):
                xs = random_start(rr_rng)
                o2 = fit(FoceI(r["t"], r["y"]), xs, record=False)
                res2 = o2["res"]
                mdl2 = FoceI(r["t"], r["y"])
                ofv2 = mdl2.total(res2.x)
                th2, om2, sg2 = unpack(res2.x)
                est2 = np.concatenate([th2, om2, [sg2]])
                est1 = np.concatenate(unpack(r["x"])[0:2] + (np.array([unpack(r["x"])[2]]),))
                rows.append(dict(start=rnd(np.concatenate([np.exp(xs[0:3]), np.exp(xs[3:6]), [math.exp(xs[6])]]), 3),
                                 n_iter=int(res2.nit), success=bool(res2.success), ofv=round(ofv2, 4), d_ofv=round(ofv2 - r["ofv"], 5),
                                 max_rel_diff_pct=round(float(np.max(np.abs(est2 / est1 - 1)) * 100), 3),
                                 ka_gt_ke=bool(th2[2] > th2[0] / th2[1])))
            restarts[name] = dict(main_ofv=round(r["ofv"], 4), runs=rows)
            print(name, "restarts:", [(q["d_ofv"], q["max_rel_diff_pct"], q["n_iter"], q["success"]) for q in rows])
        validation["independent_starts"] = restarts

        # (e) replicate study (new simulated data sets, same estimator, same start values)
        if a.replicates > 0:
            rep = {n: [] for n in runs}
            for k in range(a.replicates):
                eta_k, y_k = simulate(SEED + 1000 + k)
                for name in runs:
                    t_k, yk = design_arrays(y_k, idx[name])
                    m_k = FoceI(t_k, yk)
                    o_k = fit(m_k, x0, record=False)
                    th_k, om_k, sg_k = unpack(o_k["res"].x)
                    rep[name].append(dict(est=np.concatenate([th_k, om_k, [sg_k]]), success=bool(o_k["res"].success), nit=int(o_k["res"].nit)))
                print("replicate", k + 1, "done", flush=True)
            tru = np.concatenate([TRUE_THETA, TRUE_OMEGA, [TRUE_SIGMA]])
            summ = {}
            for name in rep:
                E = np.array([r_["est"] for r_ in rep[name]])
                pct = (E / tru - 1) * 100
                summ[name] = dict(n_replicates=a.replicates, median_err_pct=rnd(np.median(pct, 0), 1),
                                  q25_err_pct=rnd(np.percentile(pct, 25, 0), 1), q75_err_pct=rnd(np.percentile(pct, 75, 0), 1),
                                  n_converged=int(sum(r_["success"] for r_ in rep[name])),
                                  median_n_iter=int(np.median([r_["nit"] for r_ in rep[name]])))
                print(name, "replicates median err%", summ[name]["median_err_pct"], "converged", summ[name]["n_converged"])
            validation["replicate_study"] = dict(order="CL/F, V/F, ka, w_CL, w_V, w_ka, sigma", seed_base=SEED + 1000, results=summ)

        crosscheck = dict(
            nlmixr2=dict(attempted=False, rscript_found=bool(shutil.which("Rscript") or shutil.which("R")),
                         statement="R / nlmixr2 / rxode2 were not installed in the environment that generated this file, so the nlmixr2 FOCEi comparison was NOT run.",
                         how_to_run="python3 tools/nlme_demo.py --csv rich.csv  (columns ID, TIME, DV, AMT, EVID; 100 mg oral dose at time 0) and fit the same model with nlmixr2 est='focei'"),
            fallback="independent brute-force 3-D quadrature of the individual marginal likelihood (validation.laplace_vs_bruteforce) and a scipy L-BFGS-B check of every fifth subject's eta_hat (validation.inner_problem_vs_scipy_lbfgsb)",
            independent_starts="validation.independent_starts (4 random starting-value sets per scenario, same FOCE-I code, different start)",
        )

    # selftest block: Python-computed concentrations for 5 parameter sets
    st_times = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 24.0, 48.0]
    sets = [(4.0, 35.0, 1.1), (8.0, 70.0, 0.4), (1.7, 12.0, 3.2), (4.0, 35.0, 4.0 / 35.0 * (1 + 1e-9)), (25.0, 90.0, 0.35)]
    selftest = dict(tolerance=1e-6, dose=DOSE, times=st_times,
                    cases=[dict(cl=c, v=v, ka=k, conc=[float(f"{q:.12g}") for q in conc(c, v, k, np.array(st_times))]) for c, v, k in sets])

    # data block
    subjects = [dict(id=i + 1, eta_true=rnd(eta_true[i], 5), y=y_rich[i].tolist()) for i in range(N_SUBJ)]
    meta = dict(
        title="NLME explorer demo data (simulated)", generated_by="tools/nlme_demo.py", command=RUN_COMMAND, seed=SEED,
        python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
        runtime_s=round(time.time() - t_start), data_note="Synthetic: 30 virtual subjects simulated with a fixed seed. No patient data.",
        model="one-compartment, first-order absorption, single oral dose; f(t)=D ka/(V(ka-ke))(exp(-ke t)-exp(-ka t)), ke=CL/V; apparent CL/F, V/F",
        error_model="proportional: y = f (1 + sigma*eps); no additive floor was needed (all concentrations are well above zero)",
        estimator="FOCE-I implemented in numpy; inner problem = MAP eta per subject (Newton step with the exact Hessian - first derivatives analytic, their central difference gives the second - "
                  "Fisher-scoring fallback if it is not positive definite, step-halving line search, |grad|<1e-7); Laplace OFV with Gauss-Newton Hessian "
                  "(d var/d eta and second derivatives of f neglected); outer = scipy BFGS on ln(theta), ln(omega), ln(sigma) with central-difference gradient, "
                  "gtol 1e-3, maxiter 400",
        ofv="OFV = sum_i [ m_i ln 2pi + sum_j (ln var_ij + res_ij^2/var_ij) + eta_i' Omega^-1 eta_i + ln|I + Omega J_i' R_i^-1 J_i| ] (constants included, so it is an approximation of -2 ln L)",
        shrinkage="eta-shrinkage_k = 1 - SD(eta_hat_k, n-1)/omega_k",
        param_order=["CL/F (L/h)", "V/F (L)", "ka (1/h)"], dose_mg=DOSE, n_subjects=N_SUBJ, max_frames=MAX_FRAMES,
        sampling_times_rich=T_RICH,
        sampling_note=dict(moderate="5 samples at 0.5, 1.5, 4, 8, 24 h for every subject", sparse="3 samples per subject, staggered: one early (0.25-1.5 h), one mid (2-6 h), one late (8-24 h)",
                           same_draws="all scenarios use the same subjects, the same true etas and the same noise draws; the smaller designs are subsets of the rich one"),
        surface_note="OFV slice over ln CL/F x ln V/F (31 x 31, +-0.6), other parameters fixed at their final values, eta_hat re-optimised at each grid point; values rounded to 2 decimals",
        iteration_note="frames are accepted outer BFGS iterations; iteration 0 = starting values",
    )
    doc = dict(meta=meta, truth=dict(theta=TRUE_THETA.tolist(), omega=TRUE_OMEGA.tolist(), sigma=TRUE_SIGMA),
               start=dict(theta=START_THETA.tolist(), omega=rnd(START_OMEGA, 6), sigma=START_SIGMA),
               dose=DOSE, times_rich=T_RICH, subjects=subjects, scenarios=scen_out,
               selftest=selftest, validation=validation, crosscheck=crosscheck)
    out = os.path.abspath(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as fh:
        json.dump(doc, fh, separators=(",", ":"), allow_nan=False)
    print("wrote", out, os.path.getsize(out), "bytes; total", round(time.time() - t_start), "s")


if __name__ == "__main__":
    main()
