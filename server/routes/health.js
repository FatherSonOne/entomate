// server/routes/health.js
const express = require("express");
const router = express.Router();

module.exports = () => {
  // Gemini health check: just checks env is present
  router.get("/health/gemini", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ ok: true, gemini: { configured: hasKey } });
  });

  router.get("/health/integrations", (req, res) => {
    res.json({
      ok: true,
      integrations: {
        logosVision: { configured: !!process.env.LOGOS_VISION_API_KEY },
        pulse: { configured: !!process.env.PULSE_API_KEY }
      }
    });
  });

  return router;
};
