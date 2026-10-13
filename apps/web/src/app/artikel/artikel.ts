import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  areaOf,
  LAYER_RELATION,
  typeChain,
  entityName,
  entriesOf,
  entryRef,
  enumOptions,
  fieldTitle,
  idLinks,
  proseFields,
  relationAccepts,
  relationsFrom,
  primaryInterface,
  relationDef,
  resolveView,
  showField,
} from '@nw/model';
import type { Entity, PropertySchema, Registry, VarScopes, ViewDef } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import {
  anzeigeWert,
  ausEingabe,
  eingabeArt,
  inEingabe,
  kantenAusEntwurf,
  sindZeilen,
  tabelleAlsText,
  type Eingabe,
} from './felder';
import { Text } from './text';
import { bereichLabel } from '../kern/bereiche';

const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source'];

interface Zelle {
  ref: string;
  label: string;
  wert: string;
  /** An einer Instanz: der Wert kommt von der Vorlage. */
  geerbt?: boolean;
  /** Ein langes Textfeld: gezeichnet als Markdown (M10), nicht als Zeile. */
  lang?: boolean;
}

interface Feld {
  /** `Component.property` — eindeutig und zugleich der Name im Formular. */
  ref: string;
  comp: string;
  prop: string;
  label: string;
  art: Eingabe;
  schema: PropertySchema | undefined;
  /* Die Werte einer Auswahl, schon aufgelöst: das Feld trägt sie selbst
     oder nennt eine Aufzählungszeile, und die Vorlage soll das nicht noch
     einmal entscheiden müssen. */
  werte: string[];
  wert: string;
  jaNein: boolean;
  pflicht: boolean;
}

/**
 * Ein Artikel.
 *
 * **Gezeichnet wird aus dem Register**, nicht aus einer Vorlage je
 * Artikelart: welche Felder eine Darstellungsstufe zeigt, steht in der
 * Ansicht, und die Auswahl macht `showField` aus `packages/model` — dieselbe
 * Funktion, die der Prototyp benutzt. Eine zweite Auswahl hier wäre die
 * zweite Stelle, an der jemand etwas vergisst.
 *
 * **Zurückgehalten wird am Server** (`redactEntity`). Was hier ankommt, darf
 * angezeigt werden; die Seite prüft das nicht noch einmal. Eine zweite
 * Prüfung sähe nach Sorgfalt aus und wäre das Gegenteil: sie lüde dazu ein,
 * die erste wegzulassen.
 */
