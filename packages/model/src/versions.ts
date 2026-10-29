/**
 * **Fassungen derselben Sache** (E-021 d, T-092, REQ-243).
 *
 * Es gibt keinen Umschalter zwischen „PHB 2014" und „PHB 2024". Beide
 * Fassungen bleiben eigene Artikel; an jedem Feld, an dem eine andere
 * Fassung etwas anderes sagt, steht ihr Wert dabei — ein- und ausschaltbar
 * und je Ebene einstellbar. Dafür braucht es drei Fragen, und alle drei
 * stehen hier, einmal, für Server und Oberfläche:
 *
 *  1. **Was ist eine Fassung?** Zwei Artikel derselben Art, die über
 *     `variantOf` (in beide Richtungen) oder `overrides` verbunden sind und
 *     **dieselbe Sache** heissen. `variantOf` trägt heute auch anderes —
 *     den Grundgegenstand eines magischen Gegenstands (Oathbow → Longbow),
 *     das Mitglied einer Gegenstandsgruppe, die aufgelöste Kopie mit
 *     eigenem Namen (Goblin Boss → Goblin). Das sind keine Fassungen.
 *     „Dieselbe Sache" heisst: gleicher Name, nachdem ein angehängtes
 *     „ (Buch)" weggelassen ist, wenn das Buch die eigene Quelle ist — so
 *     nennt der Importer die Fassungen aus mehreren Büchern
 *     („Mind Flayer (VGM)", `doppel.ts`). Eine Überschreibung ist immer
 *     eine Fassung: sie sagt es selbst.
 *  2. **Welche gehören zusammen?** Alle, die über solche Kanten
 *     erreichbar sind (`versionGroups`, `versionsOf`) — einmal über den
 *     Bestand, nie je Artikel gegen jeden.
 *  3. **Was sagt die andere Fassung anders?** `versionDiff`: je Feld der
 *     abweichende Wert, je Kantenart die Ziele, die nur eine hat.
 */

import type { Entity, EntityId, Registry } from './types.js';
import { LAYER_RELATION } from './visibility.js';
import { OVERRIDES_RELATION, isSupplement } from './stack.js';
import { entityName } from './entity.js';

export const VARIANT_RELATION = 'variantOf';

const art = (e: Entity): string => (e.interfaces ?? [])[0] ?? '';

/** Der Name ohne angehängtes „ (Buch)", wenn das Buch die eigene Quelle ist. */
export function versionName(e: Entity): string {
  const name = entityName(e).trim();
  const buch = String((e.components?.['Source'] as { publication?: unknown } | undefined)?.publication ?? '').trim();
  if (buch && name.toLowerCase().endsWith(` (${buch.toLowerCase()})`)) {
    return name.slice(0, -(buch.length + 3)).trim().toLowerCase();
  }
  return name.toLowerCase();
}

/** Sind diese beiden über eine Kante verbundenen Artikel Fassungen derselben Sache? */
export function sameThing(a: Entity, b: Entity): boolean {
  return art(a) === art(b) && versionName(a) === versionName(b);
}

/** Die Kanten, über die `e` eine Fassung von etwas ist (Ziel-Ids). */
function fassungsKanten(e: Entity, get: (id: EntityId) => Entity | undefined): EntityId[] {
  /* Eine Ergänzung (T-142) ist keine Fassung: sie trägt nur ihre Felder,
     und neben dem Artikel stünde an jedem anderen „— not set". */
  if (isSupplement(e)) return [];
  const out: EntityId[] = [];
  for (const r of e.relations ?? []) {
    if (!r.to || r.to === e.id) continue;
    if (r.type === OVERRIDES_RELATION) out.push(r.to);
    else if (r.type === VARIANT_RELATION) {
      const ziel = get(r.to);
      if (ziel && sameThing(e, ziel)) out.push(r.to);
    }
  }
  return out;
}

