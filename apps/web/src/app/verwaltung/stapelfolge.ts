import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { KurzLink } from '../kern/kurzansicht';
import type { KampagnenEbene, Stapeltreffer } from '../kern/api';

/** Eine Zeile der Reihenfolge (T-188): eine ausdrücklich aufgeschaltete Ebene oder ein Mitglied, das ihre Gruppe bringt. */
export interface FolgeZeile {
  ebene: KampagnenEbene;
  /** Platz von oben, 1 gewinnt; Mitglieder tragen den Platz ihrer Gruppe. */
  platz: number;
  /** Bringt sie eine Gruppe, deren Id (die ausdrücklich aufgeschaltete); sonst steht sie selbst im Stapel. */
  ueber?: string;
  /** Verschachtelungstiefe unter der Gruppe. */
  tiefe: number;
  /** Steht ausdrücklich da, obwohl eine aufgeschaltete Gruppe sie brächte — herausgelöst. */
  herausgeloest?: string;
}

/**
 * **Die Zeilen der Reihenfolge, von oben nach unten** (T-188): die
 * ausdrücklich aufgeschalteten Ebenen, die oberste zuerst; unter einer
 * Gruppe, was sie bringt — verschachtelt, das Neuere oben, wie
 * `resolvedStack` es rechnet. Was selbst im Stapel steht (herausgelöst)
 * oder abgeschaltet ist, steht nicht unter der Gruppe.
 */
export function folgeZeilen(layers: readonly KampagnenEbene[]): FolgeZeile[] {
  const m = new Map(layers.map((x) => [x.id, x]));
  const stapel = layers.filter((x) => x.active);
  const ausdruecklich = new Set(stapel.map((x) => x.id));
  const out: FolgeZeile[] = [];
  [...stapel].reverse().forEach((l, i) => {
    const gruppe = l.groups.map((g) => m.get(g)).find((g) => g?.inPlay && g.kind === 'group');
    out.push({ ebene: l, platz: i + 1, tiefe: 0, ...(gruppe ? { herausgeloest: gruppe.id } : {}) });
    if (l.kind !== 'group') return;
    const gesehen = new Set<string>([l.id]);
    const lauf = (g: KampagnenEbene, tiefe: number) => {
      /* Die Mitglieder kommen nach Erscheinen, das neuere höher — oben zuerst also rückwärts. */
      for (const id of [...(g.members ?? [])].reverse()) {
        const x = m.get(id);
        if (!x || gesehen.has(id) || ausdruecklich.has(id) || x.off || !x.inPlay) continue;
        gesehen.add(id);
        out.push({ ebene: x, platz: i + 1, ueber: l.id, tiefe });
        if (x.kind === 'group') lauf(x, tiefe + 1);
      }
    };
    lauf(l, 1);
  });
  return out;
}

/**
 * **Eine Ebene an eine Stelle setzen** (T-188): `stapel` von unten nach
 * oben, wie der Server ihn will; `platz` von oben gezählt, 0 ganz oben —
 * die Lücke, in die sie fällt, gezählt ohne sie selbst. Steht sie noch nicht
 * im Stapel (ein Mitglied, das herausgelöst wird), kommt sie dazu.
 */
export function verschoben(stapel: readonly string[], id: string, platz: number): string[] {
  const oben = [...stapel].reverse().filter((x) => x !== id);
  oben.splice(Math.max(0, Math.min(platz, oben.length)), 0, id);
  return oben.reverse();
}

/**
 * **Herauslösen** (T-188): ein Mitglied bekommt seine eigene Stelle, gleich
 * über der Gruppe, die es brachte — es gilt danach vor allem in der Gruppe.
 */
export function herausgeloest(stapel: readonly string[], id: string, gruppe: string): string[] {
  const oben = [...stapel].reverse();
  const bei = oben.indexOf(gruppe);
  return verschoben(stapel, id, bei < 0 ? 0 : bei);
}

/** „replaces 12 articles of PHB" — ein Treffer als Satz (T-188). */
export function trefferText(t: Stapeltreffer, seite: 'wins' | 'loses'): string {
  const art = t.n === 1 ? 'article' : 'articles';
  if (seite === 'wins') return t.how === 'version' ? `replaces ${t.n} ${art} of ${t.name}` : `takes out ${t.n} ${art} of ${t.name}`;
  return t.how === 'version'
    ? `${t.n} ${t.n === 1 ? 'version loses' : 'versions lose'} to ${t.name}`
    : `${t.n} ${t.n === 1 ? 'take-out loses' : 'take-outs lose'} to ${t.name}`;
}

