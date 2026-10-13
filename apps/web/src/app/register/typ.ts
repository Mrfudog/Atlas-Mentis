import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { areaOf, articlesTaking, fieldTitle, layoutFor, linkedTypes, ownFields, relationsFrom, typeChain, typeList, viewKeys } from '@nw/model';
import type { InterfaceDef, LayoutElement, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { BEREICHE } from '../kern/bereiche';
import { RegisterArbeit, articles, carry } from './arbeit';
import { RegFeld } from './feld';
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
  imports: [RouterLink, RegFeld],
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
          <span class="dim">{{ zahlText(eigeneArtikel()) }}</span>
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

      <section class="kasten" aria-label="This type">
        <h3>This type</h3>
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
      </section>

      <section class="kasten" aria-label="Own fields">
        <h3>Its own fields <span class="dim">· {{ eigene().length ? eigene().length + (eigene().length === 1 ? ' field' : ' fields') : 'nothing of its own' }}</span></h3>
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
      </section>

      @if (gruppen().length || verlinkt().length || kanten().genannt.length || kanten().allgemein) {
        <section class="kasten" aria-label="Inherited">
          <h3>Inherited <span class="dim">· {{ gruppen().length }} {{ gruppen().length === 1 ? 'type' : 'types' }}, {{ geerbteFelder() }} {{ geerbteFelder() === 1 ? 'field' : 'fields' }}</span></h3>
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

          @if (kanten().genannt.length || kanten().allgemein) {
            <div class="teil kanten">
              <div class="fhead" role="button" tabindex="0" [attr.aria-expanded]="offen(name() + '::kanten')"
                (click)="klappen(name() + '::kanten')" (keydown.enter)="klappen(name() + '::kanten')">
                <span class="twist">{{ offen(name() + '::kanten') ? '▾' : '▸' }}</span>
                <b>Edges from here</b>
                <span class="pill" title="Not fields: an edge points at another article and is stored in one direction. The other way round is a query.">edge · its own article</span>
                <span class="dim">{{ kanten().genannt.length ? kanten().genannt.length + ' kinds' : 'none that name this type' }}</span>
              </div>
              <div class="partfields" [hidden]="!offen(name() + '::kanten')">
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
              </div>
            </div>
          }
        </section>
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

      @if (!d.abstract) {
        <section class="kasten" aria-label="Views">
          <h3>Views</h3>
          <p class="hint">
            How an article of this type is drawn — <b>overview</b> in a link or list row, <b>quick</b> on a card,
            <b>full</b> on its page. The arrangement lives at the type and is inherited until a type says its own.
          </p>
          @for (v of ansichten(); track v.key) {
            <div class="ansicht">
              <div class="fhead">
                <b>{{ v.label }}</b>
                <span class="pill">{{ v.von === name() ? 'its own' : v.von ? 'from ' + label(v.von) : 'the view’s default' }}</span>
                <span class="dim">{{ v.kurz }}</span>
                @if (darf()) {
                  <button type="button" class="klein" (click)="ansichtBearbeiten(v.key, v.layout)">{{ entwurf()?.key === v.key ? 'Close' : 'Edit' }}</button>
                  @if (v.von === name()) {
                    <button type="button" class="klein" (click)="ansichtErben(v.key)">Inherit again</button>
                  }
                }
              </div>
              @if (entwurf()?.key === v.key) {
                <textarea rows="10" aria-label="Arrangement as JSON" [value]="entwurf()!.text"
                  (input)="entwurfText($any($event.target).value)"></textarea>
                <p class="hint">
                  A list of layout elements (<code>heading</code>, <code>fields</code> with <code>except</code>,
                  <code>prose</code>, <code>sheet</code>, <code>tabs</code> …). Saving makes it this type’s own; the server
                  checks it.
                </p>
                <div class="knoepfe">
                  <button type="button" class="pri" (click)="ansichtSpeichern(v.key)">Save arrangement</button>
                </div>
              }
            </div>
          }
        </section>
      }

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
  private readonly arbeit = inject(RegisterArbeit);
  protected readonly bereiche = BEREICHE;
  protected readonly feldOffen = signal<string | null>(null);
  protected readonly entwurf = signal<{ key: string; text: string } | null>(null);

  private readonly reg = computed(() => this.bestand.registry() as Registry | null);
  protected readonly def = computed(() => this.reg()?.interfaces[this.name()]);
  protected readonly bereich = computed(() => (this.reg() ? areaOf(this.reg()!, this.name()) : ''));
  protected readonly geerbterBereich = computed(() => {
    const r = this.reg();
    if (!r) return '';
    for (const t of ancestorsOf(r, this.name())) if (r.interfaces[t]?.area) return r.interfaces[t]!.area!;
    return '';
  });
  protected readonly parents = computed(() => (this.reg() ? parentsOf(this.reg()!, this.name()) : []));
  protected readonly kinder = computed(() => (this.reg() ? childrenOf(this.reg()!, this.name()) : []));
  protected readonly eigene = computed(() => Object.keys(this.reg() ? ownFields(this.reg()!, this.name()) : {}));

  /** Artikel dieser Art — aus der Zählung am Server; bis sie da ist, keine Zahl (W7). */
  protected readonly eigeneArtikel = computed(() => {
    const u = this.arbeit.usage();
    return u ? (u.types[this.name()] ?? 0) : null;
  });

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

  protected readonly ansichten = computed(() => {
    const r = this.reg();
    if (!r) return [];
    return viewKeys(r).map((key) => {
      const { layout, from } = layoutFor(r, key, this.name());
      return { key, label: r.views[key]?.label ?? key, von: from, layout, kurz: kurzLayout(layout) };
    });
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
  protected zahlText(n: number | null): string {
    return n === null ? '' : articles(n);
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

  protected ansichtBearbeiten(key: string, layout: LayoutElement[]): void {
    this.entwurf.update((e) => (e?.key === key ? null : { key, text: JSON.stringify(layout, null, 2) }));
  }
  protected entwurfText(text: string): void {
    this.entwurf.update((e) => (e ? { ...e, text } : e));
  }
  protected ansichtSpeichern(key: string): void {
    const e = this.entwurf();
    if (!e) return;
    let layout: unknown;
    try {
      layout = JSON.parse(e.text);
    } catch {
      this.arbeit.fehler.set('The arrangement is not valid JSON.');
      return;
    }
    if (!Array.isArray(layout)) {
      this.arbeit.fehler.set('An arrangement is a list of elements: [ … ].');
      return;
    }
    void this.typAendern((d) => {
      d.views = { ...(d.views ?? {}), [key]: layout as LayoutElement[] };
    }).then((ok) => ok && this.entwurf.set(null));
  }
  protected ansichtErben(key: string): void {
    void this.typAendern((d) => {
      const v = { ...(d.views ?? {}) };
      delete v[key];
      if (Object.keys(v).length) d.views = v;
      else delete d.views;
    });
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

/** Ein Layout in einer Zeile: `heading · fields (all but Secrets) · prose`. */
function kurzLayout(layout: LayoutElement[]): string {
  if (!layout.length) return 'nothing arranged';
  return layout
    .map((el) => {
      if (el.el === 'fields') {
        const was = el.fields === 'all' || !el.fields ? 'all' : el.fields.join(', ') || 'none';
        return `fields (${was}${el.except?.length ? ' but ' + el.except.join(', ') : ''})`;
      }
      if (el.el === 'tabs') return `tabs (${(el.tabs ?? []).map((t) => t.label).join(', ')})`;
      return el.el;
    })
    .join(' · ');
}
