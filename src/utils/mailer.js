const nodemailer = require("nodemailer");
const { smtpHost, smtpPort, smtpUser, smtpPass, frontendUrl } = require("../config/env");
const {
  TIME_SLOTS,
  isRequestFullDay,
  fullDayLabel,
  slotIdFromLegacyTime,
} = require("../constants/timeSlots");

const MEMBER_URL = String(frontendUrl || "http://localhost:3000").split(",")[0];

function createTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) return null;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function formatRequestDateFr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime }) {
  if (isRequestFullDay({ timeSlotId, isFullDay })) return fullDayLabel();
  const slot = TIME_SLOTS.find((s) => s.id === timeSlotId);
  if (slot) return slot.label;
  const legacyId = slotIdFromLegacyTime(requestedTime);
  if (legacyId) {
    const legacy = TIME_SLOTS.find((s) => s.id === legacyId);
    return legacy ? legacy.label : requestedTime;
  }
  return requestedTime || "Créneau à confirmer";
}

/**
 * Layout HTML commun à tous les emails, inspiré du design du site
 * (fond sombre, dégradé signature bleu → violet, marque PIXAURA).
 * Table-based + styles inline pour compatibilité Gmail / Outlook / Apple Mail.
 *
 * @param {Object} o
 * @param {string} o.accent       couleur d'accent (hex) liée au type d'email
 * @param {string} o.badge        libellé de la pastille de statut
 * @param {string} o.title        titre principal
 * @param {string} o.introHtml    paragraphe d'intro (HTML déjà échappé)
 * @param {Array<{label:string,value:string}>} [o.infoRows] encarts d'infos
 * @param {string} [o.extraHtml]  bloc HTML additionnel (ex: message libre)
 * @param {string} [o.ctaText]    texte du bouton
 * @param {string} [o.ctaUrl]     lien du bouton
 * @param {string} [o.footerNote] note de bas de page
 */
