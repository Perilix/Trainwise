import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { PlanningService, PlannedSession } from '../../services/planning.service';
import { AuthService } from '../../services/auth.service';
import { ChatService, Conversation } from '../../services/chat.service';
import { AthleteService } from '../../services/athlete.service';
import { CoachInvitationModalService } from '../../services/coach-invitation-modal.service';
import { Coach } from '../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  runs: Run[];
  plannedRuns: PlannedSession[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  // Data
  recentRuns = signal<Run[]>([]);
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

  // Computed
  streak = signal(0);
  weekStats = signal({ runs: 0, distance: 0, duration: 0 });

  constructor(
    private runService: RunService,
    private planningService: PlanningService,
    public authService: AuthService,
    public chatService: ChatService,
    private athleteService: AthleteService,
    public invitationModalService: CoachInvitationModalService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
    this.loadRecentConversations();
    this.loadCurrentCoach();
    this.loadPendingInvitations();
    this.loadPartnerCoach();

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

    // Load current week calendar
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    this.planningService.getCalendarData(month, year).subscribe({
      next: (data) => {
        this.buildWeekView(data.runs, data.plannedRuns);
        this.calculateStreak(data.runs);
        this.calculateWeekStats(data.runs);
        this.findUpcomingSession(data.plannedRuns);
        // Trier par date décroissante et prendre les 3 dernières courses
        const sortedRuns = [...data.runs].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        this.recentRuns.set(sortedRuns.slice(0, 3));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
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

    // Sort by date descending
    const sortedRuns = [...runs].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);

    // Check if ran today or yesterday to start streak
    const lastRunDate = new Date(sortedRuns[0].date);
    lastRunDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      this.streak.set(0);
      return;
    }

    // Count consecutive days with runs (looking at weeks, not strict days)
    const runDates = new Set(sortedRuns.map(r => this.formatDateStr(new Date(r.date))));

    for (let i = 0; i < 365; i++) {
      checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);

      if (runDates.has(this.formatDateStr(checkDate))) {
        currentStreak++;
      } else if (i > 0) {
        // Allow one day gap for rest days
        const prevDate = new Date(today);
        prevDate.setDate(today.getDate() - i + 1);
        if (!runDates.has(this.formatDateStr(prevDate))) {
          break;
        }
      }
    }

    // Simplified: count weeks with at least one run
    const weeksWithRuns = new Set<string>();
    sortedRuns.forEach(r => {
      const d = new Date(r.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      weeksWithRuns.add(this.formatDateStr(weekStart));
    });

    this.streak.set(Math.min(currentStreak, 99)); // Cap at 99 for display
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
    if (day.plannedRuns.some(p => p.status === 'planned')) return 'planned';
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
}
