const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || "change_me_super_secret",
  adminEmail: process.env.ADMIN_EMAIL || "contact@pixaura.eu",
  adminPassword: process.env.ADMIN_PASSWORD || "pixaura1234@@",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || (process.env.NODE_ENV === 'production' ? 465 : 587)),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  /**
   * Origine(s) du front pour CORS.
   * trim : enlève les espaces après "=" dans .env.
   * replace : supprime le(s) slash(es) final(aux) — le navigateur envoie l'Origin
   * SANS slash final, donc "https://site.com/" ne matcherait pas "https://site.com".
   * Gère aussi une liste séparée par des virgules.
   */
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .join(","),
};
