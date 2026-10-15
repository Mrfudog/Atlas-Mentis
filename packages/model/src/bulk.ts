/**
 * **Massenänderungen** (Werkbank, W9): viele Artikel auf einmal, aber
 * jeder einzeln geprüft.
 *
 * Eine Auswahl (Art, Ebene, Marke, Feldbedingungen, Ids) und Operationen
 * darauf: Feld setzen oder leeren, Marke dazu oder weg, Kante anlegen oder
 * entfernen, Doppel zusammenführen. Hier steht nur das **Rechnen** — was
 * sich an welchem Artikel ändern würde, als Vorher und Nachher. Der Server
 * prüft jedes Nachher mit `validateEntity`, schreibt, und legt das Vorher
 * ins Protokoll, damit es rückgängig zu machen ist. So kann die Vorschau
 * (`dryRun`) nichts anderes zeigen als das, was danach geschrieben wird:
 * es ist derselbe Weg.
 */

import { z } from 'zod';
import { articleId, entityName, nextId, setTags, tagsOf, typeChain } from './entity.js';
import { stableJson } from './checks.js';
import { detachInstance, INSTANCE_RELATION, isInstance } from './instance.js';
import type { Entity, Registry, Relation } from './types.js';
import { LAYER_RELATION } from './visibility.js';

