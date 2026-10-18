import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, model, signal, untracked, type TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { stepsFromString, stepsToString, type TransformNode, type TransformStep } from '@nw/model';
import { Api } from '../kern/api';
import { Unterblatt } from './werkzeugleiste';

/** Eine Dimension, wie die Leiste sie anbietet — die Rechnung kennt sie die Seite (`Dimension`). */
export interface TransformWahl {
  key: string;
  label: string;
}

/** Eine gespeicherte Kette: ein Name und die Schritte als Wort (`stepsToString`). */
export interface GespeicherteKette {
  name: string;
  steps: string;
}

/**
 * **Transformationen** (T-253): die Schritte einer Kette als Chips —
 * „1 Group by Layer", „2 Group by Type" —, ziehen oder ‹ › zum Umordnen,
 * × zum Entfernen, „+ Group by …" zum Anhängen. Gerechnet wird nicht hier,
 * sondern mit `applyTransform` aus dem Modellpaket; die Leiste hält nur die
 * Kette (`steps`, zweiseitig gebunden).
 *
 * Ein Muster wie die Werkzeugleiste: es weiss nichts von dem, was es
 * gruppiert. Erste Nutzerin ist die Sichtbarkeit der Kampagne (T-252),
 * danach Kompendium, Prüfliste und Ebenen.
 *
 * - **Teilen:** mit `adresse` steht die Kette als `?steps=` in der Adresse;
 *   ein Link öffnet sie wieder.
 * - **Speichern:** mit `ort` merkt sich das Konto Ketten unter einem Namen
 *   (`/api/me/prefs`, Schlüssel `transforms.<ort>`) — nicht im Browser,
 *   denn am anderen Gerät soll dieselbe Kette dastehen.
 * - **Telefon:** die Leiste ist ein Knopf, die Schritte stehen im Blatt
 *   von unten (`nw-unterblatt`).
 */
@Component({
  selector: 'nw-transformationen',
  imports: [Unterblatt],
  template: `
    <div class="leiste" role="group" aria-label="Transformations">
      <span class="titel">Transformations</span>
      <button type="button" class="telefon" (click)="blatt.set(true)" [attr.aria-expanded]="blatt()">
        {{ zusammenfassung() }} ▾
      </button>
      <nw-unterblatt class="schritte-blatt" titel="Transformations" [offen]="blatt()" (schliessen)="blatt.set(false)">
        <ol class="schritte" aria-label="Steps, first groups outermost">
          @for (s of chips(); track s.i) {
            <li
              class="chip"
              [class.zieht]="zug() === s.i"
              draggable="true"
              (dragstart)="ziehen($event, s.i)"
              (dragover)="$event.preventDefault()"
              (drop)="ablegen($event, s.i)"
              (dragend)="zug.set(null)"
            >
              <span class="nr">{{ s.i + 1 }}</span>
              <span class="was">{{ s.text }}</span>
              <button type="button" [disabled]="s.i === 0" [attr.aria-label]="'Move ' + s.text + ' up'" (click)="schiebe(s.i, -1)">‹</button>
              <button type="button" [disabled]="s.i === steps().length - 1" [attr.aria-label]="'Move ' + s.text + ' down'" (click)="schiebe(s.i, 1)">›</button>
              <button type="button" class="x" [attr.aria-label]="'Remove ' + s.text" (click)="entferne(s.i)">×</button>
            </li>
          }
        </ol>
        @if (frei().length) {
          <select aria-label="Group by" (change)="dazu($any($event.target))">
            <option value="">+ Group by …</option>
            @for (d of frei(); track d.key) {
              <option [value]="d.key">{{ d.label }}</option>
            }
          </select>
        }
        @if (vorlagen().length || ort()) {
          <span class="gespeichert">
            <span class="dim">Saved</span>
            @for (k of alleKetten(); track k.name) {
              <span class="kette">
                <button type="button" class="leise" [class.an]="k.steps === wort()" (click)="lade(k)">{{ k.name }}</button>
                @if (k.eigen) {
                  <button type="button" class="x" [attr.aria-label]="'Delete saved ' + k.name" (click)="loesche(k.name)">×</button>
                }
              </span>
            }
            @if (ort()) {
              <button type="button" class="leise" [disabled]="!steps().length" (click)="speichere()">Save…</button>
            }
            @if (adresse()) {
              <button type="button" class="leise" (click)="teile()">{{ kopiert() ? 'Link copied' : 'Copy link' }}</button>
            }
          </span>
        }
      </nw-unterblatt>
    </div>
  `,
  styles: `
    .leiste {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
    }
    .titel {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--dim);
    }
    .schritte-blatt {
      display: contents;
    }
    .schritte {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      min-height: 32px;
      padding: 0 0.25rem 0 0.6rem;
      border: 1px solid var(--accent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      font-weight: 700;
      cursor: grab;
    }
    .chip.zieht {
      opacity: 0.5;
    }
    .chip .nr {
      color: var(--dim);
    }
    .chip button {
      min-width: 26px;
      min-height: 26px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--dim);
    }
    .gespeichert {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      margin-left: auto;
    }
    .kette {
      display: inline-flex;
      align-items: center;
    }
    .leise.an {
      color: var(--accent);
      font-weight: 700;
    }
    .x {
      color: var(--dim);
    }
    .dim {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .telefon {
      display: none;
    }
    @media (max-width: 760px) {
      .telefon {
        display: inline-block;
      }
      .schritte {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 0.75rem;
      }
      .gespeichert {
        margin: 0.75rem 0 0;
      }
    }
  `,
})
export class Transformationen {
  /** Wonach gruppiert werden kann. */
  readonly dimensionen = input.required<readonly TransformWahl[]>();
  /** Die Kette — zweiseitig: `[(steps)]`. */
  readonly steps = model<TransformStep[]>([]);
  /** Fertige Ketten der Seite („Layer → Type"), nicht löschbar. */
  readonly vorlagen = input<readonly GespeicherteKette[]>([]);
  /** Unter welchem Namen das Konto Ketten dieser Seite speichert; leer: gar nicht. */
  readonly ort = input<string>('');
  /** Steht die Kette als `?steps=` in der Adresse? */
  readonly adresse = input(false);

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly blatt = signal(false);
  protected readonly zug = signal<number | null>(null);
  protected readonly kopiert = signal(false);
  private readonly eigene = signal<GespeicherteKette[]>([]);

