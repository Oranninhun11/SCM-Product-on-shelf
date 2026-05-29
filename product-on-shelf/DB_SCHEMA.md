# Product on Shelf — Central "Database GG-Sheet" schema

The **data backbone** behind the app: a normalized Google Sheet that is **synced FROM** the
existing source-of-truth sheets + price emails + NotebookLM, and which **feeds** the per-product
pricing catalog ([SHEET_SCHEMA.md](SHEET_SCHEMA.md)) that the app reads via `window.PRICING`.

Grounded in Oran's hand-drawn "Diagram Product on Shelf". The app **writes** estimate requests into
**Page 2** and **reads** prices/specs from **Page 1**, which four ingestion pipelines keep fresh.

## Two-workbook model (key decision)

| Workbook | Role | Touched by |
|----------|------|-----------|
| **Database GG-Sheet** (this doc) | Normalized backbone, synced FROM the 4 sources. Spec/SOW/Price (Page 1) + Estimates (Page 2) + control tabs. | ingestion scripts (write) · `buildCatalog()` (read) |
| **Pricing-catalog** ([SHEET_SCHEMA.md](SHEET_SCHEMA.md)) | Per-flow read-model mapped 1:1 into `window.PRICING`. | `getPricing()` (read, 10-min cache) |

The normalized `Price` tab **FEEDS** (does not replace) the per-product catalog tabs: a scheduled
`buildCatalog()` job regenerates them from `Spec`+`Price`. This keeps the proven Firewall
`window.PRICING` read path byte-identical while introducing the new write path. Collapse to
direct-read later if the per-product tabs prove to be pure overhead.

## Conventions

- **Header row is the contract** — Apps Script reads by column name, not position (same rule as
  SHEET_SCHEMA.md). Columns can be reordered / appended without breaking the reader.
- All amounts **THB, pre-buffer**. Unknown price = `TBD` (never fabricate — house rule).
- Canonical join key **`sku_key`** = `<product>:<vendor>:<model>` slugified, generated identically
  by every ingestion path.
- `product` enum: `firewall, switch, hci, storage, backup, wireless_ap, wireless_controller, server,
  router, adc, ups, virt, endpoint, nac, dlp, captive, siem, esec, m365, winsvr`.