const CONDITION_OPS = ['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'matches', 'empty', 'notEmpty', 'in'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

const ConditionSchema = z.object({
  /** `name`, `id` (die Nummer), `type` oder `Karte.feld`. */
  field: z.string().min(1),
  op: z.enum(CONDITION_OPS),
  value: z.unknown().optional(),
});
export type BulkCondition = z.infer<typeof ConditionSchema>;

const SelectSchema = z.object({
  /** Peg-Ids oder Nummern. */
  ids: z.array(z.string()).optional(),
  /** Arten; ein Untertyp zählt mit (`typeChain`). */
  types: z.array(z.string()).optional(),
  /** Eine Ebene (Peg-Id oder Nummer), über `inLayer`. */
  layer: z.string().optional(),
  tag: z.string().optional(),
  where: z.array(ConditionSchema).optional(),
});
export type BulkSelect = z.infer<typeof SelectSchema>;
/** Dieselbe Auswahl für die Übernahme (T-130). */
export const BulkSelectSchema = SelectSchema;

const OpSchema = z.discriminatedUnion('op', [
  /** `values` (T-144): je Artikel ein eigener Wert, nach Peg-Id oder
   *  Nummer — wer darin fehlt, bleibt unberührt. `ifEmpty`: nur setzen, wo
   *  das Feld noch leer ist; was jemand schon gewählt hat, gilt weiter. */
  z.object({
    op: z.literal('set'),
    field: z.string().min(1),
    value: z.unknown().optional(),
    values: z.record(z.string(), z.unknown()).optional(),
    ifEmpty: z.boolean().optional(),
  }),
  z.object({ op: z.literal('unset'), field: z.string().min(1) }),
  z.object({ op: z.literal('addTag'), tag: z.string().min(1) }),
  z.object({ op: z.literal('removeTag'), tag: z.string().min(1) }),
  /** `targets` (T-212): je Artikel eigene Ziele, nach Peg-Id oder Nummer —
   *  ein Ziel ist eine Id oder `{to, props}`; wer darin fehlt, bleibt
   *  unberührt. So geht eine Zauberliste je Klasse in **eine** Änderung,
   *  statt einer je Klasse. */
  z.object({
    op: z.literal('addRelation'),
    type: z.string().min(1),
    to: z.string().min(1).optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    targets: z
      .record(
        z.string(),
        z.array(z.union([z.string().min(1), z.object({ to: z.string().min(1), props: z.record(z.string(), z.unknown()).optional() })])),
      )
      .optional(),
  }),
  z.object({ op: z.literal('removeRelation'), type: z.string().min(1), to: z.string().optional() }),
  /** Je ausgewähltem Artikel einen neuen anlegen, an den er über `relation`
   *  gebunden wird (T-169: zu jedem benannten Statblock seine Kreatur). Der
   *  neue liegt in denselben Ebenen, heisst wie der ausgewählte (ohne
   *  Klammer am Ende mit `stripBracket`) und nimmt die Karten aus `copy` mit. */
  z.object({
    op: z.literal('addLinked'),
    type: z.string().min(1),
    relation: z.string().min(1),
    /** `Karte.feld` → Wert am neuen Artikel. */
    fields: z.record(z.string(), z.unknown()).optional(),
    copy: z.array(z.string()).optional(),
    stripBracket: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('merge'),
    /** `variant`: die anderen zeigen mit `variantOf` auf den bleibenden.
     *  `delete`: die anderen gehen, alles, was auf sie zeigte, zeigt danach
     *  auf den bleibenden. */
    mode: z.enum(['variant', 'delete']),
    /** Welcher bleibt; ohne Angabe der älteste (kleinste Nummer). */
    keep: z.string().optional(),
    /** `name`: eine Gruppe je Art und Name. `content`: dazu gleicher Inhalt. */
    by: z.enum(['name', 'content']).optional(),
  }),
  /** Die Auswahl löschen (T-176), mit ihren Teilen; was von aussen auf sie
   *  zeigt, verliert die Kante. Steht allein, wie `merge`. */
  z.object({ op: z.literal('delete') }),
]);
export type BulkOp = z.infer<typeof OpSchema>;

export const BulkRequestSchema = z.object({
  select: SelectSchema,
  ops: z.array(OpSchema).min(1),
  dryRun: z.boolean().optional(),
  /** Löscht der Lauf mehr als einen Artikel, steht hier, wie viele — die Zahl aus der Vorschau. */
  confirmDelete: z.number().int().optional(),
  /** Schreiben, was besteht, und die Abgelehnten liegen lassen (nicht beim Zusammenführen). */
  skipRejected: z.boolean().optional(),
  /** Wie viele Beispiele die Antwort trägt. */
  limit: z.number().int().min(0).max(5000).optional(),
  note: z.string().optional(),
});
export type BulkRequest = z.infer<typeof BulkRequestSchema>;

export interface BulkChange {
  id: string;
  /** `null`: der Artikel entsteht. */
  before: Entity | null;
  /** `null`: der Artikel geht. */
  after: Entity | null;
  summary: string[];
}

export interface BulkProblem {
  id: string;
  name: string;
  type: string;
  reason: string;
}

export interface BulkPlan {
  /** Wie viele Artikel die Auswahl traf. */
  selected: number;
  changes: BulkChange[];
  /** Was nicht ging und darum ausgelassen wird — kein Fehler des Laufs, aber eine Auskunft. */
  skipped: BulkProblem[];
}

// --------------------------------------------------------------- Auswahl

/** Der Wert eines Feldes, wie eine Bedingung ihn liest. */
export function fieldValue(e: Entity, field: string): unknown {
  if (field === 'name') return entityName(e);
  if (field === 'id') return articleId(e) || e.id;
  if (field === 'type') return e.interfaces?.[0] ?? '';
  const punkt = field.indexOf('.');
  if (punkt < 0) return undefined;
  return e.components?.[field.slice(0, punkt)]?.[field.slice(punkt + 1)];
}

const leer = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && !v.length);

/** Text eines Wertes zum Vergleichen; bei einer Liste jeder Eintrag. */
function texteVon(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(texteVon);
  if (v && typeof v === 'object') {
    const o = v as { value?: unknown };
    return o.value !== undefined ? texteVon(o.value) : [stableJson(v)];
  }
  return v === undefined || v === null ? [] : [String(v)];
}

export function matchesCondition(e: Entity, c: BulkCondition): boolean {
  const wert = fieldValue(e, c.field);
  if (c.op === 'empty') return leer(wert);
  if (c.op === 'notEmpty') return !leer(wert);
  const texte = texteVon(wert).map((t) => t.toLowerCase());
  const soll = String(c.value ?? '').toLowerCase();
  switch (c.op) {
    case 'eq':
      return texte.some((t) => t === soll);
    case 'ne':
      return !texte.some((t) => t === soll);
    case 'contains':
      return texte.some((t) => t.includes(soll));
    case 'startsWith':
      return texte.some((t) => t.startsWith(soll));
    case 'endsWith':
      return texte.some((t) => t.endsWith(soll));
    case 'in': {
      const liste = (Array.isArray(c.value) ? c.value : String(c.value ?? '').split(','))
        .map((x) => String(x).trim().toLowerCase());
      return texte.some((t) => liste.includes(t));
    }
    case 'matches': {
      let re: RegExp;
      try {
        re = new RegExp(String(c.value ?? ''), 'i');
      } catch {
        return false;
      }
      return texteVon(wert).some((t) => re.test(t));
    }
  }
  return false;
}

