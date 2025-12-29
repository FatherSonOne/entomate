// server/middleware/auth.js
// Minimal auth: expects headers:
// x-user-id, x-workspace-id, x-user-role (admin|member|guest)
// In production: replace with real auth and set req.user based on JWT/session.

function requireAuth(req, res, next) {
  const userId = req.header("x-user-id");
  const workspaceId = req.header("x-workspace-id");
  const role = req.header("x-user-role") || "member";

  if (!userId || !workspaceId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  req.user = { id: userId, workspaceId, role };
  next();
}

module.exports = { requireAuth };
