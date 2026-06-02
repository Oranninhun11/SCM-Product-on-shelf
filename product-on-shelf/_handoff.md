# Handoff — Product on Shelf (presale price-list web app)
_Session: 2026-05-28 · software-engineer mode_

> This is a **code project**, not an SCM presale customer. Continuation happens in
> `product-on-shelf/`, so the handoff lives here (not `$TMPDIR`). Full detail is in
> `product-on-shelf/README.md` — this file is a state pointer, not an archive.

## Project + stage
"Product on Shelf" — instant ballpark price list for presale/sales. **Google Apps Script web
app** (HTML Service), shadcn/blocks.so aesthetic + SCM B2B brand. Local-first; **not yet deployed**.
Stage: **3 flows built (mock pricing), device→project shell complete.**

## Where we left off
Just finished restructuring the shell from flat "project types" to **device type → project (tabs)**,
and added the **Network Switch → Replacement** flow. All verified via headless-Chrome screenshots;
`README.md` updated. No stale refs (grep-checked).

## Built (all pricing is MOCK)
- **Firewall → Replacement** (Fortinet / Palo Alto) — seam `priceOption()`
- **Network Switch → Replacement** (Cisco Catalyst / Aruba CX) — own `priceOption()`
- **Server / HCI → Refresh** (Nutanix NX-3155-G9 / Supermicro+Proxmox) — seam `priceCluster()`, N+1 + ×1.2
- Placeholders (`data-soon`): New-install for Firewall/Switch/Server, all of Storage & Backup & DR

## Open questions / to verify
- 🔴 **Pick next**: New-install flow / Storage / Backup & DR / data integrations (the "last phase"). Oran to choose.
- 🟡 **Support is flat** (not ×qty) by Oran's instruction; switch DNA/Aruba licensing is technically per-device — confirm OK.
- 🟡 **All numbers illustrative** — real prices come from the Sheet/email integration phase.
- ⚪ Cosmetic: moved flow markup inside Firewall/HCI panels kept shallow indentation (offered to normalize).

## Next concrete step
Ask Oran which flow is next, then activate `/oran-software-engineer` and build it following the
established pattern: device `<section>` → project tab panel → self-contained controller IIFE with its
own pricing seam. Verify with headless Chrome screenshots before reporting done.

