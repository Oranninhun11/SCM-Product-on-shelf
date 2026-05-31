# Product on Shelf

Presale / sales **ballpark price list** web app. After requirements come in, presale gets
an instant marked-up estimate (with negotiation buffer) — so low-probability deals can be
filtered out before the full quoting round-trip.

Runs as a **Google Apps Script web app** (HTML Service), because the org is on Google Workspace.

## Architecture

Two product groups in the sidebar: **Hardware** (Firewall, Network Switch, Server / HCI, Storage,
Wireless AP/WLC) and **Software** (Backup & DR, Endpoint Security, NAC, DLP, Captive portal,
Logging / SIEM). Each page holds one or more **projects** (e.g. *Replacement*, *New install*,
*Licensing*) shown as tabs; the sizing/pricing flow lives under a project tab. Hardware flows size by
box specs; software flows are licensed per **endpoint / user / AP / GB / site**.

Every option card has an **Add to estimate** button that feeds a shared **Custom estimate** cart
(`window.PoSEstimate`) — one line per product category, with a running grand total — so a multi-product
deal can be bundled into a single quote. Any unbuilt project renders a "coming soon" placeholder via
the `data-soon` filler.

### Editing — source layout & build

The `src/` partials are pushed to Apps Script as **separate files** (each `src/*.html` shows as
its own file in the editor). `index.html` is a **generated include-manifest — do not edit it
directly** (the next build overwrites it): 55 `<?!= include('src/…') ?>` lines in load order.
Code.gs serves it via `HtmlService.createTemplateFromFile('index').evaluate()`, so the includes
stitch the partials back together at request time. Edit the partials under `src/`, then:

```
python3 build.py            # regenerate index.html (include manifest) from src/ + MANIFEST
python3 build.py && npx @google/clasp push   # then deploy: npx @google/clasp deploy --deploymentId <id>
```

`src/` is split by concern, included in load-order by the MANIFEST in `build.py`:
- `00_head.html`, `01_shell_top.html`, `02_shell_bottom.html`, `99_foot.html` — head/style + app shell.
- `src/panels/<view>.html` — one `<section data-view="…">` markup panel per screen.
- `src/flows/<flow>.html` — one `<script>` IIFE per flow; `_core` (router), `_navdrawer`, `_cart`
  (`window.PoSEstimate`), `_quote` load **first** (flow IIFEs depend on them), so manifest order matters.

You add or remove a partial in the MANIFEST (single source of truth for order); `build.py`
regenerates both the manifest and, on demand, a preview. Because `index.html` is now a template
of `<?!=…?>` scriptlets it no longer renders by opening it in a browser — for local preview run
`python3 build.py --preview` and open the generated `preview.html` (concatenated monolith, local
only, not pushed). The preview is byte-identical to the served output. ⚠️ The SCM logo is
base64-inlined in `00_head.html` — edit that file surgically.

## Status

