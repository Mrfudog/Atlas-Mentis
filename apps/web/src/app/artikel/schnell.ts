import {
  Component,
  InjectionToken,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LAYER_RELATION, areaOf, entityName, enumOptions, fieldTitle, typeChain, viewFields } from '@nw/model';
import type { Entity, PropertySchema, Registry } from '@nw/model';
import { Api, ApiError, type MeineEbene } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Stapel } from '../kern/stapel';
import { Wahl } from './wahl';

/**
 * **Woraus heraus angelegt wird** (T-131): der Artikel, an dem gerade
 * gewählt wird. Er schlägt Ebene und Sichtbarkeit des neuen vor, und bevor
 * „Open" weggeht, darf er sich sichern — ein Entwurf, in dessen Feld der
 * neue Artikel eben eingetragen wurde, ginge sonst mit dem Wechsel verloren.
 *
 * Gegeben von der Seite, die den Artikel zeigt (Artikelseite, Board); ein
 * Wähler ohne sie legt trotzdem an, nur ohne Vorschlag.
 */
export interface SchnellKontext {
  herkunft(): Entity | null;
  /** Vor „Open": den Entwurf speichern. `false` heisst: bleiben. */
  vorOeffnen?(): Promise<boolean>;
}
export const SCHNELL_KONTEXT = new InjectionToken<SchnellKontext>('SchnellKontext');

/** Was angelegt wurde — genug, um es gleich einzutragen. */
export interface Angelegt {
  id: string;
  name: string;
  type: string;
  entity: Entity;
}

export interface Pflicht {
  ref: string;
  label: string;
  prop: PropertySchema;
  werte: string[];
}

/** Was Pflicht ist und keine Vorgabe hat — ohne Name und Nummer (die setzt das Anlegen). */
export function pflichtFelder(r: Registry, typ: string): Pflicht[] {
  const raus: Pflicht[] = [];
  for (const t of typeChain(r, typ)) {
    const schema = r.interfaces[t]?.schema;
    for (const k of schema?.required ?? []) {
      const prop = schema?.properties?.[k];
      if (!prop || prop.derived || prop.default !== undefined) continue;
      if (t === 'Identity' && (k === 'name' || k === 'id')) continue;
      raus.push({ ref: `${t}.${k}`, label: fieldTitle(r, typ, { type: t, key: k, prop }), prop, werte: enumOptions(r, prop) ?? [] });
    }
  }
  return raus;
}

/**
 * **Welche Arten aus einer Auswahl anlegbar sind** (T-131): jede nicht
 * abstrakte Art, deren `extends`-Kette eine der genannten trifft (wie
 * `target.interfaces` und `RelationDef.to` gelten), ohne Angabe jede mit
 * Bereich. Spielende legen nur Arten mit Stand an (REQ-237) — dieselbe
 * Regel wie „New article". Die genannte Art selbst steht vorn.
 */
export function anlegbareArten(
  r: Registry,
  arten: readonly string[],
  nurMitStand: boolean,
): { name: string; label: string }[] {
  const ziel = new Set(arten);
  return Object.values(r.interfaces)
    .filter((d) => !d.abstract)
    .filter((d) => {
      const kette = typeChain(r, d.name);
      return ziel.size ? kette.some((t) => ziel.has(t)) : !!areaOf(r, d.name);
    })
    .filter((d) => !nurMitStand || typeChain(r, d.name).includes('Status'))
    .map((d) => ({ name: d.name, label: d.label ?? d.name }))
    .sort((a, z) => Number(ziel.has(z.name)) - Number(ziel.has(a.name)) || a.label.localeCompare(z.label, 'en'));
}

interface Eingabe {
  ref: string;
  label: string;
  prop: PropertySchema;
  werte: string[];
  pflicht: boolean;
  art: 'verweis' | 'auswahl' | 'jaNein' | 'zahl' | 'text';
}

/** Was die Kurzansicht an einfachen Feldern hat — darüber hinaus gehört es auf die Artikelseite. */
const QUICK_HOECHSTENS = 8;

/**
 * **Schnell anlegen** (T-131): das Popup hinter „Create … as …" in einer
 * Auswahl. Art (bei mehreren eine Wahl), Name aus der Eingabe, die
 * Pflichtfelder und die einfachen Felder der Kurzansicht (`quick`), dazu
 * Ebene und Sichtbarkeit — vorgeschlagen vom Ausgangsartikel, änderbar.
 * Angelegt wird wie bei „New article" über `POST /api/entities`: Nummer
 * (`nextId`) und Prüfung (`validateEntity`) setzt der Server.
 *
 * Danach meldet es den neuen Artikel (`angelegt`) — der Wähler trägt ihn
 * sofort ein — und bietet „Open" (hin, mit dem Rückweg in den Brotkrumen)
 * und „Done" (bleiben). Auf dem Telefon kommt es als Blatt von unten.
 */
