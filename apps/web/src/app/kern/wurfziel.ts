import { Injectable, signal } from '@angular/core';

/**
 * **Auf welchem Artikel gewürfelt wird** (T-172). Die Artikelseite und die
 * Kurzansicht stellen ihn bereit; ein Würfelknopf darunter (`nw-text`)
 * schickt ihn mit, und der Wurf landet im Log dieses Artikels. Ohne
 * Anbieter würfelt der Knopf trotzdem am Server, nur ohne Artikel.
 */
@Injectable()
export class WurfZiel {
  /** Die Id des Artikels. */
  readonly id = signal<string | null>(null);
  /** Die laufende Sitzung, wenn der Ort sie kennt (Play). */
  readonly sitzung = signal<string | null>(null);
  /** Die Leitung würfelt auf dieser Seite verdeckt (Schalter im Log). */
  readonly verdeckt = signal(false);
}