/**
 * **Die Gruppen** (T-092): Artikel-Id → Id der Gruppe, für jeden Artikel,
 * der mindestens eine Fassung hat. Gerechnet über die gegebenen Artikel
 * allein — eine Fassung, die der Betrachter nicht sieht, verbindet nichts.
 * Einmal über alle Kanten (Union-Find), nicht jeder gegen jeden.
 */
export function versionGroups(entities: Iterable<Entity>): Map<EntityId, EntityId> {
  const map = new Map<EntityId, Entity>();
  for (const e of entities) map.set(e.id, e);
  const eltern = new Map<EntityId, EntityId>();
  const wurzel = (id: EntityId): EntityId => {
    let w = id;
    while (eltern.has(w) && eltern.get(w) !== w) w = eltern.get(w)!;
    /* Pfad verkürzen, damit eine lange Kette nicht jedes Mal abgelaufen wird. */
    let x = id;
    while (x !== w) {
      const n = eltern.get(x)!;
      eltern.set(x, w);
      x = n;
    }
    return w;
  };
  for (const e of map.values()) {
    for (const to of fassungsKanten(e, (id) => map.get(id))) {
      if (!map.has(to)) continue;
      if (!eltern.has(e.id)) eltern.set(e.id, e.id);
      if (!eltern.has(to)) eltern.set(to, to);
      const a = wurzel(e.id);
      const b = wurzel(to);
      /* Die kleinere Id wird Wurzel — dieselbe Gruppe heisst immer gleich. */
      if (a !== b) {
        if (a < b) eltern.set(b, a);
        else eltern.set(a, b);
      }
    }
  }
  const out = new Map<EntityId, EntityId>();
  for (const id of eltern.keys()) out.set(id, wurzel(id));
  return out;
}

/**
 * **Die übrigen Fassungen dieses Artikels** (T-092) — ein Gang über den
 * Bestand für die Kanten in beide Richtungen, dann die Gruppe von hier aus.
 * Ohne den Artikel selbst; die Reihenfolge ist die des Bestands.
 */
export function versionsOf(entities: ReadonlyMap<EntityId, Entity>, id: EntityId): Entity[] {
  if (!entities.has(id)) return [];
  const nachbarn = new Map<EntityId, Set<EntityId>>();
  const verbinde = (a: EntityId, b: EntityId) => {
    (nachbarn.get(a) ?? nachbarn.set(a, new Set()).get(a)!).add(b);
    (nachbarn.get(b) ?? nachbarn.set(b, new Set()).get(b)!).add(a);
  };
  for (const e of entities.values()) {
    for (const to of fassungsKanten(e, (x) => entities.get(x))) if (entities.has(to)) verbinde(e.id, to);
  }
  const gesehen = new Set<EntityId>([id]);
  const offen = [id];
  while (offen.length) {
    const x = offen.pop()!;
    for (const n of nachbarn.get(x) ?? []) {
      if (gesehen.has(n)) continue;
      gesehen.add(n);
      offen.push(n);
    }
  }
  gesehen.delete(id);
  return [...entities.values()].filter((e) => gesehen.has(e.id));
}