function renderEmailLayout({
  accent,
  badge,
  title,
  introHtml,
  infoRows = [],
  extraHtml = "",
  ctaText,
  ctaUrl,
  footerNote = "",
}) {
  const infoHtml = infoRows
    .filter((r) => r && r.value)
    .map(
      (r) => `
      <tr>
        <td style="padding:0 0 10px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a24;border:1px solid #26263400;border-radius:12px;">
            <tr>
              <td style="padding:14px 18px;">
                <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(
                  r.label
                )}</div>
                <div style="font-size:16px;color:#ffffff;font-weight:bold;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(
                  r.value
                )}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const ctaHtml =
    ctaText && ctaUrl
      ? `
      <tr>
        <td style="padding:26px 0 4px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="${accent}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">${escapeHtml(
                  ctaText
                )}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0b0f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b0f;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111118;border:1px solid #1f1f2a;border-radius:18px;overflow:hidden;">
          <!-- Barre dégradé signature -->
          <tr>
            <td bgcolor="${accent}" style="height:6px;line-height:6px;font-size:0;background:linear-gradient(135deg,#0073ff 0%,#1aa3ff 50%,#7c33ff 100%);">&nbsp;</td>
          </tr>
          <!-- En-tête marque -->
          <tr>
            <td align="center" style="padding:34px 32px 10px 32px;">
              <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">PIXAURA</div>
              <div style="font-size:11px;letter-spacing:5px;color:#6b7280;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">INTERNATIONAL</div>
            </td>
          </tr>
          <!-- Contenu -->
          <tr>
            <td style="padding:18px 32px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:14px;">
                    <span style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:${accent}22;color:${accent};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(
                      badge
                    )}</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:22px;font-weight:bold;color:#ffffff;padding-bottom:14px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(
                    title
                  )}</td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.6;color:#c8c9d0;padding-bottom:22px;font-family:Arial,Helvetica,sans-serif;">${introHtml}</td>
                </tr>
                ${infoHtml ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${infoHtml}</table></td></tr>` : ""}
                ${extraHtml}
                ${ctaHtml}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px;border-top:1px solid #1f1f2a;">
              <div style="font-size:12px;line-height:1.6;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">
                ${footerNote ? `${escapeHtml(footerNote)}<br><br>` : ""}
                Pixaura International · <a href="mailto:contact@pixaura.eu" style="color:#1aa3ff;text-decoration:none;">contact@pixaura.eu</a><br>
                Cet email vous est envoyé automatiquement, merci de ne pas y répondre.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Envoi générique avec garde SMTP + email manquant. */
async function send({ to, subject, html, text, replyTo }) {
  const transporter = createTransporter();
  if (!transporter) return { sent: false, reason: "SMTP non configure" };
  if (!to || !String(to).trim()) return { sent: false, reason: "Adresse email manquante" };
  try {
    await transporter.sendMail({
      from: { name: "Pixaura", address: smtpUser },
      to: String(to).trim(),
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

/** 1. Email client lorsque l'admin valide une demande P2C. */
async function sendRequestValidatedEmail({
  to,
  company,
  requestedDate,
  timeSlotId,
  isFullDay,
  requestedTime,
  p2cSlot,
}) {
  const dateLabel = formatRequestDateFr(requestedDate);
  const slotLabel = scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime });
  const companyLabel = company ? String(company).trim() : "votre société";
  const p2cLabel = p2cSlot === 2 ? "Projet P2C n°2 du mois" : p2cSlot === 1 ? "Projet P2C n°1 du mois" : "";

  const infoRows = [
    { label: "Date du tournage", value: dateLabel },
    { label: "Créneau", value: slotLabel },
  ];
  if (p2cLabel) infoRows.push({ label: "Projet", value: p2cLabel });

  const html = renderEmailLayout({
    accent: "#22c55e",
    badge: "Demande confirmée",
    title: "Votre tournage est confirmé",
    introHtml: `Bonjour,<br><br>Bonne nouvelle — votre demande de tournage pour <strong style="color:#ffffff;">${escapeHtml(
      companyLabel
    )}</strong> a été <strong style="color:#22c55e;">validée</strong> par l'équipe Pixaura.`,
    infoRows,
    ctaText: "Accéder à mon espace membre",
    ctaUrl: MEMBER_URL,
    footerNote: "Vous pouvez consulter le détail de votre tournage dans votre espace membre.",
  });

  const text = `Bonjour,

Votre demande de tournage pour ${companyLabel} a été validée par l'équipe Pixaura.

Date : ${dateLabel}
Créneau : ${slotLabel}${p2cLabel ? `\n${p2cLabel}` : ""}

Vous pouvez consulter le détail dans votre espace membre Pixaura : ${MEMBER_URL}

Cordialement,
L'équipe Pixaura`;

  return send({ to, subject: "Pixaura — Votre demande de tournage est confirmée", html, text });
}

/** 2. Email client : accès à l'espace membre créé. */
async function sendCredentialsEmail({ to, password }) {
  const html = renderEmailLayout({
    accent: "#7c33ff",
    badge: "Accès créé",
    title: "Bienvenue dans votre espace membre",
    introHtml: `Bonjour,<br><br>Votre accès à l'espace membre Pixaura a été créé. Voici vos identifiants de connexion :`,
    infoRows: [
      { label: "Identifiant", value: to },
      { label: "Mot de passe", value: password },
    ],
    extraHtml: `<tr><td style="padding-top:6px;font-size:13px;line-height:1.6;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;">Pour votre sécurité, pensez à modifier votre mot de passe après votre première connexion.</td></tr>`,
    ctaText: "Me connecter",
    ctaUrl: `${MEMBER_URL}/login`,
  });

  const text = `Bonjour,

Votre acces membre Pixaura est cree.

Identifiant : ${to}
Mot de passe : ${password}

Connexion : ${MEMBER_URL}/login

Cordialement,
L'équipe Pixaura`;

  return send({ to, subject: "Pixaura — Accès à votre espace membre", html, text });
}