/** Wie viele Treffer eine Zeile ausschreibt; der Rest steht im Titel. */
const SICHTBAR = 2;

/**
 * **Die Reihenfolge im Spiel** (T-188, REQ der Leitung vom 15.10.): der
 * Stapel als Liste mit deutlicher Richtung — oben gewinnt, mit Platz und
 * „wins ↑ / loses ↓" an den Enden —, und je Ebene, was das bewirkt: welche
 * Fassungen sie ersetzt und gegen wen sie verliert (`stackOutcomes`, am
 * Server gerechnet).
 *
 * **Ziehen** mit Maus und Finger (Pointer Events, ein Griff je Zeile),
 * dazu ↑/↓ für die Tastatur. Eine Gruppe ist eine Zeile und zieht ihre
 * Bücher als Block mit; was sie bringt, steht eingerückt darunter.
 * **Herauslösen:** ein Buch aus der Gruppe ziehen oder „Own place" — es
 * bekommt eine eigene Kante `activates` und damit seine Stelle (die
 * ausdrückliche Kante schlägt die Gruppe). **Zurück:** „Back into …"
 * nimmt diese Kante wieder weg.
 *
 * Geschrieben wird nichts hier: `order` gibt den neuen Stapel von unten
 * nach oben, die Liste der Ebenen schreibt ihn (`PUT …/layers`).
 */
