import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LAYER_RELATION,
  entityName,
  enumOptions,
  fieldTitle,
  layoutFor,
  linkedTypes,
  primaryInterface,
  typeChain,
} from '@nw/model';
import type { Entity, PropertySchema, Registry } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { feldZellen, flach, SCHON_ANDERSWO, type Zelle } from './anordnung';
import { ausEingabe, eingabeArt, inEingabe, inListe, suchgruppen, type Eingabe } from './felder';
import { KurzLink } from '../kern/kurzansicht';
import { Mehrfach, type Suchgruppe } from './mehrfach';
import { Schnell } from './schnell';
import { Statblock } from './statblock';
import { Uebungen } from './uebungen';
import { Werte } from './werte';
import { FigurDaten } from '../bogen/daten';
import { Inventar } from './inventar';
import { Text } from './text';
import { Wahl } from './wahl';

/** Die Kante, mit der eine Instanz ihre Vorlage nennt. */
const INSTANZ = 'instanceOf';
/** Was nicht in die Maske am Ort des anderen gehört: es steht in seinem eigenen Artikel. */
const NICHT_HIER = new Set([...SCHON_ANDERSWO, 'Status', 'Image', 'Tags', 'Notes', 'Description']);

/** Ein Ende einer `asField`-Kante, aufgelöst für diesen Artikel. */
interface Glied {
  relation: string;
  direction: 'out' | 'in';
  type: string;
  typLabel: string;
  /** Der Artikel am anderen Ende — fehlt er, steht „Create" da. */
  id: string | null;
  /** Seine Anordnung zeichnet ihn als Statblock wie im Buch. */
  bogen: boolean;
  /** Seine Anordnung zeichnet ihn als Inventar. */
  inventar: boolean;
  /** Er lässt sich aus einer Vorlage ziehen (`instanceOf` nimmt die Art). */
  vorlage: boolean;
}

interface EFeld {
  ref: string;
  comp: string;
  prop: string;
  label: string;
  art: Eingabe;
  schema: PropertySchema;
  werte: string[];
  gruppen: Suchgruppe[];
  frei: boolean;
  wert: string;
  jaNein: boolean;
  liste: string[];
  /** Wie es beim Öffnen der Maske stand — geschrieben wird nur, was sich änderte. */
  anfang: string;
  /** An einer Instanz: der Wert kommt von der Vorlage. */
  geerbt: boolean;
  /** ↺ gedrückt: beim Speichern fällt der eigene Wert weg, die Vorlage gilt. */
  folgt: boolean;
}

/**
 * **Was über eine `asField`-Kante hängt, am Ort dieses Artikels** (T-125,
 * Element `linked`; CLAUDE.md „Eine Kante darf sich an einem Ende wie ein
 * Feld lesen"). Die Zahlen einer Kreatur wohnen an ihrem Statblock, ihre
 * Sachen im Inventar — beides eigene Artikel, und für die Kreatur trotzdem
 * der Teil von ihr, der woanders wohnt. Also steht er hier: der Statblock
 * wie im Buch, das Inventar als Liste, und „Edit" schreibt in **seinen**
 * Artikel, nicht in diesen. Gespeichert bleibt die Kante in einer Richtung;
 * liegt sie am anderen Ende (`belongsTo` am Statblock), findet sie die
 * Rückfrage.
 *
 * **Ohne Statblock keine Zahlen:** fehlt das andere Ende, stehen „Create"
 * (mit dem Namen dieses Artikels, im Popup aus T-131) und — wo die Art
 * Vorlagen kennt — „From a template": angelegt wird dann eine **Instanz**,
 * die nur speichert, was abweicht. An ihr zeigt die Maske, was von der
 * Vorlage kommt, und ↺ lässt ein Feld ihr wieder folgen.
 *
 * Gezeichnet wird aus dem Register: welche Kanten, sagt `linkedTypes`, und
 * wie das andere Ende aussieht, seine eigene Anordnung — kein Artname hier.
 */
