/**
 * **Fassungen an den Feldern** (T-092, E-021 d).
 *
 * Kein Umschalter zwischen 2014 und 2024: der Artikel im Spiel steht da,
 * und an jedem Feld, an dem eine andere Fassung etwas anderes sagt, steht
 * ihr Wert dabei — mit dem Kürzel ihrer Ebene, der volle Name im Tooltip.
 * Lange Texte stehen als aufklappbarer Vergleich. Was eine Fassung ist und
 * was sie anders sagt, rechnet das Modell (`versionDiff`); hier steht nur,
 * wie es gezeigt wird und was sich das Konto merkt.
 */

import { Component, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  entityName,
  entriesOf,
  fieldText,
  layersOf,
  linesDiff,
  primaryInterface,
  sectionDiff,
  textSections,
  unitsFor,
  versionDiff,
  versionInPlay,
  versionSummary,
} from '@nw/model';
import type { Entity, FieldEntry, Registry, VarScopes, VersionSummary } from '@nw/model';
import { Api, type Fassung, type Fassungen } from '../kern/api';
import { anzeigeWert } from './felder';
import { Bestand } from '../kern/bestand';
import { Text } from './text';

/** Was sich das Konto merkt (`/api/me/prefs`, Schlüssel `versions`). */
export interface Lesart {
  /** Fassungen an den Feldern zeigen. */
  on: boolean;
  /** Diese Ebenen nicht vergleichen — eine neue Ebene ist so von selbst dabei. */
  off: string[];
}

const VORGABE: Lesart = { on: true, off: [] };
/** Ein Artikel ohne Ebenenkante — eine Ebene „keine". */
export const OHNE_EBENE = '∅';

/**
 * Die Lesart je Konto (T-092): einmal geholt, beim Ändern sofort hier und
 * dann am Server. Gemerkt am Konto und nicht im Browser — wer am Laptop
 * vorbereitet und am Tablet leitet, will denselben Stand.
 */
@Injectable({ providedIn: 'root' })
export class FassungsLesart {
  private readonly api = inject(Api);
  private readonly _stand = signal<Lesart>(VORGABE);
  private geholt: Promise<void> | null = null;
  readonly stand = this._stand.asReadonly();

  laden(): Promise<void> {
    this.geholt ??= this.api
      .prefs()
      .then((p) => {
        const v = p['versions'] as Partial<Lesart> | undefined;
        if (v && typeof v === 'object') {
          this._stand.set({
            on: v.on !== false,
            off: Array.isArray(v.off) ? v.off.filter((x): x is string => typeof x === 'string') : [],
          });
        }
      })
      .catch(() => {
        /* Ohne Antwort gilt die Vorgabe; das nächste Ändern schreibt sie. */
      });
    return this.geholt;
  }

  setze(neu: Partial<Lesart>): void {
    const s = { ...this._stand(), ...neu };
    this._stand.set(s);
    void this.api.setPref('versions', s).catch(() => undefined);
  }

  ebene(id: string, an: boolean): void {
    const off = new Set(this._stand().off);
    if (an) off.delete(id);
    else off.add(id);
    this.setze({ off: [...off] });
  }
}

/** Ein abweichender Wert an einem Feld. */
export interface Abweichung {
  /** Die Fassung, aus der er kommt. */
  id: string;
  /** Das Kürzel der Ebene (bei mehreren: die erste verglichene). */
  kuerzel: string;
  /** Für den Tooltip: Ebene und Name der Fassung. */
  titel: string;
  /** Der Wert als Text; leer heisst „dort leer". */
  text: string;
  lang: boolean;
  compare: boolean;
}

/** Eine verglichene Fassung, wie sie an jedem Wert steht: Kürzel, Tooltip, Artikel. */
export interface Vergleichsfassung {
  id: string;
  kuerzel: string;
  titel: string;
  compare: boolean;
  entity: Entity;
}

/** Was je Kantenart eine Fassung anders hat. */
export interface KantenAbweichung {
  type: string;
  kuerzel: string;
  titel: string;
  dazu: string[];
  weg: string[];
  compare: boolean;
}

