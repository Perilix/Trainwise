import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RunBlock } from '../../services/run.service';

type StepType = 'warm' | 'run' | 'rec' | 'cool' | 'rest';

interface TimelineSegment {
  type: StepType;
  flex: number;
}

interface TimelineLabel {
  text: string;
  flex: number;
}

/**
 * Bloc « Profil de la séance » : timeline horizontale color-codée par type
 * d'étape + 3 stats (distance, durée estimée, nb d'étapes). Se recalcule à
 * chaque changement de blocs (live).
 */
@Component({
  selector: 'app-workout-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-profile.component.html',
  styleUrl: './workout-profile.component.scss'
})
export class WorkoutProfileComponent {
  segments: TimelineSegment[] = [];
  labels: TimelineLabel[] = [];
  totalDistanceKm = 0;
  totalDurationMin = 0;
  stepsCount = 0;

  private _blocks: RunBlock[] = [];

  @Input() set blocks(value: RunBlock[] | null | undefined) {
    this._blocks = value || [];
    this.recompute();
  }
  get blocks(): RunBlock[] {
    return this._blocks;
  }

  // Distance totale fournie par l'éditeur (source unique = même valeur que le footer).
  // Si non fournie, on retombe sur le calcul interne.
  @Input() totalKm: number | null = null;

  get hasData(): boolean {
    return this.segments.length > 0;
  }

  get distanceLabel(): string {
    const km = this.totalKm != null ? this.totalKm : this.totalDistanceKm;
    return km > 0 ? this.fr(km) : '—';
  }

  get durationLabel(): string {
    return this.totalDurationMin > 0 ? `~${Math.round(this.totalDurationMin)}` : '—';
  }

  // ---------------------------------------------------------------

  private recompute() {
    const segments: TimelineSegment[] = [];
    const labels: TimelineLabel[] = [];
    let totalKm = 0;
    let totalMin = 0;
    let steps = 0;

    const ordered = [...this._blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const warmup = ordered.find(b => b.role === 'warmup');
    const mains = ordered.filter(b => b.role === 'main');
    const cooldown = ordered.find(b => b.role === 'cooldown');

    if (warmup) {
      const min = this.effortDurationMin(warmup);
      const km = this.effortDistanceKm(warmup);
      segments.push({ type: 'warm', flex: this.weight(min, km) });
      labels.push({ text: 'Échauf.', flex: this.weight(min, km) });
      totalKm += km;
      totalMin += min;
      steps += 1;
    }

    for (const block of mains) {
      const reps = Math.max(1, block.repetitions || 1);
      // Étapes du bloc : enfants si groupe « Répéter » multi-étapes, sinon le bloc lui-même.
      const units = block.children?.length ? block.children : [block];
      let phaseFlex = 0;

      // La boucle itère déjà `reps` fois → on additionne une seule fois par passage.
      for (let i = 0; i < reps; i++) {
        for (const unit of units) {
          const effortMin = this.effortDurationMin(unit);
          const effortKm = this.effortDistanceKm(unit);
          segments.push({ type: 'run', flex: this.weight(effortMin, effortKm) });
          phaseFlex += this.weight(effortMin, effortKm);
          totalKm += effortKm;
          totalMin += effortMin;
          if (unit.recoveryMode) {
            const recMin = this.recoveryDurationMin(unit);
            const recKm = this.recoveryDistanceKm(unit);
            segments.push({ type: 'rec', flex: this.weight(recMin, recKm) });
            phaseFlex += this.weight(recMin, recKm);
            totalKm += recKm;
            totalMin += recMin;
          }
        }
      }

      const base = (block.description || '').trim() || (block.children?.length ? 'Groupe' : 'Effort');
      labels.push({ text: reps > 1 ? `${base} ×${reps}` : base, flex: phaseFlex });
      steps += 1;
    }

    if (cooldown) {
      const min = this.effortDurationMin(cooldown);
      const km = this.effortDistanceKm(cooldown);
      segments.push({ type: 'cool', flex: this.weight(min, km) });
      labels.push({ text: 'Calme', flex: this.weight(min, km) });
      totalKm += km;
      totalMin += min;
      steps += 1;
    }

    this.segments = segments;
    this.labels = labels;
    this.totalDistanceKm = totalKm;
    this.totalDurationMin = totalMin;
    this.stepsCount = steps;
  }

  /** Largeur d'un segment : on prend la durée estimée, avec un plancher pour rester visible. */
  private weight(min: number, km: number): number {
    const w = min > 0 ? min : km > 0 ? km * 6 : 1;
    return Math.max(0.4, w);
  }

  private paceMinPerKm(pace?: string | null): number | null {
    if (!pace) return null;
    const m = /^(\d+):(\d{1,2})$/.exec(pace.trim());
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (isNaN(min) || isNaN(sec) || sec >= 60) return null;
    return min + sec / 60;
  }

  private effortDistanceKm(block: RunBlock): number {
    if (block.mode === 'distance') return block.distance || 0;
    const pace = this.paceMinPerKm(block.pace);
    if (block.mode === 'duration' && pace && pace > 0) return (block.duration || 0) / pace;
    return 0;
  }

  private effortDurationMin(block: RunBlock): number {
    if (block.mode === 'duration') return block.duration || 0;
    const pace = this.paceMinPerKm(block.pace) ?? 5; // défaut 5:00/km si non renseigné
    return (block.distance || 0) * pace;
  }

  private recoveryDistanceKm(block: RunBlock): number {
    if (block.recoveryMode === 'distance') return block.recoveryDistance || 0;
    if (block.recoveryMode === 'duration') {
      const pace = this.paceMinPerKm(block.recoveryPace) ?? 6.5;
      return this.recoveryDurationMin(block) / pace;
    }
    return 0;
  }

  private recoveryDurationMin(block: RunBlock): number {
    if (block.recoveryMode === 'duration') return this.parseRecoveryDuration(block.recoveryDuration);
    if (block.recoveryMode === 'distance') {
      const pace = this.paceMinPerKm(block.recoveryPace) ?? 6.5;
      return (block.recoveryDistance || 0) * pace;
    }
    return 0;
  }

  /** "1min30", "1:00", "90s", "2min" → minutes décimales. */
  private parseRecoveryDuration(value?: string | null): number {
    if (!value) return 0;
    const v = value.trim().toLowerCase();
    const colon = /^(\d+):(\d{1,2})$/.exec(v);
    if (colon) return parseInt(colon[1], 10) + parseInt(colon[2], 10) / 60;
    const minSec = /(\d+)\s*min(?:ute)?s?\s*(\d+)?/.exec(v);
    if (minSec) return parseInt(minSec[1], 10) + (minSec[2] ? parseInt(minSec[2], 10) / 60 : 0);
    const sec = /(\d+)\s*s/.exec(v);
    if (sec) return parseInt(sec[1], 10) / 60;
    const num = parseFloat(v);
    return isNaN(num) ? 0 : num;
  }

  private fr(n: number): string {
    return n.toFixed(1).replace('.', ',');
  }
}