**Phase 1 — web shell / design system ✅**
- App shell — header (SCM B2B logo), sidebar nav, content area (shadcn/ui "zinc" aesthetic, à la [blocks.so](https://blocks.so)).
- Client-side router — landing page, per-project screens, **UI Kit** gallery, Settings.
- Reusable component classes — buttons, cards, inputs/selects, badges.

**Phase 2 — Firewall Replacement flow ✅**
- Pick existing model → throughput auto-detected → sized to ≥ existing ×1.2.
- Two option cards (**Fortinet / Palo Alto**) with a breakdown
  (device, site prep, implementation, support) and est. total; cheapest flagged **Best value**.
- Recomputes live as SOW scope / support term / SLA tier / # devices / location change.
- **All pricing is mock**, isolated in the `priceOption()` seam — see below.

**Server / HCI → Refresh flow ✅**
- Enter current vCPU / RAM / usable TB + vCPU:core overcommit → sizing applies
  **×1.2 growth buffer + N+1** (3-node HCI minimum).
- Two vendor cards (**Nutanix NX-3155-G9 / Supermicro + Proxmox**) showing node count,
  per-node spec, and a breakdown (hardware · software+support · implementation); cheapest flagged **Best value**.
- A sizing summary line shows the buffered requirement (cores @ ratio, RAM, usable TB).
- Recomputes live; **all pricing mock**, isolated in the `priceCluster()` seam.

**Network Switch → Replacement flow ✅**
- Pick existing switch → ports / speed / PoE detected → matched to an equivalent Cisco / Aruba model.
- Two option cards (**Cisco Catalyst / Aruba CX**) with a breakdown (device ×qty · implementation · support)
  and est. total; cheapest flagged **Best value**. PoE toggle adjusts device price.
- **All pricing mock**, isolated in its own `priceOption()` seam.

**Storage → Refresh flow ✅**
- Pick existing array → current usable TB / type detected → required usable TB sized with a
  **×1.2 growth buffer**, matched to an equivalent Dell / NetApp model.
- A **performance tier** (Capacity / General / Performance) maps to media class and a hardware factor;
  arrays are dual-controller HA, so there is no per-unit quantity.
- Two option cards (**Dell PowerStore / NetApp AFF**) with a breakdown (array · implementation · support)
  and est. total; cheapest flagged **Best value**. A sizing line shows the buffered TB.
- **All pricing mock**, isolated in its own `priceOption()` seam.

**Backup & DR → New / Renewal flow ✅** _(Software group — license only)_
- Enter number of protected instances (**Units of lic**) + edition + term → software license priced
  per instance/yr × edition multiplier × term, **incl. 20% buffer**.
- Two option cards (**Veeam Data Platform / Commvault Cloud**) with a per-instance breakdown and est.
  total; cheapest flagged **Best value**.
- Now a pure **software-license** flow: the old hardware repo sizing, dedup appliance, DRaaS replication
  and implementation lines have been **dropped** (this product moved Hardware → Software).
- **All pricing mock**, isolated in its own `priceOption()` seam.

**New install flows (Firewall / Switch / Server / Storage) ✅**
- Greenfield variants of the Replacement/Refresh flows — requirements are entered directly
  instead of detected from an existing model, then sized with the same buffers and priced
  from the same catalogs:
  - **Firewall** — required throughput + Single / HA-pair deployment (HA doubles the device);
    sized ≥ required ×1.2; Fortinet / Palo Alto cards. Own `priceOption()` seam (`fwn-*`).
  - **Network Switch** — required ports + PoE + quantity; matched ≥ required ports; Cisco /
    Aruba cards. Own `priceOption()` seam (`swn-*`).
  - **Server / HCI** — target vCPU / RAM / TB + overcommit; ×1.2 growth + N+1 + 3-node min;
    Nutanix / Supermicro cards. Own `priceCluster()` seam (`hcin-*`).
  - **Storage** — required usable TB + performance tier; sized ×1.2; Dell / NetApp cards.
    Own `priceOption()` seam (`stn-*`).
- **All pricing mock**.

**Wireless (AP/WLC) flow ✅** *(Hardware)*
- # APs + Wi-Fi standard + controller/cloud management; APs ×qty + controller (or cloud license) +
  per-AP licenses & support (SLA) + impl; Cisco / Aruba. `priceOption()` seam (`wl-*`).

**More hardware flows ✅**
- **Standalone Server** — qty + sockets + RAM + local disk; per-server base + RAM + disk ×qty +
  support; Dell PowerEdge / HPE ProLiant (`srv-*`).
- **Router / SD-WAN** — # sites + bandwidth tier; edge ×sites + per-site SD-WAN license & support;
  Fortinet Secure SD-WAN / Cisco Meraki (`rtr-*`).
- **Load balancer / ADC** — throughput tier + single/HA; appliance ×units + support; F5 BIG-IP /
  Citrix NetScaler (`adc-*`).
- **UPS / Power** — kVA load + runtime + redundancy; UPS sized to kVA ×runtime ×units + support;
  APC / Vertiv (`ups-*`).

**Software flows ✅**
- Licensed per endpoint / user / GB / site / core — single `Licensing` tab each, with a
  **New / Renewal** toggle (renewal drops implementation; support is bundled in the subscription, so
  there is no SLA tier). All mock-priced behind one `priceOption()` seam each:
  - **Virtualization** — # sockets + cores/socket + tier; three-way: VMware & Nutanix per-core
    (VMware enforces a 16-core/socket minimum), Proxmox per-socket; license ×term + impl;
    VMware / Nutanix / Proxmox (`virt-*`).
  - **Endpoint Security** — # endpoints + tier (EPP/EDR/XDR); subscription ×term + onboarding;
    CrowdStrike Falcon / Trend Vision One (`ep-*`).
  - **NAC** — # endpoints; one-time platform + per-endpoint licenses + impl; Cisco ISE /
    Aruba ClearPass (`nac-*`).
  - **DLP** — # users + coverage (endpoint/network/both); subscription ×term + impl;
    Forcepoint / Trellix (`dlp-*`).
  - **Captive portal** — # sites + concurrent-user tier; per-site license ×term + impl;
    Aruba ClearPass Guest / Cisco ISE Guest (`cp-*`).
  - **Logging / SIEM** — GB/day ingest + hot-retention; ingest license ×term + impl;
    Splunk / Microsoft Sentinel (`siem-*`).
  - **Email & SASE** — service type (Email security / SASE) switches the vendor pair; per-user
    ×term + impl; Mimecast / Proofpoint · Zscaler / Netskope (`esec-*`).

**Custom estimate (cart) ✅**
- Shared `window.PoSEstimate` store (id-based); a single delegated listener reads each clicked option
  card (category, vendor, model, total) — no per-flow wiring. Product lines use `id = category`
  (re-adding replaces); a **custom line** form (description + amount) adds free-form items
  (UPS, rack, cabling, misc license) with unique ids so several can coexist. The **Custom estimate**
  view lists every line with remove / clear and a running grand total; the sidebar shows a live
  item-count badge.

Not yet built: the data integrations (Google Chat webhook, email price-pull, Google Sheet lookup).

## Pricing seams (integration hand-off)

Each flow keeps its numbers behind **one function**, so the integration phase rewires one place per flow:

Each flow is its own self-contained `<script>` IIFE, so the names below repeat without clashing:

- **Firewall** — `priceOption()`, fed by `CATALOG` (models + hardware/license prices) and the knobs
  `IMPL_BASE` / `SLA_MULT` / `LOC_MULT` / `SITE_PREP` / `BUFFER`.
- **Network Switch** — `priceOption()`, fed by `CATALOG` (Cisco / Aruba models) and
  `IMPL_BASE` / `SLA_MULT` / `LOC_MULT` / `NONPOE_DISC` / `BUFFER`.
- **Server / HCI** — `priceCluster()`, fed by `VENDORS` (per-node specs + prices) and
  `GROWTH` / `BUFFER` / `MIN_NODES` / `IMPL_BASE` / `SLA_MULT` / `LOC_MULT`.
- **Storage** — `priceOption()`, fed by `CATALOG` (Dell / NetApp arrays) and
  `TIER_FACTOR` / `GROWTH` / `BUFFER` / `IMPL_BASE` / `SLA_MULT` / `LOC_MULT`.
- **Backup & DR** — `priceOption()` (software license per instance), fed by `META` (`veeam` / `commvault`
  `perInstanceYr`), an edition multiplier, term, and `BUFFER`. No repo/appliance/DRaaS sizing.

When the real source lands, replace each function's inputs with data fetched server-side
(Google Sheet + email) and returned to the page via `google.script.run`. Nothing else changes.

## Files

| File | Role |
|------|------|
| `index.html` | Generated include-manifest: `<?!= include('src/…') ?>` lines that stitch the partials together. Served as a template. **Do not edit — regenerate via `build.py`.** |
| `src/**/*.html` | The editable source, split by concern. Each is pushed as its own Apps Script file (`src/panels/home`, `src/flows/hci`, …). |
| `logo.png` | SCM B2B org logo (source of truth). Inlined as base64 into `src/00_head.html` so it works in HTML Service too. |
| `Code.gs` | Apps Script entry point — `doGet()` evaluates the `index` template; `include()` inlines each partial. |
| `appsscript.json` | Manifest. Web app, `access: DOMAIN` (Workspace-internal), timezone Asia/Bangkok. |
| `.clasp.json.example` | Template for the clasp config created at deploy time. |

## Preview locally

`index.html` is now a template (scriptlets don't render in a plain browser), so build the
concatenated monolith and open that instead:

```sh
python3 build.py --preview   # writes preview.html (local only, not pushed)
open preview.html            # macOS default browser
```

Edit partials under `src/`, rerun `--preview`, refresh. Tailwind + icons load from CDN.

## Deploy to Workspace (when the look is approved)

```sh
clasp login                         # interactive — authorize your Workspace account
clasp create --type webapp --title "Product on Shelf" --rootDir .
# clasp writes .clasp.json; then:
clasp push
clasp deploy
```

`clasp open` opens the script editor; the deployment URL is shown after `clasp deploy`.

## Design notes / trade-offs

- **No build step in Apps Script.** Tailwind runs via the Play CDN and components are
  hand-written to match the shadcn aesthetic (real shadcn/ui is React + a build step).
  The CDN prints a "not for production" console warning — acceptable for an internal tool;
  the production path is to pre-compile the CSS and inline it.
- **Split into partials (`index` + `<?!= include() ?>`).** The source lives under `src/` as
  separate files (readable in the Apps Script editor); `index.html` is a generated manifest that
  the server templates back together. The cost is that `index.html` no longer renders by opening
  it in a browser — `build.py --preview` regenerates a browser-openable monolith for the local loop.
- **Brand palette (SCM B2B).** Navy `#1f2a4d` (`--brand-navy`, also the `--primary`) for buttons,
  active text and focus; orange `#f15a28` (`--brand-orange`) as the single accent — logo, "Phase"
  badge, active-nav icon, card hover. Neutral shadcn base everywhere else keeps it minimal.
- **Theme tokens** live as CSS variables in `index.html` (`--primary`, `--brand-orange`, `--radius`, …),
  so re-theming is one block to edit. Tailwind colors use the `hsl(var(--x) / <alpha-value>)` form,
  so opacity modifiers like `bg-primary/90` work.
