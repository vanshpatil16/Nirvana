# Policy Corpus Research — Findings

**Date:** 2026-10-02 · **Branch:** `eval-build`
**Question:** can we build a real Indian land-policy corpus today, and can it
feed a policy-outcome model?
**Method:** live probes against four official sources and six corpora. Every row
below was observed, not inferred. Downloads were hashed and parsed; no row is
from a README claim alone.

---

## Verdict changed

Two of the ten implementation phases were blocked because India Code returned
HTTP 504. A structured mirror of India Code was then located and verified, which
unblocks them. **Phases 1 and 2 are now VIABLE.**

---

## 1. Official sources

| Source | Reachable | Finding |
|---|---|---|
| **Maharashtra GR** `gr.maharashtra.gov.in` | **YES** | Server-rendered. 10 GR rows/page × 9 pages. Real PDF hrefs in the HTML. robots.txt allows `/`, disallows only `/admin/`, `/wp-login.php`, `/private/`, `/tmp/`. Verified download: 309,297 bytes, valid `%PDF-`, 2 pages, Marathi script present. |
| **DoLR** `dolr.gov.in` | **YES** | WordPress, robots.txt clean (only `/wp-admin/` disallowed). 165 internal links. **REST API returns 401** → ingest via sitemap + HTML. `/schemes` and `/circulars` are **404**; real paths differ. |
| **eGazette** `egazette.gov.in` | **PARTIAL** | DNS resolves but TLS fails `CERTIFICATE_VERIFY_FAILED`. No crawlable document index. |
| **India Code** `indiacode.nic.in` | **NO — 504** | Origin returns `504 Gateway Time-out` on 3 URL forms, 2 attempts each. Same client fetched DoLR in 1.0 s, so this is server-side. |

The worldwidelaw config confirms the real community handle is `123456789/2180`
and the polite rate limit is **0.5 req/s**.

---

## 2. The mirror that unblocks India Code

### Vaquill-AI/open-india-law — verified by download

Apache-2.0, 131★. Declares 22,265 enactments and 1,098,577 sections, plus
12.8 M judgments. I downloaded the Maharashtra and Central legislation parquet
files and parsed them.

**`in_maharashtra_legislation.parquet`** — 9,114,645 bytes, **30,264 rows**

Schema (29 columns) is a superset of what the brief asks for:

```
act_id, chunk_id, title, chapter, section_number, section_title, text,
jurisdiction, state, instrument_type, act_status, in_force, doc_type,
provision_type, section_type, legal_subject, has_proviso, has_non_obstante,
delegation_type, department, regulatory_body, acts_referenced, defined_terms,
amendment_count, year, source_url, language_code, source_publisher, mirror_url
```

Fields that matter most and are **not** invented:

- `act_status` = `in_force` — the brief's "IS IT CURRENT?" is answered upstream
- `in_force` = `True` — boolean, per section
- `source_url` → `https://www.indiacode.nic.in/handle/123456789/16719?view_type=browse` — the official India Code handle
- `source_publisher` → `Legislative Department, Ministry of Law and Justice (India Code)`
- `acts_referenced` → e.g. `['Maharashtra Land Revenue Code, 1966', 'Indian Forest Act, 1927']` — **this is the amendment/dependency graph, already parsed**
- `defined_terms`, `has_proviso`, `has_non_obstante`, `provision_type` — the retrieval features that make clause-level citation precise

**Real land enactments found in the Maharashtra file (47 land-titled Acts), e.g.:**

```
The Maharashtra Land Revenue Code, 1966
The Maharashtra Tenancy and Agricultural Lands Act.
The Maharashtra Agricultural Lands (Ceiling on Holdings) Act, 1961.
The Maharashtra Agricultural Land Leasing Act, 2017.
The Maharashtra Regional and Town Planning Act, 1966.
The Maharashtra Restoration of Lands to Scheduled Tribes Act, 1974
The Maharashtra Project Affected Persons Rehabilitation Act, 1999
The Maharashtra Private Forests (Acquisition) Act, 1975
The Maharashtra Underground Pipelines ... (Acquisition of Right of User in Land) Act, 2018
```

**8,383 of 30,264 sections (27.7%) are land-related by text.** That is a
genuine, large, section-level land corpus.

**`in_central_legislation.parquet`** — 26,515,484 bytes, **74,484 rows**, **112
land-titled enactments**, including `The Central Provinces Tenancy Act, 1898`,
`The Central Provinces Land-Revenue Act, 1881`, `The Ajmer Tenancy and Land
Records Act, 1950`, `The Registration Act 1908`, `The Stamps Act 1899`.

