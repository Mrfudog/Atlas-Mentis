import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  entityName,
  primaryInterface,
  queryTileOf,
  storedQuery,
  stepsFromString,
  stepsToString,
  typeList,
  QUERY_DISPLAYS,
  SLIDE_INTERVAL,
} from '@nw/model';
import type { BoardQuery, Entity, QueryDisplay, Relation } from '@nw/model';
import { Api, ApiError, type AbfrageAntwort } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Live } from '../kern/live';
import { Kachel } from './kachel';
import { BoardSuche } from './suche';

const DARSTELLUNG: Record<QueryDisplay, string> = { list: 'List', draw: 'Draw', slideshow: 'Slideshow' };

/**
 * **Die Abfrage-Kachel** (T-340): eine Kachel, die eine Auswahl zeigt —
 * als Liste, zum Ziehen ohne Zurücklegen oder als Slideshow.
 *
 * Gerechnet wird am Server (`GET /api/boards/:board/query/:rel`): hier
 * steht nur die Frage, und was ankommt, darf dieser Betrachter sehen. Neu
 * gefragt wird, wenn sich die Kante ändert (die Leitung stellt um, jemand
 * zieht — das Board kommt über den Live-Kanal) oder ein Artikel darin.
 *
 * Die Einstellungen (Quelle, Darstellung, Freigeben) stehen in der Kachel
 * selbst, aufgeklappt über ⚙ — wer das Board schreibt, stellt sie um; sie
 * gehen als Änderung der Kante hinaus (`aendern`), wie Lage und Ansicht.
 */