/** 3. Email admin : nouvelle demande depuis le formulaire de contact. */
async function sendContactEmail({ nom, prenom, email, telephone, besoin, budget, secteur }) {
  const budgetLabel =
    {
      "under-5k": "Moins de 5k€",
      "5k-15k": "5k€ - 15k€",
      "15k-50k": "15k€ - 50k€",
      "over-50k": "Plus de 50k€",
    }[budget] ||
    budget ||
    "Non renseigné";

  const sectorLabel =
    {
      immobilier: "Immobilier",
      automobile: "Automobile",
      sport: "Sport",
      beaute: "Beauté",
      restauration: "Restauration",
      tech: "Tech",
      other: "Autre",
    }[secteur] ||
    secteur ||
    "Non renseigné";

  const html = renderEmailLayout({
    accent: "#0073ff",
    badge: "Nouveau contact",
    title: "Nouvelle demande de contact",
    introHtml: `Une nouvelle demande a été envoyée depuis le formulaire de contact du site.`,
    infoRows: [
      { label: "Nom", value: `${prenom} ${nom}` },
      { label: "Email", value: email },
      { label: "Téléphone", value: telephone },
      { label: "Budget estimé", value: budgetLabel },
      { label: "Secteur d'activité", value: sectorLabel },
    ],
    extraHtml: `
      <tr>
        <td style="padding-top:8px;">
          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;padding-bottom:8px;">Besoin / Description du projet</div>
          <div style="font-size:15px;line-height:1.6;color:#ffffff;background-color:#1a1a24;border-radius:12px;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(
            besoin
          )}</div>
        </td>
      </tr>`,
    footerNote: "Répondez directement à cet email pour recontacter le prospect.",
  });

  const text = `Nouvelle demande de contact - PIXaura

Nom: ${prenom} ${nom}
Email: ${email}
Téléphone: ${telephone}
Budget estimé: ${budgetLabel}
Secteur d'activité: ${sectorLabel}

Besoin / Description du projet:
${besoin}`;

  return send({
    to: process.env.CONTACT_EMAIL || "contact@pixaura.eu",
    replyTo: email,
    subject: `Nouvelle demande de contact - ${prenom} ${nom}`,
    html,
    text,
  });
}

/** 3 bis. Email admin : nouvelle demande P2C envoyée par un client. */
async function sendNewRequestAdminEmail({
  company,
  mainContact,
  email,
  phone,
  communicationAxis,
  projectDetails,
  requestedDate,
  timeSlotId,
  isFullDay,
  requestedTime,
  shootingAddress,
  technicalConstraints,
  onsiteContactName,
  onsiteContactPhone,
  freeComment,
  p2cSlot,
}) {
  const axisLabel =
    {
      commercial: "Commercial",
      humain: "Humain",
      expertise: "Expertise",
      autre: "Autre",
    }[communicationAxis] ||
    communicationAxis ||
    "Non renseigné";
  const dateLabel = requestedDate ? formatRequestDateFr(requestedDate) : "Non renseignée";
  const slotLabel = scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime });

  const infoRows = [
    { label: "Entreprise", value: company },
    { label: "Contact principal", value: mainContact },
    { label: "Email", value: email },
    { label: "Téléphone", value: phone },
    { label: "Date de tournage", value: dateLabel },
    { label: "Créneau", value: slotLabel },
    p2cSlot ? { label: "Projet", value: `P2C n°${p2cSlot} du mois` } : null,
    { label: "Axe de communication", value: axisLabel },
    { label: "Adresse de tournage", value: shootingAddress },
    { label: "Contact sur place", value: onsiteContactName },
    { label: "N° contact sur place", value: onsiteContactPhone },
  ].filter(Boolean);

  const block = (titre, contenu) =>
    contenu
      ? `<tr><td style="padding-top:8px;"><div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;padding-bottom:8px;">${titre}</div><div style="font-size:15px;line-height:1.6;color:#ffffff;background-color:#1a1a24;border-radius:12px;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(
          contenu
        )}</div></td></tr>`
      : "";

  const html = renderEmailLayout({
    accent: "#7c33ff",
    badge: "Nouvelle demande P2C",
    title: "Une nouvelle demande à valider",
    introHtml: `Un client vient d'envoyer une demande de tournage P2C. Elle est <strong style="color:#eab308;">en attente de validation</strong> dans votre espace admin.`,
    infoRows,
    extraHtml: `${block("Projet / demande", projectDetails)}${block(
      "Contraintes techniques",
      technicalConstraints
    )}${block("Commentaire libre", freeComment)}`,
    footerNote: "Connectez-vous à l'espace admin Pixaura pour valider ou refuser cette demande.",
  });

  const text = `Nouvelle demande P2C - PIXaura

Entreprise: ${company}
Contact principal: ${mainContact}
Email: ${email}
Téléphone: ${phone}
Date de tournage: ${dateLabel}
Créneau: ${slotLabel}${p2cSlot ? `\nProjet: P2C n°${p2cSlot} du mois` : ""}
Axe de communication: ${axisLabel}
Adresse de tournage: ${shootingAddress}
Contact sur place: ${onsiteContactName} (${onsiteContactPhone})

Projet / demande:
${projectDetails}

Contraintes techniques:
${technicalConstraints}${freeComment ? `\n\nCommentaire libre:\n${freeComment}` : ""}`;

  return send({
    to: process.env.CONTACT_EMAIL || "contact@pixaura.eu",
    replyTo: email,
    subject: `Nouvelle demande P2C - ${company || mainContact || "client"}`,
    html,
    text,
  });
}

