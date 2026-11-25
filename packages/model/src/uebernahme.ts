/**
 * **Übernahme zwischen zwei Installationen** (T-130, REQ-155): Artikel
 * und Registerzeilen von dev nach prod schieben und von prod nach dev
 * holen — mit Vorschau, Konflikten und Rückgängig.
 *
 * Gerechnet wird hier, ohne Server und ohne Netz: was die Vorschau zeigt,
 * ist dieselbe Rechnung, die danach schreibt.
 *
 * **Wie in git, mit einer Basis.** Ob eine Seite etwas geändert hat, sagt
 * der Vergleich mit dem Stand der **letzten Übernahme** (`base`): damals
 * standen beide Seiten gleich. Je Feld, je Kante:
 *
 *  - beide gleich → nichts zu tun (`same`);
 *  - nur die Quelle wich von der Basis ab → die Quelle gilt (`source`);
 *  - nur das Ziel wich ab → das Ziel bleibt (`target`);
 *  - beide wichen verschieden ab → **Konflikt** (`conflict`), und der wird
 *    einzeln gelöst: Quelle nehmen, Ziel behalten oder von Hand.
 *
 * Ohne Basis (der erste Abgleich eines Artikels) ist jeder Unterschied
 * ein Konflikt, ausser eine Seite hat das Feld gar nicht — nichts wird
 * still überschrieben.
 *
 * **Die Nummer gehört prod** (die Vorgabe der Leitung): die Peg-Id ist
 * zufällig und auf beiden Seiten dieselbe, die Nummer (`Identity.id`,
 * `npc-0042`) zählt jede Installation für sich. Kommt ein Artikel neu nach
 * prod und ist seine Nummer dort vergeben, gibt prod ihm die nächste
 * freie, und dev zieht nach (`assignNumbers`, `repoint`). Holt dev von
 * prod, weicht auf dev, was dieselbe Nummer trägt (`yieldNumbers`). Darum
 * steht `Identity.id` nicht unter den Feldern, die verglichen werden.
 */

import { z } from 'zod';
import type { Entity, Registry, Relation } from './types.js';
import { BulkSelectSchema } from './bulk.js';
import { stableJson } from './checks.js';
import { articleId, entityName, nextId } from './entity.js';
import { LAYER_RELATION } from './visibility.js';
import { INSTANCE_RELATION } from './instance.js';

export type TransferDirection = 'push' | 'pull';

/** Was mit einem Feld geschieht — siehe oben. */
export type FieldState = 'same' | 'source' | 'target' | 'conflict';

/** Ein Feld, eine Kante oder die Arten eines Artikels im Vergleich. */
export interface TransferField {
  /** `interfaces`, `adhoc`, `Karte.feld` oder `edge:<kanten-id>`. */
  key: string;
  kind: 'types' | 'field' | 'adhoc' | 'edge';
  /** `undefined` heisst: steht dort nicht. */
  base?: unknown;
  source?: unknown;
  target?: unknown;
  state: FieldState;
}

export type TransferStatus = 'new' | 'changed' | 'unchanged' | 'conflict' | 'target-ahead';

export interface TransferItem {
  id: string;
  kind: 'entity' | 'registry';
  name: string;
  /** Art des Artikels; bei einer Registerzeile der Teil (`interfaces` …). */
  type: string;
  number: string;
  /** Die Ebenen (Namen), in denen der Artikel liegt — zum Gruppieren. */
  layers: string[];
  status: TransferStatus;
  /** Nur, was nicht `same` ist. */
  fields: TransferField[];
  /** Woran der Lauf merkt, dass sich seit der Vorschau etwas bewegt hat. */
  sourceKey: string;
  targetKey: string;
}

/** Wie ein Konflikt gelöst wird: eine Seite oder ein Wert von Hand. */
export type TransferChoice = 'source' | 'target' | { value: unknown };

const gleich = (a: unknown, b: unknown): boolean =>
  (a === undefined && b === undefined) || (a !== undefined && b !== undefined && stableJson(a) === stableJson(b));

