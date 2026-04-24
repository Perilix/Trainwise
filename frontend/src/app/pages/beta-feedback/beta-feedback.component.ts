import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  BetaFeedbackService,
  FeedbackType,
  FeedbackScreen,
  FeedbackSeverity,
  BetaStats,
  CommunityItem
} from '../../services/beta-feedback.service';

type Step = 1 | 2 | 3 | 4;

interface ScreenOpt {
  id: FeedbackScreen;
  label: string;
  color: string;
}

interface TypeOpt {
  id: FeedbackType;
  emoji: string;
  title: string;
  desc: string;
  cls: string;
}

interface SevOpt {
  id: FeedbackSeverity;
  emoji: string;
  title: string;
  desc: string;
}

interface CommunityBug {
  id: string;
  title: string;
  status: 'open' | 'prog' | 'planned' | 'fixed';
  screenLabel: string;
  votes: number;
  voted: boolean;
}

@Component({
  selector: 'app-beta-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './beta-feedback.component.html',
  styleUrl: './beta-feedback.component.scss'
})
export class BetaFeedbackComponent implements OnInit {
  private authService = inject(AuthService);
  private feedbackService = inject(BetaFeedbackService);
  private router = inject(Router);

  readonly SCREENS: ScreenOpt[] = [
    { id: 'home',     label: 'Accueil',     color: '#1aaef5' },
    { id: 'chat',     label: 'Messages',    color: '#7b5bd6' },
    { id: 'planning', label: 'Planning',    color: '#1aaef5' },
    { id: 'sorties',  label: 'Mes sorties', color: '#1fb77a' },
    { id: 'profil',   label: 'Mon Profil',  color: '#1aaef5' },
    { id: 'boutique', label: 'Boutique',    color: '#ff7a1a' },
    { id: 'auth',     label: 'Connexion',   color: '#1aaef5' },
    { id: 'other',    label: 'Je sais pas', color: '#5a6878' },
  ];

  readonly TYPES: TypeOpt[] = [
    { id: 'bug',  emoji: '🐛', title: 'Bug / Plantage',   desc: "Un truc ne marche pas, plante ou s'affiche mal.", cls: 'bug' },
    { id: 'ui',   emoji: '🎨', title: 'Problème UX / UI', desc: "L'interface te perd, un truc n'est pas clair.",  cls: 'ui' },
    { id: 'perf', emoji: '⚡', title: 'Performance',       desc: "L'app est lente, lag, batterie qui chauffe.",     cls: 'perf' },
    { id: 'idea', emoji: '💡', title: 'Idée / Suggestion', desc: "Une fonctionnalité qui te manquerait.",           cls: 'idea' },
  ];

  readonly SEVERITIES: SevOpt[] = [
    { id: 'low',  emoji: '🟢', title: 'Mineur',    desc: 'Gênant mais je peux contourner' },
    { id: 'med',  emoji: '🟡', title: 'Modéré',    desc: 'Ça complique mon usage' },
    { id: 'high', emoji: '🟠', title: 'Important', desc: "Ça m'empêche d'avancer" },
    { id: 'crit', emoji: '🔴', title: 'Bloquant',  desc: "L'app est inutilisable" },
  ];

  readonly TYPE_LABELS: Record<FeedbackType, string> = {
    bug: '🐛 Bug / Plantage',
    ui: '🎨 Problème UX / UI',
    perf: '⚡ Performance',
    idea: '💡 Idée / Suggestion'
  };

  readonly SEV_LABELS: Record<FeedbackSeverity, string> = {
    low: '🟢 Mineur',
    med: '🟡 Modéré',
    high: '🟠 Important',
    crit: '🔴 Bloquant'
  };

  // State
  step = signal<Step>(1);
  selectedType = signal<FeedbackType | null>(null);
  selectedScreen = signal<FeedbackScreen | null>(null);
  description = signal('');
  selectedSev = signal<FeedbackSeverity | null>(null);
  attachedFile = signal<File | null>(null);
  contactMe = signal(true);

  isSubmitting = signal(false);
  showSuccess = signal(false);
  ticketId = signal('#TW-0248');
  errorMessage = signal<string | null>(null);
  userMenuOpen = signal(false);

  stats = signal<BetaStats>({
    testers: 0,
    feedbacks: 0,
    fixed: 0,
    avgResponseHours: 72
  });

  communityBugs = signal<CommunityBug[]>([]);

  appVersion = 'Trainwise v1.0.0';
  nowString = signal(this.formatNow());

