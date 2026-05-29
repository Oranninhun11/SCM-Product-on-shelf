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
