/**
 * Les mails de facturation, aux couleurs de Trainwise.
 *
 * - au coach : un récapitulatif à chaque paiement (avec la facture PDF de Stripe),
 *   et un mail quand un paiement échoue ;
 * - au fondateur : une alerte à chaque nouvel abonné, résiliation ou échec de paiement.
 *
 * Un mail qui ne part pas ne doit jamais faire échouer le webhook : Stripe le
 * rejouerait, et l'abonnement est déjà enregistré.
 */
const { send } = require('./email.service');
const { planByPriceId } = require('../config/plans');

const NAVY = '#003554';
const BLUE = '#00A6FB';
const INK = '#051923';
const TEXT2 = '#5A6878';
const BEIGE = '#F6F4F0';
const SUBTLE = '#EFEBE4';
const BORDER = '#E7E2D9';
const LOGO = 'https://www.trainwise-app.com/icon.png';

const webUrl = () => (process.env.FRONTEND_URL || 'https://www.trainwise-app.com').replace(/\/$/, '');
const founderEmail = () => process.env.BILLING_NOTIFY_EMAIL || 'julien@trainwise-app.com';

const euros = (cents) =>
  typeof cents === 'number'
    ? `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '—';

const day = (seconds) =>
  seconds ? new Date(seconds * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Ce qu'on lit d'une facture Stripe, quelle que soit la version de l'API. */
const readInvoice = (invoice) => {
  const line = invoice.lines?.data?.find((l) => l.amount > 0) || invoice.lines?.data?.[0] || {};
  const priceId = line.pricing?.price_details?.price || line.price?.id || null;
  const match = planByPriceId(priceId);
  const discount = Math.max(0, (invoice.subtotal ?? 0) - (invoice.total ?? 0));
  return {
    number: invoice.number || invoice.id,
    planName: match ? `Trainwise ${match.plan.name}` : line.description || 'Abonnement Trainwise',
    cycle: match?.cycle === 'yearly' ? 'annuel' : 'mensuel',
    periodStart: line.period?.start,
    periodEnd: line.period?.end,
    subtotal: invoice.subtotal,
    discount,
    total: invoice.amount_paid || invoice.total,
    pdf: invoice.invoice_pdf || null,
    hosted: invoice.hosted_invoice_url || null,
    email: invoice.customer_email,
    name: invoice.customer_name || '',
    paidAt: invoice.status_transitions?.paid_at || invoice.created,
    firstPayment: invoice.billing_reason === 'subscription_create'
  };
};

const button = (href, label, filled = true) =>
  `<a href="${href}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;${
    filled ? `background-color:${NAVY};color:#FFFFFF;` : `background-color:#FFFFFF;color:${NAVY};border:1px solid ${NAVY};`
  }">${label}</a>`;

const row = (label, value, strong = false) =>
  `<tr><td style="padding:7px 0;font-size:14px;color:${TEXT2};">${label}</td><td align="right" style="padding:7px 0;font-size:${
    strong ? '16px' : '14px'
  };font-weight:${strong ? 700 : 500};color:${strong ? NAVY : INK};">${value}</td></tr>`;