@Component({
  selector: 'nw-abfrage',
  imports: [RouterLink, Kachel, BoardSuche],
  template: `
    @if (einstellen()) {
      <form class="einst" (submit)="$event.preventDefault()" aria-label="Query settings">
        <label>Title <input [value]="tile()?.title ?? ''" (change)="setze({ title: $any($event.target).value.trim() || undefined })" /></label>
        <fieldset class="zeile">
          <legend>Shows as</legend>
          @for (d of DISPLAYS; track d) {
            <label><input type="radio" name="display" [checked]="tile()?.display === d" (change)="setze({ display: d === 'list' ? undefined : d })" /> {{ DARSTELLUNG[d] }}</label>
          }
        </fieldset>
        @if (tile()?.display === 'slideshow') {
          <label>Seconds per slide
            <input class="zahl" type="number" [min]="IV.min" [max]="IV.max" [value]="tile()?.interval" (change)="setze({ interval: +$any($event.target).value || undefined })" />
          </label>
        }
        <label>Types
          <select multiple size="5" aria-label="Types" (change)="typenSetzen($any($event.target))">
            @for (t of typen(); track t.key) {
              <option [value]="t.key" [selected]="frage().types.includes(t.key)">{{ t.label }}</option>
            }
          </select>
        </label>
        <label>Tags <input placeholder="rumour, city" [value]="frage().tags.join(', ')" (change)="frageSetzen({ tags: woerter($any($event.target).value) })" /></label>
        <label>Layers
          <select multiple size="3" aria-label="Layers" (change)="ebenenSetzen($any($event.target))">
            @for (l of ebenen(); track l.id) {
              <option [value]="l.id" [selected]="frage().layers.includes(l.id)">{{ l.name }}</option>
            }
          </select>
        </label>
        <label>Filter chain
          <input placeholder="filter:status=ready,sort:name" [value]="frage().steps" (change)="frageSetzen({ steps: stepsToString(stepsFromString($any($event.target).value.trim())) })" />
        </label>
        @if (antwort()?.unknown?.length) {
          <p class="warn">Not understood: {{ antwort()!.unknown.join(', ') }}</p>
        }
        <div class="einzeln">
          <span class="dim">Single articles</span>
          @for (a of einzelne(); track a.id) {
            <span class="chip">{{ a.name }} <button type="button" [attr.aria-label]="'Remove ' + a.name" (click)="artikelWeg(a.id)">×</button></span>
          }
          <!-- Die Suche erst auf Wunsch: sie listet gleich Treffer und nähme der Kachel den Platz. -->
          <button type="button" class="klein" [attr.aria-expanded]="suchtArtikel()" (click)="suchtArtikel.set(!suchtArtikel())">{{ suchtArtikel() ? 'Done' : '+ Article' }}</button>
          @if (suchtArtikel()) {
            <nw-board-suche class="suche" [ohne]="schonDa()" (gewaehlt)="artikelDazu($event)" />
          }
        </div>
        @if (tile()?.display === 'draw') {
          <label><input type="checkbox" [checked]="tile()?.reveal" (change)="setze({ reveal: $any($event.target).checked || undefined })" /> Reveal when drawn — what is drawn becomes knowledge of the party</label>
        }
      </form>
    }
    @if (fehler(); as f) {
      <p class="fehler" role="alert">{{ f }}</p>
    }
    @if (antwort(); as a) {
      @switch (a.display) {
        @case ('list') {
          @if (a.items.length) {
            <ul class="liste">
              @for (e of a.items; track e.id) {
                <li><a [routerLink]="['/artikel', e.id]">{{ name(e) }}</a><span class="dim art">{{ typLabel(e) }}</span></li>
              }
            </ul>
            @if (a.total > a.items.length) {
              <p class="dim">{{ a.items.length }} of {{ a.total }}</p>
            }
          } @else {
            <p class="leer">{{ leerText() }}</p>
          }
        }
        @case ('draw') {
          <div class="ziehen">
            @if (a.mayDraw) {
              <button type="button" class="knopf haupt" [disabled]="zieht() || !a.remaining" (click)="ziehen()">Draw</button>
              <button type="button" class="knopf" [disabled]="zieht() || !a.drawn.length" (click)="zuruecksetzen()" title="Put everything back">Reset</button>
            }
            <span class="dim" role="status">{{ a.remaining }} left of {{ a.total }}</span>
          </div>
          @if (letzter(); as e) {
            <div class="karte">
              <a class="kname" [routerLink]="['/artikel', e.id]">{{ name(e) }}</a>
              <nw-kachel [artikel]="e" [ansicht]="ansicht()" />
            </div>
          } @else if (!a.total) {
            <p class="leer">{{ leerText() }}</p>
          }
          @if (frueher().length) {
            <details class="frueher">
              <summary>Drawn before ({{ frueher().length }})</summary>
              <ol>
                @for (e of frueher(); track e.id) {
                  <li><a [routerLink]="['/artikel', e.id]">{{ name(e) }}</a></li>
                }
              </ol>
            </details>
          }
          @if (freigabe(); as fr) {
            <p class="dim" role="status">{{ fr }}</p>
          }
        }
        @case ('slideshow') {
          <div class="show" #show [class.voll]="vollbild()">
            @if (aktuell(); as e) {
              <div class="karte">
                <a class="kname" [routerLink]="['/artikel', e.id]">{{ name(e) }}</a>
                <nw-kachel [artikel]="e" [ansicht]="ansicht()" />
              </div>
              <div class="steuer" role="group" aria-label="Slideshow">
                <button type="button" (click)="blaettern(-1)" aria-label="Previous">‹</button>
                <button type="button" (click)="laeuft.set(!laeuft())" [attr.aria-label]="laeuft() ? 'Pause' : 'Play'">{{ laeuft() ? '❚❚' : '▶' }}</button>
                <button type="button" (click)="blaettern(1)" aria-label="Next">›</button>
                <span class="dim">{{ pos() + 1 }} / {{ a.items.length }}</span>
                <button type="button" (click)="vollbildUmschalten()" [attr.aria-label]="vollbild() ? 'Leave full screen' : 'Full screen'" title="Full screen — for a second screen">⛶</button>
              </div>
            } @else {
              <p class="leer">{{ leerText() }}</p>
            }
          </div>
        }
      }
    } @else if (!fehler()) {
      <p class="laedt">Loading…</p>
    }
  `,
  styles: `
    :host { display: block; font-size: 0.9rem; }
    .einst { display: grid; gap: 0.4rem; padding: 0.4rem 0 0.6rem; border-bottom: 1px dashed var(--rule, #c9b98f); margin-bottom: 0.5rem; }
    .einst label { display: grid; gap: 0.15rem; }
    .einst fieldset.zeile { display: flex; flex-wrap: wrap; gap: 0.6rem; border: 0; padding: 0; margin: 0; }
    .einst fieldset.zeile label, .einst label:has(> input[type='checkbox']) { display: flex; gap: 0.3rem; align-items: center; }
    .einst input, .einst select { font: inherit; min-width: 0; }
    .zahl { width: 5rem; }
    .einzeln { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .chip { border: 1px solid var(--rule, #c9b98f); border-radius: 999px; padding: 0 0.4rem; }
    .chip button { border: 0; background: none; cursor: pointer; }
    .liste { margin: 0; padding-left: 1.1rem; }
    .liste li { margin: 0.1rem 0; }
    .dim { opacity: 0.7; }
    .art { margin-left: 0.4rem; font-size: 0.8em; }
    .suche { flex-basis: 100%; max-height: 14rem; overflow: auto; }
    .warn, .fehler { color: var(--danger, #8b2e1f); }
    .ziehen, .steuer { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-bottom: 0.4rem; }
    .knopf.haupt { font-weight: 600; }
    .kname { display: block; font-weight: 600; margin-bottom: 0.2rem; }
    .frueher ol { margin: 0.2rem 0 0; padding-left: 1.2rem; }
    .show.voll { background: var(--paper, #f4ecd8); padding: 2rem; overflow: auto; font-size: 1.3rem; }
    .show.voll .karte { max-width: 60rem; margin: 0 auto; }
    .steuer button { min-width: 2rem; }
  `,
})
export class Abfrage {
  readonly board = input.required<string>();
  readonly rel = input.required<Relation>();
  /** Die Einstellungen aufgeklappt (⚙ in der Kopfzeile der Kachel). */
  readonly einstellen = input(false);
  /** Wer das Board nicht schreibt, bekommt ohne Wahl den Handzettel (E-123 a). */
  readonly spielend = input(false);
  /** Eine Änderung der Kante — Lage und Ansicht gehen denselben Weg. */
  readonly aendern = output<Record<string, unknown>>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly DISPLAYS = QUERY_DISPLAYS;
  protected readonly DARSTELLUNG = DARSTELLUNG;
  protected readonly IV = SLIDE_INTERVAL;
  protected readonly stepsToString = stepsToString;
  protected readonly stepsFromString = stepsFromString;

