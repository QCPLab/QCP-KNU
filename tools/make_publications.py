#!/usr/bin/env python3
"""Build _src/data/publications.yml from the Crossref-checked list (_src/data/publications.verified.json).

Display rules:
  ok                      -> full record + DOI link
  title-variant(check)    -> full record + DOI link (DOI came from the old list and resolves to the same journal/year; the title differs); logged in publications_todo.md
  journal-name-differs    -> as above, but the journal name is taken from the DOI record, not from the old list; logged
  doi-recovered(check)    -> full record, NO DOI link (DOI was found by title search, not supplied by the lab); logged
  DOI-MISMATCH            -> title / journal / year as listed only. Authors, volume and pages in the JSON belong to a *different* paper -> never used; NO link; logged
  doi-missing, recheck    -> title / journal / year as listed only; NO link; logged

Run:  python tools/make_publications.py        (needs PyYAML)
"""
import html, json, pathlib, re
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "_src" / "data"
FULL = {"ok", "title-variant(check)", "journal-name-differs", "doi-recovered(check)"}
LINKED = {"ok", "title-variant(check)", "journal-name-differs"}
NOTE = {
    "title-variant(check)": "title differs from the Crossref record of the same DOI; confirm it is the same paper",
    "journal-name-differs": "the journal on the old list differs from the DOI record; the DOI record's journal name is shown",
    "doi-recovered(check)": "DOI not on the old list; found by title search; confirm before linking",
    "DOI-MISMATCH": "DOI on the old list points to a different paper (Crossref: '{cr}'); correct the DOI or the title",
    "doi-missing": "no DOI on the old list and none found in Crossref; add DOI or other index link",
    "recheck(crossref-fetch-failed)": "Crossref lookup failed; re-run the check",
}

def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("&amp;", "&")).strip()


def clean_name(s):
    """author names: unify the Unicode hyphen variants so that search and PI highlighting behave"""
    return re.sub("[\u2010-\u2015]", "-", clean(s))

# Candidate corrections found by a PubMed search on 2026-10-13 (automated review). NOT confirmed by the lab; shown here only
# to speed up the manual check. The site does not use them.
CANDIDATES = {
    13: "DOI 10.1016/j.bmcl.2010.07.018, Bioorg Med Chem Lett 20(17):5130-5132",
    18: "DOI 10.1002/bdd.749, Biopharm Drug Dispos 32(3):175-184 (the list has the neighbouring .748)",
    41: "DOI 10.18632/oncotarget.2507, Oncotarget 5(20):10180-10197 (the list has the DOI of a different paper)",
    25: "DOI 10.1016/j.jpba.2012.01.036, J Pharm Biomed Anal 63:47-52",
    26: "DOI 10.1016/j.jpba.2012.05.030, J Pharm Biomed Anal 70:587-591",
    6: "DOI 10.1211/jpp.58.6.0014, J Pharm Pharmacol 58(6):837-846; full title ends '...the accelerated assessment of the rate of uptake of drugs by the brain in rats'",
    35: "PubMed confirms the DOI already on the list (10.1002/bmc.3053), Biomed Chromatogr 28(3):324-326; the 'recheck' was only a failed Crossref fetch",
    4: "not found in PubMed",
}


def main():
    data = json.loads((SRC / "publications.verified.json").read_text(encoding="utf-8"))
    out, todo = [], []
    overrides = (yaml.safe_load((SRC / "publications_overrides.yml").read_text(encoding="utf-8")) or {}).get("overrides") or {}
    for x in sorted(data, key=lambda r: -r["no"]):
        st = x["status"]
        mine = []  # open points of this record (dropped when an override confirms it)
        journal = clean(html.unescape(x["cr_journal"])) if st == "journal-name-differs" else clean(x["journal"])
        rec = {"no": x["no"], "year": int(x["year"]), "title": clean(x["title"]), "journal": journal}
        if st in FULL:
            names = [clean_name(a) for a in x.get("authors", [])]
            if all(names):                      # a blank name means Crossref lacks (Latin) data for that author -> list would be misleading
                rec["authors"] = names
            else:
                mine.append(f"- #{x['no']} ({x['year']}, {clean(x['journal'])}): Crossref author list has unnamed authors; author line omitted. Add the authors in publications_overrides.yml.")
            for k in ("volume", "issue", "page"):
                if x.get(k):
                    rec[k] = str(x[k])
        if st in LINKED and x.get("doi"):
            rec["doi"] = x["doi"]
        rec["status"] = st
        if x["no"] in overrides:          # confirmed by the lab: replaces the Crossref-derived display data
            rec = {**rec, **overrides[x["no"]], "status": "ok"}
            rec["year"] = int(rec["year"])
            out.append(rec)
            continue
        out.append(rec)
        todo.extend(mine)
        if st != "ok":
            line = f"- #{x['no']} ({x['year']}, {clean(x['journal'])}) `{st}`: " + NOTE[st].format(cr=clean(x.get("cr_title", ""))[:80])
            if x["no"] in CANDIDATES:
                line += f"\n  - candidate (PubMed, unconfirmed): {CANDIDATES[x['no']]}"
            todo.append(line)
    header = "# Generated by tools/make_publications.py from publications.verified.json - do not edit by hand.\n"
    (SRC / "publications.yml").write_text(header + yaml.safe_dump({"publications": out}, allow_unicode=True, sort_keys=False, width=1000), encoding="utf-8")
    (SRC / "publications_todo.md").write_text(
        "# Publication entries that need a human check\n\nSource: Crossref comparison, 2026-10-13. Confirmed corrections go into publications_overrides.yml (then the entry disappears from this list). "
        "These are listed on the site with the display restrictions documented in tools/make_publications.py; replace with the PI's final list when available.\n\n" + "\n".join(todo) + "\n",
        encoding="utf-8")
    print(f"{len(out)} records, {len(todo)} flagged")

if __name__ == "__main__":
    main()