## Suggested skills
- **`/oran-software-engineer`** — all code work here (surgical edits, verify-don't-assume).

## Artifacts (paths from repo root)
- `product-on-shelf/index.html` — entire app (shell + 3 flows + scripts)
- `product-on-shelf/Code.gs` · `appsscript.json` · `.clasp.json.example` · `logo.png`
- `product-on-shelf/README.md` — architecture, status, pricing seams, deploy steps

## Decisions (the why)
- **Single self-contained `index.html`** — Apps Script has no build step; templating `include()` split deferred to the integration phase (it breaks local browser preview). ⚠️ **Logo is base64-inlined (~45KB) — do NOT rewrite the whole file or you'll lose it; edit surgically.**
- **Device → project tabs** (chosen by Oran over accordion / hub cards) — "project type" mixed device+action; device-first is cleaner.
- **Quantity scales device only**; implementation + support stay flat (Oran: multiplying all "case too much").
- **License-only firewall option removed** (Oran) — was misleading on throughput; FG/PA only now.
- **Brand**: navy `#1f2a4d` = primary, orange `#f15a28` = single accent; neutral base = "minimal".
- Buffers: **×1.2 capacity growth + N+1** (HCI), **×1.2 price margin** on totals, THB.

## References
- Original spec: this session's first project message ("Product on Shelf").
- `CLAUDE.md` house rules — real model numbers, N+1, ×1.2 buffer, THB.
- Aesthetic: https://blocks.so (shadcn "zinc"). Verify: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --screenshot` → Read the PNG.

> Resume: open `product-on-shelf/index.html`, then `/oran-software-engineer` — ask Oran which flow next (New install / Storage / Backup & DR / integrations).

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-29 · software-engineer mode · "will process next in the morning"_

## Stage
All product flows built (mock pricing). **17 product types** live across two groups + a Custom-estimate
cart. **Sheet schema for the data-integration phase is drafted** (`SHEET_SCHEMA.md`) and awaits Oran's
two design calls. No code is wired to a real Sheet yet; nothing committed; not deployed.

## Where we left off
Just wrote `product-on-shelf/SHEET_SCHEMA.md` — the tab-by-tab Google Sheet design that the integration
phase will replace the mock `CATALOG`/`VENDORS`/knobs with. Grounded in the actual code values (extracted,
not remembered). `README.md` updated to match the full product set. Last screenshots all passed.

## Built this session (all pricing MOCK, each its own `priceOption()`/`priceCluster()` seam)
- **Hardware (10):** Firewall, Router/SD-WAN, Network Switch, Load balancer (F5/Citrix), Wireless
  (moved here from software), Server/HCI, Standalone Server (Dell/HPE), Storage, Backup & DR, UPS (APC/Vertiv).
- **Software (7):** Virtualization (VMware/Nutanix/Proxmox, 3-card), Endpoint (EPP/EDR/XDR), NAC, DLP,
  Email & SASE (service-type switch), Captive portal, Logging/SIEM (Splunk/Sentinel).
- **New-install** tabs added for Firewall/Switch/Server/Storage (greenfield variants).
- **Custom estimate cart** — `window.PoSEstimate`, one delegated listener reads any option card; one line
  per category (re-add replaces) + free-form **custom line** items; nav count badge; grand total.
- Sidebar/home restructured into **Hardware / Software**; every card button is now **Add to estimate**.

## Open questions / decisions for Oran (in `SHEET_SCHEMA.md` "Open decisions")
- 🔴 **Schema layout:** per-product tabs (recommended, 1:1 with code) vs one normalized `Catalog` tab.
- 🔴 **Buffer + SLA/location multipliers:** live in the Sheet (tunable) vs fixed in code.
- 🟡 All numbers are illustrative — real prices arrive with the Sheet integration.
- 🟡 Design choices made without full sign-off: cart dedupe-by-category for product lines; software flows
  use a New/Renewal toggle (no SLA — support bundled); Email & SASE is one flow whose Service select swaps
  the vendor pair; Wireless kept hardware-style (SLA tier).

## Next concrete step
Confirm the two 🔴 schema decisions, then wire the **Firewall flow** end-to-end against a real Google Sheet
as the vertical-slice POC: `doGet` → `createTemplateFromFile`, cached `getPricing()`, bootstrap
`window.PRICING.firewall`; prove parity vs the current mock numbers before converting the other 16.

## Suggested skills
- **`/oran-software-engineer`** — all code work (surgical edits, verify via headless-Chrome screenshots).

## Artifacts produced this session
- `product-on-shelf/index.html` — extended from 3 flows to 17 product types + Custom-estimate cart.
- `product-on-shelf/README.md` — status/architecture/seams updated to the full set.
- `product-on-shelf/SHEET_SCHEMA.md` — **new**, the data-integration Sheet design (read this first).

## Decisions (the why)
- **One delegated cart listener that reads the card DOM** (category from section, vendor/model/total from
  the card) — so new flows are cart-enabled with zero per-flow wiring; only the `CAT` map needs the label.
- **id-based cart store** — product lines key on `id = category` (re-add replaces); custom lines get unique
  ids so several can stack.
- **Logic stays in code, Sheet holds list inputs + levers** — keeps the `priceOption()`/`priceCluster()`
  seams as the single swap point per flow.

## References
- `SHEET_SCHEMA.md` (this session) · `README.md` · `Code.gs` (`include()` already staged for templating).
- `CLAUDE.md` house rules — real model numbers, N+1, ×1.2 buffer, THB.

> Resume: read `product-on-shelf/SHEET_SCHEMA.md`, then `/oran-software-engineer` — get Oran's 2 schema calls, then wire the Firewall flow to a real Sheet as the POC.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-29 · software-engineer mode_

## Stage
All flows mock-priced. **19 product types** now (added Microsoft 365 + Windows Server 2025). Firewall
is wired to the `window.PRICING` seam (Sheet-integration POC) with mock fallback; the other 18 still
read inline mocks. A **How-to-use guide** is in the menu. Not deployed; nothing committed.

## Where we left off
Just added the **"How to use"** guide page (menu item + header `?` button → `data-view="guide"`) and
finished the Microsoft 365 and Windows Server 2025 software flows. All changes verified via headless-
Chrome screenshots (interaction-driven: nav-click, add-to-estimate, expand). Real `index.html` kept
clean — all screenshot tests used throwaway temp copies.

## Built this session (all in `product-on-shelf/index.html`)
- **Firewall → `window.PRICING` seam** — reads `window.PRICING.firewall` + shared `knobs`/`multipliers`/
  `implementation`, mock fallback. Parity proven (byte-identical SHA, no PRICING) + override proven.
  **This is the template** to replicate to the other 18 flows in the Sheet phase. `priceOption()` math untouched.
- **Estimate cart line breakdown** — each cart line expands (chevron) to show its captured cost rows
  (Device / License / Support…). Generic capture from `.card-content`; one delegated toggle listener.
- **"Units of devices" rollout** — Router (relabel sites→devices), ADC + UPS + Storage (both panels)
  gained a device-count multiplier; HCI (both panels) node count auto-fills from the workload but is
  **editable (min 3)** — workload change re-syncs, manual edit overrides both vendors.
- **Backup & DR** — moved Hardware → **Software** group; rebuilt as **software-license-only per instance**
  (field "Units of lic"); Veeam/Commvault, edition mult; dropped appliance/repo/DRaaS/impl.
- **Microsoft 365** — new Software flow; 3 plan cards (Business Standard / Premium[Recommended] / E3);
  per-user/yr × users × term + onboarding (0 on renewal).
- **Windows Server 2025** — new Software flow with **real core licensing**: billable cores =
  max(cores, 8×procs, 16); Standard stacks per 2 VMs, Datacenter unlimited; 2-core packs + User/Device
  CALs. Standard vs Datacenter cards, cheapest = best value (tracks the real break-even).
- **How-to-use guide** — `data-view="guide"`: 6 numbered steps + "Good to know" + Start-an-estimate CTA.

## Open questions / decisions for Oran
- 🔴 **Pricing source**: Oran will hand over a **Google Sheet DB design (prototype, hand-drawn)**. Then
  wire flows to live prices via the `window.PRICING` seam (Firewall is the proven POC). No code action until then.
- 🟡 **ADC / UPS**: "Units of devices" *multiplies* the HA/redundancy factor (2 units + HA pair = 4). Confirm vs. replace.
- 🟡 **Mock prices** (all tunable, illustrative): Backup per-instance Veeam ฿18k / Commvault ฿22k/yr,
  edition ×(Std 1.0 / Ent 1.5); M365/user/yr Std ฿5,600 / Premium ฿9,800 / E3 ฿15,600; WinSvr 2-core
  pack Std ฿4,500 / DC ฿26,000, CAL User ฿1,400 / Device ฿1,200.
- 🟡 **Backup is license-only** (no onboarding line, no SLA/SOW/location); **WinSvr is one-time/perpetual**
  (no SA term). Say if you want onboarding/SA added.
- 🟡 **Static "incl. 20% buffer" label** is hardcoded in all flows — can go stale now that the buffer is
  Sheet-tunable (firewall). Make dynamic when rolling the seam out.
- ⚪ `README.md` / `SHEET_SCHEMA.md` still describe Backup as a hardware repo flow — not yet updated to software-only.

## Next concrete step
Wait for Oran's Google Sheet design; then replicate the `window.PRICING` seam from Firewall to the other
18 flows and switch `Code.gs` `doGet` to `createTemplateFromFile` + inject `window.PRICING`.

## Suggested skills
- **`/oran-software-engineer`** — all code work (surgical edits, verify via headless-Chrome screenshots).

## Artifacts produced this session
- `product-on-shelf/index.html` — only file changed (shell + all 19 flows + cart + guide).

## Decisions (the why)
- **Additive `window.PRICING` seam with mock fallback** (not a hard cutover) — keeps local browser preview
  working (templating breaks it) and makes mock↔Sheet parity trivially verifiable.
- **Plan/edition tiers as the comparison cards** for single-vendor software (M365 plans, WinSvr editions).
  M365 "Recommended" is a fixed sensible default (Premium), NOT cheapest; WinSvr cheapest=best value is
  valid because it tracks the Standard↔Datacenter break-even by VM density.
- **HCI auto-size + editable** (chosen by Oran over pure-manual or no-field) — keeps workload sizing, adds a tweakable node count.
- **Backup software-only per instance** (chosen by Oran) — moved to Software, dropped all hardware.

## References
- Verify edits: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --screenshot`
  on a temp copy of `index.html` (inject a nav-click; optionally inject `window.PRICING`). Read the PNG.
- ⚠️ `index.html` is now ~330KB — the `Read` tool fails on the whole file; read with `offset`/`limit` or
  grep specific regions. Logo is base64-inlined — edit surgically, never rewrite wholesale.
- `SHEET_SCHEMA.md` (Sheet design) · `CLAUDE.md` house rules.

> Resume: `/oran-software-engineer` — when Oran provides the Google Sheet design, replicate the Firewall `window.PRICING` seam to the other 18 flows.

---

# Feature capture — Create Quotation (MAIN feature, 2026-05-29)
_Not yet built. Oran flagged this as a/the main feature; recording so it isn't lost again._

## What Oran wants
After an estimate is built in the web app, **generate a quotation by filling the SCM Excel cost-sheet
template**, for Sales. Template will be uploaded to Google Drive (the storage "stack").

## Template (read & mapped) — `3. Quot_CS form update FM-SL001-02 -03 (Rev.00).xlsx`
4 sheets:
- **`Q Project_Option`** = customer-facing quotation (Thai/EN, SCM letterhead pre-filled).
  - Fill: Date `E4`, Quot No `E5`, Attn `A8`, Project `A9`, Company `A10`; terms rows 15–17
    (Validity/Warranty/Delivery/Conditions/Payment/Currency).
  - **Line items → rows 20–47**: `A=No | B=Part No | C=Description | D=QTY | E=Unit Price | F=Total`.
  - Totals auto: F48 subtotal → F49 discount → F50 net → F51 VAT 7% → F52 grand total → A53 `BAHTTEXT`.
- **`Cost Project`** = internal cost sheet (margin/GP, not shown to customer). Blocks: HW In-house / HW
  Outside / SW In-house / SW Outside / Service In-house / Service Outside / Other Exp / Interest&Risk.
  Each row has Cost (E/F) AND Selling (I/J) + Supplier + Warranty; per-block GP% + grand total.
- **`Cost Runrate`** = recurring/run-rate variant of Cost Project. **`Final today`** = summary.

## Dependency / sequencing
- Customer quotation (`Q Project_Option`) can be filled from the **estimate cart today** (category →
  vendor/model → qty → price breakdown already captured per line).
- **`Cost Project` needs COST + SUPPLIER**, which the app does NOT have yet → comes from the pricing DB
  Sheet Oran is drawing. So: **build the pricing Sheet first, then quotation export.**

## Open design decisions (for when we build)
- 🔴 Fill mechanism in Apps Script: template should be a **Google Sheet** (BAHTTEXT is native there) →
  `DriveApp` copy template → `SpreadsheetApp` set values into rows 20–47 → export PDF/xlsx. (xlsx-direct
  is awkward in Apps Script; converting the template to a Google Sheet is the clean path.)
- 🔴 Map estimate cart lines → quotation rows: one cart line = one quotation row? Or expand the
  Device/License/Support breakdown into separate Part-No rows?
- 🟡 Where Quot No. comes from (running counter in the Sheet?), and which terms are user-entered vs default.

> Resume for THIS feature: after the pricing Sheet is wired, build quotation export — convert template to
> a Google Sheet, copy+fill via SpreadsheetApp, populate `Q Project_Option` line rows + `Cost Project` from
> the cart, export. Verify against a known estimate.

## Progress this session (2026-05-29 PM)
- **Decided: quotation must FILL THE EXISTING TEMPLATE** (preserve letterhead/terms/purple header/footer
  formulas/`BAHTTEXT`), NOT generate a fresh sheet. Proven with openpyxl → `_demo-filled-template.xlsx`
  (83 KB, all 4 template sheets, Firewall line written into `Q Project_Option`). This is the target shape.
- **Decided: line layout = ITEMIZED, section-per-component** (Oran's pick). Each estimate line expands into
  centered section dividers: hardware section (named after category, e.g. "Firewall") → Implement → Support
  → Site prep, each a priced row. Components buffered ×1.20 to ~match the cart total
  (e.g. 144k/90k/208.8k/30k → Subtotal 472,800 · VAT 33,096 · Grand 505,896; ~฿200 under the app's
  rounded 473,000 — confirm if exact-match needed).
- **Mechanism reality:** the browser **Create quotation** button (added this session: SheetJS CDN,
  `window.PoSQuotation.buildAOA`, `est-quote` button + store `list()` getter) can ONLY build a bare sheet —
  browsers can't open/edit a disk file. So that button is a PLACEHOLDER producing the wrong (bare) output.
  Real fill must run server-side: **openpyxl now / Apps Script filling a Google-Sheet template copy on deploy.**
- **Oran is parking exact detail mapping** until after the DB design is done — he'll re-spec what detail
  goes into the Excel then. (Open: License type / MA-of-product sub-rows? exact-match buffer? Quot No source?)

## ⚠️ Cleanup note for next session
The client-side SheetJS quotation button in `index.html` (`est-quote` + the "Create quotation" script block
+ SheetJS `<head>` include + store `list()`) is a known-wrong mechanism. Either rewire it to POST the
estimate to the Apps Script template-filler, or remove it — decide with Oran. `_demo-filled-template.xlsx`
is a throwaway demo (safe to delete; regenerate from the openpyxl snippet in the session log).

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-29 PM · software-engineer mode · /handoff_

## Stage
Quotation-export feature explored + **parked by Oran** pending his DB design. App otherwise unchanged:
19 mock-priced flows, Firewall on the `window.PRICING` seam. Not deployed; **nothing committed** (whole
`product-on-shelf/` dir is still untracked).

## Where we left off
Proved the quotation must **fill the existing Excel template** (not generate a bare sheet) — demo
`product-on-shelf/_demo-filled-template.xlsx` written via openpyxl, Firewall line itemized into
`Q Project_Option`. Full decisions are in the **"Create Quotation" feature-capture block above** (layout =
itemized section-per-component; mechanism = server-side fill, not browser). Oran will re-spec the exact
detail mapping after the DB design.

## Open questions / blockers
- 🔴 Exact detail mapping into the Excel — Oran to define after DB design (the gating item for this feature).
- 🟡 Itemized buffer lands ~฿200 under the app's rounded total (505,896 vs ~506,110) — confirm if exact match needed.
- 🟡 License-type / MA-of-product sub-rows, and Quot No. source — undecided.
- 🟡 **Pending Oran reply:** keep vs remove the client-side "Create quotation" button (it produces the wrong bare output).

## Next concrete step
Wait for Oran's Google Sheet DB design; then wire flows to live `window.PRICING`, then build the
template-fill quotation export (openpyxl locally / Apps Script on Drive once deployed).

## Suggested skills
- **`/oran-software-engineer`** — all code work (surgical edits; verify via headless-Chrome screenshots / openpyxl readback).

## Artifacts produced this session
- `product-on-shelf/index.html` — added SheetJS CDN include, `est-quote` "Create quotation" button,
  store `list()` getter, and the `window.PoSQuotation` quotation script (client-side; placeholder mechanism).
- `product-on-shelf/_demo-filled-template.xlsx` — **throwaway demo** (template filled via openpyxl; safe to delete).
- `product-on-shelf/_handoff.md` — this file (feature-capture + decisions updated).

## Decisions (the why)
- **Fill the template, don't regenerate** — Oran's expected output IS the formatted `Q Project_Option`
  sheet; a fresh SheetJS sheet loses letterhead/terms/formulas/BAHTTEXT.
- **Itemized layout** (chosen by Oran over bundled single-line) — section per breakdown component.
- **Browser can't fill a disk template** (hard security limit) → real export must run server-side
  (openpyxl now / Apps Script SpreadsheetApp on a Google-Sheet copy when deployed).

## References
- Template: `product-on-shelf/3. Quot_CS form update FM-SL001-02 -03 (Rev.00).xlsx` (sheets mapped above).
- `SHEET_SCHEMA.md`, `README.md`, `CLAUDE.md` house rules.

> Resume: `/oran-software-engineer` — when Oran provides the DB design, wire live pricing then build the
> template-fill quotation export. First settle the parked Q: keep or remove the client-side button.

## 🆕 DB design has landed (2026-05-29 ~15:15)
`DB_SCHEMA.md` (central "Database GG-Sheet": two-workbook model, Spec/Price/Estimates tabs, `sku_key`
join, 4 ingestion pipelines) + `Setup.gs` (`setupDatabase()` bootstrap). This is the long-pending DB
design that unblocks live pricing + the quotation export. `Setup.gs` has a live `EXISTING_DB_ID`.
NEXT: per `DB_SCHEMA.md`, the catalog `Price` tab FEEDS the per-product `window.PRICING` read-model —
wire flows to it (Firewall seam proven), then the template-fill quotation export.

## Web-design polish (2026-05-29 PM, same session) — DONE + verified
All in `index.html`, verified via headless-Chrome screenshots (mobile closed/open, desktop, sticky):
- **Mobile responsive (#1):** sidebar is now an off-canvas drawer below `md` (hamburger `#nav-toggle` in
  header → slides `#sidebar` in over `#nav-backdrop`; closes on nav-click / backdrop / Esc / breakpoint
  cross). Static column on `md+` (unchanged desktop). New "Mobile nav drawer" script block. No h-overflow
  (probe: scrollWidth==clientWidth). NB: headless clamps min width ~500px — shoot mobile at ≥500.
