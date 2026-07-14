// Bibliothèque de séances de référence pour la génération de plans IA.
// L'IA pioche dans ce catalogue, adapte les volumes au profil et place les
// séances au bon moment de la préparation — elle n'invente pas de structure.
//
// Chaque séance :
// - type       : sessionType de l'app (fractionne, tempo, cotes, fartlek, endurance, sortie_longue, recuperation)
// - structure  : description compacte des blocs (l'IA la traduit en runBlocks, zones à l'appui)
// - races      : objectifs pour lesquels la séance est pertinente ('5k','10k','semi','marathon','all')
// - phases     : moments de la prépa ('generale' >12 sem, 'specifique' 12-4 sem, 'affutage' <4 sem, 'entretien' sans objectif)
// - levels     : 'debutant' | 'intermediaire' | 'avance'
// - key        : true = séance clé de la prépa (à placer en priorité dans la bonne fenêtre)
//
// ⚠️ Contenu à valider/enrichir avec Hugo (coach STAPS) — c'est la méthode Trainwise.

const WORKOUT_LIBRARY = [
  // ===== VMA courte (développement, phase générale) =====
  { id: 'vma-30-30', name: '30/30', type: 'fractionne', structure: '2 à 3 séries de 8×(30s zone vma / 30s trot récup active), 3min trot entre séries', races: ['all'], phases: ['generale', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'vma-200', name: '10×200m', type: 'fractionne', structure: '10×(200m zone vma / 200m trot)', races: ['5k', '10k'], phases: ['generale'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'vma-400', name: '8-12×400m', type: 'fractionne', structure: '8 à 12×(400m zone vma / 1min15 trot)', races: ['all'], phases: ['generale'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'vma-pyramide-courte', name: 'Pyramide courte', type: 'fractionne', structure: '2×(200m/300m/400m/300m/200m zone vma, récup = durée effort en trot), 3min entre séries', races: ['all'], phases: ['generale'], levels: ['debutant', 'intermediaire', 'avance'], key: false },

  // ===== Prépa 3000m (piste — séances Hugo/Julien) =====
  { id: '3k-400', name: '10×400m à 95%', type: 'fractionne', structure: '10×(400m à 95% VMA / 1min trot)', races: ['3k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-30-30', name: '2 séries de 8×30/30 à 100%', type: 'fractionne', structure: '2 séries de 8×(30s à 100% VMA / 30s trot), 3min entre séries', races: ['3k'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-300-series', name: '2 séries de 8×300m à 100%', type: 'fractionne', structure: '2 séries de 8×(300m à 100% VMA / 45s trot), 3min entre séries', races: ['3k'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '3k-1000-2000-500', name: 'Bloc 1000/2000/500', type: 'fractionne', structure: '1000m à 95% VMA (récup 4min) / 2000m à 90% VMA (récup 1min15) / 500m à 100% VMA', races: ['3k'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '3k-500', name: '8×500m à 95%', type: 'fractionne', structure: '8×(500m à 95% VMA / 1min15 trot)', races: ['3k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-300', name: '10×300m à 100%', type: 'fractionne', structure: '10×(300m à 100% VMA / 1min trot)', races: ['3k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-test-1500', name: 'Test 1500m allure 3000', type: 'fractionne', structure: 'Test chronométré : 1500m à l\'allure cible du 3000m, jambes fraîches (précédé d\'un échauffement complet avec lignes droites)', races: ['3k'], phases: ['specifique', 'affutage'], levels: ['intermediaire', 'avance'], key: true },
  { id: '3k-200', name: '14×200m à 100%', type: 'fractionne', structure: '14×(200m à 100% VMA / 40s trot)', races: ['3k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-300-volume', name: '14×300m à 100%', type: 'fractionne', structure: '14×(300m à 100% VMA / 1min trot)', races: ['3k'], phases: ['specifique'], levels: ['avance'], key: false },
  { id: '3k-600', name: '7×600m à 90-95%', type: 'fractionne', structure: '7×(600m à 90-95% VMA / 1min trot)', races: ['3k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '3k-mixte', name: 'Bloc mixte 200/1200/1000/200/600', type: 'fractionne', structure: '3×(200m à 100% VMA / 30s trot) + 1200m à 95% VMA (récup 3min) + 1000m à 95% VMA (récup 3min) + 3×(200m à 100% VMA / 30s trot) + 600m à 95% VMA', races: ['3k'], phases: ['specifique'], levels: ['avance'], key: true },

  // ===== Séances clés 5K =====
  { id: '5k-800', name: '6×800m allure 5K', type: 'fractionne', structure: '6×(800m zone fiveK / 2min trot)', races: ['5k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: '5k-300-vite', name: '3 séries de 3×300m', type: 'fractionne', structure: '3 séries de 3×(300m zone fiveK légèrement au-dessus / 100m marche), 3min entre séries', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: false },
  { id: '5k-1000', name: '4-5×1000m allure 5K', type: 'fractionne', structure: '4 à 5×(1000m à l\'allure cible du 5000 (zone fiveK) / 2min trot)', races: ['5k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: '5k-ladder', name: 'Échelle descendante 1200→400', type: 'fractionne', structure: '4×(300m à 97% VMA / 55s trot) puis récup 1min15, puis 1200m à 90% (récup 2min30) / 1000m à 91% (récup 2min30) / 800m à 93% (récup 2min) / 600m à 95% (récup 1min30) / 400m à 97%', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '5k-400-95', name: '10×400m à 95%', type: 'fractionne', structure: '10×(400m à 95% VMA / 1min trot)', races: ['5k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '5k-600', name: '7×600m à 90-95%', type: 'fractionne', structure: '7×(600m à 90-95% VMA / 1min15 trot)', races: ['5k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '5k-300-100', name: '12×300m à 100%', type: 'fractionne', structure: '12×(300m à 100% VMA / 1min trot)', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: false },
  { id: '5k-300-series', name: '2 séries de 7×300m à 100%', type: 'fractionne', structure: '2 séries de 7×(300m à 100% VMA / 100m trot), 3min entre séries', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: false },
  { id: '5k-200-series', name: '2 séries de 10×200m à 100%', type: 'fractionne', structure: '2 séries de 10×(200m à 100% VMA / 40s trot), 2min entre séries', races: ['5k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '5k-mixte-1500', name: 'Bloc mixte autour du 1500', type: 'fractionne', structure: '2×(400m à 95% VMA / 45s trot) puis récup 1min, puis 1500m à l\'allure cible du 5000 (récup 2min) + 2×(500m à 95% / 1min trot) + 1000m allure 5000 (récup 1min) + 600m à 95% (récup 1min) + 400m à 95%', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '5k-mixte-2000', name: 'Bloc mixte autour du 2000', type: 'fractionne', structure: '2×(400m à 95% VMA / 45s trot) puis récup 1min, puis 2000m à l\'allure cible du 5000 (récup 3min) + 2×(500m à 95% / 1min trot) + 1200m allure 5000 (récup 1min30) + 800m allure 5000', races: ['5k'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '5k-test-3000', name: 'Test 3000m allure 5K', type: 'fractionne', structure: 'Test chronométré : 3000m à l\'allure cible du 5000, jambes fraîches (échauffement complet avec lignes droites)', races: ['5k'], phases: ['specifique', 'affutage'], levels: ['intermediaire', 'avance'], key: true },

  // ===== Séances clés 10K =====
  { id: '10k-200-vitesse', name: '12×200m à 105-110%', type: 'fractionne', structure: '12×(200m à 105-110% VMA / 50s trot)', races: ['10k'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '10k-300', name: '12×300m à 100-105%', type: 'fractionne', structure: '12×(300m à 100-105% VMA / 100m trot)', races: ['10k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '10k-400', name: '10×400m à 95-100%', type: 'fractionne', structure: '10×(400m à 95-100% VMA / 1min15 trot)', races: ['10k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '10k-200-series', name: '2 séries de 8×200m à 105%', type: 'fractionne', structure: '2 séries de 8×(200m à 105% VMA / 100m trot), 2min30 entre séries', races: ['10k'], phases: ['generale', 'specifique'], levels: ['avance'], key: false },
  { id: '10k-500', name: '8×500m à 95%', type: 'fractionne', structure: '8×(500m à 95% VMA / 1min30 trot)', races: ['10k'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: '10k-1000', name: '6×1000m allure 10K', type: 'fractionne', structure: '6×(1000m à l\'allure cible du 10K (zone tenK) / 1min30 trot)', races: ['10k', 'semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: '10k-1500', name: '4×1500m allure 10K', type: 'fractionne', structure: '4×(1500m à l\'allure cible du 10K / 1min30 trot)', races: ['10k', 'semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: '10k-2000', name: '3×2000m allure 10K', type: 'fractionne', structure: '3×(2000m à l\'allure cible du 10K / 1min30 à 2min trot)', races: ['10k', 'semi'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: '10k-test-321', name: 'Test 3000/2000/1000 allure 10K', type: 'fractionne', structure: 'Test chronométré : 3000m / 2000m / 1000m à l\'allure cible du 10K, récup 2min trot entre les blocs', races: ['10k'], phases: ['specifique', 'affutage'], levels: ['intermediaire', 'avance'], key: true },
  { id: '10k-2x3000', name: '2×3000m allure 10K', type: 'fractionne', structure: '2×(3000m à l\'allure cible du 10K / 2min trot)', races: ['10k'], phases: ['specifique'], levels: ['avance'], key: true },

  // ===== Seuil (socle toutes distances) =====
  { id: 'seuil-2x10', name: '2×10min au seuil', type: 'tempo', structure: '2×(10min zone threshold / 3min trot)', races: ['all'], phases: ['generale', 'specifique', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'seuil-3x8', name: '3×8min au seuil', type: 'tempo', structure: '3×(8min zone threshold / 2min trot)', races: ['all'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'seuil-continu', name: 'Tempo continu 20-30min', type: 'tempo', structure: '20 à 30min en continu zone threshold', races: ['10k', 'semi', 'marathon'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'seuil-cruise', name: 'Cruise intervals 5×6min', type: 'tempo', structure: '5×(6min zone threshold / 1min trot)', races: ['semi', 'marathon'], phases: ['generale', 'specifique'], levels: ['avance'], key: false },

  // ===== Prépa semi-marathon (séances Hugo/Julien) =====
  { id: 'semi-200', name: '12×200m à 100%', type: 'fractionne', structure: '12×(200m à 100% VMA / 40s trot)', races: ['semi'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'semi-300', name: '10×300m à 95-100%', type: 'fractionne', structure: '10×(300m à 95-100% VMA / 100m trot)', races: ['semi'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'semi-400', name: '10×400m à 90-95%', type: 'fractionne', structure: '10×(400m à 90-95% VMA / 1min trot)', races: ['semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: false },
  { id: 'semi-30-30', name: '15×30/30 à 100%', type: 'fractionne', structure: '15×(30s à 100% VMA / 30s trot)', races: ['semi'], phases: ['generale'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'semi-300-volume', name: '14×300m à 95%', type: 'fractionne', structure: '14×(300m à 95% VMA / 100m trot)', races: ['semi'], phases: ['specifique'], levels: ['avance'], key: false },
  { id: 'semi-test-10k', name: 'Test 10km allure semi', type: 'tempo', structure: 'Test chronométré : 10km en continu à l\'allure cible du semi-marathon, jambes fraîches', races: ['semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'semi-1000', name: '8×1000m allure semi', type: 'fractionne', structure: '8×(1000m à l\'allure cible du semi (zone semi) / 1min30 trot)', races: ['semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'semi-3000', name: '3×3000m allure semi', type: 'tempo', structure: '3×(3000m à l\'allure cible du semi / 2min trot)', races: ['semi'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: 'semi-3-2-2-3', name: 'Bloc 3000/2×2000/3000 allure semi', type: 'tempo', structure: '3000m / 2000m / 2000m / 3000m à l\'allure cible du semi, récup 2min trot entre les blocs', races: ['semi'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: 'semi-4000', name: '3×4000m allure semi', type: 'tempo', structure: '3×(4000m à l\'allure cible du semi / 2min30 trot)', races: ['semi'], phases: ['specifique'], levels: ['avance'], key: true },

  // ===== Séances clés semi-marathon =====
  { id: 'semi-2x20', name: '2×20min allure semi', type: 'tempo', structure: '2×(20min zone semi / 3min trot)', races: ['semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'semi-sl-blocs', name: 'Sortie longue avec blocs semi', type: 'sortie_longue', structure: '1h15 à 1h30 dont 2×15min zone semi en fin de sortie, le reste en endurance', races: ['semi'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'semi-progressif', name: '12K progressif vers allure semi', type: 'tempo', structure: '12km : 4km endurance / 4km zone marathon / 4km zone semi', races: ['semi'], phases: ['specifique'], levels: ['avance'], key: false },

  // ===== Séances clés marathon =====
  { id: 'marathon-sl-blocs', name: 'Sortie longue avec blocs marathon', type: 'sortie_longue', structure: '2h à 2h30 dont 2 à 3×20min zone marathon, le reste en endurance', races: ['marathon'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'marathon-continu', name: 'Bloc allure marathon continu', type: 'tempo', structure: '12 à 16km en continu zone marathon (séance clé à placer 4-6 semaines avant la course)', races: ['marathon'], phases: ['specifique'], levels: ['avance'], key: true },
  { id: 'marathon-sl-negative', name: 'Sortie longue negative split', type: 'sortie_longue', structure: '1h45 à 2h15 : première moitié endurance, seconde moitié zone marathon', races: ['marathon'], phases: ['specifique'], levels: ['intermediaire', 'avance'], key: true },
  { id: 'marathon-medium-long', name: 'Medium-long avec finish marathon', type: 'sortie_longue', structure: '1h15 à 1h30 endurance avec les 20 dernières minutes zone marathon', races: ['marathon'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },

  // ===== Côtes =====
  { id: 'cotes-courtes', name: 'Côtes courtes', type: 'cotes', structure: '8 à 12×(30s en côte intensité vma / retour en marchant)', races: ['all'], phases: ['generale'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'cotes-longues', name: 'Côtes longues', type: 'cotes', structure: '6 à 8×(1min15 en côte zone fiveK / retour en trottinant)', races: ['10k', 'semi', 'marathon'], phases: ['generale'], levels: ['intermediaire', 'avance'], key: false },

  // ===== Fartlek =====
  { id: 'fartlek-pyramide', name: 'Fartlek pyramide', type: 'fartlek', structure: '1-2-3-4-3-2-1min zone tenK à fiveK, récup = moitié de l\'effort en trot', races: ['all'], phases: ['generale', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'fartlek-nature', name: 'Fartlek 10×1min', type: 'fartlek', structure: '10×(1min zone fiveK / 1min trot), au ressenti sur terrain varié', races: ['all'], phases: ['generale', 'entretien'], levels: ['debutant', 'intermediaire'], key: false },

  // ===== Endurance / récup =====
  { id: 'ef-classique', name: 'Endurance fondamentale', type: 'endurance', structure: '40min à 1h zone endurance en continu', races: ['all'], phases: ['generale', 'specifique', 'affutage', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'ef-lignes-droites', name: 'Endurance + lignes droites', type: 'endurance', structure: '45min zone endurance puis 6×(20s accélération progressive zone vma / 40s marche)', races: ['all'], phases: ['generale', 'specifique', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'recup-footing', name: 'Footing de récupération', type: 'recuperation', structure: '25 à 35min zone recoveryActive, très relâché', races: ['all'], phases: ['generale', 'specifique', 'affutage', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },

  // ===== Sortie longue générique =====
  { id: 'sl-simple', name: 'Sortie longue endurance', type: 'sortie_longue', structure: '1h à 1h45 zone endurance (25-35% du volume hebdo)', races: ['all'], phases: ['generale', 'entretien'], levels: ['debutant', 'intermediaire', 'avance'], key: false },
  { id: 'sl-progressive', name: 'Sortie longue progressive', type: 'sortie_longue', structure: '1h à 1h30 en 3 tiers : endurance / zone marathon léger / zone semi sur le dernier tiers', races: ['10k', 'semi', 'marathon'], phases: ['generale', 'specifique'], levels: ['intermediaire', 'avance'], key: false },

  // ===== Affûtage (dernières semaines avant course) =====
  { id: 'affutage-rappel', name: 'Rappel allure course', type: 'fractionne', structure: '3×(1000m à l\'allure cible de la course / 2min trot) — volume réduit, jambes fraîches', races: ['5k', '10k', 'semi', 'marathon'], phases: ['affutage'], levels: ['debutant', 'intermediaire', 'avance'], key: true },
  { id: 'affutage-30-30-leger', name: '30/30 léger', type: 'fractionne', structure: '1 série de 8×(30s zone vma / 30s trot) — entretien de la vivacité sans fatigue', races: ['all'], phases: ['affutage'], levels: ['debutant', 'intermediaire', 'avance'], key: false }
];

// Rendu compact de la bibliothèque pour le prompt système
const renderLibraryForPrompt = () => {
  const lines = ['Bibliothèque de séances Trainwise (pioche dedans et adapte les volumes au profil — n\'invente pas d\'autres structures) :'];
  for (const w of WORKOUT_LIBRARY) {
    const key = w.key ? ' [SÉANCE CLÉ]' : '';
    lines.push(`- [${w.id}]${key} ${w.name} (${w.type}) — ${w.structure} | objectifs: ${w.races.join(',')} | phases: ${w.phases.join(',')} | niveaux: ${w.levels.join(',')}`);
  }
  return lines.join('\n');
};

module.exports = { WORKOUT_LIBRARY, renderLibraryForPrompt };
