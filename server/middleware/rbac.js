// server/middleware/rbac.js
function requireWorkspaceAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden (admin only)" });
  }
  next();
}

module.exports = { requireWorkspaceAdmin };