/** Die Ebenen, die diesen Artikel bringen (ohne `removes`). */
export function layersOf(e: Entity): EntityId[] {
  return [
    ...new Set(
      (e.relations ?? [])
        .filter((r) => r.type === LAYER_RELATION && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes')
        .map((r) => r.to),
    ),
  ];
}

/**
 * **Das Kürzel einer Ebene** (T-092) — es steht an jedem abweichenden
 * Wert, der volle Name im Tooltip. Ein Buch aus 5e.tools heisst wie sein
 * Kürzel dort (`e5_book_xphb` → XPHB); sonst die Anfangsbuchstaben des
 * Namens, höchstens vier, und die Jahreszahl der Fassung, wenn eine dasteht.
 */
export function layerShort(layer: Entity): string {
  const buch = /^e5_book_(.+)$/.exec(layer.id);
  if (buch) return buch[1]!.replace(/-/g, '').toUpperCase();
  const name = entityName(layer);
  const jahr = /\b(19|20)\d\d\b/.exec(name)?.[0] ?? '';
  const woerter = name
    .replace(/\(.*?\)/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !/^\d+$/.test(w));
  const kurz =
    woerter.length > 1
      ? woerter
          .map((w) => w[0]!)
          .join('')
          .slice(0, 4)
          .toUpperCase()
      : (woerter[0] ?? name).slice(0, 4).toUpperCase();
  return jahr ? `${kurz} ${jahr.slice(2)}` : kurz || '?';
}

// ------------------------------------------------------------ Vergleich

/** Karten, die an jeder Fassung anders sind und nichts über die Sache sagen. */
const NICHT_VERGLEICHEN = new Set(['Identity', 'Source', 'Status', 'Visibility', '__meta']);
/** Kanten, die sagen, wo und was ein Artikel ist — nicht, was er sagt. */
const KANTEN_NICHT = new Set([LAYER_RELATION, VARIANT_RELATION, OVERRIDES_RELATION, 'instanceOf']);

export interface FieldVersion {
  /** `Typ.feld` — wie `Zelle.ref` in der Artikelansicht. */
  ref: string;
  type: string;
  key: string;
  /** Der Wert der anderen Fassung; `undefined` heisst: dort leer. */
  value: unknown;
  /** Ein langer Text: als aufklappbarer Vergleich, nicht in der Zeile. */
  long: boolean;
}

export interface RelationVersion {
  type: string;
  /** Ziele, die nur die andere Fassung hat. */
  only: EntityId[];
  /** Ziele, die nur dieser Artikel hat. */
  missing: EntityId[];
}

export interface VersionDiff {
  fields: FieldVersion[];
  relations: RelationVersion[];
}

const leer = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Schlüssel sortiert, damit gleiche Werte gleich aussehen. */
function stabil(v: unknown): string {
  const ordne = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(ordne);
    if (x && typeof x === 'object') {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(x as object).sort()) o[k] = ordne((x as Record<string, unknown>)[k]);
      return o;
    }
    return x;
  };
  return JSON.stringify(ordne(v));
}

/**
 * **Was die andere Fassung anders sagt** (T-092): je Feld, das abweicht,
 * ihr Wert; je Kantenart die Ziele, die nur eine von beiden hat. Gleiches
 * fällt weg — an einem Feld steht nur dann etwas dabei, wenn es etwas zu
 * sagen gibt. Name, Nummer, Quelle, Stand und Sichtbarkeit sind an jeder
 * Fassung anders und werden nicht verglichen; die Ebenen- und
 * Fassungskanten auch nicht.
 */
export function versionDiff(registry: Pick<Registry, 'interfaces'>, base: Entity, other: Entity): VersionDiff {
  const fields: FieldVersion[] = [];
  const typen = new Set([...Object.keys(base.components ?? {}), ...Object.keys(other.components ?? {})]);
  for (const type of typen) {
    if (NICHT_VERGLEICHEN.has(type)) continue;
    const a = (base.components?.[type] ?? {}) as Record<string, unknown>;
    const b = (other.components?.[type] ?? {}) as Record<string, unknown>;
    const props = registry.interfaces[type]?.schema?.properties ?? {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[key];
      const vb = b[key];
      if (leer(va) && leer(vb)) continue;
      if (stabil(va) === stabil(vb)) continue;
      const p = props[key];
      const long =
        p?.format === 'long' ||
        (typeof vb === 'string' && (vb.length > 160 || vb.includes('\n'))) ||
        (typeof va === 'string' && (va.length > 160 || va.includes('\n')));
      fields.push({ ref: `${type}.${key}`, type, key, value: leer(vb) ? undefined : vb, long });
    }
  }
  const relations: RelationVersion[] = [];
  const ziele = (e: Entity) => {
    const m = new Map<string, Set<EntityId>>();
    for (const r of e.relations ?? []) {
      if (KANTEN_NICHT.has(r.type) || !r.to) continue;
      (m.get(r.type) ?? m.set(r.type, new Set()).get(r.type)!).add(r.to);
    }
    return m;
  };
  const za = ziele(base);
  const zb = ziele(other);
  for (const type of new Set([...za.keys(), ...zb.keys()])) {
    const a = za.get(type) ?? new Set<EntityId>();
    const b = zb.get(type) ?? new Set<EntityId>();
    const only = [...b].filter((x) => !a.has(x));
    const missing = [...a].filter((x) => !b.has(x));
    if (only.length || missing.length) relations.push({ type, only, missing });
  }
  return { fields, relations };
}

