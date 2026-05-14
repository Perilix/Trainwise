import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { RunService, Run } from '../../services/run.service';
import { PlanningService, PlannedSession, RUNNING_SESSION_LABELS } from '../../services/planning.service';
import { StrengthService } from '../../services/strength.service';
import { StrengthSession, SESSION_TYPE_LABELS } from '../../interfaces/strength.interfaces';
import { PlannedMatchSummary } from '../../interfaces/planned-match.interface';
import { AuthService } from '../../services/auth.service';
import { ChatService, Conversation } from '../../services/chat.service';
import { AthleteService } from '../../services/athlete.service';
import { StravaService, StravaStatus } from '../../services/strava.service';
import { SubscriptionService } from '../../services/subscription.service';
import { CoachInvitationModalService } from '../../services/coach-invitation-modal.service';
import { Coach } from '../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { TourTooltipComponent } from '../../components/tour-tooltip/tour-tooltip.component';

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  runs: Run[];
  plannedRuns: PlannedSession[];
}

interface StravaFeelingItem {
  kind: 'run' | 'strength';
  id: string;
  date: Date;
  distance?: number;
  duration?: number;
  sessionType?: string;
  feeling: number;
  pendingMatch: PlannedMatchSummary | null;
  matchDecision: 'pending' | 'confirmed' | 'dismissed' | 'linked';
  showPicker: boolean;
  candidates: PlannedMatchSummary[];
  loadingMatch: boolean;
}

interface RecentSession {
  type: 'run' | 'strength';
  source: 'run' | 'strength' | 'planned';
  _id?: string;
  date: Date;
  title: string;
  isStrava: boolean;
  distance?: number;
  duration?: number;
  averagePace?: string;
  totalSets?: number;
  totalVolume?: number;
  raw: Run | StrengthSession | PlannedSession;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, TourTooltipComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  // Data
  recentSessions = signal<RecentSession[]>([]);
  upcomingRuns = signal<PlannedSession[]>([]);
  weekDays = signal<WeekDay[]>([]);
  upcomingSession = signal<PlannedSession | null>(null);
  recentConversations = signal<Conversation[]>([]);

  // Coach
  currentCoach = signal<Coach | null>(null);
  coachPlannedSessions = signal<PlannedSession[]>([]);
  pendingCoachInvitations = signal<any[]>([]);

  // Coach partenaire (chargé dynamiquement)
  partnerCoach = signal<{ _id: string; firstName: string; lastName: string; profilePicture?: string } | null>(null);

  // Rejoindre un coach via code
  inviteCode = '';
  joiningByCode = signal(false);
  joinMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Loading states
  isLoading = signal(true);

  // Strava
  stravaStatus = signal<StravaStatus | null>(null);
  stravaLoading = signal(false);
  stravaSyncing = signal(false);
  stravaMessage = signal<string | null>(null);
  stravaFeelingModal = signal<{ open: boolean; items: StravaFeelingItem[] }>({ open: false, items: [] });

  // Computed
  streak = signal(0);
  weekStats = signal({ runs: 0, distance: 0, duration: 0 });

  constructor(
    private runService: RunService,
    private planningService: PlanningService,
    private strengthService: StrengthService,
    public authService: AuthService,
    public chatService: ChatService,
    private athleteService: AthleteService,
    private stravaService: StravaService,
    private subscriptionService: SubscriptionService,
    public invitationModalService: CoachInvitationModalService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
    this.loadRecentSessions();
    this.loadRecentConversations();
    this.loadCurrentCoach();
    this.loadPendingInvitations();
    this.loadPartnerCoach();
    this.loadStravaStatus();
    this.handleStravaCallback();

    // Écouter les événements d'acceptation/rejet d'invitations
    this.invitationModalService.invitationAccepted$.subscribe(() => {
      this.loadPendingInvitations();
      this.loadCurrentCoach();
    });

    this.invitationModalService.invitationRejected$.subscribe(() => {
      this.loadPendingInvitations();
    });
  }