/** Der Zustand eines Werts aus Basis, Quelle und Ziel. */
export function fieldState(base: unknown, source: unknown, target: unknown): FieldState {
  if (gleich(source, target)) return 'same';
  if (gleich(source, base)) return 'target';
  if (gleich(target, base)) return 'source';
  return 'conflict';
}

const kante = (r: Relation) => ({ type: r.type, to: r.to, ...(r.props && Object.keys(r.props).length ? { props: r.props } : {}) });

/** Ein Artikel als flache Liste von Schlüssel → Wert. `Identity.id` fehlt (oben). */
export function transferFields(e: Entity | undefined): Map<string, { kind: TransferField['kind']; value: unknown }> {
  const raus = new Map<string, { kind: TransferField['kind']; value: unknown }>();
  if (!e) return raus;
  raus.set('interfaces', { kind: 'types', value: e.interfaces ?? [] });
  for (const [karte, felder] of Object.entries(e.components ?? {})) {
    for (const [feld, wert] of Object.entries(felder ?? {})) {
      if (karte === 'Identity' && feld === 'id') continue;
      if (wert === undefined) continue;
      raus.set(`${karte}.${feld}`, { kind: 'field', value: wert });
    }
  }
  if (e.adhoc?.length) raus.set('adhoc', { kind: 'adhoc', value: e.adhoc });
  for (const r of e.relations ?? []) raus.set(`edge:${r.id}`, { kind: 'edge', value: kante(r) });
  return raus;
}

const reihe = (key: string): string => (key === 'interfaces' ? '0' : key.startsWith('edge:') ? `2${key}` : key === 'adhoc' ? '3' : `1${key}`);

/** Jedes Feld im Dreiervergleich, auch die gleichen. */
export function compareThree(base: Entity | undefined, source: Entity | undefined, target: Entity | undefined): TransferField[] {
  const b = transferFields(base);
  const s = transferFields(source);
  const t = transferFields(target);
  const keys = [...new Set([...b.keys(), ...s.keys(), ...t.keys()])].sort((x, y) => reihe(x).localeCompare(reihe(y)));
  return keys.map((key) => {
    const kind = (s.get(key) ?? t.get(key) ?? b.get(key))!.kind;
    const bv = base ? b.get(key)?.value : undefined;
    const sv = s.get(key)?.value;
    const tv = t.get(key)?.value;
    return {
      key,
      kind,
      ...(bv !== undefined ? { base: bv } : {}),
      ...(sv !== undefined ? { source: sv } : {}),
      ...(tv !== undefined ? { target: tv } : {}),
      state: fieldState(bv, sv, tv),
    };
  });
}

/** Gespeichert gleich? Wie `storedKey` in bulk.ts, aber ohne Revision und Zeiten. */
export function transferKey(e: Entity | undefined | null): string {
  if (!e) return 'null';
  return stableJson({
    interfaces: e.interfaces ?? [],
    components: e.components ?? {},
    adhoc: e.adhoc ?? [],
    relations: (e.relations ?? []).map((r) => ({ id: r.id, ...kante(r) })),
  });
}

export function transferStatus(target: Entity | undefined, fields: TransferField[]): TransferStatus {
  if (!target) return 'new';
  if (fields.some((f) => f.state === 'conflict')) return 'conflict';
  if (fields.some((f) => f.state === 'source')) return 'changed';
  if (fields.some((f) => f.state === 'target')) return 'target-ahead';
  return 'unchanged';
}

/** Ein Artikel in der Vorschau. `layerName` nennt eine Ebene beim Namen. */
export function transferItem(
  base: Entity | undefined,
  source: Entity,
  target: Entity | undefined,
  layerName: (id: string) => string,
): TransferItem {
  const alle = compareThree(base, source, target);
  const fields = alle.filter((f) => f.state !== 'same');
  return {
    id: source.id,
    kind: 'entity',
    name: entityName(source),
    type: source.interfaces?.[0] ?? '',
    number: articleId(target ?? source),
    layers: (source.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => layerName(r.to)),
    status: transferStatus(target, fields),
    fields,
    sourceKey: transferKey(source),
    targetKey: transferKey(target),
  };
}

