"""Build-time SVG figures (deterministic, no external requests).

All curves are *synthetic*: one-compartment, first-order absorption, D = 100 mg, CL/F = 4 L/h, V/F = 35 L, ka = 1.1 1/h
(the same "truth" as the NLME explainer). Labels come from the i18n dictionary (t['fig']).
Styling is done in assets/css/site.css via the .fig classes, so the SVGs follow the design tokens.
"""
from __future__ import annotations
import math
import random
from html import escape

D, CL, V, KA = 100.0, 4.0, 35.0, 1.1


def conc(t, cl=CL, v=V, ka=KA, dose=D):
    ke = cl / v
    if abs(ka - ke) < 1e-9:
        return dose / v * ka * t * math.exp(-ke * t)
    return dose * ka / (v * (ka - ke)) * (math.exp(-ke * t) - math.exp(-ka * t))


def _f(x):
    return f"{x:.1f}"


def _path(pts):
    return "M" + " L".join(f"{_f(x)} {_f(y)}" for x, y in pts)


def _nice_max(v):
    for step in (0.5, 1, 2, 2.5, 5):
        top = math.ceil(v / step) * step
        if top / step <= 5:
            return top, step
    return math.ceil(v), 1


class Plot:
    """Tiny linear-axes helper: data coords -> viewBox coords."""

    def __init__(self, w, h, l, r, t, b, x1, y1, x0=0.0, y0=0.0):
        self.w, self.h, self.l, self.r, self.t, self.b = w, h, l, r, t, b
        self.x0, self.x1, self.y0, self.y1 = x0, x1, y0, y1

    def X(self, x):
        return self.l + (x - self.x0) / (self.x1 - self.x0) * (self.w - self.l - self.r)

    def Y(self, y):
        return self.h - self.b - (y - self.y0) / (self.y1 - self.y0) * (self.h - self.t - self.b)

    def curve(self, fn, n=96, xa=None, xb=None):
        xa = self.x0 if xa is None else xa
        xb = self.x1 if xb is None else xb
        return [(self.X(xa + (xb - xa) * i / n), self.Y(fn(xa + (xb - xa) * i / n))) for i in range(n + 1)]

    def axes(self, xticks, yticks, xlabel, ylabel, ytick_fmt="{:g}", grid=True, xtick_fmt="{:g}"):
        o = []
        if grid:
            for y in yticks:
                o.append(f'<line class="grid" x1="{_f(self.l)}" x2="{_f(self.w - self.r)}" y1="{_f(self.Y(y))}" y2="{_f(self.Y(y))}"/>')
        o.append(f'<line class="axis" x1="{_f(self.l)}" x2="{_f(self.w - self.r)}" y1="{_f(self.Y(self.y0))}" y2="{_f(self.Y(self.y0))}"/>')
        o.append(f'<line class="axis" x1="{_f(self.l)}" x2="{_f(self.l)}" y1="{_f(self.Y(self.y0))}" y2="{_f(self.Y(self.y1))}"/>')
        for x in xticks:
            o.append(f'<line class="tick" x1="{_f(self.X(x))}" x2="{_f(self.X(x))}" y1="{_f(self.Y(self.y0))}" y2="{_f(self.Y(self.y0) + 5)}"/>')
            o.append(f'<text class="tl" x="{_f(self.X(x))}" y="{_f(self.Y(self.y0) + 20)}" text-anchor="middle">{xtick_fmt.format(x)}</text>')
        for y in yticks:
            o.append(f'<text class="tl" x="{_f(self.l - 9)}" y="{_f(self.Y(y) + 4.5)}" text-anchor="end">{ytick_fmt.format(y)}</text>')
        o.append(f'<text class="al" x="{_f((self.l + self.w - self.r) / 2)}" y="{_f(self.h - 6)}" text-anchor="middle">{escape(xlabel)}</text>')
        if ylabel:
            cy = (self.t + self.h - self.b) / 2
            o.append(f'<text class="al" transform="translate(14 {_f(cy)}) rotate(-90)" text-anchor="middle">{escape(ylabel)}</text>')
        return "".join(o)


