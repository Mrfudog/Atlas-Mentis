/**
 * Reading the registry: which fields a type carries, what a relation may
 * target, and what points back at an entity.
 *
 * Vererbung vereinigt Felder und Kanten über `extends`. Bei `blockTypes`
 * ergänzt ein `+x` die geerbte Menge, eine blosse Liste ersetzt sie.
 */

import type {
  Backlink,
  Entity,
  EntityId,
  PropertySchema,
  Registry,
  RelationDef,
} from './types.js';

export function entityName(entity: Entity | undefined): string {
  if (!entity) return 'Ohne Namen';
  const ausKarte = entity.components?.['Identity']?.['name'];
  return entity.name || (typeof ausKarte === 'string' ? ausKarte : '') || 'Ohne Namen';
}

export function primaryInterface(entity: Entity): string {
  return entity.interfaces?.[0] ?? '';
}

export const TAGS_COMPONENT = 'Tags';

/**
 * Die Marken eines Artikels. Sie waren einmal eine Eigenschaft der Entität
 * selbst — die einzige, die keiner Art gehörte. Jetzt stehen sie an einem
 * Bestandteil, und der einzige Zugriff darauf ist dieser hier: sonst stünde
 * `components.Tags.tags` an dreissig Stellen und die einunddreissigste
 * vergässe das `?? []`.
 */
export function tagsOf(entity: Entity | undefined): string[] {
  const roh = entity?.components?.[TAGS_COMPONENT]?.['tags'];
  return Array.isArray(roh) ? roh.filter((t): t is string => typeof t === 'string') : [];
}

/** Setzt die Marken. Eine leere Menge löscht den Bestandteil — abwesend ist
 *  nicht dasselbe wie leer, und nur abwesend heisst „trägt keine". */
export function setTags(entity: Entity, tags: string[]): void {
  const sauber = tags.map((t) => t.trim()).filter(Boolean);
  if (sauber.length) {
    entity.components = { ...entity.components, [TAGS_COMPONENT]: { tags: sauber } };
  } else if (entity.components?.[TAGS_COMPONENT]) {
    const rest = { ...entity.components };
    delete rest[TAGS_COMPONENT];
    entity.components = rest;
  }
}


/**
 * Die Arten, deren Felder hier gelten: diese und alle Obertypen.
 *
 * Das ist zugleich die Liste der Karten, die ein Artikel dieser Art tragen
 * darf — eine Karte heisst nach der Art, die ihre Felder erklärt.
 */
export function typeChain(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const offen = [name];
  while (offen.length) {
    const at = offen.shift() as string;
    if (seen.has(at) || !registry.interfaces[at]) continue;
    seen.add(at);
    out.push(at);
    for (const p of registry.interfaces[at]?.extends ?? []) offen.push(p);
  }
  return out;
}

/** The fields of one type — its own only, not the inherited ones. */
export function ownFields(
  registry: Pick<Registry, 'interfaces'>,
  name: string,
): Record<string, PropertySchema> {
  return registry.interfaces[name]?.schema?.properties ?? {};
}

/**
 * Ein Feld mitsamt der Art, die es erklärt. Heisst nicht `FieldRef`, weil das
 * im Wissensteil schon eine Zeichenkette ist (`Type.field`) — zwei Namen für
 * zwei Sachen sind besser als ein Name für beide.
 */
export interface TypedField {
  type: string;
  key: string;
  prop: PropertySchema;
}

/* ---------- Die ausgegebene Nummer ----------
   `Identity.id` ist `npc-0042`: die Artikelart und eine laufende Nummer
   darin. Es hiess einmal `key` und stand als `npc/volo-geddarm` da — ein
   Name, der ein zweites Mal derselbe Name war. Beim Umbenennen musste er
   entweder mitwandern (dann war er kein fester Bezeichner) oder nicht
   (dann log er). Eine Nummer sagt nichts und bleibt deshalb richtig.

   Ausgegeben, nicht gerechnet: ein `derived` entstünde bei jedem Lesen neu
   (D8), und dann hiesse derselbe Artikel morgen anders, sobald jemand vor
   ihm einen anderen anlegt. */

