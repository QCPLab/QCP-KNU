#!/usr/bin/env python3
"""Portable QA for a static site (no external services).

Serves ROOT on 127.0.0.1, opens each page at several viewport widths with Playwright, ABORTS every non-local request,
and reports: horizontal overflow, console errors/warnings, blocked (external) requests, failed local requests (404),
optional axe-core violations, and missing local link/asset targets found in the HTML. Saves full-page screenshots.

  pip install playwright && playwright install chromium        # or: --chrome-path /usr/bin/google-chrome
  npm i axe-core   (optional)  ->  --axe node_modules/axe-core/axe.min.js
  python tools/qa_check.py --root . --pages index.html ko/index.html publications/index.html \
         --widths 390 768 1440 --out qa_out [--axe PATH] [--reduced-motion]

Exit status 1 when any page shows horizontal overflow, console errors, external requests, failed local requests or
missing link targets (axe findings are printed; 'serious'/'critical' also fail).
"""
import argparse, functools, json, os, re, sys, threading
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urldefrag, urljoin, urlparse

ap = argparse.ArgumentParser()
ap.add_argument("--root", default="."); ap.add_argument("--pages", nargs="+", default=["index.html"])
ap.add_argument("--widths", nargs="+", type=int, default=[390, 768, 1440]); ap.add_argument("--height", type=int, default=900)
ap.add_argument("--out", default="qa_out"); ap.add_argument("--axe", default=""); ap.add_argument("--wait", type=int, default=700)
ap.add_argument("--chrome-path", default=os.environ.get("CHROME_PATH", "")); ap.add_argument("--reduced-motion", action="store_true")
ap.add_argument("--no-shots", action="store_true")
a = ap.parse_args()
root = os.path.abspath(a.root); os.makedirs(a.out, exist_ok=True)

class Refs(HTMLParser):
    def __init__(s): super().__init__(); s.refs = []
    def handle_starttag(s, tag, attrs):
        d = dict(attrs)
        for k in ("href", "src", "poster"):
            if d.get(k): s.refs.append(d[k])
        if d.get("srcset"):
            s.refs += [p.strip().split()[0] for p in d["srcset"].split(",") if p.strip()]

def missing_targets(page):
    p = Refs(); path = os.path.join(root, page)
    p.feed(open(path, encoding="utf-8").read()); out = []
    for r in p.refs:
        r, _ = urldefrag(r.strip())
        if not r or r.startswith(("http:", "https:", "mailto:", "tel:", "data:", "javascript:", "//")): continue
        t = os.path.normpath(os.path.join(os.path.dirname(path), unquote(urlparse(r).path)))
        if os.path.isdir(t): t = os.path.join(t, "index.html")
        if not os.path.exists(t): out.append(r)
    return out

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=root))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"

from playwright.sync_api import sync_playwright
fails = 0
with sync_playwright() as p:
    kw = {"executable_path": a.chrome_path} if a.chrome_path else {}
    b = p.chromium.launch(args=["--no-sandbox"], **kw)
    for page in a.pages:
        miss = missing_targets(page)
        if miss: fails += 1
        print(f"\n## {page}  missing local targets: {miss[:8] if miss else 'none'}")
        for w in a.widths:
            ctx = b.new_context(viewport={"width": w, "height": a.height}, reduced_motion="reduce" if a.reduced_motion else "no-preference")
            blocked, errors, bad = [], [], []
            def gate(route):
                u = route.request.url
                if u.startswith((base, "data:", "blob:")): route.continue_()
                else: blocked.append(u); route.abort()
            ctx.route("**/*", gate)
            pg = ctx.new_page()
            pg.on("console", lambda m: errors.append(f"[{m.type}] {m.text[:140]}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: errors.append(f"[pageerror] {str(e)[:140]}"))
            pg.on("response", lambda r: bad.append(f"{r.status} {r.url[len(base):]}") if r.url.startswith(base) and r.status >= 400 else None)
            pg.goto(base + page, wait_until="load", timeout=30000); pg.wait_for_timeout(a.wait)
            H = pg.evaluate("document.documentElement.scrollHeight")
            for y in range(0, H, 500): pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(40)
            pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(200)
            d = pg.evaluate("({sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})")
            over = d["sw"] > w + 1
            # elements wider than the viewport (first 3), helps locate overflow
            culprits = pg.evaluate("(w)=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>w+1).slice(0,3).map(e=>e.tagName.toLowerCase()+'.'+String(e.className).slice(0,30))", w) if over else []
            row = f"  w={w:<5} h={d['sh']:<6} overflow={'YES '+str(culprits) if over else 'no'}  console={len(errors)}  external={len(set(blocked))}  failed-local={len(bad)}"
            if a.axe:
                pg.add_script_tag(path=a.axe)
                v = pg.evaluate("axe.run(document,{resultTypes:['violations']}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length})))")
                sev = [x for x in v if x["impact"] in ("serious", "critical")]
                row += f"  axe={len(v)} (serious/critical {len(sev)})"
                if v: row += "\n      axe: " + ", ".join(f"{x['id']}[{x['impact']}]x{x['n']}" for x in v[:8])
                if sev: fails += 1
            print(row)
            for e in errors[:4]: print("      ", e)
            for u in sorted(set(blocked))[:4]: print("       blocked:", u)
            for u in bad[:4]: print("       failed:", u)
            if over or errors or blocked or bad: fails += 1
            if not a.no_shots:
                pg.screenshot(path=os.path.join(a.out, re.sub(r"[^A-Za-z0-9]+", "_", page).strip("_") + f"_{w}.png"), full_page=True)
            ctx.close()
    b.close()
print("\nRESULT:", "FAIL" if fails else "PASS", f"({fails} problem group(s))")
sys.exit(1 if fails else 0)