/** Die Fassungen, die nach der Lesart verglichen werden, je mit ihren Ebenen. */
export function verglichene(
  f: Fassungen | null,
  lesart: Lesart,
): { v: Fassung; ebene: { id: string; short: string; name: string } }[] {
  if (!f || !lesart.on) return [];
  const aus = new Set(lesart.off);
  const ebenen = new Map(f.layers.map((l) => [l.id, l]));
  const out: { v: Fassung; ebene: { id: string; short: string; name: string } }[] = [];
  for (const v of f.versions) {
    const ids = v.layers.length ? v.layers : [OHNE_EBENE];
    const an = ids.find((id) => !aus.has(id));
    if (!an) continue;
    const l = ebenen.get(an);
    out.push({
      v,
      ebene: l
        ? { id: l.id, short: l.short, name: l.name }
        : { id: an, short: an === OHNE_EBENE ? '—' : '?', name: an === OHNE_EBENE ? 'No layer' : 'Another layer' },
    });
  }
  return out;
}

/** Die verglichenen Fassungen mit Kürzel und Tooltip — einmal, für Felder, Abschnitte und Buchzeilen. */
export function vergleichsfassungen(vergleich: ReturnType<typeof verglichene>): Vergleichsfassung[] {
  return vergleich.map(({ v, ebene }) => ({
    id: v.entity.id,
    kuerzel: ebene.short,
    titel: `${ebene.name} — ${entityName(v.entity)}${v.compare ? ' (compare layer, not in play)' : ''}`,
    compare: v.compare,
    entity: v.entity,
  }));
}

/**
 * **Ein Feldwert als Text** — wie in der Feldtabelle: ein Verweis als
 * Name, ein Objekt als Liste, eine Zahl mit Einheit. Für die Marken an den
 * Feldern und den Vergleich nebeneinander (T-173), damit beide gleich lesen.
 */
export function wertText(
  r: Registry,
  type: string,
  key: string,
  wert: unknown,
  name: (id: string) => string | undefined,
  mode = unitsFor(r, type),
): string {
  if (wert === undefined || wert === null || wert === '') return '';
  const schema = r.interfaces[type]?.schema?.properties?.[key];
  if (schema?.format === 'link') return [wert].flat().map((x) => name(String(x)) ?? '(not here)').join(', ');
  if (typeof wert === 'object') return anzeigeWert(wert);
  return fieldText(r, schema, wert, mode) || String(wert);
}

/**
 * **Je Feld die abweichenden Werte** (`Typ.feld` → Liste), und je
 * Kantenart, was eine Fassung dazu oder nicht hat. Gerechnet über das
 * Modell (`versionDiff`); der Text wie in der Feldtabelle.
 */
export function abweichungen(
  r: Registry,
  basis: Entity,
  vergleich: readonly Vergleichsfassung[],
  name: (id: string) => string | undefined,
): { felder: Map<string, Abweichung[]>; kanten: KantenAbweichung[] } {
  const felder = new Map<string, Abweichung[]>();
  const kanten: KantenAbweichung[] = [];
  const mode = unitsFor(r, primaryInterface(basis));
  for (const v of vergleich) {
    const d = versionDiff(r, basis, v.entity);
    const { titel } = v;
    for (const f of d.fields) {
      const text = wertText(r, f.type, f.key, f.value, name, mode);
      const liste = felder.get(f.ref) ?? [];
      liste.push({ id: v.id, kuerzel: v.kuerzel, titel, text, lang: f.long, compare: v.compare });
      felder.set(f.ref, liste);
    }
    for (const k of d.relations) {
      const n = (id: string) => name(id) ?? '(not in play)';
      /* Jede Fassung hat ihre eigenen Merkmale — „Multiattack" hier und
         „Multiattack" dort sind zwei Artikel und sagen doch dasselbe (T-103).
         Was auf beiden Seiten gleich heisst, ist keine Abweichung. */
      const dazu = k.only.map(n);
      const weg = k.missing.map(n);
      for (const x of [...dazu]) {
        const i = weg.indexOf(x);
        if (i < 0) continue;
        weg.splice(i, 1);
        dazu.splice(dazu.indexOf(x), 1);
      }
      if (!dazu.length && !weg.length) continue;
      kanten.push({ type: k.type, kuerzel: v.kuerzel, titel, dazu, weg, compare: v.compare });
    }
  }
  return { felder, kanten };
}

// ------------------------------------------------------------ Abschnitte (T-103)

/** Ein Abschnitt eines Prosaeintrags, mit dem, was andere Fassungen dort sagen. */
export interface ProsaAbschnitt {
  key: string;
  /** Der Abschnitt samt Überschrift, wie er gezeichnet wird. */
  text: string;
  abw: Abweichung[];
}

