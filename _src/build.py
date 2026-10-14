#!/usr/bin/env python3
"""Static site builder: _src/data/*.yml + _src/templates + _src/i18n  ->  EN pages at / and KO pages at /ko/.

    python _src/build.py            # writes the generated HTML into the repository root (commit the output)
    python _src/build.py --check    # build into memory only and run the content guards

Requires Python >= 3.10, PyYAML, Jinja2. Output is deterministic (no timestamps).
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import posixpath
import re
import sys

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, pass_context, select_autoescape

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent
sys.path.insert(0, str(SRC))
import figures  # noqa: E402  (favicon only)

PAGES = ["home", "research", "methods", "publications", "people", "contact"]
PATHS = {"home": "", "research": "research/", "methods": "methods/", "publications": "publications/",
         "people": "people/", "contact": "contact/", "404": "404.html"}
PAGE_ASSETS = {"methods": {"css": ["nlme-explorer", "dl-explorer"], "js": ["nlme-explorer", "dl-explorer"]},
               "home": {"css": ["research-motion"], "js": ["research-motion"]},
               "research": {"css": ["research-motion"], "js": ["research-motion"]},
               "publications": {"css": [], "js": ["publications"]}}
LINKED = {"ok", "title-variant(check)", "journal-name-differs"}
PI_RE = re.compile(r"(sung[-\u2010-\u2015\s]?hoon\s+ahn|\bs[-\u2010-\u2015.\s]*h\.?\s*ahn)", re.I)

# topic labels for the 'further reading' list, keyed by DOI (references verified against Crossref, docs/REFERENCES.md)
READING = [
    ("10.2307/2532087", {"en": "Nonlinear mixed-effects models (classic)", "ko": "비선형 혼합효과 모형(고전)"}),
    ("10.1038/psp.2013.14", {"en": "Population modeling primer", "ko": "집단 모델링 입문"}),
    ("10.1007/s10928-007-9060-6", {"en": "Estimation methods", "ko": "추정법 유도(NONMEM)"}),
    ("10.1016/j.csda.2004.07.002", {"en": "SAEM estimation", "ko": "SAEM 추정"}),
    ("10.1002/psp4.12134", {"en": "Building a PBPK model", "ko": "PBPK 모형 구축 절차"}),
    ("10.1002/psp4.12049", {"en": "Good modeling practice", "ko": "모형 기반 신약개발 모범 사례"}),
    ("10.1038/323533a0", {"en": "Backpropagation", "ko": "역전파"}),
    ("10.1021/acs.jcim.9b00237", {"en": "Graph neural networks for molecules", "ko": "분자 그래프 신경망"}),
]

# reading-list entries whose author list in refs_verified.json is a shortened one (checked in PubMed / Crossref)
TRUNCATED_AUTHORS = {"10.1002/psp4.12049", "10.1002/psp4.12134", "10.1021/acs.jcim.9b00237"}

# (the tokens are assembled from pieces so that a repository-wide grep for them stays clean)
FORBIDDEN = ["q" + "cp", r"\bTODO\b", r"\blorem ipsum\b", r"준비 중", "google" + "tagmanager", r"fonts\." + "googleapis", "AnSH" + r"\.png", "bk" + "21", r"\[PI"]
ALLOWED_EMAILS: set[str] = set()  # filled by build(): the contact address plus the members whose address is meant to be shown


def load_yaml(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def initials(name: str) -> str:
    parts = [p for p in re.split(r"[\s]+", name.strip()) if p]
    return (parts[0][0] + parts[-1][0]).upper() if len(parts) > 1 else parts[0][:2].upper()


def build() -> dict[str, str]:
    d = {p.stem: load_yaml(p) for p in (SRC / "data").glob("*.yml")}
    site, contact, research = d["site"], d["contact"], d["research"]
    pubs = d["publications"]["publications"]
    for p in pubs:  # uniform keys for the strict templates
        for k in ("authors", "volume", "issue", "page", "doi"):
            p.setdefault(k, None)
    members = d["members"]["members"]
    T = {lang: load_yaml(SRC / "i18n" / f"{lang}.yml") for lang in ("en", "ko")}
    support_items = d["support"].get("items") or []
    news_items = sorted(d["news"].get("items") or [], key=lambda n: n["date"], reverse=True)

    # ---- derived data -----------------------------------------------------------------------
    by_no = {p["no"]: p for p in pubs}
    for a in research["areas"]:
        for n in a["papers"]:
            if not (by_no[n]["status"] in LINKED and by_no[n].get("doi")):
                sys.exit(f"representative paper #{n} must be DOI-linked")
    for n in research["bioanalysis"]["papers"]:
        if not by_no[n].get("doi"):
            sys.exit(f"paper #{n} needs a DOI")
    area_pubs = {a["id"]: [by_no[n] for n in a["papers"]] for a in research["areas"]}
    bio_pubs = [by_no[n] for n in research["bioanalysis"]["papers"]]
    by_year: dict[int, list] = {}
    for p in sorted(pubs, key=lambda p: (-p["year"], -p["no"])):
        by_year.setdefault(p["year"], []).append(p)
    years_desc = sorted(by_year, reverse=True)
    counts = {y: len(v) for y, v in by_year.items()}
    recent = sorted(pubs, key=lambda p: (-p["year"], -p["no"]))[:5]

    show_mail = bool(site["show_member_emails"])
    for m in members:
        m["initials"] = initials(m["name_en"])
        m["email_public"] = m["email"] if (show_mail and m.get("show_email") and m.get("email")) else None
    pi = next(m for m in members if m["role"] == "pi")
    ALLOWED_EMAILS.clear()
    ALLOWED_EMAILS.add(contact["pi_email"].lower())
    ALLOWED_EMAILS.update(m["email_public"].lower() for m in members if m["email_public"])
    groups = [{"role": r, "members": [m for m in members if m["role"] == r]} for r in ("phd", "ms", "alumni")]
    groups = [g for g in groups if g["members"]]
    n_phd = sum(1 for m in members if m["role"] == "phd")
    n_ms = sum(1 for m in members if m["role"] == "ms")

    # launch gate: an indexable site must be approved and free of open PI questions
    if site["indexable"]:
        open_items = [p.name for p in (SRC / "data").glob("*.yml") if "TODO(PI)" in p.read_text(encoding="utf-8")]
        if not site["identity"]["approved_by_pi"] or open_items:
            sys.exit(f"launch gate: indexable=true needs identity.approved_by_pi=true and no TODO(PI) markers (open: {open_items})")

    refs_raw = json.loads((SRC / "data" / "refs_verified.json").read_text(encoding="utf-8"))
    by_doi = {v["doi"]: v for v in refs_raw.values()}
    def ref_authors(doi):
        names = [a.strip() for a in by_doi[doi]["authors"].split(",") if a.strip()]  # an empty first entry = collective author
        return ", ".join(names) + (", et al." if doi in TRUNCATED_AUTHORS else "")

    refs = [{"doi": doi, "topic": topic, "title": html.unescape(by_doi[doi]["title"]),
             "authors": ref_authors(doi), "year": by_doi[doi]["year"], "journal": html.unescape(by_doi[doi]["journal"])}
            for doi, topic in READING]

    # ---- jinja ------------------------------------------------------------------------------
    env = Environment(loader=FileSystemLoader(SRC / "templates"), autoescape=select_autoescape(["html"]),
                      undefined=StrictUndefined, trim_blocks=False, lstrip_blocks=False)

    @pass_context
    def L(ctx, x):
        return x[ctx["lang"]] if isinstance(x, dict) and "en" in x else x

    @pass_context
    def url(ctx, page, lang=None):
        lang = lang or ctx["lang"]
        cur = ctx["page"]["dir"] or "."
        tgt = ("ko/" if lang == "ko" else "") + PATHS[page]
        if page == "404":
            return posixpath.relpath(tgt, cur)
        tdir = tgt.rstrip("/") or "."
        rel = posixpath.relpath(tdir, cur)
        return "./" if rel == "." else rel + "/"

    @pass_context
    def asset(ctx, path):
        return posixpath.relpath("assets/" + path, ctx["page"]["dir"] or ".")

    @pass_context
    def abs_url(ctx, lang):
        if site["site_url"]:
            return site["site_url"].rstrip("/") + "/" + ("ko/" if lang == "ko" else "") + PATHS[ctx["page"]["id"]]
        return url(ctx, ctx["page"]["id"], lang)

    def pub_search(p):
        return " ".join([p["title"], p["journal"], str(p["year"]), *(p.get("authors") or [])]).lower()

    env.globals.update(L=L, url=url, asset=asset, abs_url=abs_url, pub_search=pub_search)
    out: dict[str, str] = {}

    def render(page_id: str, lang: str):
        t = T[lang]
        other = "en" if lang == "ko" else "ko"
        pdir = ("ko/" if lang == "ko" else "") + PATHS[page_id]
        pdir = "" if page_id == "404" else pdir.rstrip("/")
        extra = PAGE_ASSETS.get(page_id, {"css": [], "js": []})
        page = {"id": page_id, "dir": pdir, "alt": page_id != "404", "css": extra["css"], "js": extra["js"]}
        name = site["identity"]["name"][lang]
        if page_id == "home":
            title = f'{name} | {site["identity"]["affiliation"][lang]}'
            desc = t["meta"]["desc"]["home"]
        elif page_id == "404":
            title, desc = f'{t["nf"]["title"]} | {name}', t["nf"]["text"]
        else:
            title = f'{t["nav"][page_id]} | {name}'
            desc = t["meta"]["desc"][page_id]
        ctx = dict(
            t=t, t_en=T["en"], t_ko=T["ko"], lang=lang, other_lang=other, page=page,
            affil=([site["identity"]["college"][lang], site["identity"]["university"][lang]] if lang == "en"
                   else [site["identity"]["university"][lang], site["identity"]["college"][lang]]), title=title, description=desc,
            site=site, contact=contact, research=research, nav=site["nav"],
            year=site["copyright_year"], pi_re=PI_RE,
            pi={"name": pi["name_ko"] if lang == "ko" and pi.get("name_ko") else pi["name_en"],
                "initials": pi["name_ko"][0] if lang == "ko" and pi.get("name_ko") else pi["initials"], "photo": pi.get("photo")},
            n_pubs=len(pubs), year_min=min(counts), year_max=max(counts),
            n_students=n_phd + n_ms, n_phd=n_phd, n_ms=n_ms,
            recent=recent, area_pubs=area_pubs, bio_pubs=bio_pubs, by_year=by_year, years_desc=years_desc,
            groups=groups, refs=[{**r, "topic": r["topic"][lang]} for r in refs], support_items=support_items, news_items=news_items,
        )
        text = env.get_template(f"{page_id}.html").render(**ctx)
        text = nobreak(text)
        if lang == "ko":
            text = re.sub(r"\)(?=[가-힣])", ")\u2060", text)  # no line break between ")" and a following particle
        out[(("ko/" if lang == "ko" else "") + PATHS[page_id] + ("index.html" if page_id != "404" else ""))] = text

    for lang in ("en", "ko"):
        for p in PAGES:
            render(p, lang)
    render("404", "en")
    out["assets/img/favicon.svg"] = figures.favicon()
    if site["indexable"] and site["site_url"]:
        base = site["site_url"].rstrip("/") + "/"
        urls = [base + ("ko/" if l == "ko" else "") + PATHS[p] for l in ("en", "ko") for p in PAGES]
        out["sitemap.xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                              + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    return out


NOBREAK = [re.compile(p) for p in (
    r"LC-MS/MS", r"\(\+82-33-250-6912\)", r"\b[A-Za-z]{1,6}-\d{2,}\b", r"Gangwon-do 24341",
    r"C\(t\) = ka/\(ka – ke\) ·", r"\(exp\(–ke·t\) – exp\(–ka·t\)\)",   # formulas in the figure captions: two parts each, never broken inside
    r"v = Vmax · C /", r"\(Km \(1 \+ \[I\]/Ki\) \+ C\)",
    r"(?:ka|ke|Km|Vmax) = \d[\d.]*(?: h⁻¹)?", r"\[I\]/Ki = \d")]
UNIT_RX = re.compile(r"(?<=\d) (?=(?:h⁻¹|h(?![A-Za-z])|mg(?![A-Za-z])|mg/L|ng/mL|min(?![A-Za-z])|L/h|%))")  # a number and its unit are never split by a line break


def nobreak(page: str) -> str:
    """Keep technical tokens (LC-MS/MS, drug codes, phone numbers) in one piece and bind list separators to the previous word.
    Only text nodes are touched; scripts, styles, SVG and the head are left alone."""
    parts = re.split(r"(<script\b.*?</script>|<style\b.*?</style>|<svg\b.*?</svg>|<head>.*?</head>)", page, flags=re.S)

    def node(m):
        t = m.group(1)
        for rx in NOBREAK:
            t = rx.sub(lambda mm: f'<span class="nb">{mm.group(0)}</span>', t)
        t = UNIT_RX.sub("\u00a0", t)
        t = re.sub(r"(?<![A-Za-z])([AB]), (?=\S)", "\\1,\u00a0", t)  # figure panel letters ("A, ...") stay with the next word
        t = re.sub(r"(?<=\S)·(?=\S)", "\u2060·\u2060", t)  # "A·B": no break before or after the dot
        return ">" + t.replace(" · ", "\u00a0· ") + "<"

    return "".join(p if i % 2 else re.sub(r">([^<>]+)<", node, p) for i, p in enumerate(parts))


def guard(out: dict[str, str]) -> list[str]:
    problems = []
    for path, text in out.items():
        if not path.endswith((".html", ".xml")):
            continue
        body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.S)  # inline helper scripts are ours
        for pat in FORBIDDEN:
            m = re.search(pat, body, re.I)
            if m:
                problems.append(f"{path}: forbidden pattern /{pat}/ at ...{body[max(0, m.start() - 30):m.end() + 30]!r}")
        for m in re.finditer(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", body):
            if m.group(0).lower() not in ALLOWED_EMAILS:
                problems.append(f"{path}: e-mail address not listed in the data files: {m.group(0)}")
        if "{{" in text or "{%" in text:
            problems.append(f"{path}: unrendered template syntax")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="do not write files")
    a = ap.parse_args()
    out = build()
    problems = guard(out)
    for p in problems:
        print("GUARD:", p)
    if problems:
        sys.exit(1)
    if not a.check:
        for rel, text in out.items():
            f = ROOT / rel
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(text, encoding="utf-8", newline="\n")
    print(f"built {len(out)} files{' (dry run)' if a.check else ''}")


if __name__ == "__main__":
    main()