/** La coque commune : bandeau navy, carte blanche, pied de page. */
const layout = ({ overline, title, intro, body }) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background-color:${BEIGE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BEIGE}" style="background-color:${BEIGE};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:18px 18px 0 0;padding:26px 30px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:12px;vertical-align:middle;"><img src="${LOGO}" width="40" height="40" alt="Trainwise" style="display:block;border-radius:10px;border:0;"></td>
      <td style="vertical-align:middle;font-size:22px;font-weight:800;font-style:italic;letter-spacing:-0.3px;"><span style="color:#FFFFFF;">Train</span><span style="color:${BLUE};">wise</span></td>
    </tr></table>
    <div style="padding-top:22px;font-size:11px;font-weight:700;letter-spacing:0.66px;text-transform:uppercase;color:#7FD3FD;">${overline}</div>
    <div style="padding-top:6px;font-size:24px;line-height:30px;font-weight:700;color:#FFFFFF;">${title}</div>
  </td></tr>
  <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid ${BORDER};border-top:0;border-radius:0 0 18px 18px;padding:28px 30px 26px 30px;color:${INK};">
    <p style="margin:0 0 20px 0;font-size:15px;line-height:23px;">${intro}</p>
    ${body}
  </td></tr>
  <tr><td align="center" style="padding:20px 10px 0 10px;font-size:12px;line-height:18px;color:#7D8793;">
    Trainwise · le suivi d'entraînement des coachs d'endurance<br>
    <a href="${webUrl()}" style="color:#0077B6;text-decoration:none;">trainwise-app.com</a> · une question ? répondez simplement à ce mail
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const recapCard = (data) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SUBTLE}" style="background-color:${SUBTLE};border-radius:14px;">
<tr><td style="padding:18px 20px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.66px;text-transform:uppercase;color:#0077B6;padding-bottom:6px;">Récapitulatif · facture ${escape(data.number)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${row('Abonnement', `${escape(data.planName)} (${data.cycle})`)}
    ${data.periodStart ? row('Période', `${day(data.periodStart)} → ${day(data.periodEnd)}`) : ''}
    ${data.discount ? row('Prix', euros(data.subtotal)) + row('Remise de lancement', `− ${euros(data.discount)}`) : ''}
    <tr><td colspan="2" style="border-top:1px solid ${BORDER};font-size:0;line-height:0;padding-top:4px;">&nbsp;</td></tr>
    ${row('Total payé', euros(data.total), true)}
  </table>
</td></tr></table>`;

const buttons = (data) => `
<div style="padding-top:22px;">
  ${data.pdf ? button(data.pdf, 'Télécharger la facture') : data.hosted ? button(data.hosted, 'Voir la facture') : ''}
  ${button(`${webUrl()}/coach/abonnement`, 'Gérer mon abonnement', false)}
</div>`;

/** Les mentions du pied de facture (SIRET, TVA…), réglées par variable d'environnement. */
const legal = () =>
  (process.env.INVOICE_LEGAL_MENTIONS || 'TVA non applicable, art. 293 B du CGI')
    .split('|')
    .map((l) => escape(l.trim()))
    .join('<br>');

const cell = (content, { align = 'left', color = INK, size = 14, weight = 400, pad = '14px 0', line = false, caps = false } = {}) =>
  `<td align="${align}" style="padding:${pad};font-size:${size}px;line-height:20px;font-weight:${weight};color:${color};${
    line ? `border-bottom:1px solid ${BORDER};` : ''
  }${caps ? 'letter-spacing:1px;text-transform:uppercase;' : ''}">${content}</td>`;

const totalRow = (label, value, { strong = false, color } = {}) => `<tr>
  <td></td>
  ${cell(label, { color: strong ? INK : TEXT2, size: strong ? 15 : 13, weight: strong ? 700 : 400, pad: strong ? '14px 0 0 0' : '5px 0' })}
  ${cell(value, { align: 'right', color: color || (strong ? NAVY : INK), size: strong ? 18 : 13, weight: strong ? 800 : 500, pad: strong ? '14px 0 0 0' : '5px 0' })}
</tr>`;

