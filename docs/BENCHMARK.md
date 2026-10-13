# Benchmark: research-lab websites (pharmacometrics / clinical pharmacology / PK)

Date of this pass: 2026-10-13. Language: English. Nothing from any site is copied; all text is paraphrased.

## 0. Read this first: what this benchmark does and does not contain

- **Network limit.** In this session WebFetch could resolve only `github.com` and `raw.githubusercontent.com`. Every other host failed with a DNS error (`getaddrinfo ENOTFOUND`), including general sites used as connectivity probes. `web.archive.org` was refused by the tool itself. Details are in section 5.
- **Consequence.** None of the university or lab websites on the candidate list could be opened. The only peer examined first-hand is the Open Systems Pharmacology (OSP) project, through its GitHub organisation page and the Markdown source of its documentation site. Everything else is either carried over from the earlier session or is a search-result pointer.
- **Evidence labels used below.**
  - **[H]** opened this session with WebFetch. WebFetch returns a model-summarised Markdown view of the page, not raw HTML, so HTML-level facts (skip link, `lang`, alt text, page weight) are not checkable even on [H] pages.
  - **[S]** search-result summary only. The page itself was not opened. These items are pointers, not observations.
  - **[C]** carried over from the earlier session, not re-verified.
- **Net result.** 1 project examined first-hand (via GitHub), 0 of the 7 candidate groups opened, plus 4 Korean/other leads that could not be opened.

## 1. Carried over (from earlier session), not re-verified

| Site | URL (as recorded earlier) | Structure and technology (as recorded) | Patterns noted then | Drawbacks noted then | Status |
|---|---|---|---|---|---|
| AMIDD Lab, a KNU pharmacy lab | `terryhjcho.github.io/ddspharm.github.io/` | One HTML file of about 3.7 MB with images embedded; six hash-routed views (Home, People, Research, Publications, Photos, News); dark theme; Inter plus Noto Sans KR from Google Fonts; `noindex` | English heading with Korean gloss; paper list with year chips and search; research cards with small diagrams; People grouped by role incl. alumni; short six-item menu | Dark coral palette; very large single file; external fonts; unfinished template text left visible (hero and equipment placeholders) | Carried over, not re-verified |
| NPC Lab, a KNU pharmacy lab | `heejyang.github.io/NPClab/` | Jekyll "al-folio" theme (Bootstrap, CDN assets); five menu items (about, people, projects, publications, photos) | Selected paper on first screen; very simple menu | CDN CSS and fonts; heavy framework for a small site | Carried over, not re-verified |
| TWIN-EB project, Saarland University clinical pharmacy | `clinical-pharmacy-saarland-university.github.io/twin-eb/` | Hand-built multi-page static site (eight pages incl. Virtual Twins, Team, Publications, For families); self-hosted display font; CSS colour tokens with contrast-aware comments; partner logos | Static multi-page plus tokens; self-hosted fonts; a page for a specific audience; contrast-minded colours | Project site, not a whole-lab site | Carried over, not re-verified |

Note carried over: the user is due to visit the Saarland group; its content and figures must not be reused.

## 2. Opened this session

### 2.1 Open Systems Pharmacology (OSP): GitHub organisation plus documentation source

Entry (all items [H] unless stated):

- **URLs / date / how:** `github.com/Open-Systems-Pharmacology` (organisation page), `.../Suite`, `.../docs`, `.../OSP-PBPK-Model-Library`, and `raw.githubusercontent.com/Open-Systems-Pharmacology/docs/master/SUMMARY.md` and `.../factsheet.md`. Accessed 2026-10-13 by WebFetch (summarised Markdown view). The project's own website and the rendered documentation site could not be opened.
1. **Menu:** the organisation page uses GitHub's own tabs (Overview, Repositories, Projects, Packages, People). The README banner works as a launcher row: latest release, documentation, discussion forum, R package, tutorials, journal publications, model-upload guide, roadmap, developer docs. The documentation source has eight numbered parts plus three unsectioned entries (readme, copyright, how to contribute), up to three levels deep.
2. **How research or software is explained:** concept chapters (PBPK, PK/PD, principles) in the handbook; a fact sheet built from nested bullet lists grouped by model building block, illustrated mainly with software screenshots. No conceptual diagram was reported in what was received.
3. **Process:** a best-practice chapter lists five ordered stages (introduction, model development, model evaluation, application simulation, documentation). Also an "example workflows" page and a task-style drug-interaction how-to. The process is shown as an ordered chapter list, not as a drawn flow (a drawn flow could exist on the unopened pages).
4. **Publications:** the organisation README links to a journal-publications list (target not opened). The handbook ends with one references page. No filters or metrics seen. The model library is about 50 folders named by substance, alphabetical, with no visible metadata (class, version, status).
5. **People:** a "People" block of contributor avatars with a "view all" link; the docs repository has a contributors block. No roles, no alumni seen.
6. **Recruiting / contact:** discussion forum, a how-to-contribute page, contribution guidelines and a code of conduct in the Suite repository, a model-upload guide. Social channels (LinkedIn, X, YouTube) are linked. No job posts seen.
7. **Funders / partners:** the organisation page links one foundation website; the fact sheet states no funder or maintainer. No logo wall seen.
8. **Language:** English only in what was received; no language switch reported.
9. **Technology / weight:** documentation is Markdown in a repository with a summary file and a `.gitbook` folder, so a GitBook-built site is the likely setup (inference, not confirmed). About 140 commits on the docs repository; CI workflow folder present. Weight not measurable.
10. **Accessibility:** not checkable (text view only).
- **Worth borrowing (pattern, not content):** (a) a one-row "start here" launcher on the entry page; (b) a process shown as a short ordered chapter list; (c) each handbook part gets a one-line purpose plus a single go-to link; (d) "how to contribute" as a first-class page; (e) a fact sheet organised by building block, which maps well to a lab's "what we model" page.
- **Avoid:** (a) explaining only with tool screenshots (shows the interface, not the idea); (b) a three-level navigation tree on a small lab site; (c) a model list with no metadata, which cannot be filtered; (d) People as bare avatars without roles; (e) a fact sheet that names no funder or maintainer.

