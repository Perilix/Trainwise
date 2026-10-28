const { ESPACES } = require('../config/prospectionDb');

// Les mails du bureau, repris des envois de prospection d'octobre (offre FOULEE-DOREE-50, signature 4B).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const APP_STORE = 'https://apps.apple.com/fr/app/trainwise/id6758860737';
const SUJET = 'Le suivi de vos athlètes, -50 % pour le lancement';

// « Hugues Debayle » → Hugues ; un club, une équipe ou un nom inconnu → pas de prénom (« Bonjour, »).
const PAS_UNE_PERSONNE = /club|team|équipe|equipe|association|asso\b|athl|triathlon|running|\brun\b|trail|sport|coaching|cycling|stade|salle|groupe|\b(us|ca|as|sa)\b|coach non/i;
function prenom(c) {
  const nom = String(c.nom || '').trim();
  if (!nom || nom === c.structure || PAS_UNE_PERSONNE.test(nom)) return null;
  const mot = nom.replace(/^[«"\s]+/, '').split(/[\s(]+/)[0];
  return /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+$/.test(mot) && !/^(coach|monsieur|madame)$/i.test(mot) ? mot : null;
}
// « Nolio (+ HRV4Training) » → « , via Nolio » ; inconnu ou outil maison → rien.
function viaOutil(c) {
  const o = String(c.outil || '').trim();
  if (!o || o.startsWith('?') || /maison|propriétaire|non nomm|drive|excel/i.test(o)) return '';
  return `, via ${o.split(/ \(| \+|,| \//)[0].trim()}`;
}

const P = t => `<p>${t}</p>`;
const lien = (href, texte) => `<a href="${href}" style="color: rgb(0, 119, 182)" target="_blank">${texte}</a>`;

function signature(espace) {
  const e = ESPACES[espace];
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: &quot;Helvetica Neue&quot;, Arial, sans-serif"><tbody><tr>
<td style="padding-right: 14px; vertical-align: middle"><a href="https://www.trainwise-app.com" target="_blank"><img src="https://www.trainwise-app.com/icon.png" width="48" height="48" alt="Trainwise" style="display: block; width: 48px; height: 48px; border-radius: 11px; border: 0"></a></td>
<td style="padding-left: 14px; vertical-align: middle; border-left: 1px solid rgb(231, 226, 217)">
<div style="font-size: 14px; line-height: 20px; font-weight: 700; color: rgb(0, 53, 84)">${esc(e.nom)}</div>
<div style="font-size: 12px; line-height: 18px; color: rgb(90, 104, 120)">${esc(e.titre)}</div>
<div style="font-size: 12px; line-height: 18px"><a href="https://www.trainwise-app.com" style="color: rgb(0, 119, 182); text-decoration: none; font-weight: 600" target="_blank">trainwise-app.com</a> <span style="color: rgb(183, 190, 198)">·</span> <a href="${APP_STORE}" style="color: rgb(0, 119, 182); text-decoration: none" target="_blank">Télécharger l'app</a></div>
</td></tr></tbody></table>`;
}
const corps = contenu => `<div style="font-family: &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 14px; line-height: 21px; color: rgb(5, 25, 35)">${contenu}</div>`;

function premierMail(espace, c) {
  const e = ESPACES[espace], p = prenom(c);
  return {
    sujet: SUJET,
    html: corps([
      P(p ? `Bonjour ${esc(p)},` : 'Bonjour,'),
      P(`Je m'appelle ${esc(e.prenom)}${esc(e.presentation)}, une app de suivi d'entraînement pour les coachs d'endurance et leurs athlètes. Elle vient de sortir sur l'App Store.`),
      P(`J'ai vu que vous suiviez vos athlètes${esc(viaOutil(c))}. Trainwise couvre le même quotidien : planning, bibliothèque de séances, messagerie, et les séances Strava remontent toutes seules. En plus, il y a le suivi de la muscu (charges, séries) et une vue de la forme de chaque athlète (charge, fréquence cardiaque, ressenti).`),
      P(`Je cherche une dizaine de coachs pour le lancement. Avec le code <b>FOULEE-DOREE-50</b>, les deux premiers mois du plan Coach (jusqu'à 15 athlètes) sont à -50 %, puis 29 €/mois si ça vous convient, sans engagement. Vos retours décideront directement de ce que nous construisons ensuite.`),
      P(`Est-ce que 15 minutes en visio cette semaine ou la suivante vous iraient, pour que je vous la montre ? Sinon, vous pouvez la tester directement : ${lien('https://www.trainwise-app.com', 'www.trainwise-app.com')}`),
      P('Belle journée,'),
      signature(espace),
      `<p style="font-size: 12px; color: rgb(125, 135, 147); margin-top: 18px">PS : si ce n'est pas pour vous, un simple « non merci » suffit, et je ne vous relancerai pas.</p>`
    ].join(''))
  };
}

function relance(espace, c) {
  const p = prenom(c);
  return corps([
    P(p ? `Bonjour ${esc(p)},` : 'Bonjour,'),
    P(`Je me permets une petite relance, au cas où mon message se serait perdu. Je garde une place pour vous parmi les coachs du lancement, avec -50 % pendant deux mois sur le plan Coach (code <b>FOULEE-DOREE-50</b>).`),
    P(`Si vous avez 15 minutes, je vous montre l'app. Sinon, pas de souci, je ne vous relancerai plus.`),
    signature(espace)
  ].join(''));
}

module.exports = { SUJET, prenom, premierMail, relance };
