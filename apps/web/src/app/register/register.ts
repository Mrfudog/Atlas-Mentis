import { Component, ViewEncapsulation, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { typeList, viewKeys } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { RegisterArbeit } from './arbeit';
import { RegKante } from './kante';
import { RegKantentabelle } from './kantentabelle';
import { RegListe } from './liste';
import { techName } from './regeln';
import { RegTyp } from './typ';
import { Ansichtsliste } from '../ansichten/liste';
import { RegTokens } from './tokens';
import { Ansichtsdesigner } from '../ansichten/designer';
import { wahlAnsichten } from '../ansichten/uebersicht';

type Reiter = 'types' | 'edges' | 'lists' | 'views' | 'tokens';

/**
 * **Das Register** (W5): die Zeilen, aus denen alles besteht — Typen,
 * Kanten, Listen. Nach `docs/design/Registry.dc.html` und dem Register des
 * Prototyps.
 *
 * Links die Liste, **flach und alphabetisch** (`typeList()`): ein Baum aus
 * `extends` müsste bei zwei Obertypen einen verschweigen. Rechts eine
 * Zeile auf einer Fläche. Was gewählt ist, steht in der Adresse
 * (`?type=`, `?tab=edges&edge=`, `?tab=lists&list=`), damit das Kompendium
 * mit „Edit type" genau dorthin zeigen kann.
 *
 * Lesen darf jeder, der angemeldet ist — das Register liegt ohnehin bei
 * jedem Artikel mit. **Ändern** die Verwaltung und die Leitung der
 * laufenden Kampagne; ob, sagt der Server (`/api/me`), und er prüft es
 * beim Schreiben noch einmal.
 */
@Component({
  selector: 'nw-register',
  imports: [RouterLink, RegTyp, RegKante, RegKantentabelle, RegListe, Ansichtsliste, Ansichtsdesigner, RegTokens],
  template: `
    <div class="seite">
      <nav class="leiste" [class.zu]="!!gewaehlt() && !listeOffen()" aria-label="Registry rows">
        <input type="search" [placeholder]="suchText()" [attr.aria-label]="suchText()"
          [value]="suche()" (input)="suche.set($any($event.target).value)" />
        @for (z of zeilen(); track z.name) {
          <a [routerLink]="[]" [queryParams]="z.query" class="typ" [class.an]="z.name === gewaehlt()"
            [attr.aria-current]="z.name === gewaehlt() ? 'true' : null" (click)="listeOffen.set(false)"
            >{{ z.label }}
            @if (z.zusatz) {
              <span>{{ z.zusatz }}</span>
            }
          </a>
        } @empty {
          <span class="dim">Nothing matches.</span>
        }
        @if (darf()) {
          <button type="button" class="neu" (click)="neuOffen.set(true); listeOffen.set(false)">+ {{ neuText() }}</button>
        }
      </nav>

      <main class="haupt">
        <div class="kopf">
          <h1>Registry</h1>
          <div class="reiter" role="tablist">
            @for (r of reiterListe; track r.k) {
              <a role="tab" [routerLink]="[]" [queryParams]="{ tab: r.k === 'types' ? null : r.k, type: null, edge: null, list: null, view: null, create: null, design: null }"
                [class.an]="reiter() === r.k" [attr.aria-selected]="reiter() === r.k">{{ r.label }}</a>
            }
          </div>
          @if (gewaehlt()) {
            <button type="button" class="nurklein" (click)="listeOffen.set(!listeOffen())">
              {{ listeOffen() ? 'Hide list' : 'All ' + reiterLabel() }}
            </button>
          }
        </div>

        @if (!darf()) {
          <p class="hint">You can read the registry. Changing it is for the administration and the GM of the running campaign.</p>
        }
        @if (arbeit.fehler(); as f) {
          <p class="fehler" role="alert">
            {{ f }} <button type="button" class="klein" (click)="arbeit.fehler.set(null)" aria-label="Dismiss">×</button>
          </p>
        }

        @if (!bestand.geladen()) {
          <p class="leer">Loading…</p>
        } @else if (neuOffen() && darf()) {
          <section class="kasten" aria-label="New">
            <h3>New {{ neuText() }}</h3>
            <form class="neuform" (submit)="$event.preventDefault(); anlegen(neuLabel.value, $any($event.target).elements.namedItem('nimmt')?.value ?? '', $any($event.target).elements.namedItem('wie')?.value ?? 'like')">
              <label class="f">
                <span>Label</span>
                <input #neuLabel type="text" [placeholder]="platzhalter()" required />
              </label>
              @if (reiter() === 'views') {
                <label class="f">
                  <span>Start from</span>
                  <select name="nimmt">
                    @for (v of ansichtsListe(); track v) {
                      <option [value]="v" [selected]="v === 'quick'">{{ bestand.registry()?.views?.[v]?.label ?? v }}</option>
                    }
                  </select>
                </label>
                <p class="hint">A new view starts as a copy of the one you pick. It is chosen on a board tile and when printing.</p>
              }
              @if (reiter() === 'types') {
                <label class="f">
                  <span>Start from</span>
                  <select name="nimmt" (change)="start.set($any($event.target).value)">
                    <option value="" [selected]="!start()">nothing — its own fields only</option>
                    @for (t of alleTypen(); track t) {
                      <option [value]="t" [selected]="t === start()">{{ typLabel(t) }}</option>
                    }
                  </select>
                </label>
                @if (start()) {
                  <div class="f">
                    <span>As</span>
                    <div class="wahl">
                      <label class="haken"><input type="radio" name="wie" value="like" checked />
                        built like {{ typLabel(start()) }} — takes the same types and area: {{ nimmtText() }}</label>
                      <label class="haken"><input type="radio" name="wie" value="kind" />
                        a kind of {{ typLabel(start()) }} — takes it, its own fields included</label>
                    </div>
                  </div>
                }
                <p class="hint">
                  A new type is creatable. <b>Built like</b> gives it the same shared types (Identity, Status …) and none of
                  the other’s own fields; <b>a kind of</b> makes it a subtype that also carries them and is found wherever the
                  other is. Fields of its own are added on its page.
                </p>
              }
              <div class="knoepfe">
                <button type="submit" class="pri" [disabled]="arbeit.speichert()">Create</button>
                <button type="button" (click)="neuOffen.set(false)">Cancel</button>
              </div>
            </form>
          </section>
        } @else if (reiter() === 'types' && type()) {
          <nw-reg-typ [name]="type()!" [darf]="darf()" />
        } @else if (reiter() === 'edges' && edge()) {
          <nw-reg-kante [name]="edge()!" [darf]="darf()" />
        } @else if (reiter() === 'lists' && list()) {
          <nw-reg-liste [name]="list()!" [darf]="darf()" />
        } @else if (reiter() === 'views' && ((design() === 'new' && darf()) || view())) {
          <!-- Die Ansichten oben zur Wahl (T-318): die Liste links ist im Register meist die lange Typenliste. -->
          <nav class="ansichtswahl" aria-label="Views">
            @for (v of wahl(); track v.key) {
              <a [routerLink]="[]" [queryParams]="{ tab: 'views', view: v.key, type: type() ?? null, design: null }"
                 [class.an]="v.key === view()" [attr.aria-current]="v.key === view() ? 'true' : null">{{ v.label }}</a>
            }
            <a [routerLink]="[]" [queryParams]="{ tab: 'views', view: null, type: null, design: null }">All views</a>
          </nav>
          <!-- Der Ansichtseditor (T-268, T-276): der einzige — für jede Ansicht, auch die der Orte. -->
          <nw-ansichtsdesigner [schluessel]="design() === 'new' ? null : (view() ?? null)" [typ]="type() ?? null" [darf]="darf()"
                               (fertig)="designFertig($event)" />
        } @else if (reiter() === 'views') {
          <nw-ansichtsliste />
        } @else if (reiter() === 'tokens') {
          <!-- Design-Tokens (T-425, REQ-437, E-170). -->
          <nw-reg-tokens [darf]="darf()" />
        } @else if (reiter() === 'edges') {
          <!-- Wie Kanten wirken (T-111): je Kantenart Bedeutung und
               Wirkung, gerechnet aus den Auswertern (edgeEffects). -->
          <nw-reg-kantentabelle [suche]="suche()" />
        } @else {
          <p class="leer">Pick a {{ reiter() === 'types' ? 'type' : reiter() === 'edges' ? 'kind of edge' : reiter() === 'views' ? 'view' : 'list' }} on the left.</p>
        }
      </main>
    </div>

    @if (arbeit.frage(); as q) {
      <div class="dlg" (click)="arbeit.frage.set(null)" (keydown.escape)="arbeit.frage.set(null)">
        <div class="dlgbox" role="alertdialog" aria-modal="true" [attr.aria-label]="q.titel" (click)="$event.stopPropagation()">
          <h3>{{ q.titel }}</h3>
          @for (t of q.text; track $index) {
            <p>{{ t }}</p>
          }
          <div class="knoepfe">
            @if (q.tun) {
              <button type="button" class="pri" (click)="bestaetigen()">{{ q.ja }}</button>
              <button type="button" (click)="arbeit.frage.set(null)">Cancel</button>
            } @else {
              <button type="button" class="pri" (click)="arbeit.frage.set(null)">{{ q.ja }}</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  /* Die Ansichtswahl (T-318) in einer eigenen Datei: das Budget je Datei. */
  styleUrls: ['./register.scss', './ansichtswahl.scss'],
  /* Die Bausteine darin (Typ, Feld, Kante, Liste) teilen einen Stil. Ohne
     Kapselung steht er einmal in der Seite statt viermal; er gilt nur
     unter `nw-register`. */
  encapsulation: ViewEncapsulation.None,
})
export class Register {
  readonly type = input<string | undefined>(undefined);
  readonly tab = input<string | undefined>(undefined);
  readonly edge = input<string | undefined>(undefined);
  readonly list = input<string | undefined>(undefined);
  /** `?tab=views&view=` — eine Ansicht (T-110). */
  readonly view = input<string | undefined>(undefined);
  /** `?design=1` (eine Ansicht im Designer) oder `?design=new` (T-268). */
  readonly design = input<string | undefined>(undefined);
  /** `?create=1` — aus dem Kompendium, „New type". */
  readonly create = input<string | undefined>(undefined);
  /** `?from=Typ` — der Typ, den ein neuer nehmen soll. */
  readonly from = input<string | undefined>(undefined);

  protected readonly bestand = inject(Bestand);
  protected readonly arbeit = inject(RegisterArbeit);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly suche = signal('');
  protected readonly neuOffen = signal(false);
  protected readonly listeOffen = signal(false);
  protected readonly reiterListe: { k: Reiter; label: string }[] = [
    { k: 'types', label: 'Types' },
    { k: 'edges', label: 'Edges' },
    { k: 'lists', label: 'Lists' },
    { k: 'views', label: 'Views' },
    { k: 'tokens', label: 'Tokens' },
  ];

  protected readonly darf = this.session.darfRegister;
  protected readonly reiter = computed<Reiter>(() =>
    this.tab() === 'edges' ? 'edges' : this.tab() === 'lists' ? 'lists' : this.tab() === 'views' ? 'views' : this.tab() === 'tokens' ? 'tokens' : 'types',
  );
  protected readonly reiterLabel = computed(() => this.reiterListe.find((r) => r.k === this.reiter())!.label.toLowerCase());
  protected readonly gewaehlt = computed(() =>
    this.reiter() === 'types'
      ? this.type()
      : this.reiter() === 'edges'
        ? this.edge()
        : this.reiter() === 'views'
          ? this.view()
          : this.list(),
  );
  /** Woraus ein neuer Typ entsteht — vorbelegt mit `?from=`. */
  protected readonly start = signal('');
  protected readonly nimmtText = computed(() => {
    const r = this.bestand.registry();
    const p = r?.interfaces[this.start()]?.extends ?? [];
    return p.length ? p.map((t) => this.typLabel(t)).join(', ') : 'nothing';
  });
  protected readonly suchText = computed(() => `Filter ${this.reiterLabel()}`);
  protected readonly neuText = computed(() =>
    this.reiter() === 'types'
      ? 'New type'
      : this.reiter() === 'edges'
        ? 'New edge kind'
        : this.reiter() === 'views'
          ? 'New view'
          : 'New list',
  );
  protected readonly platzhalter = computed(() =>
    this.reiter() === 'types'
      ? 'e.g. Vehicle'
      : this.reiter() === 'edges'
        ? 'e.g. owes a favour to'
        : this.reiter() === 'views'
          ? 'e.g. Handout'
          : 'e.g. Weather',
  );
  /** Die Ansichten oben über dem Designer (T-318). */
  protected readonly wahl = computed(() => {
    const r = this.bestand.registry();
    return r ? wahlAnsichten(r) : [];
  });
  protected readonly ansichtsListe = computed(() => {
    const r = this.bestand.registry();
    return r ? viewKeys(r) : [];
  });

  constructor() {
    void this.bestand.load();
    effect(() => {
      if (this.darf()) void this.arbeit.zaehlen();
    });
    effect(() => {
      if (this.create()) this.neuOffen.set(true);
      this.start.set(this.from() ?? '');
    });
    /* Eine andere Zeile gewählt: das Formular für eine neue geht zu, die
       Fehlermeldung der vorigen auch. */
    effect(() => {
      this.gewaehlt();
      this.reiter();
      if (!this.create()) this.neuOffen.set(false);
      this.arbeit.fehler.set(null);
    });
  }

  protected readonly alleTypen = computed(() => {
    const r = this.bestand.registry();
    return r ? typeList(r) : [];
  });
  protected typLabel(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  /**
   * Artikel je Art — aus der Zählung am Server. Bis sie da ist, steht keine
   * Zahl: der Browser hält keinen Bestand mehr (W7), und eine Null wäre
   * eine falsche Auskunft.
   */
  private readonly jeArt = computed(() => this.arbeit.usage()?.types ?? null);

  protected readonly zeilen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const q = this.suche().trim().toLocaleLowerCase();
    const passt = (name: string, label: string) =>
      !q || name.toLocaleLowerCase().includes(q) || label.toLocaleLowerCase().includes(q);
    if (this.reiter() === 'edges') {
      return Object.entries(r.relations)
        .map(([name, d]) => ({ name, label: d.label || name, zusatz: name, query: { tab: 'edges', edge: name } }))
        .filter((z) => passt(z.name, z.label))
        .sort((a, b) => a.label.localeCompare(b.label, 'en'));
    }
    if (this.reiter() === 'views') {
      return viewKeys(r)
        .map((name) => ({ name, label: r.views[name]?.label ?? name, zusatz: name, query: { tab: 'views', view: name } }))
        .filter((z) => passt(z.name, z.label));
    }
    if (this.reiter() === 'tokens') {
      return Object.entries(r.tokens ?? {})
        .map(([name, d]) => ({ name, label: d.label, zusatz: d.role, query: { tab: 'tokens' } }))
        .filter((z) => passt(z.name, z.label))
        .sort((a, b) => a.label.localeCompare(b.label, 'en'));
    }
    if (this.reiter() === 'lists') {
      return Object.entries(r.enums ?? {})
        .map(([name, d]) => ({ name, label: d.label ?? name, zusatz: String(d.values.length), query: { tab: 'lists', list: name } }))
        .filter((z) => passt(z.name, z.label))
        .sort((a, b) => a.label.localeCompare(b.label, 'en'));
    }
    const zahl = this.jeArt();
    /* Im Stapel / gespeichert (T-069) — eine Zahl, wenn beide gleich sind. */
    const da = this.arbeit.usage()?.inPlay;
    return typeList(r)
      .map((name) => {
        const d = r.interfaces[name]!;
        const n = zahl?.[name] ?? 0;
        const sichtbar = da ? (da[name] ?? 0) : n;
        const text = !n ? '' : sichtbar === n ? n.toLocaleString('en') : `${sichtbar.toLocaleString('en')} / ${n.toLocaleString('en')}`;
        return { name, label: d.label ?? name, zusatz: d.abstract ? 'shared' : text, query: { type: name } };
      })
      .filter((z) => passt(z.name, z.label));
  });

  protected bestaetigen(): void {
    const q = this.arbeit.frage();
    this.arbeit.frage.set(null);
    void q?.tun?.();
  }

  /** Eine neue Zeile — der Name kommt aus der Beschriftung (`Sky ship` → `SkyShip`). */
  protected async anlegen(roh: string, nimmt: string, wie: string): Promise<void> {
    const label = roh.trim();
    const r = this.bestand.registry();
    if (!label || !r) return;
    if (this.reiter() === 'types') {
      const name = techName(label, r.interfaces);
      /* „Gebaut wie" nimmt dieselben Obertypen, „eine Sorte von" den Typ
         selbst. Kopiert wird die Liste der Namen, nicht die Felder. */
      const obertypen = !nimmt ? [] : wie === 'kind' ? [nimmt] : [...(r.interfaces[nimmt]?.extends ?? [])];
      const ok = await this.arbeit.aendern('interfaces', (ifs) => {
        ifs[name] = {
          name,
          label,
          ...(obertypen.length ? { extends: obertypen } : {}),
          /* Gebaut wie ein Ort steht auch dort, wo Orte stehen. */
          ...(nimmt && wie !== 'kind' && r.interfaces[nimmt]?.area ? { area: r.interfaces[nimmt]!.area } : {}),
          schema: { type: 'object', properties: {} },
        };
      });
      if (ok) await this.zu({ type: name });
    } else if (this.reiter() === 'edges') {
      const name = techName(label, r.relations, true);
      const ok = await this.arbeit.aendern('relations', (rels) => {
        rels[name] = { type: name, label, inverseLabel: `← ${label}`, from: ['*'], to: ['*'] };
      });
      if (ok) await this.zu({ tab: 'edges', edge: name });
    } else if (this.reiter() === 'views') {
      /* Der Schlüssel klein wie `quick`; die neue Ansicht ist eine Kopie der gewählten. */
      const name = techName(label, r.views, true);
      const von = r.views[nimmt] ?? r.views['quick'];
      const ok = await this.arbeit.aendern('views', (views) => {
        views[name] = {
          ...structuredClone(von ?? { fields: 'none' as const, layout: [] }),
          label,
          order: Math.max(0, ...Object.values(views).map((v) => v.order ?? 0)) + 1,
        };
      });
      if (ok) await this.zu({ tab: 'views', view: name });
    } else {
      const name = techName(label, r.enums ?? {});
      const ok = await this.arbeit.aendern('enums', (enums) => {
        enums[name] = { name, label, values: [] };
      });
      if (ok) await this.zu({ tab: 'lists', list: name });
    }
  }

  protected designFertig(key: string | null): void {
    void this.router.navigate(['/registry'], { queryParams: key ? { tab: 'views', view: key } : { tab: 'views' } });
  }

  private async zu(query: Record<string, string>): Promise<void> {
    this.neuOffen.set(false);
    await this.router.navigate(['/registry'], { queryParams: query });
  }
}
