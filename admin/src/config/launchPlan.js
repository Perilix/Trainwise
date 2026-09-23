// Plan de communication et de prospection autour de la sortie iPhone (J0 = 7 oct. 2026).
// Les clés des actions sont stables : l'avancement coché est stocké en base sous ces clés.

const LAUNCH_DATE = '2026-10-07';

const PHASES = [
  {
    dates: '23 sept. → 30 sept.',
    rel: 'J-14 → J-7',
    title: 'Préparer le terrain',
    goal: 'Avoir de quoi montrer avant de parler à qui que ce soit : une page, une vidéo, une liste.',
    columns: [
      {
        label: 'Communication',
        tasks: [
          ['t01', 'Réécrire la fiche App Store : l’actuelle parle encore de coach IA et de TrainCoins'],
          ['t02', 'Une page « Pour les coachs » sur trainwise-app.com, avec les 4 plans et un bouton « Créer mon espace »'],
          ['t03', 'Vidéo démo de 60 s : le coach crée une séance, l’athlète la reçoit, le retour arrive (enregistrement d’écran, sans montage)'],
          ['t04', 'Ouvrir ou nettoyer le compte Instagram @trainwise et une page LinkedIn'],
          ['t05', 'Préparer 6 visuels : 3 écrans clés, 1 comparatif, 1 citation d’Hugo, 1 « C’est sorti »']
        ]
      },
      {
        label: 'Prospection',
        tasks: [
          ['t06', 'Construire une liste de 100 coachs dans un tableur : nom, Insta, discipline, nombre d’athlètes estimé, outil actuel'],
          ['t07', 'Hugo installe tous ses athlètes sur TestFlight dès maintenant'],
          ['t08', 'Recruter 5 à 10 « coachs fondateurs » dans ton réseau et celui d’Hugo (promo STAPS, clubs)'],
          ['t09', 'Décider de l’offre fondateurs, par exemple : plan Coach offert 3 mois puis -30 % à vie pour les 20 premiers (coupon Stripe)']
        ]
      }
    ],
    kpis: [['5 coachs fondateurs d’accord'], ['100 coachs listés']]
  },
  {
    dates: '1er oct. → 6 oct.',
    rel: 'J-6 → J-1',
    title: 'Teasing et coachs fondateurs à bord',
    goal: 'Pendant la revue Apple, faire en sorte que le jour J, des coachs soient déjà en train de l’utiliser.',
    columns: [
      {
        label: 'Communication',
        tasks: [
          ['t10', '2 posts « en coulisses » : pourquoi on a construit Trainwise, et une capture de l’éditeur de séance par blocs'],
          ['t11', 'Écrire le post LinkedIn de lancement de Julien et celui d’Hugo : histoire personnelle, pas de ton publicitaire'],
          ['t12', 'Préparer l’email aux testeurs et au réseau proche']
        ]
      },
      {
        label: 'Prospection',
        tasks: [
          ['t13', 'Visio d’installation de 20 min avec chaque coach fondateur : créer son espace et inviter 2 athlètes ensemble'],
          ['t14', 'Leur demander de republier l’annonce le jour J'],
          ['t15', 'Premiers messages « avant-première » aux 20 coachs les plus chauds de la liste']
        ]
      }
    ],
    kpis: [['5 coachs installés'], ['15 athlètes invités']]
  },
  {
    dates: 'Mer. 7 oct.',
    rel: 'J0',
    title: 'Le jour de la sortie',
    launch: true,
    goal: 'Une seule vague, le même jour, sur tous les canaux. Le matin tu publies, l’après-midi tu réponds à tout.',
    columns: [
      {
        label: 'Matin',
        tasks: [
          ['t16', '9 h : posts LinkedIn de Julien et d’Hugo, post et story Instagram, avec le lien App Store'],
          ['t17', 'Email aux testeurs et au réseau'],
          ['t18', 'Messages dans les groupes Facebook de coachs, en suivant le règlement de chaque groupe']
        ]
      },
      {
        label: 'Après-midi',
        tasks: [
          ['t19', 'Répondre à chaque commentaire et chaque message dans l’heure'],
          ['t20', 'Relancer les coachs qui ont aimé ou commenté : « je vous montre en 15 min ? »'],
          ['t21', 'Suivre les erreurs de l’API : un bug le jour J coûte plus cher que tout le reste']
        ]
      }
    ],
    kpis: [['10 coachs inscrits']]
  },
  {
    dates: '8 oct. → 4 nov.',
    rel: 'J+1 → J+4 sem.',
    title: 'Prospection directe, tous les jours',
    goal: 'Le mois qui compte. Pas de publicité : des messages un par un, des démos, et chaque coach inscrit accompagné jusqu’à ce qu’il ait invité ses athlètes.',
    columns: [
      {
        label: 'Communication',
        tasks: [
          ['t22', '3 posts par semaine : une fonctionnalité, un cas d’Hugo, un conseil d’entraînement'],
          ['t23', 'Mettre en avant les descriptions Strava « Planifié avec Trainwise » : elles montrent l’app dans le fil des amis de chaque athlète'],
          ['t24', 'Un premier témoignage de coach fondateur, en vidéo ou en capture']
        ]
      },
      {
        label: 'Prospection',
        tasks: [
          ['t25', '10 messages personnalisés par jour ouvré, soit environ 200 sur le mois'],
          ['t26', 'Hugo fait 3 à 5 messages par semaine dans son réseau de coachs'],
          ['t27', 'Relance à J+4 sans réponse, puis on arrête : jamais plus de 2 messages'],
          ['t28', 'Chaque inscrit : appel à J+2 et, si besoin, aide à l’import de ses athlètes']
        ]
      }
    ],
    kpis: [['30 coachs inscrits'], ['10 coachs actifs (≥ 3 athlètes)'], ['2 payants', 'paid']]
  },
  {
    dates: 'Novembre',
    rel: 'J+1 → J+2 mois',
    title: 'Android, premiers clubs, et un peu de publicité',
    goal: 'Android lève la première objection (« mes athlètes sont sur Android »). On commence à semer chez les clubs, et on teste la publicité avec un petit budget.',
    columns: [
      {
        label: 'Communication',
        tasks: [
          ['t29', 'Annonce de la sortie Android (mi-novembre) : deuxième vague, et raison de recontacter chaque « pas maintenant »'],
          ['t30', 'Test Meta Ads à 150 € ciblé sur les coachs sportifs : on arrête si une inscription coûte plus de 15 €'],
          ['t31', 'Article « Comment je gère 20 athlètes course + muscu » signé Hugo']
        ]
      },
      {
        label: 'Prospection',
        tasks: [
          ['t32', 'Contacter 15 clubs de la région : présidents de section, entraîneurs athlé et triathlon'],
          ['t33', 'Parrainage : un coach qui en amène un autre gagne 1 mois offert'],
          ['t34', 'Préparer la campagne de janvier : liste, messages, visuels']
        ]
      }
    ],
    kpis: [['50 coachs inscrits'], ['18 actifs'], ['5 payants', 'paid']]
  },
  {
    dates: 'Décembre → janvier',
    rel: 'J+2 → J+3 mois',
    title: 'La campagne de janvier, le vrai pic',
    goal: 'Début janvier, les athlètes reviennent avec leurs bonnes résolutions et les prépas des marathons de printemps commencent. C’est là que les coachs recrutent, et donc qu’ils changent d’outil. Octobre sert à arriver en janvier avec des témoignages.',
    columns: [
      {
        label: 'Communication',
        tasks: [
          ['t35', 'Mi-décembre : « Préparez votre saison 2027 avec Trainwise », avec 3 témoignages de coachs'],
          ['t36', 'Fin de l’offre fondateurs le 31 décembre, pour créer un peu d’urgence'],
          ['t37', 'Publicité concentrée du 2 au 20 janvier, si le test de novembre était rentable']
        ]
      },
      {
        label: 'Prospection',
        tasks: [
          ['t38', 'Relancer tous les « pas maintenant » d’octobre et de novembre'],
          ['t39', 'Signer 1 ou 2 clubs sur le plan Club'],
          ['t40', 'Bilan à J+90 : on décide du retour de l’IA et de la boutique selon les chiffres']
        ]
      }
    ],
    kpis: [['80 coachs inscrits'], ['25 actifs'], ['10 payants ≈ 350 € par mois', 'paid']]
  }
];