// ------------------------------------------------------------ Abschnitte

/**
 * **Ein Abschnitt eines langen Textes** (T-103): was unter einer
 * Überschrift steht, bis zur nächsten. Der Text vor der ersten Überschrift
 * ist der Abschnitt mit dem leeren Schlüssel.
 */
export interface TextSection {
  /** Die Überschrift klein, bei Wiederholung mit `#2`, `#3` … — so finden sich die Abschnitte zweier Fassungen. */
  key: string;
  heading: string;
  /** Der Abschnitt samt Überschriftzeile — so, wie er gezeichnet wird. */
  text: string;
  /** Der Abschnitt ohne Überschriftzeile. */
  body: string;
}

/* Dieselbe Überschrift wie in `parseMarkdown` (M10), damit beide dieselben Abschnitte sehen. */
const UEBERSCHRIFT = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * **Den Text nach Überschriften teilen** (T-103). Ein langer Text aus
 * 5e.tools ist „## Age … ## Size … ## Languages …"; wer zwei Fassungen als
 * Ganzes vergleicht, hängt die abweichende an das Ende — bei Aasimar stand
 * so die andere Grösse unter „Languages". Abschnitt für Abschnitt steht
 * sie unter „Size".
 */
export function textSections(text: string): TextSection[] {
  const out: TextSection[] = [];
  const gezaehlt = new Map<string, number>();
  let heading = '';
  let kopf: string | null = null;
  let zeilen: string[] = [];
  const schliesse = () => {
    const body = zeilen.join('\n').trim();
    if (kopf === null && !body) return;
    const grund = heading.trim().toLowerCase();
    const n = (gezaehlt.get(grund) ?? 0) + 1;
    gezaehlt.set(grund, n);
    out.push({
      key: n > 1 ? `${grund}#${n}` : grund,
      heading,
      text: kopf === null ? body : body ? `${kopf}\n\n${body}` : kopf,
      body,
    });
  };
  for (const zeile of String(text ?? '').split('\n')) {
    const h = /^ {0,3}\S/.test(zeile) ? UEBERSCHRIFT.exec(zeile.trim()) : null;
    if (h) {
      schliesse();
      heading = h[2] ?? '';
      kopf = zeile.trim();
      zeilen = [];
    } else zeilen.push(zeile);
  }
  schliesse();
  return out;
}

/** Was eine Fassung in einem Abschnitt (oder einer Zeile) anders sagt. */
export interface SectionVersion {
  key: string;
  heading: string;
  /** Der Abschnitt der anderen Fassung ohne Überschrift; `undefined` heisst: dort fehlt er. */
  value: string | undefined;
  /** Nur die andere Fassung hat diesen Abschnitt. */
  onlyThere: boolean;
}

const gleichText = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

/**
 * **Zwei lange Texte Abschnitt für Abschnitt** (T-103): je Abschnitt, der
 * abweicht, was die andere Fassung dort sagt; Abschnitte, die nur sie hat,
 * in ihrer Reihenfolge am Ende. Gleiches fällt weg, Leerraum zählt nicht.
 */
export function sectionDiff(base: string, other: string): SectionVersion[] {
  const a = textSections(base);
  const b = textSections(other);
  const dort = new Map(b.map((s) => [s.key, s]));
  const hier = new Set(a.map((s) => s.key));
  const out: SectionVersion[] = [];
  for (const s of a) {
    const o = dort.get(s.key);
    if (!o) out.push({ key: s.key, heading: s.heading, value: undefined, onlyThere: false });
    else if (!gleichText(s.body, o.body)) out.push({ key: s.key, heading: s.heading, value: o.body, onlyThere: false });
  }
  for (const o of b) if (!hier.has(o.key)) out.push({ key: o.key, heading: o.heading, value: o.body, onlyThere: true });
  return out;
}

