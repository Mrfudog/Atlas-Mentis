import { Component, computed, effect, inject, input } from '@angular/core';
import { entityName, enumRefKind, primaryInterface, statblockBook } from '@nw/model';
import type { Entity, StatblockBook } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Abschnitte } from './abschnitte';
import { Text } from './text';

/**
 * **Der Statblock wie im Monster Manual** (W2, Leitung 13.10.: „mache es
 * wie in D&D-Büchern"). Kopf mit Grösse, Typ und Gesinnung kursiv, rote
 * Linien, Rüstungsklasse, Trefferpunkte, Bewegung, die sechs Werte in einer
 * Reihe (am Telefon drei mal zwei), Rettungswürfe bis Herausforderung, dann
 * die Abschnitte aus `composedOf`.
 *
 * Was dasteht, baut `statblockBook` im Modell; gerechnet wird beim Lesen
 * (D8). Gezeichnet wird der Statblock, wo das Register das Element
 * `statblock` setzt — am Typ `Statblock`, nicht nach einem Artnamen hier.
 */
@Component({
  selector: 'nw-statblock',
  imports: [Text, Abschnitte],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <div class="linie" aria-hidden="true"></div>
      @if (b.top.length) {
        <div class="zeilen">
          @for (z of b.top; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
          }
        </div>
        <div class="linie" aria-hidden="true"></div>
      }
      <div class="werte" role="list" aria-label="Ability scores">
        @for (a of b.abilities; track a.key) {
          <div role="listitem">
            <div class="k">{{ a.label }}</div>
            <div>{{ a.score ?? '—' }} {{ a.mod }}</div>
          </div>
        }
      </div>
      <div class="linie" aria-hidden="true"></div>
      <div class="zeilen">
        @for (z of b.details; track z.label) {
          <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
        }
        @for (z of b.extra; track z.label) {
          <p class="zusatz"><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
        }
      </div>
      <div class="linie" aria-hidden="true"></div>
      <nw-abschnitte [besitzer]="artikel()" />
    }
  `,
  styleUrl: './buch.scss',
})
export class Statblock {
  readonly artikel = input.required<Entity>();

  private readonly bestand = inject(Bestand);

  /**
   * Die Namen in `proficient` und `expertise` und welche Art sie sind —
   * gesucht unter den Arten, aus denen das Feld seine Werte zieht
   * (`enumRef`), nicht in einer Liste hier.
   */
  private readonly uebungen = computed(() => {
    const r = this.bestand.registry();
    const e = this.artikel();
    const pr = (e.components?.['Proficiencies'] ?? {}) as Record<string, unknown>;
    const namen = [pr['proficient'], pr['expertise']].flatMap((v) => (Array.isArray(v) ? v.map(String) : []));
    const art = new Map<string, Entity>();
    if (!r || !namen.length) return art;
    const feld = r.interfaces['Proficiencies']?.schema?.properties?.['proficient'];
    const quellen = new Set(
      [feld?.enumRef ?? []].flat().filter((q) => enumRefKind(r, q) === 'type'),
    );
    const gesucht = new Set(namen.map((n) => n.toLowerCase()));
    for (const k of this.bestand.entities()) {
      const n = entityName(k).toLowerCase();
      if (gesucht.has(n) && quellen.has(primaryInterface(k)) && !art.has(n)) art.set(n, k);
    }
    return art;
  });

  constructor() {
    /* Worauf eine Fertigkeit rechnet, steht an ihrem Artikel — den holt,
       wer ihn braucht, mit den Teilen in einer Anfrage. */
    effect(() => {
      void this.bestand.holen([...this.uebungen().values()].map((k) => k.id));
    });
  }

  protected readonly buch = computed<StatblockBook | null>(() => {
    const r = this.bestand.registry();
    if (!r) return null;
    const uebungen = this.uebungen();
    const voll = this.bestand.voll();
    return statblockBook(r, this.artikel(), {
      kindOf: (n) => {
        const k = uebungen.get(n.toLowerCase());
        return k ? primaryInterface(k) : undefined;
      },
      skillAbility: (n) => {
        const k = uebungen.get(n.toLowerCase());
        const ganz = k ? voll.get(k.id) : undefined;
        const karte = ganz?.components?.[primaryInterface(ganz)] as Record<string, unknown> | undefined;
        return typeof karte?.['ability'] === 'string' ? karte['ability'] : undefined;
      },
    });
  });
}
