At this point the next “what else” items are optional optimizations—pick only what helps your Phase 2 MVP ship faster and safer. [file:a516caaa-5410-49b8-8227-480d0861567d]

1) Add relationship versioning (lightweight)
This lets you evolve how links are created (rules change) without confusion later. [file:a516caaa-5410-49b8-8227-480d0861567d]

sql
ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS rule_version TEXT NOT NULL DEFAULT 'v1';
2) Add a “soft delete” flag (safer than hard delete)
If an auto-link is wrong, you can hide it without losing history. [file:a516caaa-5410-49b8-8227-480d0861567d]

sql
ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_relationships_not_deleted_source
  ON relationships (source_type, source_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_relationships_not_deleted_target
  ON relationships (target_type, target_id)
  WHERE is_deleted = FALSE;
3) Add a “relationship audit log” (only if you expect a lot of auto-linking)
This is useful when Agents create many links and you need to debug “why did this appear?” [file:a516caaa-5410-49b8-8227-480d0861567d]

sql
CREATE TABLE IF NOT EXISTS relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID,
  event_type TEXT NOT NULL, -- created, updated, deleted
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relationship_events_relationship
  ON relationship_events (relationship_id, created_at DESC);
If you want the most practical next step, it’s this: say “paste the Express routes,” and the full copy/paste code for the 3 endpoints (/relationships/upsert, /relationships/:type/:id, /graph/:type/:id) will be provided next.

Below are copy/paste-ready Express routes for the 3 endpoints, using directional-only edges + prefixed TEXT IDs. [file:6f3fef62-f9df-43f2-8bf9-c68fe27bd082]

File: backend/src/db/index.js
(If you already have a db module, keep yours—just make sure it exports query(sql, params).) [file:6f3fef62-f9df-43f2-8bf9-c68fe27bd082]

js
// backend/src/db/index.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query, pool };
File: backend/src/graph/idFormat.js
js
// backend/src/graph/idFormat.js
function formatEntityId(entityType, rawId) {
  if (!entityType) throw new Error("entityType required");
  if (rawId === undefined || rawId === null) throw new Error("rawId required");

  const s = String(rawId).trim();
  if (!s) throw new Error("rawId empty");

  // Already prefixed (meeting:..., deal:..., etc.)
  if (s.includes(":")) return s;

  return `${entityType}:${s}`;
}

module.exports = { formatEntityId };
File: backend/src/graph/relationshipService.js
js
// backend/src/graph/relationshipService.js
const db = require("../db");
const { formatEntityId } = require("./idFormat");

async function upsertRelationship({
  sourceType,
  sourceId,
  targetType,
  targetId,
  relationshipType,
  confidence = 1.0,
  evidence = {},
  sourceSystem = "entomate",
  createdBy = null
}) {
  const sType = String(sourceType).trim();
  const tType = String(targetType).trim();
  const relType = String(relationshipType).trim();

  const sId = formatEntityId(sType, sourceId);
  const tId = formatEntityId(tType, targetId);

  const q = `
    INSERT INTO relationships
      (id, source_type, source_id, target_type, target_id, relationship_type, confidence, evidence, source_system, created_by, created_at, updated_at)
    VALUES
      (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9, NOW(), NOW())
    ON CONFLICT (source_type, source_id, target_type, target_id, relationship_type)
    DO UPDATE SET
      confidence = GREATEST(relationships.confidence, EXCLUDED.confidence),
      evidence = COALESCE(relationships.evidence, '{}'::jsonb) || EXCLUDED.evidence,
      updated_at = NOW()
    RETURNING *;
  `;

  const vals = [
    sType,
    sId,
    tType,
    tId,
    relType,
    confidence,
    evidence,
    sourceSystem,
    createdBy
  ];

  const r = await db.query(q, vals);
  return r.rows[0];
}