/**
 * **Zwei Zeilenlisten Zeile für Zeile** (T-103) — die Zeilen eines
 * Statblocks, Zaubers oder Gegenstands, wie das Buch-Element sie zeichnet
 * (`statblockBook` …). Verglichen wird nach Beschriftung, also das, was
 * dasteht, und nicht die Karte darunter: so steht die andere Fassung an
 * der Zeile, an der sie gelesen wird.
 */
export function linesDiff(
  base: readonly { label: string; text: string }[],
  other: readonly { label: string; text: string }[],
): SectionVersion[] {
  const key = (l: string) => l.trim().toLowerCase();
  const dort = new Map(other.map((z) => [key(z.label), z]));
  const hier = new Set(base.map((z) => key(z.label)));
  const out: SectionVersion[] = [];
  for (const z of base) {
    const o = dort.get(key(z.label));
    if (!o || !o.text) out.push({ key: key(z.label), heading: z.label, value: undefined, onlyThere: false });
    else if (!gleichText(z.text, o.text)) out.push({ key: key(z.label), heading: z.label, value: o.text, onlyThere: false });
  }
  for (const o of other) {
    if (!hier.has(key(o.label)) && o.text) out.push({ key: key(o.label), heading: o.label, value: o.text, onlyThere: true });
  }
  return out;
}

// ------------------------------------------------------------ Zusammenfassung (T-173)

/**
 * **Was eine Fassung anders hat, in einem Satz** (T-173). Die Leitung sah
 * an „+1 Weapon" den Unterschied nirgends: es war nur ein Feld, und es
 * fehlte in der anderen Fassung. Also sagt die Zusammenfassung beides —
 * welche Felder und Kanten abweichen, und wenn keine, dass sie gleich
 * sind und nur Quelle oder Seite anders steht.
 */
export interface VersionSummary {
  /** Gleiche Felder und Kanten — was bleibt, ist Name, Quelle, Stand. */
  same: boolean;
  /** Beschriftungen der abweichenden Felder, in der Reihenfolge des Vergleichs. */
  fields: string[];
  /** Beschriftungen der Kantenarten, die abweichen. */
  relations: string[];
  /** Felder, die nur dieser Artikel setzt — die andere Fassung lässt sie leer. */
  notThere: string[];
  /** Die Quelle der anderen Fassung, wenn sie anders steht („XDMG p. 324"). */
  source?: string;
}

const feldTitel = (registry: Pick<Registry, 'interfaces'>, type: string, key: string): string =>
  registry.interfaces[type]?.schema?.properties?.[key]?.title ?? key;

const quelleText = (e: Entity): string => {
  const s = (e.components?.['Source'] ?? {}) as { publication?: unknown; page?: unknown };
  const buch = String(s.publication ?? '').trim();
  const seite = String(s.page ?? '').trim();
  return [buch, seite ? `p. ${seite}` : ''].filter(Boolean).join(' ');
};

export function versionSummary(
  registry: Pick<Registry, 'interfaces'> & { relations?: Registry['relations'] },
  base: Entity,
  other: Entity,
  diff: VersionDiff = versionDiff(registry, base, other),
): VersionSummary {
  const fields = diff.fields.map((f) => feldTitel(registry, f.type, f.key));
  const notThere = diff.fields.filter((f) => f.value === undefined).map((f) => feldTitel(registry, f.type, f.key));
  const relations = diff.relations.map((r) => registry.relations?.[r.type]?.label ?? r.type);
  const qa = quelleText(base);
  const qb = quelleText(other);
  return {
    same: !fields.length && !relations.length,
    fields,
    relations,
    notThere,
    ...(qb && qb !== qa ? { source: qb } : {}),
  };
}

