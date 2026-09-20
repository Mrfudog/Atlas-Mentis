/**
 * Wissen: wer weiss was über einen Artikel.
 *
 * Die Einheit dazwischen heisst **Information** und ist ein eigener Artikel,
 * kein Feldattribut. Sie bündelt Felder und Textblöcke eines Artikels und
 * wird Empfängern zugeteilt. Das ist der Grund für den Umweg: ein Attribut am
 * Feld könnte nur *einen* Empfänger tragen und wäre nicht abfragbar. Eine
 * Information ist ein Peg, also trägt sie Kanten — und „wer weiss vom wahren
 * Namen des Barons?" ist damit ein Rückbezug wie jeder andere.
 *
 * Drei Kantenarten spannen das auf:
 *
 *   Artikel      --knowledge--> Information   (`owned`: stirbt mit dem Artikel)
 *   Information  --knownBy-->   Creature | Party | KnowledgeLevel
 *   Creature     --atLevel-->   KnowledgeLevel
 *
 * Ein Feld, das keine Information nennt, ist **offen**. Die Umkehrung wäre
 * sicherer, aber sie macht jede neue Zeile unsichtbar, bis jemand daran
 * denkt — und eine Spieleransicht, die standardmässig leer ist, benutzt
 * niemand. Die Wissensansicht zeigt das Offene deshalb als eigene Gruppe an
 * erster Stelle: man sieht dort immer, was gerade offen liegt.
 *
 * Nichts davon wird gespeichert berechnet (D8). Was jemand weiss, ist immer
 * diese Abfrage über die Kanten.
 */

import type { Entity, EntityId, Registry } from './types.js';
import { entityName } from './entity.js';

/** Die Kantenart, die einen Artikel mit seinen Informationen verbindet. */
export const KNOWLEDGE_RELATION = 'knowledge';
/** Die Kantenart, die eine Information einem Empfänger zuteilt. */
export const KNOWN_BY_RELATION = 'knownBy';
/** Die Kantenart, die eine Figur einem Wissensstand zuordnet. */
export const AT_LEVEL_RELATION = 'atLevel';
/** Party-Mitgliedschaft — wer in der Gruppe ist, erbt deren Wissen. */
export const PARTY_RELATION = 'memberOfParty';

/** Die Komponente, die eine Information trägt. */
export const INFO_COMPONENT = 'Info';

/** Ein Feldverweis, wie ihn auch die Ansichten schreiben: `Comp` oder `Comp.field`. */
export type FieldRef = string;

export interface KnowledgeGroup {
  /** Die Information; fehlt bei der offenen Restgruppe. */
  info?: Entity;
  label: string;
  fields: FieldRef[];
  blocks: string[];
  /** Offen liegend — also von keiner Information beansprucht. */
  open: boolean;
  /** Weiss der Betrachter davon? Ohne Betrachter (Spielleitung) immer true. */
  known: boolean;
}

function edges(entity: Entity | undefined, type: string): EntityId[] {
  return (entity?.relations ?? []).filter((r) => r.type === type).map((r) => r.to);
}

/** Die Informationen, die an diesem Artikel hängen — in Reihenfolge der Kanten. */
export function informationsOf(entities: Map<EntityId, Entity>, article: Entity): Entity[] {
  const out: Entity[] = [];
  for (const id of edges(article, KNOWLEDGE_RELATION)) {
    const info = entities.get(id);
    if (info) out.push(info);
  }
  return out;
}

function infoFields(info: Entity): FieldRef[] {
  const raw = info.components?.[INFO_COMPONENT]?.['fields'];
  return Array.isArray(raw) ? raw.map(String) : [];
}

function infoBlocks(info: Entity): string[] {
  const raw = info.components?.[INFO_COMPONENT]?.['blocks'];
  return Array.isArray(raw) ? raw.map(String) : [];
}

/**
 * Beansprucht diese Information das Feld?
 * Dieselbe Regel wie bei den Ansichten: ein blosser Komponentenname nimmt
 * alle ihre Felder, `Comp.field` genau eines.
 */