@Component({
  selector: 'nw-stapelfolge',
  imports: [KurzLink],
  template: `
    <p class="richtung" aria-hidden="true"><span class="pfeil">▲</span> wins — the higher layer counts</p>
    <ol class="folge" [class.zieht]="!!zug()" aria-label="Order in play, top wins">
      @for (z of zeilen(); track z.ebene.id; let k = $index) {
        @if (zug() && luecke() === lueckeVor(k) && z.tiefe === 0) {
          <li class="marke" aria-hidden="true"></li>
        }
        <li
          class="zeile"
          [class.mitglied]="!!z.ueber"
          [class.gezogen]="zug()?.id === z.ebene.id"
          [style.--tiefe]="z.tiefe"
          [attr.data-oben]="z.ueber ? null : obenIndex(z)"
        >
          @if (!z.ueber) {
            <span class="platz" [attr.aria-label]="'Place ' + z.platz">{{ z.platz }}</span>
          } @else {
            <span class="platz leer" aria-hidden="true">·</span>
          }
          @if (darf()) {
            <button
              type="button"
              class="griff"
              [disabled]="busy()"
              [attr.aria-label]="(z.ueber ? 'Drag ' + z.ebene.name + ' out of its group' : 'Drag ' + z.ebene.name) + '; arrow keys move it'"
              (pointerdown)="greifen($event, z)"
              (keydown)="taste($event, z)"
            >
              ⠿
            </button>
          }
          <span class="text">
            <span class="name">
              {{ z.ebene.name }}
              <button type="button" class="quick-info" [nwQuick]="z.ebene.id" [attr.aria-label]="'Quick view of ' + z.ebene.name">i</button>
            </span>
            <span class="dim">
              {{ z.ebene.kind === 'group' ? 'group · ' + mitglieder(z) + ' brought' : z.ebene.kind || 'layer' }}
              @if (z.ueber) {
                · from {{ name(z.ueber) }}
              }
              @if (z.herausgeloest) {
                · own place, out of {{ name(z.herausgeloest) }}
              }
            </span>
            @if (z.ebene.wins?.length || z.ebene.loses?.length) {
              <span class="folgen" [title]="alleTreffer(z.ebene)">
                @for (t of (z.ebene.wins ?? []).slice(0, sichtbar); track t.layer + t.how) {
                  <span class="gewinnt">↧ {{ treffer(t, 'wins') }}</span>
                }
                @for (t of (z.ebene.loses ?? []).slice(0, sichtbar); track t.layer + t.how) {
                  <span class="verliert">↥ {{ treffer(t, 'loses') }}</span>
                }
                @if (mehr(z.ebene); as n) {
                  <span class="dim">+{{ n }} more</span>
                }
              </span>
            }
          </span>
          @if (darf()) {
            <span class="knoepfe">
              @if (z.ueber) {
                <button type="button" class="klein wort" [disabled]="busy()" (click)="eigeneStelle(z)">Own place</button>
              } @else {
                @if (z.herausgeloest) {
                  <button type="button" class="klein wort" [disabled]="busy()" (click)="zurueck(z)">Back into {{ name(z.herausgeloest) }}</button>
                }
                <button type="button" class="klein" [disabled]="busy() || z.platz === 1" [attr.aria-label]="'Move ' + z.ebene.name + ' up'" (click)="um(z, -1)">↑</button>
                <button type="button" class="klein" [disabled]="busy() || z.platz === anzahl()" [attr.aria-label]="'Move ' + z.ebene.name + ' down'" (click)="um(z, 1)">↓</button>
              }
            </span>
          }
        </li>
      } @empty {
        <li class="dim">No layer is in play — everything without a layer is.</li>
      }
      @if (zug() && luecke() === anzahl()) {
        <li class="marke" aria-hidden="true"></li>
      }
    </ol>
    <p class="richtung" aria-hidden="true"><span class="pfeil">▼</span> loses</p>
    <p class="fuss">
      Where two layers bring a version of the same article, the higher one counts; a layer that takes an article out
      wins only over the layers below it. A group moves as one block — drag a book out of it to give the book its own place.
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    .richtung {
      margin: 0.25rem 0;
      font-family: var(--caps);
      font-size: 0.85rem;
      color: var(--dim);
    }
    .pfeil {
      color: var(--accent);
    }
    .folge {
      list-style: none;
      margin: 0;
      padding: 0 0 0 0.6rem;
      border-left: 3px solid var(--accent);
    }
    .zeile {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.35rem 0;
      border-top: 1px solid var(--line2);
    }
    .zeile.mitglied {
      padding-left: calc(1.25rem * var(--tiefe, 1));
      font-size: 0.95em;
    }
    .zeile.gezogen {
      opacity: 0.45;
    }
    .marke {
      height: 0;
      border-top: 3px solid var(--accent);
      margin: -1px 0;
    }
    .platz {
      flex: 0 0 auto;
      min-width: 1.8rem;
      height: 1.8rem;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--accent);
      color: var(--surface);
      font-weight: 700;
      font-size: 0.9rem;
    }
    .platz.leer {
      background: none;
      color: var(--dim);
    }
    .griff {
      flex: 0 0 auto;
      min-width: 36px;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      cursor: grab;
      touch-action: none;
      font-size: 1.1rem;
      line-height: 1;
    }
    .zieht .griff {
      cursor: grabbing;
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1 1 10rem;
    }
    .name {
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .dim {
      color: var(--dim);
    }
    .folgen {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.75rem;
      font-size: 0.9em;
    }
    .gewinnt {
      color: var(--accent);
    }
    .verliert {
      color: var(--warn);
    }
    .knoepfe {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-left: auto;
      justify-content: flex-end;
    }
    .klein {
      min-width: 40px;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    .klein.wort {
      padding: 0 0.5rem;
    }
    .klein[disabled],
    .griff[disabled] {
      opacity: 0.4;
      cursor: default;
    }
    .fuss {
      color: var(--dim);
      font-size: 0.9em;
    }
    .quick-info {
      margin-left: 0.25rem;
    }
  `,
})
export class Stapelfolge {
  /** Die Ebenen, wie `GET …/layers` sie schickt: die aufgeschalteten von unten nach oben vorn. */
  readonly layers = input.required<KampagnenEbene[]>();
  /** Darf ordnen (Verwaltung, Leitung). */
  readonly darf = input(false);
  readonly busy = input(false);
  /** Der neue Stapel, von unten nach oben. */
  readonly order = output<string[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly sichtbar = SICHTBAR;
  protected readonly zeilen = computed(() => folgeZeilen(this.layers()));
  private readonly nachId = computed(() => new Map(this.layers().map((x) => [x.id, x])));
  private readonly stapel = computed(() => this.layers().filter((x) => x.active).map((x) => x.id));
  protected readonly anzahl = computed(() => this.stapel().length);

  /** Was gerade gezogen wird, und in welche Lücke (von oben, 0 ganz oben) es fiele. */
  protected readonly zug = signal<{ id: string; zeile: FolgeZeile } | null>(null);
  protected readonly luecke = signal(0);

  protected name(id: string): string {
    return this.nachId().get(id)?.name ?? id;
  }

  protected treffer(t: Stapeltreffer, seite: 'wins' | 'loses'): string {
    return trefferText(t, seite);
  }

  protected alleTreffer(l: KampagnenEbene): string {
    return [...(l.wins ?? []).map((t) => trefferText(t, 'wins')), ...(l.loses ?? []).map((t) => trefferText(t, 'loses'))].join('\n');
  }

  protected mehr(l: KampagnenEbene): number {
    return Math.max(0, (l.wins?.length ?? 0) - SICHTBAR) + Math.max(0, (l.loses?.length ?? 0) - SICHTBAR);
  }

  protected mitglieder(z: FolgeZeile): number {
    return this.zeilen().filter((x) => x.ueber === z.ebene.id).length;
  }

  /** Der Index einer ausdrücklichen Zeile von oben (0 ganz oben). */
  protected obenIndex(z: FolgeZeile): number {
    return z.platz - 1;
  }

  /** Die Lücke vor der k-ten Zeile: wie viele ausdrückliche Zeilen davor stehen. */
  protected lueckeVor(k: number): number {
    return this.zeilen()
      .slice(0, k)
      .filter((x) => !x.ueber).length;
  }

  protected um(z: FolgeZeile, richtung: -1 | 1): void {
    const ziel = z.platz - 1 + richtung;
    if (ziel < 0 || ziel >= this.anzahl()) return;
    this.order.emit(verschoben(this.stapel(), z.ebene.id, ziel));
  }

  protected eigeneStelle(z: FolgeZeile): void {
    if (z.ueber) this.order.emit(herausgeloest(this.stapel(), z.ebene.id, z.ueber));
  }

  protected zurueck(z: FolgeZeile): void {
    this.order.emit(this.stapel().filter((id) => id !== z.ebene.id));
  }

  protected taste(ev: KeyboardEvent, z: FolgeZeile): void {
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    if (z.ueber) {
      this.eigeneStelle(z);
      return;
    }
    this.um(z, ev.key === 'ArrowUp' ? -1 : 1);
  }

  /**
   * Ziehen mit Maus und Finger: der Griff fängt den Zeiger, jede Bewegung
   * rechnet die Lücke aus den Mitten der ausdrücklichen Zeilen, Loslassen
   * schreibt. Ein Mitglied, das man zieht, wird dabei herausgelöst.
   */
  protected greifen(ev: PointerEvent, z: FolgeZeile): void {
    if (this.busy() || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault();
    const griff = ev.currentTarget as HTMLElement;
    griff.setPointerCapture?.(ev.pointerId);
    this.zug.set({ id: z.ebene.id, zeile: z });
    this.luecke.set(z.ueber ? this.lueckeAus(ev.clientY) : z.platz - 1);
    const bewegen = (e: PointerEvent) => this.luecke.set(this.lueckeAus(e.clientY));
    const ende = (e: PointerEvent) => {
      griff.removeEventListener('pointermove', bewegen);
      griff.removeEventListener('pointerup', ende);
      griff.removeEventListener('pointercancel', ende);
      const zug = this.zug();
      this.zug.set(null);
      if (!zug || e.type === 'pointercancel') return;
      const luecke = this.lueckeAus(e.clientY);
      /* Die Lücke zählt mit der gezogenen Zeile; ohne sie rückt alles darunter eins hoch. */
      const vorher = zug.zeile.ueber ? -1 : zug.zeile.platz - 1;
      const platz = vorher >= 0 && luecke > vorher ? luecke - 1 : luecke;
      const neu = verschoben(this.stapel(), zug.id, platz);
      if (neu.length === this.stapel().length && neu.every((id, i) => id === this.stapel()[i])) return;
      this.order.emit(neu);
    };
    griff.addEventListener('pointermove', bewegen);
    griff.addEventListener('pointerup', ende);
    griff.addEventListener('pointercancel', ende);
  }

  /** Die Lücke unter dem Zeiger: wie viele ausdrückliche Zeilen ihre Mitte darüber haben. */
  private lueckeAus(y: number): number {
    const zeilen = this.host.nativeElement.querySelectorAll<HTMLElement>('li.zeile[data-oben]');
    let n = 0;
    zeilen.forEach((li) => {
      const r = li.getBoundingClientRect();
      if (r.top + r.height / 2 < y) n += 1;
    });
    return n;
  }
}
