// Templates d'emails de relance — séparés du code d'envoi pour rester faciles
// à relire et modifier sans toucher à la logique.

/**
 * Campagne "changement de nom" — pour les clients qui ont réservé du temps de
 * Next Yacht et ne savent pas que la marque s'appelle désormais Harmonie Yacht.
 */
const OUTREACH_OFFER_HTML: string =
  "Et si vous décidez de remonter à bord avec nous cette année, on vous réserve une petite surprise 🎁";

export function buildNameChangeEmail(
  firstName: string | null,
  unsubscribeUrl: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const prenom = firstName ? ` ${firstName}` : "";
  const subject = "On a changé de nom ⚓";

  const offerHtml = OUTREACH_OFFER_HTML
    ? `<p style="margin:0 0 16px;">${OUTREACH_OFFER_HTML}</p>`
    : "";
  const offerText = OUTREACH_OFFER_HTML ? `\n${OUTREACH_OFFER_HTML.replace(/<[^>]+>/g, "")}\n` : "";

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
<h2 style="margin:0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; font-size: 22px; letter-spacing: 0.3px; color: #1a5490;">⚓&nbsp; On a changé de nom</h2>
<p>Bonjour${prenom},</p>
<p style="margin:0 0 16px;">Vous aviez réservé une expérience à bord avec nous, à l'époque sous le nom de <strong>Next Yacht</strong>. Depuis, nous nous appelons <strong>Harmonie Yacht</strong> — le bateau, le port de Carnon et l'équipe n'ont pas changé, seul le nom.</p>
<p style="margin:0 0 16px;">On en profite pour vous partager notre nouveau site, avec toutes nos offres actuelles :</p>
<p style="margin:0 0 16px;"><a href="https://harmonie-yacht.fr" style="color:#1a5490; font-weight:bold;">harmonie-yacht.fr</a></p>
${offerHtml}
<p style="margin-top: 32px;">Au plaisir de vous accueillir de nouveau à bord 🌅</p>
<p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; color: #666;"><strong>L'équipe Harmonie Yacht</strong><br>📞 07 53 48 12 63</p>
<p style="margin-top: 20px; font-size: 12px; color: #999;"><a href="${unsubscribeUrl}" style="color:#999;">Se désabonner de nos emails</a></p>
</div>`;

  const text =
    `Bonjour${prenom},\n\n` +
    `Vous aviez réservé une expérience à bord avec nous, à l'époque sous le nom de Next Yacht. Depuis, nous nous appelons Harmonie Yacht — le bateau, le port de Carnon et l'équipe n'ont pas changé, seul le nom.\n\n` +
    `On en profite pour vous partager notre nouveau site, avec toutes nos offres actuelles : harmonie-yacht.fr\n` +
    offerText +
    `\nAu plaisir de vous accueillir de nouveau à bord,\n\n` +
    `L'équipe Harmonie Yacht\n` +
    `07 53 48 12 63\n\n` +
    `Se désabonner : ${unsubscribeUrl}`;

  return { subject, html, text };
}