## 3. Attempted but not opened (fetch failed): pointers only

For every row below, **all ten questions are unanswered** because the page was not opened. The last column is what a search-result summary reported (unverified, may be outdated or inconsistent).

| Group | URL surfaced by search | Fetch result (2026-10-13) | Search-reported, unverified |
|---|---|---|---|
| Uppsala University Pharmacometrics Research Group | `www.uu.se/en/department/pharmacy/research/pharmacometrics` (also `.../pharmacometrics/upss`, the summer-school page) | Failed (DNS) on three variants | Group of roughly 40-50 people; a separate summer-school page exists; a spin-off consultancy is mentioned [S] |
| University of Florida, Center for Pharmacometrics and Systems Pharmacology | `pharmacy.ufl.edu/the-college/centers` (college listing); a centre address `cpsp.pharmacy.ufl.edu` was mentioned inside a search summary, not returned as a result link | Failed (DNS) on both | Centre sits inside the college site; two college pages appeared to name different directors, so staff info may be stale on some pages [S] |
| University of Manchester, Centre for Applied Pharmacokinetic Research (CAPKR) | `capkr.manchester.ac.uk`, `sites.manchester.ac.uk/capkr/about/` | Failed (DNS) on both | Academic-industry consortium; blog-style news pages exist; named industry partners are shown as text; an agreement with a regulator is mentioned [S] |
| Monash, Centre for Medicine Use and Safety (Pharmacometrics group) | `www.monash.edu/mips/themes/medicine-safety/about` and group pages under `.../medicine-safety/research-groups/` | Failed (DNS) | The centre menu lists seven groups (Pharmacoepidemiology, Pharmacometrics, Pharmacotherapy, Health services research, Health economics, Deprescribing, Aged care); group pages follow a common template with team and publications sub-pages [S] |
| Leiden, LACDR Systems Pharmacology and Pharmacy | `www.universiteitleiden.nl/en/science/drug-research/research` | Failed (DNS) on two hosts | Division naming differs between pages (older and newer names), which is a reminder to keep one naming scheme [S] |
| UCSF, Bioengineering and Therapeutic Sciences (Savic Lab) | `pharm.ucsf.edu/savic/about`, `bts.ucsf.edu` | Failed (DNS) | Lab pages sit under the school domain; department lists four research areas [S] |
| SNU Hospital, Clinical Pharmacology and Therapeutics | `cpt.snu.ac.kr/en/Introduction/Greeting` | Failed (DNS) | Has an English section and a mobile variant (`/M/en`); research pages list population PK/PD papers [S] |
| SNU College of Pharmacy | `snupharm.snu.ac.kr/en/?p=4859` | Failed (DNS) | Faculty pages with research fields; separate EN path [S] |
| SNU Bundang Hospital, Clinical Pharmacology | `cpt.snubh.org/research/publication__list.html?page=2` | Failed (DNS) | Paginated publication list [S] |
| Jeonbuk National University, clinical pharmacology lab | `sites.google.com/view/jbnu-clin-pharm` | Failed (DNS) | Google Sites page; states topics and says it welcomes applicants [S]. Google Sites is client-rendered, so even with network access a plain fetch may return little (as noted earlier) |
| University of Navarra, Pharmacometrics and Systems Pharmacology (not on the original list) | `www.unav.edu/en/web/pharmacometrics-and-systems-pharmacology/about-us` | Failed (DNS) | Has an "about us" page with a tools list [S] |

## 4. Synthesis: patterns recurring on 3 or more sites

Only one site was opened this session, so no pattern could be re-observed independently on three sites. The rows below reach three or more sites only by adding carried-over observations, and are labelled accordingly.