def _svg(viewbox, body, label, cls="fig", desc=""):
    d = f"<desc>{escape(desc)}</desc>" if desc else ""
    return (f'<svg class="{cls}" viewBox="{viewbox}" role="img" aria-label="{escape(label)}" focusable="false">'
            f'<title>{escape(label)}</title>{d}{body}</svg>')


# ---------------------------------------------------------------- hero
def hero(t):
    f = t["fig"]
    rnd = random.Random(7)
    P = Plot(480, 360, 58, 14, 34, 62, 24, 4.0)
    subs = []
    for _ in range(9):
        cl = CL * math.exp(rnd.gauss(0, 0.30))
        v = V * math.exp(rnd.gauss(0, 0.25))
        ka = KA * math.exp(rnd.gauss(0, 0.50))
        subs.append((cl, v, ka))
    top = max(conc(0.25 * i, *s) for s in subs for i in range(1, 97))
    ymax, step = _nice_max(top * 1.08)
    P.y1 = ymax
    yt = [round(i * step, 2) for i in range(int(round(ymax / step)) + 1)]
    out = [P.axes([0, 4, 8, 12, 16, 20, 24], yt, f["time"], f["conc"])]
    pop = P.curve(conc)
    area = pop + [(P.X(24), P.Y(0)), (P.X(0), P.Y(0))]
    out.append(f'<path class="area" d="{_path(area)}Z"/>')
    for s in subs:
        out.append(f'<path class="sub" d="{_path(P.curve(lambda x, s=s: conc(x, *s)))}"/>')
    # one example subject with noisy observations
    ex = subs[3]
    out.append(f'<path class="ex" d="{_path(P.curve(lambda x: conc(x, *ex)))}"/>')
    for tt in (0.5, 1, 2, 3, 5, 8, 12, 24):
        y = conc(tt, *ex) * math.exp(rnd.gauss(0, 0.15))
        out.append(f'<circle class="obs" cx="{_f(P.X(tt))}" cy="{_f(P.Y(y))}" r="4.2"/>')
    out.append(f'<path class="popline" d="{_path(pop)}"/>')
    # Cmax / tmax guides
    ke = CL / V
    tmax = math.log(KA / ke) / (KA - ke)
    cmax = conc(tmax)
    out.append(f'<line class="guide" x1="{_f(P.X(tmax))}" x2="{_f(P.X(tmax))}" y1="{_f(P.Y(cmax))}" y2="{_f(P.Y(0))}"/>')
    out.append(f'<line class="guide" x1="{_f(P.l)}" x2="{_f(P.X(tmax))}" y1="{_f(P.Y(cmax))}" y2="{_f(P.Y(cmax))}"/>')
    out.append(f'<circle class="pk" cx="{_f(P.X(tmax))}" cy="{_f(P.Y(cmax))}" r="5"/>')
    out.append(f'<text class="an" x="{_f(P.X(tmax) + 12)}" y="{_f(P.Y(cmax) - 10)}">C<tspan class="sb" dy="3">max</tspan></text>')
    out.append(f'<text class="an" x="{_f(P.X(tmax) + 6)}" y="{_f(P.Y(0) - 8)}">t<tspan class="sb" dy="3">max</tspan></text>')
    # legend (top right, where curves are low)
    lx, ly = P.X(10.5), P.t + 4
    out.append(f'<g transform="translate({_f(lx)} {_f(ly)})">'
               f'<line class="popline" x1="0" x2="26" y1="8" y2="8"/><text class="lg" x="34" y="12.5">{escape(f["typical"])}</text>'
               f'<line class="sub lgs" x1="0" x2="26" y1="31" y2="31"/><text class="lg" x="34" y="35.5">{escape(f["virtual"])}</text>'
               f'<circle class="obs" cx="13" cy="54" r="4.2"/><text class="lg" x="34" y="58.5">{escape(f["observed"])}</text></g>')
    return _svg("0 0 480 360", "".join(out), f["hero_alt"], "fig fig-hero", f["hero_desc"].format(cmax=f"{cmax:.1f}", tmax=f"{tmax:.1f}"))


