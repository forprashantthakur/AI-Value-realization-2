# AI Value Realization Platform — Architecture & Implementation Plan

## 1. Repository review

The repository started empty (no existing code, no git history). Everything below is new.
Runtime available: Node 22, PostgreSQL 16.

## 2. Guiding principles

| Principle | How it is enforced |
|---|---|
| Value is a lifecycle, not a calculator | Every initiative moves through `Discover → Baseline → Business Case → Implement → Measure → Validate → Realize → Optimize` with stage gates. |
| Measured ≠ Estimated ≠ Intangible | Every benefit line carries a `nature` (`MEASURED`, `ESTIMATED`, `INTANGIBLE`). Intangible lines never carry a currency value. Dashboards split them visually. |
| Capacity ≠ Cash | Hours released are converted to FTE capacity, then split by an explicit **capacity disposition** (cashable / cost avoidance / redeployed / revenue-producing / unallocated). Only the classes a user declares become money. |
| Attribution before aggregation | Each benefit line has an AI-attribution % and a confidence level; all portfolio numbers are post-attribution. |
| Governance status gates the headline | Benefit status (`PROPOSED → MEASURED → BUSINESS_VALIDATED → FINANCE_VALIDATED → REALIZED → SUSTAINED`) determines which ladder rung it appears on. |
| Explainable by construction | The value engine returns `Metric` objects (value + formula + inputs + assumptions + confidence), never bare numbers. The UI renders an *Explain* dialog from them. |
| No fabricated external facts | Benchmarks and model prices are illustrative placeholders, labelled as such, and are fully configurable. |

## 3. Methodology sources (principles only — no proprietary framework copied)

* **Benefits Realization Management** (UK Government *Teal Book* ch. 19, APM, MSP-style practice): benefit owners, benefit profiles, cashable vs non-cashable, realization tracking after go-live.
* **TEI-style economics**: benefits, costs, flexibility and *risk adjustment* — implemented here as attribution % + confidence + scenario ranges rather than a single haircut.
* **TCO / FinOps**: one-time vs recurring cost, unit economics (cost / transaction, cost / agent task, cost / outcome).
* **Activity-Based Costing**: labour cost per transaction from minutes per activity × loaded hourly cost.
* **Process mining / value-stream measurement**: touch time vs cycle time, rework loops, exception rates.
* **Management-accounting variance analysis**: value leakage decomposed by *sequential substitution* (one driver at a time, fixed order).
* **Balanced Scorecard / OKRs**: multi-dimension scorecard with visible, configurable weights.
* **AI portfolio management**: value-vs-complexity heatmap, stage gates, maturity model.

## 4. Layered architecture

```
src/
  app/                    Next.js App Router — pages, layouts, route handlers (UI + transport only)
    (app)/…               Authenticated application shell (left nav, top bar, advisor)
    api/…                 REST endpoints: export, import, advisor, ingest, auth
  components/             Presentational + interactive React components
    ui/                   shadcn/ui-style primitives (Radix + Tailwind + cva)
    charts/               Recharts wrappers (waterfall, heatmap, trend, radar…)
    value/                Domain widgets (KPI card, Explain dialog, badges, value tree, agent flow…)
  lib/
    value-engine/         PURE calculation library — no React, no I/O (unit-tested)
    domain/               Domain types, enums, Zod schemas, lifecycle & governance rules
    data/                 Data access: repository interface + Prisma and in-memory implementations
    services/             Application services (evaluate portfolio, filters, governance, audit, import)
    reporting/            Report builders (data → report model) + CSV/Excel serializers
    advisor/              AI Value Advisor: intent router, deterministic query handlers, LLM provider interface
    auth/                 Session abstraction (signed cookie), RBAC permission matrix
  lib/catalog/            Starter catalog for new workspaces (tests/fixtures/demo holds the test portfolio)
prisma/                   schema.prisma + seed.ts
tests/                    Vitest unit tests (value engine, governance, advisor, import)
```

Dependency direction: `app → components → services → (value-engine, data, domain)`. The value engine depends only on `domain` types.

### Data access

`lib/data/repository.ts` defines a narrow `ValueRepository` interface (load portfolio graph, write baseline/post-AI metrics, agents, costs, benefit status, disposition, scenarios, settings, model prices, audit). Two implementations:

* `PrismaRepository` — PostgreSQL via Prisma (production).
* `MemoryRepository` — per-workspace in-process store used when `DATABASE_URL` is not set (local development only). Every repository instance is bound to one tenant.

Selection: `DATA_SOURCE=prisma|memory` (default: `prisma` if `DATABASE_URL` present).

### Value engine (`src/lib/value-engine`)

