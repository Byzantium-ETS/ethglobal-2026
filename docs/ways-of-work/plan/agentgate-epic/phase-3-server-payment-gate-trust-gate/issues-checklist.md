# Issues Checklist — Phase 3: Server Payment Gate + Trust Gate

## Scope Source
- Epic: https://github.com/Byzantium-ETS/ethglobal-2026/issues/2
- Section implemented by this plan: **Phase 3 — Server: Payment Gate + Trust Gate**
- Parent epic issue: `#2`

---

## 1) Pre-Creation Preparation

- [ ] Confirm labels exist (or create):
  - `feature`, `user-story`, `enabler`, `test`
  - `priority-critical`, `priority-high`, `priority-medium`
  - `value-high`, `value-medium`
  - `backend`, `infrastructure`, `testing`, `phase-3`, `trust`, `payments`, `trial-gating`, `x402`, `policy`
- [ ] Confirm project board columns exist: `Backlog`, `Sprint Ready`, `In Progress`, `In Review`, `Testing`, `Done`
- [ ] Confirm custom fields exist: `Priority`, `Value`, `Component`, `Estimate`, `Phase`, `Epic`
- [ ] Confirm parent epic issue `#2` remains open and tracked on board

---

## 2) Issue Creation Order (Dependency-Aware)

### Step A — Feature Container
- [ ] Create feature issue: **Phase 3 — Server Payment Gate + Trust Gate** (`#P3-FEATURE` placeholder)
- [ ] Link feature issue to parent epic `#2`
- [ ] Add labels: `feature`, `priority-critical`, `value-high`, `backend`, `phase-3`
- [ ] Add estimate: `M (13 points)`

### Step B — Technical Enablers (create first)
- [ ] Create **#P3-E1**: World proof verification middleware and request context mapping
  - Labels: `enabler`, `priority-high`, `value-high`, `backend`, `trust`, `phase-3`
  - Estimate: `3`
- [ ] Create **#P3-E2**: Seller wallet + pricing + 402 challenge config
  - Labels: `enabler`, `priority-critical`, `value-high`, `backend`, `infrastructure`, `phase-3`
  - Estimate: `2`
- [ ] Create **#P3-E3**: Trial counter store and policy evaluator
  - Labels: `enabler`, `priority-high`, `value-medium`, `backend`, `policy`, `phase-3`
  - Estimate: `2`

### Step C — User Stories
- [ ] Create **#P3-S1**: Verified users get N free calls before payment required
  - Blocked by: `#P3-E1`, `#P3-E3`
  - Labels: `user-story`, `priority-high`, `value-high`, `backend`, `trial-gating`, `phase-3`
  - Estimate: `5`
- [ ] Create **#P3-S2**: Unverified users must pay immediately
  - Blocked by: `#P3-E2`, `#P3-E3`
  - Labels: `user-story`, `priority-high`, `value-high`, `backend`, `payments`, `phase-3`
  - Estimate: `3`
- [ ] Create **#P3-S3**: Paid calls return explicit paid metadata
  - Blocked by: `#P3-E2`
  - Labels: `user-story`, `priority-medium`, `value-high`, `backend`, `x402`, `phase-3`
  - Estimate: `3`

### Step D — Test Issues
- [ ] Create **#P3-T1**: Trial boundary contract tests (`limit`, `limit+1`, identity mismatch)
- [ ] Create **#P3-T2**: HTTP 402 challenge payload contract tests
- [ ] Create **#P3-T3**: End-to-end server smoke for `free_trial → paid`
- [ ] Link tests to corresponding stories/enablers using `Blocked by`/`Related`

---

## 3) Parent/Child and Dependency Linking

### Required Links
- [ ] Feature (`#P3-FEATURE`) linked to Epic `#2`
- [ ] Stories linked to Feature
- [ ] Enablers linked to Feature
- [ ] Tests linked to stories/enablers they validate

### Blocking Graph
- [ ] `#P3-E1` blocks `#P3-S1`
- [ ] `#P3-E3` blocks `#P3-S1` and `#P3-S2`
- [ ] `#P3-E2` blocks `#P3-S2` and `#P3-S3`
- [ ] `#P3-S1` and `#P3-S2` should be complete before final integrated demo verification (`#P3-T3`)

---

## 4) Definition of Ready Checklist (per Story/Enabler)

- [ ] Story statement or enabler scope is clear and testable
- [ ] Acceptance criteria are concrete and measurable
- [ ] Dependencies are explicitly listed
- [ ] Estimate assigned (Fibonacci)
- [ ] Component and priority labels assigned
- [ ] Test strategy reference included

---

## 5) Definition of Done Checklist (per Story/Enabler)

- [ ] Implementation merged to default branch
- [ ] `npm --workspace @agentgate/server run build` passes
- [ ] Response contract verified for success + failure paths
- [ ] Trial and payment behavior validated with reproducible steps
- [ ] Documentation updated in `docs/` or `README.md` when behavior changes
- [ ] Related issues moved to `Done`

---

## 6) Sprint Recommendation

### Sprint P3-A (10 pts)
- [ ] `#P3-E1` (3)
- [ ] `#P3-E3` (2)
- [ ] `#P3-S1` (5)

### Sprint P3-B (8–10 pts)
- [ ] `#P3-E2` (2)
- [ ] `#P3-S2` (3)
- [ ] `#P3-S3` (3)
- [ ] `#P3-T2` / `#P3-T3` (optional +2)

---

## 7) Automation Setup Checklist

- [ ] Add/confirm workflow to auto-move linked issues on PR open/merge
- [ ] Add/confirm workflow to validate issue template fields on creation
- [ ] Add board rule to default new `phase-3` issues into `Backlog`
- [ ] Add saved board views:
  - [ ] Phase 3 by Priority
  - [ ] Phase 3 by Component
  - [ ] Blocked items only

---

## 8) Rollup Completion Gate (Phase 3)

- [ ] World proof middleware is active and emits verified identity context
- [ ] Free-trial logic is enforced for verified identities only
- [ ] Payment requirement is enforced with proper 402 challenge payload
- [ ] Paid path returns status + payment metadata
- [ ] Unified `/call` flow shows deterministic `free_trial` then `paid` transition

---

## 9) Optional MCP Execution Log (fill during issue creation)

- [ ] Feature issue created: `#____`
- [ ] Enabler issues created: `#____`, `#____`, `#____`
- [ ] Story issues created: `#____`, `#____`, `#____`
- [ ] Test issues created: `#____`, `#____`, `#____`
- [ ] All dependencies and links validated