# ---------------------------------------------------------------- publication histogram
def histogram(t, counts: dict[int, int], accent_years=None):
    f = t["fig"]
    y0, y1 = min(counts), max(counts)
    years = list(range(y0, y1 + 1))
    W, H, L, R, T, B = 480, 150, 28, 8, 16, 30
    cmax = max(counts.values())
    top = max(4, cmax + (cmax % 2))
    plot_w = W - L - R
    bw = plot_w / len(years)
    out = []
    for g in range(0, top + 1, 2):
        y = H - B - g / top * (H - T - B)
        out.append(f'<line class="grid" x1="{L}" x2="{W - R}" y1="{_f(y)}" y2="{_f(y)}"/>')
        out.append(f'<text class="tl" x="{L - 6}" y="{_f(y + 4.5)}" text-anchor="end">{g}</text>')
    out.append(f'<line class="axis" x1="{L}" x2="{W - R}" y1="{H - B}" y2="{H - B}"/>')
    for i, yr in enumerate(years):
        n = counts.get(yr, 0)
        x = L + i * bw + bw * 0.18
        hh = n / top * (H - T - B)
        if n:
            out.append(f'<rect class="bar" x="{_f(x)}" y="{_f(H - B - hh)}" width="{_f(bw * 0.64)}" height="{_f(hh)}" rx="2"><title>{yr}: {n}</title></rect>')
    for yr in sorted({y0, y1} | {y for y in years if y % 5 == 0 and y - y0 >= 3 and y1 - y >= 3}):
        cx = L + (yr - y0) * bw + bw / 2
        out.append(f'<text class="tl" x="{_f(cx)}" y="{H - B + 18}" text-anchor="middle">{yr}</text>')
    out.append(f'<text class="al" x="{L}" y="10" text-anchor="start">{escape(f["pubs_per_year"])}</text>')
    return _svg(f"0 0 {W} {H}", "".join(out), f["hist_alt"].format(n=sum(counts.values()), a=y0, b=y1), "fig fig-hist")


# ---------------------------------------------------------------- process schematics (viewBox 400x230)
def _box(x, y, w, h, label, cls="box", sub=None):
    s = (f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="9"/>'
         f'<text class="bt" x="{x + w / 2}" y="{y + h / 2 + (-2 if sub else 4.5)}" text-anchor="middle">{escape(label)}</text>')
    if sub:
        s += f'<text class="bs" x="{x + w / 2}" y="{y + h / 2 + 15}" text-anchor="middle">{escape(sub)}</text>'
    return s


def _arrow(x1, y1, x2, y2):
    ang = math.atan2(y2 - y1, x2 - x1)
    hx, hy = 8 * math.cos(ang), 8 * math.sin(ang)
    px, py = -4 * math.sin(ang), 4 * math.cos(ang)
    return (f'<line class="arr" x1="{_f(x1)}" y1="{_f(y1)}" x2="{_f(x2 - hx * 0.6)}" y2="{_f(y2 - hy * 0.6)}"/>'
            f'<path class="arrh" d="M{_f(x2)} {_f(y2)} L{_f(x2 - hx + px)} {_f(y2 - hy + py)} L{_f(x2 - hx - px)} {_f(y2 - hy - py)}Z"/>')