@Component({
  selector: 'nw-schnell',
  imports: [forwardRef(() => Wahl)],
  template: `
    <div class="schleier" (click)="zu.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="schnell-titel">
      @if (fertig(); as f) {
        <h2 id="schnell-titel">Created</h2>
        <p class="ok" role="status">
          <b>{{ f.name }}</b> ({{ typLabel(f.type) }}) is created and linked here.
        </p>
        @if (problem(); as p) {
          <p class="fehler" role="alert">{{ p }}</p>
        }
        <div class="knoepfe">
          <button type="button" (click)="oeffnen(f)" [disabled]="laeuft()">Open</button>
          <button type="button" class="pri" (click)="zu.emit()">Done</button>
        </div>
      } @else {
        <h2 id="schnell-titel">Create {{ arten().length === 1 ? typLabel(typ()) : 'article' }}</h2>
        @if (arten().length > 1) {
          <label>
            <span>Type</span>
            <select [value]="typ()" (change)="typ.set($any($event.target).value)">
              @for (t of arten(); track t.name) {
                <option [value]="t.name" [selected]="t.name === typ()">{{ t.label }}</option>
              }
            </select>
          </label>
        }
        <label>
          <span>Name <i class="pflicht" title="required">*</i></span>
          <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" (keydown.enter)="anlegen()" />
        </label>
        @for (p of eingaben(); track p.ref) {
          <label>
            <span>{{ p.label }} @if (p.pflicht) {<i class="pflicht" title="required">*</i>}</span>
            @switch (p.art) {
              @case ('verweis') {
                <nw-wahl
                  [wert]="werte()[p.ref] ?? ''"
                  (wertChange)="setze(p.ref, $event)"
                  [arten]="p.prop.target?.interfaces ?? []"
                  [label]="p.label"
                  [anlegbar]="false"
                />
              }
              @case ('auswahl') {
                <select [value]="werte()[p.ref] ?? ''" (change)="setze(p.ref, $any($event.target).value)">
                  <option value=""></option>
                  @for (w of p.werte; track w) {
                    <option [value]="w" [selected]="w === werte()[p.ref]">{{ w }}</option>
                  }
                </select>
              }
              @case ('jaNein') {
                <input type="checkbox" class="haken" [checked]="werte()[p.ref] === 'true'" (change)="setze(p.ref, $any($event.target).checked ? 'true' : '')" />
              }
              @case ('zahl') {
                <input type="text" inputmode="decimal" [value]="werte()[p.ref] ?? ''" (input)="setze(p.ref, $any($event.target).value)" />
              }
              @default {
                <input type="text" [value]="werte()[p.ref] ?? ''" (input)="setze(p.ref, $any($event.target).value)" />
              }
            }
          </label>
        }
        @if (ebenen().length) {
          <label>
            <span>Layer</span>
            <select [value]="ebene()" (change)="ebene.set($any($event.target).value)">
              @for (l of ebenen(); track l.id) {
                <option [value]="l.id" [selected]="l.id === ebene()">{{ l.name }}{{ l.id === schreibId() ? ' (write layer)' : '' }}</option>
              }
            </select>
          </label>
        }
        @if (sichtbarkeit().length) {
          <label>
            <span>Audience</span>
            <select [value]="publikum()" (change)="publikum.set($any($event.target).value)">
              @for (w of sichtbarkeit(); track w) {
                <option [value]="w" [selected]="w === publikum()">{{ w }}</option>
              }
            </select>
          </label>
        }
        @if (!ebenen().length && stapel.schreib()?.layer; as l) {
          <p class="hinweis">Goes to <b>{{ l.name }}</b>.</p>
        }
        @if (herkunftName(); as h) {
          <p class="hinweis">Audience follows {{ h }}.</p>
        }
        @if (problem(); as p) {
          <p class="fehler" role="alert">{{ p }}</p>
        }
        <div class="knoepfe">
          <button type="button" (click)="zu.emit()">Cancel</button>
          <button type="button" class="pri" [disabled]="laeuft() || !name().trim() || !typ()" (click)="anlegen()">
            {{ laeuft() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .schleier {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.35);
      z-index: 50;
    }
    .dialog {
      position: fixed;
      z-index: 51;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(440px, calc(100vw - 32px));
      max-height: 76vh;
      overflow-y: auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      box-shadow: 0 12px 36px rgb(0 0 0 / 0.25);
      text-align: left;
      color: var(--ink);
      font-weight: normal;
      /* Es steht in einem Feldlabel und erbt sonst dessen kleine Schrift. */
      font-size: 1rem;
      text-transform: none;
      letter-spacing: normal;
    }
    /* Auf dem Telefon ein Blatt von unten: der Daumen erreicht die Knöpfe. */
    @media (max-width: 600px) {
      .dialog {
        top: auto;
        bottom: 0;
        left: 0;
        transform: none;
        width: 100%;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
        padding-bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px));
      }
    }
    h2 {
      margin: 0;
      font-size: 1.3rem;
      font-family: var(--caps);
      color: var(--accent);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    label > span {
      font-weight: 700;
      color: var(--heading);
    }
    input[type='text'],
    select {
      min-height: 40px;
      padding: 0 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .haken {
      align-self: flex-start;
      width: 1.2rem;
      height: 1.2rem;
    }
    .pflicht {
      color: var(--accent);
      font-style: normal;
    }
    .knoepfe {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .knoepfe button {
      min-height: 40px;
    }
    .ok,
    .fehler,
    .hinweis {
      margin: 0;
    }
    .fehler {
      color: var(--warn);
    }
    .hinweis {
      color: var(--dim);
    }
  `,
})
export class Schnell {
  /** Was getippt wurde — der Name des neuen Artikels. */
  readonly vorschlag = input<string>('');
  /** Die Arten, die das Feld oder die Kante nimmt; leer heisst jede. */
  readonly ziele = input<string[]>([]);
  /** Eine davon vorgewählt — wer „as Creature" anklickt, meint Creature. */
  readonly vorgabe = input<string | undefined>(undefined);
  /** Kanten, die der neue Artikel gleich trägt — ein Statblock gehört seiner Kreatur (`belongsTo`, T-125). */
  readonly kanten = input<{ type: string; to: string }[]>([]);
  readonly angelegt = output<Angelegt>();
  readonly zu = output<void>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  protected readonly stapel = inject(Stapel);
  private readonly kontext = inject(SCHNELL_KONTEXT, { optional: true });