@Component({
  selector: 'nw-verlinkt',
  imports: [RouterLink, Statblock, Text, Wahl, Mehrfach, Schnell, KurzLink, Inventar, Uebungen, Werte],
  template: `
    <!-- Ein Inventar selbst: was es hält (das Element \`inventory\` an seiner eigenen Seite). -->
    @if (selbst()) {
      <nw-inventar [inventar]="artikel()" [traeger]="traegerVon()" [statblock]="statblockVon(traegerVon())" />
    }
    @for (g of glieder(); track g.relation) {
      <section class="verlinkt" [attr.aria-label]="g.typLabel">
        <header class="vkopf">
          <h3>{{ g.typLabel }}</h3>
          @if (g.id) {
            @if (anderer(g.id); as le) {
              <a [routerLink]="['/artikel', g.id]" [nwQuick]="g.id" class="vname">{{ name(le) }}</a>
              @if (le.fromTemplate; as ft) {
                <span class="vorlage">
                  from the template
                  <a [routerLink]="['/artikel', ft.template]" [nwQuick]="ft.template">{{ bestand.name()(ft.template) ?? 'template' }}</a>
                </span>
              }
              @if (darf(g.id) && entwurf()?.gid !== g.id) {
                <button type="button" class="klein" (click)="beginnen(g, le)">Edit</button>
              }
            }
          }
        </header>

        @if (g.id) {
          @if (anderer(g.id); as le) {
            @if (entwurf()?.gid === g.id) {
                <form class="vmaske" (submit)="$event.preventDefault(); speichern()">
                  @if (entwurf()!.instanz) {
                    <p class="hinweis">Pale fields come from the template. ↺ makes a field follow the template again.</p>
                  }
                  <div class="vfelder">
                    @for (f of entwurf()!.felder; track f.ref) {
                      <label [class.geerbt]="f.geerbt && !geaendert(f)" [class.folgt]="f.folgt">
                        <span class="vl">
                          {{ f.label }}
                          @if (entwurf()!.instanz && !f.geerbt && !f.folgt && eigenerWert(f)) {
                            <button type="button" class="zurueck" (click)="folgen(f)"
                                    [attr.aria-label]="'Follow the template: ' + f.label" title="Follow the template">↺</button>
                          }
                          @if (f.folgt) {
                            <small>follows the template</small>
                          }
                        </span>
                        @switch (f.art) {
                          @case ('jaNein') {
                            <input type="checkbox" [checked]="f.jaNein" (change)="setze(f, { jaNein: $any($event.target).checked })" />
                          }
                          @case ('auswahl') {
                            <select (change)="setze(f, { wert: $any($event.target).value })">
                              <option value=""></option>
                              @for (o of f.werte; track o) {
                                <option [value]="o" [selected]="o === f.wert">{{ o }}</option>
                              }
                            </select>
                          }
                          @case ('lang') {
                            <textarea rows="3" [value]="f.wert" (input)="setze(f, { wert: $any($event.target).value })"></textarea>
                          }
                          @case ('json') {
                            <textarea rows="3" spellcheck="false" class="mono" [value]="f.wert" (input)="setze(f, { wert: $any($event.target).value })"></textarea>
                          }
                          @case ('verweis') {
                            <nw-wahl [wert]="f.wert" (wertChange)="setze(f, { wert: $event })" [arten]="f.schema.target?.interfaces ?? []" [label]="f.label" [anlegbar]="false" />
                          }
                          @case ('verweise') {
                            <nw-mehrfach [werte]="f.liste" (werteChange)="setze(f, { liste: $event })" [verweise]="true" [gruppen]="f.gruppen" [label]="f.label" />
                          }
                          @case ('mehrfach') {
                            <nw-mehrfach [werte]="f.liste" (werteChange)="setze(f, { liste: $event })" [gruppen]="f.gruppen" [feste]="f.werte" [frei]="f.frei" [label]="f.label" />
                          }
                          @case ('zahl') {
                            <input type="text" inputmode="decimal" [value]="f.wert" (input)="setze(f, { wert: $any($event.target).value })" />
                          }
                          @case ('liste') {
                            <input type="text" [value]="f.wert" placeholder="one, two, three" (input)="setze(f, { wert: $any($event.target).value })" />
                          }
                          @default {
                            <input type="text" [value]="f.wert" (input)="setze(f, { wert: $any($event.target).value })" />
                          }
                        }
                      </label>
                    }
                  </div>
                  @if (problem(); as p) {
                    <p class="fehler" role="alert">{{ p }}</p>
                  }
                  <div class="vknoepfe">
                    <button type="button" (click)="abbrechen()">Cancel</button>
                    <button type="submit" class="pri" [disabled]="speichert()">{{ speichert() ? 'Saving…' : 'Save' }}</button>
                  </div>
                  <p class="hinweis">Saved into {{ name(le) }}, not into this article. Passages and relations: open it.</p>
                </form>
            } @else if (g.bogen) {
              <!-- Mit den Endwerten der Figur (T-272); bearbeitet wird oben die gespeicherte Karte. -->
              <nw-statblock [artikel]="gelesen(le)" />
              <!-- Jede Übung mit Herkunft (T-239): an der Figur gerechnet, nicht am Statblock. -->
              <nw-uebungen [figur]="artikel()" />
              <!-- Wie jede Zahl zustande kommt (T-272). -->
              <nw-werte [figur]="artikel()" />
            } @else {
              @if (g.inventar) {
                <nw-inventar [inventar]="le" [traeger]="artikel()" [statblock]="statblockVon(artikel())" />
              } @else if (zellen(le); as zs) {
                @if (zs.length) {
                  <dl class="vzellen">
                    @for (z of zs; track z.ref) {
                      <div [class.geerbt]="z.geerbt" [attr.title]="z.geerbt ? 'From the template' : null">
                        <dt>{{ z.label }}</dt>
                        <dd><nw-text inline [text]="z.wert" /></dd>
                      </div>
                    }
                  </dl>
                }
              }
            }
          } @else {
            <p class="leer">Loading…</p>
          }
        } @else {
          <div class="fehlt">
            <p class="leer">No {{ g.typLabel.toLowerCase() }} yet{{ g.bogen ? ' — no numbers until one is attached' : '' }}.</p>
            @if (session.darfAnlegen() && darfHier()) {
              <div class="vknoepfe links">
                <button type="button" (click)="anlegenFuer.set(g)">Create “{{ name(artikel()) }}”</button>
                @if (g.vorlage) {
                  <button type="button" (click)="vorlageFuer.set(vorlageFuer()?.relation === g.relation ? null : g)">From a template</button>
                }
              </div>
              @if (vorlageFuer()?.relation === g.relation) {
                <label class="vorlagenwahl">
                  <span>Template</span>
                  <nw-wahl [wert]="''" (wertChange)="ausVorlage(g, $event)" [arten]="[g.type]" [label]="'Template'" [anlegbar]="false" />
                </label>
              }
              @if (problem() && !entwurf()) {
                <p class="fehler" role="alert">{{ problem() }}</p>
              }
            }
          </div>
        }
      </section>
    }
    @if (anlegenFuer(); as g) {
      <nw-schnell
        [vorschlag]="name(artikel())"
        [ziele]="[g.type]"
        [vorgabe]="g.type"
        [kanten]="g.direction === 'in' ? [{ type: g.relation, to: artikel().id }] : []"
        (angelegt)="angelegt(g, $event.id)"
        (zu)="anlegenFuer.set(null)"
      />
    }
  `,
  styles: `
    .verlinkt {
      margin: 1rem 0;
      padding: 0.6rem 0.8rem;
      border: 1px dashed var(--line);
      border-radius: 8px;
    }
    .vkopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem 0.8rem;
      margin-bottom: 0.4rem;
    }
    .vkopf h3 {
      margin: 0;
      font-family: var(--caps);
      color: var(--accent);
    }
    .vorlage,
    .hinweis,
    .leer {
      color: var(--dim);
    }
    .vorlage {
      font-style: italic;
    }
    .vkopf button {
      margin-left: auto;
    }
    .vfelder {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
      gap: 0.6rem 0.9rem;
    }
    .vfelder label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }
    .vl {
      font-weight: 700;
      color: var(--heading);
      display: flex;
      gap: 0.4rem;
      align-items: baseline;
    }
    .vl small {
      font-weight: normal;
      color: var(--dim);
    }
    label.geerbt input,
    label.geerbt select,
    label.geerbt textarea,
    label.folgt input,
    label.folgt select {
      color: var(--dim);
      font-style: italic;
    }
    .zurueck {
      border: none;
      background: none;
      padding: 0 0.2rem;
      min-height: 0;
      cursor: pointer;
      color: var(--accent);
    }
    input[type='text'],
    select,
    textarea {
      min-height: 36px;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      width: 100%;
      box-sizing: border-box;
    }
    textarea {
      padding: 0.3rem 0.4rem;
    }
    .mono {
      font-family: monospace;
    }
    .vknoepfe {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }
    .vknoepfe.links {
      justify-content: flex-start;
    }
    .vknoepfe button {
      min-height: 40px;
    }
    .vorlagenwahl {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin-top: 0.6rem;
      max-width: 28rem;
    }
    .fehler {
      color: var(--warn);
    }
    dl.vzellen {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
      gap: 0.3rem 1rem;
      margin: 0;
    }
    dl.vzellen dt {
      font-weight: 700;
      color: var(--heading);
    }
    dl.vzellen dd {
      margin: 0;
    }
    dl.vzellen .geerbt dd {
      color: var(--dim);
    }
  `,
})
export class Verlinkt {
  readonly artikel = input.required<Entity>();
  /** Nur diese Arten am anderen Ende (das Element `inventory`); leer heisst alle. */
  readonly nur = input<readonly string[]>([]);
  /** Diese nicht (`except` am Element — das Inventar hat an der Kreatur seinen eigenen Reiter). */
  readonly ausser = input<readonly string[]>([]);

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);
  private readonly api = inject(Api);

  protected readonly anlegenFuer = signal<Glied | null>(null);
  protected readonly vorlageFuer = signal<Glied | null>(null);
  protected readonly problem = signal<string | null>(null);
  protected readonly speichert = signal(false);
  protected readonly entwurf = signal<{ gid: string; instanz: boolean; basis: Entity; felder: EFeld[] } | null>(null);

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());

  /** Darf hier jemand anlegen und anhängen? Wer diesen Artikel schreibt. */
  protected readonly darfHier = computed(() => this.session.darfSchreiben()(this.artikel().id));

  /** Dieser Artikel ist selbst, was das Element zeigen soll — ein Inventar auf seiner eigenen Seite. */
  protected readonly selbst = computed(() => {
    const r = this.reg();
    const nur = this.nur();
    return !!r && nur.length > 0 && typeChain(r, primaryInterface(this.artikel())).some((t) => nur.includes(t));
  });

  protected readonly glieder = computed<Glied[]>(() => {
    const r = this.reg();
    const e = this.artikel();
    if (!r) return [];
    const nur = this.nur();
    const ausser = this.ausser();
    const instanzVon = r.relations[INSTANZ]?.from ?? [];
    /* Liegt die Kante am anderen Ende, fragt die Rückfrage. Bis sie da
       ist, steht nichts — sonst blitzte „Create" auf, wo einer hängt. */
    const rueck = this.bestand.rueckbezuege().get(e.id);
    const raus: Glied[] = [];
    for (const l of linkedTypes(r, primaryInterface(e))) {
      if (nur.length && !nur.includes(l.type)) continue;
      if (ausser.includes(l.type)) continue;
      let id: string | null;
      if (l.direction === 'out') {
        id = (e.relations ?? []).find((k) => k.type === l.relation)?.to ?? null;
      } else {
        if (!rueck) continue;
        id = rueck.find((b) => b.relation.type === l.relation && b.relation.to === e.id)?.from.id ?? null;
      }
      /* Was nicht gilt, steht nicht da: ein Schwert ohne Inventar ist kein
         Behälter, und „No inventory yet" an jedem Gegenstand wäre Rauschen.
         Leer gezeigt wird, was dieser Artikel ohne das andere nicht ganz
         ist — die Kreatur ohne Statblock (die Kante liegt drüben) — und was
         ein Element ausdrücklich verlangt (\`inventory\`). */
      if (!id && l.direction === 'out' && !nur.length) continue;
      const elemente = new Set(flach(layoutFor(r, 'full', l.type).layout).map((x) => x.el));
      const kette = typeChain(r, l.type);
      raus.push({
        relation: l.relation,
        direction: l.direction,
        type: l.type,
        typLabel: r.interfaces[l.type]?.label ?? l.type,
        id,
        bogen: elemente.has('statblock'),
        inventar: elemente.has('inventory'),
        vorlage: instanzVon.includes('*') || kette.some((t) => instanzVon.includes(t)),
      });
    }
    return raus;
  });

  constructor() {
    /* Das andere Ende ganz holen — ohne seine Rückbezüge, die zeigt es hier nicht. */
    effect(() => {
      const ids = this.glieder()
        .map((g) => g.id)
        .filter((x): x is string => !!x);
      untracked(() => ids.forEach((id) => void this.bestand.oeffnen(id, false, false)));
    });
  }

  protected anderer(id: string): Entity | undefined {
    return this.bestand.voll().get(id);
  }

  protected name(e: Entity): string {
    return entityName(e) || e.name || '';
  }

  protected darf(id: string): boolean {
    return this.session.darfSchreiben()(id);
  }

  protected zellen(e: Entity): Zelle[] {
    const r = this.reg();
    if (!r) return [];
    return feldZellen(r, e, this.bestand.name()).filter((z) => !NICHT_HIER.has(z.comp) && !z.bild);
  }

  /**
   * **Der Statblock eines Artikels**, für Tragraster und Tragestufe des
   * Inventars (T-127): das andere Ende der `asField`-Kante, deren Art der
   * Bogen zeichnet — kein Artname hier, wie bei den Gliedern.
   */
  private readonly figurDaten = inject(FigurDaten);

  /**
   * Der Statblock, wie er an dieser Figur gilt (T-272): Endwerte statt der
   * gespeicherten Grundwerte. Für einen anderen verlinkten Artikel er selbst.
   */
  protected gelesen(le: Entity): Entity {
    const w = this.figurDaten.fuer(this.artikel().id).werte()?.statblock;
    return w && w.id === le.id ? w : le;
  }

  protected statblockVon(e: Entity | null): Entity | null {
    const r = this.reg();
    if (!r || !e) return null;
    const rueck = this.bestand.rueckbezuege().get(e.id) ?? [];
    for (const l of linkedTypes(r, primaryInterface(e))) {
      if (!flach(layoutFor(r, 'full', l.type).layout).some((x) => x.el === 'statblock')) continue;
      const id = l.direction === 'out'
        ? (e.relations ?? []).find((k) => k.type === l.relation)?.to
        : rueck.find((b) => b.relation.type === l.relation && b.relation.to === e.id)?.from.id;
      if (!id) continue;
      untracked(() => void this.bestand.oeffnen(id, false, false));
      return this.bestand.voll().get(id) ?? null;
    }
    return null;
  }

  /** Auf der Seite eines Inventars: wer es trägt (die Rückfrage über die `asField`-Kante). */
  protected readonly traegerVon = computed<Entity | null>(() => {
    const r = this.reg();
    const e = this.artikel();
    if (!r || !this.selbst()) return null;
    const rueck = this.bestand.rueckbezuege().get(e.id) ?? [];
    const kanten = new Set(Object.values(r.relations).filter((d) => d.asField === 'from').map((d) => d.type));
    const id = rueck.find((b) => kanten.has(b.relation.type) && b.relation.to === e.id)?.from.id;
    if (!id) return null;
    untracked(() => void this.bestand.oeffnen(id, false, true));
    return this.bestand.voll().get(id) ?? null;
  });

  // ------------------------------------------------------------ bearbeiten

  protected beginnen(g: Glied, le: Entity): void {
    const r = this.reg();
    if (!r || !g.id) return;
    const typ = primaryInterface(le);
    const geerbt = new Set(le.fromTemplate?.fields ?? []);
    const felder: EFeld[] = [];
    for (const comp of typeChain(r, typ)) {
      if (NICHT_HIER.has(comp)) continue;
      const karte = (le.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [prop, schema] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        /* Gerechnetes bekommt keine Eingabe (D8), ein Prosafeld gehört der
           Prosamaske seines Artikels, ein Bild seiner Wahl. */
        if (schema.derived || schema.readOnly || (schema.many && schema.format === 'long')) continue;
        const werte0 = enumOptions(r, schema) ?? [];
        const art0 = eingabeArt(schema);
        if (art0 === 'bild') continue;
        const art: Eingabe = art0 === 'auswahl' && !werte0.length ? 'text' : art0;
        const chips = art === 'verweise' || art === 'mehrfach';
        const suche = chips ? suchgruppen(r, schema) : { gruppen: [], feste: [], frei: true };
        const f: EFeld = {
          ref: `${comp}.${prop}`,
          comp,
          prop,
          label: fieldTitle(r, typ, { type: comp, key: prop, prop: schema }),
          art,
          schema,
          werte: chips ? suche.feste : werte0,
          gruppen: suche.gruppen,
          frei: suche.frei,
          wert: art === 'jaNein' || chips ? '' : inEingabe(karte[prop]),
          jaNein: karte[prop] === true,
          liste: chips ? inListe(karte[prop]) : [],
          anfang: '',
          geerbt: geerbt.has(`${comp}.${prop}`),
          folgt: false,
        };
        f.anfang = stand(f);
        felder.push(f);
      }
    }
    this.problem.set(null);
    this.entwurf.set({ gid: g.id, instanz: !!le.fromTemplate, basis: structuredClone(le), felder });
  }

  protected abbrechen(): void {
    this.entwurf.set(null);
    this.problem.set(null);
  }

  protected setze(f: EFeld, was: Partial<Pick<EFeld, 'wert' | 'jaNein' | 'liste'>>): void {
    Object.assign(f, was, { folgt: false });
    this.entwurf.update((e) => (e ? { ...e } : e));
  }

  /** ↺ nur, wo ein eigener Wert steht — an einem leeren Feld gäbe es nichts zurückzusetzen. */
  protected eigenerWert(f: EFeld): boolean {
    return f.art === 'jaNein' ? f.jaNein : stand(f) !== '';
  }

  protected geaendert(f: EFeld): boolean {
    return stand(f) !== f.anfang;
  }

  /** ↺: der eigene Wert fällt beim Speichern weg, die Vorlage gilt wieder. */
  protected folgen(f: EFeld): void {
    Object.assign(f, { folgt: true, wert: '', jaNein: false, liste: [] });
    this.entwurf.update((e) => (e ? { ...e } : e));
  }

  protected async speichern(): Promise<void> {
    const ew = this.entwurf();
    if (!ew || this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    /* Auf der gelesenen Fassung gebaut, und nur geändert, was sich
       änderte: was die Maske nicht zeigt (Prosa, Kanten, Name), bleibt;
       ein unberührter Wert der Vorlage geht unverändert zurück, und der
       Server dünnt ihn aus (`thinInstance`). */
    const { refs: _r, fromTemplate: _ft, ...basis } = ew.basis as Entity & { refs?: unknown };
    const components = structuredClone(basis.components ?? {}) as Record<string, Record<string, unknown>>;
    for (const f of ew.felder) {
      if (!f.folgt && !this.geaendert(f)) continue;
      const karte = (components[f.comp] ??= {});
      const wert = f.folgt
        ? undefined
        : ausEingabe(f.schema, f.art === 'jaNein' ? f.jaNein : f.art === 'verweise' || f.art === 'mehrfach' ? f.liste : f.wert);
      if (wert === undefined) delete karte[f.prop];
      else karte[f.prop] = wert;
    }
    try {
      await this.api.putEntity({ ...(basis as Entity), components });
      await this.bestand.oeffnen(ew.gid, true, false);
      this.entwurf.set(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.problem.set('Someone saved it in the meantime. Cancel and edit again to see their version.');
        void this.bestand.oeffnen(ew.gid, true, false);
      } else {
        this.problem.set(fehlerText(error));
      }
    } finally {
      this.speichert.set(false);
    }
  }

  // ------------------------------------------------------------ anlegen

  /** Angelegt im Popup (T-131): liegt die Kante hier, wird sie hier gesetzt. */
  protected async angelegt(g: Glied, neu: string): Promise<void> {
    try {
      if (g.direction === 'out') await this.anhaengen(g, neu);
      await this.bestand.oeffnen(this.artikel().id, true);
    } catch (error) {
      this.problem.set(fehlerText(error));
    }
  }

  /**
   * **Aus einer Vorlage** (CLAUDE.md „Vorlage und Instanz"): nicht die
   * Vorlage anhängen, sondern eine Instanz anlegen, die auf sie zeigt —
   * mit dem Namen dieses Artikels, in seiner Ebene. Was gleich ist, liest
   * sie von der Vorlage; der Server speichert nur, was abweicht.
   */
  protected async ausVorlage(g: Glied, vorlage: string): Promise<void> {
    if (!vorlage) return;
    const e = this.artikel();
    this.problem.set(null);
    try {
      const ebene = (e.relations ?? []).find((k) => k.type === LAYER_RELATION)?.to;
      const kanten = [
        { type: INSTANZ, to: vorlage },
        ...(g.direction === 'in' ? [{ type: g.relation, to: e.id }] : []),
        ...(ebene ? [{ type: LAYER_RELATION, to: ebene }] : []),
      ];
      const neu = await this.api.createEntity(g.type, this.name(e), {}, kanten);
      if (!this.session.isAdmin()) await this.session.load(true);
      if (g.direction === 'out') await this.anhaengen(g, neu.id);
      this.vorlageFuer.set(null);
      await this.bestand.oeffnen(e.id, true);
    } catch (error) {
      this.problem.set(fehlerText(error));
    }
  }

  /** Die Kante an diesem Artikel setzen (`carries`): er wird dafür geschrieben. */
  private async anhaengen(g: Glied, ziel: string): Promise<void> {
    const { refs: _r, fromTemplate: _ft, ...e } = this.artikel() as Entity & { refs?: unknown };
    const relations = [
      ...(e.relations ?? []).filter((k) => k.type !== g.relation),
      { id: `${e.id}~${g.relation}-${Date.now()}`, type: g.relation, to: ziel, props: {} },
    ];
    await this.api.putEntity({ ...(e as Entity), relations });
  }
}

/** Ein Feld als ein Wort, um zu sehen, ob es sich änderte. */
function stand(f: EFeld): string {
  return f.art === 'jaNein' ? String(f.jaNein) : f.art === 'verweise' || f.art === 'mehrfach' ? f.liste.join('\u0000') : f.wert;
}

function fehlerText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
