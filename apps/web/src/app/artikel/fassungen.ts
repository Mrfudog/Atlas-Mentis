/**
 * **Fassungen an den Feldern** (T-092, E-021 d).
 *
 * Kein Umschalter zwischen 2014 und 2024: der Artikel im Spiel steht da,
 * und an jedem Feld, an dem eine andere Fassung etwas anderes sagt, steht
 * ihr Wert dabei — mit dem Kürzel ihrer Ebene, der volle Name im Tooltip.
 * Lange Texte stehen als aufklappbarer Vergleich. Was eine Fassung ist und
 * was sie anders sagt, rechnet das Modell (`versionDiff`); hier steht nur,
 * wie es gezeigt wird und was sich das Konto merkt.
 */

import { Component, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, fieldText, primaryInterface, unitsFor, versionDiff } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Api, type Fassung, type Fassungen } from '../kern/api';
import { anzeigeWert } from './felder';

/** Was sich das Konto merkt (`/api/me/prefs`, Schlüssel `versions`). */
export interface Lesart {
  /** Fassungen an den Feldern zeigen. */
  on: boolean;
  /** Diese Ebenen nicht vergleichen — eine neue Ebene ist so von selbst dabei. */
  off: string[];
}

const VORGABE: Lesart = { on: true, off: [] };
/** Ein Artikel ohne Ebenenkante — eine Ebene „keine". */
export const OHNE_EBENE = '∅';

/**
 * Die Lesart je Konto (T-092): einmal geholt, beim Ändern sofort hier und
 * dann am Server. Gemerkt am Konto und nicht im Browser — wer am Laptop
 * vorbereitet und am Tablet leitet, will denselben Stand.
 */
@Injectable({ providedIn: 'root' })
export class FassungsLesart {
  private readonly api = inject(Api);
  private readonly _stand = signal<Lesart>(VORGABE);
  private geholt: Promise<void> | null = null;
  readonly stand = this._stand.asReadonly();

  laden(): Promise<void> {
    this.geholt ??= this.api
      .prefs()
      .then((p) => {
        const v = p['versions'] as Partial<Lesart> | undefined;
        if (v && typeof v === 'object') {
          this._stand.set({
            on: v.on !== false,
            off: Array.isArray(v.off) ? v.off.filter((x): x is string => typeof x === 'string') : [],
          });
        }
      })
      .catch(() => {
        /* Ohne Antwort gilt die Vorgabe; das nächste Ändern schreibt sie. */
      });
    return this.geholt;
  }

  setze(neu: Partial<Lesart>): void {
    const s = { ...this._stand(), ...neu };
    this._stand.set(s);
    void this.api.setPref('versions', s).catch(() => undefined);
  }

  ebene(id: string, an: boolean): void {
    const off = new Set(this._stand().off);
    if (an) off.delete(id);
    else off.add(id);
    this.setze({ off: [...off] });
  }
}

/** Ein abweichender Wert an einem Feld. */
export interface Abweichung {
  /** Die Fassung, aus der er kommt. */
  id: string;
  /** Das Kürzel der Ebene (bei mehreren: die erste verglichene). */
  kuerzel: string;
  /** Für den Tooltip: Ebene und Name der Fassung. */
  titel: string;
  /** Der Wert als Text; leer heisst „dort leer". */
  text: string;
  lang: boolean;
  compare: boolean;
}

/** Was je Kantenart eine Fassung anders hat. */
export interface KantenAbweichung {
  type: string;
  kuerzel: string;
  titel: string;
  dazu: string[];
  weg: string[];
  compare: boolean;
}

/** Die Fassungen, die nach der Lesart verglichen werden, je mit ihren Ebenen. */
export function verglichene(
  f: Fassungen | null,
  lesart: Lesart,
): { v: Fassung; ebene: { id: string; short: string; name: string } }[] {
  if (!f || !lesart.on) return [];
  const aus = new Set(lesart.off);
  const ebenen = new Map(f.layers.map((l) => [l.id, l]));
  const out: { v: Fassung; ebene: { id: string; short: string; name: string } }[] = [];
  for (const v of f.versions) {
    const ids = v.layers.length ? v.layers : [OHNE_EBENE];
    const an = ids.find((id) => !aus.has(id));
    if (!an) continue;
    const l = ebenen.get(an);
    out.push({
      v,
      ebene: l
        ? { id: l.id, short: l.short, name: l.name }
        : { id: an, short: an === OHNE_EBENE ? '—' : '?', name: an === OHNE_EBENE ? 'No layer' : 'Another layer' },
    });
  }
  return out;
}

