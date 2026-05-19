-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_seats" (
    "id" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "userLogin" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "lastActivityEditor" TEXT,
    "lastAuthenticatedAt" TIMESTAMP(3),
    "pendingCancellationDate" TIMESTAMP(3),
    "planType" TEXT,
    "editorName" TEXT,
    "editorVersion" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_billing_snapshots" (
    "id" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSeats" INTEGER NOT NULL,
    "activeThisCycle" INTEGER NOT NULL,
    "inactiveThisCycle" INTEGER NOT NULL,
    "pendingCancellation" INTEGER NOT NULL,
    "pendingInvitation" INTEGER NOT NULL,
    "addedThisCycle" INTEGER NOT NULL,
    "planType" TEXT,
    "seatManagement" TEXT,

    CONSTRAINT "org_billing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_model_usage" (
    "id" TEXT NOT NULL,
    "userLogin" TEXT NOT NULL,
    "userId" INTEGER,
    "day" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "codeGenCount" INTEGER NOT NULL DEFAULT 0,
    "codeAcceptCount" INTEGER NOT NULL DEFAULT 0,
    "locSuggestedAdd" INTEGER NOT NULL DEFAULT 0,
    "locAdded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_model_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_import_runs" (
    "id" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsLoaded" INTEGER NOT NULL DEFAULT 0,
    "usersFound" INTEGER NOT NULL DEFAULT 0,
    "dateFrom" TEXT,
    "dateTo" TEXT,
    "dataPath" TEXT NOT NULL,

    CONSTRAINT "usage_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_runs_orgSlug_idx" ON "ingestion_runs"("orgSlug");

-- CreateIndex
CREATE INDEX "copilot_seats_orgSlug_idx" ON "copilot_seats"("orgSlug");

-- CreateIndex
CREATE INDEX "copilot_seats_lastActivityAt_idx" ON "copilot_seats"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "copilot_seats_orgSlug_userLogin_key" ON "copilot_seats"("orgSlug", "userLogin");

-- CreateIndex
CREATE INDEX "org_billing_snapshots_orgSlug_snapshotAt_idx" ON "org_billing_snapshots"("orgSlug", "snapshotAt");

-- CreateIndex
CREATE INDEX "user_model_usage_userLogin_idx" ON "user_model_usage"("userLogin");

-- CreateIndex
CREATE INDEX "user_model_usage_day_idx" ON "user_model_usage"("day");

-- CreateIndex
CREATE INDEX "user_model_usage_model_idx" ON "user_model_usage"("model");

-- CreateIndex
CREATE UNIQUE INDEX "user_model_usage_userLogin_day_model_feature_key" ON "user_model_usage"("userLogin", "day", "model", "feature");
