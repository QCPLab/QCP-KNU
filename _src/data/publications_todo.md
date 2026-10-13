# Publication entries that need a human check

Source: Crossref comparison, 2026-10-13. These are listed on the site with the display restrictions documented in tools/make_publications.py; replace with the PI's final list when available.

- #67 (2025, Yakhak Hoeji): Crossref author list has unnamed authors; author line omitted. Add the authors manually.
- #57 (2020, Yakhak Hoeji) `title-variant(check)`: title differs from the Crossref record of the same DOI; confirm it is the same paper
- #55 (2018, Yakhak Hoeji): Crossref author list has unnamed authors; author line omitted. Add the authors manually.
- #42 (2015, Yakhak Hoeji): Crossref author list has unnamed authors; author line omitted. Add the authors manually.
- #42 (2015, Yakhak Hoeji) `title-variant(check)`: title differs from the Crossref record of the same DOI; confirm it is the same paper
- #41 (2014, Oncotarget) `DOI-MISMATCH`: DOI on the old list points to a different paper (Crossref: 'TOPK promotes lung cancer resistance to EGFR tyrosine kinase inhibitors by phosp'); correct the DOI or the title
  - candidate (PubMed, unconfirmed): DOI 10.18632/oncotarget.2507, Oncotarget 5(20):10180-10197 (the list has the DOI of a different paper)
- #39 (2014, Journal of Chromatographic Science) `doi-recovered(check)`: DOI not on the old list; found by title search; confirm before linking
- #35 (2014, Biomedical Chromatography) `recheck(crossref-fetch-failed)`: Crossref lookup failed; re-run the check
  - candidate (PubMed, unconfirmed): PubMed confirms the DOI already on the list (10.1002/bmc.3053), Biomed Chromatogr 28(3):324-326; the 'recheck' was only a failed Crossref fetch
- #27 (2013, Toxicology Letters) `doi-recovered(check)`: DOI not on the old list; found by title search; confirm before linking
- #26 (2012, Journal of Pharmaceutical and Biomedical Analysis) `doi-missing`: no DOI on the old list and none found in Crossref; add DOI or other index link
  - candidate (PubMed, unconfirmed): DOI 10.1016/j.jpba.2012.05.030, J Pharm Biomed Anal 70:587-591
- #25 (2012, Journal of Pharmaceutical and Biomedical Analysis) `doi-missing`: no DOI on the old list and none found in Crossref; add DOI or other index link
  - candidate (PubMed, unconfirmed): DOI 10.1016/j.jpba.2012.01.036, J Pharm Biomed Anal 63:47-52
- #23 (2012, European Journal of Drug Metabolism and Pharmacokinetics) `journal-name-differs`: the journal on the old list differs from the DOI record; the DOI record's journal name is shown
- #18 (2011, Biopharmaceutics & Drug Disposition) `DOI-MISMATCH`: DOI on the old list points to a different paper (Crossref: 'Pharmacokinetic interactions between ciprofloxacin and itraconazole in healthy m'); correct the DOI or the title
  - candidate (PubMed, unconfirmed): DOI 10.1002/bdd.749, Biopharm Drug Dispos 32(3):175-184 (the list has the neighbouring .748)
- #17 (2011, Journal of Pharmaceutical and Biomedical Analysis) `title-variant(check)`: title differs from the Crossref record of the same DOI; confirm it is the same paper
- #13 (2010, Bioorganic & Medicinal Chemistry Letters) `DOI-MISMATCH`: DOI on the old list points to a different paper (Crossref: 'Synthesis of diaryl-azo derivatives as potential antifungal agents'); correct the DOI or the title
  - candidate (PubMed, unconfirmed): DOI 10.1016/j.bmcl.2010.07.018, Bioorg Med Chem Lett 20(17):5130-5132
- #6 (2006, Journal of Pharmacy and Pharmacology) `doi-missing`: no DOI on the old list and none found in Crossref; add DOI or other index link
  - candidate (PubMed, unconfirmed): DOI 10.1211/jpp.58.6.0014, J Pharm Pharmacol 58(6):837-846; full title ends '...the accelerated assessment of the rate of uptake of drugs by the brain in rats'
- #4 (2006, Journal of Chromatography B) `doi-missing`: no DOI on the old list and none found in Crossref; add DOI or other index link
  - candidate (PubMed, unconfirmed): not found in PubMed
