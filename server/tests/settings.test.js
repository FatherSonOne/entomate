const request = require("supertest");
const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requireWorkspaceAdmin } = require("../middleware/rbac");

test("non-admin cannot access workspace settings", async () => {
  const app = express();
  app.use(express.json());

  // Fake pool
  const pool = { query: async () => ({ rows: [] }) };

  const settingsRoutes = require("../routes/settings")({ pool, requireAuth, requireWorkspaceAdmin });
  app.use(settingsRoutes);

  const res = await request(app)
    .get("/settings/workspace")
    .set("x-user-id", "00000000-0000-0000-0000-000000000001")
    .set("x-workspace-id", "00000000-0000-0000-0000-000000000010")
    .set("x-user-role", "member");

  expect(res.status).toBe(403);
});
