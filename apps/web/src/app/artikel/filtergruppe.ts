import { Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { areaOf, enumOptions, typeList } from '@nw/model';
import type { Filtergruppe, GespeicherterFilter } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Filtergruppen } from '../kern/filtergruppen';

/**
 * **Eine Filtergruppe anlegen oder ändern** (T-137) — die Maske unter den
 * Unterreitern einer Listenseite.
 *
 * Angeboten werden die Arten **dieser Seite** (`area` am Typ, flach und
 * alphabetisch wie jede Typenliste), die Stände aus der Zeile `State` und
 * die Marken, die die Liste gerade zählt. Beim Anlegen steht vorgefüllt,
 * was die Seite gerade zeigt: die gewählte Art, die Suche, die Facetten —
 * „Save as group" heisst, diesen Blick behalten. Ebenen nicht (T-186): die
 * sagt der globale Stand, und Auswahlen davon speichert das Popup der
 * Kopfleiste.
 */
@Component({
  selector: 'nw-filtergruppe',
  template: `
    <form
      class="maske"
      (submit)="speichern($event)"
      [attr.aria-label]="gruppe() ? 'Edit filter group' : 'New filter group'"
    >
      <div class="zeile">
        <label class="feld name">
          <span class="leg">Name</span>
          <input
            type="text"
            required
            maxlength="80"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </label>
        @if (!gruppe()) {
          <fieldset class="feld">
            <legend class="leg">For</legend>
            <label class="haken"
              ><input
                type="radio"
                name="scope"
                [checked]="scope() === 'own'"
                (change)="scope.set('own')"
              />
              Only me</label
            >
            @if (gruppen.darfKampagne()) {
              <label class="haken"
                ><input
                  type="radio"
                  name="scope"
                  [checked]="scope() === 'campaign'"
                  (change)="scope.set('campaign')"
                />
                Everyone in the campaign</label
              >
            }
          </fieldset>
        }
        @if (scope() === 'campaign') {
          <label class="haken vorgabe">
            <input type="checkbox" [checked]="vorgabe()" (change)="vorgabe.set(!vorgabe())" />
            Default for this page
          </label>
        }
      </div>

      <div class="zeile">
        <div class="feld">
          <span class="leg">Only these types</span>
          <div class="chips">
            @for (t of nur(); track t) {
              <span class="chip"
                >{{ label(t) }}
                <button
                  type="button"
                  [attr.aria-label]="'Remove ' + label(t)"
                  (click)="weg(nur, t)"
                >
                  ×
                </button></span
              >
            }
            <select aria-label="Add a type to show" (change)="dazu(nur, $event)">
              <option value="">{{ nur().length ? 'Add…' : 'All types' }}</option>
              @for (t of typen(); track t) {
                @if (!nur().includes(t)) {
                  <option [value]="t">{{ label(t) }}</option>
                }
              }
            </select>
          </div>
        </div>
        <div class="feld">
          <span class="leg">Hide these types</span>
          <div class="chips">
            @for (t of ohne(); track t) {
              <span class="chip"
                >{{ label(t) }}
                <button
                  type="button"
                  [attr.aria-label]="'Remove ' + label(t)"
                  (click)="weg(ohne, t)"
                >
                  ×
                </button></span
              >
            }
            <select aria-label="Add a type to hide" (change)="dazu(ohne, $event)">
              <option value="">{{ ohne().length ? 'Add…' : 'None' }}</option>
              @for (t of typen(); track t) {
                @if (!ohne().includes(t)) {
                  <option [value]="t">{{ label(t) }}</option>
                }
              }
            </select>
          </div>
        </div>
      </div>

      <div class="zeile">
        @if (staende().length) {
          <fieldset class="feld">
            <legend class="leg">State</legend>
            @for (s of staende(); track s) {
              <label class="haken"
                ><input
                  type="checkbox"
                  [checked]="stand().includes(s)"
                  (change)="umschalten(stand, s)"
                />
                {{ s }}</label
              >
            }
          </fieldset>
        }
        <!-- Was nicht gilt, steht nicht da: ohne Marken kein Markenfeld. -->
        @if (marken().length || markenAngebot().length) {
          <div class="feld">
            <span class="leg">Tags (all of)</span>
            <div class="chips">
              @for (t of marken(); track t) {
                <span class="chip"
                  >{{ t }}
                  <button type="button" [attr.aria-label]="'Remove ' + t" (click)="weg(marken, t)">
                    ×
                  </button></span
                >
              }
              @if (markenAngebot().length) {
                <select aria-label="Add a tag" (change)="dazu(marken, $event)">
                  <option value="">{{ marken().length ? 'Add…' : 'Any' }}</option>
                  @for (t of markenAngebot(); track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              }
            </div>
          </div>
        }
        <label class="feld">
          <span class="leg">Start with search</span>
          <input type="search" [value]="suche()" (input)="suche.set($any($event.target).value)" />
        </label>
      </div>

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      <div class="knoepfe">
        <button type="submit" class="pri" [disabled]="laeuft() || !name().trim()">
          {{ gruppe() ? 'Save' : 'Create group' }}
        </button>
        <button type="button" (click)="zu.emit()">Cancel</button>
        @if (gruppe(); as g) {
          <button type="button" class="weg" [disabled]="laeuft()" (click)="loeschen(g)">
            Delete group
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    .maske {
      display: grid;
      gap: 0.6rem;
      margin: 0.5rem 0 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .zeile {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem 1.25rem;
      align-items: flex-end;
    }
    .feld {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .name input {
      width: min(18rem, 100%);
    }
    .leg {
      font-size: 0.8rem;
      color: var(--dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .haken {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-right: 0.75rem;
      min-height: 32px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      align-items: center;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.1rem 0.5rem;
      border-radius: 12px;
      background: var(--chip);
    }
    .chip button {
      border: 0;
      background: none;
      cursor: pointer;
      color: inherit;
    }
    input[type='text'],
    input[type='search'],
    select {
      min-height: 32px;
      max-width: 100%;
    }
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .knoepfe button {
      min-height: 36px;
      padding: 0 0.85rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
    }
    .knoepfe .pri {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
    }
    .knoepfe .weg {
      margin-left: auto;
      color: var(--warn);
    }
    .fehler {
      margin: 0;
      color: var(--warn);
    }
  `,
})
export class FiltergruppeMaske implements OnInit {
  /** Die Seite, an der die Gruppe steht: `compendium`, `world` … */
  readonly seite = input.required<string>();
  /** Der Bereich, wenn die Seite einer ist — er sagt, welche Arten angeboten werden. */
  readonly bereich = input<string | undefined>(undefined);
  /** Ändern statt anlegen. */
  readonly gruppe = input<Filtergruppe | null>(null);
  /** Was die Seite gerade zeigt — vorgefüllt beim Anlegen. */
  readonly vorlage = input<GespeicherterFilter>({});
  /** Die Marken, die die Liste gerade zählt. */
  readonly markenDa = input<readonly string[]>([]);
  readonly zu = output<void>();
  readonly gespeichert = output<Filtergruppe | null>();