// ------------------------------------------------------------ Welche gilt (T-173)

/**
 * **Welche Fassung gilt am Tisch** (T-173, Punkt 5): sind zwei Ebenen mit
 * Fassungen derselben Sache aufgeschaltet, steht in Listen und Verweisen
 * die aus der **obersten** Ebene des Stapels (dieselbe Regel wie
 * `queryList` mit `versions`). `ranks` ist `activeLayerRanks` — grösser
 * heisst weiter oben. Ohne Ebene im Spiel: `null`.
 */
export function versionInPlay(
  candidates: readonly Entity[],
  ranks: ReadonlyMap<EntityId, number>,
): { entity: Entity; layer: EntityId; rank: number } | null {
  let best: { entity: Entity; layer: EntityId; rank: number } | null = null;
  for (const e of candidates) {
    for (const l of layersOf(e)) {
      const r = ranks.get(l);
      if (r === undefined) continue;
      if (!best || r > best.rank) best = { entity: e, layer: l, rank: r };
    }
  }
  return best;
}

// ------------------------------------------------------------ Nebeneinander (T-173)

/** Wie eine Zeile des Vergleichs steht. */
export type CompareState = 'same' | 'changed' | 'onlyLeft' | 'onlyRight';

/** Ein Feld im Vergleich nebeneinander. */
export interface CompareFieldRow {
  ref: string;
  type: string;
  key: string;
  label: string;
  left: unknown;
  right: unknown;
  state: CompareState;
  long: boolean;
  /** Name, Quelle, Stand, Sichtbarkeit: gezeigt, aber kein Unterschied in der Sache. */
  meta: boolean;
}

/** Eine Kantenart im Vergleich nebeneinander. */
export interface CompareRelationRow {
  type: string;
  label: string;
  left: EntityId[];
  right: EntityId[];
  state: CompareState;
}

export interface CompareRows {
  fields: CompareFieldRow[];
  relations: CompareRelationRow[];
}

const zustand = (a: unknown, b: unknown): CompareState =>
  leer(a) ? 'onlyRight' : leer(b) ? 'onlyLeft' : stabil(a) === stabil(b) ? 'same' : 'changed';

/**
 * **Zwei Artikel Feld für Feld, nebeneinander** (T-173): alle Felder, die
 * eine Seite setzt — auch gleiche, denn „gleich" ist eine Auskunft — und
 * alle Kantenarten mit ihren Zielen. Gebraucht für Fassungen und für die
 * Übertragung dev → prod (T-130), wo zwei Stände desselben Artikels
 * nebeneinanderstehen; darum nimmt es zwei beliebige Artikel.
 * Reihenfolge: die Typen des linken Artikels, dann was nur rechts steht;
 * je Typ die Felder in der Reihenfolge des Registers.
 */