/** Ein Prosaeintrag, Abschnitt für Abschnitt verglichen. */
export interface ProsaVergleich {
  abschnitte: ProsaAbschnitt[];
  /** Abschnitte, die nur eine andere Fassung hat — unter ihrer eigenen Überschrift. */
  nurDort: { heading: string; abw: Abweichung }[];
  /** Der ganze Eintrag der anderen Fassung, wo er abweicht — für die Maske. */
  ganz: Abweichung[];
}

const gleich = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
const marke = (f: Vergleichsfassung, text: string): Abweichung => ({
  id: f.id,
  kuerzel: f.kuerzel,
  titel: f.titel,
  text,
  lang: true,
  compare: f.compare,
});

/**
 * **Ein langer Text gegen die Texte der Fassungen** (T-103), Abschnitt für
 * Abschnitt unter seinen Überschriften (`sectionDiff`). Was nur eine
 * Fassung hat, steht danach unter seiner eigenen Überschrift.
 */
export function textVergleich(
  basis: string,
  andere: readonly { f: Vergleichsfassung; text: string }[],
): ProsaVergleich {
  const v: ProsaVergleich = {
    abschnitte: textSections(basis).map((s) => ({ key: s.key, text: s.text, abw: [] })),
    nurDort: [],
    ganz: [],
  };
  for (const { f, text } of andere) {
    if (gleich(basis, text)) continue;
    v.ganz.push(marke(f, text));
    /* Hat die Fassung den Text gar nicht, sagt sie es einmal und nicht unter jeder Überschrift. */
    if (!text.trim()) {
      v.abschnitte[0]?.abw.push(marke(f, ''));
      continue;
    }
    for (const s of sectionDiff(basis, text)) {
      if (s.onlyThere) v.nurDort.push({ heading: s.heading, abw: marke(f, s.value ?? '') });
      else v.abschnitte.find((a) => a.key === s.key)?.abw.push(marke(f, s.value ?? ''));
    }
  }
  return v;
}

/**
 * **Ein Prosafeld gegen seine Fassungen** (T-103): je Eintrag (nach Id,
 * sonst der Reihe nach) und darin je Abschnitt unter einer Überschrift.
 * Vorher stand der Vergleich als Ganzes am ersten Eintrag, und was eine
 * Fassung zur Grösse sagte, stand bei Aasimar unter „Languages", dem
 * letzten Abschnitt des Textes. Ohne eigenen Eintrag (`basis` leer) steht
 * ein leerer mit der Id `''` da, damit „hier: —" einen Platz hat.
 */
export function prosaVergleich(
  type: string,
  key: string,
  basis: readonly FieldEntry[],
  fassungen: readonly Vergleichsfassung[],
): Map<string, ProsaVergleich> {
  const eintraege = basis.length ? basis : [{ id: '', value: '' }];
  const ids = new Set(eintraege.map((b) => b.id));
  const je = new Map<string, { f: Vergleichsfassung; text: string }[]>(eintraege.map((b) => [b.id, []]));
  /* Mehr Einträge als hier: sie stehen am letzten, für sich. */
  const uebrig: { f: Vergleichsfassung; text: string }[] = [];
  for (const f of fassungen) {
    const dort = entriesOf((f.entity.components?.[type] as Record<string, unknown> | undefined)?.[key]);
    const frei = dort.filter((d) => !ids.has(d.id));
    let naechster = 0;
    for (const b of eintraege) {
      const d = dort.find((x) => x.id === b.id) ?? frei[naechster++];
      je.get(b.id)!.push({ f, text: d?.value ?? '' });
    }
    for (const d of frei.slice(naechster)) uebrig.push({ f, text: d.value });
  }
  const out = new Map<string, ProsaVergleich>();
  for (const b of eintraege) out.set(b.id, textVergleich(b.value, je.get(b.id)!));
  const letzter = out.get(eintraege[eintraege.length - 1]!.id)!;
  for (const { f, text } of uebrig) {
    letzter.ganz.push(marke(f, text));
    for (const s of sectionDiff('', text)) letzter.nurDort.push({ heading: s.heading, abw: marke(f, s.value ?? '') });
  }
  return out;
}

