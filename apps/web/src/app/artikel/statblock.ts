import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { entityName, enumRefKind, primaryInterface, statblockBook } from '@nw/model';
import type { Entity, StatblockBook } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { BegriffLink, Glossar } from '../kern/glossar';
import { Abschnitte } from './abschnitte';
import { AbwMarken, zeilenVergleich, type Abweichung, type Vergleichsfassung } from './fassungen';
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
  imports: [Text, Abschnitte, AbwMarken, BegriffLink],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <nw-abw [liste]="an(KOPF)" />
      <div class="linie" aria-hidden="true"></div>
      @if (b.top.length) {
        <div class="zeilen">
          @for (z of b.top; track z.label) {
            <p><strong [nwBegriff]="feldBegriff(z.ref)">{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
        </div>
        <div class="linie" aria-hidden="true"></div>
      }
      <div class="werte" role="list" aria-label="Ability scores">
        @for (a of b.abilities; track a.key) {
          <div role="listitem">
            <div class="k">{{ a.label }}</div>
            <div>{{ a.score ?? '—' }} @if (a.check) {<span class="probe">(<nw-text inline [text]="wuerfel(a.check.expr)" [wurfLabel]="a.check.label" />)</span>} @else {<span>{{ a.mod }}</span>}</div>
            <nw-abw [liste]="an(a.label)" />
          </div>
        }
      </div>
      <div class="linie" aria-hidden="true"></div>
      <div class="zeilen">
        @for (z of b.details; track z.label) {
          <p>
            <strong [nwBegriff]="feldBegriff(z.ref)">{{ z.label }}</strong>
            <!-- Fertigkeiten und Rettungswürfe würfeln (T-181): je Eintrag ein Knopf, beschriftet im Log. -->
            @if (z.rolls?.length) {
              @for (w of z.rolls; track w.label; let letzte = $last) {
                <span class="wurfteil">{{ w.name }} <nw-text inline [text]="wuerfel(w.expr)" [wurfLabel]="w.label" />{{ letzte ? '' : ',' }}</span>
              }
            } @else {
              <nw-text inline [text]="z.text" />
            }
            <nw-abw [liste]="an(z.label)" />
          </p>
        }
        @for (z of b.extra; track z.label) {
          <p class="zusatz"><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
        }
        <!-- Zeilen, die nur eine andere Fassung hat (T-103): „hier —". -->
        @for (z of vgl().nurDort; track z.label) {
          <p class="zusatz leer"><strong>{{ z.label }}</strong> —<nw-abw [liste]="z.abw" /></p>
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
  /** Die verglichenen Fassungen (T-103): an jeder Zeile steht, was sie anders sagen. */
  readonly fassungen = input<readonly Vergleichsfassung[]>([]);

  private readonly bestand = inject(Bestand);
  private readonly glossar = inject(Glossar);
  /** Der Glossareintrag, den das Feld einer Zeile nennt (`glossary`, T-347):
   *  „Armor Class" gepunktet, mit seiner Definition als Titel. */
  protected feldBegriff(ref: string | undefined): string | null {
    return this.glossar.feld(this.bestand.registry(), ref);
  }
  /** Die Zeile unter dem Namen — Grösse, Art, Gesinnung. */
  protected readonly KOPF = 'byline';

  /** Die Namen in `proficient` und `expertise`. */
  private readonly uebungsNamen = computed(() => {
    const pr = (this.artikel().components?.['Proficiencies'] ?? {}) as Record<string, unknown>;
    return [pr['proficient'], pr['expertise']].flatMap((v) => (Array.isArray(v) ? v.map(String) : []));
  });

  /**
   * Die Arten, aus denen das Feld seine Werte zieht (`enumRef`) und die
   * Artikel sind — gesucht wird dort, nicht in einer Liste hier.
   */
  private readonly quellen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const feld = r.interfaces['Proficiencies']?.schema?.properties?.['proficient'];
    return [feld?.enumRef ?? []].flat().filter((q) => enumRefKind(r, q) === 'type');
  });

  /**
   * Die Übungen als Artikel und welche Art sie sind. Der Browser hält keinen
   * Bestand (W7): je Name fragt die Liste am Server, eingeschränkt auf die
   * Quellarten, und ihre Zeilen landen in `kurz`.
   */
  private readonly uebungen = computed(() => {
    const quellen = new Set(this.quellen());
    const gesucht = new Set(this.uebungsNamen().map((n) => n.toLowerCase()));
    const art = new Map<string, Entity>();
    if (!gesucht.size) return art;
    for (const k of this.bestand.kurz().values()) {
      const n = entityName(k).toLowerCase();
      if (gesucht.has(n) && quellen.has(primaryInterface(k)) && !art.has(n)) art.set(n, k);
    }
    return art;
  });

  /** Was zuletzt gefragt wurde — kommt derselbe Artikel neu (Live, Speichern), fragt er nicht noch einmal. */
  private gefragt = '';

  constructor() {
    /* **Eine Frage für alle Übungen** (T-398): je Name eine Suche waren bei
       einer Figur mit vierzig Übungen vierzig Abrufe, die sich am Server
       stauten — und jede Antwort änderte `kurz` und holte erneut. */
    effect(() => {
      const namen = [...new Set(this.uebungsNamen())];
      const of = this.quellen();
      if (!namen.length || !of.length) return;
      const schluessel = `${of.join(',')}|${namen.join('\n')}`;
      if (schluessel === this.gefragt) return;
      this.gefragt = schluessel;
      untracked(() => void this.bestand.liste({ of, name: namen, limit: 200 }).catch(() => undefined));
    });
    /* Worauf eine Fertigkeit rechnet, steht an ihrem Artikel — den holt,
       wer ihn braucht, mit den Teilen in einer Anfrage. */
    effect(() => {
      void this.bestand.holen([...this.uebungen().values()].map((k) => k.id));
    });
    /* Die Zustandsimmunitäten sind Verweise (T-078). Am eigenen Artikel
       bringt `refs` ihre Namen mit; ein Statblock, der an einer Kreatur
       steht, kam ohne — dann holt er die Zustände selbst. */
    effect(() => {
      const sb = this.artikel().components?.['Statblock'] as Record<string, unknown> | undefined;
      const ids = Array.isArray(sb?.['conditionImmunities']) ? (sb['conditionImmunities'] as unknown[]) : [];
      const name = this.bestand.name();
      const offen = ids.filter((id): id is string => typeof id === 'string' && !name(id));
      if (offen.length) untracked(() => void this.bestand.holen(offen));
    });
  }

  protected readonly buch = computed<StatblockBook | null>(() => this.bauen(this.artikel()));

  private bauen(artikel: Entity): StatblockBook | null {
    const r = this.bestand.registry();
    if (!r) return null;
    const uebungen = this.uebungen();
    const voll = this.bestand.voll();
    const name = this.bestand.name();
    return statblockBook(r, artikel, {
      nameOf: (id) => name(id),
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
  }

  /**
   * **Die Zeilen gegen die der Fassungen** (T-103): verglichen wird, was
   * dasteht — dieselbe Rechnung für beide, nach Beschriftung.
   */
  protected readonly vgl = computed(() => {
    const b = this.buch();
    const zeilen = (x: StatblockBook) => [
      { label: this.KOPF, text: x.byline },
      ...x.top,
      ...x.abilities.map((a) => ({ label: a.label, text: `${a.score ?? '—'} ${a.mod}` })),
      ...x.details,
      ...x.extra,
    ];
    const andere = this.fassungen().flatMap((f) => {
      const o = this.bauen(f.entity);
      return o ? [{ f, zeilen: zeilen(o) }] : [];
    });
    return zeilenVergleich(b ? zeilen(b) : [], andere);
  });

  /** Ein Wurf als Text (`{{+6}}`, M12) — so zeichnet ihn `nw-text` als Knopf. */
  protected wuerfel(expr: string): string {
    return `{{${expr}}}`;
  }

  protected an(label: string): Abweichung[] {
    return this.vgl().an.get(label.trim().toLowerCase()) ?? [];
  }
}
