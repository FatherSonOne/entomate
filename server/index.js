// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const { requireAuth } = require("./middleware/auth");
const { requireWorkspaceAdmin } = require("./middleware/rbac");

const makeSettingsRoutes = require("./routes/settings");
const makeHealthRoutes = require("./routes/health");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Postgres connection (set DATABASE_URL in .env)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(makeHealthRoutes());
app.use(makeSettingsRoutes({ pool, requireAuth, requireWorkspaceAdmin }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));


