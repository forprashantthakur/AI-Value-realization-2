# AI Value Realization Platform

An **Enterprise AI Value Management Platform** that connects AI investment → AI agents → business processes → operational KPIs → productivity → financial outcomes → Finance validation → enterprise value.

It follows the lifecycle **Discover → Baseline → Business Case → Implement → Measure → Validate → Realize → Optimize**, measures every process *before* and *after* AI on identical KPI definitions, attributes improvement to AI explicitly, separates capacity from cash, and lets Finance validate what becomes realized value.

> All organizations and data shipped with the platform are **fictional**. Benchmarks and model prices are **illustrative placeholders** and are labelled as such everywhere.

---

## 1. Quick start

### Zero-setup (in-memory demo store)

```bash
npm install
npm run dev            # http://localhost:3000
```

With no `DATABASE_URL`, the app runs on an in-memory repository seeded with the demo portfolio. Changes persist until the server restarts.

### PostgreSQL

```bash
cp .env.example .env.local           # set DATABASE_URL and AUTH_SECRET
docker compose up -d                 # or use an existing PostgreSQL 14+
npx prisma migrate deploy            # applies prisma/migrations/0001_init
npm run db:seed                      # loads the fictional demo portfolio
npm run dev
```

The header badge shows the active data source (“PostgreSQL” or “In-memory demo store”).

> Locked-down networks: Prisma is configured as a **Rust-free client** (`queryCompiler` + `@prisma/adapter-pg`), so no query-engine binary is needed at runtime. If the CLI cannot download its schema engine, apply `prisma/migrations/0001_init/migration.sql` with `psql`, or set `PRISMA_SCHEMA_ENGINE=js` to use the bundled WASM schema engine (see `prisma.config.ts`).

### Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next/core-web-vitals + typescript)
npm test            # vitest — 56 tests over the value engine, governance, advisor, reporting
npm run build       # next build
```

### Trying roles

Use the persona switcher (top right) to act as Enterprise Admin, AI Value Office, Finance Validator, Business Owner, Process Owner, AI Product Owner, Consultant or Viewer. Permissions and the governance workflow are enforced server-side.

### Managing roles

Sign in as **Enterprise Admin** (or any role with *Manage users and roles*) and open **Administration → Users & roles**:

- **Add a role:** enter a name and description, optionally start from an existing role's permissions, tick permissions, click **Add role**. Custom roles get IDs like `CUSTOM_RISK_OFFICER`.
- **Change a role:** tick or untick permissions in its row and click **Save**. Built-in roles can be adjusted; Enterprise Admin is locked to all permissions.
- **Delete a role:** click **Delete** on a custom role, choose where its users move, confirm. The role is also removed from governance steps (a step never ends up with nobody allowed).
- **Assign users:** change a user's role in the Users table. The last Enterprise Admin can't be demoted.
- To let a custom role perform benefit sign-offs, tick it under **Administration → Governance workflow**.

Every change is audited. With PostgreSQL, apply `prisma/migrations/0002_custom_roles` (`npx prisma migrate deploy`).

---

## 2. Architecture

```
src/
  app/                         Next.js App Router (UI + transport only)
    (app)/…                    Dashboard, Cockpit, Portfolio, Value Realization, Processes, Agents,
                               Business Cases, Measurements, Benchmarks, Scenarios, Reports, Import,
                               Admin, Settings, initiatives/[id]/[tab] (14-tab workspace)
    actions/                   Server actions (Zod-validated, RBAC-checked, audited)
    api/                       advisor · export (xlsx/csv) · import (dry-run) · ingest/measurements
  components/
    ui/                        shadcn/ui-style primitives (Radix + Tailwind + cva)
    charts/                    Recharts wrappers: waterfall, bars, trend, bubble heatmap, radar
    value/ initiative/ admin/  Domain components: KPI card, Explain dialog, value tree, agent flow…
  lib/
    value-engine/              PURE calculation library (no React, no I/O) — see §4
    domain/                    Types, labels, Zod schemas
    data/                      Repository port + Prisma and in-memory adapters
    services/                  Portfolio evaluation, filters, insights, view-models, mutation/audit
    reporting/                 Report builders + CSV/Excel serializers
    advisor/                   Deterministic question answering + LLM narrator interface
    auth/                      Signed-cookie session abstraction + RBAC matrix
    integrations/              Connector registry, canonical import contracts, file parsing
  demo/                        Deterministic fictional demo generator (also used by prisma/seed.ts)
