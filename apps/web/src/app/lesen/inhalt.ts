import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { LeseZeile } from '../kern/api';

/** Eine Zeile, wie sie gezeichnet wird: mit Einzug, Pfeil und Stand. */
interface Zeile {
  z: LeseZeile;
  stufe: number;
  kinder: boolean;
  offen: boolean;
}

/** Der Schlüssel, unter dem ein Gerät den aufgeklappten Stand eines Buchs hält. */
const SCHLUESSEL = 'nw.read.toc.';

/**
 * **Das aufklappbare Inhaltsverzeichnis** (T-167): Buch → Kapitel →
 * Abschnitte → Unterabschnitte, gebaut aus der flachen Liste des Servers
 * (`depth`). Jede Stufe klappt einzeln auf und zu, „Expand all" und
 * „Collapse all" für alle. Das aktuelle Kapitel ist aufgeklappt und
 * markiert und folgt dem Lesestand: kommt beim Scrollen ein neuer
 * Abschnitt nach oben, klappt sein Weg auf, und die Zeile rückt in der
 * Leiste ins Bild — nur in der Leiste, die Seite bleibt, wo sie ist.
 *
 * Der aufgeklappte Stand gehört dem Gerät (`localStorage` je Buch) — das
 * reicht, und ein fehlender Speicher (privates Fenster) heisst nur, dass
 * das Verzeichnis wieder beim aktuellen Kapitel anfängt.
 *
 * Eine Komponente für jede Leseansicht: `read/:layer`, der Reiter „Read"
 * am Ebenen-Artikel, später Board (T-147) und Library (T-168).
 */