  protected readonly name = linkedSignal(() => this.vorschlag().trim());
  protected readonly werte = signal<Partial<Record<string, string>>>({});
  protected readonly problem = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly fertig = signal<Angelegt | null>(null);
  private readonly meine = signal<MeineEbene[]>([]);

  protected readonly arten = computed(() => {
    const r = this.bestand.registry();
    return r ? anlegbareArten(r, this.ziele(), !this.session.isAdmin()) : [];
  });

  protected readonly typ = linkedSignal(() => {
    const arten = this.arten();
    const v = this.vorgabe();
    return v && arten.some((a) => a.name === v) ? v : (arten[0]?.name ?? '');
  });

  private readonly herkunft = computed(() => this.kontext?.herkunft() ?? null);
  protected readonly herkunftName = computed(() => {
    const h = this.herkunft();
    return h ? (this.bestand.name()(h.id) ?? h.name ?? null) : null;
  });

  /** Pflichtfelder zuerst, dann die einfachen Felder der Kurzansicht. */
  protected readonly eingaben = computed<Eingabe[]>(() => {
    const r = this.bestand.registry();
    const typ = this.typ();
    if (!r || !typ) return [];
    const raus: Eingabe[] = pflichtFelder(r, typ).map((p) => ({ ...p, pflicht: true, art: artVon(p.prop, p.werte) }));
    const schon = new Set(raus.map((p) => p.ref));
    const quick = viewFields(r, 'quick', typ).elements.filter((el) => el.el === 'fields').flatMap((el) => el.fields);
    for (const ref of quick) {
      if (raus.length >= QUICK_HOECHSTENS || schon.has(ref)) continue;
      const [t, k] = ref.split('.');
      if (!t || !k || t === 'Identity' || t === 'Visibility') continue;
      const prop = r.interfaces[t]?.schema?.properties?.[k];
      if (!prop || !einfach(prop)) continue;
      const werte = enumOptions(r, prop) ?? [];
      raus.push({ ref, label: fieldTitle(r, typ, { type: t, key: k, prop }), prop, werte, pflicht: false, art: artVon(prop, werte) });
      schon.add(ref);
    }
    return raus;
  });

  /** Die Ebenen, in die angelegt werden kann; die des Ausgangsartikels vorn. */
  protected readonly ebenen = computed(() => {
    const liste = this.meine().filter((l) => l.inPlay || this.session.isAdmin());
    const von = this.herkunftsEbene();
    if (von && !liste.some((l) => l.id === von) && this.session.isAdmin()) {
      const n = this.bestand.name()(von);
      if (n) return [{ id: von, name: n } as MeineEbene, ...liste];
    }
    return liste;
  });
  private readonly herkunftsEbene = computed(
    () => this.herkunft()?.relations?.find((r) => r.type === LAYER_RELATION)?.to ?? '',
  );
  /** Vorgewählt die Schreibebene (T-161), sonst die des Ausgangsartikels. */
  protected readonly ebene = linkedSignal(() => {
    const von = this.herkunftsEbene();
    const schreib = this.stapel.schreib()?.layer?.id;
    const liste = this.ebenen();
    if (schreib && liste.some((l) => l.id === schreib)) return schreib;
    return liste.some((l) => l.id === von) ? von : (liste[0]?.id ?? '');
  });
  protected readonly schreibId = computed(() => this.stapel.schreib()?.layer?.id ?? '');

