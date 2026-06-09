const express = require("express");
const { sendContactEmail } = require("../utils/mailer");

const router = express.Router();

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

router.post("/", async (req, res) => {
  try {
    const { nom, prenom, email, telephone, besoin, budget, secteur } = req.body;

    // Validate required fields
    if (!nom || !prenom || !email || !telephone || !besoin) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    // Send email via nodemailer
    const result = await sendContactEmail({
      nom,
      prenom,
      email,
      telephone,
      besoin,
      budget,
      secteur,
    });

    if (!result.sent) {
      return res.status(500).json({
        error: "Erreur lors de l'envoi de l'email",
        reason: result.reason,
      });
    }

    return res.json({
      success: true,
      message: "Formulaire soumis avec succès",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      error: "Erreur lors du traitement du formulaire",
    });
  }
});

module.exports = router;