/** Eine Zeile eines Buch-Elements mit dem, was andere Fassungen dort sagen. */
export interface ZeilenVergleich {
  /** Beschriftung klein → abweichende Werte. */
  an: Map<string, Abweichung[]>;
  /** Zeilen, die nur eine andere Fassung hat, in ihrer Reihenfolge. */
  nurDort: { label: string; abw: Abweichung[] }[];
}

/**
 * **Die Zeilen eines Statblocks, Zaubers oder Gegenstands gegen die der
 * Fassungen** (T-103) — verglichen wird, was dasteht, nach Beschriftung
 * (`linesDiff`); ein Buch-Element zeichnet seine Felder selbst, also steht
 * die andere Fassung an seiner Zeile und nicht in einer Tabelle darunter.
 */
export function zeilenVergleich(
  basis: readonly { label: string; text: string }[],
  andere: readonly { f: Vergleichsfassung; zeilen: readonly { label: string; text: string }[] }[],
): ZeilenVergleich {
  const an = new Map<string, Abweichung[]>();
  const nurDort: ZeilenVergleich['nurDort'] = [];
  for (const { f, zeilen } of andere) {
    for (const d of linesDiff(basis, zeilen)) {
      const a: Abweichung = { ...marke(f, d.value ?? ''), lang: (d.value ?? '').length > 160 };
      if (!d.onlyThere) {
        (an.get(d.key) ?? an.set(d.key, []).get(d.key)!).push(a);
        continue;
      }
      const da = nurDort.find((z) => z.label.toLowerCase() === d.key);
      if (da) da.abw.push(a);
      else nurDort.push({ label: d.heading, abw: [a] });
    }
  }
  return { an, nurDort };
}

/**
 * **Die Marken an einem Wert** (T-092, T-103): je Fassung ihr Kürzel und
 * was sie sagt — ein langer Text aufklappbar. Ein Baustein, damit Feld,
 * Abschnitt, Buchzeile und Maske dasselbe zeigen.
 */
@Component({
  selector: 'nw-abw',
  imports: [Text],
  template: `
    @for (a of liste(); track a.id) {
      <span class="fassung" [class.lang]="a.lang">
        <span class="kuerzel" [class.vergleich]="a.compare" [title]="a.titel">{{ a.kuerzel }}</span>
        @if (a.lang && a.text) {
          <details>
            <summary>{{ titel() || 'says otherwise' }}</summary>
            <nw-text [text]="a.text" [scopes]="scopes()" />
          </details>
        } @else if (a.lang) {
          <span class="fwert dim">— not set in {{ a.kuerzel }}</span>
        } @else if (a.text) {
          <!-- Ein Verweis im Wert bleibt ein Verweis (M11), kein \`[[…]]\`. -->
          <nw-text class="fwert" inline [text]="a.text" [scopes]="scopes()" />
        } @else {
          <!-- Fehlt dort (T-173): leer hiess vorher „—", und das las sich wie ein Wert. -->
          <span class="fwert dim">— not set in {{ a.kuerzel }}</span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .fassung {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.15rem 0.4rem;
      margin-top: 0.15rem;
      font-family: var(--sans);
      font-size: 0.85rem;
      font-style: normal;
      font-weight: 400;
      color: var(--dim);
      /* Auffällig (T-173): ein Balken in Gold und die Raute am Kürzel —
         Farbe und Form, damit es auch ohne Farbe auffällt. */
      border-left: 3px solid var(--gold);
      padding-left: 0.4rem;
    }
    .fassung.lang {
      display: block;
    }
    .fassung.lang > .fwert {
      margin-left: 0.4rem;
    }
    details {
      display: inline;
    }
    summary {
      display: inline;
      cursor: pointer;
      min-height: 28px;
      margin-left: 0.4rem;
    }
    details[open] {
      display: block;
    }
    details > :not(summary) {
      display: block;
      margin-top: 0.25rem;
      padding: 0.35rem 0.6rem;
      border-left: 3px solid var(--line);
      color: var(--ink);
      font-family: var(--serif, inherit);
      font-size: 0.95rem;
    }
    .fwert {
      color: var(--ink);
      overflow-wrap: anywhere;
    }
    .dim {
      color: var(--dim);
    }
    .kuerzel {
      font-family: var(--sans);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 0 0.35rem;
      border: 1px solid var(--gold);
      border-radius: 3px;
      color: var(--ink);
      background: var(--hover);
      white-space: nowrap;
    }
    .kuerzel::before {
      content: '◆ ';
      color: var(--gold);
    }
    .kuerzel.vergleich {
      border-style: dashed;
    }
  `,
})
export class AbwMarken {
  readonly liste = input<readonly Abweichung[]>([]);
  readonly scopes = input<VarScopes>({});
  /** Was am aufklappbaren Text steht — eine Überschrift, die nur dort steht, sagt es selbst. */
  readonly titel = input<string>('');
}