/** Steht die Bedingung überhaupt so, dass sie etwas heissen kann? */
export function conditionProblem(c: BulkCondition): string | null {
  if (c.op === 'matches') {
    try {
      new RegExp(String(c.value ?? ''), 'i');
    } catch {
      return `${c.field}: "${String(c.value)}" is not a regular expression`;
    }
  }
  if (c.field !== 'name' && c.field !== 'id' && c.field !== 'type' && !c.field.includes('.')) {
    return `${c.field}: a field is name, id, type or Card.field`;
  }
  return null;
}

/** Die Artikel, die eine Auswahl trifft — in der Reihenfolge des Bestands. */
export function selectEntities(registry: Pick<Registry, 'interfaces'>, entities: Entity[], select: BulkSelect): Entity[] {
  const ids = select.ids?.length ? new Set(select.ids.map((x) => x.trim()).filter(Boolean)) : null;
  const ketten = new Map<string, Set<string>>();
  const kette = (t: string) => ketten.get(t) ?? ketten.set(t, new Set(typeChain(registry, t))).get(t)!;
  const ebene = select.layer?.trim();
  const ebenenIds = new Set<string>();
  if (ebene) {
    ebenenIds.add(ebene);
    for (const e of entities) if (articleId(e) === ebene) ebenenIds.add(e.id);
  }
  return entities.filter((e) => {
    if (ids && !ids.has(e.id) && !ids.has(articleId(e))) return false;
    if (select.types?.length && !select.types.some((t) => kette(e.interfaces?.[0] ?? '').has(t))) return false;
    if (ebene && !(e.relations ?? []).some((r) => r.type === LAYER_RELATION && ebenenIds.has(r.to))) return false;
    if (select.tag && !tagsOf(e).some((t) => t.toLowerCase() === select.tag!.toLowerCase())) return false;
    for (const c of select.where ?? []) if (!matchesCondition(e, c)) return false;
    return true;
  });
}

// ------------------------------------------------------------ Operationen

/* Eine Kopie, die niemand mit dem Bestand teilt. JSON, weil das Modell ohne
   Laufzeit-Typen auskommt — ein Artikel ist ohnehin JSON. */
const klon = (e: Entity): Entity => JSON.parse(JSON.stringify(e)) as Entity;

/** Ein Wert für ein Feld, so wie das Feld ihn hält: „15" in ein Zahlenfeld wird 15. */
function passend(registry: Pick<Registry, 'interfaces'>, karte: string, feld: string, wert: unknown): unknown {
  const prop = registry.interfaces[karte]?.schema?.properties[feld];
  if (!prop) return wert;
  if ((prop.type === 'number' || prop.type === 'integer') && typeof wert === 'string' && wert.trim() !== '') {
    const n = Number(wert);
    return Number.isFinite(n) ? n : wert;
  }
  if (prop.type === 'array' && typeof wert === 'string') {
    return wert.split(',').map((x) => x.trim()).filter(Boolean);
  }
  if (prop.type === 'boolean' && (wert === 'true' || wert === 'false')) return wert === 'true';
  return wert;
}

/** Der Wert eines Feldes (`name` oder `Karte.feld`) am Artikel. */
function feldwert(e: Entity, field: string): unknown {
  if (field === 'name') return e.name;
  const punkt = field.indexOf('.');
  return (e.components[field.slice(0, punkt)] as Record<string, unknown> | undefined)?.[field.slice(punkt + 1)];
}

function setzeFeld(registry: Pick<Registry, 'interfaces'>, e: Entity, field: string, wert: unknown): void {
  if (field === 'name') {
    const name = String(wert ?? '').trim();
    e.name = name;
    e.components = { ...e.components, Identity: { ...(e.components['Identity'] ?? {}), name } };
    return;
  }
  const punkt = field.indexOf('.');
  const karte = field.slice(0, punkt);
  const feld = field.slice(punkt + 1);
  const neu = { ...(e.components[karte] ?? {}) };
  if (leer(wert)) delete neu[feld];
  else neu[feld] = passend(registry, karte, feld, wert);
  const components = { ...e.components };
  /* Abwesend ist nicht dasselbe wie leer: eine Karte ohne Feld fällt weg. */
  if (Object.keys(neu).length) components[karte] = neu;
  else delete components[karte];
  e.components = components;
}