export function covers(info: Entity, component: string, property: string): boolean {
  const fields = infoFields(info);
  return fields.includes(component) || fields.includes(`${component}.${property}`);
}

/**
 * Wer zählt für diesen Betrachter als „ich"? Die Figur selbst, ihre Gruppen
 * und ihre Wissensstände. Ein Schritt weit, nicht transitiv — ein Wissensstand,
 * der einem anderen angehört, wäre eine Hierarchie, und die hat hier niemand
 * verlangt.
 */
export function knowledgeHolders(
  entities: Map<EntityId, Entity>,
  viewerId: EntityId,
): Set<EntityId> {
  const holders = new Set<EntityId>([viewerId]);
  const viewer = entities.get(viewerId);
  if (!viewer) return holders;
  for (const id of edges(viewer, AT_LEVEL_RELATION)) holders.add(id);
  for (const partyId of edges(viewer, PARTY_RELATION)) {
    holders.add(partyId);
    for (const id of edges(entities.get(partyId), AT_LEVEL_RELATION)) holders.add(id);
  }
  return holders;
}

/** Kennt dieser Betrachter die Information? Ohne Betrachter: ja (Spielleitung). */
export function knows(
  entities: Map<EntityId, Entity>,
  info: Entity,
  viewerId?: EntityId,
): boolean {
  if (!viewerId) return true;
  const holders = knowledgeHolders(entities, viewerId);
  return edges(info, KNOWN_BY_RELATION).some((id) => holders.has(id));
}

/**
 * Der Artikel, nach Informationen gruppiert. Die offene Restgruppe steht
 * vorn und trägt keine Information — sie ist das, was übrig bleibt, nicht
 * etwas, das jemand gesetzt hat.
 *
 * `allFields` sind die Feldverweise, die die Ansicht ohnehin zeigen würde;
 * die Gruppierung ordnet sie nur, sie erweitert sie nie.
 */
export function knowledgeGroups(
  _registry: Pick<Registry, 'interfaces'>,
  entities: Map<EntityId, Entity>,
  article: Entity,
  allFields: FieldRef[],
  viewerId?: EntityId,
): KnowledgeGroup[] {
  const infos = informationsOf(entities, article);
  const blockAnchors = (article.blocks ?? []).map((b) => b.anchor || b.id);

  const claimedFields = new Set<FieldRef>();
  const claimedBlocks = new Set<string>();

  const groups: KnowledgeGroup[] = infos.map((info) => {
    const fields = allFields.filter((ref) => {
      const [component, property] = ref.split('.');
      return covers(info, component ?? ref, property ?? '');
    });
    const blocks = infoBlocks(info).filter((a) => blockAnchors.includes(a));
    fields.forEach((f) => claimedFields.add(f));
    blocks.forEach((b) => claimedBlocks.add(b));
    return {
      info,
      label: entityName(info),
      fields,
      blocks,
      open: false,
      known: knows(entities, info, viewerId),
    };
  });

  const rest: KnowledgeGroup = {
    label: 'Open',
    fields: allFields.filter((f) => !claimedFields.has(f)),
    blocks: blockAnchors.filter((b) => !claimedBlocks.has(b)),
    open: true,
    known: true,
  };
  return [rest, ...groups];
}

/**
 * Die Feldverweise, die dieser Betrachter sehen darf. Offene Felder plus die
 * aus Informationen, die er kennt. Ohne Betrachter: alles.
 */
export function visibleFields(
  registry: Pick<Registry, 'interfaces'>,
  entities: Map<EntityId, Entity>,
  article: Entity,
  allFields: FieldRef[],
  viewerId?: EntityId,
): FieldRef[] {
  if (!viewerId) return allFields;
  const allowed = new Set<FieldRef>();
  for (const group of knowledgeGroups(registry, entities, article, allFields, viewerId)) {
    if (group.known) group.fields.forEach((f) => allowed.add(f));
  }
  return allFields.filter((f) => allowed.has(f));
}