  protected readonly gruppen = inject(Filtergruppen);
  private readonly bestand = inject(Bestand);

  protected readonly name = signal('');
  protected readonly scope = signal<'campaign' | 'own'>('own');
  protected readonly vorgabe = signal(false);
  protected readonly nur = signal<string[]>([]);
  protected readonly ohne = signal<string[]>([]);
  protected readonly stand = signal<string[]>([]);
  protected readonly marken = signal<string[]>([]);
  protected readonly suche = signal('');
  /** Die Facetten (T-174) — die Maske zeigt sie nicht, behält sie aber. */
  private facetten: string[] = [];
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);

  ngOnInit(): void {
    const g = this.gruppe();
    const f = g?.filter ?? this.vorlage();
    this.name.set(g?.name ?? '');
    this.scope.set(g?.scope ?? (this.gruppen.darfKampagne() ? 'campaign' : 'own'));
    this.vorgabe.set(g?.default ?? false);
    this.nur.set([...(f.of ?? [])]);
    this.ohne.set([...(f.notype ?? [])]);
    this.stand.set([...(f.status ?? [])]);
    this.marken.set([...(f.tag ?? [])]);
    this.suche.set(f.q ?? '');
    this.facetten = [...(f.f ?? [])];
  }

  /** Die Arten dieser Seite — was `area` dorthin stellt; im Kompendium jede mit Bereich. */
  protected readonly typen = computed(() => {
    const reg = this.bestand.registry();
    if (!reg) return [...this.nur(), ...this.ohne()];
    const b = this.bereich();
    return typeList(reg).filter((t) => {
      const a = areaOf(reg, t);
      return b ? a === b : !!a;
    });
  });

  protected readonly staende = computed(() => {
    const reg = this.bestand.registry();
    return (reg && enumOptions(reg, { enumRef: 'State' })) || [];
  });

  protected readonly markenAngebot = computed(() =>
    this.markenDa().filter((t) => !this.marken().includes(t)),
  );

  protected label(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  protected dazu(ziel: ReturnType<typeof signal<string[]>>, ev: Event): void {
    const sel = ev.target as HTMLSelectElement;
    const v = sel.value;
    sel.value = '';
    if (v) ziel.update((l) => (l.includes(v) ? l : [...l, v]));
  }
  protected weg(ziel: ReturnType<typeof signal<string[]>>, v: string): void {
    ziel.update((l) => l.filter((x) => x !== v));
  }
  protected umschalten(ziel: ReturnType<typeof signal<string[]>>, v: string): void {
    ziel.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  private filter(): GespeicherterFilter {
    const f: GespeicherterFilter = {};
    if (this.nur().length) f.of = this.nur();
    if (this.ohne().length) f.notype = this.ohne();
    if (this.stand().length) f.status = this.stand();
    if (this.marken().length) f.tag = this.marken();
    if (this.suche().trim()) f.q = this.suche().trim();
    if (this.facetten.length) f.f = this.facetten;
    return f;
  }

  protected async speichern(ev: Event): Promise<void> {
    ev.preventDefault();
    if (!this.name().trim()) return;
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      const g = this.gruppe();
      const vorgabe = this.scope() === 'campaign' && this.vorgabe();
      if (g) {
        await this.gruppen.aendern(g.id, {
          name: this.name().trim(),
          filter: this.filter(),
          default: vorgabe,
        });
        this.gespeichert.emit(
          this.gruppen.jeSeite(this.seite()).find((x) => x.id === g.id) ?? null,
        );
      } else {
        const neu = await this.gruppen.anlegen({
          page: this.seite(),
          name: this.name().trim(),
          scope: this.scope(),
          filter: this.filter(),
          default: vorgabe,
        });
        this.gespeichert.emit(neu);
      }
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async loeschen(g: Filtergruppe): Promise<void> {
    if (typeof window !== 'undefined' && !window.confirm(`Delete the filter group “${g.name}”?`))
      return;
    this.laeuft.set(true);
    try {
      await this.gruppen.loeschen(g.id);
      this.gespeichert.emit(null);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}