/** Das Feld, das die ausgegebene Nummer trägt. */
export const ID_FIELD = 'Identity.id';

/** Der Anfang einer Nummer: die Artikelart, klein und ohne Sonderzeichen. */
export function idPrefix(type: string): string {
  return String(type || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'article';
}

/** Die Nummer eines Artikels, sofern er eine trägt. */
export function articleId(article: Pick<Entity, 'components'>): string {
  const wert = (article.components?.['Identity'] as { id?: unknown } | undefined)?.id;
  return typeof wert === 'string' ? wert : '';
}

/**
 * Die nächste freie Nummer für diese Art.
 *
 * Gezählt wird, was schon dasteht: die höchste vergebene plus eins. Einen
 * Zähler zu speichern wäre eine zweite Stelle, die sagt, wie weit man ist —
 * und die nach dem ersten Import, der sie nicht mitzählt, falsch steht.
 *
 * `auch` nimmt Nummern dazu, die noch in keinem Bestand liegen: ein Import
 * legt zwanzig Artikel auf einmal an, und ohne das bekämen alle zwanzig
 * dieselbe.
 */
export function nextId(
  entities: Iterable<Pick<Entity, 'components'>>,
  type: string,
  auch: Iterable<string> = [],
): string {
  const prefix = idPrefix(type);
  const muster = new RegExp(`^${prefix}-(\\d+)$`);
  let hoechste = 0;
  const schauen = (wert: string): void => {
    const treffer = muster.exec(wert);
    if (treffer) hoechste = Math.max(hoechste, Number(treffer[1]));
  };
  for (const e of entities) schauen(articleId(e));
  for (const wert of auch) schauen(wert);
  return `${prefix}-${String(hoechste + 1).padStart(4, '0')}`;
}

/**
 * Wie ein Feld **an dieser Art** heisst.
 *
 * Gesucht wird die `extends`-Kette hoch, wie bei `area` und `units`: die
 * Art selbst zuerst, dann ihre Bestandteile in der Reihenfolge, in der sie
 * dastehen. Der erste, der `Typ.feld` nennt, gewinnt; sagt keiner etwas,
 * gilt der Name, den das Feld selbst trägt.
 *
 * Damit heisst `Time.duration` bei einem Rezept „Burn time" und bei einer
 * Quest „Deadline", ohne dass es `Time` zweimal gäbe. Es ist eine
 * Beschriftung und keine zweite Feldliste: ein Feld, das morgen dazukommt,
 * bringt seinen eigenen Namen mit.
 */
export function fieldTitle(
  registry: Pick<Registry, 'interfaces'>,
  type: string | undefined,
  field: Pick<TypedField, 'type' | 'key' | 'prop'>,
): string {
  const ref = `${field.type}.${field.key}`;
  if (type) {
    for (const t of typeChain(registry, type)) {
      const eigen = registry.interfaces[t]?.titles?.[ref];
      if (typeof eigen === 'string' && eigen.trim()) return eigen;
    }
  }
  return field.prop.title ?? field.key;
}

/**
 * **Die Typen, deren Felder dieser Typ über eine Kante mitbringt** — die
 * Verbindungen, die sich an diesem Ende wie ein Feld lesen (`asField`).
 *
 * Zurück kommt je Kante, welcher Typ dort hängt, wie die Gruppe heisst und
 * in welche Richtung die Kante gespeichert ist. Gespeichert wird weiterhin
 * **nur vorwärts** (D: eine Kante hat eine Richtung): steht `asField` auf
 * `to`, liegt die Kante am anderen Artikel, und dieser hier findet sie über
 * die Rückfrage. Genau das ist der Grund, warum es diese Funktion gibt und
 * nicht eine zweite Kante.
 */
export function linkedTypes(
  registry: Pick<Registry, 'relations' | 'interfaces'>,
  interfaceName: string,
): {
  relation: string;
  /** `out` — die Kante liegt an diesem Artikel; `in` — am anderen. */
  direction: 'out' | 'in';
  /** Der Typ am anderen Ende. */
  type: string;
  label: string;
  cardinality: 'one' | 'many';
}[] {
  const raus: ReturnType<typeof linkedTypes> = [];
  for (const def of Object.values(registry.relations)) {
    if (!def.asField) continue;
    const hier = def.asField;
    const liste = hier === 'from' ? def.from : def.to;
    if (!interfaceInList(registry, liste, interfaceName)) continue;
    /* Der Typ am anderen Ende. Steht dort `*` oder mehr als einer, ist es
       kein Feld: ein Feld hat einen Typ, und „irgendeiner von vier" wäre
       eine Auswahl und keine Angabe. */
    const gegen = hier === 'from' ? def.to : def.from;
    if (!gegen || gegen.length !== 1 || gegen[0] === '*') continue;
    raus.push({
      relation: def.type,
      direction: hier === 'from' ? 'out' : 'in',
      type: gegen[0] as string,
      label: hier === 'from' ? def.label : def.inverseLabel,
      cardinality: def.cardinality ?? 'many',
    });
  }
  return raus;
}

/**
 * Die Werte, die in dieses Feld dürfen — die eigenen oder die der
 * Aufzählungszeile, die es nennt.
 *
 * Ein Feld nennt seine Werte selbst (`enum`) **oder** eine Zeile
 * (`enumRef`), nie beides: zwei Listen für ein Feld wären zwei Antworten
 * auf dieselbe Frage. Steht die genannte Zeile nicht im Register, gibt es
 * keine Werte — und ein Feld ohne Werte ist ein freies Wort, nicht ein
 * Feld mit einer leeren Liste. Genau das soll die Maske zeigen, statt
 * eine Auswahl anzubieten, in der nichts steht.
 */
export function enumOptions(
  registry: Pick<Registry, 'enums'>,
  prop: Pick<PropertySchema, 'enum' | 'enumRef'> | undefined,
): string[] | undefined {
  if (!prop) return undefined;
  if (prop.enum?.length) return prop.enum;
  const gruppen = enumGroups(registry, prop);
  if (!gruppen.length) return undefined;
  /* Mehrere Zeilen gelten zusammen, in der Reihenfolge, in der das Feld sie
     nennt. Doppelte fallen weg — zwei Listen, die dasselbe Wort führen,
     sollen es nicht zweimal anbieten. */
  const raus: string[] = [];
  for (const g of gruppen) for (const v of g.values) if (!raus.includes(v)) raus.push(v);
  return raus.length ? raus : undefined;
}

/**
 * Dasselbe, aber **je Zeile getrennt** — für eine Maske, die die Werte
 * gruppiert zeigen soll, und für die Frage, aus welcher Liste ein Wert
 * kommt.
 *
 * Genannte Zeilen, die es nicht gibt, fallen weg: eine fehlende Zeile ist
 * keine leere Liste. Eigene Werte am Feld (`enum`) sind keine Zeile und
 * stehen deshalb nicht hier — sie haben keinen Namen, unter dem man sie
 * gruppieren könnte.
 */
export function enumGroups(
  registry: Pick<Registry, 'enums'>,
  prop: Pick<PropertySchema, 'enumRef'> | undefined,
): { name: string; label: string; values: string[] }[] {
  const refs = prop?.enumRef;
  if (!refs) return [];
  const namen = Array.isArray(refs) ? refs : [refs];
  const raus: { name: string; label: string; values: string[] }[] = [];
  for (const n of namen) {
    const zeile = registry.enums?.[n];
    if (!zeile?.values?.length) continue;
    raus.push({ name: n, label: zeile.label ?? n, values: zeile.values });
  }
  return raus;
}

/** Aus welcher genannten Zeile dieser Wert kommt — oder `undefined`. */
export function enumSource(
  registry: Pick<Registry, 'enums'>,
  prop: Pick<PropertySchema, 'enumRef'> | undefined,
  value: string,
): string | undefined {
  for (const g of enumGroups(registry, prop)) if (g.values.includes(value)) return g.name;
  return undefined;
}

/**
 * Every field an article of this type may carry, own ones first and the
 * inherited ones behind them, each with the type that declares it.
 */
export function fieldsOf(registry: Pick<Registry, 'interfaces'>, name: string): TypedField[] {
  const out: TypedField[] = [];
  for (const t of typeChain(registry, name)) {
    for (const [key, prop] of Object.entries(ownFields(registry, t))) out.push({ type: t, key, prop });
  }
  return out;
}

/**
 * Die Prosafelder einer Art: die mit `many` und langer Eingabe.
 *
 * Das waren einmal die **Blockarten** — eine eigene Liste je Artikelart,
 * neben den Feldern. Jetzt sind sie Felder wie alle anderen, und wer sie
 * sucht, fragt nach ihrer Form statt nach einer zweiten Liste.
 */
export function proseFields(
  registry: Pick<Registry, 'interfaces'>,
  name: string,
): TypedField[] {
  return fieldsOf(registry, name).filter((f) => f.prop.many && f.prop.format === 'long');
}

/**
 * Is this interface in that list — directly, as `*`, or through one of its
 * ancestors?
 *
 * Matching the name literally means an edge anchored on an abstract parent
 * reaches none of its subtypes: `from: ['Creature']` would be offered on
 * nothing, because every creature is a subtype and none *is* `Creature`.
 * The walk goes upward only — `from: ['NPC']` stays an NPC edge and does not
 * leak onto everything that happens to be a creature.
 */
function interfaceInList(
  registry: Pick<Registry, 'interfaces'>,
  list: readonly string[] | undefined,
  interfaceName: string,
): boolean {
  if (!list || list.length === 0 || list.includes('*')) return true;
  /* **Alle** Obertypen, nicht nur der erste. `extends` ist ein Array, und
     eine Art, die von zweien erbt, erbt von beiden — dass der Code bisher
     nur `[0]` las, hiess: die zweite Herkunft galt für die Felder (dort
     wird schon `flatMap` gelaufen), aber nicht für die Kanten. Zwei
     Antworten auf dieselbe Frage, und die eine war still falsch. */
  const seen = new Set<string>();
  const offen: string[] = [interfaceName];
  while (offen.length) {
    const at = offen.pop() as string;
    if (seen.has(at)) continue;
    if (list.includes(at)) return true;
    seen.add(at);
    for (const p of registry.interfaces[at]?.extends ?? []) offen.push(p);
  }
  return false;
}

/** Relation definitions whose source may be this interface. */
export function relationsFrom(
  registry: Pick<Registry, 'relations' | 'interfaces'>,
  interfaceName: string,
): RelationDef[] {
  return Object.values(registry.relations).filter((def) =>
    interfaceInList(registry, def.from, interfaceName),
  );
}

/** May this relation point at that entity? `same` means the source's own interface. */
export function relationAccepts(
  def: RelationDef,
  sourceInterface: string,
  targetInterface: string,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  const to = def.to ?? ['*'];
  if (to.includes('*')) return true;
  if (to.includes('same') && targetInterface === sourceInterface) return true;
  if (registry) return interfaceInList(registry, to, targetInterface);
  return to.includes(targetInterface);
}

/**
 * Die Zieltypen eines Verweisfelds, oder `undefined` für „jeder Artikel".
 *
 * Eine leere Liste ist dasselbe wie keine: ein Verweis ohne Einschränkung
 * ist immer noch ein Verweis und kein Fehler.
 */
export function linkTargets(prop: PropertySchema | undefined): string[] | undefined {
  const liste = prop?.target?.interfaces;
  return liste && liste.length ? liste : undefined;
}

/**
 * Darf dieses Verweisfeld auf einen Artikel dieser Art zeigen?
 *
 * Gelaufen wird dieselbe Kette wie bei einer Kante (`interfaceInList`, die
 * `extends`-Kette hoch): `interfaces: ['Creature']` nimmt eine
 * Spielerfigur, weil sie eine Kreatur **ist**. Die Marken und der Feldwert
 * aus `LinkTarget` sind hier nicht dabei — die lesen den heutigen Zustand
 * des Ziels und gehören der Maske, nicht der Prüfung.
 */
export function linkAccepts(
  registry: Pick<Registry, 'interfaces'>,
  prop: PropertySchema | undefined,
  targetInterface: string,
): boolean {
  const liste = linkTargets(prop);
  if (!liste) return true;
  return interfaceInList(registry, liste, targetInterface);
}

export function relationDef(
  registry: Pick<Registry, 'relations'>,
  type: string,
): RelationDef {
  return (
    registry.relations[type] ?? {
      type,
      label: type,
      inverseLabel: `← ${type}`,
      to: ['*'],
    }
  );
}

/**
 * Everything pointing at `id`. Forward edges are the only stored form, so the
 * reverse direction is always this query — which is why a relation can never
 * be half-orphaned the way a mirrored pair can.
 */
export function backlinks(
  registry: Pick<Registry, 'relations'>,
  entities: Iterable<Entity>,
  id: EntityId,
): Backlink[] {
  const found: Backlink[] = [];
  for (const entity of entities) {
    for (const relation of entity.relations ?? []) {
      if (relation.to === id) {
        found.push({ from: entity, relation, def: relationDef(registry, relation.type) });
      }
    }
  }
  return found;
}

/** Outgoing edges, split into composition sections and plain references. */
export function splitRelations(
  registry: Pick<Registry, 'relations'>,
  entity: Entity,
): { sections: Record<string, typeof entity.relations>; plain: NonNullable<typeof entity.relations> } {
  const sections: Record<string, NonNullable<typeof entity.relations>> = {};
  const plain: NonNullable<typeof entity.relations> = [];
  for (const relation of entity.relations ?? []) {
    const def = registry.relations[relation.type];
    if (def?.section) {
      (sections[def.section] ??= []).push(relation);
    } else {
      plain.push(relation);
    }
  }
  return { sections, plain };
}

/** Resolve a name or alias to an entity id — the Registry engine's job (REQ-013). */
export function findByName(entities: Iterable<Entity>, name: string): Entity | undefined {
  const needle = String(name ?? '').trim().toLowerCase();
  if (!needle) return undefined;
  for (const entity of entities) {
    if (entityName(entity).toLowerCase() === needle) return entity;
    const aliases = entity.components?.['Identity']?.['aliases'];
    if (Array.isArray(aliases) && aliases.some((a) => String(a).toLowerCase() === needle)) {
      return entity;
    }
  }
  return undefined;
}

/**
 * Ein Eintrag eines Feldes mit `many`.
 *
 * Die `id` ist das, woran eine Wissensfreigabe hängt — sie war einmal der
 * Anker eines Blocks und heisst jetzt so, wie sie sich verhält.
 */
export interface FieldEntry {
  id: string;
  value: string;
}

/** Die Einträge eines Feldes, egal wie der Wert geschrieben ist.
 *
 *  Ein blosser Text wird als ein Eintrag gelesen und eine Liste von Texten
 *  als Einträge ohne eigene Id: so bleibt ein von Hand getipptes Register
 *  lesbar, statt am ersten Tippfehler stillzustehen. */
export function entriesOf(value: unknown): FieldEntry[] {
  if (value === undefined || value === null || value === '') return [];
  const eintrag = (x: unknown, i: number): FieldEntry => {
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      return {
        id: typeof o['id'] === 'string' && o['id'] ? o['id'] : `e${i}`,
        value: typeof o['value'] === 'string' ? o['value'] : String(o['value'] ?? ''),
      };
    }
    return { id: `e${i}`, value: String(x) };
  };
  if (Array.isArray(value)) return value.map(eintrag);
  return [eintrag(value, 0)];
}

/** Der Verweis auf einen einzelnen Eintrag: `Creature.secret#anchor`. */
export function entryRef(type: string, key: string, id: string): string {
  return `${type}.${key}#${id}`;
}