  protected readonly wort = computed(() => stepsToString(this.steps()));

  constructor() {
    /* Aus der Adresse lesen, einmal: danach gehört die Kette der Seite. */
    effect(() => {
      if (!this.adresse()) return;
      const roh = untracked(() => this.route.snapshot.queryParamMap.get('steps'));
      const aus = stepsFromString(roh);
      if (aus.length) untracked(() => this.steps.set(aus));
    });
    effect(() => {
      const ort = this.ort();
      if (ort) untracked(() => void this.ladeEigene(ort));
    });
  }

  private readonly nachKey = computed(() => new Map(this.dimensionen().map((d) => [d.key, d.label])));

  protected readonly chips = computed(() =>
    this.steps().map((s, i) => {
      const name = (k: string) => this.nachKey().get(k) ?? k;
      const text =
        'group' in s
          ? `Group by ${name(s.group)}`
          : 'filter' in s
            ? `${name(s.filter)} ${s.not ? 'is not' : 'is'} ${s.values.join(', ')}`
            : `Sort by ${name(s.sort)}${s.desc ? ' ↓' : ''}`;
      return { i, text };
    }),
  );

  /** Wonach noch nicht gruppiert wird. */
  protected readonly frei = computed(() => {
    const schon = new Set(this.steps().flatMap((s) => ('group' in s ? [s.group] : [])));
    return this.dimensionen().filter((d) => !schon.has(d.key));
  });

  protected readonly zusammenfassung = computed(() => {
    const g = this.steps().flatMap((s) => ('group' in s ? [this.nachKey().get(s.group) ?? s.group] : []));
    return g.length ? g.join(' → ') : 'No grouping';
  });

  protected readonly alleKetten = computed(() => [
    ...this.vorlagen().map((k) => ({ ...k, eigen: false })),
    ...this.eigene().map((k) => ({ ...k, eigen: true })),
  ]);

