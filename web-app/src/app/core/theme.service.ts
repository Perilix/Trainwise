import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'trainwise.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStored());
  /** Thème réellement appliqué, une fois « système » résolu. */
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor() {
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    media?.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });
    effect(() => {
      const mode = this.mode();
      try {
        localStorage.setItem(KEY, mode);
      } catch {
        /* stockage indisponible : le thème ne sera pas retenu */
      }
      this.apply();
    });
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
  }

  toggle() {
    this.mode.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply() {
    const mode = this.mode();
    const dark =
      mode === 'dark' ||
      (mode === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
    this.resolved.set(dark ? 'dark' : 'light');
    const root = document.documentElement;
    if (dark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }
}

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : 'system';
  } catch {
    return 'system';
  }
}
