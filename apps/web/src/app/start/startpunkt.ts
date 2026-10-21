/**
 * **Der Start nach der Anmeldung** (T-342): Spielende landen auf dem
 * Kampagnenboard, wenn die Kampagne es sagt (`Campaign.playerStart`), alle
 * anderen im Kompendium wie bisher. Die Leitung behält ihren Start.
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Heim } from '../kern/heim';
import { Session } from '../kern/session';

export const startpunkt: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  const heim = inject(Heim);
  if (session.stand() === 'unbekannt') await session.load();
  if (!session.angemeldet()) return router.parseUrl('/compendium');
  const h = await heim.jetzt();
  return router.parseUrl(h?.land ?? '/compendium');
};
