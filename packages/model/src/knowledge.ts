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

/** Die Art, deren Karte die Angaben einer Information trägt. */
export const INFO_COMPONENT = 'Information';

/** Ein Feldverweis, wie ihn auch die Ansichten schreiben: `Type` oder `Type.field`. */
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
 * Dieselbe Regel wie bei den Ansichten: ein blosser Artname nimmt alle
 * Felder, die diese Art erklärt, `Type.field` genau eines.
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
  viewerId: EntityId | readonly EntityId[],
): Set<EntityId> {
  /* **Ein Konto kann mehrere Figuren führen.** Dann ist „ich" ihre
     Vereinigung: wer Rook und Sela spielt, weiss am Tisch, was beide
     wissen, und eine Seite, die ihm Selas Wissen vorenthält, während er
     Rook offen hat, zwingt ihn zum Umschalten und sonst zu nichts. */
  const viewers = (typeof viewerId === 'string' ? [viewerId] : viewerId).filter(Boolean);
  const holders = new Set<EntityId>(viewers);
  for (const one of viewers) {
    const viewer = entities.get(one);
    if (!viewer) continue;
    for (const id of edges(viewer, AT_LEVEL_RELATION)) holders.add(id);
    for (const partyId of edges(viewer, PARTY_RELATION)) {
      holders.add(partyId);
      for (const id of edges(entities.get(partyId), AT_LEVEL_RELATION)) holders.add(id);
    }
  }
  return holders;
}

/** Kennt dieser Betrachter die Information? Ohne Betrachter: ja (Spielleitung). */
export function knows(
  entities: Map<EntityId, Entity>,
  info: Entity,
  viewerId?: EntityId | readonly EntityId[],
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
  viewerId?: EntityId | readonly EntityId[],
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
  viewerId?: EntityId | readonly EntityId[],
): FieldRef[] {
  if (!viewerId) return allFields;
  const allowed = new Set<FieldRef>();
  for (const group of knowledgeGroups(registry, entities, article, allFields, viewerId)) {
    if (group.known) group.fields.forEach((f) => allowed.add(f));
  }
  return allFields.filter((f) => allowed.has(f));
}

/**
 * Den Artikel so, wie dieser Betrachter ihn sehen darf (REQ-035, 036).
 *
 * Bis hierher machte das Zurückhalten nur die Oberfläche. Das reicht genau
 * so lange, wie niemand die Schnittstelle direkt aufruft — und ein Server,
 * der einem Spieler die Geheimnisse der Spielleitung schickt und darauf
 * baut, dass sein Browser sie nicht anzeigt, hält gar nichts zurück.
 *
 * Deshalb steht es hier und nicht dort: was hier liegt, gilt für Server und
 * Oberfläche gleichermassen, und es gibt es nur einmal.
 *
 * Drei Sachen gehen weg:
 * - **Felder**, die eine Information beansprucht, die er nicht kennt.
 * - **Blöcke**, ebenso — plus die Blockarten, die nie an einen Spieler
 *   gehen (`gmBlockTypes`), sofern kein bekanntes Wissen sie ausdrücklich
 *   freigibt. Ein Block, den jemand geschenkt bekommen hat, bleibt sein
 *   Block, auch wenn er „secret" heisst.
 * - **Der Name**, wenn er beansprucht und ungewusst ist: dann steht der
 *   Deckname da (REQ-178).
 *
 * Die Kanten bleiben: eine Verbindung zu verbergen hiesse, den Rückbezug am
 * anderen Ende mitzuverbergen, und das ist eine andere Frage als diese.
 * Was ein Betrachter überhaupt sehen darf, entscheidet weiterhin die
 * Sichtbarkeit — nicht dieses Sieb.
 */
export function redactEntity(
  registry: Pick<Registry, 'interfaces'>,
  entities: Map<EntityId, Entity>,
  article: Entity,
  viewerId?: EntityId | readonly EntityId[],
  gmBlockTypes: string[] = ['secret', 'tactics'],
): Entity {
  if (!viewerId) return article;

  const allFields: FieldRef[] = [];
  for (const [component, card] of Object.entries(article.components ?? {})) {
    for (const property of Object.keys((card ?? {}) as Record<string, unknown>)) {
      allFields.push(`${component}.${property}`);
    }
  }
  const groups = knowledgeGroups(registry, entities, article, allFields, viewerId);
  const erlaubtF = new Set<FieldRef>();
  const erlaubtB = new Set<string>();
  const beanspruchtB = new Set<string>();
  for (const g of groups) {
    if (!g.info) continue; /* die offene Restgruppe beansprucht nichts */
    g.blocks.forEach((b) => beanspruchtB.add(b));
    if (!g.known) continue;
    g.fields.forEach((f) => erlaubtF.add(f));
    /* Nur ein Block, den eine **bekannte Information** ausdrücklich
       freigibt, schlägt die Blockart. Die offene Restgruppe darf das nicht:
       sonst wäre jeder unbeanspruchte `secret`-Block offen, und die
       Blockart hiesse gar nichts mehr. */
    g.blocks.forEach((b) => erlaubtB.add(b));
  }
  /* Was keine Information beansprucht, ist offen — das ist die Restgruppe,
     und ihre Felder gelten ohne weiteres. */
  const rest = groups.find((g) => !g.info);
  rest?.fields.forEach((f) => erlaubtF.add(f));

  const components: Record<string, Record<string, unknown>> = {};
  for (const [component, card] of Object.entries(article.components ?? {})) {
    const behalten: Record<string, unknown> = {};
    for (const [property, value] of Object.entries((card ?? {}) as Record<string, unknown>)) {
      if (erlaubtF.has(`${component}.${property}`)) behalten[property] = value;
    }
    /* Eine Karte, von der nichts übrig bleibt, wird weggelassen und nicht
       leer mitgeschickt: „da ist eine Karte, aber sie ist leer" wäre eine
       Auskunft, die niemand geben wollte. */
    if (Object.keys(behalten).length) components[component] = behalten;
  }

  /* Der Deckname. Er ist die einzige Stelle, an der etwas eingesetzt und
     nicht weggelassen wird — ein Artikel ohne Namen wäre unbrauchbar, und
     „jemand" ist ehrlicher als nichts. */
  const wer = (article.components ?? {})['Identity'] as { cover?: string } | undefined;
  if (!erlaubtF.has('Identity.name')) {
    const cover = wer?.cover;
    components['Identity'] = { ...(components['Identity'] ?? {}), name: cover || 'jemand' };
  }

  const blocks = (article.blocks ?? []).filter((b) => {
    const anchor = b.anchor || b.id;
    if (erlaubtB.has(anchor)) return true;
    if (beanspruchtB.has(anchor)) return false;
    return !gmBlockTypes.includes(b.blockType);
  });

  /* Auch der bequeme Name oben am Artikel. Ihn stehen zu lassen wäre die
     Art Lücke, die niemand sucht: die Karte ist gesiebt, und daneben steht
     der Name im Klartext. */
  const name = (components['Identity']?.['name'] as string | undefined) ?? article.name;

  return { ...article, name, components, blocks } as Entity;
}