/** Au coach, à chaque paiement réussi : une facture en bonne et due forme. */
const paymentReceived = (data) => {
  const prenom = data.name.split(' ')[0];
  const lead = data.firstPayment
    ? `${prenom ? `Bienvenue ${escape(prenom)} ! ` : 'Bienvenue ! '}Votre abonnement ${escape(data.planName)} est actif : vous pouvez inviter vos athlètes et construire leur planning dès maintenant.`
    : `${prenom ? `Merci ${escape(prenom)}, ` : 'Merci, '}votre paiement est bien passé et votre abonnement continue sans interruption.`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>Facture ${escape(data.number)}</title></head>
<body style="margin:0;padding:0;background-color:${BEIGE};">
<div style="display:none;max-height:0;overflow:hidden;">Facture ${escape(data.number)} · ${euros(data.total)} payés · ${escape(data.planName)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BEIGE}" style="background-color:${BEIGE};">
<tr><td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- En-tête -->
  <tr><td bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:20px 20px 0 0;padding:28px 34px 34px 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;"><img src="${LOGO}" width="36" height="36" alt="Trainwise" style="display:block;border-radius:9px;border:0;"></td>
          <td style="vertical-align:middle;font-size:20px;font-weight:800;font-style:italic;letter-spacing:-0.3px;"><span style="color:#FFFFFF;">Train</span><span style="color:${BLUE};">wise</span></td>
        </tr></table>
      </td>
      <td align="right" style="vertical-align:middle;font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:#7FD3FD;font-weight:700;">Facture<br><span style="letter-spacing:0.4px;color:#FFFFFF;font-size:13px;font-weight:600;text-transform:none;">${escape(data.number)}</span></td>
    </tr></table>

    <div style="height:1px;line-height:1px;font-size:0;background-color:#1D4E6C;margin:26px 0 24px 0;">&nbsp;</div>

    <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#9FB7C7;font-weight:600;">Montant payé</div>
    <div style="padding-top:6px;font-size:42px;line-height:48px;font-weight:800;letter-spacing:-1px;color:#FFFFFF;">${euros(data.total)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>
      <td bgcolor="#0E5B45" style="background-color:#0E5B45;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;color:#7CF0C5;">&#10003;&nbsp; Payée</td>
      <td style="padding-left:12px;font-size:13px;color:#9FB7C7;">le ${day(data.paidAt)}</td>
    </tr></table>
  </td></tr>

  <!-- Corps -->
  <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};padding:30px 34px 6px 34px;">
    <p style="margin:0 0 28px 0;font-size:15px;line-height:24px;color:${INK};">${lead}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="50%" valign="top" style="padding-right:12px;">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${TEXT2};font-weight:700;padding-bottom:6px;">Facturé à</div>
        <div style="font-size:14px;line-height:21px;color:${INK};font-weight:600;">${escape(data.name || data.email)}</div>
        ${data.name ? `<div style="font-size:13px;line-height:20px;color:${TEXT2};">${escape(data.email)}</div>` : ''}
      </td>
      <td width="50%" valign="top" style="padding-left:12px;">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${TEXT2};font-weight:700;padding-bottom:6px;">Émis par</div>
        <div style="font-size:14px;line-height:21px;color:${INK};font-weight:600;">Trainwise</div>
        <div style="font-size:13px;line-height:20px;color:${TEXT2};">${escape(founderEmail())}</div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;border-collapse:collapse;">
      <tr>
        ${cell('Description', { size: 11, weight: 700, color: TEXT2, pad: '0 0 10px 0', line: true, caps: true })}
        ${cell('Période', { size: 11, weight: 700, color: TEXT2, pad: '0 0 10px 0', line: true, caps: true })}
        ${cell('Montant', { align: 'right', size: 11, weight: 700, color: TEXT2, pad: '0 0 10px 0', line: true, caps: true })}
      </tr>
      <tr>
        ${cell(`<b>${escape(data.planName)}</b><br><span style="color:${TEXT2};font-size:13px;">Abonnement ${data.cycle}</span>`, { line: true })}
        ${cell(data.periodStart ? `${day(data.periodStart)}<br><span style="color:${TEXT2};font-size:13px;">au ${day(data.periodEnd)}</span>` : '—', { size: 13, line: true })}
        ${cell(euros(data.subtotal), { align: 'right', weight: 600, line: true })}
      </tr>
      ${totalRow('Sous-total', euros(data.subtotal))}
      ${data.discount ? totalRow('Remise de lancement', `− ${euros(data.discount)}`, { color: '#0E7A5A' }) : ''}
      ${totalRow('TVA', '0,00 €')}
      ${totalRow('Total payé', euros(data.total), { strong: true })}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td>
      ${data.pdf ? button(data.pdf, 'Télécharger la facture PDF') : data.hosted ? button(data.hosted, 'Voir la facture') : ''}
      ${button(`${webUrl()}/coach/abonnement`, 'Gérer mon abonnement', false)}
    </td></tr></table>
  </td></tr>

  <!-- Mot du fondateur -->
  <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 20px 20px;padding:10px 34px 30px 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BEIGE}" style="background-color:${BEIGE};border-radius:14px;"><tr>
      <td style="padding:16px 18px;font-size:13px;line-height:20px;color:${TEXT2};">
        <b style="color:${NAVY};">Une question sur votre facture ?</b><br>Répondez simplement à ce mail : c'est moi qui vous réponds.<br><span style="color:${INK};">Julien, fondateur de Trainwise</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Mentions -->
  <tr><td align="center" style="padding:22px 20px 0 20px;font-size:11px;line-height:17px;color:#8A939D;">
    ${legal()}<br>
    Paiement sécurisé par Stripe · <a href="${webUrl()}" style="color:#0077B6;text-decoration:none;">trainwise-app.com</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  return {
    subject: data.firstPayment
      ? `Bienvenue dans ${data.planName} · facture ${data.number}`
      : `Facture ${data.number} · ${euros(data.total)} payés`,
    html
  };
};