  loadDashboardData() {
    this.isLoading.set(true);

    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    // Check if current week's Monday is in the previous month
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const mondayMonth = monday.getMonth() + 1;
    const mondayYear = monday.getFullYear();
    const weekSpansTwoMonths = mondayMonth !== month || mondayYear !== year;

    const currentMonthObs = this.planningService.getCalendarData(month, year);

    if (weekSpansTwoMonths) {
      // Also fetch previous month to cover the full week
      const prevMonthObs = this.planningService.getCalendarData(mondayMonth, mondayYear);
      let currentData: any = null;
      let prevData: any = null;

      const tryMerge = () => {
        if (!currentData || !prevData) return;
        const allRuns = [...prevData.runs, ...currentData.runs];
        const allPlanned = [...prevData.plannedRuns, ...currentData.plannedRuns];
        this.buildWeekView(allRuns, allPlanned);
        this.calculateStreak(allRuns);
        this.calculateWeekStats(allRuns);
        this.findUpcomingSession(allPlanned);
        this.isLoading.set(false);
      };

      currentMonthObs.subscribe({
        next: (data) => { currentData = data; tryMerge(); },
        error: (err) => { console.error(err); this.isLoading.set(false); }
      });
      prevMonthObs.subscribe({
        next: (data) => { prevData = data; tryMerge(); },
        error: () => { prevData = { runs: [], plannedRuns: [], strengthSessions: [] }; tryMerge(); }
      });
    } else {
      currentMonthObs.subscribe({
        next: (data) => {
          this.buildWeekView(data.runs, data.plannedRuns);
          this.calculateStreak(data.runs);
          this.calculateWeekStats(data.runs);
          this.findUpcomingSession(data.plannedRuns);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.isLoading.set(false);
        }
      });
    }
  }

  buildWeekView(runs: Run[], plannedRuns: PlannedSession[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get Monday of current week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);

      const dateStr = this.formatDateStr(date);

      const dayRuns = runs.filter(r => {
        const d = new Date(r.date);
        return this.formatDateStr(d) === dateStr;
      });

      const dayPlanned = plannedRuns.filter(p => {
        const d = new Date(p.date);
        return this.formatDateStr(d) === dateStr;
      });

      days.push({
        date,
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        isToday: this.formatDateStr(date) === this.formatDateStr(today),
        isPast: date < today,
        runs: dayRuns,
        plannedRuns: dayPlanned
      });
    }

