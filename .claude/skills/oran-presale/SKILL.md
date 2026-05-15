---
name: oran-presale
description: >
  Oran Ninhun's Presale / Solution Architect skill for SCM Technologies. Activate for ANY of:
  TOR/RFP compliance mapping, solution sizing (Nutanix, Proxmox, Supermicro, DR/DRaaS),
  proposal drafting, BoM generation, architecture design, vendor comparison, RVTools parsing.
  Triggers on: "size this", "compliance table", "proposal", "design a solution", "BoM",
  "customer requirement", "RFP", "TOR", "ทีโออาร์", "เปรียบเทียบสเปก", "Nutanix", "Proxmox",
  "HCI", "DRaaS", "tech refresh", "architecture", "RVTools".
  Always produce structured output with real model numbers — never generic specs.
  Mirror customer language (Thai/English); model numbers stay English. Pricing in THB.
---

# Oran Presale — Solution Architect Skill

## Pre-flight (every task)
1. **Detect language** of customer input. Default response to match (Thai ↔ English).
2. **Check `data/knowledge_base/03_Proposals/`** for an analogous past project — pattern-match BoM and slides.
3. **Check `data/knowledge_base/01_RVTools/`** if sizing is needed and no fresh RVTools provided.

---

## Module 1: TOR / RFP Compliance

**Input:** PDF text (paste extracted content) or typed requirements. TOR may be Thai — keep response in Thai if so.

**Step 1 — Extract:**
- Mandatory items (MUST/SHALL/ต้อง)
- Technical specs
- Commercial/SLA/support requirements (warranty years — Thai gov often requires 3–7y)
- Delivery timeline

**Step 2 — Compliance Table:**

| # | Requirement | Status | Response / Remark |
|---|-------------|--------|-------------------|
| 1 | [requirement] | ✅ / ⚠️ / ❌ | [specific response with real product] |

**Step 3 — Summary + Bid Gate:**
```
Total: XX | ✅ Comply: XX | ⚠️ Partial: XX | ❌ Non-Comply: XX
Compliance Rate: XX%
Key Risks: [list partial/non-comply items]

Bid Recommendation:
  ≥80%   → BID as-is
  60–79% → BID with explicit risk note + clarification request
  <60%   → NO-BID / escalate to sales for go/no-go
```

---

## Module 2: Solution Sizing

### 2A. RVTools-Driven Sizing (preferred)
When customer provides RVTools export (or one exists in `data/knowledge_base/01_RVTools/`):

| Tab | Field | Use For |
|-----|-------|---------|
| `vInfo` | Powerstate=PoweredOn count | Active VM count |
| `vInfo` | Provisioned MiB / In Use MiB | Storage raw (use "In Use" × 1.20) |
| `vCPU` | Sum of CPUs | Total vCPU |
| `vMemory` | Sum of Size MiB | Total RAM |
| `vHost` | CPU Model, Cores | Current host baseline |

**Output table:**
```
| Metric        | Current (RVTools) | +20% Buffer | Design Target |
| Active VMs    | XX                | —           | XX            |
| vCPU          | XXX               | XXX         | fits XX cores |
| RAM           | XXX GB            | XXX GB      | fits XX GB    |
| Used Storage  | XX TB             | XX TB       | XX TB usable  |
```

### 2B. Estimate-Based Sizing (when RVTools missing)
Industry ratios — **state explicitly as assumptions**:
- 4.6 vCPU per VM (source: average across past SCM projects)
- 14 GB RAM per VM
- 100 GB used storage per VM (general workload)

### 2C. Platform Path Selection
| Scenario | Path |
|----------|------|
| Enterprise / performance-critical | Nutanix NX-G10/G11 |
| Cost pressure / VMware exit | Proxmox on Supermicro |
| Offsite DR needed | SiS Cloud DRaaS |
| Hardware refresh only | Supermicro SuperServer |

### 2D. Node Selector (rough)
| Workload | Nutanix SKU | Proxmox/Supermicro |
|----------|-------------|---------------------|
| <30 VMs | NX-1065-G9 (3 nodes) | SYS-621C-TN12R (3 nodes) |
| 30–80 VMs | NX-3155-G9 (3–4 nodes) | BigTwin 2029BT-HNR (3–4 nodes) |
| 80–200 VMs | NX-8155-G9 (4–6 nodes) | BigTwin + JBOD scale |
| >200 VMs | NX-G10/G11 cluster (6+ nodes) | Multi-cluster Proxmox |

### 2E. Network Selector
**ToR (data plane):**
| Node Count | Recommended ToR pair |
|------------|---------------------|
| 3–4 nodes | Cisco Nexus 9300-48T (10G copper) OR Aruba CX 8325-48Y8C (10/25G) |
| 5–8 nodes | Cisco Nexus 93180YC-FX (10/25G SFP28) OR Aruba CX 8325 |
| 8+ nodes / G10-G11 | Cisco Nexus 93180YC-FX or 9336C-FX2 (100G uplink) |