/**
 * **Je Feld die abweichenden Werte** (`Typ.feld` → Liste), und je
 * Kantenart, was eine Fassung dazu oder nicht hat. Gerechnet über das
 * Modell (`versionDiff`); der Text wie in der Feldtabelle.
 */
export function abweichungen(
  r: Registry,
  basis: Entity,
  vergleich: ReturnType<typeof verglichene>,
  name: (id: string) => string | undefined,
): { felder: Map<string, Abweichung[]>; kanten: KantenAbweichung[] } {
  const felder = new Map<string, Abweichung[]>();
  const kanten: KantenAbweichung[] = [];
  const mode = unitsFor(r, primaryInterface(basis));
  for (const { v, ebene } of vergleich) {
    const d = versionDiff(r, basis, v.entity);
    const titel = `${ebene.name} — ${entityName(v.entity)}${v.compare ? ' (compare layer, not in play)' : ''}`;
    for (const f of d.fields) {
      const schema = r.interfaces[f.type]?.schema?.properties?.[f.key];
      const wert = f.value;
      let text = '';
      if (wert !== undefined) {
        if (schema?.format === 'link') {
          text = [wert].flat().map((x) => name(String(x)) ?? '(not here)').join(', ');
        } else if (typeof wert === 'object') {
          text = anzeigeWert(wert);
        } else {
          text = fieldText(r, schema, wert, mode) || String(wert);
        }
      }
      const liste = felder.get(f.ref) ?? [];
      liste.push({ id: v.entity.id, kuerzel: ebene.short, titel, text, lang: f.long, compare: v.compare });
      felder.set(f.ref, liste);
    }
    for (const k of d.relations) {
      const n = (id: string) => name(id) ?? '(not in play)';
      kanten.push({
        type: k.type,
        kuerzel: ebene.short,
        titel,
        dazu: k.only.map(n),
        weg: k.missing.map(n),
        compare: v.compare,
      });
    }
  }
  return { felder, kanten };
}

/**
 * **Der Kasten „Versions" in der Seitenspalte** (T-092): ein-/ausschalten,
 * welche Ebenen verglichen werden, die Fassungen selbst — und für die
 * Leitung „use this in my campaign" an einer Fassung aus einer
 * Vergleichsebene, rückgängig an derselben Stelle.
 */