/** Au coach, quand le prélèvement est refusé. */
const paymentFailed = (data) => ({
  subject: 'Votre paiement Trainwise n’est pas passé',
  html: layout({
    overline: 'Paiement refusé',
    title: 'Un souci avec votre carte',
    intro: `Bonjour${data.name ? ` ${escape(data.name.split(' ')[0])}` : ''},<br><br>Le paiement de ${euros(
      data.total || data.subtotal
    )} pour ${escape(data.planName)} n'a pas pu être effectué. Stripe va réessayer automatiquement dans les prochains jours ; pour éviter toute coupure, mettez votre carte à jour.`,
    body: `<div>${data.hosted ? button(data.hosted, 'Régler la facture') : ''}${button(`${webUrl()}/coach/abonnement`, 'Mettre à jour ma carte', !data.hosted)}</div>`
  })
});

/** Au fondateur : une ligne claire, pas de mise en page. */
const founderAlert = (subject, lines) => ({
  subject,
  html: `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:22px;color:${INK};">${lines
    .filter(Boolean)
    .map((l) => `<div>${l}</div>`)
    .join('')}</div>`
});

const safely = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    console.error(`[billing-email] ${label} : ${error.message}`);
  }
};

exports.onInvoicePaid = (invoice) =>
  safely('paiement reçu', async () => {
    if (!invoice.amount_paid) return; // facture à 0 € : rien à récapituler
    const data = readInvoice(invoice);
    if (data.email) await send({ to: data.email, replyTo: founderEmail(), ...paymentReceived(data) });
    if (data.firstPayment) {
      await send({
        to: founderEmail(),
        ...founderAlert(`🎉 Nouvel abonné : ${data.name || data.email} · ${data.planName}`, [
          `<b>${escape(data.name || '—')}</b> · ${escape(data.email)}`,
          `${escape(data.planName)} (${data.cycle}) · payé ${euros(data.total)}${data.discount ? ` (remise ${euros(data.discount)})` : ''}`,
          data.hosted ? `<a href="${data.hosted}">Voir la facture</a>` : ''
        ])
      });
    }
  });

exports.onInvoiceFailed = (invoice) =>
  safely('paiement refusé', async () => {
    const data = readInvoice(invoice);
    if (data.email) await send({ to: data.email, replyTo: founderEmail(), ...paymentFailed(data) });
    await send({
      to: founderEmail(),
      ...founderAlert(`⚠️ Paiement refusé : ${data.name || data.email}`, [
        `${escape(data.email)} · ${escape(data.planName)} · ${euros(data.total || data.subtotal)}`,
        data.hosted ? `<a href="${data.hosted}">Voir la facture</a>` : ''
      ])
    });
  });

exports.onSubscriptionEnded = (subscription, user) =>
  safely('résiliation', () =>
    send({
      to: founderEmail(),
      ...founderAlert(`Résiliation : ${user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : subscription.customer}`, [
        user?.email ? escape(user.email) : '',
        subscription.cancellation_details?.reason ? `Motif : ${escape(subscription.cancellation_details.reason)}` : '',
        subscription.cancellation_details?.feedback ? `Retour : ${escape(subscription.cancellation_details.feedback)}` : '',
        subscription.cancellation_details?.comment ? `Commentaire : « ${escape(subscription.cancellation_details.comment)} »` : ''
      ])
    })
  );

// Pour l'aperçu et les tests.
exports._render = { paymentReceived, paymentFailed, readInvoice };