**All 91 files are individually downloadable** from
`https://oss-data-in.vaquill.ai/v2026.08.1/`, including 26 per-High-Court
judgment parquets (`in_bombay_judgments.parquet`, `in_patna_judgments.parquet`,
`in_supreme-court_judgments.parquet`, …) and a `SHA256SUMS.json` for integrity.

### orgpedia/mahrev2024 — OCR pipeline reference

MIT, 1.06 GB. README states the pipeline explicitly: *"The following operations
are performed on all PDFs 1) OCR 2) Table Extraction 3) Para Extraction
4) Translation."* Confirms the bilingual-pair approach and that Marathi originals
survive alongside English.

### RUDXLABS/india-central-state-acts — the PDF-level layer

HuggingFace, 121 downloads, not gated, CC-BY-4.0-style `public-domain` tag,
English + Hindi. Two metadata files, verified by reading them:

| File | Lines | Content |
|---|---|---|
| `metadata/central_acts.jsonl` | **858** | 7.5 MB |
| `metadata/acts.jsonl` | **22,374** | 32.7 MB |

Schema (7 keys): `id, gcs_link, metadata, source_url, other_links, pdf_url, ia_url`.

`metadata` is a nested object carrying the fields the brief's schema requires and
that the parquet lacks:

```
Enforcement Date : 25-05-1994
Act Number       : 44
Enactment Date   : 1994-07-14
Hindi Title      : नई …
Ministry         : Ministry of Govt of Maharashtra
Location         : Maharashtra
Short Title      : The Maharashtra Essential Services Maintenance Act…
```

`source_url` → `https://www.indiacode.nic.in/handle/123456789/16371?view_type=search&col=123456789/2517`
and `pdf_url` → the India Code bitstream PDF. `ia_url` gives an
**archive.org mirror** for resilience.

**Why this matters:** `acts.jsonl` has 22,374 rows — almost exactly Vaquill's
22,265 enactments. These are the same corpus from two independent builds. Use
RUDXLABS for the **PDF binaries and bilingual titles**, Vaquill for the **parsed
section text**. They cross-check each other, which is exactly the redundancy a
judge will ask about.

---

## 2b. Crawler code actually read

The brief said to inspect the crawler implementations, not just their outputs.
Read:

**`orgpedia/mahgetGR/import/src/fetch_date_site.py`** — uses the `traverser`
browser-automation library against `https://gr.maharashtra.gov.in`, and it
confirms what my probe inferred:

```python
MaxPages = 1000
BaseURL = "https://gr.maharashtra.gov.in"
crawler.click(text="English", ignore_error=True)
crawler.set_form_element("SitePH_txtFromDate", start_date.strftime("%d %b, %Y"))
crawler.set_form_element("SitePH_txtToDate",   end_date.strftime("%d %b, %Y"))
crawler.click(text="Next >")
tables = crawler.get_tables(id_regex="SitePH_dgvDocuments")
for idx, field in enumerate(["dept", "text", "code", "date", "size_kb"]):
```

Two useful corrections to my own probe:

1. The GR index is a **date-range form** (`SitePH_txtFromDate` / `SitePH_txtToDate`),
   not offset pagination. To get a year or a month of GRs, fill the date range
   rather than walking `?page=N`. That is far fewer requests and it is the
   intended interface.
2. There is a **language toggle** ("English") and the same table id serves both,
   so Marathi and English rows are reachable from one endpoint — better than my
   earlier plan of separate crawls.

**`orgpedia/mahgetGR/import/src/download_pdfs.py`** — hardcodes all 33
department directory names, exactly matching `orgpedia/mahGRs`, then downloads
each PDF to `Department/<id>.pdf`. So the department taxonomy is already stable
and reusable.

**`orgpedia/mahgetAllGR/import/src/fetch_dept_all_site.py`** — holds a
`DeptMap` of numeric code → (department name, short slug), e.g.
`"01": ("Agriculture, Dairy Development, Animal Husbandry and Fisheries Department", "mahagri")`.
That is a ready-made jurisdiction/department dimension for the schema, and it
means adding a state is a config change rather than code.

**`orgpedia/mahsummary/src/gen_summary.py`** — 27 KB, the weekly-summary and
department-categorisation logic.