const TARGETS = [
  { tag: 'Priorité 1', tone: 'blue', title: 'Coachs running / trail indépendants', points: [
    '5 à 30 athlètes, gérés sur Excel, WhatsApp ou Nolio',
    'Présents sur Instagram, souvent jeunes diplômés STAPS ou BE',
    'Leur problème : le temps perdu à écrire et envoyer les plans'
  ] },
  { tag: 'Priorité 1', tone: 'blue', title: 'Préparateurs physiques course + muscu', points: [
    'Ce que Trainwise fait de mieux : allures VMA et charges 1RM au même endroit',
    'TrueCoach ne gère pas la course, Nolio ne suit pas les charges',
    'Salles de sport, préparation de trail ou d’hyrox'
  ] },
  { tag: 'Vitrine', tone: 'purple', title: 'Hugo Bastide et ses athlètes', points: [
    'Premier cas réel : captures, témoignage, chiffres d’usage',
    'Hugo parle aux coachs mieux que nous : c’est un confrère',
    'Le coaching humain (50/50) reste une offre pour les athlètes, pas le cœur de la V1'
  ] },
  { tag: 'Plus tard (déc. →)', tone: 'grey', title: 'Clubs, sections athlé, triathlon', points: [
    'Plan Club à 119 €, jusqu’à 100 athlètes',
    'Cycle de vente long : on sème en novembre pour signer en janvier',
    'Il faut d’abord 2 ou 3 coachs qui témoignent'
  ] }
];