- **Sticky total (#2):** cart grand-total bar is `sticky bottom-0 bg-card` — stays visible while the list scrolls.
- **Pinned lucide (#3):** `unpkg.com/lucide@latest` → `@1.17.0` (what latest resolved to). No behaviour change.
- **A11y (#5):** `aria-label` on icon-only buttons (hamburger, help `?`, cart Remove, cart expand chevron).

### Deliberately NOT done (speculative until Phase 3 — flagged, not forgotten)
- **#4 loading/skeleton states** — all pricing is instant mock; nothing async to load yet. Add when prices
  come from the Sheet/network (Phase 3), else it's dead code.
- **#6 dynamic "20% buffer" label** (still hardcoded 26×) — value is uniformly 20% and correct today; only
  matters once the Sheet makes buffer ≠ 20%. Centralize when rolling the `window.PRICING` seam out.
- **Tailwind Play CDN** — still dev-only (prints console warning + adds load latency in prod). Real fix =
  precompile Tailwind to static CSS, which adds a build step the project intentionally avoids for now.
  Works in Apps Script as-is; revisit at deploy hardening. (lucide is now pinned; Tailwind is the remaining one.)

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-29 PM · software-engineer mode · /handoff_

## Stage
First-ever commit landed. App = 19 mock-priced flows + cart + client-side quotation button (placeholder),
mobile drawer + sticky total + a11y done, DB design drafted (`DB_SCHEMA.md`/`Setup.gs`). Live pricing &
real quotation export NOT yet wired. **Now committed; not pushed; not deployed.**

## Where we left off
Committed `product-on-shelf/` only — branch **`product-on-shelf-app`**, commit **`3498f47`** (12 files).
This session also: custom-line input wrapped in a `<form>` so **Enter submits** (#5, verified); **docs synced**
(Backup now software-license-only in `README.md` + `SHEET_SCHEMA.md`, #2); added **`tools/shot.sh`** verify
helper (#3, tested).

## Open questions / blockers
- 🟡 **Push `product-on-shelf-app` or keep local?** — Oran to decide (asked; unanswered).
- 🔴 **⚠️ Repo side effect (OUTSIDE product-on-shelf):** my first commit accidentally swept in pre-staged
  SCM presale changes (`.claude/agents`, skills, scripts) + `.DS_Store`. I undid it (`git reset HEAD~1`) and
  re-committed cleanly — but that **unstaged** those SCM files. Content is INTACT in the working tree; they
  just need re-`git add` before Oran commits them separately. Not this app's concern.
- 🟡 Still parked: **keep vs remove the client-side "Create quotation" button** (wrong mechanism — see above).
- 🔴 Exact quotation detail mapping — Oran defines after DB design (now drafted).

## Next concrete step
Wire flows to live pricing via the DB: per `DB_SCHEMA.md`, the catalog `Price` tab FEEDS `window.PRICING`
(Firewall seam proven) — then build the **template-fill quotation export** (openpyxl now / Apps Script on deploy).

## Suggested skills
- **`/oran-software-engineer`** — all code work (surgical; verify with `tools/shot.sh` / openpyxl readback).

## Artifacts this session
- `product-on-shelf/index.html` — form-submit fix (+ earlier mobile/sticky/a11y/quotation-button work).
- `product-on-shelf/README.md`, `SHEET_SCHEMA.md` — Backup → software-license-only.
- `product-on-shelf/tools/shot.sh` — **new** headless-Chrome screenshot helper.
- `product-on-shelf/_handoff.md` — this file.
- (Untracked, throwaway: `product-on-shelf/_demo-filled-template.xlsx`.)

## Decisions (the why)
- **Clean, scoped commit** — redid the over-broad commit so history isn't polluted with unrelated SCM work + junk.
- **Excluded the demo xlsx** from git — regenerable throwaway, not a source artifact.
- Deferred loading-states & dynamic-buffer-label as **speculative until Phase 3** (no async data / buffer still 20%).

> Resume: `/oran-software-engineer` on branch `product-on-shelf-app` — wire flows to `window.PRICING` per
> `DB_SCHEMA.md`, then the template-fill quotation export. Decide: push the branch? keep/remove the JS button?

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-31 · software-engineer mode · /handoff_

## Stage
**Live-pricing seam DONE for ALL 23 flows** (was just Firewall). App is now built from `src/`
partials via `build.py`. Committed AND pushed/deployed to Apps Script. Pricing is still the
**mock fallback** at runtime (nothing populates `window.PRICING` server-side yet).

## Where we left off
Wired every flow IIFE to read `window.PRICING` with mock fallback (replicating the Firewall POC),
rebuilt `index.html` from `src/`, committed (`ff4d753`), `clasp push`-ed, and **redeployed the `@3`
web-app deployment → `@4`** (same `/exec` URL now serves the live-pricing build). The `@HEAD`
deployment also serves it. Verified parity (byte-identical render with no PRICING, 44 containers via
headless Chrome) + overrides flowing through before pushing.

## Seam contract (what the Sheet must emit into `window.PRICING`)
- **Per-product data** → `P.<product>.*`: `catalog`/`existing`/`vendors`/`base`/`ap`/`controller`/
  `plans`/`service`/`meta`, plus price maps (`per_ep`, `per_gbday`, `per_core`, `per_socket`,
  `per_site`, `platform`, `sdwan_yr`, `support_yr`, `support_rate`, `lic_ctrl`/`lic_cloud`,
  `pack_price`, `cal_price`, `price`, `tier_factor`, `runtime_mult`, `user_mult`, `ret_mult`,
  `edition_mult`). Product keys = DB enum (note: ws.html → `winsvr`, emailsase.html → `esec`,
  server_standalone.html → `server`; `*_new` variants SHARE the base product namespace).
- **Shared** → `P.implementation.<product>`, `P.multipliers.sla`/`.location`, `P.knobs.buffer`,
  scalar knobs `P.knobs.<product>_<name>` (e.g. `switch_nonpoe_disc`, `server_ram_rate/disk_rate`,
  `firewall_site_prep`).
- **Left in code (policy, NOT price)**: `GROWTH` ×1.2, `MIN_NODES`/N+1, WinSvr `MIN_CORES`/
  `MIN_PER_PROC`, `VMWARE_MIN_CORES`, `RECOMMENDED`, all label maps.

## Open questions / blockers
- 🔴 **Nothing populates `window.PRICING` yet** — deployed app serves mocks. Next real step is
  `Code.gs doGet` → `createTemplateFromFile` + inject `window.PRICING` from the catalog `Price` tab
  (per `DB_SCHEMA.md` `buildCatalog()`).
- 🟡 **HCI/server_new `autoNodes()` assumes exactly 2 vendors** (`VENDORS[0]`/`[1]`) — a Sheet
  `hci.vendors` list ≠ 2 throws. Pre-existing; flag when populating real vendor data.
- 🟡 **Static "incl. 20% buffer" labels** now can go stale (buffer is Sheet-tunable across all flows).
  Make dynamic when injecting real PRICING. (Still deferred, as before.)
- 🟡 Still untracked/uncommitted: `DB_SCHEMA.md`, `Setup.gs`, `build_db_xlsx.py`,
  `Product_on_Shelf_DB.xlsx`, `.clasp.json`/`.claspignore`, `Flow diagram/`, modified
  `README.md`/`_handoff.md`. Left for a separate commit (DB/deploy concern, not the seam).

## Next concrete step
Wire `Code.gs` `doGet` to inject `window.PRICING` from the catalog `Price` tab (Firewall first as the
parity check), so the deployed app reads real numbers instead of mocks. Then the quotation export.

## Suggested skills
- **`/oran-software-engineer`** — verify via the throwaway harness `/tmp/pos_parity.py`
  (dumps every flow's rendered cards; `--pricing FILE.json` to test an override) + `tools/shot.sh`.

## Artifacts produced this session
- `product-on-shelf/src/flows/*.html` — 22 flows wired to the seam (Firewall already was).
- `product-on-shelf/index.html` — rebuilt from `src/`.
- Commit `ff4d753` (branch `product-on-shelf-app`): `src/`, `build.py`, `index.html`.
- Apps Script deployment `@4` (`AKfycbxMT6TI…`) — same `/exec` URL, live-pricing build.

## Decisions (the why)
- **Minimal line-targeted edits** — only wrapped `var X = …` declaration lines (`PX.key || {…}`),
  never touched data literals, so the mock fallback stays byte-identical and parity is structural.
- **`*_new` variants share the base product namespace** — DB enum has no `_new` products; new-install
  and replacement of the same device draw from one catalog.
- **Sizing house-rules stay in code** — ×1.2/N+1/core-minimums are policy (CLAUDE.md), not Sheet prices.
- **Committed src/ + build.py + index.html as one buildable unit**; redeployed `@3`→`@4` (Oran's pick)
  to keep the shared `/exec` URL stable.

## References
- `DB_SCHEMA.md` (`buildCatalog()` feed) · `Code.gs`/`Setup.gs` · `CLAUDE.md` house rules.
- Firewall seam (`src/flows/firewall.html`) = the template that was replicated.

> Resume: `/oran-software-engineer` on `product-on-shelf-app` — wire `Code.gs doGet` to inject
> `window.PRICING` from the catalog `Price` tab (Firewall first), then template-fill quotation export.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-05-31 PM — pricelist UI + email→Price ingestion_

## Stage
Data-design / ingestion. Email `[EXT]` → `Price` pull **built + LIVE** (daily GAS trigger). Read path
(app shows real prices) NOT wired yet — app still serves mock `DEFAULTS`.

## Where we left off
Just answered Oran's "where is firewall/HCI/other?" — diagnosed that `[EXT]` is an unreliable signal
(many vendor price replies have NO `[EXT]`: e.g. `SCM:Shamir TH /ขอราคา C1300-16 XTS`,
`[Request price] Switch ToR/BCM`, `New Cisco Core Switch/PKM`, `MA Veeam Asia Golden`). Recommended
**#1: switch fetch from `subject:[EXT]` → distributor-domain allowlist** (vstecs/ingrammicro/exclusive-
networks/nutanix/lenovo/hpe/h3c/sisthai/fortinet). **Awaiting Oran's go to implement #1.**

## What got built & verified this session
- **Pricelist UI** — `src/flows/_pricelist.html` rewritten: every non-firewall product now renders the
  firewall-style Model&options + itemized quotation (HW: Device/Site prep/Impl/Support·yr·SLA; SW:
  License/Term/Onboarding/Support). Pushed + live.
- **`Ingest_Email.gs`** (NEW, the main work) — GAS daily trigger pulls `[EXT]` mail, parses inline HTML
  price table (per-`<table>`, header-keyword detection — handles VST/Ingram/AT), normalizes part→`sku_key`
  via `_alias`, append-with-history upsert into `Price`, `_sync_log`, optional Chat notify. `DRY_RUN=false`.
- **Live state (verified by reading the sheet back):** `Price` has Cisco switch rows; `seedAliases()`
  filled ~44 discovered SKUs; daily trigger installed (≈02:00). 9-month backfill ran (`scanned 258`).

## Open questions / blockers
- 🟢 **#1 distributor-domain fetch** — recommended, **awaiting go**. Biggest coverage win, ~1-line query change.
- 🔴 **Firewall / HCI-Nutanix / server-HW absent** — these quotes arrive as **xlsx/PDF attachments**, not
  inline tables. Needs **#2 xlsx-attachment parsing** (GAS → Drive convert → read). PDF = manual/OCR (#3, defer).
- 🟡 `_alias` mappings were wiped once mid-session (all blank) → `seedAliases()` rewritten to FILL blanks
  (upsert), not just append. If alias goes blank again, re-run `seedAliases`.
- 🟡 Classifications rough: Veeam→`lic_yr`, endpoint SKU may log as `hw`, `EPESCECE`/`RH00004` vendor 🟡.
- 🟡 Read path still unwired — `Code.gs doGet` must inject `window.PRICING` from catalog (per `DB_SCHEMA.md`).

## Next concrete step
Implement **#1**: replace `INGEST.QUERY_DAILY`/backfill query `subject:[EXT]` with a distributor-domain
allowlist (keep `[EXT]` as OR fallback), as an editable config knob; push; Oran re-runs `resetBackfill` +
`backfillEmailPrices`. Then **#2** xlsx-attachment parsing for firewall/HCI.

## Suggested skills
- **`/oran-software-engineer`** — Ingest changes. Verify by READING the sheet back (Google access is
  read-only; can't run GAS). clasp push works locally from here.

## Artifacts produced this session
- `product-on-shelf/Ingest_Email.gs` (NEW) · `src/flows/_pricelist.html` (rewritten) ·
  `index.html`/`preview.html` rebuilt · `.claspignore` (+`!Ingest_Email.gs`) ·
  `_seed_alias.tsv`/`_seed_price.tsv` (local seed bootstrap, superseded by `seedAliases()`).
- Memory: `project_pos_ingestion_live.md`, `reference_product_on_shelf_deploy.md` (updated).

## Decisions (the why)
- **Parse HTML `<table>`, not plaintext** — real `[EXT]` prices are HTML tables; plaintext flattens
  unpredictably. Header-keyword detection = one parser for all vendor layouts.
- **`_alias` is the capture gate** — only mapped part numbers reach `Price`; everything else queues in
  `_alias` blank. Keeps `Price` clean; house rule = never fabricate.
- **All-Apps-Script, no Rundeck/Python** for email/sheet pulls — GAS time-driven triggers run on Google,
  no laptop/Claude. Rundeck only ever needed for the local NotebookLM `nlm` CLI (deferred).
- **`[EXT]` is the wrong signal** (this session's key finding) — sender-domain is reliable; `[EXT]` is
  inconsistent sales tagging.

## References
- `DB_SCHEMA.md` (source (a) email→Price; 4-source design) · live DB sheet `1kzKWvaJN7z7…` ·
  `reference_product_on_shelf_deploy.md` (clasp v3: `open-script`/`open-web-app`; `.claspignore` allowlist).

> Resume: `/oran-software-engineer` on `product-on-shelf-app` — implement #1 (distributor-domain fetch
> in `Ingest_Email.gs`), push, Oran re-runs `resetBackfill`+`backfillEmailPrices`; then #2 xlsx attachments.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-01 · software-engineer mode · ingestion #1 distributor-domain fetch + #2 xlsx parser_

## Stage
`Ingest_Email.gs` only. **#1 distributor-domain fetch DONE + pushed (live).** **#2 xlsx-attachment
parser DONE + pushed but DORMANT** (guarded by `typeof Drive`; activates when Oran enables the Drive
advanced service + reauthorizes). No `appsscript.json` scope change pushed — the live daily trigger
keeps running on its existing Gmail/Sheets auth, untouched.

## Built this session (all in `Ingest_Email.gs`, verified by syntax parse + local logic tests)
- **#1 fetch broadened off the unreliable `[EXT]` signal → distributor sender-domain allowlist.**
  New knobs: `INGEST.DISTRIBUTOR_DOMAINS` (vstecs/ingram/exclusive-networks/nutanix/lenovo/hpe/h3c/
  sisthai/fortinet — substring-matched, editable), `USE_EXT_FALLBACK` (keeps `subject:[EXT]` OR-ed in).
  One list drives BOTH the Gmail search (`{from:(…) subject:[EXT]} newer_than:…`, via `buildQuery_`/
  `sourceClause_`) AND the per-message gate (`isFromDistributor_`) — the gate was the hidden second
  filter that would have dropped every domain-only mail if left as the old `[EXT]`-only check.
- **#2 xlsx attachments.** `parseAttachmentTables_`→`isSpreadsheetAttachment_`→`readXlsxBlob_`: converts
  each .xls/.xlsx attachment to a temp Google Sheet (Drive v2 `Files.insert {convert:true}`), reads it via
  the SAME `extractPricedRows_` (factored out of `parsePriceTable_` so HTML + xlsx share column detection),
  trashes the temp file, feeds items into the existing `reconcile_` pipeline. Cells String()-coerced
  (xlsx gives numbers/dates). Dormant until Drive enabled.

## Oran's two manual steps (Claude can't run GAS / can't reauthorize)
1. **Activate #1 over history:** Apps Script editor → run `resetBackfill()`, then `backfillEmailPrices()`.
   Re-sweeps 9 months under the wider net. Safe to re-run (price_id dedupe + append-with-history).
   Then `seedAliases()` if new unmatched parts appear; re-run backfill. Daily trigger already covers go-forward.
2. **Activate #2:** editor → Services (+) → add **Drive API** (advanced service) → reauthorize when prompted.
   That adds the Drive scope and flips the `typeof Drive` guard on. First distributor mail with an xlsx
   quote (Fortinet/HCI/server) is the live test — watch `_sync_log` + `_alias` for the new parts.

## Open / risks
- 🟡 #2 unverifiable until reauth — no sample xlsx attachment in-repo + can't run GAS. Pure extractor IS
  tested; the Drive-conversion plumbing is GAS-only and runs first on Oran's reauth.
- 🟡 New firewall/HCI/server part numbers will land in `_alias` BLANK (capture gate) — curate + add to
  `ALIAS_SEED`, run `seedAliases()`. House rule: only mapped parts reach `Price`.
- 🟡 Drive v2 advanced service is the conversion path (`Files.insert/remove`, `convert:true`). If the
  enabled service is v3, switch to `Files.create` + remove the `convert` flag.
- 🔴 Read path STILL unwired — app serves mock `DEFAULTS`; `Code.gs doGet` must inject `window.PRICING`
  from the catalog `Price` tab (`DB_SCHEMA.md buildCatalog()`). Unchanged this session.
- Working tree NOT committed (repo has unrelated SCM presale changes staged; left alone deliberately).

## Decisions (the why)
- **One DISTRIBUTOR_DOMAINS list, two consumers** — query + message gate can't drift; domain is the
  reliable signal ([EXT] is inconsistent sales tagging, the prior session's key finding).
- **#2 pushed dormant, no manifest scope change** — a Drive-scope increase suspends time-driven triggers
  until reauth; Oran is away and the trigger must keep Price fresh. `typeof Drive` guard = zero-risk staging.
- **Shared `extractPricedRows_`** — HTML and xlsx go through identical header/column detection; one parser to reason about.

> Resume: `/oran-software-engineer` on `product-on-shelf-app`. If #1/#2 verified, next is the READ path
> (`Code.gs doGet` → inject `window.PRICING` from `Price`, Firewall first) — the last thing between the
> app and real prices. Then the template-fill quotation export.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-01 · software-engineer mode · scoped commit + multi-brand aliases + one-time price-mail discovery_

## Stage
`Ingest_Email.gs` ingestion deepened. **#1/#2 verified live==local** (clasp pull + byte-diff: 67 files,
0 differ). Diagnosed "Price only has Cisco", extended `ALIAS_SEED` to multi-brand, and built a **one-time
comprehensive price-mail fetch** (`discoverAllPriceMail()`). All pushed. **First-ever scoped commit of the
app landed** (`8b2996b`). Read path still unwired (app serves mock `DEFAULTS`).

## Built / done this session
- **Scoped commit `8b2996b`** (branch `product-on-shelf-app`, 41 files, `product-on-shelf/` ONLY) — ingestion
  + rebuilt panels + new `_rep`/`_pricelist` flow partials + DB artifacts + `Flow diagram/` + docs.
  Gitignored the real `.clasp.json` (live scriptId stays local; `.clasp.json.example` is the placeholder)
  and `_demo-filled-template.xlsx` (throwaway). Unrelated `.claude/` SCM changes deliberately left untouched.
- **Verified Apps Script == local** — `clasp pull` into a temp dir + diff every pushed file: SAME across
  3 `.gs` + `appsscript.json` + `index.html` + 62 `src/*.html` (67 total).
- **Diagnosed "Price = Cisco only"** by reading the live DB sheet (`1kzKWvaJN7z7…`): `Price` has just **6
  Cisco rows** (written in the FIRST backfill, `upserted 6`); every run since reads `upserted 0` because
  the **`_alias` `sku_key` column is all blank** — the mappings were wiped and **`seedAliases()` has not
  been re-run** (5 backfills, all 0). Other brands (Fortinet/Aruba/Veeam/Allied-Telesis) ARE arriving
  (fetch #1 works — scans jumped 50→405) but sit unmapped in `_alias`, so nothing writes. **Fetch is not
  the problem; the `_alias` mapping gate is.**
- **Extended `ALIAS_SEED` (+20, pushed)** — Fortinet (`firewall:fortinet:*` FG-70G AR + FortiCloud),
  Aruba ClearPass (`nac:aruba:*`), Cisco 9300X (`switch:cisco:c9300x-*`), Allied-Telesis x550 + transceivers
  (`switch:alliedtelesis:*`). **Deliberately left Veeam `V-ESS*` unmapped** (maintenance/renewal/migration
  artifacts, not catalog prices).
- **`discoverAllPriceMail()` — one-time comprehensive fetch (pushed).** Widens BOTH filters vs the daily net:
  search = domains OR `[EXT]` OR **price-intent subjects** (`INGEST.PRICE_SUBJECT_TERMS`, TH+EN: ขอราคา/
  เสนอราคา/quotation/price/RFQ…); per-message gate = **any inbound** non-SCM message (the `broadGate` opt).
  Window `DISCOVER_MONTHS=12`. **Resumable**: 400 threads/run (`DISCOVER_THREADS`), walks older via an
  `email_discover_before` date cursor (`ymdPlusDays_` +1-day boundary, dedupe-safe); gated by
  `email_discover_done`. New fns: `discoverAllPriceMail()`, `resetDiscover()`, `priceSubjectClause_()`,
  `ymdPlusDays_()`; `sourceClause_(broad)`/`buildQuery_(window, broad)` gained the additive broad arg;
  `runIngest_(query, mode, opts)` gained `broadGate`/`cap` + tracks `threadsFetched`/`oldestYmd`.
  Daily/backfill paths **byte-unchanged** (broad defaults off). Verified: syntax + node unit-test of the
  query strings (narrow unchanged, broad well-formed, cursor +1-day/month-roll correct). Can't run GAS.

## Oran's manual GAS steps (the actual unlock — Claude can't run GAS / Google is read-only)
1. **`seedAliases()`** — fills blank `sku_key` for all seeded brands (Cisco + Veeam DPP + Allied-Telesis
   **+ Fortinet + Aruba + 9300X**). **Open `_alias` and confirm the column is now filled.** If it's STILL
   blank after running → real bug in `seedAliases`, tell next session to hunt it.
2. **`discoverAllPriceMail()`** — repeat until the log says **"Discovery COMPLETE"** (each says PARTIAL
   while walking older; re-run is dedupe-safe). Fills `Price` for mapped parts, dumps the rest into `_alias`.
3. Curate new `_alias` blanks → hand them to Claude → extend `ALIAS_SEED` + push → `seedAliases()` →
   **`resetDiscover()` then `discoverAllPriceMail()`** to re-price history for the newly-mapped parts.

## Open questions / risks
- 🔴 **Read path STILL unwired** — app serves mock `DEFAULTS`; `Code.gs doGet` must inject `window.PRICING`
  from the catalog `Price` tab (`DB_SCHEMA.md buildCatalog()`). Unchanged. The last thing before real prices.
- 🟡 **`seedAliases()` un-run** is the current blocker to a multi-brand `Price` (see step 1). Strong evidence
  it simply hasn't been run; if running it doesn't fill, it's a bug.
- 🟡 **Discovery breadth vs runtime** — `price`/`ราคา` are broad; first sweep may need several re-runs. Trim
  `PRICE_SUBJECT_TERMS` if too noisy. `DRY_RUN` preview optional (set back to false after).
- 🟡 **Classification still rough** (`classifyPriceType_`) — e.g. Fortinet "Advance Replacement" and Veeam
  "2yr" fall to `hw`/wrong type; alias still routes the right product, only the `price_type` label is off.
  Offered to tighten the regex; not yet done.
- 🟡 **Dead line `Ingest_Email.gs` `run.upserted;`** in `reconcile_` — harmless no-op; offered to drop.
- 🟡 #2 xlsx parser still **dormant** until Oran enables the Drive advanced service + reauthorizes.
- Working tree: this session's `Ingest_Email.gs` edits (aliases + discovery) are **pushed but NOT committed**
  (commit `8b2996b` predates them). Commit when ready.

## Decisions (the why)
- **Discovery widens the per-message gate too, not just the search** — the gate is the hidden second filter;
  leaving it narrow would silently drop every non-allowlisted vendor reply the broad search pulls in (the #1 trap).
- **Broad is safe** — the `_alias` write-gate means breadth only adds blank `_alias` rows + runtime, never
  bad prices in `Price`. So discovery casts wide on purpose.
- **Separate `discoverAllPriceMail()`, not a widened daily** — daily must stay tight (no noise forever); the
  broad sweep is a gated one-time op with its own done-flag + resume cursor.
- **Resume via date cursor, not offset paging** — avoids Gmail deep-offset limits + premature-done; oldest
  fetched day `+1` re-includes the boundary day (dedupe covers the overlap). Never advances during DRY_RUN.
- **Left Veeam `V-ESS*` unmapped** — renewal/migration line items aren't representative catalog prices
  (house rule: never write misleading prices).

## References
- `Ingest_Email.gs` (ingestion: domains #1, xlsx #2, discovery) · live DB `1kzKWvaJN7z7…` ·
  `DB_SCHEMA.md` (`buildCatalog()` read-model feed) · `reference_product_on_shelf_deploy.md` (clasp v3).

> Resume: `/oran-software-engineer` on `product-on-shelf-app`. Confirm `seedAliases()` + `discoverAllPriceMail()`
> populated a multi-brand `Price`; curate `_alias` blanks (extend `ALIAS_SEED`). Then the READ path
> (`Code.gs doGet` → inject `window.PRICING` from `Price`, Firewall parity first) — the last thing between
> the app and real prices. Then the template-fill quotation export. Commit the uncommitted `Ingest_Email.gs` edits.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-01 (early AM) · software-engineer mode · crash fix + scan-all + xlsx-v3 + full alias mapping_

## Stage
Ingestion went LIVE end-to-end this session. `Price` rebuilt from **6 rows → ~90+** (real prices, multi-brand).
Found + fixed a crash that was silently blocking all writes; widened discovery to the whole inbox; mapped
every discovered part; fixed the xlsx attachment path for Drive v3. All pushed to Apps Script. **Branch is now
on GitHub.** `Ingest_Email.gs` edits since commit `a5207e8` are **pushed but NOT committed.**

## What happened (in order)
1. **Verified #1/#2 live==local** (clasp pull + byte-diff, 67 files, 0 differ).
2. **Scoped commit `8b2996b`** (product-on-shelf only) + **`a5207e8`** (multi-brand aliases) earlier; then **pushed
   branch `product-on-shelf-app` to GitHub** remote **`enter`** = `github.com/Oranninhun11/Claude` (`git push`
   now one-word; upstream set). ⚠️ Oran chose to push the WHOLE branch incl. `CLIENT_TRACKER.md` + `.claude/`
   presale skills (informed decision — flagged the exposure first; assume repo is private).
3. **Diagnosed "Price = Cisco only"** → not a fetch problem; the `_alias` map was blank (seedAliases hadn't run).
   Oran ran it → map filled.
4. **🔴 CRASH BUG (pre-existing, exposed by volume): `reconcile_` pushed pending rows with `rowIndex:-1`, then a
   later same-SKU/different-date email sent `-1` into `supersedeRowIdx` → `applySupersede_ getRange(-1)` threw
   "starting row too small". Killed every write in both backfill + discover.** FIXED: pending rows now superseded
   in place in `toAppend` (`PRICE_SUPERSEDED_IDX`), never via getRange; `applySupersede_` skips rows < 2;
   `discoverAllPriceMail` no longer advances the cursor on error. Unit-tested in node (4 scenarios, all orderings,
   no `-1` leak, exactly one active=newest). Added **`resetPriceData()`** (wipe Price + reset gates/cursors) for
   clean rebuild — the 6 old Cisco rows had been stranded `superseded=TRUE` by the partial crash.
5. **`DISCOVER_SCAN_ALL = true`** — discovery now drops the source filter entirely and reads the WHOLE inbox in
   the window (Oran's explicit ask: "all price mail, not just [EXT]"). Safe via the `_alias` gate.
6. **Mapped ALL remaining `_alias` blanks (+~20)**: MS Windows Server 2025 (`winsvr:microsoft:*`), MS SQL Server
   2025 (`sqlserver:microsoft:*`, catalog-only no app flow), H3C optics (`switch:h3c:*`), Allied-Telesis Net.Cover
   (`switch:alliedtelesis:*`), Veeam Essentials maint/migration (`backup:veeam:ess-*`, distinct models), Quest Toad
   (`software:quest:*`). **Improved `classifyPriceType_`**: net.cover/advance-replacement→support, Device/User CAL→lic
   (12/12 node tests pass, existing classifications unchanged).
7. **Drive API enabled by Oran → #2 active, but it's Drive v3** (`Drive.Files.insert is not a function`). FIXED
   `readXlsxBlob_`: `insertConvertedSheet_` tries v3 `Files.create` then v2 `Files.insert`; `spreadsheetBlob_`
   sets correct content-type for `.xlsx`/`.xls`; cleanup via `DriveApp…setTrashed` (version-agnostic). Pushed +
   **verified live by pulling the script** (`Files.create` present, old call gone).

## Oran's manual GAS steps RIGHT NOW (Claude can't run GAS)
Re-sweep cleanly so the xlsx files skipped pre-fix (`True Internet Hardware/Software Cost.xlsx` — the firewall/
server quotes) get read this time:
1. **`seedAliases()`** — fills the new MS/H3C/AT/Veeam/Toad mappings.
2. **`resetPriceData()`** — clears Price + resets cursor to newest (re-sweep whole inbox with the working xlsx reader).
3. **`discoverAllPriceMail()`** — repeat until log says **"COMPLETE"** (each "PARTIAL" → run again; dedupe-safe).
Then the xlsx-sourced part numbers land in `_alias` BLANK → hand them to Claude for the next mapping round.

## Open / risks
- 🔴 **Read path STILL unwired** — app serves mock `DEFAULTS`; `Code.gs doGet` must inject `window.PRICING` from
  the catalog `Price` tab (`DB_SCHEMA.md buildCatalog()`). The last thing between the app and real prices.
- 🟡 **Working tree uncommitted** — `Ingest_Email.gs` (crash fix + scan-all + recovery + mappings + classify + xlsx-v3)
  is pushed to Apps Script but not git-committed since `a5207e8`. Commit when the rebuild is confirmed.
- 🟡 **scan-all + xlsx = slow** — every inbox xlsx (incl. RVTools exports, layouts) is converted/read/trashed;
  non-price ones yield nothing but cost time. Resumable. Add a filename filter if it drags.
- 🟡 **classify still heuristic**; `sqlserver`/`software` products are catalog-only (no app flow yet).
- 🟡 Veeam `V-ESS*` mapped as distinct maint/migration models (not the base license price).

## Decisions (the why)
- **Broad-is-safe** — `_alias` write-gate means casting wide only adds blank `_alias` rows + runtime, never bad
  prices. So discovery widens both the search AND the per-message gate; scan-all drops the filter entirely.
- **Date-cursor resume, not offset paging** — avoids deep-offset limits + premature-done; errored runs must NOT
  advance the cursor (retry same batch).
- **`resetPriceData()` for recovery** — prices are re-derivable from mail and nothing reads Price yet, so a clean
  wipe beats surgically un-stranding the bad `superseded=TRUE` rows.
- **xlsx path version-agnostic** — v3-first/v2-fallback + DriveApp trash, because the enabled advanced service
  turned out to be v3 (the handoff's flagged risk came true).

> Resume: `/oran-software-engineer` on `product-on-shelf-app`. Confirm the clean re-sweep (`seedAliases` →
> `resetPriceData` → `discoverAllPriceMail` to COMPLETE) filled `Price` across switches + servers + the xlsx-sourced
> firewall/server parts; map the new `_alias` blanks. Then wire the READ path (`Code.gs doGet` → `window.PRICING`
> from `Price`, Firewall parity first), then the template-fill quotation export. Commit the uncommitted
> `Ingest_Email.gs` edits (crash fix + scan-all + mappings + xlsx-v3).

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-01 · software-engineer mode · Flow-diagram revision ONLY (no code/ingestion changes)_

## Stage
Documentation/diagram only. The system is unchanged from the prior session — **🔴 read path still
unwired** (app serves mock `DEFAULTS`); ingestion (`Ingest_Email.gs`) untouched. This session only
revised the architecture flow diagram to match the current built flow.

## What changed this session (all in `product-on-shelf/Flow diagram/Product on shelf-3.excalidraw`)
1. **Email-ingestion labels → current flow:** source node `Email [EXT]` → `Supplier price email / HTML + xlsx · HW & SW`;
   detail box now reads *by distributor domain (+[EXT]) · HTML tables + xlsx attach · `_alias` maps part→SKU (gate) ·
   daily + full-inbox discovery* (was the stale `filter [EXT] / ~30 mailboxes / backfill 9mo`).
2. **Corrected the mechanism (Oran's catch):** the diagram wrongly showed **Webhook** doing the fetch.
   Rewired BOTH integration clusters (email + GSheet cost/RFQ) so **Google Apps Script** is the engine in
   the data path (`fetch/read → upsert/ingest → Database`) and **Webhook → Google Chat is notify-only** (side branch).
3. **Full clean-grid relayout** (Oran: "not clean"): horizontal main-flow band; **Database = 4-edge hub**
   (HW/SW left · KB top `feeds specs` · email `upsert` right · cost `ingest` bottom); uniform node sizes;
   all arrows orthogonal (H/V, no diagonals); legend moved down to clear the loop return.
4. **Diagnosed "text messed up"** = `excalidraw_export` writes `y="NaN"` on every `<text>` (font missing) →
   garbled PNG. **Render-tool bug only; the `.excalidraw` file is correct.** Produced a corrected hi-res PNG.

## Open questions / decisions
- 🟡 **Dropped the long note→Database connector arrow** during cleanup — "DB content (GG-Sheet)" is now a
  standalone labelled annotation (lower-left). Offered to restore the connector.
- 🟡 Both Apps Script engines push to the central **Database** (kept the original arrow target). Confirm the
  cost/SOW path shouldn't instead feed **Output / Quotation**.
- ⚪ Old `Product on shelf.png` (May 29, an earlier diagram) left untouched — offered to replace it.
- 🔴 **Unchanged blocker:** read path still unwired (`Code.gs doGet` → inject `window.PRICING` from `Price`).

## Next concrete step
Unchanged from prior session — **wire the READ path**: `Code.gs doGet` → `createTemplateFromFile` + inject
`window.PRICING` from the catalog `Price` tab (Firewall parity first). The diagram is now current.

## Suggested skills
- **`/oran-software-engineer`** — code work. For diagrams: render via the **NaN-fix** path
  (`[[reference-excalidraw-export]]` memory updated this session with the `y="NaN"` gotcha + fix).

## Artifacts produced this session
- `product-on-shelf/Flow diagram/Product on shelf-3.excalidraw` — revised (flow correction + clean relayout).
- `product-on-shelf/Flow diagram/Product on shelf-3.png` — **new** hi-res readable export (NaN-fixed).
- Pre-cleanup backup `/tmp/pos3_backup.excalidraw` (throwaway).
- Memory `reference_excalidraw_export.md` — added the `excalidraw_export` `y="NaN"` render bug + SVG post-fix.

## Decisions (the why)
- **Apps Script in the data path, Webhook = notify** — matches `Ingest_Email.gs` (GAS time-trigger pulls/writes;
  optional Chat notify via webhook). The webhook never fetches or writes the DB.
- **Database-as-hub with one input per edge + orthogonal arrows** — eliminates the diagonal crossings that
  made it read messy; keeps it an Excalidraw process-flow (Oran chose "tidy this", not a drawio rebuild).
- **Don't trust the export PNG for text** — `excalidraw_export` can't load the font; the file was always fine.

## Working tree
- Diagram files above are **uncommitted**. Prior `Ingest_Email.gs` edits also still uncommitted (per prior handoff).

> Resume: `/oran-software-engineer` on `product-on-shelf-app` — diagram is current; wire the READ path
> (`Code.gs doGet` → inject `window.PRICING` from `Price`, Firewall parity first), then the template-fill quotation export.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-01 evening → 2026-06-02 · software-engineer mode · UI/UX + RBAC_

## Stage
Read path was already wired (commit `60769a0`, `ReadPath.gs`). This session = **UI/UX polish + a new
product menu + full RBAC with an admin web editor**. All pushed to Apps Script `@HEAD`. **Only the
backfill-removal is committed (`152a908`, pushed to GitHub); items 2–8 below are UNCOMMITTED in the working tree.**

## Built this session (branch `product-on-shelf-app`)
1. **Removed obsolete email-backfill entry points** — `backfillEmailPrices`/`resetBackfill` + orphan
   `BACKFILL_MONTHS` knob (superseded by discovery). Run dropdown 10→8. **Committed `152a908` + pushed to GitHub.**
2. **Brand dropdown + Model-only on ALL price lists** (`_pricelist.html` engine + firewall `fwlist.html`):
   added explicit `brand` to all 81 mock items; Brand select filters Model; hardware strips the brand
   prefix (model-only), software keeps full names. `ReadPath.gs` now emits `brand` so live prices group too.
3. **New "Cabling & SFP+" hardware menu** — `panels/cabling.html` (price-list-only), home card, sidebar nav,
   `DEFAULTS.cabling` (12 items; brands Cisco/Allied Telesis/H3C/Fibre/Copper), `ReadPath` `cabling:'cabling'`,
   MANIFEST entry. **Accessory mode** (`accessory:true`): device-only quotation, NO MA/SLA/SOW/location/support.
   Re-mapped **22 transceiver/DAC/optic aliases `switch:*`→`cabling:*`** in `Ingest_Email.gs` (switches/line-cards/
   modules stay `switch:`).
4. **Storage + Server/HCI tabs "Refresh"→"Replacement"** (tab labels + home cards + guide line). Internal
   `data-tab="st-refresh"`/`hci-refresh` keys kept (flow JS unchanged).
5. **Removed "Phase 1" header badge.**
6. **RBAC (email login + role)** — `Auth.gs` (NEW): `getUserContext` via `Session.getActiveUser()`,
   `lookupRole_` reads the **`_RBAC`** tab (schema-flexible col detection), `userContextJson_`. `Code.gs doGet`
   injects `window.USER`; `build.py` emits the `window.USER` bootstrap; `src/flows/_rbac.html` (NEW) gates the
   UI by role (admin sees Settings/UI Kit/Users&Roles; everyone else = viewer). `.claspignore` +`!Auth.gs`.
7. **Admin "Users & Roles" web editor** — `panels/admin.html` + `flows/_admin.html` (NEW): CRUD over `_RBAC`
   via `google.script.run` → `rbacList`/`rbacSave`/`rbacRemove`, each **guarded by `requireAdmin_()` server-side**.
   Self-lockout guard (can't remove own row). Sidebar nav "Users & Roles" (admin-gated).
8. **Job position separated from role** — `position` column in `_RBAC` (auto-detected, or auto-created on first
   save), separate "Job position" field + table column in the editor. Role = access; position = title.

## Open / Oran's manual steps (Claude can't run GAS / change deployment / write Sheets)
- 🔴 **Activate RBAC**: Deploy → Manage deployments → **Execute as: Me · Access: anyone at scmtechnologies.co.th**.
  Required for identity + the admin editor's `google.script.run`. ⚠️ After this only @scm accounts can open the app
  (not personal gmail). Until done, you show as `viewer`/"not signed in".
- 🔴 **Confirm `_RBAC`** has an email + role column and your row = `admin` (run `setupRoles()` to seed/confirm).
  If the editor shows "could not find an email and a role column", paste the `_RBAC` headers for Claude to align detection.
- 🟡 **Move already-ingested SFP prices into the new menu**: existing live `_alias`/`Price` rows still carry
  `switch:*` keys (the code re-route only affects FUTURE ingestion). In the DB sheet, find-replace `_alias`
  `sku_key`: `switch:…sfp/glc/qsfp/at-sp…`→`cabling:…`, then `resetPriceData()` + `discoverAllPriceMail()`.
- 🟡 Only `admin` is elevated; `editor`/`sales`/`viewer` all = viewer-level UI. Define what each gates when ready.
- 🟡 Couldn't pixel-verify (this sandbox can't paint the CDN shell headless — even untouched views render blank).
  Verified via node logic tests + assembled `preview.html` greps + clasp push confirmation. Eyeball the live `/dev` URL.

## Next concrete step
Decide commit strategy for the uncommitted stack (items 2–8) — one commit or split per feature — then push to
GitHub. Then Oran does the deployment change + `setupRoles()` to activate RBAC. After that: the template-fill
quotation export (still pending, pre-existing).

## Suggested skills
- **`/oran-software-engineer`** — all code work. Verify: `node --check` on extracted `<script>`/`.gs`, the
  `var DEFAULTS` node logic harness, `python3 build.py --preview` + grep; `tools/push.sh` to ship `@HEAD`;
  `npx @google/clasp push -f | grep` to confirm a file landed. `.claspignore` is an ALLOWLIST — new `.gs` need `!Name.gs`.

## Artifacts produced this session (paths from `product-on-shelf/`)
- NEW: `Auth.gs`, `src/flows/_rbac.html`, `src/flows/_admin.html`, `src/panels/admin.html`, `src/panels/cabling.html`.
- MODIFIED: `Ingest_Email.gs` (backfill removal + SFP→cabling aliases), `ReadPath.gs` (brand + cabling view),
  `Code.gs` (USER_JSON), `build.py` (USER bootstrap + 3 MANIFEST entries), `.claspignore` (+Auth.gs),
  `src/flows/_pricelist.html` (brand + model-only + accessory), `src/flows/fwlist.html` (brand),
  `src/panels/{home,storage,hci,guide,firewall,01_shell_top}.html`, `index.html` (rebuilt).
- Commit `152a908` (backfill removal) — committed + pushed to GitHub `Oranninhun11/Claude`.

## Decisions (the why)
- **Explicit `brand` per item** (not first-word derivation) — needed so ws/m365 collapse under "Microsoft"
  (first-word would split User CAL/Device CAL). Hardware strips brand prefix; software keeps full names ("model only hardware").
- **`accessory:true` mode** for Cabling — transceivers/cables are device-only buys; MA/SLA/SOW/site-prep are
  wrong for them (Oran's explicit instruction). Reusable flag; only `cabling` uses it.
- **Identity = Google Workspace sign-in, role = `_RBAC` tab** — the only sane auth for a GAS web app; real
  boundary is the domain-restricted deployment. Client gating is cosmetic, so writes are admin-guarded server-side.
- **Execute as: Me (not user)** — so the server keeps owner rights to read/write the DB sheet for everyone;
  same-domain `getActiveUser()` still returns the signed-in user. No `appsscript.json` scope change → daily trigger untouched.
- **Schema-flexible `_RBAC`** (detect cols by header name; auto-add `position`) — Oran built `_RBAC` independently;
  the cached Drive export didn't include it, so the code adapts rather than hardcoding columns.

## References
- Seam pattern: `window.PRICING` bootstrap (`build.py` + `Code.gs` + `ReadPath.gs`) — `window.USER` mirrors it.
- `DB_SCHEMA.md`, `reference_product_on_shelf_deploy.md` (clasp v3, `@HEAD` review loop), live DB `1kzKWvaJN7z7…`.

> Resume: `/oran-software-engineer` on `product-on-shelf-app` — commit the uncommitted UI/UX + RBAC stack
> (items 2–8) and push to GitHub; Oran activates RBAC via the deployment change + `setupRoles()`. Then the
> template-fill quotation export.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-02 · software-engineer mode · commit + push + repo-rename findings_

## Stage
The UI/UX + RBAC stack from the prior section is now **committed and pushed**. The git remote
turned out to be **renamed/cleaned up by Oran** — diagnosed and handled. RBAC still needs Oran's
deployment change + `setupRoles()` to go live (unchanged).

## What happened this session
- **Committed `5b7e1c9`** ("product-on-shelf: price-list UX (brand+model), Cabling & SFP+, RBAC + admin
  editor") — scoped to `product-on-shelf/` ONLY (incl. the Flow-diagram changes + this handoff). Verified
  nothing outside `product-on-shelf/` was staged.
- **Diagnosed "why does GitHub show one dir?"** — the remote had advanced 5 commits beyond local: Oran
  (via GitHub web) ran `Delete .claude directory`, `Delete CLAUDE.md`, `Delete CLIENT_TRACKER.md`,
  `Create/Update README.md`. So the repo tip is **README + product-on-shelf only** by design.
- **Repo was also RENAMED** `Oranninhun11/Claude` → **`Oranninhun11/SCM_Product_on_shelf`** (revealed by the
  push "repository moved" notice). Updated the local remote URL (`git remote set-url enter …/SCM_Product_on_shelf.git`).
- **Reconciled the divergence safely**: local was *behind 5* (ancestor, not diverged). Committed pos →
  `git rebase --autostash enter/product-on-shelf-app` (replayed the pos-only commit on top of the deletes) →
  resolved the modify/delete autostash conflicts on the SCM files with `git reset -- .claude CLAUDE.md
  CLIENT_TRACKER.md` (kept Oran's content on disk, now **untracked**) → dropped the autostash → pushed.
- **Verified**: pushed tree = `README.md` + `product-on-shelf/` only; remote tip == local HEAD == `5b7e1c9`;
  Oran's local SCM files (`CLAUDE.md`, `CLIENT_TRACKER.md`, `.claude/`) all still present on disk.

## Open / Oran's manual steps
- 🔴 **Public-history exposure**: if `SCM_Product_on_shelf` is public, `.claude/`/`CLAUDE.md`/`CLIENT_TRACKER.md`
  are **still readable in older commits** (up to `152a908`, before the deletes). Deleting-the-file ≠ removing
  from history. Fix = make repo **private**, or **purge history** (`git filter-repo`/BFG + force-push). Claude
  offered to prep the filter-repo commands; can't change repo visibility (GitHub settings = Oran's action).
- 🔴 **Activate RBAC** (unchanged from prior section): deployment → Execute as Me · Access scmtechnologies.co.th
  domain; run `setupRoles()`; confirm `_RBAC` admin row.
- 🟡 SFP→cabling live re-route (sheet find-replace + reseed) and per-role gating still pending (prior section).

## Next concrete step
Decide the history-exposure action (private vs purge). Then activate RBAC (deployment + `setupRoles()`).
Then the template-fill quotation export (still the big pending feature).

## Suggested skills
- **`/oran-software-engineer`** on `product-on-shelf-app`. Remote is now `enter` → `SCM_Product_on_shelf`.
  `.claude/CLAUDE.md/CLIENT_TRACKER.md` are intentionally **untracked** in this repo — never re-add them.

## Decisions (the why)
- **Scoped commit to `product-on-shelf/` only** + `--autostash` rebase onto the remote's clean tip — keeps the
  public repo to one dir and never re-introduces the SCM files Oran deleted; his local copies stay on disk untracked.
- **Resolved modify/delete via `git reset -- <paths>`** (not stash-pop) — clears the conflict while preserving
  Oran's working content; nothing SCM ever enters a commit.

> Resume: `/oran-software-engineer` on `product-on-shelf-app` (remote `SCM_Product_on_shelf`) — settle the
> public-history exposure (private or purge), then activate RBAC (deployment + `setupRoles()`), then build the
> template-fill quotation export.

---

# Handoff — Product on Shelf (cont.)
_Session: 2026-06-02 (early AM, ~02:30 ICT) · software-engineer mode · discovery quota-burn fix + Option B attachment sweep_

## Stage
Ingestion hardening, `Ingest_Email.gs` only. Two fixes built, **verified, and pushed to Apps Script `@HEAD`** —
**NOT git-committed** (re-verified: HEAD `5b7e1c9`, `Ingest_Email.gs` = `M`, 0 occurrences of the new fns in HEAD).
Read path already wired; app serves live `Price`. The xlsx firewall/HCI/server prices are still **not yet in
`Price`** — Option B (below) is the path that pulls them; awaits Oran's GAS run after the quota resets.

## Verified first (don't re-do)
- **Live DB read-back** (`1kzKWvaJN7z7…`): `Price` = **51 rows / 26 SKUs**, all `switch` (Cisco/AlliedTelesis/H3C)
  + 2 `server` (RHEL). **No firewall / HCI / server-HW** — those arrive as `.xlsx` attachments (→ Option B).
- `_sync_log` showed the bug below; read path + items 2–8 confirmed committed (`60769a0`/`5b7e1c9`).

## 🔴 Bug found (root cause of the 06-01 quota death — was mis-believed "all by design")
`startDiscovery → _discoverTick_` was **non-convergent**: 06-01 it ran **~80× from 10:20–16:03**, every run
`upserted 0 / scanned ~319` (re-reading the same window), **never COMPLETE**, then exhausted the daily Gmail
quota (`Service invoked too many times: premium gmail` @16:03/19:14/19:17). Each 4.5-min batch can't clear a
dense recent boundary day (worse now Drive/xlsx slows each run) → cursor advances ≤1 day or stalls → re-reads
~319 msgs/run → reschedules every 60s until quota dies. A broad 12-mo whole-net sweep is quota-infeasible this way.

## Built + shipped (`Ingest_Email.gs`; syntax + node logic-harness verified; clasp-pushed `@HEAD` twice)
1. **Min guard** — `discoverAllPriceMail` sets `res.progressed` (new cursor == old → no progress; cursor left put);
   `_discoverTick_` **STOPS** on `progressed === false` and at `DISCOVER_MAX_TICKS: 20` instead of rescheduling.
   `startDiscovery`/`resetDiscover` reset `email_discover_ticks`. **12/12 harness cases pass.** Stops the burn —
   does NOT make a dense broad sweep complete (re-running `startDiscovery` will likely just log `NO PROGRESS`).
2. **Option B — targeted attachment sweep (the price-getter)** — `fetchAttachmentQuotes()` runs
   `{from:(distributors) [EXT]} has:attachment newer_than:12m` via `runIngest_` (reuses `_alias` gate, dedupe,
   `_sync_log`, xlsx reader) → pulls firewall/HCI/server `.xlsx` quotes; small set, converges in one run, idempotent.
   `scheduleDailyAttachmentSweep()` = daily trigger **16:00 Asia/Bangkok** (clears midnight-Pacific reset in PDT+PST);
   `stopDailyAttachmentSweep()` removes it. Knobs `ATTACH_MONTHS:12`, `ATTACH_THREADS:150`.

## Open questions / blockers
- 🔴 **Gmail quota not reset until ~14:00 Thai 06-02** (midnight US-Pacific). Anything touching Gmail before then quota-errors (harmless).
- 🔴 **Oran's GAS steps (Claude can't run GAS):** after ~2 PM Thai → `fetchAttachmentQuotes()` (backfill xlsx, watch
  `upserted N`), then `scheduleDailyAttachmentSweep()`. *OR* run `scheduleDailyAttachmentSweep()` **now** (quota-free —
  trigger install only) → first sweep auto-fires 16:00 today.
- 🟡 **Curation loop:** new xlsx parts land in `_alias` **blank** → hand to Claude → extend `ALIAS_SEED` + push →
  `seedAliases()` → re-run `fetchAttachmentQuotes()` to price them.
- 🟡 **Needs Drive API on** (Oran enabled 06-01). `upserted 0` with attachments present ⇒ check Drive.
- 🟡 Daily sweep re-checks 12mo each day (idempotent; lower `ATTACH_MONTHS` if it drags).
- 🟡 **NOT git-committed** — guard + Option B pushed to Apps Script, not committed (Oran approved pushes, not commits).

## Next concrete step
After ~14:00 Thai 06-02, Oran runs `fetchAttachmentQuotes()` + `scheduleDailyAttachmentSweep()` in the GAS editor;
then ping Claude to **read the live DB back** and report which firewall/HCI/server SKUs landed + which `_alias`
blanks need mapping. Then git-commit the pushed `Ingest_Email.gs` edits.

## Suggested skills
- **`/oran-software-engineer`** — verify by reading the live sheet back (Google read-only; can't run GAS);
  `npx @google/clasp push -f` locally; node logic harness for cursor/tick logic.

## Decisions (the why)
- **Min guard before full convergence** (Oran's pick) — stop the quota burn first; the targeted pass is the price-getter.
- **Option B = targeted `has:attachment`, not broad discovery** — broad 12-mo whole-inbox sweep is quota-infeasible +
  non-convergent; distributor+attachment is small, converges in one run, reuses all existing plumbing.
- **No-progress = STOP, not force-advance** — safest; force-advancing could skip data. Cursor left put so a re-run
  (after a `TIME_BUDGET_MS` bump) resumes from the same boundary.
- **Daily trigger 16:00 Thai (not 15:00)** — clears midnight-Pacific reset in both PDT (14:00 ICT) and PST (15:00 ICT).

## References
- Live DB `1kzKWvaJN7z7wdcYjbcZHYXZpFfIxsqFyBDg8Ysxs7kY` (read back to diagnose) · `DB_SCHEMA.md` (`buildCatalog`) ·
  `reference_product_on_shelf_deploy.md` (clasp v3 / `@HEAD` loop) · CLAUDE.md house rules.

> Resume: `/oran-software-engineer` on `product-on-shelf-app` — after Oran runs `fetchAttachmentQuotes()` +
> `scheduleDailyAttachmentSweep()` (post ~14:00 Thai 06-02), read the live DB back to confirm xlsx
> firewall/HCI/server prices landed + list new `_alias` blanks to map; then git-commit the pushed
> `Ingest_Email.gs` edits (guard + Option B).