prisma/                        schema.prisma, migrations/, seed.ts
tests/                         Vitest suites
docs/ARCHITECTURE.md           Architecture, data model and phased implementation plan
```

Dependency direction: `app → components → services → (value-engine, data, domain)`. Financial logic lives **only** in `lib/value-engine`; UI components never compute money. The browser re-uses the same engine for live previews and scenario sliders, so there is no duplicated logic.

---

## 3. Database

Normalized PostgreSQL schema (`prisma/schema.prisma`) with entities for Organization, Industry (+ use cases), BusinessUnit, FunctionDomain, Process (self-referencing Process › Sub-process › Activity › Task with execution mode), KpiDefinition/KpiValue, Initiative, BusinessCase, MetricSnapshot (BASELINE / TARGET / ACTUAL), Measurement (monthly series), AiAgent + AgentTask + AgentPerformance, ModelPrice, CostItem, CapacityDisposition, Benefit + Evidence + BenefitValidation (governance history), Assumption, Scenario, LeakageNote, Benchmark, MaturityAssessment/Score, Role, User, GovernanceStep, AuditLog, Report, AppSetting.

Money is `Decimal(18,2)`; rates are `Decimal(9,6)` fractions. **Benefits are never stored as numbers when they can be derived** — derived benefit lines store only their driver; value is recomputed from measurements on every request.

---

## 4. Calculation methodology

An original, transparent framework drawing on Benefits Realization Management (benefit owners, cashable vs non-cashable, post-go-live tracking), TEI-style economics (benefits, costs, risk-adjustment — here as attribution + confidence + scenarios), TCO/FinOps unit economics, activity-based costing, value-stream/process-mining measurement, management-accounting variance analysis, the Balanced Scorecard and AI portfolio management. No proprietary framework is reproduced.

Every engine output is a `Metric` with `value, formula, inputs, assumptions, confidence, example` — the ⓘ icon renders it as “Explain this calculation”.

| Concept | Formula (engine module) |
|---|---|
| Effort / transaction | AHT + rework rate × rework minutes (`capacity.ts`) |
| Labour hours | Volume × effort ÷ 60 × k, where k = 1 (activity basis) or (baseline FTE × productive hours) ÷ (baseline volume × effort) (FTE-calibrated). Baseline and post-AI are compared **at post-AI volume** so volume changes are not credited to AI |
| Hours released | Baseline hours − post-AI hours |
| FTE capacity | Hours released ÷ productive hours per FTE |
| Capacity disposition | Released value split into cashable · cost avoidance · redeployed · revenue-producing · unallocated. **Only cashable and cost avoidance are money**; revenue must be evidenced separately |
| Cycle-time improvement | (Baseline − current) ÷ baseline (`productivity.ts`) |
| Productivity uplift | Post-AI output per *required* FTE ÷ baseline output per FTE − 1 |
| Quality improvement | (Baseline error − post error) ÷ baseline error; cost of poor quality avoided = volume × Δerror × downstream cost per error (`quality.ts`) |
| Cost / transaction | (labour + process tech + outsourcing + AI run cost) ÷ volume (`financial.ts`) |
| Attribution | Attributed = gross × AI attribution %, per benefit line with confidence (`attribution.ts`) |
| TCO | One-time implementation + recurring technology/operating + derived LLM tokens (`tco.ts`) |
| Token economics | Calls × [in × (1−cache) × P_in + in × cache × P_cached + out × P_out] ÷ 1M (`agent-economics.ts`) |
| ROI | (Σ benefits − Σ costs) ÷ Σ costs over the horizon, with year-1 ramp (`roi.ts`) |
| Payback | One-time investment ÷ monthly net benefit (plus ramp-adjusted cumulative payback) |
| NPV / IRR / BCR | Discounted net cash flows at the configured rate; IRR by bisection; PV(benefits) ÷ PV(costs) (`npv.ts`) |
| Value ladder | Potential → Business case → Run-rate → Measured → Business-validated → Finance-validated → Realized → Sustained, gated by benefit governance status (`leakage.ts`) |
| Leakage | Sequential substitution in fixed order: volume → adoption → automation/effort → quality & rate → declared → validation |
| Adoption re-blending | Blended = adoption × AI-path value + (1 − adoption) × baseline. Recovers the AI-path from a measured snapshot and powers Potential, Business Case and scenarios (`adoption.ts`) |
| Realized (top-down) | Potential × Adoption × Performance × Attribution — a configurable cross-check, never a replacement |
| Scorecard | Each dimension = actual ÷ plan (capped at 120); optional composite = weighted average with visible weights (`scorecard.ts`) |
| Data confidence | Rule-based 10-point rating (source quality, frequency, evidence breadth, sample size, finance validation) — explicitly *not* a statistical confidence (`attribution.ts`) |
| Maturity | Level = floor(average), capped at lowest dimension + 1; never substitutes for ROI (`maturity.ts`) |

**Measured vs estimated vs intangible**: a line valued from targets (no post-AI measurement) is always *Estimated*; intangible lines never carry currency; forecast-only initiatives are excluded from portfolio realized totals and labelled “forecast” everywhere.

### Source-to-Pay reference case (demo `S2P-01`)

Baseline 500,000 transactions, 50 FTE, AHT 25 min, ₹1.5M loaded cost, 8% errors, 12% rework, 3.5-day cycle → post-AI 10 min, 3% errors, 4% rework, 1.2 days, 65% automation, 80% adoption, 75% attribution. The engine computes ≈54,400 hours released, 30.2 FTE capacity (post-AI requirement ≈19.8 FTE), cost/txn ₹150 → ≈₹79 (incl. AI run cost), and separates cashable savings from cost avoidance and redeployed capacity. It also flags that volume × effort implies ~124 FTE vs 50 reported — a baseline reconciliation warning — and uses the FTE-calibrated basis until reconciled.

---

## 5. Demo data

`src/demo` generates 24 fictional initiatives across 8 fictional organizations (Banking, Financial Services, Insurance, Pharma, Retail, Manufacturing, Automotive, E-commerce), 54 agents, 12–20 months of measurements each, benefit lines at every governance status, evidence, audit history, leakage notes, scenarios and maturity assessments. Only operational inputs are generated — every value shown is computed by the engine.

## 6. Assumptions (defaults, all configurable in Settings)

Discount rate 10% · 3-year horizon · ROI basis “all financial” · year-1 benefit ramp 75% · 1,800 productive hours per FTE · composite score on with weights 25/15/10/10/15/10/5/10.

---

## 7. Extending

| Task | How |
|---|---|
| **Add an industry** | Administration → Industries (or add to `src/demo/reference.ts` / seed). Methodology is shared; supply use cases, focus KPIs and benchmarks |
| **Add a process** | Administration → Functions & processes → pick function/domain and parent, level and execution mode. IT/Legal are pre-registered as future domains |
| **Add a KPI** | Administration → KPIs (name, unit, direction). Values are captured per initiative (baseline/target/actual) in `KpiValue` |
| **Add a report** | Add a `ReportType` + builder branch in `src/lib/reporting/builders.ts`. Sections (`kpis`, `text`, `bullets`, `table`, `waterfall`) render in the print view and serialise to Excel/CSV automatically |
| **Add a connector** | Implement `ConnectorAdapter` in `src/lib/integrations/connectors.ts` returning canonical rows; they pass through the same Zod schemas as file import |
| **Change governance** | Administration → Governance workflow (roles per step, evidence requirement) |
| **Model prices** | Administration → Model prices. Never hard-coded; shipped tiers are illustrative |
| **Plug in an LLM** | Implement `AdvisorNarrator` (`src/lib/advisor/narrator.ts`). It only receives the deterministic answer and its output is rejected if it introduces numbers not present in the facts |
| **Authentication** | Replace `signIn` in `src/lib/auth/session.ts` with your IdP; the rest of the app only calls `getSession()` / `requirePermission()` |

## 8. API

- `POST /api/advisor` `{ question }` — deterministic answer with table and links.
- `GET /api/export?report=executive|process|cfo|portfolio&format=xlsx|csv[&initiative=…][&org=…][&fn=…]`
- `POST /api/import` (multipart `file`) — dry-run parse + validation; commit via the Import page.
- `GET /api/import/template` — CSV template.
- `POST /api/ingest/measurements` — bearer `INGEST_API_KEY`; `{ rows: MeasurementRow[] }`.

PDF export uses the print-optimised report view (Print / Save as PDF).