/**
 * **Das Ergebnis eines Artikels**: was nach der Übernahme auf dem Ziel
 * steht. Konflikte ohne Wahl stehen in `unresolved`, und dann ist das
 * Ergebnis nicht zu schreiben. Die Nummer bleibt die des Ziels, wenn es
 * den Artikel dort schon gibt.
 */
export function mergeTransfer(
  base: Entity | undefined,
  source: Entity,
  target: Entity | undefined,
  choices: Record<string, TransferChoice> = {},
): { entity: Entity; unresolved: string[] } {
  const unresolved: string[] = [];
  const werte = new Map<string, { kind: TransferField['kind']; value: unknown }>();
  for (const f of compareThree(base, source, target)) {
    let wert: unknown;
    if (f.state === 'same' || f.state === 'source') wert = f.source;
    else if (f.state === 'target') wert = f.target;
    else {
      const wahl = choices[f.key];
      if (wahl === 'source') wert = f.source;
      else if (wahl === 'target') wert = f.target;
      else if (wahl && typeof wahl === 'object') wert = wahl.value;
      else {
        unresolved.push(f.key);
        continue;
      }
    }
    /* Von Hand `null` an einer Kante oder den Arten heisst: weg. */
    if (wert === undefined || (wert === null && f.kind !== 'field')) continue;
    werte.set(f.key, { kind: f.kind, value: wert });
  }
  const components: Entity['components'] = {};
  const relations: Relation[] = [];
  let interfaces: string[] = source.interfaces ?? [];
  let adhoc: Entity['adhoc'];
  for (const [key, { kind, value }] of werte) {
    if (kind === 'types') interfaces = value as string[];
    else if (kind === 'adhoc') adhoc = value as Entity['adhoc'];
    else if (kind === 'edge') {
      const k = value as { type: string; to: string; props?: Relation['props'] };
      relations.push({ id: key.slice(5), type: k.type, to: k.to, ...(k.props ? { props: k.props } : {}) });
    } else {
      const punkt = key.indexOf('.');
      const karte = key.slice(0, punkt);
      (components[karte] ??= {})[key.slice(punkt + 1)] = value;
    }
  }
  /* Die Kanten in der Reihenfolge, in der das Ziel (sonst die Quelle) sie hält. */
  const ordnung = new Map([...(target?.relations ?? []), ...(source.relations ?? [])].map((r, i) => [r.id, i] as const));
  relations.sort((a, b) => (ordnung.get(a.id) ?? 0) - (ordnung.get(b.id) ?? 0));
  const nummer = articleId(target ?? source);
  if (nummer) components['Identity'] = { ...(components['Identity'] ?? {}), id: nummer };
  const name = typeof components['Identity']?.['name'] === 'string' ? (components['Identity']['name'] as string) : entityName(source);
  const entity: Entity = {
    id: source.id,
    interfaces,
    name,
    components,
    ...(adhoc ? { adhoc } : {}),
    relations,
  };
  return { entity, unresolved };
}

/**
 * **prod vergibt die Nummer** für Artikel, die neu ankommen: ist die
 * mitgebrachte dort frei, bleibt sie, sonst die nächste freie dieser Art.
 * Zurück: Peg-Id → neue Nummer, nur wo sie sich ändert.
 */
