import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '../../core/api.service';
import type { ApiExercise, ApiExerciseInput } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { load } from '../../core/load';
import { ToastService } from '../../core/toast.service';
import { CoachService } from '../../data/coach.service';
import { EQUIPMENT_LABELS, EQUIPMENT_OPTIONS, MUSCLE_OPTIONS, isMine, parseExerciseList } from '../../domain/exercises';
import { MUSCLE_LABELS } from '../../domain/session-detail';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

type Origin = 'all' | 'catalog' | 'mine';

type Draft = {
  id: string | null;
  name: string;
  primaryMuscle: string;
  muscleGroups: string[];
  equipment: string;
  videoUrl: string;
  imageUrl: string;
  instructions: string;
  isPublic: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  primaryMuscle: '',
  muscleGroups: [],
  equipment: 'bodyweight',
  videoUrl: '',
  imageUrl: '',
  instructions: '',
  isPublic: false,
};

const IMPORT_EXAMPLE = 'Step-up lesté ; quadriceps ; haltères\nPied-poing ; mollets ; poids du corps\nGainage latéral ; abdos';

@Component({
  selector: 'tw-coach-exercises',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Bibliothèque" subtitle="Exercices et séances disponibles pour vos athlètes.">
        <button class="btn btn-ghost" type="button" (click)="openImport()">
          <tw-icon name="upload" [size]="18" [strokeWidth]="2" />
          Importer une liste
        </button>
        <button class="btn btn-primary" type="button" (click)="openNew()">
          <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
          Nouvel exercice
        </button>
      </tw-page-header>

      <div class="toolbar">
        <div class="tabs">
          <button type="button" class="tab" (click)="openSessions()">Séances</button>
          <button type="button" class="tab on">Exercices<span class="count">{{ exercises.data()?.length ?? 0 }}</span></button>
        </div>
        <div class="filters">
          <div class="segmented">
            <button type="button" class="seg" [class.on]="origin() === 'all'" (click)="origin.set('all')">Tous</button>
            <button type="button" class="seg" [class.on]="origin() === 'catalog'" (click)="origin.set('catalog')">Catalogue</button>
            <button type="button" class="seg" [class.on]="origin() === 'mine'" (click)="origin.set('mine')">
              Mes exercices<span class="count">{{ mineCount() }}</span>
            </button>
          </div>
          <div class="search">
            <tw-icon name="search" [size]="16" />
            <input placeholder="Rechercher un exercice…" [value]="search()" (input)="search.set(value($event))" />
          </div>
          <select class="input narrow" [value]="muscle()" (change)="muscle.set(value($event))">
            <option value="">Muscles : tous</option>
            @for (option of muscles(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
          <select class="input narrow" [value]="equipment()" (change)="equipment.set(value($event))">
            <option value="">Équipements : tous</option>
            @for (option of equipments(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (exercises.loading()) {
        <tw-state kind="loading" />
      } @else if (exercises.error()) {
        <tw-state kind="error" [message]="exercises.error()">
          <button class="btn btn-ghost btn-sm" (click)="exercises.reload()">Réessayer</button>
        </tw-state>
      } @else if (filtered().length) {
        <div class="grid">
          @for (exercise of filtered(); track exercise._id) {
            <article class="card ex">
              <div class="thumb">
                @if (exercise.imageUrl) {
                  <img [src]="exercise.imageUrl" [alt]="exercise.name" loading="lazy" />
                } @else {
                  <tw-icon name="dumbbell" [size]="28" />
                }
                @if (mine(exercise)) {
                  <span class="badges">
                    <span class="chip chip-accent">Perso</span>
                    @if (exercise.isPublic) {
                      <span class="chip">Public</span>
                    }
                  </span>
                } @else if (exercise.createdBy) {
                  <span class="badges"><span class="chip">Partagé par un coach</span></span>
                }
              </div>
              <div class="body-part">
                <div class="name-line">
                  <span class="h3 grow">{{ exercise.name }}</span>
                  @if (mine(exercise)) {
                    <button class="icon-btn" type="button" (click)="openEdit(exercise)" [attr.aria-label]="'Modifier ' + exercise.name">
                      <tw-icon name="edit" [size]="16" />
                    </button>
                  }
                </div>
                <div class="line">
                  <span class="small strong">{{ muscleLabel(exercise.primaryMuscle) }}</span>
                  @if (exercise.equipment) {
                    <span class="muted-3">·</span>
                    <span class="small muted">{{ equipmentLabel(exercise.equipment) }}</span>
                  }
                </div>
                @if (secondary(exercise).length) {
                  <div class="tags">
                    @for (group of secondary(exercise); track group) {
                      <span class="chip">{{ muscleLabel(group) }}</span>
                    }
                  </div>
                }
              </div>
            </article>
          }
        </div>
      } @else if (origin() === 'mine' && !mineCount()) {
        <div class="card card-pad">
          <tw-state kind="empty" icon="dumbbell" message="Vous n'avez pas encore d'exercice perso. Créez-les un par un ou collez votre liste.">
            <div class="empty-actions">
              <button class="btn btn-ghost btn-sm" type="button" (click)="openImport()">Importer une liste</button>
              <button class="btn btn-primary btn-sm" type="button" (click)="openNew()">Nouvel exercice</button>
            </div>
          </tw-state>
        </div>
      } @else {
        <div class="card card-pad">
          <tw-state kind="empty" icon="dumbbell" message="Aucun exercice ne correspond." />
        </div>
      }

      @if (draft(); as form) {
        <div class="scrim" (click)="closeDraft()">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">{{ form.id ? 'Modifier l’exercice' : 'Nouvel exercice' }}</span>
              <button class="icon-btn" type="button" (click)="closeDraft()" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <p class="small muted">Utilisable tout de suite dans l'éditeur muscu.</p>

            <div class="form">
              <div class="field">
                <label for="ex-name">Nom *</label>
                <input id="ex-name" class="input" [value]="form.name" (input)="patch({ name: value($event) })" />
              </div>
              <div class="two">
                <div class="field">
                  <label for="ex-muscle">Muscle principal</label>
                  <select id="ex-muscle" class="input" [value]="form.primaryMuscle" (change)="setPrimary(value($event))">
                    <option value="">—</option>
                    @for (option of muscleOptions; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label for="ex-equipment">Équipement</label>
                  <select id="ex-equipment" class="input" [value]="form.equipment" (change)="patch({ equipment: value($event) })">
                    @for (option of equipmentOptions; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="field">
                <label>Muscles secondaires <span class="muted-3">— cliquez pour ajouter ou retirer</span></label>
                <div class="toggles">
                  @for (option of secondaryOptions(); track option.value) {
                    <button type="button" class="toggle" [class.on]="form.muscleGroups.includes(option.value)" [attr.aria-pressed]="form.muscleGroups.includes(option.value)" (click)="toggleGroup(option.value)">
                      <span class="tick"><tw-icon [name]="form.muscleGroups.includes(option.value) ? 'check' : 'plus'" [size]="13" [strokeWidth]="2.5" /></span>
                      {{ option.label }}
                    </button>
                  }
                </div>
              </div>
              <div class="field">
                <label for="ex-video">Vidéo de démonstration</label>
                <input id="ex-video" class="input" placeholder="Lien YouTube ou Instagram" [value]="form.videoUrl" (input)="patch({ videoUrl: value($event) })" />
              </div>
              <div class="field">
                <label>Photo</label>
                @if (form.imageUrl) {
                  <div class="photo">
                    <img [src]="form.imageUrl" alt="" />
                    <button type="button" class="link-danger" (click)="patch({ imageUrl: '' })">Retirer la photo</button>
                  </div>
                } @else {
                  <label class="drop" [class.busy]="uploading()">
                    <tw-icon name="image" [size]="20" />
                    <span class="small">{{ uploading() ? 'Envoi…' : 'Ajouter une photo' }} <span class="muted-3">· JPG ou PNG</span></span>
                    <input type="file" accept="image/*" class="sr-only" (change)="upload($event)" />
                  </label>
                }
              </div>
              <div class="field">
                <label for="ex-instructions">Consignes</label>
                <textarea id="ex-instructions" class="input" rows="3" [value]="form.instructions" (input)="patch({ instructions: value($event) })"></textarea>
              </div>
              <div class="field">
                <label>Confidentialité</label>
                <div class="segmented privacy">
                  <button type="button" class="seg" [class.on]="!form.isPublic" (click)="patch({ isPublic: false })">
                    <tw-icon name="lock" [size]="14" [strokeWidth]="2" />
                    Privé
                  </button>
                  <button type="button" class="seg" [class.on]="form.isPublic" (click)="patch({ isPublic: true })">
                    <tw-icon name="friends" [size]="14" [strokeWidth]="2" />
                    Public
                  </button>
                </div>
                <span class="caption muted">
                  {{ form.isPublic ? 'Tous les coachs Trainwise peuvent le voir et l’utiliser dans leurs séances, photo et vidéo comprises.' : 'Vous seul pouvez l’utiliser dans vos séances. Vos athlètes le voient dans les séances que vous leur donnez.' }}
                </span>
              </div>
            </div>

            @if (formError()) {
              <p class="err small">{{ formError() }}</p>
            }

            @if (confirmDelete()) {
              <div class="confirm">
                <span class="small">Supprimer « {{ form.name }} » ? Il disparaît aussi des séances types qui l'utilisent.</span>
                <div class="confirm-actions">
                  <button class="btn btn-ghost btn-sm" type="button" (click)="confirmDelete.set(false)">Garder</button>
                  <button class="btn btn-danger btn-sm" type="button" [disabled]="saving()" (click)="remove(form.id!)">Supprimer</button>
                </div>
              </div>
            } @else {
              <div class="modal-actions">
                @if (form.id) {
                  <button class="btn btn-ghost danger-text" type="button" (click)="confirmDelete.set(true)">
                    <tw-icon name="trash" [size]="16" [strokeWidth]="2" />
                  </button>
                }
                <button class="btn btn-ghost grow" type="button" (click)="closeDraft()">Annuler</button>
                <button class="btn btn-primary grow" type="button" [disabled]="saving() || uploading() || !form.name.trim()" (click)="save()">
                  {{ saving() ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer l’exercice' }}
                </button>
              </div>
            }
          </div>
        </div>
      }

      @if (importing()) {
        <div class="scrim" (click)="importing.set(false)">
          <div class="modal card wide" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Importer une liste d'exercices</span>
              <button class="icon-btn" type="button" (click)="importing.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <p class="small muted">
              Une ligne par exercice : <b>nom ; muscle ; équipement ; lien vidéo</b>. Seul le nom est obligatoire. Vous pouvez coller directement des
              colonnes depuis Excel ou Google Sheets.
            </p>
            <textarea class="input paste" rows="7" [placeholder]="importExample" [value]="importText()" (input)="importText.set(value($event))"></textarea>

            @if (importRows().length) {
              <div class="preview">
                <span class="overline muted-3">Nom</span>
                <span class="overline muted-3">Muscle</span>
                <span class="overline muted-3">Équipement</span>
                @for (row of importRows().slice(0, 8); track row.line) {
                  <span class="cell truncate">{{ row.name }}</span>
                  <span class="cell" [class.muted-3]="!row.muscleLabel">{{ row.muscleLabel ?? 'non reconnu' }}</span>
                  <span class="cell" [class.muted-3]="!row.equipmentLabel">{{ row.equipmentLabel ?? 'Autre' }}</span>
                }
              </div>
              @if (importRows().length > 8) {
                <span class="caption muted">… et {{ importRows().length - 8 }} autres.</span>
              }
              <span class="caption muted">Les exercices que vous avez déjà (même nom) ne sont pas recréés. Tout reste modifiable ensuite.</span>
            }

            @if (formError()) {
              <p class="err small">{{ formError() }}</p>
            }

            <div class="modal-actions">
              <button class="btn btn-ghost grow" type="button" (click)="importing.set(false)">Annuler</button>
              <button class="btn btn-primary grow" type="button" [disabled]="saving() || !importRows().length" (click)="runImport()">
                {{ saving() ? 'Import…' : 'Importer ' + importRows().length + ' exercice' + (importRows().length > 1 ? 's' : '') }}
              </button>
            </div>
          </div>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .page {
        flex: 1;
        min-width: 0;
        padding: 32px 40px 40px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .tabs {
        display: flex;
        align-items: center;
        gap: 28px;
        border-bottom: 1px solid var(--border);
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 0 12px;
        font-size: 15px;
        font-weight: 500;
        color: var(--text2);
        border-bottom: 2px solid transparent;
      }

      .tab.on {
        color: var(--ink);
        font-weight: 600;
        border-bottom-color: var(--brand);
      }

      .count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
      }

      .filters {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
      }

      .seg {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 38px;
        padding: 0 16px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 260px;
        height: 44px;
        padding: 0 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        color: var(--text3);
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        font-size: 14px;
        color: var(--ink);
      }

      .narrow {
        width: 210px;
        height: 44px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .ex {
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .thumb {
        position: relative;
        height: 140px;
        background: var(--subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text3);
      }

      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .badges {
        position: absolute;
        top: 10px;
        left: 10px;
        display: flex;
        gap: 6px;
      }

      .privacy {
        align-self: flex-start;
      }

      .body-part {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .name-line {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .name-line .icon-btn {
        margin: -6px -8px 0 0;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .strong {
        font-weight: 500;
        color: var(--ink);
      }

      .tags {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .empty-actions {
        display: flex;
        gap: 8px;
      }

      .icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        color: var(--text2);
        flex-shrink: 0;
      }

      .icon-btn:hover {
        background: var(--subtle);
        color: var(--ink);
      }

      .scrim {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 40;
      }

      .modal {
        width: 560px;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .modal.wide {
        width: 640px;
        gap: 12px;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 14px;
      }

      .two {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .toggles {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px 0 8px;
        border-radius: var(--r-md);
        border: 1px solid var(--border-strong);
        background: var(--surface);
        font-size: 13px;
        font-weight: 500;
      }

      .toggle:hover {
        background: var(--bg);
      }

      .toggle .tick {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toggle.on {
        background: var(--accent-soft);
        border-color: var(--accent);
        color: var(--accent-ink);
        font-weight: 600;
      }

      .toggle.on .tick {
        background: var(--accent);
        color: #ffffff;
      }

      .drop {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border: 1px dashed var(--border-strong);
        border-radius: var(--r-md);
        color: var(--text2);
        cursor: pointer;
      }

      .drop:hover {
        background: var(--bg);
      }

      .drop.busy {
        opacity: 0.6;
        pointer-events: none;
      }

      .photo {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .photo img {
        width: 96px;
        height: 72px;
        object-fit: cover;
        border-radius: var(--r-md);
      }

      .link-danger {
        font-size: 13px;
        font-weight: 500;
        color: var(--danger);
      }

      .paste {
        font-family: inherit;
        font-size: 13px;
      }

      .preview {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
        column-gap: 12px;
        align-items: center;
      }

      .cell {
        height: 36px;
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border);
        font-size: 13px;
      }

      .err {
        color: var(--danger);
        margin-top: 10px;
      }

      .danger-text {
        color: var(--danger);
      }

      .confirm {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 20px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: var(--danger-soft);
        color: var(--danger-ink);
      }

      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }

      @media (max-width: 1280px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class CoachExercisesPage {
  private readonly coach = inject(CoachService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly exercises = load(() => this.coach.exercises$());

  readonly origin = signal<Origin>('all');
  readonly search = signal('');
  readonly muscle = signal('');
  readonly equipment = signal('');

  readonly muscleOptions = MUSCLE_OPTIONS;
  readonly equipmentOptions = EQUIPMENT_OPTIONS;
  readonly importExample = IMPORT_EXAMPLE;

  readonly draft = signal<Draft | null>(null);
  readonly importing = signal(false);
  readonly importText = signal('');
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly confirmDelete = signal(false);
  readonly formError = signal('');

  private readonly coachId = computed(() => this.auth.user()?.id);

  readonly mineCount = computed(() => (this.exercises.data() ?? []).filter((exercise) => this.mine(exercise)).length);

  readonly muscles = computed(() => {
    const found = new Set<string>();
    for (const exercise of this.exercises.data() ?? []) {
      if (exercise.primaryMuscle) found.add(exercise.primaryMuscle);
      for (const group of exercise.muscleGroups ?? []) found.add(group);
    }
    return [...found].sort().map((value) => ({ value, label: this.muscleLabel(value) }));
  });

  readonly equipments = computed(() =>
    [...new Set((this.exercises.data() ?? []).map((exercise) => exercise.equipment).filter(Boolean) as string[])]
      .sort()
      .map((value) => ({ value, label: this.equipmentLabel(value) })),
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const origin = this.origin();
    const muscle = this.muscle();
    const equipment = this.equipment();
    const list = (this.exercises.data() ?? []).filter((exercise) => {
      if (origin === 'mine' && !this.mine(exercise)) return false;
      if (origin === 'catalog' && this.mine(exercise)) return false;
      if (term && !exercise.name.toLowerCase().includes(term)) return false;
      if (muscle && exercise.primaryMuscle !== muscle && !exercise.muscleGroups?.includes(muscle)) return false;
      if (equipment && exercise.equipment !== equipment) return false;
      return true;
    });
    // Les exercices du coach d'abord : ce sont ceux qu'il vient chercher.
    return origin === 'all' ? [...list].sort((a, b) => Number(this.mine(b)) - Number(this.mine(a))) : list;
  });

  readonly secondaryOptions = computed(() => {
    const primary = this.draft()?.primaryMuscle;
    return MUSCLE_OPTIONS.filter((option) => option.value !== primary);
  });

  readonly importRows = computed(() => parseExerciseList(this.importText()));

  mine(exercise: ApiExercise) {
    return isMine(exercise, this.coachId());
  }

  secondary(exercise: ApiExercise) {
    return (exercise.muscleGroups ?? []).filter((group) => group !== exercise.primaryMuscle);
  }

  muscleLabel(value?: string) {
    if (!value) return 'Exercice';
    return MUSCLE_LABELS[value] ?? value;
  }

  equipmentLabel(value: string) {
    return EQUIPMENT_LABELS[value] ?? value;
  }

  // ---------- Création / modification ----------

  openNew() {
    this.formError.set('');
    this.confirmDelete.set(false);
    this.draft.set({ ...EMPTY_DRAFT, name: this.search().trim() });
  }

  openEdit(exercise: ApiExercise) {
    this.formError.set('');
    this.confirmDelete.set(false);
    this.draft.set({
      id: exercise._id,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle ?? '',
      muscleGroups: this.secondary(exercise),
      equipment: exercise.equipment ?? 'bodyweight',
      videoUrl: exercise.videoUrl ?? '',
      imageUrl: exercise.imageUrl ?? '',
      instructions: exercise.instructions ?? '',
      isPublic: exercise.isPublic === true,
    });
  }

  closeDraft() {
    if (this.saving()) return;
    this.draft.set(null);
  }

  patch(changes: Partial<Draft>) {
    this.draft.update((draft) => (draft ? { ...draft, ...changes } : draft));
  }

  setPrimary(value: string) {
    this.draft.update((draft) => (draft ? { ...draft, primaryMuscle: value, muscleGroups: draft.muscleGroups.filter((group) => group !== value) } : draft));
  }

  toggleGroup(value: string) {
    this.draft.update((draft) => {
      if (!draft) return draft;
      const has = draft.muscleGroups.includes(value);
      return { ...draft, muscleGroups: has ? draft.muscleGroups.filter((group) => group !== value) : [...draft.muscleGroups, value] };
    });
  }

  upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.formError.set('');
    this.coach.uploadExerciseImage(file).subscribe({
      next: ({ url }) => {
        this.uploading.set(false);
        this.patch({ imageUrl: url });
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.formError.set(err instanceof ApiError ? err.message : 'Envoi de la photo impossible.');
      },
    });
  }

  save() {
    const draft = this.draft();
    if (!draft || !draft.name.trim()) return;
    const body: ApiExerciseInput = {
      name: draft.name.trim(),
      primaryMuscle: draft.primaryMuscle || undefined,
      // Le muscle principal compte aussi dans les groupes : c'est ce que filtre la recherche.
      muscleGroups: [...new Set([draft.primaryMuscle, ...draft.muscleGroups].filter(Boolean))],
      equipment: draft.equipment,
      videoUrl: draft.videoUrl.trim(),
      imageUrl: draft.imageUrl,
      instructions: draft.instructions.trim(),
      isPublic: draft.isPublic,
    };
    this.saving.set(true);
    this.formError.set('');
    const request = draft.id ? this.coach.updateExercise(draft.id, body) : this.coach.createExercise(body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
        this.toast.success(draft.id ? 'Exercice modifié.' : `« ${body.name} » ajouté à vos exercices.`);
        this.exercises.reload(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
      },
    });
  }

  remove(id: string) {
    this.saving.set(true);
    this.coach.deleteExercise(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
        this.toast.success('Exercice supprimé.');
        this.exercises.reload(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.confirmDelete.set(false);
        this.formError.set(err instanceof ApiError ? err.message : 'Suppression impossible.');
      },
    });
  }

  // ---------- Import ----------

  openImport() {
    this.formError.set('');
    this.importText.set('');
    this.importing.set(true);
  }

  runImport() {
    const rows = this.importRows();
    if (!rows.length) return;
    this.saving.set(true);
    this.formError.set('');
    this.coach
      .importExercises(rows.map(({ line, muscleLabel, equipmentLabel, ...exercise }) => exercise))
      .subscribe({
        next: ({ created, skipped }) => {
          this.saving.set(false);
          this.importing.set(false);
          this.origin.set('mine');
          const done = `${created} exercice${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}`;
          this.toast.success(skipped ? `${done}, ${skipped} déjà présent${skipped > 1 ? 's' : ''}.` : `${done}.`);
          this.exercises.reload(true);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.formError.set(err instanceof ApiError ? err.message : 'Import impossible.');
        },
      });
  }

  openSessions() {
    void this.router.navigate(['/coach/bibliotheque']);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
}
