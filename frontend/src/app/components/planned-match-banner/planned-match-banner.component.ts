import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RunService, Run } from '../../services/run.service';
import { StrengthService } from '../../services/strength.service';
import { StrengthSession, SESSION_TYPE_LABELS } from '../../interfaces/strength.interfaces';
import { PlannedMatchSummary } from '../../interfaces/planned-match.interface';
import { RUNNING_SESSION_LABELS } from '../../services/planning.service';

type Kind = 'run' | 'strength';
type Activity = Run | StrengthSession;

@Component({
  selector: 'app-planned-match-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planned-match-banner.component.html',
  styleUrl: './planned-match-banner.component.scss'
})
export class PlannedMatchBannerComponent {
  @Input({ required: true }) activity!: Run | StrengthSession;
  @Input({ required: true }) kind!: Kind;
  @Output() updated = new EventEmitter<Run | StrengthSession>();

  pickerOpen = signal(false);
  loading = signal(false);
  candidates = signal<PlannedMatchSummary[]>([]);

  get plannedMatch(): PlannedMatchSummary | null {
    const m = this.activity?.pendingPlannedMatch;
    return m && typeof m === 'object' ? (m as PlannedMatchSummary) : null;
  }

  get visible(): boolean {
    return !!this.plannedMatch && !this.activity?.matchDismissed;
  }

  get plannedLabel(): string {
    const p = this.plannedMatch;
    if (!p) return '';
    if (p.activityType === 'strength') {
      return SESSION_TYPE_LABELS[p.sessionType as keyof typeof SESSION_TYPE_LABELS] || 'Muscu';
    }
    return RUNNING_SESSION_LABELS[p.sessionType as keyof typeof RUNNING_SESSION_LABELS] || 'Course';
  }

  get plannedSummary(): string {
    const p = this.plannedMatch;
    if (!p) return '';
    const parts: string[] = [];
    if (p.targetDistance) parts.push(`${p.targetDistance} km`);
    if (p.targetDuration) parts.push(`${p.targetDuration} min`);
    if (p.targetPace) parts.push(`${p.targetPace}/km`);
    return parts.join(' · ');
  }

  candidateLabel(c: PlannedMatchSummary): string {
    if (c.activityType === 'strength') {
      return SESSION_TYPE_LABELS[c.sessionType as keyof typeof SESSION_TYPE_LABELS] || 'Muscu';
    }
    return RUNNING_SESSION_LABELS[c.sessionType as keyof typeof RUNNING_SESSION_LABELS] || 'Course';
  }

  candidateDate(c: PlannedMatchSummary): string {
    const d = new Date(c.date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private confirmCall(id: string): Observable<Activity> {
    return this.kind === 'run'
      ? this.runService.confirmMatch(id) as Observable<Activity>
      : this.strengthService.confirmMatch(id) as Observable<Activity>;
  }

  private dismissCall(id: string): Observable<Activity> {
    return this.kind === 'run'
      ? this.runService.dismissMatch(id) as Observable<Activity>
      : this.strengthService.dismissMatch(id) as Observable<Activity>;
  }

  private candidatesCall(id: string): Observable<PlannedMatchSummary[]> {
    return this.kind === 'run'
      ? this.runService.getMatchCandidates(id)
      : this.strengthService.getMatchCandidates(id);
  }

  private linkCall(id: string, plannedId: string): Observable<Activity> {
    return this.kind === 'run'
      ? this.runService.linkToPlanned(id, plannedId) as Observable<Activity>
      : this.strengthService.linkToPlanned(id, plannedId) as Observable<Activity>;
  }

  confirm(ev: Event) {
    ev.stopPropagation();
    if (this.loading()) return;
    this.loading.set(true);
    this.confirmCall(this.activity._id as string).subscribe({
      next: (updated: Activity) => {
        this.loading.set(false);
        this.updated.emit(updated);
      },
      error: () => this.loading.set(false)
    });
  }

  dismiss(ev: Event) {
    ev.stopPropagation();
    if (this.loading()) return;
    this.loading.set(true);
    this.dismissCall(this.activity._id as string).subscribe({
      next: (updated: Activity) => {
        this.loading.set(false);
        this.updated.emit(updated);
      },
      error: () => this.loading.set(false)
    });
  }

  openPicker(ev: Event) {
    ev.stopPropagation();
    if (this.loading()) return;
    this.pickerOpen.set(true);
    this.loading.set(true);
    this.candidatesCall(this.activity._id as string).subscribe({
      next: (list: PlannedMatchSummary[]) => {
        const current = this.plannedMatch?._id;
        this.candidates.set(list.filter(c => c._id !== current));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  closePicker(ev: Event) {
    ev.stopPropagation();
    this.pickerOpen.set(false);
  }

  selectAlternative(ev: Event, plannedId: string) {
    ev.stopPropagation();
    if (this.loading()) return;
    this.loading.set(true);
    this.linkCall(this.activity._id as string, plannedId).subscribe({
      next: (updated: Activity) => {
        this.loading.set(false);
        this.pickerOpen.set(false);
        this.updated.emit(updated);
      },
      error: () => this.loading.set(false)
    });
  }

  constructor(
    private runService: RunService,
    private strengthService: StrengthService
  ) {}
}
