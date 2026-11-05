-- Company Brain: bedrock (facts, devices), chat messages, clusters, reports,
-- and the views that Triggerware watches. See COMPANY_BRAIN_SPEC.md.

-- pgvector provides the `vector` column type and the `<=>` (cosine distance)
-- operator. The database image is pgvector/pgvector:pg16, which ships it.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "brain_facts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "embedding" vector(384),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "laptop" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "browser" TEXT NOT NULL,

    CONSTRAINT "brain_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'it-help',
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cluster_id" TEXT,
    "embedding" vector(384),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_clusters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "centroid" vector(384),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "problem_cluster_id" TEXT NOT NULL,
    "success_cluster_id" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brain_facts_organization_id_code_key" ON "brain_facts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "brain_devices_organization_id_employee_name_key" ON "brain_devices"("organization_id", "employee_name");

-- CreateIndex
CREATE INDEX "brain_messages_organization_id_createdAt_idx" ON "brain_messages"("organization_id", "createdAt");

-- CreateIndex
CREATE INDEX "brain_messages_cluster_id_idx" ON "brain_messages"("cluster_id");

-- CreateIndex
CREATE INDEX "brain_clusters_organization_id_kind_idx" ON "brain_clusters"("organization_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "brain_reports_organization_id_problem_cluster_id_success_cl_key" ON "brain_reports"("organization_id", "problem_cluster_id", "success_cluster_id");

-- AddForeignKey
ALTER TABLE "brain_facts" ADD CONSTRAINT "brain_facts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_devices" ADD CONSTRAINT "brain_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_messages" ADD CONSTRAINT "brain_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_messages" ADD CONSTRAINT "brain_messages_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "brain_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_clusters" ADD CONSTRAINT "brain_clusters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_reports" ADD CONSTRAINT "brain_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Views read by Triggerware (through the tables in triggerware/tables).
--
-- Thresholds such as "more than 5 employees" live in the Triggerware trigger
-- SQL, not here, so they can be tuned from env vars without a migration.
-- ============================================================================

-- How many different employees wrote messages in each cluster.
CREATE VIEW "brain_cluster_sizes" AS
SELECT
    c."id"                              AS "cluster_id",
    c."organization_id"                 AS "organization_id",
    c."kind"                            AS "kind",
    COUNT(DISTINCT m."author_name")::int AS "authors"
FROM "brain_clusters" c
JOIN "brain_messages" m
  ON m."cluster_id" = c."id" AND m."organization_id" = c."organization_id"
GROUP BY c."id", c."organization_id", c."kind";

-- The browser most of a cluster's authors use, per the IT inventory.
-- For a problem cluster, that's "the browser the stuck employees are on".
CREATE VIEW "brain_cluster_top_browsers" AS
SELECT
    m."cluster_id"                                AS "cluster_id",
    mode() WITHIN GROUP (ORDER BY d."browser")    AS "top_browser"
FROM "brain_messages" m
JOIN "brain_devices" d
  ON d."organization_id" = m."organization_id" AND d."employee_name" = m."author_name"
WHERE m."cluster_id" IS NOT NULL
GROUP BY m."cluster_id";

-- Every (problem cluster, success cluster) pair in the same organization,
-- with what the solution and match triggers need to decide:
--   problem_authors / success_authors: distinct employees in each cluster
--   problem_browser: the browser most stuck employees use
--   success_on_problem_browser: how many successful employees use that same
--     browser (0 means the success group is genuinely different)
--   similarity: how close the two clusters' meanings are (1 = identical)
CREATE VIEW "brain_cluster_pairs" AS
SELECT
    p."organization_id"                        AS "organization_id",
    p."id"                                     AS "problem_cluster_id",
    s."id"                                     AS "success_cluster_id",
    ps."authors"                               AS "problem_authors",
    ss."authors"                               AS "success_authors",
    pb."top_browser"                           AS "problem_browser",
    (
        SELECT COUNT(DISTINCT m."author_name")::int
        FROM "brain_messages" m
        JOIN "brain_devices" d
          ON d."organization_id" = m."organization_id" AND d."employee_name" = m."author_name"
        WHERE m."cluster_id" = s."id" AND d."browser" = pb."top_browser"
    )                                          AS "success_on_problem_browser",
    (1 - (p."centroid" <=> s."centroid"))::float8 AS "similarity"
FROM "brain_clusters" p
JOIN "brain_clusters" s
  ON s."organization_id" = p."organization_id" AND s."kind" = 'success'
JOIN "brain_cluster_sizes" ps ON ps."cluster_id" = p."id"
JOIN "brain_cluster_sizes" ss ON ss."cluster_id" = s."id"
LEFT JOIN "brain_cluster_top_browsers" pb ON pb."cluster_id" = p."id"
WHERE p."kind" = 'problem';