/** Eine Kanten-Id, die es im ganzen Bestand noch nicht gibt (sie ist Schlüssel der Tabelle). */
function neueKantenId(e: Entity, art: string, vergeben: Set<string>): string {
  for (let n = (e.relations ?? []).length + 1; ; n += 1) {
    const id = `${e.id}~${art}-${n}`;
    if (!vergeben.has(id)) {
      vergeben.add(id);
      return id;
    }
  }
}

/** Was sich an einem Artikel geändert hat, in Zeilen für Menschen. */
export function describeChange(before: Entity | null, after: Entity | null): string[] {
  if (!before && after) return ['created'];
  if (before && !after) return ['deleted'];
  if (!before || !after) return [];
  const raus: string[] = [];
  const zeige = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? JSON.stringify(v.length > 60 ? `${v.slice(0, 57)}…` : v) : stableJson(v).slice(0, 60));
  const karten = new Set([...Object.keys(before.components ?? {}), ...Object.keys(after.components ?? {})]);
  let textFelder = 0;
  for (const k of karten) {
    const a = before.components?.[k] ?? {};
    const b = after.components?.[k] ?? {};
    for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (stableJson(a[f]) === stableJson(b[f])) continue;
      if (k === 'Tags' && f === 'tags') {
        const alt = new Set(tagsOf(before));
        const neu = new Set(tagsOf(after));
        for (const t of neu) if (!alt.has(t)) raus.push(`+ tag ${t}`);
        for (const t of alt) if (!neu.has(t)) raus.push(`− tag ${t}`);
        continue;
      }
      /* Ein umgehängter Verweis im Fliesstext ist eine Zeile, nicht hundert. */
      if (typeof a[f] === 'string' && typeof b[f] === 'string' && String(a[f]).length > 60) {
        textFelder += 1;
        continue;
      }
      raus.push(`${k}.${f}: ${zeige(a[f])} → ${zeige(b[f])}`);
    }
  }
  if (textFelder) raus.push(`${textFelder} text field(s): links repointed`);
  const schl = (r: Relation) => `${r.type} → ${r.to}`;
  const alt = new Map((before.relations ?? []).map((r) => [schl(r), r]));
  const neu = new Map((after.relations ?? []).map((r) => [schl(r), r]));
  for (const k of neu.keys()) if (!alt.has(k)) raus.push(`+ ${k}`);
  for (const k of alt.keys()) if (!neu.has(k)) raus.push(`− ${k}`);
  return raus;
}

/**
 * Ob zwei Fassungen eines Artikels **gespeichert** dasselbe sind: Arten,
 * Karten, Zusatzfelder und Kanten, unabhängig von der Reihenfolge der
 * Schlüssel. Der Name gehört nicht dazu — er steht in `Identity`, und die
 * Ablage gibt ihn nicht überall gleich zurück.
 */
export function storedKey(e: Entity | null | undefined): string {
  if (!e) return 'null';
  return stableJson({
    interfaces: e.interfaces ?? [],
    components: e.components ?? {},
    adhoc: e.adhoc ?? [],
    relations: (e.relations ?? []).map((r) => ({ id: r.id, type: r.type, to: r.to, props: r.props ?? {} })),
  });
}

/**
 * Verweise umhängen: Kanten, Verweisfelder (eine Peg-Id als Wert) und
 * `[[nummer|…]]` im Text — wie `umhaengen` im Importer (doppel.ts), aber
 * ohne den Bestand anzufassen: zurück kommen nur die Artikel, die sich
 * ändern, als Kopien.
 */