export function assignNumbers(target: Iterable<Entity>, incoming: Entity[]): Map<string, string> {
  const bestand = [...target];
  const pegs = new Set(bestand.map((e) => e.id));
  const vergeben = new Map<string, string>();
  for (const e of bestand) {
    const n = articleId(e);
    if (n) vergeben.set(n, e.id);
  }
  /* Erst die freien Nummern der Ankommenden belegen: sonst verdrängte die
     neue Nummer eines Artikels die mitgebrachte eines anderen. */
  const neu: Entity[] = [];
  for (const e of incoming) {
    if (pegs.has(e.id)) continue;
    const n = articleId(e);
    if (!n) continue;
    const besetzt = vergeben.get(n);
    if (besetzt === undefined || besetzt === e.id) vergeben.set(n, e.id);
    else neu.push(e);
  }
  const raus = new Map<string, string>();
  for (const e of neu) {
    const n = nextId(bestand, e.interfaces?.[0] ?? '', vergeben.keys());
    vergeben.set(n, e.id);
    raus.set(e.id, n);
  }
  return raus;
}

/**
 * **dev weicht** (Holen von prod): trägt ein Artikel auf dev dieselbe
 * Nummer wie ein ankommender mit anderer Peg-Id, bekommt der auf dev die
 * nächste freie. Zurück: Peg-Id auf dev → neue Nummer.
 */
export function yieldNumbers(local: Iterable<Entity>, incoming: Entity[]): Map<string, string> {
  const bestand = [...local];
  const kommt = new Map<string, string>();
  for (const e of incoming) {
    const n = articleId(e);
    if (n) kommt.set(n, e.id);
  }
  const vergeben = new Set<string>([...bestand.map(articleId), ...kommt.keys()].filter(Boolean));
  const raus = new Map<string, string>();
  for (const e of bestand) {
    const n = articleId(e);
    const peg = n ? kommt.get(n) : undefined;
    if (!peg || peg === e.id) continue;
    const neu = nextId(bestand, e.interfaces?.[0] ?? '', vergeben);
    vergeben.add(neu);
    raus.set(e.id, neu);
  }
  return raus;
}

/** Eine neue Nummer an einen Artikel schreiben (ohne Verweise — die hängt `repoint` um). */
export function withNumber(e: Entity, number: string): Entity {
  return { ...e, components: { ...e.components, Identity: { ...(e.components?.['Identity'] ?? {}), id: number } } };
}

/** Kanten, deren Ziel ein Teil des Ausgewählten ist: es kommt mit. */
const MIT_DEM_GANZEN = new Set(['belongsTo', 'partOf']);
/** Kanten, deren Ziel zum Ausgewählten gehört und selbst weiter mitnimmt. */
const TIEF = new Set(['carries', 'holds', INSTANCE_RELATION]);

/**
 * **Die Abhängigkeiten einer Auswahl** (auf Wunsch): was ein
 * ausgewählter Artikel braucht, damit er auf dem Ziel besteht.
 *
 *  - jedes Kantenziel und jeder Verweis in einem Feld (eine Peg-Id als
 *    Wert, auch ein Bild) — einen Schritt weit;
 *  - was zum Artikel gehört und an ihm hängt: Statblock und Instanz
 *    (`belongsTo`), Teile eines Kapitels (`partOf`), Inventar und Inhalt
 *    (`carries`, `holds`), die Vorlage einer Instanz — ganz.
 *
 * Einen Schritt weit, weil ein Verweis auf eine Klasse nicht heisst, dass
 * jede Klasse mitsoll; das Ziel muss nur da sein, und meist ist es das.
 */
export function withDependencies(all: ReadonlyMap<string, Entity>, ids: Iterable<string>): string[] {
  const raus = new Set<string>();
  const rueck = new Map<string, string[]>();
  for (const e of all.values()) {
    for (const r of e.relations ?? []) {
      if (MIT_DEM_GANZEN.has(r.type)) (rueck.get(r.to) ?? rueck.set(r.to, []).get(r.to)!).push(e.id);
    }
  }
  const ganz = (id: string) => {
    const offen = [id];
    while (offen.length) {
      const x = offen.pop()!;
      if (raus.has(x) || !all.has(x)) continue;
      raus.add(x);
      const e = all.get(x)!;
      for (const r of e.relations ?? []) if (TIEF.has(r.type)) offen.push(r.to);
      offen.push(...(rueck.get(x) ?? []));
    }
  };
  const start = [...ids];
  for (const id of start) ganz(id);
  const schritt = [...raus];
  const peg = (v: unknown): void => {
    if (typeof v === 'string') {
      if (all.has(v)) raus.add(v);
    } else if (Array.isArray(v)) v.forEach(peg);
    else if (v && typeof v === 'object') Object.values(v).forEach(peg);
  };
  for (const id of schritt) {
    const e = all.get(id)!;
    for (const r of e.relations ?? []) if (all.has(r.to)) raus.add(r.to);
    peg(e.components);
  }
  return [...raus];
}

