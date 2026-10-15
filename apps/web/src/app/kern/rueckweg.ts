/**
 * **Zurück an dieselbe Stelle** (T-185): wer aus einer Liste einen Artikel
 * öffnet und zurückgeht, stand bisher oben auf der Seite — auf der
 * Kampagnenseite also wieder vor den Mitgliedern, siebzig Bücher über der
 * Gruppe, aus der er kam. Der Filter einer Liste bleibt schon (er gehört
 * der Seite, `ListenFilter`), und welche Gruppen offen sind, merkt sich das
 * Konto; was fehlte, ist der Scrollstand.
 *
 * Gemerkt wird je Eintrag im Verlauf (`navigationId`), nicht je Adresse:
 * dieselbe Seite zweimal im Verlauf sind zwei Stellen. Zurückgesetzt wird
 * nur bei „Zurück"/„Vorwärts" (`popstate`); ein Link verhält sich wie
 * bisher.
 *
 * Die Listen laden nach dem Navigieren; die Seite ist also erst kurz und
 * wächst. Darum wird gewartet, bis sie hoch genug ist (höchstens
 * `GEDULD` ms), und dann einmal gesprungen. Scrollt in der Zeit jemand
 * anders — die Person selbst oder eine Seite, die ihre eigene Stelle kennt
 * wie die Leseansicht —, bleibt es dabei: gegen eine Absicht wird nicht
 * gescrollt.
 */

import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/** So lange darf eine Liste brauchen, bis ihre Höhe steht. */
export const GEDULD = 4000;

/** Wie weit ein Ziel sein muss, um überhaupt zu warten — oben ist oben. */
const OBEN = 4;

@Injectable({ providedIn: 'root' })
export class Rueckweg {
  private readonly stellen = new Map<number, number>();
  private aktuell = 0;
  private abbruch: (() => void) | null = null;
  /** Bei „Zurück": der Verlaufseintrag, zu dem es geht. */
  private ziel: number | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const router = inject(Router);
    /* Der Browser stellt sonst selbst zurück — vor der Liste, also oben. */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const sub = router.events.subscribe((ev) => {
      if (ev instanceof NavigationStart) {
        this.abbruch?.();
        this.stellen.set(this.aktuell, window.scrollY);
        this.ziel = ev.navigationTrigger === 'popstate' ? (ev.restoredState?.navigationId ?? null) : null;
      } else if (ev instanceof NavigationEnd) {
        this.aktuell = ev.id;
        const y = this.ziel === null ? undefined : this.stellen.get(this.ziel);
        this.ziel = null;
        if (y !== undefined && y > OBEN) this.hin(y);
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Warten, bis die Seite `y` erreichen kann, dann dorthin — ausser jemand scrollt vorher. */
  private hin(y: number): void {
    const start = Date.now();
    const ausgang = window.scrollY;
    let uhr: ReturnType<typeof setTimeout> | undefined;
    const fertig = () => {
      clearTimeout(uhr);
      for (const t of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(t, fertig);
      this.abbruch = null;
    };
    for (const t of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(t, fertig, { passive: true });
    this.abbruch = fertig;
    const schritt = () => {
      /* Jemand anders hat schon gescrollt (die Leseansicht zu ihrem Abschnitt): dabei bleiben. */
      if (Math.abs(window.scrollY - ausgang) > OBEN) return fertig();
      const erreichbar = document.documentElement.scrollHeight - window.innerHeight;
      if (erreichbar >= y - OBEN || Date.now() - start > GEDULD) {
        window.scrollTo({ top: Math.min(y, Math.max(0, erreichbar)) });
        return fertig();
      }
      uhr = setTimeout(schritt, 50);
    };
    schritt();
  }
}