def step_design(t):
    f = t["fig"]
    P = Plot(400, 230, 30, 22, 60, 64, 24, 1)
    o = [f'<line class="axis" x1="{P.l}" x2="{400 - P.r}" y1="150" y2="150"/>']
    for x in (0, 4, 8, 12, 16, 20, 24):
        o.append(f'<line class="tick" x1="{_f(P.X(x))}" x2="{_f(P.X(x))}" y1="150" y2="155"/><text class="tl" x="{_f(P.X(x))}" y="171" text-anchor="middle">{x}</text>')
    o.append(f'<text class="al" x="{_f((P.l + 400 - P.r) / 2)}" y="198" text-anchor="middle">{escape(f["time"])}</text>')
    # dose arrow
    o.append(f'<line class="dose" x1="{_f(P.X(0))}" x2="{_f(P.X(0))}" y1="58" y2="146"/><path class="doseh" d="M{_f(P.X(0))} 150 l-6 -11 h12Z"/>')
    o.append(f'<text class="an" x="{_f(P.X(0) + 9)}" y="72">{escape(f["dose"])}</text>')
    for x in (0.25, 0.5, 1, 2, 4, 8, 12, 24):
        o.append(f'<circle class="sam" cx="{_f(P.X(x))}" cy="150" r="5.2"/>')
    o.append(f'<text class="an" x="{_f(P.X(12))}" y="124" text-anchor="middle">{escape(f["sampling"])}</text>')
    o.append(f'<path class="brk" d="M{_f(P.X(0.25))} 134 V138 H{_f(P.X(24))} V134"/>')
    return _svg("0 0 400 230", "".join(o), f["s_design_alt"], "fig fig-step")


def step_experiment(t):
    f = t["fig"]
    o = []
    o.append(f'<text class="al" x="100" y="26" text-anchor="middle">{escape(f["invitro"])}</text><text class="al" x="300" y="26" text-anchor="middle">{escape(f["invivo"])}</text>')
    o.append(f'<line class="grid" x1="200" x2="200" y1="38" y2="206"/>')
    o.append(_box(14, 48, 172, 38, f["cells"], "box soft"))
    o.append(_arrow(100, 88, 100, 112)); o.append(_box(14, 114, 172, 38, f["incubate"]))
    o.append(_arrow(100, 154, 100, 178)); o.append(_box(14, 180, 172, 38, f["assay"], "box acc"))
    o.append(_box(214, 48, 172, 38, f["dosing"], "box soft"))
    o.append(_arrow(300, 88, 300, 112)); o.append(_box(214, 114, 172, 38, f["blood"]))
    o.append(_arrow(300, 154, 300, 178)); o.append(_box(214, 180, 172, 38, f["plasma"], "box acc"))
    return _svg("0 0 400 230", "".join(o), f["s_experiment_alt"], "fig fig-step")


def step_bioanalysis(t):
    f = t["fig"]
    P = Plot(400, 230, 34, 18, 40, 62, 6, 1.0)
    rnd = random.Random(11)

    def sig(x):
        g = lambda mu, sd, h: h * math.exp(-0.5 * ((x - mu) / sd) ** 2)
        return 0.02 + g(2.1, 0.11, 0.92) + g(3.6, 0.13, 0.62) + 0.006 * math.sin(x * 37)
    o = [f'<line class="axis" x1="{P.l}" x2="{400 - P.r}" y1="{_f(P.Y(0))}" y2="{_f(P.Y(0))}"/>']
    for x in (0, 1, 2, 3, 4, 5, 6):
        o.append(f'<line class="tick" x1="{_f(P.X(x))}" x2="{_f(P.X(x))}" y1="{_f(P.Y(0))}" y2="{_f(P.Y(0) + 5)}"/><text class="tl" x="{_f(P.X(x))}" y="{_f(P.Y(0) + 20)}" text-anchor="middle">{x}</text>')
    o.append(f'<text class="al" x="{_f((P.l + 400 - P.r) / 2)}" y="204" text-anchor="middle">{escape(f["rt"])}</text>')
    o.append(f'<text class="al" transform="translate(12 {_f((P.Y(0) + P.Y(1)) / 2)}) rotate(-90)" text-anchor="middle">{escape(f["signal"])}</text>')
    o.append(f'<path class="chrom" d="{_path(P.curve(sig, 220))}"/>')
    o.append(f'<text class="an" x="{_f(P.X(2.1))}" y="{_f(P.Y(0.92) - 9)}" text-anchor="middle">{escape(f["analyte"])}</text>')
    o.append(f'<text class="an alt" x="{_f(P.X(3.6))}" y="{_f(P.Y(0.62) - 9)}" text-anchor="middle">{escape(f["istd"])}</text>')
    return _svg("0 0 400 230", "".join(o), f["s_bioanalysis_alt"], "fig fig-step")