/** Die Teile des Registers, die eine Übernahme kennt. */
export const TRANSFER_REGISTRY_PARTS = ['interfaces', 'relations', 'views', 'enums', 'units', 'vars', 'settings', 'tokens'] as const;
export type TransferRegistryPart = (typeof TRANSFER_REGISTRY_PARTS)[number];

/** `interfaces:Spell` → Teil und Name; Unsinn → null. */
export function registryKey(key: string): { part: TransferRegistryPart; name: string } | null {
  const i = key.indexOf(':');
  if (i < 1) return null;
  const part = key.slice(0, i);
  const name = key.slice(i + 1);
  if (!name || !(TRANSFER_REGISTRY_PARTS as readonly string[]).includes(part)) return null;
  return { part: part as TransferRegistryPart, name };
}

export function registryRow(reg: Partial<Registry> | undefined, key: string): unknown {
  const k = registryKey(key);
  if (!k || !reg) return undefined;
  const teil = (reg as Record<string, unknown>)[k.part];
  if (!teil || typeof teil !== 'object' || Array.isArray(teil)) return undefined;
  return (teil as Record<string, unknown>)[k.name];
}

/** Eine Registerzeile in der Vorschau: die ganze Zeile ist ein Feld. */
export function registryItem(key: string, base: unknown, source: unknown, target: unknown): TransferItem {
  const k = registryKey(key)!;
  const state = fieldState(base, source, target);
  const fields: TransferField[] = state === 'same'
    ? []
    : [{ key: 'row', kind: 'field', ...(base !== undefined ? { base } : {}), ...(source !== undefined ? { source } : {}), ...(target !== undefined ? { target } : {}), state }];
  return {
    id: `registry:${key}`,
    kind: 'registry',
    name: k.name,
    type: k.part,
    number: '',
    layers: [],
    status: target === undefined ? 'new' : state === 'same' ? 'unchanged' : state === 'conflict' ? 'conflict' : state === 'source' ? 'changed' : 'target-ahead',
    fields,
    sourceKey: source === undefined ? 'null' : stableJson(source),
    targetKey: target === undefined ? 'null' : stableJson(target),
  };
}

const ChoiceSchema = z.union([z.literal('source'), z.literal('target'), z.object({ value: z.unknown() })]);

/** Was übernommen werden soll: Richtung, Auswahl, Registerzeilen. */
export const TransferRequestSchema = z.object({
  direction: z.enum(['push', 'pull']),
  select: BulkSelectSchema.optional(),
  /** `interfaces:Spell`, `views:quick` … */
  registry: z.array(z.string()).optional(),
  /** Abhängigkeiten mitnehmen (`withDependencies`). */
  dependencies: z.boolean().optional(),
});
export type TransferRequest = z.infer<typeof TransferRequestSchema>;

/** Der Lauf: dieselbe Auswahl, dazu was davon geschrieben wird, die
 *  Lösungen der Konflikte und der Stand, den die Vorschau zeigte. */
export const TransferRunSchema = TransferRequestSchema.extend({
  apply: z.array(z.string()),
  choices: z.record(z.string(), z.record(z.string(), ChoiceSchema)).optional(),
  expect: z.record(z.string(), z.tuple([z.string(), z.string()])),
});
export type TransferRun = z.infer<typeof TransferRunSchema>;
