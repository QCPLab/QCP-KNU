# Publication census (2026-10-14)

Every record of the publication list (69 old records and the 4 papers of the lab's own list that were new) was compared field by field with an
independent bibliographic record: title, authors, journal, year, volume, issue, pages and DOI. Method: one verifier per chunk of records looked
the paper up in PubMed (DOI to PMID, citation matcher, title search) and compared the fields; every record with a difference, an unconfirmed
author or a new record was then checked again by a second verifier that was told to refute the first one and to use a different route
(publisher page, Consensus, web search). The lab's own list (KNU_PK_Lab_Intro v10, 27 papers, 2015-2026) was reconciled with the site list by title.

## Result

* Of the 69 old records, 29 are identical to the source record and 20 differ only in capitalisation, punctuation, hyphens, diacritics or Greek-letter spelling (kept). Two more flagged titles were false alarms of PubMed (#66, #59).
* 4 titles on the site were not the published titles and were replaced (#57, #55, #42, #17); 3 more titles lacked words or the compound name and were completed (#35, #25, #6).
* 3 DOIs on the old list belonged to other papers (#41, #18, #13) and were replaced. DOI, authors, volume and pages were missing and were added from PubMed for #26, #4, #35, #25 and #6; #39 got its DOI and issue.
* #27: the old list pointed to a conference-abstract DOI; the full paper with the identical title (PMID 23137660) lists Sung-Hoon Ahn and is now shown. Change it back if the abstract was meant.
* Author-name slips fixed: Taeho Kwak (#69), Dae-Duk Kim (#45), Sung-Hoon Ahn (#33), Jeong-Won Seo and Kwang-Il Kwon (#15). Initials expanded to full names for #32. #50 and #51 keep initials (PubMed has initials only).
* 3 papers added: #70 (thioridazine UHPLC-MS/MS), #72 (VOC umbrella review), #73 (heavy metal umbrella review). Titles agree letter for letter with PubMed and with the lab list.
* On hold: #71, the Yakhak Hoeji review on PAHs (title as on the lab list; Consensus gives the same title with first author Jong-Min Song). KCI, doi.org and Crossref could not be reached from the build environment and the journal is not in PubMed, so volume, pages, DOI and authors are unconfirmed.
* Five papers from 2015 onward are not on the lab list but are kept (#57, #55, #45, #43, #42); the lab list covers 2015-2026 only, so the 2002-2014 papers could not be compared with it.

## Limits

* The second route was limited: Scite needs a paid plan, the Consensus quota ran out during the run, direct fetches of doi.org, Crossref and publisher sites failed (no DNS), and web search ran out of budget late in the run. Records checked late (#3, #72, #73) therefore rest on PubMed alone for volume, pages and DOI; #27 was corroborated for the full paper only. PubMed is the National Library of Medicine record, but it is one source. "no independent route reachable" below means exactly that, not that anything contradicted the record.
* Korean-language journals (Yakhak Hoeji) are not in PubMed; their records rest on the publisher page and Consensus as read through web search.
* Capitalisation is shown as in the source record (Wiley and PubMed use title case; Elsevier uses sentence case), so the list mixes both.

## Per record

verdict: exact / cosmetic (capitalisation, punctuation, Greek-letter spelling) / title-differs / wrong-doi or doi-found / not-in-pubmed.

| No | Check | Source | Second check | Action on the site |
|---|---|---|---|---|
| 73 | doi-found | PMID 41564770 | no independent route reachable | Added |
| 72 | doi-found | PMID 41819200 | no independent route reachable | Added |
| 71 | not-in-pubmed | not in PubMed (publisher record / Consensus) | no independent route reachable | On hold: KCI record could not be reached; volume, pages, DOI and authors unconfirmed |
| 70 | doi-found | PMID 41392592 | confirmed | Added |
| 69 | exact | PMID 41223703 | confirmed | Author name capitalisation fixed (Taeho Kwak) |
| 68 | exact | PMID 40522805 | not rechecked (exact match) | None |
| 67 | exact | not in PubMed (publisher record / Consensus) | confirmed | Authors set to the lab list (Sung-Hoon Ahn only); Crossref has one unnamed entry |
| 66 | title-differs | PMID 38704937 | see notes | None: PubMed drops the locants of N1,N3; the publisher title (kept) has them |
| 65 | exact | PMID 38988565 | not rechecked (exact match) | None |
| 64 | exact | PMID 38754142 | not rechecked (exact match) | None |
| 63 | exact | PMID 37376117 | not rechecked (exact match) | None |
| 62 | exact | PMID 35916047 | not rechecked (exact match) | None |
| 61 | journal-differs | PMID 34857312 | confirmed | Journal name set to the publisher form |
| 60 | exact | PMID 31956933 | not rechecked (exact match) | None |
| 59 | title-differs | PMID 32388942 | confirmed | None: PubMed drops "In Vivo" (italic in the publisher title); the publisher title (kept) has it |
| 58 | cosmetic | PMID 31480155 | confirmed | None |
| 57 | title-differs | not in PubMed (publisher record / Consensus) | confirmed | Title replaced by the published title; authors, volume, issue, pages added |
| 56 | cosmetic | PMID 30173081 | confirmed | None |
| 55 | title-differs | not in PubMed (publisher record / Consensus) | confirmed | Title replaced by the published title (the old list had a shortened wording); authors not available |
| 54 | journal-differs | PMID 28843503 | confirmed | Journal name completed with the section name (BBA - Molecular and Cell Biology of Lipids) |
| 53 | not-in-pubmed | not in PubMed (publisher record / Consensus) | confirmed | None (not in PubMed; DOI, journal, volume and pages agree with the publisher record; print year 2018 kept) |
| 52 | cosmetic | PMID 27816761 | confirmed | None |
| 51 | cosmetic | PMID 27118489 | confirmed | None |
| 50 | cosmetic | PMID 27111464 | confirmed | None |
| 49 | cosmetic | PMID 26268745 | confirmed | None |
| 48 | exact | PMID 25956695 | not rechecked (exact match) | None |
| 47 | exact | PMID 26275726 | not rechecked (exact match) | None |
| 46 | exact | PMID 25899769 | not rechecked (exact match) | None |
| 45 | cosmetic | PMID 25648999 | confirmed | Author name capitalisation fixed (Dae-Duk Kim) |
| 44 | cosmetic | PMID 26026064 | confirmed | None |
| 43 | exact | PMID 24838378 | not rechecked (exact match) | None |
| 42 | title-differs | not in PubMed (publisher record / Consensus) | confirmed | Title replaced by the published title (old list had a different wording); issue added; authors not available |
| 41 | doi-found | PMID 25338206 | confirmed | Wrong DOI (another Oncotarget paper) replaced; authors, volume, issue, pages added |
| 40 | exact | PMID 24424891 | confirmed | None |
| 39 | doi-found | PMID 23677717 | confirmed | DOI and issue added (title and authors unchanged) |
| 38 | exact | PMID 24732149 | not rechecked (exact match) | None |
| 37 | cosmetic | PMID 24152122 | confirmed | None |
| 36 | cosmetic | PMID 24421394 | confirmed | None |
| 35 | title-differs | PMID 24122805 | confirmed | Title replaced by the full published title; DOI, authors, volume, issue, pages added |
| 34 | not-in-pubmed | not in PubMed (publisher record / Consensus) | confirmed | None (not in PubMed; the publisher record agrees on title, volume, pages and DOI) |
| 33 | exact | PMID 23849208 | confirmed | PI name capitalisation fixed (Sung-Hoon Ahn) |
| 32 | cosmetic | PMID 23135133 | confirmed | Author names expanded from initials to the PubMed full names |
| 31 | exact | PMID 23420715 | not rechecked (exact match) | None |
| 30 | cosmetic | PMID 23894352 | confirmed | None |
| 29 | exact | PMID 22856387 | not rechecked (exact match) | None |
| 28 | exact | PMID 23266361 | not rechecked (exact match) | None |
| 27 | not-in-pubmed | PMID 23137660 (full paper) | confirmed for the full paper; the abstract DOI was not found | Switched to the full paper with the identical title (Toxicol Lett 216:9-15); the earlier record was a conference-abstract DOI (vol 221, p S189) whose authorship could not be shown |
| 26 | doi-found | PMID 22738786 | confirmed | DOI, authors, volume, pages added |
| 25 | title-differs | PMID 22357285 | confirmed | Title replaced by the full published title; DOI, authors, volume, pages added |
| 24 | exact | PMID 21080208 | not rechecked (exact match) | None |
| 23 | cosmetic | PMID 22240842 | confirmed | None to the data; stale flag cleared (journal name is Drug Metabolism and Pharmacokinetics) |
| 22 | cosmetic | PMID 24900439 | confirmed | None |
| 21 | cosmetic | PMID 22210030 | confirmed | None |
| 20 | exact | PMID 21657833 | not rechecked (exact match) | None |
| 19 | cosmetic | PMID 21466936 | confirmed | None |
| 18 | doi-found | PMID 21456052 | confirmed | Wrong DOI replaced; authors, volume, issue, pages added |
| 17 | title-differs | PMID 20729023 | confirmed | Title replaced by the published title (chemical name restored, Greek letter) |
| 16 | cosmetic | PMID 21212546 | confirmed | None |
| 15 | cosmetic | PMID 21206135 | confirmed | Author name capitalisation fixed (Jeong-Won Seo, Kwang-Il Kwon) |
| 14 | exact | PMID 20863201 | not rechecked (exact match) | None |
| 13 | doi-found | PMID 20667724 | confirmed | Wrong DOI replaced; authors, volume, issue, pages added |
| 12 | exact | PMID 19965603 | not rechecked (exact match) | None |
| 11 | exact | PMID 20045318 | not rechecked (exact match) | None |
| 10 | exact | PMID 19703369 | not rechecked (exact match) | None |
| 9 | exact | PMID 19141872 | not rechecked (exact match) | None |
| 8 | cosmetic | PMID 18338782 | confirmed | None |
| 7 | exact | PMID 17720959 | not rechecked (exact match) | None |
| 6 | title-differs | PMID 16734985 | confirmed | Title completed ("accelerated assessment of the rate of uptake"); DOI, authors, volume, issue, pages added |
| 5 | exact | PMID 16640833 | not rechecked (exact match) | None |
| 4 | doi-found | PMID 16517222 | confirmed | DOI, authors, volume, issue, pages added |
| 3 | cosmetic | PMID 16136574 | no independent route reachable | None |
| 2 | exact | PMID 14705186 | not rechecked (exact match) | None |
| 1 | exact | PMID 12113992 | not rechecked (exact match) | None |