/** 4. Email client : demande refusée (motif optionnel). */
async function sendRequestRejectedEmail({ to, company, requestedDate, timeSlotId, isFullDay, requestedTime, reason }) {
  const companyLabel = company ? String(company).trim() : "votre société";
  const dateLabel = requestedDate ? formatRequestDateFr(requestedDate) : "";
  const slotLabel =
    timeSlotId || requestedTime ? scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime }) : "";
  const hasReason = reason && String(reason).trim();

  const infoRows = [];
  if (dateLabel) infoRows.push({ label: "Date demandée", value: dateLabel });
  if (slotLabel) infoRows.push({ label: "Créneau demandé", value: slotLabel });

  const reasonHtml = hasReason
    ? `<tr><td style="padding-top:8px;"><div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;padding-bottom:8px;">Motif</div><div style="font-size:15px;line-height:1.6;color:#ffffff;background-color:#1a1a24;border-radius:12px;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(
        String(reason).trim()
      )}</div></td></tr>`
    : "";

  const html = renderEmailLayout({
    accent: "#ef4444",
    badge: "Demande refusée",
    title: "Votre demande n'a pas pu être retenue",
    introHtml: `Bonjour,<br><br>Nous sommes au regret de vous informer que votre demande de tournage pour <strong style="color:#ffffff;">${escapeHtml(
      companyLabel
    )}</strong> n'a pas pu être retenue.${
      hasReason ? "" : "<br><br>Vous pouvez proposer une nouvelle date directement depuis votre espace membre."
    }`,
    infoRows,
    extraHtml: reasonHtml,
    ctaText: "Proposer une autre date",
    ctaUrl: MEMBER_URL,
    footerNote: "Notre équipe reste à votre disposition pour trouver un créneau adapté.",
  });

  const text = `Bonjour,

Votre demande de tournage pour ${companyLabel} n'a pas pu être retenue.${
    dateLabel ? `\n\nDate demandée : ${dateLabel}` : ""
  }${slotLabel ? `\nCréneau demandé : ${slotLabel}` : ""}${hasReason ? `\n\nMotif : ${String(reason).trim()}` : ""}

Vous pouvez proposer une nouvelle date depuis votre espace membre : ${MEMBER_URL}

Cordialement,
L'équipe Pixaura`;

  return send({ to, subject: "Pixaura — Votre demande de tournage", html, text });
}