    this.weekDays.set(days);
  }

  formatDateStr(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  calculateStreak(runs: Run[]) {
    if (runs.length === 0) {
      this.streak.set(0);
      return;
    }

    const getWeekKey = (date: Date): string => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay()); // Sunday as week start
      return this.formatDateStr(d);
    };

    const weeksWithRuns = new Set(runs.map(r => getWeekKey(new Date(r.date))));

    const today = new Date();
    const currentWeekKey = getWeekKey(today);
    const lastWeekDate = new Date(today);
    lastWeekDate.setDate(today.getDate() - 7);
    const lastWeekKey = getWeekKey(lastWeekDate);

    // Start from current week if it has a run, otherwise last week (current week ongoing)
    let startWeek: Date;
    if (weeksWithRuns.has(currentWeekKey)) {
      startWeek = new Date(today);
      startWeek.setDate(today.getDate() - today.getDay());
      startWeek.setHours(0, 0, 0, 0);
    } else if (weeksWithRuns.has(lastWeekKey)) {
      startWeek = new Date(lastWeekDate);
      startWeek.setDate(lastWeekDate.getDate() - lastWeekDate.getDay());
      startWeek.setHours(0, 0, 0, 0);
    } else {
      this.streak.set(0);
      return;
    }

    let currentStreak = 0;
    const checkWeek = new Date(startWeek);

    for (let i = 0; i < 260; i++) { // up to 5 years
      if (weeksWithRuns.has(this.formatDateStr(checkWeek))) {
        currentStreak++;
        checkWeek.setDate(checkWeek.getDate() - 7);
      } else {
        break;
      }
    }

    this.streak.set(Math.min(currentStreak, 99));
  }

  calculateWeekStats(runs: Run[]) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekRuns = runs.filter(r => {
      const runDate = new Date(r.date);
      return runDate >= monday && runDate <= sunday;
    });

    const totalDistance = weekRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const totalDuration = weekRuns.reduce((sum, r) => sum + (r.duration || 0), 0);

    this.weekStats.set({
      runs: weekRuns.length,
      distance: Math.round(totalDistance * 10) / 10,
      duration: Math.round(totalDuration)
    });
  }

  loadRecentSessions() {
    let runs: Run[] | null = null;
    let strengths: StrengthSession[] | null = null;
    let completedPlanned: PlannedSession[] | null = null;

    const tryMerge = () => {
      if (runs === null || strengths === null || completedPlanned === null) return;
      this.buildRecentSessions(runs, strengths, completedPlanned);
    };

    this.runService.getAllRuns().subscribe({
      next: (data) => { runs = data; tryMerge(); },
      error: () => { runs = []; tryMerge(); }
    });

    this.strengthService.getSessions({ limit: 20 }).subscribe({
      next: (data) => { strengths = data.sessions; tryMerge(); },
      error: () => { strengths = []; tryMerge(); }
    });

    this.planningService.getPlannedSessions({ status: 'completed' }).subscribe({
      next: (data) => { completedPlanned = data; tryMerge(); },
      error: () => { completedPlanned = []; tryMerge(); }
    });
  }

  buildRecentSessions(runs: Run[], strengthSessions: StrengthSession[], completedPlanned: PlannedSession[]) {
    // Filtrer les planned sessions complétées qui ne sont PAS déjà liées à un Run ou à une StrengthSession
    const standalonePlanned = completedPlanned.filter(p => !p.linkedRun && !p.linkedStrengthSession);

    const items: RecentSession[] = [
      ...runs.map((r): RecentSession => ({
        type: 'run',
        source: 'run',
        _id: r._id,
        date: new Date(r.date),
        title: this.getRunTitle(r.notes),
        isStrava: !!r.stravaActivityId,
        distance: r.distance,
        duration: r.duration,
        averagePace: r.averagePace,
        raw: r
      })),
      ...strengthSessions.map((s): RecentSession => ({
        type: 'strength',
        source: 'strength',
        _id: s._id,
        date: new Date(s.date),
        title: this.getStrengthTitle(s),
        isStrava: !!s.stravaActivityId,
        duration: s.duration,
        totalSets: s.totalSets,
        totalVolume: s.totalVolume,
        raw: s
      })),
      ...standalonePlanned.map((p): RecentSession => ({
        type: p.activityType === 'strength' ? 'strength' : 'run',
        source: 'planned',
        _id: p._id,
        date: new Date(p.date),
        title: this.getPlannedTitle(p),
        isStrava: false,
        distance: p.targetDistance,
        duration: p.targetDuration,
        averagePace: p.targetPace,
        raw: p
      }))
    ];
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    this.recentSessions.set(items.slice(0, 5));
  }

  getPlannedTitle(p: PlannedSession): string {
    if (p.description) return p.description.split('\n')[0];
    if (p.activityType === 'strength') return SESSION_TYPE_LABELS[p.sessionType as keyof typeof SESSION_TYPE_LABELS] || 'Musculation';
    return this.planningService.getSessionTypeLabel(p.sessionType as any) || 'Course';
  }

  findUpcomingSession(plannedRuns: PlannedSession[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = plannedRuns
      .filter(p => {
        const pDate = new Date(p.date);
        pDate.setHours(0, 0, 0, 0);
        return pDate >= today && p.status === 'planned';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.upcomingSession.set(upcoming[0] || null);
    this.upcomingRuns.set(upcoming.slice(0, 3));

    // Mettre à jour les séances coach si le coach est déjà chargé
    if (this.currentCoach()) {
      this.loadCoachSessions();
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  getMotivationalMessage(): string {
    const messages = [
      "Prêt à repousser tes limites ?",
      "Chaque kilomètre compte !",
      "La constance fait la différence.",
      "Un pas après l'autre.",
      "Ta meilleure version t'attend."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  getSessionTypeLabel(type: string): string {
    return this.planningService.getSessionTypeLabel(type as any);
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins : ''}`;
    }
    return `${mins}min`;
  }

  formatRunDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }

  getDayStatus(day: WeekDay): string {
    if (day.runs.length > 0) return 'completed';
    const activePlanned = day.plannedRuns.filter(p => p.status === 'planned');
    if (activePlanned.length > 0) {
      return activePlanned.some(p => p.generatedBy === 'coach') ? 'planned-coach' : 'planned-ia';
    }
    if (day.plannedRuns.some(p => p.status === 'completed')) return 'done';
    if (day.plannedRuns.some(p => p.status === 'skipped')) return 'skipped';
    return 'empty';
  }

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  getRunTitle(notes: string | undefined): string {
    if (!notes) return 'Course';
    return notes.split('\n')[0] || 'Course';
  }

  openSession(session: RecentSession) {
    if (session.source === 'planned') {
      if (session.type === 'strength') {
        this.router.navigate(['/strength/log'], { queryParams: { plannedId: session._id } });
      } else if (session._id) {
        this.router.navigate(['/run', session._id], { queryParams: { planned: 1 } });
      } else {
        this.router.navigate(['/planning']);
      }
    } else if (session.source === 'strength' && session._id) {
      this.router.navigate(['/strength/log'], { queryParams: { sessionId: session._id } });
    } else if (session.source === 'run') {
      this.openRunDetail(session.raw as Run);
    } else {
      this.router.navigate(['/sorties']);
    }
  }

  getStrengthTitle(session: StrengthSession): string {
    if (session.notes) {
      const firstLine = session.notes.split('\n')[0];
      if (firstLine) return firstLine;
    }
    return SESSION_TYPE_LABELS[session.sessionType] || 'Musculation';
  }

  getTips(): { icon: string; title: string; text: string }[] {
    const user = this.authService.currentUser();
    const tips: { icon: string; title: string; text: string }[] = [];

    // Tip basé sur la streak
    if (this.streak() >= 7) {
      tips.push({
        icon: '🔥',
        title: 'Série en cours !',
        text: `${this.streak()} jours d'affilée, continue comme ça !`
      });
    }

    // Tip basé sur le niveau
    if (user?.runningLevel === 'debutant') {
      tips.push({
        icon: '💡',
        title: 'Conseil du jour',
        text: 'Privilégie la régularité à l\'intensité. 3 sorties de 30min valent mieux qu\'une de 2h.'
      });
    }

    // Tip basé sur l'objectif
    if (user?.goal === 'marathon') {
      tips.push({
        icon: '🎯',
        title: 'Objectif Marathon',
        text: 'N\'oublie pas ta sortie longue hebdomadaire, clé de l\'endurance.'
      });
    }

    // Tips génériques si rien de spécifique
    if (tips.length === 0) {
      tips.push({
        icon: '⚡',
        title: 'Le saviez-vous ?',
        text: 'Une bonne hydratation améliore tes performances de 10 à 15%.'
      });
    }

    return tips.slice(0, 2);
  }

  // Messages methods
  loadRecentConversations() {
    this.chatService.getConversations().subscribe({
      next: (conversations) => {
        this.recentConversations.set(conversations.slice(0, 3));
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
      }
    });
  }

  getConversationName(conversation: Conversation): string {
    if (conversation.otherParticipant) {
      return `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`;
    }
    const currentUser = this.authService.getUser();
    const other = conversation.participants.find(p => p._id !== currentUser?.id);
    return other ? `${other.firstName} ${other.lastName}` : 'Conversation';
  }

  getConversationInitials(conversation: Conversation): string {
    const name = this.getConversationName(conversation);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getConversationAvatar(conversation: Conversation): string | undefined {
    if (conversation.otherParticipant?.profilePicture) {
      return conversation.otherParticipant.profilePicture;
    }
    const currentUser = this.authService.getUser();
    const other = conversation.participants.find(p => p._id !== currentUser?.id);
    return other?.profilePicture;
  }

  getLastMessagePreview(conversation: Conversation): string {
    if (!conversation.lastMessage?.content) {
      return 'Nouvelle conversation';
    }

    const currentUser = this.authService.getUser();
    const isOwnMessage = conversation.lastMessage.sender?._id === currentUser?.id ||
                         (conversation.lastMessage.sender as any) === currentUser?.id;

    let content = conversation.lastMessage.content;
    if (conversation.lastMessage.type === 'image') {
      content = 'Photo';
    } else if (conversation.lastMessage.type === 'document') {
      content = 'Document';
    }

    const prefix = isOwnMessage ? 'Vous : ' : '';
    const maxLength = isOwnMessage ? 25 : 30;

    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    return prefix + content;
  }

  formatMessageTime(date: Date | string | null): string {
    if (!date) return '';

    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    }

    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  isMessageRead(conversation: Conversation): boolean {
    const currentUser = this.authService.getUser();
    // If last message is from current user, check if other participant read it
    // For simplicity, we consider it read if unreadCount is 0
    const isOwnMessage = conversation.lastMessage?.sender?._id === currentUser?.id ||
                         (conversation.lastMessage?.sender as any) === currentUser?.id;
    return isOwnMessage && conversation.unreadCount === 0;
  }

  isOwnLastMessage(conversation: Conversation): boolean {
    const currentUser = this.authService.getUser();
    return conversation.lastMessage?.sender?._id === currentUser?.id ||
           (conversation.lastMessage?.sender as any) === currentUser?.id;
  }

  openConversation(conversation: Conversation) {
    this.router.navigate(['/chat', conversation._id]);
  }

  isUserOnline(conversation: Conversation): boolean {
    return conversation.otherParticipant?.isOnline || false;
  }

  // Coach methods
  loadCurrentCoach() {
    this.athleteService.getCurrentCoach().subscribe({
      next: (coach) => {
        this.currentCoach.set(coach);
        if (coach) {
          this.loadCoachSessions();
        }
      },
      error: (err) => {
        console.error('Error loading coach:', err);
        this.currentCoach.set(null);
      }
    });
  }

  loadCoachSessions() {
    // Les séances planifiées par le coach sont déjà chargées via getCalendarData
    // On filtre celles créées par un coach (generatedBy === 'coach')
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const coachSessions = this.upcomingRuns().filter(session => {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate >= today && session.generatedBy === 'coach';
    }).slice(0, 3);

    this.coachPlannedSessions.set(coachSessions);
  }

  getCoachInitials(): string {
    const coach = this.currentCoach();
    if (!coach) return '';
    return `${coach.firstName?.[0] || ''}${coach.lastName?.[0] || ''}`.toUpperCase();
  }

  contactCoach() {
    const coach = this.currentCoach();
    if (!coach) return;

    this.chatService.getOrCreateConversation(coach._id).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Error creating conversation:', err);
      }
    });
  }

  loadPartnerCoach() {
    this.chatService.getPartnerCoach().subscribe({
      next: (coach) => {
        this.partnerCoach.set(coach);
      },
      error: (err) => {
        console.error('Error loading partner coach:', err);
        this.partnerCoach.set(null);
      }
    });
  }

  contactPartnerCoach() {
    const coach = this.partnerCoach();
    if (!coach) return;

    this.chatService.getOrCreateConversation(coach._id).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Error creating conversation with partner coach:', err);
      }
    });
  }

  joinByCode() {
    if (!this.inviteCode.trim()) return;

    this.joiningByCode.set(true);
    this.joinMessage.set(null);

    this.athleteService.joinViaCode(this.inviteCode.trim()).subscribe({
      next: () => {
        this.joiningByCode.set(false);
        this.inviteCode = '';
        this.joinMessage.set({ text: 'Demande envoyée !', type: 'success' });
        this.loadCurrentCoach();
        setTimeout(() => this.joinMessage.set(null), 3000);
      },
      error: (err) => {
        this.joiningByCode.set(false);
        this.joinMessage.set({
          text: err.error?.error || 'Code invalide',
          type: 'error'
        });
        setTimeout(() => this.joinMessage.set(null), 3000);
      }
    });
  }

  // Invitations methods
  loadPendingInvitations() {
    this.athleteService.getPendingInvitations().subscribe({
      next: (invitations) => {
        this.pendingCoachInvitations.set(invitations);
      },
      error: (err) => {
        console.error('Error loading pending invitations:', err);
      }
    });
  }

  openInvitationModal(invitation: any) {
    this.invitationModalService.open(invitation);
  }

  closeInvitationModal() {
    this.invitationModalService.close();
  }

  acceptInvitation() {
    const invitation = this.invitationModalService.invitation();
    if (!invitation) return;

    this.athleteService.acceptInvitation(invitation._id).subscribe({
      next: () => {
        this.closeInvitationModal();
        this.loadPendingInvitations();
        this.loadCurrentCoach();
      },
      error: (err) => {
        console.error('Error accepting invitation:', err);
      }
    });
  }

  rejectInvitation() {
    const invitation = this.invitationModalService.invitation();
    if (!invitation) return;

    this.athleteService.rejectInvitation(invitation._id).subscribe({
      next: () => {
        this.closeInvitationModal();
        this.loadPendingInvitations();
      },
      error: (err) => {
        console.error('Error rejecting invitation:', err);
      }
    });
  }

  // Strava methods
  handleStravaCallback() {
    this.route.queryParams.subscribe(params => {
      if (params['strava'] === 'success') {
        this.stravaMessage.set('Compte Strava connecté avec succès !');
        this.loadStravaStatus();
        setTimeout(() => this.stravaMessage.set(null), 5000);
      } else if (params['strava'] === 'error') {
        this.stravaMessage.set('Erreur de connexion Strava: ' + (params['message'] || 'Erreur inconnue'));
        setTimeout(() => this.stravaMessage.set(null), 5000);
      }
    });
  }

  loadStravaStatus() {
    this.stravaLoading.set(true);
    this.stravaService.getStatus().subscribe({
      next: (status) => {
        this.stravaStatus.set(status);
        this.stravaLoading.set(false);
      },
      error: () => {
        this.stravaLoading.set(false);
      }
    });
  }

  connectStrava() {
    this.stravaLoading.set(true);
    this.stravaService.getAuthUrl().subscribe({
      next: (response) => {
        window.location.href = response.authUrl;
      },
      error: () => {
        this.stravaLoading.set(false);
        this.stravaMessage.set('Erreur lors de la connexion à Strava');
      }
    });
  }

  syncStrava() {
    if (!this.subscriptionService.isPro() && this.subscriptionService.trainCoins() < 0.5) {
      this.subscriptionService.openPaywall('strava');
      return;
    }

    this.stravaSyncing.set(true);
    this.stravaMessage.set(null);
    this.stravaService.syncActivities().subscribe({
      next: (result) => {
        this.stravaSyncing.set(false);
        const hasRuns = result.imported.length > 0;
        const hasStrength = (result.importedStrength?.length ?? 0) > 0;

        if (hasRuns || hasStrength) {
          this.loadDashboardData();
          this.loadRecentSessions();

          const items: StravaFeelingItem[] = [
            ...result.imported.map(r => ({
              kind: 'run' as const,
              id: r.id,
              date: r.date,
              distance: r.distance,
              duration: r.duration,
              sessionType: r.sessionType,
              feeling: 5,
              pendingMatch: r.pendingPlannedMatch ?? null,
              matchDecision: 'pending' as const,
              showPicker: false,
              candidates: [] as PlannedMatchSummary[],
              loadingMatch: false
            })),
            ...result.importedStrength.map(s => ({
              kind: 'strength' as const,
              id: s.id,
              date: s.date,
              duration: s.duration,
              sessionType: s.sessionType,
              feeling: 5,
              pendingMatch: s.pendingPlannedMatch ?? null,
              matchDecision: 'pending' as const,
              showPicker: false,
              candidates: [] as PlannedMatchSummary[],
              loadingMatch: false
            }))
          ];

          this.stravaFeelingModal.set({ open: true, items });
        } else {
          this.stravaMessage.set(result.message);
          setTimeout(() => this.stravaMessage.set(null), 5000);
        }
      },
      error: (err) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set('Erreur lors de la synchronisation');
        console.error(err);
      }
    });
  }

  saveStravaFeelings() {
    const items = this.stravaFeelingModal().items;
    this.stravaFeelingModal.set({ open: false, items: [] });
    items.forEach(item => {
      if (!item.id) return;
      if (item.kind === 'run') {
        this.runService.updateRun(item.id, { feeling: item.feeling }).subscribe();
      } else {
        this.strengthService.updateSession(item.id, { feeling: item.feeling }).subscribe();
      }
    });
    this.stravaMessage.set(`${items.length} séance${items.length > 1 ? 's' : ''} importée${items.length > 1 ? 's' : ''} !`);
    setTimeout(() => this.stravaMessage.set(null), 4000);
  }

  skipStravaFeelings() {
    const count = this.stravaFeelingModal().items.length;
    this.stravaFeelingModal.set({ open: false, items: [] });
    this.stravaMessage.set(`${count} séance${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''} !`);
    setTimeout(() => this.stravaMessage.set(null), 4000);
  }

  setStravaFeeling(index: number, value: number) {
    this.patchFeelingItem(index, { feeling: value });
  }

  private patchFeelingItem(index: number, patch: Partial<StravaFeelingItem>) {
    const current = this.stravaFeelingModal();
    if (!current.items[index]) return;
    const items = [...current.items];
    items[index] = { ...items[index], ...patch };
    this.stravaFeelingModal.set({ ...current, items });
  }

  // ── Mapping match ─────────────────────────────────────────────
  confirmStravaMatch(index: number) {
    const item = this.stravaFeelingModal().items[index];
    if (!item || !item.pendingMatch || item.loadingMatch) return;
    this.patchFeelingItem(index, { loadingMatch: true });
    const obs: Observable<unknown> = item.kind === 'run'
      ? this.runService.confirmMatch(item.id)
      : this.strengthService.confirmMatch(item.id);
    obs.subscribe({
      next: () => this.patchFeelingItem(index, { matchDecision: 'confirmed', loadingMatch: false, showPicker: false }),
      error: () => this.patchFeelingItem(index, { loadingMatch: false })
    });
  }

  dismissStravaMatch(index: number) {
    const item = this.stravaFeelingModal().items[index];
    if (!item || item.loadingMatch) return;
    this.patchFeelingItem(index, { loadingMatch: true });
    const obs: Observable<unknown> = item.kind === 'run'
      ? this.runService.dismissMatch(item.id)
      : this.strengthService.dismissMatch(item.id);
    obs.subscribe({
      next: () => this.patchFeelingItem(index, { matchDecision: 'dismissed', loadingMatch: false, showPicker: false }),
      error: () => this.patchFeelingItem(index, { loadingMatch: false })
    });
  }

  openStravaMatchPicker(index: number) {
    const item = this.stravaFeelingModal().items[index];
    if (!item || item.loadingMatch) return;
    this.patchFeelingItem(index, { loadingMatch: true, showPicker: true });
    const obs: Observable<PlannedMatchSummary[]> = item.kind === 'run'
      ? this.runService.getMatchCandidates(item.id)
      : this.strengthService.getMatchCandidates(item.id);
    obs.subscribe({
      next: (list) => {
        const filtered = list.filter(c => c._id !== item.pendingMatch?._id);
        this.patchFeelingItem(index, { candidates: filtered, loadingMatch: false });
      },
      error: () => this.patchFeelingItem(index, { loadingMatch: false })
    });
  }

  closeStravaMatchPicker(index: number) {
    this.patchFeelingItem(index, { showPicker: false });
  }

  selectStravaMatchCandidate(index: number, plannedId: string) {
    const item = this.stravaFeelingModal().items[index];
    if (!item || item.loadingMatch) return;
    this.patchFeelingItem(index, { loadingMatch: true });
    const obs: Observable<unknown> = item.kind === 'run'
      ? this.runService.linkToPlanned(item.id, plannedId)
      : this.strengthService.linkToPlanned(item.id, plannedId);
    obs.subscribe({
      next: () => this.patchFeelingItem(index, { matchDecision: 'linked', loadingMatch: false, showPicker: false }),
      error: () => this.patchFeelingItem(index, { loadingMatch: false })
    });
  }

  matchLabel(m: PlannedMatchSummary | null): string {
    if (!m) return '';
    if (m.activityType === 'strength') {
      return SESSION_TYPE_LABELS[m.sessionType as keyof typeof SESSION_TYPE_LABELS] || 'Muscu';
    }
    return RUNNING_SESSION_LABELS[m.sessionType as keyof typeof RUNNING_SESSION_LABELS] || 'Course';
  }

  matchSummary(m: PlannedMatchSummary | null): string {
    if (!m) return '';
    const parts: string[] = [];
    if (m.targetDistance) parts.push(`${m.targetDistance} km`);
    if (m.targetDuration) parts.push(`${m.targetDuration} min`);
    if (m.targetPace) parts.push(`${m.targetPace}/km`);
    return parts.join(' · ');
  }

  matchCandidateDate(c: PlannedMatchSummary): string {
    return new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  itemTitle(item: StravaFeelingItem): string {
    if (item.kind === 'strength') {
      return SESSION_TYPE_LABELS[item.sessionType as keyof typeof SESSION_TYPE_LABELS] || 'Muscu';
    }
    return 'Course';
  }

  resyncStrava() {
    this.stravaSyncing.set(true);
    this.stravaMessage.set(null);
    this.stravaService.resyncActivities().subscribe({
      next: (result) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set(result.message);
        if (result.updated > 0) {
          this.loadDashboardData();
          this.loadRecentSessions();
        }
        setTimeout(() => this.stravaMessage.set(null), 5000);
      },
      error: (err) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set('Erreur lors de la resynchronisation');
        console.error(err);
      }
    });
  }

  disconnectStrava() {
    if (!confirm('Déconnecter votre compte Strava ?')) return;

    this.stravaLoading.set(true);
    this.stravaService.disconnect().subscribe({
      next: () => {
        this.stravaStatus.set({ connected: false, athleteId: null, connectedAt: null });
        this.stravaLoading.set(false);
        this.stravaMessage.set('Compte Strava déconnecté');
        setTimeout(() => this.stravaMessage.set(null), 3000);
      },
      error: () => {
        this.stravaLoading.set(false);
        this.stravaMessage.set('Erreur lors de la déconnexion');
      }
    });
  }

  formatRunFullDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getFeelingLabel(value: number): string {
    if (value >= 9) return 'Excellent';
    if (value >= 7) return 'Bien';
    if (value >= 5) return 'Correct';
    if (value >= 3) return 'Difficile';
    return 'Épuisant';
  }

  getFeelingColor(value: number): string {
    if (value >= 9) return '#16a34a';
    if (value >= 7) return '#22c55e';
    if (value >= 5) return '#eab308';
    if (value >= 3) return '#f97316';
    return '#ef4444';
  }
}