// ------------------------------------------------------------ Auf einen Blick (T-173)

/**
 * **Was eine Fassung anders hat, als Satz** (T-173, Punkt 2): „Differs in:
 * tier" oder „Same text and values — only the source differs (XDMG
 * p. 324)". Vorher zählte der Kasten die Fassungen nur auf, und wer nichts
 * Abweichendes fand, wusste nicht, ob es nichts gab.
 */
export function fassungsSatz(s: VersionSummary): string {
  if (s.same) return s.source ? `Same text and values — only the source differs (${s.source})` : 'Same text and values';
  const felder = s.fields.map((f) => (s.notThere.includes(f) ? `${f} (not set there)` : f));
  return `Differs in: ${[...felder, ...s.relations].join(', ')}`;
}

/** Je Fassung die Zusammenfassung gegen den Artikel hier. */
export function zusammenfassungen(r: Registry | null, basis: Entity | null, f: Fassungen | null): Map<string, VersionSummary> {
  const out = new Map<string, VersionSummary>();
  if (!r || !basis || !f) return out;
  for (const v of f.versions) out.set(v.entity.id, versionSummary(r, basis, v.entity));
  return out;
}

/**
 * **Welche Fassung am Tisch gilt** (T-173, Punkt 5) — nur gesagt, wenn
 * mehr als eine im Spiel ist; sonst ist es keine Frage. Es gilt die aus
 * der obersten Ebene des Stapels (`versionInPlay`), wie in den Listen.
 */
export function geltendeFassung(
  basis: Entity | null,
  f: Fassungen | null,
): { id: string; satz: string } | null {
  if (!basis || !f) return null;
  const ebenen = new Map(f.layers.map((l) => [l.id, l]));
  const ranks = new Map(f.layers.filter((l) => l.rank !== undefined).map((l) => [l.id, l.rank!]));
  const imSpiel = [basis, ...f.versions.filter((v) => v.play).map((v) => v.entity)].filter((e) =>
    layersOf(e).some((l) => ranks.has(l)),
  );
  if (imSpiel.length < 2) return null;
  const g = versionInPlay(imSpiel, ranks);
  if (!g) return null;
  const kurz = (id: string) => ebenen.get(id)?.short ?? '?';
  const andere = imSpiel
    .filter((e) => e.id !== g.entity.id)
    .flatMap((e) => layersOf(e).filter((l) => ranks.has(l)))
    .map(kurz);
  const wer = g.entity.id === basis.id ? 'this one' : `the ${kurz(g.layer)} version`;
  const auch = [...new Set(andere)].filter((k) => k !== kurz(g.layer));
  return {
    id: g.entity.id,
    satz: `In play: ${kurz(g.layer)}. ${auch.join(' and ')} ${auch.length > 1 ? 'are' : 'is'} on too, but ${kurz(g.layer)} is higher in the layer stack, so lists and links show ${wer}.`,
  };
}

/**
 * **Das Abzeichen in der Kopfzeile** (T-173, Punkt 0): „2 versions ·
 * differs in tier" unter dem Namen, ein Link zum Vergleich nebeneinander.
 * Die Leitung fand den Kasten in der Seitenspalte erst beim zweiten
 * Hinsehen — am Telefon steht er ganz unten. Das Abzeichen steht oben,
 * auch dort.
 */
@Component({
  selector: 'nw-fassungs-abzeichen',
  imports: [RouterLink],
  template: `
    @if (abzeichen(); as a) {
      <a class="abzeichen" [routerLink]="['/artikel', a.basis, 'compare', a.mit]" [title]="a.titel">
        <span class="raute" aria-hidden="true">◆</span>
        <span>{{ a.text }}</span>
        <span class="pfeil" aria-hidden="true">›</span>
      </a>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 0.4rem;
    }
    .abzeichen {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 32px;
      padding: 0.15rem 0.7rem;
      border: 1px solid var(--gold);
      border-left-width: 4px;
      border-radius: 4px;
      background: var(--hover);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .abzeichen:hover,
    .abzeichen:focus-visible {
      border-color: var(--accent);
    }
    .raute {
      color: var(--gold);
    }
    .pfeil {
      color: var(--dim);
    }
  `,
})
export class FassungsAbzeichen {
  readonly basis = input<Entity | null>(null);
  readonly fassungen = input<Fassungen | null>(null);
  private readonly bestand = inject(Bestand);