export function compareRows(
  registry: Pick<Registry, 'interfaces'> & { relations?: Registry['relations'] },
  left: Entity,
  right: Entity,
): CompareRows {
  const fields: CompareFieldRow[] = [];
  const typen = [...new Set([...Object.keys(left.components ?? {}), ...Object.keys(right.components ?? {})])].filter(
    (t) => t !== '__meta',
  );
  for (const type of typen) {
    const a = (left.components?.[type] ?? {}) as Record<string, unknown>;
    const b = (right.components?.[type] ?? {}) as Record<string, unknown>;
    const props = registry.interfaces[type]?.schema?.properties ?? {};
    const schluessel = [...new Set([...Object.keys(props), ...Object.keys(a), ...Object.keys(b)])];
    for (const key of schluessel) {
      const va = a[key];
      const vb = b[key];
      if (leer(va) && leer(vb)) continue;
      const p = props[key];
      const istLang = (v: unknown) => typeof v === 'string' && (v.length > 160 || v.includes('\n'));
      fields.push({
        ref: `${type}.${key}`,
        type,
        key,
        label: p?.title ?? key,
        left: leer(va) ? undefined : va,
        right: leer(vb) ? undefined : vb,
        state: zustand(va, vb),
        long: p?.format === 'long' || istLang(va) || istLang(vb),
        meta: NICHT_VERGLEICHEN.has(type),
      });
    }
  }
  const ziele = (e: Entity) => {
    const m = new Map<string, EntityId[]>();
    for (const r of e.relations ?? []) {
      if (!r.to) continue;
      const l = m.get(r.type) ?? m.set(r.type, []).get(r.type)!;
      if (!l.includes(r.to)) l.push(r.to);
    }
    return m;
  };
  const za = ziele(left);
  const zb = ziele(right);
  const relations: CompareRelationRow[] = [];
  for (const type of new Set([...za.keys(), ...zb.keys()])) {
    const l = za.get(type) ?? [];
    const r = zb.get(type) ?? [];
    const gleich = l.length === r.length && l.every((x) => r.includes(x));
    relations.push({
      type,
      label: registry.relations?.[type]?.label ?? type,
      left: l,
      right: r,
      state: !l.length ? 'onlyRight' : !r.length ? 'onlyLeft' : gleich ? 'same' : 'changed',
    });
  }
  return { fields, relations };
}

/** Eine Zeile eines Zeilenvergleichs: gleich, nur links (weg) oder nur rechts (dazu). */
export interface DiffLine {
  op: 'same' | 'del' | 'add';
  text: string;
}

/**
 * **Zwei Texte Zeile für Zeile, wie ein Git-Vergleich** (T-173): die
 * längste gemeinsame Folge, davor und dazwischen was weg- oder dazukommt.
 * Leerraum am Zeilenende zählt nicht. Bei sehr langen Texten (mehr als
 * vier Millionen Zellen) steht links alles als weg und rechts alles als
 * dazu — falsch wäre ein halber Vergleich, der Gleiches als neu zeigt,
 * ohne es zu sagen; so sieht man, dass nicht verglichen wurde.
 */
export function lineDiff(left: string, right: string): DiffLine[] {
  const a = String(left ?? '').split('\n');
  const b = String(right ?? '').split('\n');
  const gleich = (x: string, y: string) => x.trimEnd() === y.trimEnd();
  /* Gleicher Anfang und gleiches Ende zuerst — die Tabelle bleibt klein. */
  let vorn = 0;
  while (vorn < a.length && vorn < b.length && gleich(a[vorn]!, b[vorn]!)) vorn++;
  let hinten = 0;
  while (hinten < a.length - vorn && hinten < b.length - vorn && gleich(a[a.length - 1 - hinten]!, b[b.length - 1 - hinten]!)) hinten++;
  const ma = a.slice(vorn, a.length - hinten);
  const mb = b.slice(vorn, b.length - hinten);
  const out: DiffLine[] = a.slice(0, vorn).map((text) => ({ op: 'same', text }));
  if (ma.length * mb.length > 4_000_000) {
    out.push(...ma.map((text) => ({ op: 'del' as const, text })), ...mb.map((text) => ({ op: 'add' as const, text })));
  } else {
    /* lcs[i][j]: Länge der gemeinsamen Folge von ma[i..] und mb[j..]. */
    const n = ma.length;
    const m = mb.length;
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i]![j] = gleich(ma[i]!, mb[j]!) ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && gleich(ma[i]!, mb[j]!)) {
        out.push({ op: 'same', text: ma[i]! });
        i++;
        j++;
      } else if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
        /* Weg vor dazu, wie in einem Git-Vergleich: erst kommt, was ging. */
        if (i < n && lcs[i + 1]![j]! === lcs[i]![j + 1]!) {
          out.push({ op: 'del', text: ma[i]! });
          i++;
        } else {
          out.push({ op: 'add', text: mb[j]! });
          j++;
        }
      } else {
        out.push({ op: 'del', text: ma[i]! });
        i++;
      }
    }
  }
  out.push(...a.slice(a.length - hinten).map((text) => ({ op: 'same' as const, text })));
  return out;
}
