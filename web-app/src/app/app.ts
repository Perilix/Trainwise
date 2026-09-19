import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme.service';

@Component({
  selector: 'tw-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor() {
    // Instancie le service : il pose data-theme sur <html> et suit le réglage système.
    inject(ThemeService);
  }
}