  private setze(neu: TransformStep[]): void {
    this.steps.set(neu);
    if (this.adresse()) {
      const w = stepsToString(neu);
      void this.router.navigate([], { queryParams: { steps: w || null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected schiebe(i: number, um: number): void {
    const j = i + um;
    const st = [...this.steps()];
    if (j < 0 || j >= st.length) return;
    [st[i], st[j]] = [st[j]!, st[i]!];
    this.setze(st);
  }

  protected entferne(i: number): void {
    this.setze(this.steps().filter((_, k) => k !== i));
  }

  protected dazu(sel: HTMLSelectElement): void {
    const k = sel.value;
    sel.value = '';
    if (k) this.setze([...this.steps(), { group: k }]);
  }

  protected ziehen(ev: DragEvent, i: number): void {
    this.zug.set(i);
    ev.dataTransfer?.setData('text/plain', String(i));
  }

  protected ablegen(ev: DragEvent, ziel: number): void {
    ev.preventDefault();
    const von = this.zug();
    this.zug.set(null);
    if (von === null || von === ziel) return;
    const st = [...this.steps()];
    const [s] = st.splice(von, 1);
    st.splice(ziel, 0, s!);
    this.setze(st);
  }

  protected lade(k: GespeicherteKette): void {
    this.setze(stepsFromString(k.steps));
  }

  private schluessel(): string {
    return 'transforms.' + this.ort();
  }

  private async ladeEigene(ort: string): Promise<void> {
    try {
      const roh = (await this.api.prefs())['transforms.' + ort];
      this.eigene.set(
        Array.isArray(roh)
          ? roh.filter((x): x is GespeicherteKette => !!x && typeof x.name === 'string' && typeof x.steps === 'string')
          : [],
      );
    } catch {
      this.eigene.set([]);
    }
  }

  protected async speichere(): Promise<void> {
    const name = window.prompt('Name for this transformation', this.zusammenfassung())?.trim();
    if (!name) return;
    const neu = [...this.eigene().filter((k) => k.name !== name), { name, steps: this.wort() }];
    await this.api.setPref(this.schluessel(), neu);
    this.eigene.set(neu);
  }

  protected async loesche(name: string): Promise<void> {
    const neu = this.eigene().filter((k) => k.name !== name);
    await this.api.setPref(this.schluessel(), neu);
    this.eigene.set(neu);
  }

  protected async teile(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.kopiert.set(true);
      setTimeout(() => this.kopiert.set(false), 2000);
    } catch {
      /* Ohne Zwischenablage steht der Link trotzdem in der Adresse. */
    }
  }
}

/**
 * **Der Baum zu einer Kette** (T-253): je Knoten ein Pfeil zum Aufklappen,
 * die Beschriftung und die Zahl; was rechts daneben steht, gibt die Seite
 * als Vorlage (`zellen`, Kontext `$implicit` = Knoten). Offen ist, was die
 * Seite in `offen` nennt — nach Schlüssel, damit der Stand eine neue
 * Rechnung übersteht.
 */
@Component({
  selector: 'nw-transformbaum',
  imports: [NgTemplateOutlet],
  template: `
    <div class="baum" role="tree" [attr.aria-label]="beschriftung()">
      @for (z of zeilen(); track z.key) {
        <div class="zeile" role="treeitem" [attr.aria-level]="z.depth + 1" [attr.aria-expanded]="z.children.length ? offen().has(z.key) : null">
          <span class="name" [style.padding-left.rem]="z.depth * 1.25">
            @if (z.children.length) {
              <button type="button" class="pfeil" [attr.aria-label]="(offen().has(z.key) ? 'Collapse ' : 'Expand ') + z.label" (click)="umschalten(z.key)">
                {{ offen().has(z.key) ? '▾' : '▸' }}
              </button>
            } @else {
              <span class="pfeil" aria-hidden="true"></span>
            }
            <span class="dim">{{ dimName(z.dim) }}</span>
            <b>{{ z.label }}</b>
            <span class="zahl">{{ z.count }}</span>
          </span>
          @if (zellen(); as t) {
            <ng-container *ngTemplateOutlet="t; context: { $implicit: z }" />
          }
        </div>
      } @empty {
        <p class="dim">Nothing to group.</p>
      }
    </div>
  `,
  styles: `
    .zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-height: 40px;
      border-bottom: 1px solid var(--line);
    }
    .name {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      flex: 1 1 14rem;
      min-width: 0;
    }
    .pfeil {
      width: 28px;
      min-height: 28px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
    }
    .dim {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--dim);
    }
    .zahl {
      color: var(--dim);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class Transformbaum<T = unknown> {
  readonly knoten = input.required<readonly TransformNode<T>[]>();
  readonly dimensionen = input<readonly TransformWahl[]>([]);
  readonly offen = model<ReadonlySet<string>>(new Set());
  readonly zellen = input<TemplateRef<{ $implicit: TransformNode<T> }> | null>(null);
  readonly beschriftung = input('Groups');

  /** Die sichtbaren Knoten, flach in ihrer Reihenfolge. */
  protected readonly zeilen = computed(() => {
    const aus: TransformNode<T>[] = [];
    const offen = this.offen();
    const geh = (l: readonly TransformNode<T>[]) => {
      for (const n of l) {
        aus.push(n);
        if (offen.has(n.key)) geh(n.children);
      }
    };
    geh(this.knoten());
    return aus;
  });

  protected dimName(k: string): string {
    return this.dimensionen().find((d) => d.key === k)?.label ?? k;
  }

  protected umschalten(key: string): void {
    const s = new Set(this.offen());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.offen.set(s);
  }
}