**Always pair ToR switches in vPC (Cisco) / MLAG (Aruba) for redundancy.**

**Mgmt plane (OOB, 1GbE):**
- Cisco Catalyst 1000-48T or Aruba 6100-48G — separate from data plane

**Access layer (only if in scope):**
- Cisco Catalyst 9200L-48P-4G (PoE+, 48 port)
- Aruba 6300M-48G-PoE4+ (JL662A)
- FortiSwitch 148F-POE (if Fortinet-aligned)

**Cabling/Optics:**
- Intra-rack: DAC cables (10G/25G)
- Inter-rack / uplink: SFP28/QSFP28 optics + OM4 fiber
- Always include cables/optics in BoM — easy to forget, hard to procure last-minute

**Output template:**
```
## Sizing — [Customer]
[Sizing table from 2A or 2B]

Selected Platform: [Nutanix/Proxmox/...]
Node Model: [Real SKU]
Node Count: X (N+1 = X active + 1 spare)
Storage: [Real model] — XX TB usable

Assumptions: [list]
Reference: similar to [past project from 03_Proposals/]
```

---

## Module 3: Proposal Draft (PowerPoint)

**Pattern-match first:** check `data/knowledge_base/03_Proposals/` for similar project (HCI / Proxmox / Firewall / DR) and reuse slide flow.

**Slide outline — content bullets per slide:**
```
S1  Cover — Customer, project title, date, SCM Technologies
S2  Agenda — Executive Summary | Challenges | Solution | Architecture | BoM | Why SCM
S3  Executive Summary (C-level) — Problem → Solution → Business Outcome (no jargon)
S4  Current State / Challenges — Pain points + risk if unaddressed
S5  Proposed Solution — Name + description + key components
S6  Architecture — Compute / Storage / Network / Management (real model names)
S7  Options Comparison — Table: Option A vs B vs C (if applicable)
S8  BoM Summary — Item | Model | Qty | Purpose | (Price THB if known)
S9  Why This Solution / Why SCM — Technical fit + commercial fit + local support
S10 Next Steps — PoC / Survey / Commercial / Timeline
```

**Content rules:** Max 5 bullets/slide | S1–S4 = zero jargon | S5–S8 = real model numbers | Language matches TOR

---

## Module 4: BoM Generation

| # | Category | Brand | Model | Description | Qty | Unit | Unit Price (THB) | Total (THB) | Notes |
|---|----------|-------|-------|-------------|-----|------|------------------|-------------|-------|
| 1 | Compute | Nutanix | NX-3155-G9 | HCI Node, 2x Xeon, 512GB RAM | 3 | Node | TBD | TBD | N+1 |
| 2 | DC Switch (ToR) | Cisco | N9K-C93180YC-FX | 48p 10/25G SFP28 + 6p QSFP28 | 2 | Unit | TBD | TBD | vPC pair |
| 3 | Mgmt Switch | Cisco | C1000-48T-4G-L | 48p 1G OOB | 1 | Unit | TBD | TBD | mgmt plane |
| 4 | Access Switch | Aruba | JL662A (6300M-48G-PoE4+) | 48p PoE+, 740W | 2 | Unit | TBD | TBD | if access scope |
| 5 | Firewall | Fortinet | FortiGate-200F | NGFW, HA pair | 2 | Unit | TBD | TBD | HA |
| 6 | Optics/Cables | — | SFP-10G-SR / DAC-3M | as required | X | Each | TBD | TBD | — |
| 7 | Backup | Veeam | VBR Universal | per-VM license | X | License | TBD | TBD | — |

**Always include line items for:** Compute | DC Switch (ToR pair) | Mgmt Switch (1G OOB) | Access Switch (if in scope) | Firewall | **Optics & cables** | Software licenses | Backup (Veeam) | Management | Warranty SKU (state years — match TOR requirement) | Installation/PS services

Use `TBD` for prices you don't have — never invent numbers.

---

## Module 5: Architecture Design

**Output structure:**
1. Options table (Option | Platform | Pros | Cons | Best When)
2. Recommendation block:
```
## Recommendation: Option X — [Platform]
Why: [technical reason] + [business reason] + [customer constraint alignment]
Trade-off: [what we give up and why acceptable]
Reference: [past project from 03_Proposals/ — similar shape]
```
3. Layer breakdown: Compute → Storage → Network → Management → DR

---

## Quality Checklist (before delivering)
- [ ] Language matches customer (Thai TOR → Thai response)
- [ ] Real model numbers (not generic)
- [ ] Numbers present (vCPU, GB, TB, count)
- [ ] Single clear recommendation
- [ ] Business angle covered
- [ ] Table/bullet format — no paragraphs
- [ ] N+1 applied
- [ ] 20% growth buffer applied
- [ ] Currency stated (THB) where prices appear
- [ ] Past-project reference cited when analogous one exists