def step_pkanalysis(t):
    f = t["fig"]
    P = Plot(400, 230, 40, 18, 28, 62, 24, 2.5)
    ke = CL / V
    tmax = math.log(KA / ke) / (KA - ke)
    cmax = conc(tmax)
    o = [P.axes([0, 6, 12, 18, 24], [0, 1, 2], f["time"], f["conc"])]
    pop = P.curve(conc)
    o.append(f'<path class="area" d="{_path(pop + [(P.X(24), P.Y(0)), (P.X(0), P.Y(0))])}Z"/>')
    o.append(f'<path class="popline" d="{_path(pop)}"/>')
    o.append(f'<line class="guide" x1="{_f(P.X(tmax))}" x2="{_f(P.X(tmax))}" y1="{_f(P.Y(cmax))}" y2="{_f(P.Y(0))}"/>')
    o.append(f'<circle class="pk" cx="{_f(P.X(tmax))}" cy="{_f(P.Y(cmax))}" r="4.6"/>')
    o.append(f'<text class="an" x="{_f(P.X(tmax) + 10)}" y="{_f(P.Y(cmax) - 8)}">C<tspan class="sb" dy="3">max</tspan></text>')
    o.append(f'<text class="an" x="{_f(P.X(8.5))}" y="{_f(P.Y(0.62))}">AUC</text>')
    # terminal half-life marker
    t1 = 14.0
    c1 = conc(t1)
    o.append(f'<line class="guide" x1="{_f(P.X(t1))}" x2="{_f(P.X(t1 + math.log(2) / ke))}" y1="{_f(P.Y(c1))}" y2="{_f(P.Y(c1))}"/>')
    return _svg("0 0 400 230", "".join(o), f["s_pkanalysis_alt"], "fig fig-step")


def step_modeling(t):
    f = t["fig"]
    o = [_box(26, 84, 104, 56, f["gut"], "box soft", f["dose_in"]),
         _box(224, 84, 164, 56, f["central"], "box acc", "V/F"),
         _arrow(130, 112, 224, 112),
         _arrow(306, 142, 306, 196)]
    o.append(f'<text class="an" x="177" y="102" text-anchor="middle">ka</text>')
    o.append(f'<text class="an" x="320" y="176">CL/F</text>')
    o.append(f'<text class="bs" x="177" y="132" text-anchor="middle">{escape(f["absorption"])}</text>')
    o.append(f'<text class="bs" x="306" y="214" text-anchor="middle">{escape(f["elimination"])}</text>')
    o.append(f'<text class="al" x="200" y="40" text-anchor="middle">{escape(f["bsv"])}</text>')
    o.append(f'<path class="brk" d="M30 52 V48 H370 V52"/>')
    return _svg("0 0 400 230", "".join(o), f["s_modeling_alt"], "fig fig-step")