export function repoint(
  entities: Iterable<Entity>,
  pegs: ReadonlyMap<string, string>,
  nummern: ReadonlyMap<string, string>,
): Map<string, Entity> {
  const raus = new Map<string, Entity>();
  /* Nur Nummern umhängen geht auch (T-130: prod vergibt eine neue). */
  if (!pegs.size && !nummern.size) return raus;
  const flucht = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const alle = new Map<string, string>([...nummern, ...pegs]);
  const muster = new RegExp(`\\[\\[(${[...alle.keys()].map(flucht).join('|')})(?=[|\\]])`, 'g');
  let geaendert = false;
  const wert = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (pegs.has(v)) {
        geaendert = true;
        return pegs.get(v);
      }
      if (!v.includes('[[')) return v;
      const neu = v.replace(muster, (_m, n: string) => `[[${alle.get(n)}`);
      if (neu !== v) geaendert = true;
      return neu;
    }
    if (Array.isArray(v)) return v.map(wert);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wert(x)]));
    return v;
  };
  for (const e of entities) {
    if (pegs.has(e.id)) continue;
    geaendert = false;
    const components = wert(e.components) as Entity['components'];
    const adhoc = e.adhoc ? (wert(e.adhoc) as Entity['adhoc']) : e.adhoc;
    let kanten = e.relations;
    if ((e.relations ?? []).some((r) => pegs.has(r.to))) {
      geaendert = true;
      const gesehen = new Set<string>();
      kanten = (e.relations ?? [])
        .map((r) => (pegs.has(r.to) ? { ...r, to: pegs.get(r.to)! } : r))
        .filter((r) => {
          /* Zwei Kanten, die nach dem Umhängen gleich sind, sind eine. */
          const k = stableJson([r.type, r.to, r.props ?? {}]);
          if (gesehen.has(k)) return false;
          gesehen.add(k);
          return true;
        });
    }
    if (geaendert) raus.set(e.id, { ...e, components, ...(adhoc ? { adhoc } : {}), relations: kanten ?? [] });
  }
  return raus;
}