const PITCH = {
  line: 'Le planning course et muscu de tous vos athlètes dans une seule app. Gratuite pour vos athlètes, gratuite pour vous jusqu’à 3.',
  versus: [
    ['Face à Nolio', 'aussi précis, la muscu en plus, bien plus simple, et vos athlètes ne paient jamais d’abonnement Premium.'],
    ['Face à TrueCoach', 'les mêmes envois de programmes, mais en français, avec la course : allures, blocs et Strava.']
  ]
};

const ROUTINE = [
  ['Lundi', 'Post LinkedIn', 'une fonctionnalité ou un chiffre', '10 messages · compléter la liste de 20 noms'],
  ['Mardi', 'Story Instagram', 'un écran de l’app', '10 messages · relances de J+4'],
  ['Mercredi', 'Post Instagram', 'cas d’Hugo ou témoignage', '10 messages · créneau de démos (17 h–19 h)'],
  ['Jeudi', '—', '', '10 messages · appels aux inscrits de la semaine'],
  ['Vendredi', 'Post conseil d’entraînement', 'rédigé par Hugo', '10 messages · bilan de la semaine dans le tableur']
];

const CHANNELS = [
  ['Messages Instagram aux coachs', 'C’est là que les coachs indépendants montrent leur activité. Message personnalisé qui cite un de leurs posts, jamais de copier-coller visible.', 'Priorité', 'hi'],
  ['Réseau d’Hugo et promos STAPS', 'Un confrère convainc mieux qu’un fondateur. Anciens camarades de promo, profs, coachs rencontrés en compétition.', 'Priorité', 'hi'],
  ['Athlètes → Strava', 'Chaque sortie synchronisée porte « Planifié avec Trainwise ». C’est gratuit et automatique : à mettre en avant auprès des coachs.', 'Automatique', 'hi'],
  ['LinkedIn (Julien + Hugo)', 'Récit de fondateur et coulisses. Touche les préparateurs physiques, les salles et les dirigeants de club.', 'Régulier', 'mid'],
  ['Groupes Facebook de coachs et forums running', 'Apporter de l’aide avant de parler de l’app. Un post de lancement seulement là où le règlement l’autorise.', 'Ponctuel', 'mid'],
  ['Clubs et sections', 'Cycle de vente long, mais plan à 119 €. À semer en novembre pour signer en janvier.', 'Dès novembre', 'mid'],
  ['Meta Ads', 'Seulement après avoir vu que les coachs qui s’inscrivent restent. Test à 150 € en novembre, avec un seuil d’arrêt clair.', 'Test', 'lo'],
  ['Salons, presse, influenceurs running', 'Coûteux ou aléatoire à ce stade. Plus pertinent pour le salon du running de printemps, avec des témoignages en main.', 'Plus tard', 'lo']
];