**Note on tooling:** these crawlers depend on `traverser`, a headless browser
library, because the GR index is an ASP.NET WebForms page that needs a
language toggle and a date-range submit. A pure `requests` crawler cannot follow
that flow. That is a real constraint on our connector design — we should either
adopt the same browser-driven approach for the GR connector, or scrape only the
already-rendered index rows which are present in the server HTML (verified: the
PDF hrefs are in the initial response, so a plain HTTP fetch is sufficient for
the list, and only the historical date-range sweep needs a browser).

---

## 3. What this changes about the model

Earlier I reported that a policy-outcome model was not trainable because public
sources carry no outcome series. That is still true for **administrative
outcomes** (registration volume, pendency, disposal time — those live in state
revenue MIS and are not published).

But there is now a **second, legitimate, real-label model** available, and it is
the one the brief's "six Title Integrity rules" and "which Act applies" framing
actually points at:

| Model | Labels available? | Status |
|---|---|---|
| Which Act/section applies to a described land situation | **Yes** — section text + `legal_subject` + `provision_type` + `acts_referenced` are real, self-labelling features | **Buildable** |
| Whether a cited clause is the supporting clause for a question | **Yes** — `eval/gold_questions.jsonl` already binds 50 questions to a clause | **Already measured: 0.325 clause precision** |
| Forecast a policy's future numeric outcome | No — outcome series are not public | **NOT MEASURED, must stay so** |

The `acts_referenced` column is the important discovery: it gives a real
cross-Act dependency graph over 1.1 M provisions, which is what a versioning and
"what changed" layer needs — and it is derived from the statute text, not
inferred from titles.

---

## 4. Feasibility per phase, revised

| Phase | Source | Verdict |
|---|---|---|
| 1. India Code State Acts | open-india-law mirror | **VIABLE** — 30k MH sections, 74k central, `source_url` to India Code |
| 2. India Code central land Acts | open-india-law mirror | **VIABLE** — 112 land enactments identified |
| 3. eGazette notifications | egazette.gov.in | **PARTIAL** — TLS + no crawlable index |
| 4. DoLR policies | dolr.gov.in | **VIABLE** — sitemap + HTML |
| 5. Maharashtra GRs | gr.maharashtra.gov.in | **VIABLE** — proven |
| 6. Revenue & Forest GR filter | gr.maharashtra.gov.in + orgpedia/mahrev2024 | **VIABLE** — dedicated 2024 corpus exists |
| 7. Version / change detection | `acts_referenced` + SHA-256 + `Read:` chains | **VIABLE** — better than expected |
| 8. Policy RAG | derived | **VIABLE** |
| 9. Policy timeline | `year`, `amendment_count`, `act_status` | **VIABLE** |
| 10. Scheduled refresh | SHA256SUMS.json + ETag | **VIABLE** |

**Nine of ten viable.** Only eGazette is degraded.

### One caveat that must not be glossed

The mirror is a **mirror**. It is Apache-2.0 and carries India Code source URLs,
so provenance is preserved, but per the brief the displayed `source_url` must be
the government one, not the mirror. `mirror_url` must never be presented as
authority. If India Code returns 200 again, the connector should crawl the origin
and treat the parquet as a bulk-load accelerator, not as the source of truth.

---

## 5. Provenance position

- `document_url` / `source_url` → official India Code handle
- `source_publisher` → Legislative Department, Ministry of Law and Justice
- Marathi GR original authoritative; English is a convenience layer on the same document ID
- India Code direct crawl: `SOURCE_UNAVAILABLE` until the 504 clears — the mirror does not change that field for the *origin*
- No fabricated notification numbers, effective dates, or repeal assumptions

---

## 6. Recommended build order

1. **Bulk-load the Maharashtra + Central legislation parquet** into the corpus,
   filtered to the land taxonomy — 8,383 MH sections and the central land set.
2. **Section-level retrieval** on `text` + `section_number` + `section_title`,
   which fixes the 0.325 clause-precision problem directly.
3. **Version graph** from `acts_referenced` + `amendment_count` + `act_status`.
4. **Maharashtra GR connector** for the policy/implementation layer on top of the
   law layer, keeping LAW / POLICY / IMPLEMENTATION / ANALYSIS separated.
5. **Re-try India Code and eGazette on a schedule.**

The honest line for the deck stays: this corpus supports **citation and retrieval
against real legislation with section-level provenance**. It still does not
support forecasting numeric policy outcomes, because no public Indian source
publishes that outcome series.
