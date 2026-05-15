---
description: End-to-end presale workflow. Runs all 7 agents in sequence to produce a complete customer proposal package from a TOR/RFP/customer ask.
---

# /propose — End-to-End Presale Orchestration

You are orchestrating the SCM Technologies presale workflow. The user has invoked `/propose` with input that should describe a customer opportunity (TOR/RFP text, customer name, paste from email, or path to a TOR file).

User input: $ARGUMENTS

## Workflow

Run the agents in this order. Each agent's output feeds the next. Save all artifacts to `data/working/<customer>/`.

### Step 0 — Setup
1. Identify the customer name from the input. If not obvious, ask the user once.
2. Create `data/working/<customer>/` if it doesn't exist.
3. Confirm the input language (Thai / English) and tell the user you'll mirror it.

### Step 1 — Intake
Spawn `intake-qualifier` agent with the raw customer input.
- **If verdict is NO-BID** → stop, show the brief to user, ask whether to continue anyway.
- **If verdict is ESCALATE** → stop, show the brief, ask for guidance.
- **Otherwise** → save brief to `data/working/<customer>/01_intake.md` and continue.

### Step 2 — Compliance + Sizing (PARALLEL)
Spawn `compliance-mapper` and `sizing-engineer` **in the same message** (parallel execution).
- compliance-mapper input: TOR text + intake brief
- sizing-engineer input: any RVTools file from `data/knowledge_base/01_RVTools/` matching customer, OR intake brief estimates

Save outputs to:
- `data/working/<customer>/02_compliance.md`
- `data/working/<customer>/03_sizing.md`

**Gate:** if compliance < 60%, stop and surface NO-BID recommendation to user.

### Step 3 — Architecture
Spawn `solution-architect` with intake + compliance + sizing as input.
Save to `data/working/<customer>/04_architecture.md`.

### Step 4 — BoM
Spawn `bom-pricer` with architecture output.
Save to `data/working/<customer>/05_bom.md`.

### Step 5 — Proposal Outline
Spawn `proposal-writer` with all upstream artifacts.
Save to `data/working/<customer>/06_proposal.md`.

### Step 6 — QA Review
Spawn `qa-reviewer` to audit the full `data/working/<customer>/` package.
Save to `data/working/<customer>/07_qa.md`.

**Gate:**
- READY TO DELIVER → present final summary to user
- FIX REQUIRED → loop back: re-spawn the responsible agent(s) with QA feedback, then re-run QA
- BLOCKED → stop and present blockers to user

### Step 7 — Final Summary
Present to the user (in their language):
```
✅ Proposal package ready for [Customer]

Files: data/working/<customer>/
├── 01_intake.md
├── 02_compliance.md      Compliance: XX%
├── 03_sizing.md          [Platform] | X nodes
├── 04_architecture.md    Recommendation: [Option]
├── 05_bom.md             Grand Total: THB TBD/value
├── 06_proposal.md        10-slide outline ready
└── 07_qa.md              QA: READY TO DELIVER

Next step: assemble PowerPoint from 06_proposal.md, attach BoM, send.
Update CLIENT_TRACKER.md status.
```

## Rules for orchestration
- Use TaskCreate to track the 7 steps; mark each completed as agents return.
- Run Step 2 agents in **parallel** (one message with two Agent calls). Everything else is sequential.
- If any agent fails or returns "missing info", stop and ask the user — don't fabricate inputs.
- Always update `CLIENT_TRACKER.md` after delivery (add row to Active or update existing).
- Mirror customer language across all artifacts.