| Pattern | Seen this session [H] | Seen earlier [C] | Total | Confidence |
|---|---|---|---|---|
| A dedicated People destination | OSP organisation page (avatars, no roles) | AMIDD (by role incl. alumni), NPC (people), TWIN-EB (team) | 4 | Medium: 1 fresh + 3 carried over |
| A dedicated Publications destination | OSP organisation README links to a publications list; handbook has a references page | AMIDD (year chips, search), NPC, TWIN-EB | 4 | Medium: 1 fresh (link only) + 3 carried over |
| Short top-level menu of 5-8 items | none (OSP docs are deeper: counter-example, suited to documentation) | AMIDD 6, NPC 5, TWIN-EB 8 | 3 | Low: carried over only |

Seen on two sites only (below the threshold, so not claimed as a pattern): a "start here" or audience-specific entry (OSP launcher row; TWIN-EB "For families").

## 5. GAPs and limits

- **No candidate group site was opened.** Uppsala, Florida, Manchester, Monash, Leiden, UCSF, the two Korean pharmacy/clinical-pharmacology leads and the OSP project website all failed with DNS errors on every URL tried (about 20 hosts, plus a few general connectivity probes, all failing except GitHub). `web.archive.org` was refused by the tool. A diagnostic command to read the proxy status was denied by the permission classifier and was not retried.
- **Hosts that need to be allowed to repeat this pass:** `www.uu.se`, `pharmacy.ufl.edu`, `cpsp.pharmacy.ufl.edu`, `capkr.manchester.ac.uk`, `sites.manchester.ac.uk`, `www.monash.edu`, `www.universiteitleiden.nl`, `pharm.ucsf.edu`, `bts.ucsf.edu`, `www.open-systems-pharmacology.org`, `docs.open-systems-pharmacology.org`, `cpt.snu.ac.kr`, `snupharm.snu.ac.kr`, `cpt.snubh.org`, `sites.google.com`. (The environment's network setting controls this.)
- **WebFetch is a text view.** Even on pages that opened, skip links, `lang` attributes, alt text, focus styles, fonts and page weight cannot be read. A raw-HTML pass (or a browser audit) is needed for question 10 and question 9 on any site.
- **OSP evidence is indirect.** It comes from GitHub pages and Markdown source, not from the project website. Navigation order inferred from the summary file may differ from the rendered menu. The contents of the publications list, the forum, tutorials and model-upload guide were not opened.
- **JS-rendered sites** (Google Sites leads, and possibly some university templates) may return little to a plain fetch even when the network allows it.
- **Korean coverage is thin.** No Korean lab site was opened; the Korean leads are search pointers. The earlier session covered two KNU pharmacy labs [C], and noted five other KNU pharmacy sites are Google Sites that were not read.
- **Search summaries are not observations.** Section 3 claims may be wrong or out of date and must not be used for design decisions until the pages are opened.
- The synthesis in section 4 is therefore weak. Treat it as a checklist to confirm, not a finding.

## 6. Six design implications for a bilingual (EN/KO) static lab site

Research areas, a 6-step workflow, two interactive explainers. Each item says what supports it; "judgement" means it is a design decision, not a benchmark finding.

1. **Menu and bilingual labelling.** Use six top-level items (Home, Research, Workflow, Publications, People, Join/Contact), each with an English label and a Korean gloss inside a `lang="ko"` span. Serve separate EN and KO page sets with the correct `lang` on `<html>` and cross-links between them; do not hide Korean behind a script-only toggle. Support: English plus Korean headings [C, AMIDD], short menus [C, 3 sites]; no peer opened this session offered a language switch. Judgement for the page-set split.
2. **Workflow as an ordered, linkable sequence.** Present the 6 steps as a real ordered list, each with a number, a one-line purpose and its own anchor, so it reads as a chapter chain like OSP's best-practice stages [H]. Treat any workflow figure as an enhancement with a text equivalent. Judgement for the figure fallback.
3. **Home as a launcher.** Put one row of 5-7 direct links on the home page (the two explainers, workflow, latest papers, join), following the organisation README row in OSP [H] and the audience page in TWIN-EB [C]. Stamp each explainer with a version and date, as OSP highlights release versions [H].
4. **Explainers with a static default.** Each interactive explainer should ship a non-JS default state: figure, a small data table, and a caption stating the data are synthetic. Use native labelled inputs, keyboard operation and reduced-motion respect. No benchmarked site offered interactive explainers, so this is a differentiator; OSP's reliance on tool screenshots [H] shows the gap between showing an interface and teaching a method. Judgement.
5. **Publications, people and partners as data.** Keep papers and people in one data file each, rendered at build time into plain HTML, with year filter and text search added as enhancements (as AMIDD's year chips and search [C]). Give People explicit roles and an alumni group (AMIDD [C]; OSP shows avatars without roles [H], which is the weaker pattern). Show funders and partners as a short text list with links, not a logo wall. Judgement for build-time rendering.
6. **Weight, fonts and accessibility budget.** Static multi-page, one file per page, no base64 images, no CDN; self-host subsetted fonts and give Korean a system-font fallback because full Korean web fonts are large. Support: avoid a 3.7 MB single file [C, AMIDD], self-hosted fonts and contrast-aware tokens [C, TWIN-EB]. Skip link, visible focus, alt text, `lang` and contrast were not verified on any peer this session, so write them as our own requirements and check the built site with an automated audit plus keyboard testing.
