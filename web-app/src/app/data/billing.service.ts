import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';

export type BillingCycle = 'monthly' | 'yearly';

/** Un plan tel que le serveur le décrit : ni prix, ni limite ne sont écrits ici. */
export type Plan = {
  id: string;
  name: string;
  pitch: string;
  /** Prix mensuel en euros, facturation mensuelle. */
  monthly: number;
  /** Prix mensuel en euros quand la facturation est annuelle. */
  yearlyMonthly: number;
  /** Athlètes inclus ; null pour « sans limite ». */
  athletes: number | null;
  /** Groupes inclus ; 0 pour « pas de groupes », null pour « sans limite ». */
  groups: number | null;
  customAlerts: boolean;
  features: string[];
};

export type Invoice = {
  id: string;
  date: string | null;
  label: string;
  amount: number | null;
  status: 'paid' | 'pending';
  url: string | null;
};

export type Billing = {
  /** Faux tant que les clés Stripe ne sont pas en place : l'écran le dit alors. */
  configured: boolean;
  plans: Plan[];
  subscription: {
    planId: string;
    cycle: BillingCycle;
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
    renewsOn: string | null;
    cancelAtPeriodEnd: boolean;
    /** Faux pour un plan offert : il n'y a pas d'abonnement Stripe à gérer. */
    managed: boolean;
  };
  usage: { athletes: number; athleteLimit: number | null; groups: number; groupLimit: number | null };
  card: { brand: string; last4: string; expires: string } | null;
  invoices: Invoice[];
};

export type AlertRules = {
  inactivityOrange: number;
  inactivityRed: number;
  skippedOrange: number;
  skippedRed: number;
  feelingOrange: number;
  feelingRed: number;
  volumeDropEnabled: boolean;
  volumeDropPercent: number;
};

export type AlertRulesState = { rules: AlertRules; editable: boolean; planName: string };

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiService);

  billing$() {
    return this.api.get<Billing>('/api/coach/billing');
  }

  /** Renvoie l'adresse de la page de paiement Stripe : c'est là qu'on envoie le coach. */
  checkout(planId: string, cycle: BillingCycle) {
    return this.api.post<{ url: string }>('/api/coach/billing/checkout', { planId, cycle });
  }

  /** Portail client Stripe : carte, factures, résiliation. */
  portal() {
    return this.api.post<{ url: string }>('/api/coach/billing/portal');
  }

  alertRules$() {
    return this.api.get<AlertRulesState>('/api/coach/alert-rules');
  }

  saveAlertRules(rules: AlertRules) {
    return this.api.put<AlertRulesState>('/api/coach/alert-rules', rules);
  }
}

export const priceOf = (plan: Plan, cycle: BillingCycle) => (cycle === 'yearly' ? plan.yearlyMonthly : plan.monthly);

/** Économie annuelle, en euros, par rapport à douze mois au tarif mensuel. */
export const savingOf = (plan: Plan) => (plan.monthly - plan.yearlyMonthly) * 12;
