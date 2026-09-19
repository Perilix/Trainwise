import { DestroyRef, ElementRef, inject, signal } from '@angular/core';

/**
 * Largeur réelle du composant, suivie au redimensionnement. Les graphiques SVG
 * dessinent en pixels : sans mesure, ils gardaient une largeur fixe et laissaient
 * le reste de la carte vide sur un écran large. Un `[width]` explicite reste
 * prioritaire (voir les composants qui l'utilisent).
 */
export function hostWidth(fallback: number) {
  const host = inject(ElementRef).nativeElement as HTMLElement;
  const width = signal(fallback);

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) width.set(measured);
    });
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  return width.asReadonly();
}