  /** Die Stufen der Sichtbarkeit, wenn die Art sie trägt. */
  protected readonly sichtbarkeit = computed(() => {
    const r = this.bestand.registry();
    const typ = this.typ();
    if (!r || !typ || !typeChain(r, typ).includes('Visibility')) return [];
    return r.interfaces['Visibility']?.schema?.properties?.['audience']?.enum ?? [];
  });
  protected readonly publikum = linkedSignal(() => {
    const von = (this.herkunft()?.components?.['Visibility'] as { audience?: string } | undefined)?.audience;
    const stufen = this.sichtbarkeit();
    return von && stufen.includes(von) ? von : '';
  });

  constructor() {
    /* Eine andere Art hat andere Felder: was für die alte stand, gilt nicht. */
    effect(() => {
      this.typ();
      untracked(() => this.werte.set({}));
    });
    void this.api
      .myLayers()
      .then((r) => this.meine.set(r.layers))
      .catch(() => this.meine.set([]));
  }

  protected typLabel(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  protected setze(ref: string, wert: string): void {
    this.werte.update((w) => ({ ...w, [ref]: wert }));
  }

  protected async anlegen(): Promise<void> {
    const name = this.name().trim();
    const typ = this.typ();
    if (!name || !typ || this.laeuft()) return;
    this.laeuft.set(true);
    this.problem.set(null);
    try {
      const felder: Record<string, unknown> = {};
      for (const p of this.eingaben()) {
        const roh = this.werte()[p.ref];
        if (roh === undefined || roh === '') continue;
        felder[p.ref] = p.art === 'zahl' ? Number(roh) : p.art === 'jaNein' ? roh === 'true' : roh;
      }
      if (this.publikum()) felder['Visibility.audience'] = this.publikum();
      /* Die Ebene nennt die Maske, der Server prüft sie: wer dort nicht
         schreibt, legt in seine eigene (T-098). */
      const kanten = [...(this.ebene() ? [{ type: LAYER_RELATION, to: this.ebene() }] : []), ...this.kanten()];
      const e = await this.api.createEntity(typ, name, felder, kanten);
      /* Was eine Spielerin anlegt, darf sie schreiben (REQ-237) — das weiss
         erst ein neues `/api/me`. */
      if (!this.session.isAdmin()) await this.session.load(true);
      const fertig: Angelegt = { id: e.id, name: entityName(e) || name, type: typ, entity: e };
      this.fertig.set(fertig);
      this.angelegt.emit(fertig);
    } catch (error) {
      this.problem.set(fehlerText(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Zum neuen Artikel — der Ausgangsartikel sichert vorher seinen Entwurf. */
  protected async oeffnen(f: Angelegt): Promise<void> {
    this.laeuft.set(true);
    this.problem.set(null);
    try {
      if (this.kontext?.vorOeffnen && !(await this.kontext.vorOeffnen())) {
        this.problem.set('Save this article first — the link is set, but the draft did not save.');
        return;
      }
      const von = this.herkunft()?.id;
      this.zu.emit();
      await this.router.navigate(['/artikel', f.id], von ? { queryParams: { from: von } } : {});
    } finally {
      this.laeuft.set(false);
    }
  }
}

function einfach(p: PropertySchema): boolean {
  if (p.derived || p.readOnly || p.many) return false;
  if (p.format && p.format !== 'measure' && p.format !== 'signed') return false;
  return p.type === 'string' || p.type === 'number' || p.type === 'integer' || p.type === 'boolean';
}

function artVon(p: PropertySchema, werte: string[]): Eingabe['art'] {
  if (p.format === 'link') return 'verweis';
  if (werte.length) return 'auswahl';
  if (p.type === 'boolean') return 'jaNein';
  if (p.type === 'number' || p.type === 'integer') return 'zahl';
  return 'text';
}

function fehlerText(error: unknown): string {
  if (error instanceof ApiError) {
    const issues = Array.isArray(error.issues)
      ? (error.issues as { message?: string }[]).map((i) => i.message).filter(Boolean)
      : [];
    return [error.message, ...issues].join(' — ');
  }
  return 'Could not reach the server.';
}
