# AI Value Realization Platform

An **Enterprise AI Value Management Platform** that connects AI investment → AI agents → business processes → operational KPIs → productivity → financial outcomes → Finance validation → enterprise value.

It follows the lifecycle **Discover → Baseline → Business Case → Implement → Measure → Validate → Realize → Optimize**, measures every process *before* and *after* AI on identical KPI definitions, attributes improvement to AI explicitly, separates capacity from cash, and lets Finance validate what becomes realized value.

It is a **multi-tenant SaaS application**: people sign up, create a **workspace per client or program**, invite colleagues by link with a role, and keep each client's organizations, initiatives, measurements, members, roles and settings completely separate. Nothing ships with sample data — each new workspace starts empty, with an optional editable starter catalog (industries, a Finance / Procurement / HR process taxonomy, KPI definitions and placeholder model-price tiers).

---

## 1. Deploy (GitHub → Vercel)

1. **Database** — create a PostgreSQL database (Vercel → Storage → *Neon Postgres*, or Supabase / Neon / RDS). Copy its connection string.
2. **Import the repo in Vercel** → *Add New Project* → select this GitHub repository. Framework: Next.js (auto-detected).
3. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the PostgreSQL connection string (if Vercel Postgres added it for you, keep it) |
   | `AUTH_SECRET` | a random string of 32+ characters (`openssl rand -base64 48`) |
   | `ALLOW_SIGNUP` | `true` (or `false` to make it invitation-only after you've signed up) |

4. **Deploy.** The build runs `vercel-build` = `prisma generate && prisma migrate deploy && next build`, which creates all tables on the first deploy.
5. Open the site → **Create an account** → your first workspace is created and you are its Enterprise Admin. Follow the **Getting Started** checklist.

## 2. Using it

- **Workspaces** — one per client/program. Switch or create from the selector (top left). Administration → Workspace: rename, ingestion API key, leave, delete.
- **Members** — Administration → Members → *Create invitation link* (email + role). Send the link; it works once and expires in 14 days. Change roles or remove members there.
- **Roles** — 8 built-in roles plus custom roles (Administration → Roles & permissions). Permissions and the benefit-governance workflow are enforced server-side.
- **Client structure** — Administration → Organizations (+ business units), Industries, Functions & processes, KPIs, Model prices: add, edit and delete inline.
- **Initiatives** — AI Portfolio → *New initiative* (baseline wizard). On an initiative: *Edit details* (stage, health, owners, classification, go-live…), *Delete*, business case, assumptions, agents, costs, KPI values, post-AI snapshot, monthly measurements, declared benefits, evidence, governance, leakage notes, scenarios.
- **Data in** — manual entry, CSV/Excel import (Data Import), or `POST /api/ingest/measurements` with the workspace API key.
- **Maturity** — Value Realization → maturity assessment per organization.

## 3. Local development

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL and AUTH_SECRET
docker compose up -d           # local PostgreSQL 16 (or use your own)
npx prisma migrate deploy
npm run dev                    # http://localhost:3000
```

Without `DATABASE_URL` the app runs on a temporary in-memory store (shown in the header) — fine for a quick look, but data is lost on restart. Production always needs PostgreSQL.

> Locked-down networks: Prisma is configured as a **Rust-free client** (`queryCompiler` + `@prisma/adapter-pg`). If the CLI cannot download its schema engine, apply `prisma/migrations/0001_init/migration.sql` with `psql`, or set `PRISMA_SCHEMA_ENGINE=js` (see `prisma.config.ts`).

### Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest — value engine, governance, advisor, reporting, tenancy, passwords
npm run build
```

### Security model

- Email + password accounts; passwords hashed with scrypt; sessions are signed HTTP-only cookies (7 days). Membership and role are re-read on every request, so removals apply immediately.
- Every repository is constructed for **one tenant**: reads filter by `tenantId`, writes either filter by it or prove the parent record belongs to it. Server actions additionally check every referenced id against the workspace.
- Invitation tokens and API keys are random 256-bit secrets; only their SHA-256 hashes are stored.
- Simple in-process sign-in throttling; add an edge rate limit / WAF for internet-facing deployments. To use SSO, replace the sign-in actions in `src/app/actions/auth.ts` — the rest of the app only calls `getSession()` / `requirePermission()`.

---

## 4. Architecture

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
    value-engine/              PURE calculation library (no React, no I/O) — see §6
    domain/                    Types, labels, Zod schemas
    data/                      Repository port + Prisma and in-memory adapters
    services/                  Portfolio evaluation, filters, insights, view-models, mutation/audit
    reporting/                 Report builders + CSV/Excel serializers
    advisor/                   Deterministic question answering + LLM narrator interface
    auth/                      Signed-cookie session abstraction + RBAC matrix
    integrations/              Connector registry, canonical import contracts, file parsing
  lib/catalog/starter.ts       Editable starter catalog provisioned into new workspaces
  lib/identity/                Accounts, workspaces, memberships, invitations (Prisma + in-memory)
prisma/                        schema.prisma, migrations/
tests/                         Vitest suites
docs/ARCHITECTURE.md           Architecture, data model and phased implementation plan
```

Dependency direction: `app → components → services → (value-engine, data, domain)`. Financial logic lives **only** in `lib/value-engine`; UI components never compute money. The browser re-uses the same engine for live previews and scenario sliders, so there is no duplicated logic.

---

## 5. Database

Normalized multi-tenant PostgreSQL schema (`prisma/schema.prisma`). **Tenancy & identity:** Tenant (workspace), UserAccount, Membership (role per workspace), Invitation, Role (per workspace). **Business data** (all scoped by `tenantId`): Organization, Industry (+ use cases), BusinessUnit, FunctionDomain, Process (Process › Sub-process › Activity › Task), KpiDefinition/KpiValue, Initiative, BusinessCase, MetricSnapshot (BASELINE / TARGET / ACTUAL), Measurement, AiAgent + tasks + performance, ModelPrice, CostItem, CapacityDisposition, Benefit + Evidence + BenefitValidation, Assumption, Scenario, LeakageNote, Benchmark, MaturityAssessment, AuditLog, Report, AppSetting.

Money is `Decimal(18,2)`; rates are `Decimal(9,6)` fractions. **Benefits are never stored as numbers when they can be derived** — derived lines store only their driver; value is recomputed from measurements on every request.

---

## 6. Calculation methodology

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

### Worked example

Baseline 500,000 transactions, 50 FTE, AHT 25 min, ₹1.5M loaded cost, 8% errors, 12% rework, 3.5-day cycle → post-AI 10 min, 3% errors, 4% rework, 1.2 days, 65% automation, 80% adoption, 75% attribution. The engine computes ≈54,400 hours released, 30.2 FTE capacity, cost/txn ₹150 → ≈₹79 (incl. AI run cost), and separates cashable savings from cost avoidance and redeployed capacity. It also flags that volume × effort implies ~124 FTE vs 50 reported — a baseline reconciliation warning — and uses the FTE-calibrated basis until reconciled. (This case lives in the unit-test fixtures, not in the app.)

## 7. Assumptions (defaults, all configurable per workspace in Settings)

Discount rate 10% · 3-year horizon · ROI basis “all financial” · year-1 benefit ramp 75% · 1,800 productive hours per FTE · composite score on with weights 25/15/10/10/15/10/5/10.

---

## 8. Extending

| Task | How |
|---|---|
| **Add an industry** | Administration → Industries. To change what new workspaces start with, edit `src/lib/catalog/starter.ts` |
| **Add a process** | Administration → Functions & processes → pick function/domain and parent, level and execution mode. IT/Legal are pre-registered as future domains |
| **Add a KPI** | Administration → KPIs (name, unit, direction). Values are captured per initiative (baseline/target/actual) in `KpiValue` |
| **Add a report** | Add a `ReportType` + builder branch in `src/lib/reporting/builders.ts`. Sections (`kpis`, `text`, `bullets`, `table`, `waterfall`) render in the print view and serialise to Excel/CSV automatically |
| **Add a connector** | Implement `ConnectorAdapter` in `src/lib/integrations/connectors.ts` returning canonical rows; they pass through the same Zod schemas as file import |
| **Change governance** | Administration → Governance workflow (roles per step, evidence requirement) |
| **Model prices** | Administration → Model prices. Never hard-coded; starter tiers are placeholders |
| **Plug in an LLM** | Implement `AdvisorNarrator` (`src/lib/advisor/narrator.ts`). It only receives the deterministic answer and its output is rejected if it introduces numbers not present in the facts |
| **SSO** | Replace the actions in `src/app/actions/auth.ts` with your IdP; the rest of the app only calls `getSession()` / `requirePermission()` |

## 9. API

- `POST /api/advisor` `{ question }` — deterministic answer with table and links.
- `GET /api/export?report=executive|process|cfo|portfolio&format=xlsx|csv[&initiative=…][&org=…][&fn=…]`
- `POST /api/import` (multipart `file`) — dry-run parse + validation; commit via the Import page.
- `GET /api/import/template` — CSV template.
- `POST /api/ingest/measurements` — `Authorization: Bearer <workspace API key>` (Administration → Workspace); `{ rows: MeasurementRow[] }` where `initiative` is the initiative code. Rows can only reach that workspace.

PDF export uses the print-optimised report view (Print / Save as PDF).
