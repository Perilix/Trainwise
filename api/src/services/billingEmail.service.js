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

/** Au coach, à chaque paiement réussi. */
const paymentReceived = (data) => {
  const prenom = data.name.split(' ')[0];
  const hello = prenom ? `Bonjour ${escape(prenom)},` : 'Bonjour,';
  return data.firstPayment
    ? {
        subject: `Bienvenue dans ${data.planName} 🎉`,
        html: layout({
          overline: 'Abonnement activé',
          title: `Bienvenue dans ${escape(data.planName)}`,
          intro: `${hello}<br><br>Merci pour votre confiance ! Votre abonnement est actif dès maintenant : vous pouvez inviter vos athlètes et construire leur planning. Voici le récapitulatif de votre paiement.`,
          body: `${recapCard(data)}${buttons(data)}
            <p style="margin:18px 0 0 0;font-size:14px;line-height:22px;color:${TEXT2};">Je lis chaque réponse à ce mail : une question, une idée, un bug, écrivez-moi.<br>Julien, fondateur de Trainwise</p>`
        })
      }
    : {
        subject: `Votre reçu Trainwise · ${euros(data.total)}`,
        html: layout({
          overline: 'Paiement reçu',
          title: `Merci, c'est réglé`,
          intro: `${hello}<br><br>Votre paiement pour ${escape(data.planName)} est bien passé. Votre abonnement continue sans interruption.`,
          body: `${recapCard(data)}${buttons(data)}`
        })
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