  protected readonly abzeichen = computed(() => {
    const e = this.basis();
    const f = this.fassungen();
    if (!e || !f?.versions.length) return null;
    const z = zusammenfassungen(this.bestand.registry(), e, f);
    const felder = [...new Set([...z.values()].flatMap((s) => [...s.fields, ...s.relations]))];
    /* Zum Vergleich mit der ersten, die etwas anders sagt — sonst der ersten. */
    const mit = f.versions.find((v) => z.get(v.entity.id)?.same === false) ?? f.versions[0]!;
    const n = f.versions.length + 1;
    const was = felder.length
      ? `differs in ${felder.slice(0, 3).join(', ')}${felder.length > 3 ? ` +${felder.length - 3}` : ''}`
      : 'same text';
    const g = geltendeFassung(e, f);
    return {
      basis: e.id,
      mit: mit.entity.id,
      text: `${n} versions · ${was}`,
      titel: `Compare side by side${g ? `. ${g.satz}` : ''}`,
    };
  });
}

/**
 * **Der Kasten „Versions" in der Seitenspalte** (T-092): ein-/ausschalten,
 * welche Ebenen verglichen werden, die Fassungen selbst — und für die
 * Leitung „use this in my campaign" an einer Fassung aus einer
 * Vergleichsebene, rückgängig an derselben Stelle.
 */
@Component({
  selector: 'nw-fassungen',
  imports: [RouterLink],
  template: `
    @if (fassungen(); as f) {
      @if (f.versions.length) {
        <section class="kasten fassungen" aria-label="Versions">
          <h2>Versions</h2>
          <label class="schalter">
            <input type="checkbox" [checked]="lesart.stand().on" (change)="an($event)" />
            <span>Show where other versions differ</span>
          </label>
          @if (lesart.stand().on && ebenen().length > 1) {
            <fieldset class="ebenen">
              <legend>Compare with</legend>
              @for (l of ebenen(); track l.id) {
                <label [title]="l.name">
                  <input type="checkbox" [checked]="!aus().has(l.id)" (change)="ebene(l.id, $event)" />
                  <span class="kuerzel" [class.vergleich]="l.compare">{{ l.short }}</span>
                  <span class="dim">{{ l.name }}</span>
                </label>
              }
            </fieldset>
          }
          <!-- Welche gilt, wenn beide im Spiel sind (T-173, Punkt 5). -->
          @if (geltend(); as g) {
            <p class="geltend">{{ g.satz }}</p>
          }
          <ul class="kanten">
            @for (v of f.versions; track v.entity.id) {
              <li>
                <span class="rl">
                  @for (l of v.layers; track l) {
                    <span class="kuerzel" [class.vergleich]="v.compare" [title]="ebenenName(l)">{{ kurz(l) }}</span>
                  } @empty {
                    <span class="kuerzel">—</span>
                  }
                </span>
                <a [routerLink]="['/artikel', v.entity.id]">{{ name(v.entity) }}</a>
                @if (v.compare) {
                  <span class="dim">compare</span>
                }
                <a class="vergleichen" [routerLink]="['/artikel', artikel(), 'compare', v.entity.id]">Compare</a>
                <!-- Was sie anders hat, in einem Satz (T-173, Punkt 2). -->
                @if (saetze().get(v.entity.id); as satz) {
                  <span class="satz" [class.gleich]="satz.startsWith('Same')">{{ satz }}</span>
                }
                @if (v.adoptable && f.campaign) {
                  <button type="button" class="klein" [disabled]="laeuft()" (click)="uebernehmen(v)">
                    Use this in my campaign
                  </button>
                }
                @if (v.adoptedAs && f.campaign) {
                  <span class="dim">in use in this campaign</span>
                  <button type="button" class="klein" [disabled]="laeuft()" (click)="zuruecknehmen(v)">Undo</button>
                }
              </li>
            }
          </ul>
          @if (fehler(); as e) {
            <p class="fehler" role="alert">{{ e }}</p>
          }
        </section>
      }
    }
  `,
  styles: `
    /* Wie die übrigen Kästen der Seitenspalte (artikel.scss). */
    .kasten {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .kasten h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1rem;
      color: var(--accent);
    }
    .kanten {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .kanten li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem 0.6rem;
      align-items: center;
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--line2);
    }
    .kanten li:last-child {
      border-bottom: 0;
    }
    .rl {
      display: inline-flex;
      gap: 0.25rem;
    }
    .satz {
      flex-basis: 100%;
      font-size: 0.85rem;
      color: var(--ink);
      border-left: 3px solid var(--gold);
      padding-left: 0.4rem;
    }
    .satz.gleich {
      border-left-color: var(--line);
      color: var(--dim);
    }
    .vergleichen {
      font-size: 0.85rem;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
    }
    .geltend {
      margin: 0;
      font-size: 0.85rem;
      padding: 0.3rem 0.5rem;
      background: var(--hover);
      border-radius: 4px;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
    }
    .kuerzel {
      font-family: var(--sans);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 0 0.35rem;
      border: 1px solid var(--line);
      border-radius: 3px;
      color: var(--dim);
      white-space: nowrap;
    }
    .kuerzel.vergleich {
      border-style: dashed;
    }
    .schalter,
    .ebenen label {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 36px;
    }
    .ebenen {
      margin: 0;
      padding: 0.25rem 0 0;
      border: 0;
      border-top: 1px solid var(--line2);
    }
    .ebenen legend {
      padding: 0;
      font-size: 0.8rem;
      color: var(--dim);
    }
    .ebenen .dim {
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    .klein {
      font-size: 0.8rem;
      padding: 0.15rem 0.6rem;
      min-height: 32px;
    }
  `,
})
export class FassungsKasten {
  readonly artikel = input.required<string>();
  readonly fassungen = input<Fassungen | null>(null);
  /** Der Artikel selbst — für die Sätze, was eine Fassung anders hat (T-173). */
  readonly basis = input<Entity | null>(null);
  /** Nach dem Übernehmen oder Zurücknehmen: der Artikel, der jetzt gilt. */
  readonly gewechselt = output<string>();

