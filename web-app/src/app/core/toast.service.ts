import { Injectable, signal } from '@angular/core';

export type Toast = { id: number; kind: 'success' | 'error'; message: string };

/**
 * Petits messages de confirmation, en bas de l'écran (« Séance planifiée le 2 oct. »).
 * Ils disparaissent seuls ; l'affichage vit dans le cadre de l'app (ToastHostComponent).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private next = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string) {
    this.push('success', message);
  }

  error(message: string) {
    this.push('error', message);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private push(kind: Toast['kind'], message: string) {
    const id = this.next++;
    // Trois au plus : au-delà, les plus anciens n'apprennent plus rien.
    this.toasts.update((list) => [...list.slice(-2), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
  }
}