@Component({
  selector: 'nw-fassungen',
  imports: [RouterLink],
  template: `
    @if (fassungen(); as f) {
      @if (f.versions.length) {
        <section class="kasten fassungen" aria-label="Versions">
          <h2>Versions</h2>
          <label class="schalter">
            <input type="checkbox" [checked]="lesart.stand().on" (change)="an($event)" />
            <span>Show where other versions differ</span>
          </label>
          @if (lesart.stand().on && ebenen().length > 1) {
            <fieldset class="ebenen">
              <legend>Compare with</legend>
              @for (l of ebenen(); track l.id) {
                <label [title]="l.name">
                  <input type="checkbox" [checked]="!aus().has(l.id)" (change)="ebene(l.id, $event)" />
                  <span class="kuerzel" [class.vergleich]="l.compare">{{ l.short }}</span>
                  <span class="dim">{{ l.name }}</span>
                </label>
              }
            </fieldset>
          }
          <ul class="kanten">
            @for (v of f.versions; track v.entity.id) {
              <li>
                <span class="rl">
                  @for (l of v.layers; track l) {
                    <span class="kuerzel" [class.vergleich]="v.compare" [title]="ebenenName(l)">{{ kurz(l) }}</span>
                  } @empty {
                    <span class="kuerzel">—</span>
                  }
                </span>
                <a [routerLink]="['/artikel', v.entity.id]">{{ name(v.entity) }}</a>
                @if (v.compare) {
                  <span class="dim">compare</span>
                }
                @if (v.adoptable && f.campaign) {
                  <button type="button" class="klein" [disabled]="laeuft()" (click)="uebernehmen(v)">
                    Use this in my campaign
                  </button>
                }
                @if (v.adoptedAs && f.campaign) {
                  <span class="dim">in use in this campaign</span>
                  <button type="button" class="klein" [disabled]="laeuft()" (click)="zuruecknehmen(v)">Undo</button>
                }
              </li>
            }
          </ul>
          @if (fehler(); as e) {
            <p class="fehler" role="alert">{{ e }}</p>
          }
        </section>
      }
    }
  `,
  styles: `
    /* Wie die übrigen Kästen der Seitenspalte (artikel.scss). */
    .kasten {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .kasten h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.1rem;
      color: var(--accent);
    }
    .kanten {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .kanten li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem 0.6rem;
      align-items: center;
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--line2);
    }
    .kanten li:last-child {
      border-bottom: 0;
    }
    .rl {
      display: inline-flex;
      gap: 0.25rem;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
    }
    .kuerzel {
      font-family: var(--sans);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 0 0.35rem;
      border: 1px solid var(--line);
      border-radius: 3px;
      color: var(--dim);
      white-space: nowrap;
    }
    .kuerzel.vergleich {
      border-style: dashed;
    }
    .schalter,
    .ebenen label {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 36px;
    }
    .ebenen {
      margin: 0;
      padding: 0.25rem 0 0;
      border: 0;
      border-top: 1px solid var(--line2);
    }
    .ebenen legend {
      padding: 0;
      font-size: 0.8rem;
      color: var(--dim);
    }
    .ebenen .dim {
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    .klein {
      font-size: 0.8rem;
      padding: 0.15rem 0.6rem;
      min-height: 32px;
    }
  `,
})
export class FassungsKasten {
  readonly artikel = input.required<string>();
  readonly fassungen = input<Fassungen | null>(null);
  /** Nach dem Übernehmen oder Zurücknehmen: der Artikel, der jetzt gilt. */
  readonly gewechselt = output<string>();

  protected readonly lesart = inject(FassungsLesart);
  private readonly api = inject(Api);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);

  protected readonly aus = computed(() => new Set(this.lesart.stand().off));
  /** Die Ebenen, aus denen hier Fassungen kommen. */
  protected readonly ebenen = computed(() => {
    const f = this.fassungen();
    if (!f) return [];
    const da = new Set(f.versions.flatMap((v) => (v.layers.length ? v.layers : [OHNE_EBENE])));
    const l = f.layers.filter((x) => da.has(x.id));
    if (da.has(OHNE_EBENE)) l.push({ id: OHNE_EBENE, name: 'No layer', short: '—', compare: false, play: true });
    return l;
  });

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected kurz(id: string): string {
    return this.fassungen()?.layers.find((l) => l.id === id)?.short ?? '?';
  }
  protected ebenenName(id: string): string {
    return this.fassungen()?.layers.find((l) => l.id === id)?.name ?? '';
  }

  protected an(ev: Event): void {
    this.lesart.setze({ on: (ev.target as HTMLInputElement).checked });
  }
  protected ebene(id: string, ev: Event): void {
    this.lesart.ebene(id, (ev.target as HTMLInputElement).checked);
  }

  protected async uebernehmen(v: Fassung): Promise<void> {
    const c = this.fassungen()?.campaign;
    if (!c) return;
    await this.tun(async () => {
      const kopie = await this.api.adopt(c.id, v.entity.id, this.artikel());
      this.gewechselt.emit(kopie.id);
    });
  }

  protected async zuruecknehmen(v: Fassung): Promise<void> {
    const c = this.fassungen()?.campaign;
    if (!c || !v.adoptedAs) return;
    await this.tun(async () => {
      const r = await this.api.unadopt(c.id, v.adoptedAs!);
      this.gewechselt.emit(r.over ?? v.entity.id);
    });
  }

  private async tun(was: () => Promise<void>): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await was();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}