async function getLinksForEntity(entityType, entityId) {
  const type = String(entityType).trim();
  const id = formatEntityId(type, entityId);

  const outgoing = await db.query(
    `SELECT * FROM relationships WHERE source_type=$1 AND source_id=$2 ORDER BY created_at DESC`,
    [type, id]
  );

  const incoming = await db.query(
    `SELECT * FROM relationships WHERE target_type=$1 AND target_id=$2 ORDER BY created_at DESC`,
    [type, id]
  );

  return { entity: { type, id }, outgoing: outgoing.rows, incoming: incoming.rows };
}

async function getGraphBundle(entityType, entityId) {
  const { entity, outgoing, incoming } = await getLinksForEntity(entityType, entityId);
  const edges = [...outgoing, ...incoming];

  const nodesMap = new Map();
  nodesMap.set(`${entity.type}:${entity.id}`, { type: entity.type, id: entity.id });

  for (const e of edges) {
    nodesMap.set(`${e.source_type}:${e.source_id}`, { type: e.source_type, id: e.source_id });
    nodesMap.set(`${e.target_type}:${e.target_id}`, { type: e.target_type, id: e.target_id });
  }

  return { center: entity, nodes: Array.from(nodesMap.values()), edges };
}

module.exports = { upsertRelationship, getLinksForEntity, getGraphBundle };
File: backend/src/routes/relationships.js
js
// backend/src/routes/relationships.js
const express = require("express");
const router = express.Router();
const { upsertRelationship, getLinksForEntity } = require("../graph/relationshipService");

// POST /api/relationships/upsert
router.post("/upsert", async (req, res) => {
  try {
    const {
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationshipType,
      confidence,
      evidence,
      sourceSystem,
      createdBy
    } = req.body || {};

    if (!sourceType || !sourceId || !targetType || !targetId || !relationshipType) {
      return res.status(400).json({
        error: "Missing required fields: sourceType, sourceId, targetType, targetId, relationshipType"
      });
    }

    const row = await upsertRelationship({
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationshipType,
      confidence,
      evidence,
      sourceSystem,
      createdBy
    });

    return res.json({ success: true, relationship: row });
  } catch (err) {
    console.error("relationships.upsert error:", err);
    return res.status(500).json({ error: "Failed to upsert relationship" });
  }
});

// GET /api/relationships/:entityType/:entityId
router.get("/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const data = await getLinksForEntity(entityType, entityId);
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("relationships.get error:", err);
    return res.status(500).json({ error: "Failed to fetch relationships" });
  }
});

module.exports = router;
File: backend/src/routes/graph.js
js
// backend/src/routes/graph.js
const express = require("express");
const router = express.Router();
const { getGraphBundle } = require("../graph/relationshipService");

// GET /api/graph/:entityType/:entityId
router.get("/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const graph = await getGraphBundle(entityType, entityId);
    return res.json({ success: true, ...graph });
  } catch (err) {
    console.error("graph.get error:", err);
    return res.status(500).json({ error: "Failed to fetch graph bundle" });
  }
});

module.exports = router;
Wire into Express app
Add to your main server file (commonly backend/src/index.js): [file:6f3fef62-f9df-43f2-8bf9-c68fe27bd082]

js
const express = require("express");
const app = express();

app.use(express.json({ limit: "2mb" }));