const SCRIPTS = [
  {
    title: 'Premier message Instagram à un coach',
    hint: 'Court, sans lien, finit par une question',
    text: `Salut [prénom] ! J'ai vu ta prépa [semi / trail / hyrox] avec [détail vu dans un post], c'est top.

Je suis Julien, je développe Trainwise avec Hugo, coach diplômé STAPS : une app où tu programmes course ET muscu pour tes athlètes (allures VMA, charges 1RM, sync Strava), et qui reste gratuite pour eux.

Tu gères tes plans comment aujourd'hui ? Excel, Nolio, autre ?`
  },
  {
    title: 'Réponse quand il décrit son outil',
    hint: 'Proposer une démo, pas un lien',
    text: `Ok je vois, [reformuler son problème : ex. « recopier les plans dans WhatsApp chaque semaine »].

C'est exactement ce qu'on a voulu régler. Je te montre en 15 min en visio ? Tu repars avec ton espace créé et 2 athlètes invités, et c'est gratuit jusqu'à 3 athlètes.

Dispo [jour] ou [jour] en fin de journée ?`
  },
  {
    title: 'Relance à J+4',
    hint: 'Une seule, puis on arrête',
    text: `Je me permets une petite relance [prénom] : on offre le plan Coach 3 mois aux 20 premiers coachs qui nous rejoignent (il reste [X] places). Si ce n'est pas le moment, aucun souci, je ne t'embête plus 🙂`
  },
  {
    title: 'Post LinkedIn de lancement (Julien)',
    hint: 'Récit personnel, puis le produit, puis la demande',
    text: `Aujourd'hui, Trainwise sort sur l'App Store.

Il y a un an, j'ai vu Hugo, coach fraîchement diplômé, passer ses dimanches soirs à recopier des plans d'entraînement dans des messages WhatsApp. Course d'un côté, muscu de l'autre, rien de relié.

Trainwise, c'est une app pour les coachs qui suivent des athlètes :
→ séances de course par blocs, allures calculées depuis la VMA
→ muscu avec charges suivies série par série
→ séances synchronisées avec Strava, retours de l'athlète, chat
→ gratuite pour les athlètes, gratuite pour le coach jusqu'à 3 athlètes

Si vous êtes coach, ou si vous en connaissez un, j'adorerais avoir votre avis. Le lien est en commentaire.`
  },
  {
    title: 'Email à un club',
    hint: 'À partir de novembre, avec au moins un témoignage',
    text: `Objet : Plans d'entraînement de la section [nom] : 15 min pour vous montrer ?

Bonjour [prénom],

Je suis Julien, cofondateur de Trainwise, une app française qui permet aux entraîneurs de programmer la course et le renforcement de leurs athlètes, de suivre ce qui est réalisé (synchronisé avec Strava) et d'échanger avec eux, sans que les licenciés aient quoi que ce soit à payer.

[Nom du coach], qui suit [N] athlètes avec, nous dit : « [citation courte] ».

Seriez-vous d'accord pour une démo de 15 minutes avec vos entraîneurs ? Je peux aussi passer à une séance au stade.

Bonne journée,
Julien — trainwise-app.com`
  }
];

const BUDGET = [
  ['Meta Ads, test de novembre', 150],
  ['Meta Ads, janvier (si rentable)', 200],
  ['Outils (Canva Pro, 3 mois)', 36],
  ['Déplacements (clubs, séances au stade)', 80],
  ['Réserve', 34]
];

const TASK_KEYS = PHASES.flatMap(p => p.columns.flatMap(c => c.tasks.map(([key]) => key)));

module.exports = { LAUNCH_DATE, PHASES, TARGETS, PITCH, ROUTINE, CHANNELS, SCRIPTS, BUDGET, TASK_KEYS };