  userAgentShort = computed(() => this.detectDeviceLabel());
  localeShort = computed(() => {
    const lang = (navigator.language || 'fr-FR').toUpperCase().split('-')[0];
    let tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.split('/').pop()?.replace(/_/g, ' ') || '';
    } catch (_) {}
    return tz ? `${lang} · ${tz}` : lang;
  });

  private detectDeviceLabel(): string {
    const ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) {
      const m = ua.match(/OS (\d+)_(\d+)/);
      const v = m ? ` · iOS ${m[1]}.${m[2]}` : '';
      return `iPhone${v}`;
    }
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) {
      const m = ua.match(/Android (\d+(?:\.\d+)?)/);
      return m ? `Android ${m[1]}` : 'Android';
    }
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Navigateur';
  }

  // User
  currentUser = computed(() => this.authService.currentUser());
  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return 'JD';
    const first = u.firstName?.[0] ?? '';
    const last = u.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'JD';
  });
  userFirstName = computed(() => this.currentUser()?.firstName || 'Julien');
  userEmail = computed(() => this.currentUser()?.email || 'bêta@trainwise.app');

  // Step progression helpers
  stepStates = computed(() => {
    const s = this.step();
    return ([1, 2, 3, 4] as Step[]).map(n => ({
      n,
      active: n === s,
      done: n < s
    }));
  });
  lineDone = (i: number) => i + 1 < this.step();

  canAdvance = computed(() => {
    switch (this.step()) {
      case 1: return !!this.selectedType();
      case 2: return !!this.selectedScreen();
      case 3: return this.description().trim().length >= 10 && !!this.selectedSev();
      case 4: return true;
      default: return false;
    }
  });

  nextLabel = computed(() => this.step() === 4 ? 'Envoyer le retour' : 'Continuer');

  // Recap
  recapType = computed(() => {
    const t = this.selectedType();
    return t ? this.TYPE_LABELS[t] : '—';
  });
  recapScreen = computed(() => {
    const s = this.selectedScreen();
    return s ? (this.SCREENS.find(x => x.id === s)?.label ?? '—') : '—';
  });
  recapSev = computed(() => {
    const s = this.selectedSev();
    return s ? this.SEV_LABELS[s] : '—';
  });
  recapDesc = computed(() => {
    const d = this.description();
    return d.length > 200 ? d.slice(0, 200) + '…' : (d || '—');
  });

  charCount = computed(() => this.description().length);

  // Sidebar — progression bêta
  userRetourCount = signal(0);
  userRetourGoal = signal(5);
  retourProgressPct = computed(() => {
    const goal = this.userRetourGoal();
    if (goal <= 0) return 0;
    return Math.min(100, Math.round((this.userRetourCount() / goal) * 100));
  });
  userRetoursLeft = computed(() => Math.max(0, this.userRetourGoal() - this.userRetourCount()));

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    this.feedbackService.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {}
    });

    this.feedbackService.getCommunity().subscribe({
      next: (res) => this.communityBugs.set(res.items.map(i => this.toCommunityBug(i))),
      error: () => this.communityBugs.set([])
    });

    this.feedbackService.getMyCount().subscribe({
      next: (r) => {
        this.userRetourCount.set(r.countMonth);
        this.userRetourGoal.set(r.goal);
      },
      error: () => {}
    });
  }

  private toCommunityBug(i: CommunityItem): CommunityBug {
    const screenLabel = this.SCREENS.find(s => s.id === i.screen)?.label ?? i.screen;
    const status: CommunityBug['status'] =
      i.status === 'fixed' ? 'fixed' :
      i.status === 'planned' ? 'planned' :
      i.status === 'prog' ? 'prog' : 'open';
    return {
      id: i.id,
      title: i.title,
      status,
      screenLabel: `// ${screenLabel}`,
      votes: i.votes,
      voted: false
    };
  }

  selectType(t: FeedbackType) {
    this.selectedType.set(t);
  }
  selectScreen(s: FeedbackScreen) {
    this.selectedScreen.set(s);
  }
  selectSeverity(s: FeedbackSeverity) {
    this.selectedSev.set(s);
  }
  onDescChange(v: string) {
    this.description.set(v.slice(0, 1000));
  }

  goToStep(n: Step) {
    this.step.set(n);
    this.errorMessage.set(null);
    if (n === 4) {
      this.nowString.set(this.formatNow());
    }
    const el = document.getElementById('formCard');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  next() {
    if (!this.canAdvance() || this.isSubmitting()) return;
    const s = this.step();
    if (s < 4) {
      this.goToStep((s + 1) as Step);
    } else {
      this.submit();
    }
  }

  back() {
    const s = this.step();
    if (s > 1) this.goToStep((s - 1) as Step);
  }

  onFileClick(input: HTMLInputElement) {
    input.click();
  }
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.attachedFile.set(file);
  }
  onFileRemove(ev: Event) {
    ev.preventDefault();
    this.attachedFile.set(null);
  }
  attachedFileSizeKb = computed(() => {
    const f = this.attachedFile();
    return f ? Math.round(f.size / 1024) : 0;
  });

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
  }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.attachedFile.set(file);
  }

  submit() {
    if (this.isSubmitting()) return;
    const type = this.selectedType();
    const screen = this.selectedScreen();
    const sev = this.selectedSev();
    const desc = this.description().trim();
    if (!type || !screen || !sev || desc.length < 10) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.feedbackService.submit({
      type,
      screen,
      description: desc,
      severity: sev,
      contactMe: this.contactMe(),
      appVersion: this.appVersion,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.ticketId.set(res.ticketId);
        this.showSuccess.set(true);
        this.loadAll();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.error || "Impossible d'envoyer ton retour. Réessaye dans un instant.");
      }
    });
  }

  closeSuccess() {
    this.showSuccess.set(false);
  }
  resetForm() {
    this.step.set(1);
    this.selectedType.set(null);
    this.selectedScreen.set(null);
    this.description.set('');
    this.selectedSev.set(null);
    this.attachedFile.set(null);
    this.contactMe.set(true);
    this.errorMessage.set(null);
    this.showSuccess.set(false);
  }

  toggleVote(b: CommunityBug) {
    const updated = this.communityBugs().map(x => {
      if (x.id !== b.id) return x;
      const voted = !x.voted;
      return { ...x, voted, votes: x.votes + (voted ? 1 : -1) };
    });
    this.communityBugs.set(updated);
    this.feedbackService.toggleVote(b.id).subscribe({ error: () => {} });
  }

  private formatNow(): string {
    const d = new Date();
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
  }

  goHome() {
    this.router.navigate(['/']);
  }

  toggleUserMenu() {
    this.userMenuOpen.update(v => !v);
  }

  logout() {
    this.userMenuOpen.set(false);
    this.authService.logout();
  }
}