  protected readonly antwort = signal<AbfrageAntwort | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly zieht = signal(false);
  protected readonly suchtArtikel = signal(false);
  protected readonly freigabe = signal<string | null>(null);
  protected readonly pos = signal(0);
  protected readonly laeuft = signal(true);
  protected readonly vollbild = signal(false);
  private readonly show = viewChild<ElementRef<HTMLElement>>('show');
  private readonly ebenenListe = signal<{ id: string; name: string }[]>([]);

  protected readonly tile = computed(() => queryTileOf(this.rel()));
  protected readonly frage = computed<BoardQuery>(() => this.tile()?.query ?? { types: [], articles: [], tags: [], layers: [], steps: '' });

  /* Neu gefragt wird, wenn sich die Kante ändert — als Wort, damit ein neu
     gezeichnetes Board mit gleicher Kante nicht jedes Mal fragt. */
  private readonly schluessel = computed(() => `${this.board()}|${this.rel().id}|${JSON.stringify(this.rel().props ?? {})}`);

  constructor() {
    effect(() => {
      this.schluessel();
      untracked(() => void this.laden());
    });
    effect(() => {
      if (!this.einstellen() || this.ebenenListe().length) return;
      untracked(() => {
        void this.bestand
          .liste({ type: 'Layer', limit: 200 })
          .then((l) => this.ebenenListe.set(l.rows.map((z) => ({ id: z.id, name: z.name }))))
          .catch(() => undefined);
      });
    });
    /* Ändert sich ein Artikel, der hier steht, kommt er neu — gesiebt. */
    const ab = inject(Live).onArtikel((ev) => {
      if (this.antwort()?.items.some((e) => e.id === ev.id)) void this.laden();
    });
    /* Die Slideshow läuft im Takt der Kachel; angehalten, solange man nicht hinsieht. */
    const uhr = setInterval(() => {
      const a = this.antwort();
      if (!a || a.display !== 'slideshow' || !this.laeuft() || a.items.length < 2) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      this.zaehler += 1;
      if (this.zaehler >= (this.tile()?.interval ?? SLIDE_INTERVAL.default)) this.blaettern(1);
    }, 1000);
    const vollAus = () => this.vollbild.set(typeof document !== 'undefined' && !!document.fullscreenElement && document.fullscreenElement === this.show()?.nativeElement);
    if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', vollAus);
    inject(DestroyRef).onDestroy(() => {
      ab();
      clearInterval(uhr);
      if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', vollAus);
    });
  }

  private zaehler = 0;
  private fragt = 0;

  private async laden(): Promise<void> {
    const nr = ++this.fragt;
    try {
      const a = await this.api.boardQuery(this.board(), this.rel().id);
      if (nr !== this.fragt) return;
      this.antwort.set(a);
      this.fehler.set(null);
      if (this.pos() >= a.items.length) this.pos.set(0);
    } catch (e) {
      if (nr !== this.fragt) return;
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    }
  }

