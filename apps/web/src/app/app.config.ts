import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    /* `withComponentInputBinding`: der Pfadteil `:id` kommt als Eingabe
       `id` an der Artikelseite an. Ohne es blieb `input.required()` leer,
       Angular warf NG0950, und die Seite stand weiss da — gemerkt erst auf
       dev, weil kein Test die Route samt Router aufbaute. */
    provideRouter(routes, withComponentInputBinding()),
  ],
};