  protected readonly lesart = inject(FassungsLesart);
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly saetze = computed(() => {
    const out = new Map<string, string>();
    for (const [id, s] of zusammenfassungen(this.bestand.registry(), this.basis(), this.fassungen())) out.set(id, fassungsSatz(s));
    return out;
  });
  protected readonly geltend = computed(() => geltendeFassung(this.basis(), this.fassungen()));
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);

  protected readonly aus = computed(() => new Set(this.lesart.stand().off));
  /** Die Ebenen, aus denen hier Fassungen kommen. */
  protected readonly ebenen = computed(() => {
    const f = this.fassungen();
    if (!f) return [];
    const da = new Set(f.versions.flatMap((v) => (v.layers.length ? v.layers : [OHNE_EBENE])));
    const l = f.layers.filter((x) => da.has(x.id));
    if (da.has(OHNE_EBENE)) l.push({ id: OHNE_EBENE, name: 'No layer', short: '—', compare: false, play: true });
    return l;
  });

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected kurz(id: string): string {
    return this.fassungen()?.layers.find((l) => l.id === id)?.short ?? '?';
  }
  protected ebenenName(id: string): string {
    return this.fassungen()?.layers.find((l) => l.id === id)?.name ?? '';
  }

  protected an(ev: Event): void {
    this.lesart.setze({ on: (ev.target as HTMLInputElement).checked });
  }
  protected ebene(id: string, ev: Event): void {
    this.lesart.ebene(id, (ev.target as HTMLInputElement).checked);
  }

  protected async uebernehmen(v: Fassung): Promise<void> {
    const c = this.fassungen()?.campaign;
    if (!c) return;
    await this.tun(async () => {
      const kopie = await this.api.adopt(c.id, v.entity.id, this.artikel());
      this.gewechselt.emit(kopie.id);
    });
  }

  protected async zuruecknehmen(v: Fassung): Promise<void> {
    const c = this.fassungen()?.campaign;
    if (!c || !v.adoptedAs) return;
    await this.tun(async () => {
      const r = await this.api.unadopt(c.id, v.adoptedAs!);
      this.gewechselt.emit(r.over ?? v.entity.id);
    });
  }

  private async tun(was: () => Promise<void>): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await was();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}