  protected readonly typen = computed(() => {
    const r = this.bestand.registry();
    return r ? typeList(r).map((key) => ({ key, label: r.interfaces[key]?.label ?? key })) : [];
  });
  protected readonly ebenen = computed(() => this.ebenenListe());

  protected readonly einzelne = computed(() => {
    const kennt = new Map((this.antwort()?.items ?? []).map((e) => [e.id, e]));
    const voll = this.bestand.voll();
    const kurz = this.bestand.kurz();
    return this.frage().articles.map((id) => ({ id, name: entityName(kennt.get(id) ?? voll.get(id) ?? kurz.get(id)) || id }));
  });
  protected readonly schonDa = computed(() => new Set(this.frage().articles));

  protected readonly ansicht = computed(() => {
    const v = this.tile()?.view;
    const r = this.bestand.registry();
    if (v && r?.views[v]) return v;
    return this.spielend() && r?.views['handout'] ? 'handout' : 'quick';
  });

  private readonly nachId = computed(() => new Map((this.antwort()?.items ?? []).map((e) => [e.id, e])));
  protected readonly letzter = computed(() => {
    const d = this.antwort()?.drawn ?? [];
    return d.length ? (this.nachId().get(d[d.length - 1]!) ?? null) : null;
  });
  protected readonly frueher = computed(() =>
    (this.antwort()?.drawn ?? [])
      .slice(0, -1)
      .reverse()
      .map((id) => this.nachId().get(id))
      .filter((e): e is Entity => !!e),
  );
  protected readonly aktuell = computed(() => this.antwort()?.items[this.pos()] ?? null);

  protected leerText(): string {
    const q = this.frage();
    const leer = !q.types.length && !q.articles.length && !q.tags.length && !q.layers.length && !q.steps;
    if (leer) return this.einstellen() ? 'Choose types, tags, layers or articles above.' : 'No source yet — open ⚙ to choose what this card shows.';
    return 'Nothing here — or nothing you may see yet.';
  }

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected typLabel(e: Entity): string {
    const t = primaryInterface(e);
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }
  protected woerter(text: string): string[] {
    return text.split(',').map((x) => x.trim()).filter(Boolean);
  }

  protected setze(props: Record<string, unknown>): void {
    this.aendern.emit(props);
  }
  protected frageSetzen(teil: Partial<BoardQuery>): void {
    this.aendern.emit({ query: storedQuery({ ...this.frage(), ...teil }) });
  }
  protected typenSetzen(sel: HTMLSelectElement): void {
    this.frageSetzen({ types: [...sel.selectedOptions].map((o) => o.value) });
  }
  protected ebenenSetzen(sel: HTMLSelectElement): void {
    this.frageSetzen({ layers: [...sel.selectedOptions].map((o) => o.value) });
  }
  protected artikelDazu(e: Entity): void {
    this.frageSetzen({ articles: [...this.frage().articles, e.id] });
  }
  protected artikelWeg(id: string): void {
    this.frageSetzen({ articles: this.frage().articles.filter((x) => x !== id) });
  }

  protected async ziehen(): Promise<void> {
    this.zieht.set(true);
    this.freigabe.set(null);
    try {
      const r = await this.api.boardDraw(this.board(), this.rel().id);
      if (r.revealed) {
        const f = r.revealed;
        this.freigabe.set(
          !f.party
            ? 'Not revealed: this campaign has no party.'
            : `Revealed to the party${f.known ? ` · ${f.known} information` : ''}${f.skipped.length ? ` · not yours to change: ${f.skipped.join(', ')}` : ''}`,
        );
      }
      await this.laden();
      /* Das Board holt seinen Stand — sonst schriebe der nächste Griff einen alten zurück. */
      void this.bestand.oeffnen(this.board(), true, false);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.zieht.set(false);
    }
  }

  protected async zuruecksetzen(): Promise<void> {
    this.zieht.set(true);
    try {
      await this.api.boardReset(this.board(), this.rel().id);
      this.freigabe.set(null);
      await this.laden();
      void this.bestand.oeffnen(this.board(), true, false);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.zieht.set(false);
    }
  }

  protected blaettern(schritt: number): void {
    const n = this.antwort()?.items.length ?? 0;
    if (!n) return;
    this.zaehler = 0;
    this.pos.set((this.pos() + schritt + n) % n);
  }

  /** Vollbild für den zweiten Bildschirm: nur die Slideshow, nicht das Board. */
  protected vollbildUmschalten(): void {
    const el = this.show()?.nativeElement ?? (this.host.nativeElement as HTMLElement);
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.();
  }
}