| Module | Responsibility |
|---|---|
| `metric.ts` | `Metric` type + builders (value, unit, formula, inputs, assumptions, confidence) |
| `units.ts` | Time unit normalisation, safe division, rounding |
| `productivity.ts` | Cycle-time / touch-time reduction, productivity uplift, throughput, automation rate |
| `capacity.ts` | Labour-hour model (activity-based or FTE-calibrated), hours released, FTE capacity, disposition split, reconciliation check |
| `quality.ts` | Error / rework / FTR / SLA improvement, cost-of-poor-quality avoided |
| `financial.ts` | Cost per transaction, cost reduction, benefit-line valuation & classification |
| `attribution.ts` | Attribution application, evidence strength, data-confidence rating |
| `adoption.ts` | Adoption metrics, realized-value model (Potential × Adoption × Performance × Attribution) |
| `agent-economics.ts` | Token economics, cost per task / agent / process / outcome, human-intervention cost, reliability |
| `tco.ts` | One-time vs recurring cost roll-up including derived LLM cost |
| `npv.ts` | NPV, IRR (bisection), discount factors |
| `roi.ts` | Multi-year cash-flow schedule with ramp-up, ROI, payback, BCR, 3-/5-year value |
| `leakage.ts` | Value ladder (Potential → Business Case → Measured → Validated → Realized → Sustained) + driver decomposition |
| `scenarios.ts` | Scenario overrides → recomputed initiative value (same code path — no duplicated logic) |
| `scorecard.ts` | Transparent weighted scorecard |
| `timeseries.ts` | Monthly value from monthly measurements |
| `maturity.ts` | Maturity level from dimension scores |
| `initiative.ts` / `portfolio.ts` | Orchestration and aggregation |

## 5. Database model (Prisma, PostgreSQL)

Normalized entities (see `prisma/schema.prisma`):

```
Organization 1─* BusinessUnit
Organization *─1 Industry
Industry 1─* IndustryUseCase, 1─* Benchmark
FunctionDomain 1─* Process (self-referencing hierarchy: PROCESS › SUBPROCESS › ACTIVITY › TASK, with automationMode)
FunctionDomain 1─* KpiDefinition
Initiative *─1 Organization, BusinessUnit, FunctionDomain, Process
Initiative 1─1 BusinessCase
Initiative 1─* MetricSnapshot (kind: BASELINE | TARGET | ACTUAL)  → 1─* KpiValue (custom KPIs)
Initiative 1─* Measurement (monthly time series)
Initiative 1─* AiAgent 1─* AgentTask, 1─1 AgentPerformance (latest) , *─1 ModelPrice
Initiative 1─* CostItem (category, subcategory, ONE_TIME | RECURRING)
Initiative 1─1 CapacityDisposition
Initiative 1─* Benefit 1─* Evidence, 1─* BenefitValidation (governance history)
Initiative 1─* Assumption, 1─* Scenario, 1─* LeakageNote
Organization 1─* MaturityAssessment 1─* MaturityScore
User *─1 Role;  AuditLog (entity, entityId, field, previous, next, user, timestamp)
Report (generated report metadata), AppSetting (key/value JSON), GovernanceStep
```

## 6. Page hierarchy

```
/dashboard                 Executive Dashboard (global filters, 12 KPI cards, 14 visuals)
/cockpit                   AI Value Realization Cockpit (value ladder, leakage, net value)
/portfolio                 AI Portfolio (table + value/complexity heatmap + scorecards)
/value-realization         Lifecycle board, governance queue, value bridge, maturity
/processes                 Process hierarchy, activity classification, process comparison
/agents                    Agent registry, agentic flows, agent performance, AI FinOps
/business-cases            Business cases vs actuals
/measurements              Time-series measurement explorer
/benchmarks                Benchmark engine (illustrative — replaceable)
/scenarios                 Scenario analysis
/reports                   Report catalogue → /reports/[type] (print view, PDF via print, Excel, CSV)
/import                    Manual / CSV / Excel upload, API ingestion, connector registry
/admin                     Users & roles, industries, functions/processes, KPIs, governance, model prices, audit
/settings                  Financial & calculation settings, scorecard weights
/initiatives/[id]/[tab]    Overview · Business Case · Process · Baseline · AI Intervention · Post-AI · Value ·
                           Costs · Adoption · Agent Performance · Evidence · Scenarios · Reports · Audit Trail
```

## 7. Implementation plan (phased)

1. Shell, navigation, data model, demo data (≥20 initiatives, 8 industries, S2P reference case).
2. Process baseline wizard and AI intervention / agentic flow.
3. Value calculation engine + unit tests.
4. Post-AI measurement, before/after comparison, time series.
5. Executive Dashboard and Value Cockpit.
6. AI portfolio, heatmap, scorecard, process comparison, value tree, value bridge.
7. Scenario analysis and value leakage.
8. Agent performance and AI FinOps.
9. Reporting and exports.
10. AI Value Advisor, governance workflow, maturity, benchmarks, import.

Quality gate after each phase: `npm run typecheck && npm run lint && npm test && npm run build`.
