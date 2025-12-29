// server/routes/settings.js
const express = require("express");
const router = express.Router();

async function writeAudit(pool, { workspaceId, actorUserId, action, entityType, entityId, metadata }) {
  await pool.query(
    `INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [workspaceId, actorUserId, action, entityType, entityId, metadata || {}]
  );
}

module.exports = ({ pool, requireAuth, requireWorkspaceAdmin }) => {
  // USER SETTINGS
  router.get("/settings/user", requireAuth, async (req, res) => {
    const r = await pool.query(`SELECT * FROM user_settings WHERE user_id=$1`, [req.user.id]);
    if (!r.rows[0]) {
      const created = await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json({ ok: true, settings: created.rows[0] });
    }
    res.json({ ok: true, settings: r.rows[0] });
  });

  router.put("/settings/user", requireAuth, async (req, res) => {
    const {
      theme_mode,
      accent_mode,
      accent_color,
      reduce_motion,
      notifications_json,
      meetings_json,
      ai_json
    } = req.body || {};

    const r = await pool.query(
      `UPDATE user_settings
       SET theme_mode=COALESCE($2, theme_mode),
           accent_mode=COALESCE($3, accent_mode),
           accent_color=COALESCE($4, accent_color),
           reduce_motion=COALESCE($5, reduce_motion),
           notifications_json=COALESCE($6, notifications_json),
           meetings_json=COALESCE($7, meetings_json),
           ai_json=COALESCE($8, ai_json),
           updated_at=NOW()
       WHERE user_id=$1
       RETURNING *`,
      [req.user.id, theme_mode, accent_mode, accent_color, reduce_motion,
        notifications_json, meetings_json, ai_json]
    );

    await writeAudit(pool, {
      workspaceId: req.user.workspaceId,
      actorUserId: req.user.id,
      action: "settings.user.update",
      entityType: "user_settings",
      entityId: req.user.id,
      metadata: { changed: Object.keys(req.body || {}) }
    });

    res.json({ ok: true, settings: r.rows[0] });
  });

  // WORKSPACE SETTINGS (ADMIN ONLY)
  router.get("/settings/workspace", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const r = await pool.query(
      `SELECT * FROM workspace_settings WHERE workspace_id=$1`,
      [req.user.workspaceId]
    );

    if (!r.rows[0]) {
      const created = await pool.query(
        `INSERT INTO workspace_settings (workspace_id) VALUES ($1) RETURNING *`,
        [req.user.workspaceId]
      );
      return res.json({ ok: true, settings: created.rows[0] });
    }

    res.json({ ok: true, settings: r.rows[0] });
  });

  router.put("/settings/workspace", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const { integrations_json, security_json, data_controls_json } = req.body || {};

    const r = await pool.query(
      `UPDATE workspace_settings
       SET integrations_json=COALESCE($2, integrations_json),
           security_json=COALESCE($3, security_json),
           data_controls_json=COALESCE($4, data_controls_json),
           updated_at=NOW()
       WHERE workspace_id=$1
       RETURNING *`,
      [req.user.workspaceId, integrations_json, security_json, data_controls_json]
    );

    await writeAudit(pool, {
      workspaceId: req.user.workspaceId,
      actorUserId: req.user.id,
      action: "settings.workspace.update",
      entityType: "workspace_settings",
      entityId: req.user.workspaceId,
      metadata: { changed: Object.keys(req.body || {}) }
    });

    res.json({ ok: true, settings: r.rows[0] });
  });

  // AUDIT LOGS (ADMIN ONLY)
  router.get("/settings/audit-logs", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const { limit = 100 } = req.query;
    const r = await pool.query(
      `SELECT * FROM audit_logs
       WHERE workspace_id=$1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.workspaceId, Math.min(Number(limit) || 100, 500)]
    );
    res.json({ ok: true, logs: r.rows });
  });

  return router;
};