- Every Page-1 row carries provenance (see [Provenance](#provenance)).

---

## Page 1 — existing information (reference data the app READS)

### Tab `Spec` — hardware/software spec per product/model
One row per (product, vendor, model). PK `sku_key`.

| Column | Type | Notes |
|--------|------|-------|
| `sku_key` | string (PK) | `<product>:<vendor>:<model>` slug, e.g. `firewall:fortinet:fortigate-200f` |
| `product` | enum | see product enum above |
| `vendor` | string | `fortinet`, `cisco`, `nutanix`… |
| `model` | string | real model number — `FortiGate 200F` |
| `category` | enum | BoM Category (Compute, DC Switch, Firewall, Software Licenses, Backup, Management, Warranty SKU, Installation/PS) — reused from `references/bom-checklist.md` |
| `description` | string | BoM Description text |
| `spec_metric1_name` / `..._value` | string / number | generic capacity slot 1 — `throughput_gbps`/27, `ports`/48, `cores`/32 |
| `spec_metric2_name` / `..._value` | string / number | slot 2 — `ram_gb`/512, `speed`/mGig |
| `spec_metric3_name` / `..._value` | string / number | slot 3 — `usable_tb`/15, `poe`/poe |
| `unit` | string | BoM Unit — Node, Unit, License, Each |
| `citation_tag` | enum | 🟢 / 🟡 / 🔴 |
| `source` | string | `[NotebookLM:e1a7f114]`, `[datasheet:…]` |
| `source_detail` | string | "Detail" — notebook query / file name |
| `date_time` | ISO8601 | last verified/ingested (Asia/Bangkok) |
| `active` | bool | tombstone instead of delete |

Examples:
```
firewall:fortinet:fortigate-200f | firewall | fortinet | FortiGate 200F | Firewall | NGFW 27Gbps | throughput_gbps | 27 | rj45_ports | 18 | | | Unit | 🟢 | [NotebookLM:19756613] | "FortiGate 200F throughput" | 2026-05-20T09:12:00+07:00 | TRUE
hci:nutanix:nx-3155-g9 | hci | nutanix | NX-3155-G9 | Compute | HCI Node 2xXeon 512GB | cores | 32 | ram_gb | 512 | usable_tb | 15 | Node | 🟢 | [NotebookLM:e1a7f114] | "NX-3155-G9 max RAM" | 2026-05-20T09:14:00+07:00 | TRUE
```

### Tab `Price` — normalized cross-product price (the FEED source)
**Append-with-history** — never overwrite. PK `price_id` = `<sku_key>#<price_type>#<effective_date>`.
Active price = newest `effective_date` per (sku_key, price_type) with `superseded=FALSE`.

| Column | Type | Notes |
|--------|------|-------|
| `price_id` | string (PK) | `<sku_key>#<price_type>#<effective_date>` |
| `sku_key` | string (FK→Spec) | |
| `product` / `vendor` / `model` | string | denormalized for human scan |
| `price_type` | enum | `hw, lic_yr, support_yr, per_endpoint_yr, per_user_yr, per_gbday_yr, per_core_yr, per_socket_yr, platform, site_prep, impl` (superset of every per-product price column in SHEET_SCHEMA.md) |
| `amount_thb` | number | pre-buffer; `TBD` allowed (empty + 🔴) |
| `currency` | string | THB |
| `qty_basis` | string | `per_unit, per_node, per_TB, per_AP, per_user, flat` |
| `effective_date` | date | email date / quotation date |
| `superseded` | bool | TRUE once a newer effective row exists |
| `src_system` | enum | `email, tracking_estimate, rfq_db, manual` |
| `src_ref` | string | Gmail messageId / `SCMCE-…` / quotation no |
| `citation_tag` / `source` / `source_detail` / `date_time` | — | provenance |

Examples:
```
firewall:fortinet:fortigate-200f#hw#2026-05-15 | firewall:fortinet:fortigate-200f | firewall | fortinet | FortiGate 200F | hw | 185000 | THB | per_unit | 2026-05-15 | FALSE | email | gmail:18f2a | 🟢 | [EXT email 2026-05-15] | "Synnex [EXT] price list" | 2026-05-15T11:02:00+07:00
firewall:fortinet:fortigate-200f#hw#2026-03-01 | (same sku) | ... | hw | 178000 | THB | per_unit | 2026-03-01 | TRUE | email | gmail:18a01 | 🟢 | [EXT email 2026-03-01] | backfill | 2026-05-29T02:00:00+07:00
```

### Tab `SOW` — implementation / support / site-prep (from RFQ_DB)
Columns reused verbatim from `.claude/agents/sow-builder.md` so the RFQ_DB sync is a straight copy.
PK `sow_id`. Joins to Spec/Price by `product` (impl/support is per family, not per model).

| Column | Type | Notes |
|--------|------|-------|
| `sow_id` | string (PK) | RFQ_DB row id / project slug |
| `project` | string | RFQ_DB Project |
| `impl_type` | enum | New Installation / Migration/Replace / MA / Delivery only |
| `product` | enum | mapped to the product enum (for join) |
| `existing_equipment` / `new_equipment` | string | RFQ_DB |
| `sow_icr` | string | sub-blocks A–J flattened |
| `sla_tier` | enum | 24x7x4 / 8x5x4 / 8x5xNBD |
| `support_years` | int | 1–5 |
| `incidents` | string | int or `Unlimit` |
| `site_prep` | string | SOW Site Prep text |
| `impl_basic_thb` / `impl_standard_thb` / `impl_complex_thb` | number | optional; blank → fall back to `Implementation` knob tab |
| `citation_tag` / `source` / `source_detail` / `date_time` | — | `source = [03_Proposals/<proj>]` or `[RFQ_DB row N]` |

---

## Page 2 — new records (what the app WRITES)

### Tab `Estimates` — one row per estimate/request a user builds
| Column | Type | Notes |
|--------|------|-------|
| `estimate_id` | string (PK) | `EST-YYYYMMDD-<seq>` (seq from `_meta`) |
| `created_at` | ISO8601 | server timestamp |
| `created_by` | string | Workspace email (`Session.getActiveUser`) |
| `customer_name` | string | from diagram |
| `customer_detail` | string | "other detail" — contact, project, notes |
| `request_price_thb` | number | grand total incl. buffer at save time |
| `buffer_applied` | number | buffer factor snapshot (e.g. 1.20) |
| `status` | enum | draft / sent / won / lost |
| `quotation_no` | string | filled when a quotation is generated |
| `notes` | string | |

### Tab `Estimate_Lines` — child of Estimates (mirrors `window.PoSEstimate` cart lines)
| Column | Type | Notes |
|--------|------|-------|
| `line_id` | string (PK) | `<estimate_id>#<seq>` |
| `estimate_id` | string (FK→Estimates) | parent |
| `category` | string | cart category (Firewall, HCI…) |
| `vendor` / `model` | string | chosen option card |
| `sku_key` | string (FK→Spec/Price) | **the catalog reference** — links a written record back to the read-model |
| `qty` | number | units of devices |
| `unit_price_thb` | number | **snapshot** at save (estimates don't drift when Price updates) |
| `line_total_thb` | number | |
| `breakdown_json` | string | captured Device/License/Support/Site-prep rows |

---

## Control tabs

**`_meta`** (key/value): `version`, `last_full_sync`, `estimate_seq`, `email_backfill_done` (gates
the 9-month backfill to run once), `email_last_cursor` (newest processed mail date), `owner`.

**`_sync_log`** (one row per ingestion run — also the source of the Chat message body):
`run_id, started_at, finished_at, src_system, mode(daily|backfill|manual), rows_scanned,
rows_upserted, rows_superseded, rows_skipped, status(ok|partial|error), error_detail, chat_notified`.

**`_alias`** (manual normalization point): `raw_string → sku_key`. Unmatched ingestion lines log here.

---

## Keys & joins

- `Spec.sku_key = Price.sku_key` (1:N over time/type). Active = newest `effective_date`, `superseded=FALSE`.
- `SOW` joins by `product` (per family — matches the existing `Implementation`/`Params` knobs).
- Page 2 → Page 1: `Estimate_Lines.sku_key → Spec.sku_key`; prices **snapshotted**, not live-referenced.
- `buildCatalog()` maps `Spec.spec_metricN_*` + active `Price` rows into each per-product tab's named
  columns (metric-name → column map in a small `_catalog_map` config). Example: Firewall tab gets
  `throughput_gbps` from the metric slot named `throughput_gbps`, `hw_thb` from `price_type=hw`,
  `lic_yr_thb` from `price_type=lic_yr`.

---

## Ingestion — 4 sources

> **Trigger-owner account: `oran.nin@scmtechnologies.co.th` (Google Workspace).** Higher quota headroom
> than consumer (~6 hr/day total trigger runtime, larger Gmail read limits) — the daily pull + 9-month
> backfill fit comfortably.

### Data direction — "fetch" vs "webhook" (resolves the diagram ambiguity)

The diagram draws `Email → webhook → Google Chat → DB`, which makes Chat look like a data relay. It is
**not**. Three distinct mechanisms, only one is a true webhook:

| Direction | Mechanism | Used for |
|-----------|-----------|----------|
| **Fetch / pull** (script GETs data on a timer) | Apps Script **time-driven trigger** running `GmailApp.search(...)` / `openById(...)` | Email prices · Tracking sheet · RFQ_DB |
| **Inbound webhook** (external job POSTs to us) | Apps Script `doPost(e)` URL | **NotebookLM only** (local `nlm` push) |
| **Outbound webhook** (we POST a message) | Google Chat **incoming webhook** | **Notification only — not in the data path** |

Gmail has no simple push-webhook for new mail; the **scheduled fetch IS the "Fetch data about price"
step** in the diagram (yes, it works). Data goes straight from the fetch into the Sheet; Google Chat
only receives the end-of-run summary. Putting Chat in the data path would be fragile and adds nothing.

Common pattern: **time-driven trigger → query → parse → normalize to `sku_key` → upsert (read existing
into a Map, decide overwrite vs append, one batched `setValues()`) → write `_sync_log` → POST summary
to the Google Chat incoming webhook**.

| Source | Trigger | Query / filter | Upsert | Tag |
|--------|---------|----------------|--------|-----|
| **(a) Price emails [EXT]** | installable daily ~02:00 | `GmailApp.search('subject:[EXT] newer_than:1d',0,30)`; first run backfill `newer_than:9m` chunked via `email_last_cursor` then set `email_backfill_done` | **append-with-history** into `Price`; older same-(sku,type) → `superseded=TRUE`; unmatched → `_alias` + skip-log | 🟢 |
| **(b) Tracking Estimate cost** (SCMCE/SCMQT/SCM-B2B) | daily | `openById`, filter rows by code prefix | append-with-history; **wins over** email on date ties (`source_priority`: tracking > email > manual) | 🟢 |
| **(c) RFQ_DB** | daily/weekly | `openById('12i3FwwSxsg1-5mePfCWKmC_g_mDffXrZiHD3ZbjUo2E')`; split `Service Support` → sla/years/incidents | **overwrite by `sow_id`** (RFQ_DB is source-of-truth) | 🟢 |
| **(d) NotebookLM (KB)** | local `nlm` job → `doPost` webhook (GAS can't call the local CLI) | NotebookLM answer → spec metric slots | **overwrite `Spec` by `sku_key`** | 🟢 |

**Quotas that matter:** Gmail 20k reads/day · single execution 6 min (hence chunked backfill) · trigger
total 90 min/day consumer / 6 hr Workspace · `UrlFetchApp` 20k/day.

**Chat notification** fires at end of each run via `UrlFetchApp`, body built from the `_sync_log` row:
```
[Database GG-Sheet] email daily sync ✅
Scanned 12 [EXT] mails → upserted 28 prices, superseded 14, skipped 3 (unmatched → check _alias).
Latest: FortiGate 200F 185,000 THB (was 178,000).
```
Errors post 🔴 with `error_detail`. `chat_notified` prevents double-post on retry.

---

## Provenance

Every Page-1 row carries `citation_tag | source | source_detail | date_time`, reusing
`.claude/skills/oran-presale/references/citations.md` verbatim:
- **citation_tag**: 🟢 verified (email price list, tracking real number, NotebookLM/datasheet spec),
  🟡 assumed (derived/aliased, analogous project), 🔴 unknown (`TBD` price, unmatched model).
- **source** brackets: `[EXT email <date>]`, `[NotebookLM:<prefix>]` (Nutanix `e1a7f114`, Cisco
  `46539351`, Aruba `fb45f843`, Fortinet `19756613`, Veeam `bc490842`, Cabling `2e5dc0b0`),
  `[03_Proposals/<proj>]`, `[RFQ_DB row N]`, `[datasheet:<file>]`.
- **source_detail**: human "Detail" — email subject / NotebookLM question / file name.
- **date_time**: Asia/Bangkok ISO8601.

`buildCatalog()` copies the quartet into each per-product catalog row so
`window.PRICING.firewall[i].citation` can render a 🟢/🟡/🔴 badge + source/date hover. `TBD` price (🔴)
renders as `TBD` — never a fabricated number.

---

## Build order (next session — code)

1. Stand up backbone workbook — run `setupDatabase()` in [Setup.gs](Setup.gs) (idempotent; creates all
   tabs + headers, seeds `_meta` and the Firewall `_catalog_map`, stores `DB_SPREADSHEET_ID`).
2. Wire **email [EXT] → Price for Firewall only** (Fortinet/Palo Alto): daily trigger, alias the 2–4
   models, append-with-history upsert, Chat webhook. Prove against a real `[EXT]` mail.
3. Write `buildCatalog()` to regenerate the **Firewall** per-product tab from `Spec`+`Price`; confirm
   the existing Firewall `window.PRICING` POC renders byte-identical when prices match the mock.
4. Fan out: remaining products in `buildCatalog`; sources (b)/(c)/(d); Page-2 `Estimates` /
   `Estimate_Lines` write path (prerequisite for the separate Create-Quotation feature).

## Open risks / to confirm at build time

- 🔴 **Email parsing** — `[EXT]` formats vary (body table / xlsx / PDF). `_alias` + skip-and-log is the
  hedge; PDF lists may need manual entry (out of GAS).
- ✅ **Trigger-owner account** — resolved: `oran.nin@scmtechnologies.co.th` (Workspace), good quota headroom.
- 🟡 **sku_key aliasing drift** ("FG-200F" vs "FortiGate 200F") — `_alias` needs early curation.
- 🟡 **source_priority** (tracking > email > manual on date ties) — confirm.
- ⚪ SHEET_SCHEMA.md still describes Backup as a hardware repo flow; the `product` enum here uses the
  current software-only shape.
