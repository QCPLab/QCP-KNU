# Laboratory of Pharmaceutical Sciences · 약제학 연구실

Website of the Laboratory of Pharmaceutical Sciences, College of Pharmacy, Kangwon National University.
A static, bilingual (English `/`, Korean `/ko/`) site for GitHub Pages. No tracking, no external requests at runtime.

> Status: draft for review by the principal investigator. The site is marked `noindex` until the lab name, text and
> images are approved (`_src/data/site.yml` → `indexable`).

## Structure

| Path | Content |
|---|---|
| `index.html`, `research/`, `methods/`, `publications/`, `people/`, `contact/`, `404.html` | generated English pages |
| `ko/…` | generated Korean pages |
| `_src/` | source: `data/*.yml` (content), `i18n/{en,ko}.yml` (interface text), `templates/` (Jinja2), `figures.py`, `build.py` |
| `assets/` | `css/`, `js/`, `fonts/pretendard/` (self-hosted, SIL OFL 1.1), `data/` (explainer data), `img/` |
| `tools/` | `make_publications.py`, `nlme_demo.py`, `dl_demo.py` (regenerate explainer data), `qa_check.py` (QA) |
| `docs/` | notes for the two interactive explainers and the reading list |
| `legacy/` | the previous single-file site, kept for reference (`noindex`) |

The HTML in the repository root is generated. **Edit `_src/`, then rebuild and commit the output.**

## Build

```bash
pip install pyyaml jinja2
python _src/build.py            # writes the HTML; fails if a content guard trips
python _src/build.py --check    # dry run
```

The guard rejects unresolved placeholders, personal e-mail domains, analytics/font CDNs and legacy branding in generated pages.

## Common edits

* **Lab name / switches** – `_src/data/site.yml` (`identity`, `indexable`, `show_logos`, `show_member_emails`).
* **Members** – `_src/data/members.yml` (names and roles only; an e-mail is shown only with the member's consent *and* `show_member_emails: true`).
* **Publications** – edit the source list, then `python tools/make_publications.py` (display rules for unverified entries are in that script; open points are in `_src/data/publications_todo.md`).
* **News / funding text** – `news.yml`, `support.yml`; a section appears only when it has entries.
* **Korean text** – `_src/i18n/ko.yml` and the `ko:` fields in `_src/data/*.yml`. It is a draft for review.

## Quality checks

```bash
pip install playwright && playwright install chromium
python tools/qa_check.py --root . --pages index.html ko/index.html research/index.html methods/index.html \
       publications/index.html people/index.html contact/index.html --widths 390 768 1440
```

Checks horizontal overflow, console errors, external requests (all blocked and reported), missing local files and,
with `--axe`, accessibility violations.

## Data and honesty

Figures and interactive explainers use **synthetic data**, labelled as such on the page. Publication records were compared
with Crossref (2026-10-13); entries that could not be verified are shown without DOI link or author line.