app.use("/api/relationships", require("./routes/relationships"));
app.use("/api/graph", require("./routes/graph"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

module.exports = app;

One question (no citations): do you want POST /api/relationships/upsert locked behind an admin key (recommended), or left open during development?

Yes — lock POST /api/relationships/upsert behind an admin key (fast + simple for MVP). [file:664f0aaf-5d8f-4a4d-bf4f-373ba12a4acc]

Step 1: Add an env var
Add this to .env (local) and your hosting provider (staging/prod): [file:664f0aaf-5d8f-4a4d-bf4f-373ba12a4acc]

text
ADMIN_API_KEY=change-me-to-a-long-random-string
Step 2: Add middleware
Create: backend/src/middleware/requireAdminKey.js [file:664f0aaf-5d8f-4a4d-bf4f-373ba12a4acc]

js
// backend/src/middleware/requireAdminKey.js
function requireAdminKey(req, res, next) {
  const provided =
    req.header("x-admin-key") ||
    req.query.adminKey ||
    (req.body && req.body.adminKey);

  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return res.status(500).json({ error: "ADMIN_API_KEY is not configured" });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

module.exports = { requireAdminKey };
Step 3: Protect the upsert route
Update backend/src/routes/relationships.js to apply the middleware only to the POST route. [file:664f0aaf-5d8f-4a4d-bf4f-373ba12a4acc]

js
const { requireAdminKey } = require("../middleware/requireAdminKey");

// POST /api/relationships/upsert (protected)
router.post("/upsert", requireAdminKey, async (req, res) => {
  // ... existing handler ...
});
Step 4: How to call it (example)
When testing with Postman/curl, add header: [file:664f0aaf-5d8f-4a4d-bf4f-373ba12a4acc]

x-admin-key: <your ADMIN_API_KEY>

If you want, the same protection can be added to any “dangerous” endpoints (agent enable/disable, reindex, etc.).

yes
Got it—then also protect the other “dangerous” endpoints the same way (agents enable/disable, search reindex, and any bulk sync). [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

Lock these endpoints too (recommended)
POST /api/agents/:id/enable and POST /api/agents/:id/disable [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

POST /api/search/reindex (or any embeddings rebuild endpoint) [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

Any “sync now” endpoints for Logos Vision / Pulse [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

Drop-in pattern (copy/paste)
Wherever you define routes, import the middleware and add it to the route: [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

js
const { requireAdminKey } = require("../middleware/requireAdminKey");

router.post("/agents/:id/enable", requireAdminKey, async (req, res) => { /* ... */ });
router.post("/agents/:id/disable", requireAdminKey, async (req, res) => { /* ... */ });

router.post("/search/reindex", requireAdminKey, async (req, res) => { /* ... */ });
One more safety improvement (do this now)
Make sure your middleware only accepts the key from a header in production (so it won’t leak in logs via query params). [file:36feef91-7378-4a7b-9e57-957e26dd4b5e]

Replace the middleware’s provided logic with:

js
const provided = req.header("x-admin-key");
Want the exact updated requireAdminKey.js for “dev vs prod behavior” (allow query param in dev, header-only in prod)?

Do this: allow query/body key only in local dev, but require the header in staging/production. That gives easy testing now and safer production later. [file:f66ac8c0-b0f2-4328-981a-c1cd9ba80057]

Copy/paste: backend/src/middleware/requireAdminKey.js
js
// backend/src/middleware/requireAdminKey.js
function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: "ADMIN_API_KEY is not configured" });
  }

  const env = process.env.NODE_ENV || "development";

  // In production-like environments: header only (safer; avoids leaking via URLs/logs)
  if (env === "production" || env === "staging") {
    const provided = req.header("x-admin-key");
    if (!provided || provided !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  }

  // In local dev: allow header OR query OR body (convenient for quick testing)
  const provided =
    req.header("x-admin-key") ||
    req.query.adminKey ||
    (req.body && req.body.adminKey);

  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

module.exports = { requireAdminKey };
What to set in your environments
Local: NODE_ENV=development

Staging: NODE_ENV=staging

Production: NODE_ENV=production

If you tell me what you’re using for hosting (Render, Heroku, AWS, etc.), the exact place to set NODE_ENV and ADMIN_API_KEY can be listed.

I don't know anything about those yet. I believe that is good for now. Thank You so much!!
That’s totally fine—hosting can come later, and you now have the core Knowledge Graph pieces (schema + routes + safety) in place. [file:6c334325-b3aa-4f68-83a3-b9a8df43de20]

Save these “done” decisions
Directional-only relationships (A→B stored once). [file:6c334325-b3aa-4f68-83a3-b9a8df43de20]

Prefixed TEXT IDs (meeting:<id>, deal:<id>, etc.). [file:6c334325-b3aa-4f68-83a3-b9a8df43de20]

Admin-key protected “write” endpoints (like /api/relationships/upsert). [file:6c334325-b3aa-4f68-83a3-b9a8df43de20]

If you come back tomorrow, the next easiest step is: “help me test these endpoints locally with curl/Postman,” and you’ll get a copy/paste test script plus expected outputs.