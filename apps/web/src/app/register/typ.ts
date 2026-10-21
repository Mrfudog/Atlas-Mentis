import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  areaOf,
  articlesTaking,
  fieldTitle,
  appliesText,
  isDesignedView,
  layoutFor,
  linkedTypes,
  ownFields,
  relationsFrom,
  typeChain,
  typeList,
  viewGroup,
  viewKeys,
  MARKER_VIEWS,
} from '@nw/model';
import type { InterfaceDef, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { BEREICHE } from '../kern/bereiche';
import { RegisterArbeit, articles, carry, inPlayText } from './arbeit';
import { RegFeld } from './feld';
import { Kapitel, Kapitelteil } from '../muster/kapitel';
import {
  ancestorsOf,
  childrenOf,
  droppedBy,
  fieldKey,
  holds,
  mentionsOf,
  parentsOf,
  takersOf,
  viaOf,
  withSchema,
  wouldCycle,
} from './regeln';

interface Gruppe {
  typ: string;
  label: string;
  via: string | null;
  bereich: boolean;
  felder: string[];
  nehmer: number;
}

/**
 * **Ein Typ auf einer Fläche** (CLAUDE.md: das Register): oben was ihn
 * ausmacht, darunter seine eigenen Felder offen, die geerbten Typen
 * zugeklappt — je einer eine Kopfzeile mit Herkunft, Feldzahl und einem ×
 * nur am direkt dazugenommenen. Dahinter die verlinkten Typen
 * (gestrichelt), die Kanten von hier (gepunktet), an einer anlegbaren Art
 * die Ansichten, und zuletzt das Entfernen.
 *
 * **Auf- und Zuklappen zeichnet nicht neu:** die Zeilen einer Gruppe stehen
 * schon da und werden nur gezeigt (`hidden`); der Stand lebt in
 * `RegisterArbeit.offen` und hält über ein Speichern und einen Wechsel.
 */
@Component({
  selector: 'nw-reg-typ',
  imports: [RouterLink, RegFeld, Kapitel, Kapitelteil],
  template: `
    @if (def(); as d) {
      <div class="typkopf">
        <h2>{{ d.label ?? name() }}</h2>
        <code>{{ name() }}</code>
        <span>{{ d.abstract ? 'shared type — no articles of its own' : 'creatable' }}</span>
        @if (bereich()) {
          <span>area <strong>{{ bereich() }}</strong></span>
        }
        @if (!d.abstract) {
          <span class="dim">{{ artikelText() }}</span>
        }
        @if (kinder().length) {
          <span class="dim"
            >taken by:
            @for (k of kinder(); track k; let last = $last) {
              <a [routerLink]="[]" [queryParams]="{ type: k }">{{ label(k) }}</a>{{ last ? '' : ', ' }}
            }
          </span>
        }
      </div>

      <!-- Die Kapitel der Typseite (T-277): am Telefon Reiter, am Desktop
           Felder links breit, Kurzangaben und Kanten rechts schmal. -->
      <nw-kapitel>
      <nw-kapitelteil key="type" titel="This type" lage="seite">
        <label class="f">
          <span>Label</span>
          <input type="text" [value]="d.label ?? ''" [placeholder]="name()" [disabled]="!darf()"
            (change)="setzen({ label: wert($event) || undefined })" />
        </label>
        <p class="hint">How the type is called in lists, filters and on its articles.</p>
        <label class="f">
          <span>Kind</span>
          <select [disabled]="!darf()" (change)="artSetzen($any($event.target))">
            <option value="" [selected]="!d.abstract">creatable — articles of its own</option>
            <option value="1" [selected]="!!d.abstract">shared — only lends its fields</option>
          </select>
        </label>
        <p class="hint">
          A <b>creatable</b> type has articles and stands in the compendium; a <b>shared</b> one is taken in by others
          and brings its fields along.
        </p>
        <label class="f">
          <span>Area</span>
          <select [disabled]="!darf()" (change)="setzen({ area: $any($any($event.target).value) || undefined })">
            <option value="" [selected]="!d.area">{{ geerbterBereich() ? 'inherited — ' + geerbterBereich() : '— compendium only' }}</option>
            @for (b of bereiche; track b.weg) {
              <option [value]="b.weg" [selected]="d.area === b.weg">{{ b.label }}</option>
            }
          </select>
        </label>
        <p class="hint">
          Where its articles are found besides the compendium. Without its own, the first type taken in decides
          (● below), and every subtype inherits it.
        </p>
        <label class="f">
          <span>Units</span>
          <select [disabled]="!darf()" (change)="setzen({ units: $any($any($event.target).value) || undefined })">
            <option value="" [selected]="!d.units">as the campaign shows them</option>
            <option value="imperial" [selected]="d.units === 'imperial'">imperial</option>
            <option value="metric" [selected]="d.units === 'metric'">metric</option>
            <option value="both" [selected]="d.units === 'both'">both</option>
          </select>
        </label>
        <p class="hint">Measures are stored in their own unit and converted on read; this overrides the campaign setting for this type and its subtypes.</p>
        <!-- **Als Marker** (T-214, \`InterfaceDef.markerView\`): geerbt die \`extends\`-Kette hoch. -->
        <label class="f">
          <span>On a map</span>
          <select [disabled]="!darf()" (change)="setzen({ markerView: $any($any($event.target).value) || undefined })">
            <option value="" [selected]="!d.markerView">{{ geerbteMarkeransicht() ? 'inherited — ' + geerbteMarkeransicht() : 'image (default)' }}</option>
            @for (v of MARKER_VIEWS; track v.key) {
              <option [value]="v.key" [selected]="d.markerView === v.key">{{ v.label }}</option>
            }
          </select>
        </label>
        <p class="hint">How its articles stand as markers: symbol, symbol with name, image or quick card. The campaign can set it per map kind, a map for its markers, and a single marker for itself.</p>
      </nw-kapitelteil>

      <nw-kapitelteil key="fields" titel="Own fields" lage="haupt" [zahl]="eigene().length"
                      [hinweis]="eigene().length ? '' : 'nothing of its own'">
        @for (k of eigene(); track k) {
          <div class="frow">
            <code class="fk">{{ k }}{{ pflicht(name(), k) ? '*' : '' }}</code>
            <input type="text" class="flabel" aria-label="Label" [value]="prop(name(), k)?.title ?? ''" [placeholder]="k"
              [disabled]="!darf()" (change)="titelSetzen(k, wert($event))" />
            <span class="holds">{{ haelt(name(), k) }}</span>
            @if (zaehlung(name(), k); as z) {
              <span class="dim zahl" [title]="z + ' carry a value'">{{ z }}</span>
            }
            <button type="button" class="klein" [attr.aria-expanded]="feldOffen() === name() + '.' + k"
              (click)="feldUmschalten(name() + '.' + k)" title="Settings">{{ feldOffen() === name() + '.' + k ? '▴' : '⋯' }}</button>
          </div>
          @if (feldOffen() === name() + '.' + k) {
            <nw-reg-feld [owner]="name()" [key]="k" [within]="name()" [darf]="darf()" />
          }
        }
        @if (darf()) {
          <form class="addbar" (submit)="$event.preventDefault(); feldNeu(neuKey, neuLabel)">
            <input #neuKey type="text" placeholder="Field name, e.g. weight" aria-label="New field key" />
            <input #neuLabel type="text" placeholder="Label" aria-label="New field label" />
            <button type="submit">+ Field</button>
          </form>
        }
      </nw-kapitelteil>

      <nw-kapitelteil key="inherited" titel="Inherited" lage="haupt" [zahl]="gruppen().length"
                      [zeigen]="!!(gruppen().length || verlinkt().length || darf())"
                      [hinweis]="geerbteFelder() + (geerbteFelder() === 1 ? ' field' : ' fields')">
          @for (g of gruppen(); track g.typ) {
            <div class="teil">
              <div class="fhead" role="button" tabindex="0" [attr.aria-expanded]="offen(name() + '::' + g.typ)"
                (click)="klappen(name() + '::' + g.typ)" (keydown.enter)="klappen(name() + '::' + g.typ)">
                <span class="twist">{{ offen(name() + '::' + g.typ) ? '▾' : '▸' }}</span>
                <a [routerLink]="[]" [queryParams]="{ type: g.typ }" (click)="$event.stopPropagation()">{{ g.label }}</a>
                <span class="pill">{{ g.via ? 'via ' + label(g.via) : 'taken in here' }}</span>
                @if (g.bereich) {
                  <span class="pill" title="The first type taken in decides the area">● area</span>
                }
                <span class="dim">{{ g.felder.length ? g.felder.length + (g.felder.length === 1 ? ' field' : ' fields') : 'no fields' }}</span>
                @if (darf() && !g.via) {
                  <button type="button" class="klein weg" [title]="'Take ' + g.label + ' out of ' + (d.label ?? name())"
                    (click)="$event.stopPropagation(); herausnehmen(g.typ)">×</button>
                }
              </div>
              <div class="partfields" [hidden]="!offen(name() + '::' + g.typ)">
                <p class="hint">
                  These fields belong to {{ g.label }}. A change to them holds for every type that takes it ({{ g.nehmer }});
                  the name next to a field is what it is called here.
                </p>
                @for (k of g.felder; track k) {
                  <div class="frow">
                    <code class="fk">{{ k }}{{ pflicht(g.typ, k) ? '*' : '' }}</code>
                    <input type="text" class="flabel" aria-label="Called here" [value]="hierHeisst(g.typ, k)"
                      [placeholder]="prop(g.typ, k)?.title ?? k" [disabled]="!darf() || !!fremdUmbenannt(g.typ, k)"
                      [title]="fremdUmbenannt(g.typ, k) ? 'Renamed at ' + label(fremdUmbenannt(g.typ, k)!) + ' — change it there' : 'What this field is called here. Empty means the name it brings.'"
                      (change)="umbenennenHier(g.typ, k, wert($event))" />
                    <span class="holds">{{ haelt(g.typ, k) }}</span>
                    @if (zaehlung(g.typ, k); as z) {
                      <span class="dim zahl" [title]="z + ' carry a value'">{{ z }}</span>
                    }
                    <button type="button" class="klein" [attr.aria-expanded]="feldOffen() === g.typ + '.' + k"
                      (click)="feldUmschalten(g.typ + '.' + k)"
                      [title]="'Settings — they belong to ' + g.label + ' and hold for every type that takes it'">{{ feldOffen() === g.typ + '.' + k ? '▴' : '⋯' }}</button>
                  </div>
                  @if (feldOffen() === g.typ + '.' + k) {
                    <nw-reg-feld [owner]="g.typ" [key]="k" [within]="name()" [darf]="darf()" />
                  }
                } @empty {
                  <p class="hint">This type brings no fields — it is taken in for its edges or its arrangement.</p>
                }
              </div>
            </div>
          }

          @for (l of verlinkt(); track l.relation) {
            <div class="teil verlinkt">
              <div class="fhead" role="button" tabindex="0" [attr.aria-expanded]="offen(name() + '::→' + l.type)"
                (click)="klappen(name() + '::→' + l.type)" (keydown.enter)="klappen(name() + '::→' + l.type)">
                <span class="twist">{{ offen(name() + '::→' + l.type) ? '▾' : '▸' }}</span>
                <a [routerLink]="[]" [queryParams]="{ type: l.type }" (click)="$event.stopPropagation()">{{ label(l.type) }}</a>
                <span class="pill" [title]="'Its own article, held by the edge ' + l.relation + '. The values do not live in this type’s card.'">linked · {{ l.relation }}</span>
                <span class="dim">{{ l.felder.length }} fields, shown on its side</span>
              </div>
              <div class="partfields" [hidden]="!offen(name() + '::→' + l.type)">
                @for (f of l.felder; track f.typ + f.key) {
                  <div class="frow lesen">
                    <code class="fk">{{ f.key }}</code>
                    <span>{{ f.titel }}</span>
                    <span class="holds">{{ haelt(f.typ, f.key) }}</span>
                    <a class="dim" [routerLink]="[]" [queryParams]="{ type: f.typ }">{{ label(f.typ) }}</a>
                  </div>
                }
              </div>
            </div>
          }


      @if (darf()) {
        <div class="addbar">
          <span class="dim">{{ parents().length ? 'Take a type in — its fields come along' : 'This type declares its fields itself. Take one in and its fields come along' }}</span>
          <select aria-label="Take a type in" (change)="hereinnehmen($any($event.target))">
            <option value="">+ type…</option>
            @for (t of nehmbar(); track t) {
              <option [value]="t">{{ label(t) }}</option>
            }
          </select>
        </div>
      }
      </nw-kapitelteil>

      <!-- Kanten sind keine Felder: ein eigenes Kapitel, am Desktop zugeklappt wie die geerbten. -->
      <nw-kapitelteil key="edges" titel="Edges from here" lage="seite" [zu]="true" [zahl]="kanten().genannt.length"
                      [zeigen]="!!(kanten().genannt.length || kanten().allgemein)">
        <p class="hint">Not fields: an edge points at another article and is stored in one direction. The other way round is a query.</p>
        @for (r of kanten().genannt; track r.type) {
          <div class="frow lesen">
            <a class="fk" [routerLink]="[]" [queryParams]="{ tab: 'edges', edge: r.type }">{{ r.type }}</a>
            <span>{{ r.label }}</span>
            <span class="holds">→ {{ (r.to ?? ['*']).join(', ') }}</span>
            <span class="pill">{{ r.cardinality === 'one' ? 'one' : 'many' }}{{ r.owned ? ' · owned' : '' }}</span>
          </div>
        }
        @if (kanten().allgemein) {
          <p class="hint">Plus {{ kanten().allgemein }} edge kinds that hit every type (*) — they say nothing about this one.</p>
        }
      </nw-kapitelteil>

      <nw-kapitelteil key="views" titel="Views" lage="voll" [zahl]="ansichten().length" [zeigen]="!d.abstract">
          <p class="hint">
            The views that apply to {{ label(name()) }} and why — <b>overview</b> in a link or list row, <b>quick</b> on a card,
            <b>full</b> on its page, <b>print</b> on paper, and your own. The most specific one of a group wins; “Design” opens the
            view designer with this type chosen, where it is changed for every article, for this type (its own or adjusted) or
            under a condition.
          </p>
          <div class="ansichten-tabelle" role="table" aria-label="Views of this type">
            <div role="row" class="az k">
              <span role="columnheader">View</span><span role="columnheader">Group</span>
              <span role="columnheader">Applies</span><span role="columnheader">From</span><span role="columnheader"></span>
            </div>
            @for (v of ansichten(); track v.key) {
              <div role="row" class="az">
                <span role="cell"><b>{{ v.label }}</b></span>
                <span role="cell">{{ v.gruppe }}</span>
                <span role="cell">{{ v.gilt }}</span>
                <span role="cell" class="dim">{{ v.herkunft }}</span>
                <span role="cell">
                  <a class="knopf klein" [routerLink]="['/registry']" [queryParams]="{ tab: 'views', view: v.key, type: name() }">Design</a>
                </span>
              </div>
            }
          </div>
      </nw-kapitelteil>
      </nw-kapitel>

      @if (darf()) {
        <div class="knoepfe">
          <button type="button" class="weg" [disabled]="!!entfernenGrund()" (click)="entfernen()">Remove type</button>
          @if (entfernenGrund(); as g) {
            <span class="dim">{{ g }}</span>
          }
        </div>
      }
    } @else {
      <p class="leer">There is no type {{ name() }}.</p>
    }
  `,
  /* Gezeichnet im Stil der Registerseite (`register.scss`, einmal geladen). */
})
export class RegTyp {
  readonly name = input.required<string>();
  readonly darf = input(false);

  private readonly bestand = inject(Bestand);
  protected readonly arbeit = inject(RegisterArbeit);
  protected readonly bereiche = BEREICHE;
  protected readonly feldOffen = signal<string | null>(null);
  /** Der Entwurf einer Ansicht dieser Art: `null` heisst „wie die Ansicht" (T-110). */

  private readonly reg = computed(() => this.bestand.registry() as Registry | null);
  protected readonly def = computed(() => this.reg()?.interfaces[this.name()]);
  protected readonly bereich = computed(() => (this.reg() ? areaOf(this.reg()!, this.name()) : ''));
  protected readonly geerbterBereich = computed(() => {
    const r = this.reg();
    if (!r) return '';
    for (const t of ancestorsOf(r, this.name())) if (r.interfaces[t]?.area) return r.interfaces[t]!.area!;
    return '';
  });
  /** Was ein Obertyp für die Markeransicht sagt (T-214); leer: keiner. */
  protected readonly geerbteMarkeransicht = computed(() => {
    const r = this.reg();
    if (!r) return '';
    for (const t of ancestorsOf(r, this.name())) if (r.interfaces[t]?.markerView) return r.interfaces[t]!.markerView!;
    return '';
  });
  protected readonly MARKER_VIEWS = MARKER_VIEWS;
  protected readonly parents = computed(() => (this.reg() ? parentsOf(this.reg()!, this.name()) : []));
  protected readonly kinder = computed(() => (this.reg() ? childrenOf(this.reg()!, this.name()) : []));
  protected readonly eigene = computed(() => Object.keys(this.reg() ? ownFields(this.reg()!, this.name()) : {}));

  /** Artikel dieser Art — aus der Zählung am Server; bis sie da ist, keine Zahl (W7). */
  protected readonly eigeneArtikel = computed(() => {
    const u = this.arbeit.usage();
    return u ? (u.types[this.name()] ?? 0) : null;
  });

  /** Im Stapel der laufenden Kampagne und gespeichert (T-069). */
  protected readonly artikelText = computed(() => inPlayText(this.arbeit.usage(), this.name()) ?? '');

  protected readonly gruppen = computed<Gruppe[]>(() => {
    const r = this.reg();
    if (!r) return [];
    const direkt = parentsOf(r, this.name());
    return ancestorsOf(r, this.name()).map((t) => ({
      typ: t,
      label: this.label(t),
      via: viaOf(r, this.name(), t),
      bereich: !this.def()?.area && direkt[0] === t,
      felder: Object.keys(ownFields(r, t)),
      nehmer: takersOf(r, t).length,
    }));
  });
  protected readonly geerbteFelder = computed(() => this.gruppen().reduce((n, g) => n + g.felder.length, 0));

  /** Die Typen, die über eine `asField`-Kante hängen — ihre ganze Kette. */
  protected readonly verlinkt = computed(() => {
    const r = this.reg();
    if (!r) return [];
    return linkedTypes(r, this.name()).map((l) => ({
      ...l,
      felder: typeChain(r, l.type).flatMap((t) =>
        Object.entries(ownFields(r, t)).map(([key, prop]) => ({
          typ: t,
          key,
          titel: fieldTitle(r, l.type, { type: t, key, prop }),
        })),
      ),
    }));
  });

  /** Genannt ist nicht dasselbe wie getroffen: `*` sagt über diese Art nichts. */
  protected readonly kanten = computed(() => {
    const r = this.reg();
    if (!r) return { genannt: [], allgemein: 0 };
    const schonOben = new Set(linkedTypes(r, this.name()).map((l) => l.relation));
    const kette = typeChain(r, this.name());
    const genannt = [];
    let allgemein = 0;
    for (const def of relationsFrom(r, this.name())) {
      if (schonOben.has(def.type)) continue;
      const liste = def.from ?? [];
      if (liste.length && !liste.includes('*') && liste.some((n) => kette.includes(n))) genannt.push(def);
      else allgemein++;
    }
    genannt.sort((a, b) => a.type.localeCompare(b.type));
    return { genannt, allgemein };
  });

  protected readonly nehmbar = computed(() => {
    const r = this.reg();
    if (!r) return [];
    const direkt = parentsOf(r, this.name());
    return typeList(r).filter((t) => !direkt.includes(t) && !wouldCycle(r, this.name(), t));
  });

  /**
   * **Die Ansichten, die für diese Art gelten** (T-276): je Ansicht ohne
   * Geltung, woher ihre Anordnung kommt (die Art, ein Obertyp, die
   * Ansicht); je gestalteter, ob ihre Geltung die Art nennt.
   */
  protected readonly ansichten = computed(() => {
    const r = this.reg();
    if (!r) return [];
    const kette = typeChain(r, this.name());
    const raus: { key: string; label: string; gruppe: string; gilt: string; herkunft: string }[] = [];
    for (const key of viewKeys(r)) {
      const def = r.views[key]!;
      if (isDesignedView(def)) {
        const typen = def.applies?.types ?? [];
        if (typen.length && !typen.some((t) => kette.includes(t))) continue;
        raus.push({ key, label: def.label, gruppe: viewGroup(key, def), gilt: appliesText(def.applies, (id) => this.bestand.name()(id)), herkunft: 'designed view' });
        continue;
      }
      const { from, mode } = layoutFor(r, key, this.name());
      raus.push({ key, label: def.label, gruppe: key, gilt: from ? `${this.label(from)} and its subtypes` : 'every article', herkunft: this.herkunft({ von: from, mode }) });
    }
    return raus;
  });

  /** Warum er nicht gehen kann — oder nichts. */
  protected readonly entfernenGrund = computed(() => {
    const r = this.reg();
    if (!r) return 'Not loaded.';
    const u = this.arbeit.usage();
    if (!u) return 'The stock could not be counted, so it stays.';
    const n = articlesTaking(r, u, this.name());
    if (n) return `${carry(n)} it — it stays while they do.`;
    const kinder = takersOf(r, this.name());
    if (kinder.length) return `Taken in by ${kinder.map((k) => this.label(k)).join(', ')}.`;
    const nennen = mentionsOf(r, this.name());
    if (nennen.length) return `Named elsewhere: ${nennen.slice(0, 3).join('; ')}${nennen.length > 3 ? ' …' : ''}.`;
    return '';
  });

  protected label(t: string): string {
    return this.reg()?.interfaces[t]?.label ?? t;
  }
  protected wert(ev: Event): string {
    return String((ev.target as HTMLInputElement).value ?? '').trim();
  }
  protected prop(t: string, k: string) {
    return this.reg()?.interfaces[t]?.schema?.properties[k];
  }
  protected pflicht(t: string, k: string): boolean {
    return (this.reg()?.interfaces[t]?.schema?.required ?? []).includes(k);
  }
  protected haelt(t: string, k: string): string {
    const p = this.prop(t, k);
    return p && this.reg() ? holds(this.reg()!, p) : '';
  }
  /** „12" — wie viele Artikel etwas darin tragen; nichts, wenn nicht gezählt. */
  protected zaehlung(t: string, k: string): string {
    const u = this.arbeit.usage();
    if (!u) return '';
    const n = u.cards[t]?.fields[k] ?? 0;
    return n ? n.toLocaleString('en') : '';
  }
  protected offen(s: string): boolean {
    return this.arbeit.istOffen(s);
  }
  protected klappen(s: string): void {
    this.arbeit.klappen(s);
  }
  protected feldUmschalten(id: string): void {
    this.feldOffen.update((x) => (x === id ? null : id));
  }

  private typAendern(f: (d: InterfaceDef, ifs: Registry['interfaces']) => string | void): Promise<boolean> {
    const n = this.name();
    return this.arbeit.aendern('interfaces', (ifs) => {
      const d = ifs[n];
      if (!d) return `There is no type ${n}.`;
      return f(d, ifs);
    });
  }

  protected setzen(teil: Partial<InterfaceDef>): void {
    void this.typAendern((d) => {
      for (const [k, v] of Object.entries(teil)) {
        if (v === undefined) delete (d as unknown as Record<string, unknown>)[k];
        else (d as unknown as Record<string, unknown>)[k] = v;
      }
    });
  }

  protected artSetzen(el: HTMLSelectElement): void {
    const abstrakt = el.value === '1';
    const n = this.eigeneArtikel();
    if (abstrakt && n) {
      el.value = '';
      this.arbeit.fragen({
        titel: `${this.label(this.name())} has articles`,
        text: [`${articles(n)} are of this type. A shared type has none of its own — move them to another type first.`],
        ja: 'OK',
      });
      return;
    }
    this.setzen({ abstract: abstrakt ? true : undefined });
  }

  protected titelSetzen(k: string, titel: string): void {
    void this.typAendern((d) => {
      const p = d.schema?.properties[k];
      if (!p) return `${k} is gone.`;
      if (titel) p.title = titel;
      else delete p.title;
      return undefined;
    });
  }

  /** Eine Beschriftung **für diese Art** — in ihre `titles`, nicht ins Feld. */
  protected hierHeisst(t: string, k: string): string {
    return this.def()?.titles?.[`${t}.${k}`] ?? '';
  }
  /** Ein Obertyp hat es schon umbenannt — dann wird es dort geändert. */
  protected fremdUmbenannt(t: string, k: string): string | null {
    const r = this.reg();
    if (!r || this.hierHeisst(t, k)) return null;
    for (const a of ancestorsOf(r, this.name())) {
      if (r.interfaces[a]?.titles?.[`${t}.${k}`]) return a;
    }
    return null;
  }
  protected umbenennenHier(t: string, k: string, neu: string): void {
    const eigenName = this.prop(t, k)?.title ?? k;
    void this.typAendern((d) => {
      const titles = { ...(d.titles ?? {}) };
      const ref = `${t}.${k}`;
      /* Gleich wie der eigene Name heisst: keine Umbenennung. Sie
         stehenzulassen wäre eine Zeile, die nichts tut. */
      if (!neu || neu === eigenName) delete titles[ref];
      else titles[ref] = neu;
      if (Object.keys(titles).length) d.titles = titles;
      else delete d.titles;
    });
  }

  protected feldNeu(keyEl: HTMLInputElement, labelEl: HTMLInputElement): void {
    const k = fieldKey(keyEl.value);
    if (!k) return;
    const r = this.reg();
    const schon = r ? typeChain(r, this.name()).find((t) => ownFields(r, t)[k]) : undefined;
    if (schon) {
      this.arbeit.fehler.set(`The field ${k} already comes from ${this.label(schon)}.`);
      return;
    }
    const titel = labelEl.value.trim();
    void this.arbeit
      .aendern('interfaces', (ifs) => {
        const d = withSchema(ifs[this.name()]!);
        d.schema!.properties[k] = { type: 'string', title: titel || k };
        ifs[this.name()] = d;
      })
      .then((ok) => {
        if (!ok) return;
        keyEl.value = '';
        labelEl.value = '';
        this.feldOffen.set(`${this.name()}.${k}`);
      });
  }

  protected hereinnehmen(el: HTMLSelectElement): void {
    const t = el.value;
    el.value = '';
    if (!t) return;
    void this.typAendern((d, ifs) => {
      if (wouldCycle({ interfaces: ifs }, this.name(), t)) return `${this.label(t)} already takes ${this.label(this.name())}.`;
      d.extends = [...(d.extends ?? []), t];
      return undefined;
    });
  }

  /**
   * **Einen Typ herausnehmen** — nur einen direkt dazugenommenen. Was dann
   * aus der Kette fällt, darf an keinem Artikel mehr eine Karte haben
   * (`card_not_inherited`); trägt einer noch etwas darin, bleibt er stehen.
   */
  protected herausnehmen(parent: string): void {
    const r = this.reg();
    if (!r) return;
    const weg = droppedBy(r, this.name(), parent);
    const felder = weg.reduce((n, t) => n + Object.keys(ownFields(r, t)).length, 0);
    const u = this.arbeit.usage();
    /* Wer trägt Karten der fallenden Typen? Gezählt wird, wer überhaupt
       etwas in einer davon führt — genauer nach Art zu zählen hiesse, je
       Artikel die Kette zu kennen, und die Kurzfassung hat sie nicht. */
    const traeger = u ? Math.min(articlesTaking(r, u, this.name()), Math.max(0, ...weg.map((t) => u.cards[t]?.articles ?? 0))) : -1;
    const tun = () =>
      this.typAendern((d) => {
        const rest = (d.extends ?? []).filter((x) => x !== parent);
        if (rest.length) d.extends = rest;
        else delete d.extends;
      });
    if (traeger !== 0) {
      this.arbeit.fragen({
        titel: `${this.label(parent)} stays in ${this.label(this.name())}`,
        text: [
          traeger < 0
            ? 'The stock could not be counted.'
            : `Up to ${articles(traeger)} ${traeger === 1 ? 'carries' : 'carry'} values in ${weg.map((t) => this.label(t)).join(', ')}. Taken out, each of them would be refused on its next save (a card of a type it no longer has).`,
          'Clear those values first, or ask the administration to move them.',
        ],
        ja: 'OK',
      });
      return;
    }
    this.arbeit.fragen({
      titel: `Take ${this.label(parent)} out of ${this.label(this.name())}?`,
      text: [
        `${weg.length} type(s) leave the chain with ${felder} field(s): ${weg.map((t) => this.label(t)).join(', ')}.`,
        'No article carries anything in them.',
      ],
      ja: 'Take it out',
      tun: () => void tun(),
    });
  }

  /** Woher die Anordnung dieser Ansicht kommt, in einem Wort. */
  protected herkunft(v: { von: string | null; mode: string }): string {
    if (!v.von) return 'as the view says';
    if (v.von === this.name()) return v.mode === 'adjusted' ? 'adjusted here' : 'its own';
    return `from ${this.label(v.von)}${v.mode === 'adjusted' ? ' (adjusted)' : ''}`;
  }

  protected entfernen(): void {
    if (this.entfernenGrund()) return;
    const n = this.name();
    this.arbeit.fragen({
      titel: `Remove the type ${this.label(n)}?`,
      text: ['No article carries it, no type takes it and nothing names it.'],
      ja: 'Remove',
      tun: () =>
        void this.arbeit.aendern('interfaces', (ifs) => {
          delete ifs[n];
        }),
    });
  }
}