@Component({
  selector: 'nw-artikel',
  imports: [RouterLink, FormsModule, Text],
  template: `
    @if (artikel(); as e) {
      <div class="buch">
        <nav aria-label="Breadcrumb" class="brot">
          <a [routerLink]="'/' + (bereich() || 'compendium')">{{ bereichName() }}</a>
          <span aria-hidden="true">›</span>
          <a [routerLink]="'/' + (bereich() || 'compendium')" [queryParams]="{ type: art(e) }">{{
            typLabel(art(e))
          }}</a>
          <span aria-hidden="true">›</span>
          <span>{{ name(e) }}</span>
        </nav>

        <div class="spalten">
          <main class="hauptspalte">
            <div class="werkzeugzeile">
              <span class="meta">{{ meta() }}</span>
              <div class="werkzeuge">
                @if (art(e) === 'Class' && !bearbeitet()) {
                  <a class="knopf" [routerLink]="['/classes', e.id]">Class view</a>
                }
                @if (darfSchreiben()) {
                  <button type="button" (click)="bearbeitet() ? abbrechen() : beginnen()">
                    {{ bearbeitet() ? 'Cancel' : 'Edit' }}
                  </button>
                }
                @if (bearbeitet()) {
                  <button type="button" class="pri" [disabled]="speichert()" (click)="speichern()">
                    {{ speichert() ? 'Saving…' : 'Save' }}
                  </button>
                }
              </div>
            </div>

            <article class="blatt">
              <div>
                <h1>{{ name(e) }}</h1>
                @if (untertitel(); as u) {
                  <p class="untertitel">{{ u }}</p>
                }
              </div>
              <div class="linie" aria-hidden="true"></div>
            @if (bearbeitet()) {
              @if (problem(); as p) {
                <p class="fehler" role="alert">{{ p }}</p>
              }
              @if (maengel().length) {
                <ul class="maengel" role="alert">
                  @for (m of maengel(); track m) {
                    <li>{{ m }}</li>
                  }
                </ul>
              }

              <div class="maske">
                @for (f of felder(); track f.ref) {
                  <label>
                    <span>{{ f.label }}@if (f.pflicht) {<i class="pflicht" title="required">*</i>}</span>
                    @switch (f.art) {
                      @case ('jaNein') {
                        <input type="checkbox" [(ngModel)]="f.jaNein" [name]="f.ref" />
                      }
                      @case ('auswahl') {
                        <select [(ngModel)]="f.wert" [name]="f.ref">
                          <option value=""></option>
                          @for (o of f.werte; track o) {
                            <option [value]="o">{{ o }}</option>
                          }
                        </select>
                      }
                      @case ('lang') {
                        <textarea rows="4" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('json') {
                        <textarea rows="6" spellcheck="false" style="font-family: monospace" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('zahl') {
                        <input type="text" inputmode="decimal" [(ngModel)]="f.wert" [name]="f.ref" />
                      }
                      @case ('liste') {
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" placeholder="one, two, three" />
                      }
                      @default {
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" />
                      }
                    }
                  </label>
                }
              </div>

              <h3>Passages</h3>
              @for (b of entwurfProsa(); track b.id) {
                <div class="blockmaske">
                  <div class="bkopf">
                    <span class="bl">{{ b.label }}</span>
                    <button type="button" class="weg" (click)="prosaWeg(b.id)" title="Remove">×</button>
                  </div>
                  <textarea rows="3" [(ngModel)]="b.wert" [name]="b.id"></textarea>
                </div>
              }
              <div class="werkzeuge">
                <select #neueArt>
                  @for (t of prosaArten(); track t.ref) {
                    <option [value]="t.ref">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="prosaDazu(neueArt.value)">+ Passage</button>
              </div>

              <h3>Relations</h3>
              @for (k of entwurfKanten(); track k.id) {
                <div class="kantenmaske">
                  <div class="bkopf">
                    <span class="rl">{{ kantenLabel(k.type) }}</span>
                    <select [(ngModel)]="k.to" [name]="k.id + '-to'">
                      <option value="">— pick an article —</option>
                      @for (z of ziele(k.type); track z.id) {
                        <option [value]="z.id">{{ z.name }}</option>
                      }
                    </select>
                    <button type="button" class="weg" (click)="kanteWeg(k.id)" title="Remove">×</button>
                  </div>
                  @if (kantenFelder(k.type).length) {
                    <div class="maske">
                      @for (f of kantenFelder(k.type); track f.prop) {
                        <label>
                          <span>{{ f.label }}</span>
                          @switch (f.art) {
                            @case ('jaNein') {
                              <input
                                type="checkbox"
                                [checked]="k.props[f.prop] === true"
                                (change)="setzeProp(k, f.prop, $any($event.target).checked)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                            @case ('auswahl') {
                              <select
                                [value]="anzeige(k.props[f.prop])"
                                (change)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              >
                                <option value=""></option>
                                @for (o of f.werte; track o) {
                                  <option [value]="o">{{ o }}</option>
                                }
                              </select>
                            }
                            @default {
                              <input
                                type="text"
                                [value]="anzeige(k.props[f.prop])"
                                (input)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                          }
                        </label>
                      }
                    </div>
                  }
                </div>
              }
              <div class="werkzeuge">
                <select #neueKante>
                  @for (t of kantenArten(); track t.type) {
                    <option [value]="t.type">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="kanteDazu(neueKante.value)">+ Relation</button>
              </div>
            } @else {
              @if (offeneVerweise().length) {
                <p class="hinweis" role="status">
                  Links not tied to an article (none or several match):
                  {{ offeneVerweise().join(', ') }}
                </p>
              }
              @if (zellen().length) {
                <dl class="felder">
                  @for (z of zellen(); track z.ref) {
                    <dt>{{ z.label }}</dt>
                    <dd [class.geerbt]="z.geerbt" [attr.title]="z.geerbt ? 'From the template' : null">
                      <nw-text [text]="z.wert" [scopes]="scopes()" [einzeilig]="!z.lang" />
                    </dd>
                  }
                </dl>
              }
              @if (beschreibung(); as text) {
                @if (zellen().length) {
                  <div class="linie" aria-hidden="true"></div>
                }
                <nw-text class="beschreibung" [text]="text" [scopes]="scopes()" />
              }
              @for (b of prosa(); track b.ref) {
                <section class="block" [class]="b.key">
                  @if (b.key !== 'paragraph') {
                    <h2>{{ b.label }}</h2>
                  }
                  <nw-text [text]="b.wert" [scopes]="scopes()" />
                </section>
              }
            }
            </article>
          </main>

          <aside class="seitenspalte" aria-label="Connections">
            @if (kanten().length) {
              <section class="kasten">
                <h2>Relations</h2>
                <ul class="kanten">
                  @for (k of kanten(); track k.id) {
                    <li>
                      <span class="rl">{{ k.label }}</span>
                      @if (k.ziel) {
                        <a [routerLink]="['/artikel', k.ziel]">{{ k.text }}</a>
                      } @else {
                        <span class="weg">{{ k.text }}</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
            @if (rueckbezuege().length) {
              <section class="kasten">
                <h2>Linked here</h2>
                <ul class="kanten">
                  @for (r of rueckbezuege(); track r.id) {
                    <li>
                      <span class="rl">{{ r.label }}</span>
                      <a [routerLink]="['/artikel', r.ziel]">{{ r.text }}</a>
                    </li>
                  }
                </ul>
              </section>
            }
            <section class="kasten">
              <h2>Who can see this</h2>
              <div class="zeile"><span>Audience</span><strong>{{ sicht().audience }}</strong></div>
              @if (sicht().revealedTo.length) {
                <div class="zeile"><span>Revealed to</span><span>{{ sicht().revealedTo.join(', ') }}</span></div>
              }
              @if (sicht().hiddenFrom.length) {
                <div class="zeile"><span>Hidden from</span><span>{{ sicht().hiddenFrom.join(', ') }}</span></div>
              }
            </section>
            @if (quelle(); as q) {
              <section class="kasten">
                <h2>Source</h2>
                @if (q.url) {
                  <a [href]="q.url" target="_blank" rel="noopener">{{ q.text }}</a>
                } @else {
                  <span>{{ q.text }}</span>
                }
              </section>
            }
          </aside>
        </div>
      </div>
    } @else if (bestand.fehlt().has(id())) {
      <p class="fehler buch">No such article — or not one you may see.</p>
    } @else {
      <p class="leer buch">Loading…</p>
    }
  `,
  styleUrl: './artikel.scss',
})
export class Artikel {
  readonly id = input.required<string>();

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);

  constructor() {
    void this.bestand.load();
    /* Der ganze Artikel kommt erst hier, beim Öffnen — die Liste trägt nur
       seine Kurzfassung. Wechselt die Id (ein Verweis auf der Seite), wird
       der nächste geholt. */
    effect(() => {
      void this.bestand.oeffnen(this.id());
    });
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  protected readonly artikel = computed<Entity | undefined>(() =>
    this.bestand.voll().get(this.id()),
  );
  /* **Der Ort wählt die Ansicht** (CLAUDE.md): die Artikelseite zeigt
     `full`. Hier stand ein Wähler — einen gibt es nicht, und wer weniger
     sehen darf, sieht dieselbe Ansicht mit weniger darin. */
  private readonly view = computed<ViewDef | null>(() => {
    const r = this.reg();
    return r ? resolveView(r, 'full') : null;
  });

  protected typLabel(typ: string): string {
    return this.reg()?.interfaces[typ]?.label ?? typ;
  }

  /** Der Bereich der Art (`area` am Typ) — für den Brotkrumenpfad. */
  protected readonly bereich = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? areaOf(r, primaryInterface(e)) : '';
  });
  protected readonly bereichName = computed(() => bereichLabel(this.bereich()) ?? 'Compendium');

  /** Art · Nummer · Ebenen — die Zeile über dem Blatt. */
  protected readonly meta = computed(() => {
    const e = this.artikel();
    if (!e) return '';
    const byId = this.bestand.byId();
    const nummer = (e.components?.['Identity'] as { id?: string } | undefined)?.id;
    const ebenen = (e.relations ?? [])
      .filter((r) => r.type === LAYER_RELATION)
      .map((r) => entityName(byId.get(r.to)));
    return [this.typLabel(primaryInterface(e)), nummer, ...ebenen].filter(Boolean).join(' · ');
  });

  /** Aliasse und Deckname, kursiv unter dem Namen. */
  protected readonly untertitel = computed(() => {
    const id = this.artikel()?.components?.['Identity'] as
      | { aliases?: string[]; cover?: string }
      | undefined;
    const teile = [...(id?.aliases ?? [])];
    if (id?.cover) teile.push(`known as ${id.cover}`);
    return teile.join(' · ');
  });

  /** Was der Artikel über seine Sichtbarkeit sagt — `public` ist die Vorgabe. */
  protected readonly sicht = computed(() => {
    const v = this.artikel()?.components?.['Visibility'] as
      | { audience?: string; revealedTo?: string[]; hiddenFrom?: string[] }
      | undefined;
    const byId = this.bestand.byId();
    const namen = (ids?: string[]) => (ids ?? []).map((i) => entityName(byId.get(i)) || i);
    return {
      audience: v?.audience ?? 'public',
      revealedTo: namen(v?.revealedTo),
      hiddenFrom: namen(v?.hiddenFrom),
    };
  });

  protected readonly quelle = computed(() => {
    const q = this.artikel()?.components?.['Source'] as
      | { publication?: string; page?: string; url?: string }
      | undefined;
    if (!q?.publication && !q?.url) return null;
    const text = [q.publication, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(', ');
    return { text: text || q.url || '', url: q.url };
  });
  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    return primaryInterface(e);
  }

  /**
   * Woraus `{VAR}` im Text aufgelöst wird: der Artikel, dann das Register
   * (REQ-174). Die Bindung an einer Kante kennt nur, wer den Text über die
   * Kante hereinzieht — die Artikelseite zeigt ihn für sich.
   */
  protected readonly scopes = computed<VarScopes>(() => {
    const e = this.artikel();
    const vars = e?.components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  protected readonly beschreibung = computed<string | null>(() => {
    const e = this.artikel();
    const v = this.view();
    if (!e || !v?.description) return null;
    const d = e.components?.['Description'] as { description?: string } | undefined;
    return d?.description ?? null;
  });

  /**
   * Die Feldzellen. `Description.description` bleibt draussen, weil sie schon
   * als Absatz oben steht — sie zweimal zu zeigen wäre kein Fehler, aber es
   * liest sich wie einer.
   */
  protected readonly zellen = computed<Zelle[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    const v = this.view();
    if (!e || !r || !v) return [];
    const out: Zelle[] = [];
    /* Ein Prosafeld steht nicht in der Feldtabelle, es gehört dem Absatz
       darunter (`prosa`) — hier stand es als „[object Object]" (W1). */
    const prosa = new Set(proseFields(r, primaryInterface(e)).map((f) => `${f.type}.${f.key}`));
    for (const [comp, karte] of Object.entries(e.components ?? {})) {
      /* Was schon anderswo steht: der Name als Überschrift, Aliasse und
         Nummer darüber und darunter, Sichtbarkeit und Quelle in der
         Seitenspalte. Zweimal dasselbe liest sich wie ein Fehler. */
      if (SCHON_ANDERSWO.includes(comp)) continue;
      const def = r.interfaces[comp];
      /* In der Reihenfolge, in der die Art ihre Felder erklärt — nicht in
         der, in der sie zuletzt gespeichert wurden. */
      const werte = (karte ?? {}) as Record<string, unknown>;
      const reihe = [
        ...Object.keys(def?.schema?.properties ?? {}).filter((k) => k in werte),
        ...Object.keys(werte).filter((k) => !(k in (def?.schema?.properties ?? {}))),
      ];
      /* Tabellenzeilen (`Table.rows`) werden eine Tabelle, ihr Kopf
         (`columns`) steht darin und nicht noch einmal als Zeile. */
      const zeilen = Object.keys(werte).find((k) => sindZeilen(werte[k]));
      for (const prop of reihe) {
        const wert = werte[prop];
        if (comp === 'Description' && prop === 'description' && v.description) continue;
        if (prosa.has(`${comp}.${prop}`)) continue;
        if (zeilen && prop === 'columns') continue;
        if (!showField(v, comp, prop)) continue;
        if (wert === null || wert === undefined || wert === '') continue;
        const schema = def?.schema?.properties?.[prop];
        const titel = schema?.title ?? prop;
        const tabelle = prop === zeilen && sindZeilen(wert);
        out.push({
          lang: tabelle || (schema?.format === 'long' && typeof wert === 'string'),
          ref: `${comp}.${prop}`,
          label: titel,
          wert: tabelle ? tabelleAlsText(werte['columns'], wert) : anzeigeWert(wert),
          geerbt: e.fromTemplate?.fields.includes(`${comp}.${prop}`) ?? false,
        });
      }
    }
    return out;
  });

  /**
   * Die Prosa dieses Artikels. Sie steht in Feldern mit `many` und langer
   * Eingabe — es gibt keine zweite Sorte Inhalt mehr neben den Karten —,
   * und jeder Eintrag trägt die Id, an der die Wissensfreigabe hängt.
   */
  protected readonly prosa = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const out: { ref: string; key: string; label: string; wert: string }[] = [];
    for (const f of proseFields(r, primaryInterface(e))) {
      const karte = (e.components?.[f.type] ?? {}) as Record<string, unknown>;
      for (const eintrag of entriesOf(karte[f.key])) {
        out.push({
          ref: entryRef(f.type, f.key, eintrag.id),
          key: f.key,
          label: fieldTitle(r, primaryInterface(e), f),
          wert: eintrag.value,
        });
      }
    }
    return out;
  });

  protected readonly kanten = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    const map = this.bestand.byId();
    /* Die Ebene steht schon in der Zeile über dem Blatt. */
    return (e.relations ?? []).filter((rel) => rel.type !== LAYER_RELATION).map((rel) => {
      const ziel = map.get(rel.to);
      return {
        id: rel.id,
        label: relationDef(r, rel.type).label,
        ziel: ziel?.id ?? '',
        /* Ein Ziel, das es nicht gibt, wird gesagt und nicht verschwiegen —
           es kann auch heissen, dass der Betrachter es nicht sehen darf. */
        text: ziel ? entityName(ziel) : '(not here)',
      };
    });
  });

  // ------------------------------------------------------------ bearbeiten

  protected readonly bearbeitet = signal(false);
  protected readonly speichert = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly maengel = signal<string[]>([]);
  /** Verweise, die beim letzten Speichern keine Id bekamen (M11). */
  protected readonly offeneVerweise = signal<string[]>([]);
  protected readonly felder = signal<Feld[]>([]);
  protected readonly entwurfProsa = signal<
    { id: string; type: string; key: string; label: string; wert: string }[]
  >([]);

  private readonly api = inject(Api);

  protected readonly darfSchreiben = computed(() => {
    const e = this.artikel();
    return e ? this.session.darfSchreiben()(e.id) : false;
  });

  /**
   * Die Maske zeigt **jedes erlaubte Feld**, nicht nur die ausgefüllten:
   * ein Feld, das erst erscheint, wenn es einen Wert hat, kann niemand zum
   * ersten Mal ausfüllen. Die Darstellungsstufe gilt hier nicht — sie sagt,
   * was man *liest*, nicht was es gibt.
   */
  protected beginnen(): void {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return;
    const erlaubt = typeChain(r, primaryInterface(e));
    const pflicht = new Set(
      erlaubt.flatMap((t) => (r.interfaces[t]?.schema?.required ?? []).map((k) => `${t}.${k}`)),
    );
    const out: Feld[] = [];
    for (const comp of erlaubt) {
      const def = r.interfaces[comp];
      if (!def) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [prop, schema] of Object.entries(def.schema?.properties ?? {})) {
        /* Abgeleitete Werte bekommen keine Eingabe (D8). Sie hier
           anzubieten hiesse, jemanden etwas eintippen zu lassen, das beim
           nächsten Lesen überschrieben wird. */
        if (schema.derived) continue;
        /* Ein Prosafeld gehört der Prosamaske und nicht der Feldliste.
           Zweimal dasselbe anzubieten hiesse, dass der zweite Eingang den
           ersten überschreibt, und keiner der beiden sagte das. */
        if (schema.many && schema.format === 'long') continue;
        const werte = enumOptions(r, schema, this.bestand.entities()) ?? [];
        /* Eine Auswahl ohne Werte ist ein freies Wort: nennt das Feld eine
           Art, von der noch nichts sichtbar ist (M6), soll man trotzdem
           etwas eintragen können. */
        const art = eingabeArt(schema) === 'auswahl' && !werte.length ? 'text' : eingabeArt(schema);
        out.push({
          ref: `${comp}.${prop}`,
          comp,
          prop,
          /* Wie das Feld **an dieser Art** heisst: derselbe `Time.until`
             ist an einem Auftrag die Frist und an einem Ereignis das Ende. */
          label: `${def.label ?? comp} · ${fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema })}`,
          art,
          schema,
          /* Nennt das Feld eine Artikelart (M6), sind die Werte die Namen
             der Artikel, die hier angekommen sind — gesiebt hat der Server. */
          werte,
          wert: art === 'jaNein' ? '' : inEingabe(karte[prop]),
          jaNein: karte[prop] === true,
          pflicht: pflicht.has(`${comp}.${prop}`),
        });
      }
    }
    this.felder.set(out);
    this.entwurfProsa.set(
      this.prosa().map((b) => {
        const [typ, rest] = b.ref.split('.');
        const key = (rest ?? '').split('#')[0] ?? '';
        return { id: b.ref, type: typ ?? '', key, label: b.label, wert: b.wert };
      }),
    );
    this.entwurfKanten.set(
      (e.relations ?? []).map((rel) => ({
        id: rel.id,
        type: rel.type,
        to: rel.to,
        props: { ...(rel.props ?? {}) },
      })),
    );
    this.problem.set(null);
    this.maengel.set([]);
    this.offeneVerweise.set([]);
    this.bearbeitet.set(true);
  }

  protected abbrechen(): void {
    this.bearbeitet.set(false);
    this.problem.set(null);
    this.maengel.set([]);
  }

  protected prosaArten(): { ref: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return proseFields(r, primaryInterface(e)).map((f) => ({
      ref: `${f.type}.${f.key}`,
      label: fieldTitle(r, primaryInterface(e), f),
    }));
  }

  protected prosaDazu(ref: string): void {
    if (!ref) return;
    const [typ, key] = ref.split('.');
    if (!typ || !key) return;
    const label = this.prosaArten().find((a) => a.ref === ref)?.label ?? key;
    this.entwurfProsa.update((bs) => [
      ...bs,
      { id: `${ref}#neu-${bs.length}-${Date.now()}`, type: typ, key, label, wert: '' },
    ]);
  }
  protected prosaWeg(id: string): void {
    this.entwurfProsa.update((bs) => bs.filter((b) => b.id !== id));
  }

  // ------------------------------------------------------------- Kanten

  /**
   * **Nur vorwärts.** Was hier bearbeitet wird, sind die ausgehenden Kanten
   * dieses Artikels; die Gegenrichtung ist eine Abfrage und hat kein Feld.
   * Eine Maske, die auch den Rückbezug bearbeiten liesse, müsste ihn
   * irgendwo hinschreiben — und dann verwaist eines der beiden Stücke.
   */
  protected readonly entwurfKanten = signal<
    { id: string; type: string; to: string; props: Record<string, unknown> }[]
  >([]);

  protected kantenArten(): { type: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return relationsFrom(r, primaryInterface(e))
      .map((d) => ({ type: d.type, label: d.label }))
      .sort((a2, b2) => a2.label.localeCompare(b2.label, 'de'));
  }
  protected kantenLabel(type: string): string {
    const r = this.reg();
    return r ? relationDef(r, type).label : type;
  }

  /**
   * Welche Artikel diese Kantenart überhaupt annimmt — aus dem Register,
   * nicht aus einer Liste hier. Eine Kante, die auf etwas Unpassendes zeigt,
   * weist der Server ohnehin ab; sie erst gar nicht anbieten ist die
   * freundlichere Hälfte derselben Regel.
   */
  protected ziele(type: string): { id: string; name: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const def = relationDef(r, type);
    const quelle = primaryInterface(e);
    return this.bestand
      .entities()
      .filter((o) => o.id !== e.id && relationAccepts(def, quelle, primaryInterface(o), r))
      .map((o) => ({ id: o.id, name: entityName(o) }))
      .sort((a2, b2) => a2.name.localeCompare(b2.name, 'de'));
  }

  protected kantenFelder(
    type: string,
  ): {
    prop: string;
    label: string;
    art: Eingabe;
    schema: PropertySchema | undefined;
    werte: string[];
  }[] {
    const r = this.reg();
    if (!r) return [];
    const props = relationDef(r, type).props?.properties ?? {};
    return Object.entries(props).map(([prop, schema]) => ({
      prop,
      label: schema.title ?? prop,
      art: eingabeArt(schema),
      schema,
      werte: enumOptions(r, schema, this.bestand.entities()) ?? [],
    }));
  }

  protected anzeige(wert: unknown): string {
    return inEingabe(wert);
  }
  protected setzeProp(
    kante: { type: string; props: Record<string, unknown> },
    prop: string,
    roh: string | boolean,
  ): void {
    const r = this.reg();
    const schema = r ? relationDef(r, kante.type).props?.properties?.[prop] : undefined;
    const wert = ausEingabe(schema, roh);
    if (wert === undefined) delete kante.props[prop];
    else kante.props[prop] = wert;
  }

  protected kanteDazu(type: string): void {
    if (!type) return;
    this.entwurfKanten.update((ks) => [
      ...ks,
      { id: `r-neu-${ks.length}-${Date.now()}`, type, to: '', props: {} },
    ]);
  }
  protected kanteWeg(id: string): void {
    this.entwurfKanten.update((ks) => ks.filter((k) => k.id !== id));
  }

  /**
   * Geschrieben wird der ganze Artikel, auf einer Kopie gebaut. Erst ein
   * gelungenes Schreiben ersetzt ihn im Bestand — sonst stünde nach einem
   * Fehlschlag ein Stand da, den der Server nie gesehen hat, und beim
   * nächsten Laden wäre er lautlos weg.
   */
  protected async speichern(): Promise<void> {
    const alt = this.artikel();
    if (!alt || this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);

    /* `[[Name]]` wird beim Speichern zur Id, wo genau ein Artikel so
       heisst (M11). Hier und nicht beim Lesen: danach überlebt der Verweis
       das Umbenennen des Ziels. Was nichts oder mehreres trifft, bleibt
       stehen und wird gesagt. */
    const offen = new Set<string>();
    const mitIds = (text: string): string => {
      const r = idLinks(text, this.bestand.entities());
      r.open.forEach((o) => offen.add(o));
      return r.text;
    };

    const components: Record<string, Record<string, unknown>> = {};
    for (const f of this.felder()) {
      let wert = ausEingabe(f.schema, f.art === 'jaNein' ? f.jaNein : f.wert);
      if (wert === undefined) continue;
      if (f.schema?.format === 'long' && typeof wert === 'string') wert = mitIds(wert);
      (components[f.comp] ??= {})[f.prop] = wert;
    }
    /* Die Prosa wandert in die Karten, aus denen sie kommt. Die Id bleibt
       die, die sie hatte — eine Wissensfreigabe hängt daran, und sie beim
       Speichern neu zu würfeln nähme sie mit ins Leere. */
    for (const b of this.entwurfProsa()) {
      if (b.wert.trim() === '') continue;
      const id = b.id.split('#')[1] ?? b.id;
      ((components[b.type] ??= {})[b.key] ??= [] as { id: string; value: string }[]);
      (components[b.type][b.key] as { id: string; value: string }[]).push({
        id,
        value: mitIds(b.wert),
      });
    }

    const relations = kantenAusEntwurf(this.entwurfKanten());

    const neu = { ...alt, components, relations } as Entity;

    try {
      const gespeichert = await this.api.putEntity(neu);
      /* Neu geholt und nicht das Zurückgeschickte eingesetzt: was die Seite
         zeigt, ist gesiebt und aufgelöst, und das Gespeicherte ist es nicht.
         Die Zeile in der Liste zieht dabei mit. */
      await this.bestand.oeffnen(alt.id, true);
      this.bearbeitet.set(false);
      this.offeneVerweise.set([...offen]);
      /* Was der Server zurückgibt, gilt — er setzt `updatedAt` und darf
         mehr ändern, als hier geschickt wurde. */
      void gespeichert;
    } catch (error) {
      if (error instanceof ApiError) {
        this.problem.set(error.message);
        /* Die Liste wird gezeigt und nicht zusammengefasst: „ungültig" ohne
           Grund ist am Tisch keine Hilfe. */
        const issues = error.issues;
        if (Array.isArray(issues)) {
          this.maengel.set(
            issues.map((i) => {
              const o = i as { t?: string; message?: string; path?: unknown[] };
              if (o.t) return o.t;
              const pfad = Array.isArray(o.path) ? o.path.join('.') : '';
              return pfad ? `${pfad}: ${o.message ?? '?'}` : (o.message ?? JSON.stringify(i));
            }),
          );
        }
      } else {
        this.problem.set('Could not reach the server.');
      }
    } finally {
      this.speichert.set(false);
    }
  }

  protected readonly rueckbezuege = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    /* Die Gegenrichtung fragt der Server (K1): sie braucht jede Kante im
       Bestand, und hier liegt nur die Kurzfassung. */
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({
      id: `${b.from.id}:${b.relation.id}`,
      label: relationDef(r, b.relation.type).inverseLabel,
      ziel: b.from.id,
      text: entityName(b.from),
    }));
  });
}
