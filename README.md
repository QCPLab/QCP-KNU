# Laboratory of Pharmaceutical Sciences

Website of the Laboratory of Pharmaceutical Sciences, College of Pharmacy, Kangwon National University.
A static, English-only site for GitHub Pages. No tracking, no external requests at runtime.

> Status: draft for review by the principal investigator. Every generated page is marked `noindex` until the lab
> name, text and members are approved (`_src/data/site.yml` → `indexable`; the builder refuses `indexable: true`
> while `approved_by_pi` is false or any `TODO(PI)` marker is left in the data files).

## Structure

| Path | Content |
|---|---|
| `index.html`, `research/`, `methods/`, `publications/`, `people/`, `contact/`, `404.html` | generated pages |
| `_src/` | source: `data/*.yml` (content), `i18n/en.yml` (interface text), `templates/` (Jinja2), `build.py` |
| `assets/` | `css/`, `js/`, `fonts/pretendard/` (self-hosted, SIL OFL 1.1), `data/` (explainer data), `img/` |
| `tools/` | `make_publications.py`, `nlme_demo.py`, `dl_demo.py` (regenerate explainer data), `qa_check.py` (QA) |
| `docs/` | notes for the two interactive explainers and the reading list |
| `demo/` | the two explainers on their own pages (development pages, `noindex`) |
| `legacy/` | archived copy of the previous single-file site, `noindex`, analytics and members' e-mail addresses removed |

The HTML in the repository root is generated. **Edit `_src/`, rebuild, and commit the output.**
Open the site through a web server (`python -m http.server`), not by double-clicking the files: directory links and the
explainers' data files do not work from `file://`.

## Build

```bash
pip install -r requirements.txt
python _src/build.py            # writes the HTML; fails if a content guard trips
python _src/build.py --check    # dry run
```

The guard fails the build on unresolved `TODO` markers, analytics/font CDNs, legacy branding and on any e-mail address in a
generated page other than `@kangwon.ac.kr`. It scans the generated HTML only.

## Common edits

* **Lab name / switches** – `_src/data/site.yml` (`identity`, `indexable`, `show_member_emails`).
* **Members** – `_src/data/members.yml` (names and roles only; an e-mail is shown only with the member's consent *and* `show_member_emails: true`).
* **Publications** – the list comes from the Crossref-checked `_src/data/publications.verified.json`; run `python tools/make_publications.py`.
  Display rules for unverified entries are documented in that script; open points are in `_src/data/publications_todo.md`.
  Confirmed corrections go into `_src/data/publications_overrides.yml` (then rerun the script).
* **News / funding text** – `news.yml`, `support.yml`; a section appears only when it has entries.

## Quality checks

```bash
pip install -r tools/requirements-generators.txt && playwright install chromium
python tools/qa_check.py --root . --widths 320 360 390 768 1440 --axe node_modules/axe-core/axe.min.js --pages \
  index.html research/index.html methods/index.html publications/index.html people/index.html contact/index.html 404.html
```

Checks horizontal overflow, console errors, external requests (all blocked and reported), missing local files, text clipped
inside figure schematics (none at present) and, with `--axe`, accessibility violations (`npm i axe-core` provides the script).

## Data and honesty

The interactive explainers use **simulated data** (the graph-network example also uses public molecule structures and
RDKit-calculated logP); both are labelled on the page. Publication records were compared with Crossref (2026-10-13);
entries that could not be verified are shown without DOI link or author line. The explainers' generators
(`tools/nlme_demo.py`, `tools/dl_demo.py`) are seeded and log their library versions.
