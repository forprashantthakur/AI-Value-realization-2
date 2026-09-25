-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LifecycleStage" AS ENUM ('DISCOVER', 'BASELINE', 'BUSINESS_CASE', 'IMPLEMENT', 'MEASURE', 'VALIDATE', 'REALIZE', 'OPTIMIZE');

-- CreateEnum
CREATE TYPE "Health" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK');

-- CreateEnum
CREATE TYPE "AutomationMode" AS ENUM ('MANUAL', 'RULES_BASED', 'RPA', 'AI_ASSISTED', 'AI_AUTOMATED', 'AGENT_EXECUTED', 'HUMAN_IN_THE_LOOP', 'HUMAN_APPROVED');

-- CreateEnum
CREATE TYPE "ProcessLevel" AS ENUM ('PROCESS', 'SUBPROCESS', 'ACTIVITY', 'TASK');

-- CreateEnum
CREATE TYPE "ValueCategory" AS ENUM ('PRODUCTIVITY', 'FINANCIAL', 'QUALITY', 'EXPERIENCE', 'RISK_COMPLIANCE', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "BenefitNature" AS ENUM ('MEASURED', 'ESTIMATED', 'INTANGIBLE');

-- CreateEnum
CREATE TYPE "FinancialClass" AS ENUM ('CASHABLE', 'COST_AVOIDANCE', 'REVENUE', 'WORKING_CAPITAL', 'RISK_AVOIDANCE', 'CAPACITY', 'NON_FINANCIAL');

-- CreateEnum
CREATE TYPE "BenefitStatus" AS ENUM ('PROPOSED', 'MEASURED', 'BUSINESS_VALIDATED', 'FINANCE_VALIDATED', 'REALIZED', 'SUSTAINED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SYSTEM_TELEMETRY', 'PROCESS_MINING', 'FINANCE_VALIDATED', 'BUSINESS_OWNER_VALIDATED', 'SURVEY', 'ESTIMATED', 'BENCHMARK');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('IMPLEMENTATION', 'TECHNOLOGY', 'OPERATING');

-- CreateEnum
CREATE TYPE "CostRecurrence" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "SnapshotKind" AS ENUM ('BASELINE', 'TARGET', 'ACTUAL');

-- CreateEnum
CREATE TYPE "MeasurementPhase" AS ENUM ('BASELINE', 'PILOT', 'ROLLOUT', 'STEADY_STATE');

-- CreateEnum
CREATE TYPE "LeakageCause" AS ENUM ('LOW_ADOPTION', 'LOWER_AUTOMATION', 'HIGHER_AI_COST', 'EXCEPTION_RATES', 'HUMAN_REVIEW', 'INTEGRATION_LIMITATIONS', 'DATA_QUALITY', 'PROCESS_VARIANCE', 'MODEL_PERFORMANCE', 'CHANGE_RESISTANCE');

-- CreateEnum
CREATE TYPE "ScenarioName" AS ENUM ('CONSERVATIVE', 'EXPECTED', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LaborBasis" AS ENUM ('ACTIVITY', 'FTE_CALIBRATED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('LIVE', 'PILOT', 'PLANNED');

-- CreateEnum
CREATE TYPE "DerivedDriver" AS ENUM ('LABOR_CASHABLE', 'LABOR_COST_AVOIDANCE', 'LABOR_REDEPLOYED', 'LABOR_REVENUE_CAPACITY', 'QUALITY_COST', 'OUTSOURCING', 'LEGACY_TECH');

-- CreateEnum
CREATE TYPE "MeasurementFrequency" AS ENUM ('REALTIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('LOWER_IS_BETTER', 'HIGHER_IS_BETTER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "apiKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "focusKpis" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryUseCase" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndustryUseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "headquarters" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isFictional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FunctionDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "ProcessLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "automationMode" "AutomationMode" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "functionId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "KpiDirection" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "stage" "LifecycleStage" NOT NULL,
    "health" "Health" NOT NULL,
    "aiTechnology" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "productOwner" TEXT NOT NULL,
    "financeValidator" TEXT NOT NULL,
    "complexity" INTEGER NOT NULL,
    "strategicAlignment" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "goLiveDate" TIMESTAMP(3),
    "productiveHoursPerFte" DECIMAL(9,2) NOT NULL,
    "costPerError" DECIMAL(18,2) NOT NULL,
    "laborBasis" "LaborBasis" NOT NULL DEFAULT 'FTE_CALIBRATED',
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCase" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "approvedDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "sponsor" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "objectives" TEXT[],
    "potentialAdoption" DECIMAL(9,6) NOT NULL,
    "plannedAdoption" DECIMAL(9,6) NOT NULL,
    "horizonYears" INTEGER NOT NULL,
    "approvedDeclaredBenefits" DECIMAL(18,2) NOT NULL,
    "approvedInvestment" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BusinessCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "kind" "SnapshotKind" NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "transactionsPerYear" DECIMAL(18,2) NOT NULL,
    "peakMonthlyVolume" DECIMAL(18,2),
    "users" INTEGER,
    "fte" DECIMAL(12,2) NOT NULL,
    "avgHandlingMinutes" DECIMAL(12,4) NOT NULL,
    "waitingMinutes" DECIMAL(12,4),
    "cycleTimeHours" DECIMAL(12,4) NOT NULL,
    "reworkMinutes" DECIMAL(12,4) NOT NULL,
    "fullyLoadedFteCost" DECIMAL(18,2) NOT NULL,
    "technologyCostAnnual" DECIMAL(18,2) NOT NULL,
    "outsourcingCostAnnual" DECIMAL(18,2) NOT NULL,
    "errorRate" DECIMAL(9,6) NOT NULL,
    "reworkRate" DECIMAL(9,6) NOT NULL,
    "exceptionRate" DECIMAL(9,6) NOT NULL,
    "firstTimeRight" DECIMAL(9,6) NOT NULL,
    "slaAchievement" DECIMAL(9,6) NOT NULL,
    "csat" DECIMAL(9,4),
    "employeeSatisfaction" DECIMAL(9,4),
    "selfServiceRate" DECIMAL(9,6),
    "automationRate" DECIMAL(9,6) NOT NULL,
    "adoptionRate" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiValue" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "baseline" DECIMAL(18,4) NOT NULL,
    "target" DECIMAL(18,4) NOT NULL,
    "actual" DECIMAL(18,4),

    CONSTRAINT "KpiValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "phase" "MeasurementPhase" NOT NULL,
    "volume" DECIMAL(18,2) NOT NULL,
    "adoptionRate" DECIMAL(9,6) NOT NULL,
    "automationRate" DECIMAL(9,6) NOT NULL,
    "avgHandlingMinutes" DECIMAL(12,4) NOT NULL,
    "cycleTimeHours" DECIMAL(12,4) NOT NULL,
    "errorRate" DECIMAL(9,6) NOT NULL,
    "reworkRate" DECIMAL(9,6) NOT NULL,
    "aiRunCost" DECIMAL(18,2) NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "eligibleUsers" INTEGER NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "inputPer1M" DECIMAL(18,6) NOT NULL,
    "outputPer1M" DECIMAL(18,6) NOT NULL,
    "cachedInputPer1M" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL,

    CONSTRAINT "ModelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgent" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "technology" TEXT NOT NULL,
    "modelPriceId" TEXT,
    "humanInLoopModel" "AutomationMode" NOT NULL,
    "automationPct" DECIMAL(9,6) NOT NULL,
    "deploymentDate" TIMESTAMP(3) NOT NULL,
    "status" "AgentStatus" NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "automated" BOOLEAN NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPerformance" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tasksPerMonth" DECIMAL(18,2) NOT NULL,
    "taskCompletionRate" DECIMAL(9,6) NOT NULL,
    "autonomousCompletionRate" DECIMAL(9,6) NOT NULL,
    "escalationRate" DECIMAL(9,6) NOT NULL,
    "overrideRate" DECIMAL(9,6) NOT NULL,
    "errorRate" DECIMAL(9,6) NOT NULL,
    "hallucinationEventsPerMonth" INTEGER NOT NULL,
    "toolCallSuccessRate" DECIMAL(9,6) NOT NULL,
    "avgLatencySeconds" DECIMAL(9,2) NOT NULL,
    "callsPerTask" DECIMAL(9,2) NOT NULL,
    "inputTokensPerCall" INTEGER NOT NULL,
    "outputTokensPerCall" INTEGER NOT NULL,
    "cacheHitRate" DECIMAL(9,6) NOT NULL,
    "toolCallsPerTask" DECIMAL(9,2) NOT NULL,
    "humanMinutesPerEscalation" DECIMAL(9,2) NOT NULL,

    CONSTRAINT "AgentPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "subcategory" TEXT NOT NULL,
    "recurrence" "CostRecurrence" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityDisposition" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "cashable" DECIMAL(9,6) NOT NULL,
    "costAvoidance" DECIMAL(9,6) NOT NULL,
    "redeployed" DECIMAL(9,6) NOT NULL,
    "revenueProducing" DECIMAL(9,6) NOT NULL,
    "unallocated" DECIMAL(9,6) NOT NULL,
    "rationale" TEXT NOT NULL,

    CONSTRAINT "CapacityDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ValueCategory" NOT NULL,
    "financialClass" "FinancialClass" NOT NULL,
    "nature" "BenefitNature" NOT NULL,
    "derivedDriver" "DerivedDriver",
    "declaredAnnualValue" DECIMAL(18,2),
    "declaredBasis" TEXT,
    "attributionPct" DECIMAL(9,6) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "status" "BenefitStatus" NOT NULL,
    "owner" TEXT NOT NULL,
    "measurementFrequency" "MeasurementFrequency" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providedBy" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitValidation" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "from" "BenefitStatus" NOT NULL,
    "to" "BenefitStatus" NOT NULL,
    "by" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "BenefitValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "owner" TEXT NOT NULL,

    CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" "ScenarioName" NOT NULL,
    "overrides" JSONB NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeakageNote" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "cause" "LeakageCause" NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedAnnualImpact" DECIMAL(18,2),
    "owner" TEXT NOT NULL,

    CONSTRAINT "LeakageNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "industryId" TEXT,
    "functionId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "median" DECIMAL(18,6) NOT NULL,
    "topQuartile" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaturityAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessedOn" TIMESTAMP(3) NOT NULL,
    "assessedBy" TEXT NOT NULL,

    CONSTRAINT "MaturityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaturityScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,

    CONSTRAINT "MaturityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "field" TEXT NOT NULL,
    "previous" TEXT,
    "next" TEXT,
    "reason" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "initiativeId" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filters" JSONB NOT NULL,
    "format" TEXT NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("tenantId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_apiKeyHash_key" ON "Tenant"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_tenantId_name_key" ON "Industry"("tenantId", "name");

-- CreateIndex
CREATE INDEX "IndustryUseCase_industryId_idx" ON "IndustryUseCase"("industryId");

-- CreateIndex
CREATE INDEX "Organization_tenantId_idx" ON "Organization"("tenantId");

-- CreateIndex
CREATE INDEX "BusinessUnit_organizationId_idx" ON "BusinessUnit"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDomain_tenantId_name_key" ON "FunctionDomain"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Process_functionId_idx" ON "Process"("functionId");

-- CreateIndex
CREATE INDEX "Process_parentId_idx" ON "Process"("parentId");

-- CreateIndex
CREATE INDEX "Initiative_tenantId_idx" ON "Initiative"("tenantId");

-- CreateIndex
CREATE INDEX "Initiative_organizationId_idx" ON "Initiative"("organizationId");

-- CreateIndex
CREATE INDEX "Initiative_functionId_idx" ON "Initiative"("functionId");

-- CreateIndex
CREATE INDEX "Initiative_stage_idx" ON "Initiative"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_tenantId_code_key" ON "Initiative"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCase_initiativeId_key" ON "BusinessCase"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_initiativeId_kind_key" ON "MetricSnapshot"("initiativeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "KpiValue_initiativeId_kpiId_key" ON "KpiValue"("initiativeId", "kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_initiativeId_month_key" ON "Measurement"("initiativeId", "month");

-- CreateIndex
CREATE INDEX "AiAgent_initiativeId_idx" ON "AiAgent"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPerformance_agentId_key" ON "AgentPerformance"("agentId");

-- CreateIndex
CREATE INDEX "CostItem_initiativeId_idx" ON "CostItem"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityDisposition_initiativeId_key" ON "CapacityDisposition"("initiativeId");

-- CreateIndex
CREATE INDEX "Benefit_initiativeId_idx" ON "Benefit"("initiativeId");

-- CreateIndex
CREATE INDEX "Benefit_status_idx" ON "Benefit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_initiativeId_name_key" ON "Scenario"("initiativeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_key_key" ON "Role"("tenantId", "key");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_at_idx" ON "AuditLog"("tenantId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_initiativeId_idx" ON "AuditLog"("initiativeId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryUseCase" ADD CONSTRAINT "IndustryUseCase_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDomain" ADD CONSTRAINT "FunctionDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "FunctionDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDefinition" ADD CONSTRAINT "KpiDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDefinition" ADD CONSTRAINT "KpiDefinition_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "FunctionDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "FunctionDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KpiDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPrice" ADD CONSTRAINT "ModelPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_modelPriceId_fkey" FOREIGN KEY ("modelPriceId") REFERENCES "ModelPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPerformance" ADD CONSTRAINT "AgentPerformance_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityDisposition" ADD CONSTRAINT "CapacityDisposition_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitValidation" ADD CONSTRAINT "BenefitValidation_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakageNote" ADD CONSTRAINT "LeakageNote_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "FunctionDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaturityAssessment" ADD CONSTRAINT "MaturityAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaturityAssessment" ADD CONSTRAINT "MaturityAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaturityScore" ADD CONSTRAINT "MaturityScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MaturityAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