const aeltere = (a: Entity, b: Entity) => {
  const na = articleId(a);
  const nb = articleId(b);
  if (na && nb && na !== nb) return na.localeCompare(nb, 'en', { numeric: true });
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

const ohneVerwaltung = (e: Entity) => {
  const { Identity: _i, Source: _s, Status: _st, Tags: _t, ...rest } = e.components ?? {};
  return stableJson(rest);
};

/**
 * **Die Teile, die mit einem gelöschten Artikel gehen** (T-176) — dieselbe
 * Regel wie beim Löschen eines einzelnen (`DELETE /api/entities/:id`):
 * eine Instanz, die über eine Kante mit `asField: 'to'` an ihm hängt (der
 * eigene Statblock aus einer Vorlage), das Inventar, das nur er trägt
 * (`asField: 'from'`), und die Stücke (Instanzen, T-150), die nur ein
 * gehendes Inventar hält. Ein eigener Statblock ohne Vorlage und ein
 * Grundartikel im Inventar stehen für sich und bleiben. Bis nichts mehr
 * dazukommt: ein Rucksack im Inventar einer Figur trägt selbst eines.
 */
export function teileDazu(
  registry: Pick<Registry, 'relations'>,
  raw: ReadonlyMap<string, Entity>,
  geloescht: ReadonlySet<string>,
): Map<string, string> {
  const anArt = new Set<string>();
  const traegtArt = new Set<string>();
  for (const r of Object.values(registry.relations)) {
    if (r.asField === 'to') anArt.add(r.type);
    if (r.asField === 'from') traegtArt.add(r.type);
  }
  /** Wer etwas trägt oder hält, je Ziel. */
  const halter = new Map<string, { von: string; stueck: boolean }[]>();
  for (const e of raw.values()) {
    for (const r of e.relations ?? []) {
      if (!traegtArt.has(r.type) && r.type !== 'holds') continue;
      (halter.get(r.to) ?? halter.set(r.to, []).get(r.to)!).push({ von: e.id, stueck: r.type === 'holds' });
    }
  }
  const weg = new Set(geloescht);
  const raus = new Map<string, string>();
  for (let neu = true; neu; ) {
    neu = false;
    for (const e of raw.values()) {
      if (weg.has(e.id)) continue;
      let von = isInstance(e) ? (e.relations ?? []).find((r) => anArt.has(r.type) && weg.has(r.to))?.to : undefined;
      const h = halter.get(e.id) ?? [];
      if (!von && h.length && h.every((x) => weg.has(x.von)) && h.every((x) => !x.stueck || isInstance(e))) von = h[0]!.von;
      if (!von) continue;
      weg.add(e.id);
      raus.set(e.id, von);
      neu = true;
    }
  }
  return raus;
}

/**
 * Die Peg-Id des Artikels, den `addLinked` zu `vonId` anlegt (T-169). Sie
 * folgt aus dem ausgewählten Artikel, damit der 5e.tools-Importer dieselbe
 * vergibt (`monster.ts`, benannte Kreatur): was die Werkbank auf dev
 * nachgetragen hat, legt ein späteres `--only-new` nicht ein zweites Mal an.
 */
export function linkedPeg(vonId: string, type: string): string {
  return `${vonId}-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * Was ein Lauf ändern würde. `raw` ist der gespeicherte Bestand (Instanzen
 * dünn, wie sie liegen) — geändert wird, was gespeichert ist, nicht die
 * aufgelöste Fassung. `selected` sind die Ids, die die Auswahl traf.
 */
export function planBulk(
  registry: Pick<Registry, 'interfaces' | 'relations'>,
  raw: ReadonlyMap<string, Entity>,
  selected: string[],
  ops: BulkOp[],
): BulkPlan {
  const skipped: BulkProblem[] = [];
  const nachher = new Map<string, Entity>();
  const geloescht = new Set<string>();
  /** Gelöscht → wohin umgehängt; nur für die Zeile „merged into …". */
  const wohin = new Map<string, string>();
  /** Gelöscht als Teil von → wem; nur für die Zeile „part of …". */
  const teilVon = new Map<string, string>();
  const problem = (e: Entity, reason: string) =>
    skipped.push({ id: e.id, name: entityName(e), type: e.interfaces?.[0] ?? '', reason });
  const vergeben = new Set<string>();
  for (const e of raw.values()) for (const r of e.relations ?? []) vergeben.add(r.id);
  const nachNummer = new Map<string, string>();
  for (const e of raw.values()) {
    const n = articleId(e);
    if (n && !nachNummer.has(n)) nachNummer.set(n, e.id);
  }
  const peg = (x: string) => (raw.has(x) ? x : nachNummer.get(x));
  const ziele = selected.map((id) => raw.get(id)).filter((e): e is Entity => !!e);
  /** Was `addLinked` in diesem Lauf schon an Nummern vergab. */
  const nummern: string[] = [];
  const nenne = (e: Entity | undefined) => (e ? `${entityName(e)} (${articleId(e) || e.id})` : '?');

  const merge = ops.find((o) => o.op === 'merge');
  if (ops.some((o) => o.op === 'delete')) {
    for (const e of ziele) geloescht.add(e.id);
    for (const [id, von] of teileDazu(registry, raw, geloescht)) {
      geloescht.add(id);
      teilVon.set(id, von);
    }
    /* Was bleibt, zeigt danach nicht ins Leere (T-176): eine Kante auf
       einen gehenden Artikel geht mit, und eine Instanz einer gehenden
       Vorlage bekommt vorher, was sie von ihr las (wie beim Löschen eines
       einzelnen Artikels). Verweise im Fliesstext bleiben stehen — sie
       sind Text, und `brokenLinks` zählt sie. */
    for (const e of raw.values()) {
      if (geloescht.has(e.id)) continue;
      const vorlage = (e.relations ?? []).find((r) => r.type === INSTANCE_RELATION)?.to;
      const basis = vorlage && geloescht.has(vorlage) ? detachInstance(raw, e) : e;
      const kanten = (basis.relations ?? []).filter((r) => !geloescht.has(r.to));
      if (basis !== e || kanten.length !== (e.relations ?? []).length) nachher.set(e.id, { ...klon(basis), relations: kanten });
    }
  } else if (merge && merge.op === 'merge') {
    const gruppen = new Map<string, Entity[]>();
    for (const e of ziele) {
      const k = `${e.interfaces?.[0] ?? ''}\u0000${entityName(e).trim().toLowerCase()}${merge.by === 'content' ? `\u0000${ohneVerwaltung(e)}` : ''}`;
      (gruppen.get(k) ?? gruppen.set(k, []).get(k)!).push(e);
    }
    const keep = merge.keep ? peg(merge.keep) : undefined;
    if (merge.keep && !keep) {
      skipped.push({ id: merge.keep, name: merge.keep, type: '', reason: 'keep: no such article' });
    }
    const pegs = new Map<string, string>();
    const nummern = new Map<string, string>();
    for (const g of gruppen.values()) {
      if (g.length < 2) continue;
      g.sort(aeltere);
      const bleibt = g.find((e) => e.id === keep) ?? g[0]!;
      for (const e of g) {
        if (e === bleibt) continue;
        if (merge.mode === 'variant') {
          const v = (e.relations ?? []).find((r) => r.type === 'variantOf');
          if (v) {
            if (v.to !== bleibt.id) problem(e, `already a variant of ${v.to}`);
            continue;
          }
          const neu = klon(e);
          (neu.relations ??= []).push({ id: neueKantenId(neu, 'variantOf', vergeben), type: 'variantOf', to: bleibt.id });
          nachher.set(e.id, neu);
        } else {
          pegs.set(e.id, bleibt.id);
          wohin.set(e.id, bleibt.id);
          const n = articleId(e);
          const nb = articleId(bleibt) || bleibt.id;
          if (n) nummern.set(n, nb);
          geloescht.add(e.id);
        }
      }
      if (merge.mode === 'delete') {
        /* Was der gehende Artikel selbst an Kanten trug, nimmt der bleibende
           mit — ausser es stünde schon da, zeigte auf ihn selbst oder fände
           als „eine" keinen Platz. Was liegen bleibt, wird gesagt. */
        const neu = klon(nachher.get(bleibt.id) ?? bleibt);
        const hat = new Set((neu.relations ?? []).map((r) => stableJson([r.type, r.to, r.props ?? {}])));
        for (const e of g) {
          if (!geloescht.has(e.id)) continue;
          for (const r of e.relations ?? []) {
            const to = pegs.get(r.to) ?? r.to;
            const k = stableJson([r.type, to, r.props ?? {}]);
            if (to === bleibt.id || hat.has(k)) continue;
            if (registry.relations[r.type]?.cardinality === 'one' && (neu.relations ?? []).some((x) => x.type === r.type)) {
              problem(e, `edge ${r.type} → ${to} dropped: ${entityName(bleibt)} already has one`);
              continue;
            }
            (neu.relations ??= []).push({ ...r, id: neueKantenId(neu, r.type, vergeben), to });
            hat.add(k);
          }
        }
        if (storedKey(neu) !== storedKey(bleibt)) nachher.set(bleibt.id, neu);
      }
    }
    if (pegs.size) {
      const bestand = [...raw.values()].map((e) => nachher.get(e.id) ?? e).filter((e) => !geloescht.has(e.id));
      for (const [id, e] of repoint(bestand, pegs, nummern)) nachher.set(id, e);
    }
  } else {
    for (const e of ziele) {
      const neu = klon(e);
      for (const op of ops) {
        switch (op.op) {
          case 'set':
          case 'unset': {
            const feld = op.field;
            if (feld !== 'name' && !feld.includes('.')) {
              problem(e, `${feld}: a field is name or Card.field`);
              break;
            }
            if (feld === 'name' && op.op === 'unset') {
              problem(e, 'a name cannot be emptied');
              break;
            }
            let wert: unknown = undefined;
            if (op.op === 'set') {
              if (!op.values && !('value' in op)) {
                problem(e, `${feld}: set needs a value or values`);
                break;
              }
              if (op.values) {
                const eigen = Object.hasOwn(op.values, e.id) ? op.values[e.id] : Object.hasOwn(op.values, articleId(e)) ? op.values[articleId(e)] : undefined;
                if (eigen === undefined) break;
                wert = eigen;
              } else wert = op.value;
              if (op.ifEmpty && !leer(feldwert(neu, feld))) break;
            }
            setzeFeld(registry, neu, feld, wert);
            break;
          }
          case 'addTag':
            if (!tagsOf(neu).some((t) => t.toLowerCase() === op.tag.trim().toLowerCase())) setTags(neu, [...tagsOf(neu), op.tag]);
            break;
          case 'removeTag':
            setTags(neu, tagsOf(neu).filter((t) => t.toLowerCase() !== op.tag.trim().toLowerCase()));
            break;
          case 'addRelation': {
            if (!op.to === !op.targets) {
              problem(e, `${op.type}: addRelation needs either to or targets`);
              break;
            }
            const eigen = op.targets
              ? (Object.hasOwn(op.targets, e.id) ? op.targets[e.id] : Object.hasOwn(op.targets, articleId(e)) ? op.targets[articleId(e)] : undefined) ?? []
              : [{ to: op.to!, props: op.props }];
            for (const t of eigen) {
              const ziel = typeof t === 'string' ? t : t.to;
              const props = typeof t === 'string' ? op.props : t.props ?? op.props;
              const to = peg(ziel);
              if (!to) {
                problem(e, `${op.type} → ${ziel}: no such article`);
                continue;
              }
              if ((neu.relations ?? []).some((r) => r.type === op.type && r.to === to)) continue;
              if (registry.relations[op.type]?.cardinality === 'one' && (neu.relations ?? []).some((r) => r.type === op.type)) {
                problem(e, `already has a ${op.type}`);
                continue;
              }
              (neu.relations ??= []).push({
                id: neueKantenId(neu, op.type, vergeben),
                type: op.type,
                to,
                ...(props ? { props } : {}),
              });
            }
            break;
          }
          case 'removeRelation': {
            const to = op.to ? peg(op.to) ?? op.to : undefined;
            neu.relations = (neu.relations ?? []).filter((r) => !(r.type === op.type && (!to || r.to === to)));
            break;
          }
          case 'addLinked': {
            const def = registry.relations[op.relation];
            if (!def) {
              problem(e, `${op.relation}: no such edge type`);
              break;
            }
            /* Hängt schon einer an, gibt es nichts anzulegen — eine benannte
               Kreatur gibt es einmal. */
            const schon = (neu.relations ?? []).find((r) => r.type === op.relation);
            if (schon && def.cardinality === 'one') {
              problem(e, `already has a ${op.relation} (${nenne(raw.get(schon.to))})`);
              break;
            }
            if (isInstance(e)) {
              problem(e, 'an instance gets nothing of its own');
              break;
            }
            const id = linkedPeg(e.id, op.type);
            if (raw.has(id) || nachher.has(id)) {
              problem(e, `${id} exists already`);
              break;
            }
            const roh = entityName(e).trim();
            const name = op.stripBracket ? roh.replace(/\s*\([^)]*\)\s*$/, '').trim() || roh : roh;
            const nummer = nextId(raw.values(), op.type, nummern);
            nummern.push(nummer);
            const kind: Entity = {
              id,
              interfaces: [op.type],
              name,
              components: { Identity: { name, id: nummer } },
              relations: [],
            };
            for (const karte of op.copy ?? []) {
              if (karte === 'Identity') continue;
              const k = e.components?.[karte];
              if (k) kind.components[karte] = JSON.parse(JSON.stringify(k)) as Record<string, unknown>;
            }
            for (const [feld, wert] of Object.entries(op.fields ?? {})) setzeFeld(registry, kind, feld, wert);
            /* In denselben Ebenen wie der ausgewählte. */
            for (const r of e.relations ?? []) {
              if (r.type === LAYER_RELATION) kind.relations!.push({ id: neueKantenId(kind, LAYER_RELATION, vergeben), type: LAYER_RELATION, to: r.to });
            }
            nachher.set(id, kind);
            (neu.relations ??= []).push({ id: neueKantenId(neu, op.relation, vergeben), type: op.relation, to: id });
            break;
          }
        }
      }
      if (storedKey(neu) !== storedKey(e)) nachher.set(e.id, neu);
    }
  }

  const changes: BulkChange[] = [];
  for (const id of geloescht) {
    const before = raw.get(id)!;
    const zeile = wohin.has(id)
      ? `deleted — merged into ${nenne(raw.get(wohin.get(id)!))}`
      : teilVon.has(id)
        ? `deleted — part of ${nenne(raw.get(teilVon.get(id)!))}`
        : 'deleted';
    changes.push({ id, before, after: null, summary: [zeile] });
  }
  for (const [id, after] of nachher) {
    const before = raw.get(id) ?? null;
    changes.push({ id, before, after, summary: describeChange(before, after) });
  }
  return { selected: ziele.length, changes, skipped };
}
