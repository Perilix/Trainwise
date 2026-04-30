export type PackageType = 'invited' | 'bronze' | 'silver' | 'gold';

export interface CoachPackage {
  type: PackageType;
  name: string;
  price: number;
  color: string;
  gradient: string;
  icon: string;
  features: string[];
  badge?: string;
  revenueCatId: string;
}

export const COACH_PACKAGES: Record<PackageType, CoachPackage> = {
  invited: {
    type: 'invited',
    name: 'Invité',
    price: 0,
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    icon: 'fa-solid fa-user-check',
    revenueCatId: '',
    features: [
      'Athlète ayant rejoint via un code d\'invitation',
      'Aucun abonnement payant associé'
    ]
  },
  bronze: {
    type: 'bronze',
    name: 'Bronze',
    price: 49.99,
    color: '#cd7f32',
    gradient: 'linear-gradient(135deg, #cd7f32 0%, #b8722d 100%)',
    icon: 'fa-solid fa-medal',
    revenueCatId: 'trainwise_coach_bronze_monthly',
    features: [
      'Programme d\'entraînement mensuel',
      'Suivi des performances',
      'Chat disponible (réponse sous 48h)',
      '1 ajustement de programme par mois'
    ]
  },
  silver: {
    type: 'silver',
    name: 'Silver',
    price: 79.99,
    color: '#c0c0c0',
    gradient: 'linear-gradient(135deg, #d4d4d4 0%, #a8a8a8 100%)',
    icon: 'fa-solid fa-crown',
    revenueCatId: 'trainwise_coach_silver_monthly',
    features: [
      'Programme hebdomadaire personnalisé',
      'Suivi et ajustements en temps réel',
      'Chat prioritaire (réponse sous 24h)',
      'Ajustements illimités',
      'Conseils nutrition de base',
      '1 appel vidéo par mois (30min)'
    ],
    badge: 'Le plus populaire'
  },
  gold: {
    type: 'gold',
    name: 'Gold',
    price: 149.99,
    color: '#ffd700',
    gradient: 'linear-gradient(135deg, #ffd700 0%, #ffb700 100%)',
    icon: 'fa-solid fa-trophy',
    revenueCatId: 'trainwise_coach_gold_monthly',
    features: [
      'Programme sur mesure quotidien',
      'Suivi quotidien personnalisé',
      'Chat illimité (réponse rapide)',
      'Ajustements illimités',
      'Plan nutrition complet personnalisé',
      'Conseils récupération & prévention',
      '2 appels vidéo par mois (45min)',
      'Accès prioritaire 7j/7'
    ],
    badge: 'Premium'
  }
};