def step_translate(t):
    f = t["fig"]
    P = Plot(400, 230, 40, 18, 24, 62, 24, 4.0)
    o = [P.axes([0, 6, 12, 18, 24], [0, 1, 2, 3, 4], f["time"], f["conc"])]
    lo, hi = 1.0, 2.6
    o.append(f'<rect class="band" x="{_f(P.l)}" y="{_f(P.Y(hi))}" width="{_f(400 - P.r - P.l)}" height="{_f(P.Y(lo) - P.Y(hi))}"/>')
    o.append(f'<text class="bs" x="{_f(400 - P.r - 6)}" y="{_f(P.Y(hi) + 15)}" text-anchor="end">{escape(f["target"])}</text>')
    o.append(f'<path class="sub2" d="{_path(P.curve(lambda x: conc(x, cl=CL * 1.9)))}"/>')
    o.append(f'<path class="popline" d="{_path(P.curve(lambda x: conc(x, dose=D * 1.6, cl=CL * 1.9)))}"/>')
    o.append(f'<text class="an" x="{_f(P.X(11))}" y="{_f(P.Y(1.9) - 36)}">{escape(f["adjusted"])}</text>')
    o.append(f'<text class="an alt" x="{_f(P.X(11.5))}" y="{_f(P.Y(0.5) - 2)}">{escape(f["standard"])}</text>')
    return _svg("0 0 400 230", "".join(o), f["s_translate_alt"], "fig fig-step")


STEP_FIGS = {"design": step_design, "experiment": step_experiment, "bioanalysis": step_bioanalysis,
             "pkanalysis": step_pkanalysis, "modeling": step_modeling, "translate": step_translate}


# ---------------------------------------------------------------- widget teasers (decorative, aria-hidden)
def teaser_nlme():
    rnd = random.Random(3)
    o = []
    cx, cy = 196, 88
    for k, (rx, ry) in enumerate([(112, 58), (86, 44), (62, 31), (38, 19), (16, 8)]):
        o.append(f'<ellipse class="cont" cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate(-18 {cx} {cy})" style="opacity:{0.35 + k * 0.12:.2f}"/>')
    pts = [(52, 146)]
    for i in range(1, 9):
        a = i / 8
        pts.append((52 + (cx - 52) * (1 - (1 - a) ** 1.7) + rnd.gauss(0, 3), 146 + (cy - 146) * a ** 0.8 + rnd.gauss(0, 2)))
    pts[-1] = (cx + 2, cy + 1)
    o.append(f'<path class="trace" d="{_path(pts)}"/>')
    for i, (x, y) in enumerate(pts):
        o.append(f'<circle class="{"tp end" if i == len(pts) - 1 else "tp"}" cx="{_f(x)}" cy="{_f(y)}" r="{4.5 if i == len(pts) - 1 else 3.2}"/>')
    return f'<svg class="teaser" viewBox="0 0 320 180" aria-hidden="true" focusable="false">{"".join(o)}</svg>'


def teaser_dl():
    layers = [5, 8, 6, 1]
    xs = [48, 125, 205, 280]
    o, pos = [], []
    for li, n in enumerate(layers):
        top = 90 - (n - 1) * 11.5
        pos.append([(xs[li], top + 23 * j) for j in range(n)])
    rnd = random.Random(5)
    for li in range(len(layers) - 1):
        for a in pos[li]:
            for b in pos[li + 1]:
                w = rnd.random()
                o.append(f'<line class="{"e1" if w > 0.5 else "e2"}" x1="{_f(a[0])}" y1="{_f(a[1])}" x2="{_f(b[0])}" y2="{_f(b[1])}" style="stroke-width:{0.5 + w * 1.6:.1f}"/>')
    for li, layer in enumerate(pos):
        for (x, y) in layer:
            r = 7 if li != 3 else 9
            o.append(f'<circle class="nd0" cx="{_f(x)}" cy="{_f(y)}" r="{r}"/>')
            o.append(f'<circle class="nd" cx="{_f(x)}" cy="{_f(y)}" r="{r}" style="fill-opacity:{0.3 + rnd.random() * 0.7:.2f}"/>')
    return f'<svg class="teaser" viewBox="0 0 320 180" aria-hidden="true" focusable="false">{"".join(o)}</svg>'


# ---------------------------------------------------------------- favicon (plain curve glyph, not a logo)
def favicon():
    P = Plot(32, 32, 6, 5, 6, 6, 24, 2.3)
    d = _path(P.curve(conc, 40))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0a7d77"/>'
            f'<path d="{d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