/** 5. Email client : demande à compléter (motif optionnel). */
async function sendRequestNeedMoreInfoEmail({ to, company, requestedDate, timeSlotId, isFullDay, requestedTime, reason }) {
  const companyLabel = company ? String(company).trim() : "votre société";
  const dateLabel = requestedDate ? formatRequestDateFr(requestedDate) : "";
  const slotLabel =
    timeSlotId || requestedTime ? scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime }) : "";
  const hasReason = reason && String(reason).trim();

  const infoRows = [];
  if (dateLabel) infoRows.push({ label: "Date demandée", value: dateLabel });
  if (slotLabel) infoRows.push({ label: "Créneau demandé", value: slotLabel });

  const reasonHtml = hasReason
    ? `<tr><td style="padding-top:8px;"><div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a9a;font-family:Arial,Helvetica,sans-serif;padding-bottom:8px;">Informations à compléter</div><div style="font-size:15px;line-height:1.6;color:#ffffff;background-color:#1a1a24;border-radius:12px;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(
        String(reason).trim()
      )}</div></td></tr>`
    : "";

  const html = renderEmailLayout({
    accent: "#f59e0b",
    badge: "À compléter",
    title: "Votre demande nécessite des informations",
    introHtml: `Bonjour,<br><br>Votre demande de tournage pour <strong style="color:#ffffff;">${escapeHtml(
      companyLabel
    )}</strong> est presque complète. Quelques informations supplémentaires sont nécessaires avant que nous puissions la valider.${
      hasReason ? "" : "<br><br>Merci de vous connecter à votre espace membre pour compléter et renvoyer votre demande."
    }`,
    infoRows,
    extraHtml: reasonHtml,
    ctaText: "Compléter ma demande",
    ctaUrl: MEMBER_URL,
    footerNote: "Une fois complétée, votre demande sera de nouveau examinée par notre équipe.",
  });

  const text = `Bonjour,

Votre demande de tournage pour ${companyLabel} nécessite des informations complémentaires avant validation.${
    dateLabel ? `\n\nDate demandée : ${dateLabel}` : ""
  }${slotLabel ? `\nCréneau demandé : ${slotLabel}` : ""}${
    hasReason ? `\n\nInformations à compléter : ${String(reason).trim()}` : ""
  }

Connectez-vous à votre espace membre pour compléter votre demande : ${MEMBER_URL}

Cordialement,
L'équipe Pixaura`;

  return send({ to, subject: "Pixaura — Informations complémentaires nécessaires", html, text });
}

/** 6. Email client : accusé de réception — demande reçue, en attente de validation. */
async function sendRequestPendingEmail({ to, company, requestedDate, timeSlotId, isFullDay, requestedTime }) {
  const companyLabel = company ? String(company).trim() : "votre société";
  const dateLabel = requestedDate ? formatRequestDateFr(requestedDate) : "";
  const slotLabel =
    timeSlotId || requestedTime ? scheduleLabelForRequest({ timeSlotId, isFullDay, requestedTime }) : "";

  const infoRows = [];
  if (dateLabel) infoRows.push({ label: "Date demandée", value: dateLabel });
  if (slotLabel) infoRows.push({ label: "Créneau demandé", value: slotLabel });

  const html = renderEmailLayout({
    accent: "#eab308",
    badge: "En attente de validation",
    title: "Nous avons bien reçu votre demande",
    introHtml: `Bonjour,<br><br>Votre demande de tournage pour <strong style="color:#ffffff;">${escapeHtml(
      companyLabel
    )}</strong> a bien été enregistrée. Elle est désormais <strong style="color:#eab308;">en attente de validation</strong> par notre équipe.`,
    infoRows,
    ctaText: "Suivre ma demande",
    ctaUrl: MEMBER_URL,
    footerNote: "Vous recevrez un email dès que votre demande aura été traitée.",
  });

  const text = `Bonjour,

Votre demande de tournage pour ${companyLabel} a bien été enregistrée. Elle est en attente de validation par notre équipe.${
    dateLabel ? `\n\nDate demandée : ${dateLabel}` : ""
  }${slotLabel ? `\nCréneau demandé : ${slotLabel}` : ""}

Vous recevrez un email dès qu'elle aura été traitée. Suivez votre demande : ${MEMBER_URL}

Cordialement,
L'équipe Pixaura`;

  return send({ to, subject: "Pixaura — Votre demande a bien été reçue", html, text });
}

module.exports = {
  sendCredentialsEmail,
  sendRequestValidatedEmail,
  sendContactEmail,
  sendNewRequestAdminEmail,
  sendRequestRejectedEmail,
  sendRequestNeedMoreInfoEmail,
  sendRequestPendingEmail,
};
