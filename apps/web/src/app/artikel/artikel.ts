import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  typeChain,
  backlinks,
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
  viewKeys,
} from '@nw/model';
import type { Entity, PropertySchema, Registry, VarScopes, ViewDef } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { ausEingabe, eingabeArt, inEingabe, kantenAusEntwurf, type Eingabe } from './felder';
import { Text } from './text';

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
      <article>
        <header class="kopf">
          <div>
            <h2>{{ name(e) }}</h2>
            <span class="art">{{ art(e) }}</span>
          </div>
          <div class="werkzeuge">
            @if (!bearbeitet()) {
              <select [value]="stufe()" (change)="waehle($any($event.target).value)">
                @for (k of stufen(); track k) {
                  <option [value]="k">{{ label(k) }}</option>
                }
              </select>
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
        </header>

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
            Links not tied to an article (none or several match): {{ offeneVerweise().join(', ') }}
          </p>
        }
        @if (beschreibung(); as text) {
          <nw-text class="beschreibung" [text]="text" [scopes]="scopes()" />
        }

        @if (zellen().length) {
          <dl class="felder">
            @for (z of zellen(); track z.ref) {
              <dt>{{ z.label }}</dt>
              <dd [class.geerbt]="z.geerbt" [attr.title]="z.geerbt ? 'From the template' : null">
                @if (z.lang) {
                  <nw-text [text]="z.wert" [scopes]="scopes()" />
                } @else {
                  {{ z.wert }}
                }
              </dd>
            }
          </dl>
        }

        @for (b of prosa(); track b.ref) {
          <section class="block" [class]="b.key">
            @if (b.key !== 'paragraph') {
              <div class="bl">{{ b.label }}</div>
            }
            <nw-text [text]="b.wert" [scopes]="scopes()" />
          </section>
        }

        @if (kanten().length) {
          <h3>Relations</h3>
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
        }

        @if (rueckbezuege().length) {
          <h3>Referred to by</h3>
          <ul class="kanten">
            @for (r of rueckbezuege(); track r.id) {
              <li>
                <span class="rl">{{ r.label }}</span>
                <a [routerLink]="['/artikel', r.ziel]">{{ r.text }}</a>
              </li>
            }
          </ul>
        }
        }
      </article>
    } @else if (bestand.geladen()) {
      <p class="fehler">No such article — or not one you may see.</p>
    }
  `,
  styleUrl: './artikel.scss',
})
export class Artikel {
  readonly id = input.required<string>();

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);

  /* Die gewählte Darstellungsstufe lebt in der Maske und nicht in der
     Adresse: sie ist eine Frage des Lesens, keine des Ortes. */
  private gewaehlt: string | undefined;
  protected stufe(): string {
    return this.gewaehlt ?? this.stufen()[0] ?? 'full';
  }
  protected waehle(k: string): void {
    this.gewaehlt = k;
  }

  constructor() {
    void this.bestand.load();
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  protected readonly artikel = computed<Entity | undefined>(() =>
    this.bestand.byId().get(this.id()),
  );
  protected readonly stufen = computed<string[]>(() => {
    const r = this.reg();
    return r ? viewKeys(r) : [];
  });
  private readonly view = computed<ViewDef | null>(() => {
    const r = this.reg();
    return r ? resolveView(r, this.stufe()) : null;
  });

  protected label(key: string): string {
    return this.reg()?.views[key]?.label ?? key;
  }
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
    for (const [comp, karte] of Object.entries(e.components ?? {})) {
      const def = r.interfaces[comp];
      for (const [prop, wert] of Object.entries((karte ?? {}) as Record<string, unknown>)) {
        if (comp === 'Description' && prop === 'description' && v.description) continue;
        if (!showField(v, comp, prop)) continue;
        if (wert === null || wert === undefined || wert === '') continue;
        const schema = def?.schema?.properties?.[prop];
        const titel = schema?.title ?? prop;
        out.push({
          lang: schema?.format === 'long' && typeof wert === 'string',
          ref: `${comp}.${prop}`,
          label: titel,
          wert: Array.isArray(wert) ? wert.join(', ') : String(wert),
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
    return (e.relations ?? []).map((rel) => {
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
        const art = eingabeArt(schema);
        out.push({
          ref: `${comp}.${prop}`,
          comp,
          prop,
          /* Wie das Feld **an dieser Art** heisst: derselbe `Time.until`
             ist an einem Auftrag die Frist und an einem Ereignis das Ende. */
          label: `${def.label ?? comp} · ${fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema })}`,
          art,
          schema,
          werte: enumOptions(r, schema) ?? [],
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
      werte: enumOptions(r, schema) ?? [],
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
      await this.bestand.load(true);
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
    return backlinks(r, this.bestand.entities(), e.id).map((b) => ({
      id: `${b.from.id}:${b.relation.id}`,
      label: b.def.inverseLabel,
      ziel: b.from.id,
      text: entityName(b.from),
    }));
  });
}