@Component({
  selector: 'nw-lese-inhalt',
  template: `
    <div class="alle">
      <button type="button" class="leise" (click)="alleAuf()" [disabled]="!eltern().size">Expand all</button>
      <button type="button" class="leise" (click)="alleZu()" [disabled]="!eltern().size">Collapse all</button>
    </div>
    <ul class="toc" role="tree" [attr.aria-label]="'Contents'">
      @for (r of zeilen(); track r.z.id) {
        <li role="treeitem" [attr.aria-level]="r.stufe + 1" [attr.aria-expanded]="r.kinder ? r.offen : null"
            [attr.aria-current]="r.z.id === aktuell() ? 'location' : null"
            [class.hier]="r.z.id === aktuell()" [class.weg]="wegHier().has(r.z.id)"
            [class.im-stueck]="r.z.unit === stueck()" [style.padding-left.rem]="r.stufe * 0.8"
            [attr.data-id]="r.z.id">
          @if (r.kinder) {
            <button type="button" class="pfeil" [attr.aria-label]="(r.offen ? 'Collapse ' : 'Expand ') + r.z.name"
                    [attr.aria-expanded]="r.offen" (click)="umschalten(r.z.id)">
              <span aria-hidden="true">{{ r.offen ? '▾' : '▸' }}</span>
            </button>
          } @else {
            <span class="pfeil leer" aria-hidden="true"></span>
          }
          <a [href]="'#s-' + r.z.id" (click)="$event.preventDefault(); springe.emit(r.z.id)">{{ r.z.name }}</a>
          @if (r.z.page) {
            <span class="seite">{{ r.z.page }}</span>
          }
        </li>
      }
    </ul>
  `,
  /* Der Kasten mit dem eigenen Scroll ist die Leiste der Leseansicht, nicht diese Liste. */
  styles: `
    :host {
      display: block;
    }
    .alle {
      display: flex;
      gap: 0.75rem;
      margin: 0 0 0.35rem;
      font-size: 0.82rem;
    }
    .leise {
      border: 0;
      background: none;
      color: var(--link);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
      min-height: 0;
      padding: 0;
    }
    .leise:disabled {
      color: var(--dim);
      text-decoration: none;
      cursor: default;
    }
    .toc {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .toc li {
      display: flex;
      align-items: flex-start;
      gap: 0.15rem;
      border-left: 2px solid transparent;
    }
    .toc li.im-stueck {
      border-left-color: var(--line);
    }
    .toc li.hier {
      border-left-color: var(--accent);
      background: var(--hover);
    }
    .toc li.weg > a {
      color: var(--accent);
    }
    .pfeil {
      flex: none;
      width: 1.5rem;
      min-height: 28px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--dim);
      font: inherit;
      line-height: 28px;
      cursor: pointer;
    }
    .pfeil:hover {
      color: var(--accent);
    }
    .pfeil.leer {
      cursor: default;
    }
    .toc a {
      flex: 1;
      display: block;
      padding: 0.2rem 0.2rem;
      min-height: 28px;
      color: var(--ink);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .toc li.hier > a {
      color: var(--accent);
      font-weight: 600;
    }
    .toc a:hover {
      text-decoration: underline;
    }
    .seite {
      color: var(--dim);
      font-size: 0.8rem;
      white-space: nowrap;
      padding-top: 0.25rem;
    }
    @media (hover: none) {
      .pfeil {
        width: 2rem;
        min-height: 36px;
        line-height: 36px;
      }
    }
  `,
})
export class LeseInhalt {
  /** Das Buch — der Schlüssel für den gemerkten Stand. */
  readonly layer = input.required<string>();
  readonly toc = input.required<LeseZeile[]>();
  /** Der Abschnitt, der oben steht. */
  readonly aktuell = input<string | null>(null);
  /** Das Stück (Kapitel), das offen ist. */
  readonly stueck = input<string | undefined>(undefined);
  readonly springe = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());

  /** Je Eintrag sein Elterneintrag — der nächste davor mit kleinerer Tiefe. */
  private readonly vater = computed(() => {
    const raus = new Map<string, string | null>();
    const stapel: LeseZeile[] = [];
    for (const z of this.toc()) {
      while (stapel.length && stapel[stapel.length - 1]!.depth >= z.depth) stapel.pop();
      raus.set(z.id, stapel[stapel.length - 1]?.id ?? null);
      stapel.push(z);
    }
    return raus;
  });
  /** Die Einträge mit Kindern — nur sie klappen. */
  protected readonly eltern = computed(() => new Set([...this.vater().values()].filter((v): v is string => !!v)));

  /** Der Weg zum aktuellen Abschnitt: seine Vorfahren, markiert wie er. */
  protected readonly wegHier = computed(() => this.vorfahren(this.aktuell()));

  protected readonly zeilen = computed<Zeile[]>(() => {
    const offen = this.offen();
    const eltern = this.eltern();
    const vater = this.vater();
    const tiefe = this.toc().length ? Math.min(...this.toc().map((z) => z.depth)) : 0;
    const sichtbar = new Map<string, boolean>();
    const raus: Zeile[] = [];
    for (const z of this.toc()) {
      const v = vater.get(z.id);
      /* Sichtbar ist, was ganz oben steht oder unter einem sichtbaren, offenen Eintrag. */
      const da = !v || (sichtbar.get(v)! && offen.has(v));
      sichtbar.set(z.id, da);
      if (!da) continue;
      raus.push({ z, stufe: z.depth - tiefe, kinder: eltern.has(z.id), offen: offen.has(z.id) });
    }
    return raus;
  });

  constructor() {
    /* Ein neues Buch: den gemerkten Stand holen, sonst die oberste Stufe offen. */
    effect(() => {
      const layer = this.layer();
      const toc = this.toc();
      untracked(() => {
        const gemerkt = this.lies(layer);
        const ids = new Set(toc.map((z) => z.id));
        this.offen.set(
          gemerkt
            ? new Set(gemerkt.filter((id) => ids.has(id)))
            : new Set(toc.filter((z) => z.depth === Math.min(...toc.map((x) => x.depth))).map((z) => z.id)),
        );
      });
    });
    /* Der Lesestand zieht das Verzeichnis mit: sein Weg klappt auf, und
       ein Kapitel, das man liest, ist offen. */
    effect(() => {
      const id = this.aktuell();
      if (!id) return;
      untracked(() => {
        const dazu = [...this.vorfahren(id), ...(this.eltern().has(id) ? [id] : [])];
        const jetzt = this.offen();
        if (dazu.some((x) => !jetzt.has(x))) this.setze(new Set([...jetzt, ...dazu]));
        setTimeout(() => this.insBild(id));
      });
    });
  }

  protected umschalten(id: string): void {
    const s = new Set(this.offen());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.setze(s);
  }
  protected alleAuf(): void {
    this.setze(new Set(this.eltern()));
  }
  protected alleZu(): void {
    /* Zu heisst: die oberste Stufe bleibt lesbar, sonst stünde nur der Titel da. */
    const oben = Math.min(...this.toc().map((z) => z.depth));
    this.setze(new Set(this.toc().filter((z) => z.depth === oben && this.eltern().has(z.id)).map((z) => z.id)));
  }

  private vorfahren(id: string | null): Set<string> {
    const raus = new Set<string>();
    let v = id ? this.vater().get(id) : null;
    while (v && !raus.has(v)) {
      raus.add(v);
      v = this.vater().get(v) ?? null;
    }
    return raus;
  }

  private setze(s: ReadonlySet<string>): void {
    this.offen.set(s);
    try {
      localStorage.setItem(SCHLUESSEL + this.layer(), JSON.stringify([...s]));
    } catch {
      /* Ohne Speicher gilt der Stand bis zum Neuladen. */
    }
  }
  private lies(layer: string): string[] | null {
    try {
      const roh = localStorage.getItem(SCHLUESSEL + layer);
      const wert: unknown = roh ? JSON.parse(roh) : null;
      return Array.isArray(wert) ? wert.filter((x): x is string => typeof x === 'string') : null;
    } catch {
      return null;
    }
  }

  /** Die Zeile in der Leiste ins Bild rücken — ohne die Seite zu bewegen. */
  private insBild(id: string): void {
    const kasten = this.host.nativeElement.closest<HTMLElement>('.inhalt');
    const li = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('li[data-id]')).find((x) => x.dataset['id'] === id);
    if (!kasten || !li || kasten.scrollHeight <= kasten.clientHeight) return;
    const k = kasten.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    if (r.top < k.top + 8) kasten.scrollTop -= k.top + 8 - r.top + 40;
    else if (r.bottom > k.bottom - 8) kasten.scrollTop += r.bottom - k.bottom + 8 + 40;
  }
}
