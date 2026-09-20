/**
 * Die Wache vor den Routen.
 *
 * Sie wartet, bis die Sitzung **gefragt** wurde — sonst schickte sie beim
 * Neuladen jeden einmal kurz auf die Anmeldemaske, und wer das sieht,
 * traut der Anmeldung nicht mehr.
 *
 * Sie ist Bequemlichkeit, keine Sicherheit: die Rechte hängen am Server,
 * und eine Route, die nur hier bewacht wäre, wäre gar nicht bewacht.
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Session } from './session';

export const wache: CanActivateFn = async (_route, state) => {
  const session = inject(Session);
  const router = inject(Router);
  if (session.stand() === 'unbekannt') await session.load();
  if (session.angemeldet()) return true;
  return router.createUrlTree(['/login'], { queryParams: { weiter: state.url } });
};
