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
import { entityName, entriesOf, entryRef } from './entity.js';

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

/**
 * Ein Feldverweis, wie ihn auch die Ansichten schreiben: `Type`,
 * `Type.field` — oder `Type.field#id` für **einen Eintrag** eines Feldes
 * mit `many`.
 *
 * Die dritte Form war einmal ein Blockanker. Ein Geheimnis von dreien
 * freizugeben heisst, genau diesen Eintrag freizugeben, und dafür braucht
 * er einen Namen, der eine Umsortierung überlebt.
 */
export type FieldRef = string;

export interface KnowledgeGroup {
  /** Die Information; fehlt bei der offenen Restgruppe. */
  info?: Entity;
  label: string;
  fields: FieldRef[];
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

/**
 * Beansprucht diese Information diesen Verweis?
 *
 * Dieselbe Regel wie bei den Ansichten, eine Stufe tiefer: ein blosser
 * Artname nimmt alle Felder, die diese Art erklärt; `Type.field` das ganze
 * Feld mit allen seinen Einträgen; `Type.field#id` genau einen Eintrag.
 */
export function coversRef(info: Entity, ref: FieldRef): boolean {
  const fields = infoFields(info);
  if (fields.includes(ref)) return true;
  const ohneEintrag = ref.split('#')[0] as string;
  if (fields.includes(ohneEintrag)) return true;
  const art = ohneEintrag.split('.')[0] as string;
  return fields.includes(art);
}

/** Der alte Zugang: Art und Feld getrennt. */
export function covers(info: Entity, component: string, property: string): boolean {
  return coversRef(info, property ? `${component}.${property}` : component);
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
  const claimedFields = new Set<FieldRef>();

  const groups: KnowledgeGroup[] = infos.map((info) => {
    const fields = allFields.filter((ref) => coversRef(info, ref));
    fields.forEach((f) => claimedFields.add(f));
    return {
      info,
      label: entityName(info),
      fields,
      open: false,
      known: knows(entities, info, viewerId),
    };
  });

  const rest: KnowledgeGroup = {
    label: 'Open',
    fields: allFields.filter((f) => !claimedFields.has(f)),
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
 * - **Einzelne Einträge** eines Feldes mit `many`, ebenso — plus die
 *   Felder, die nie an einen Spieler gehen (`gmFields`), sofern kein
 *   bekanntes Wissen sie ausdrücklich freigibt. Ein Geheimnis, das jemand
 *   geschenkt bekommen hat, bleibt seines, auch wenn das Feld „secret"
 *   heisst.
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
  gmFields: string[] = ['Secrets.secret', 'Tactics.tactics'],
): Entity {
  if (!viewerId) return article;

  /* Ein Feld mit `many` zählt je **Eintrag**: `Creature.secret#anchor`. Ein
     Geheimnis von dreien freizugeben heisst, genau dieses freizugeben. */
  const vieleFelder = (component: string, property: string): boolean =>
    registry.interfaces[component]?.schema?.properties?.[property]?.many === true;

  const allFields: FieldRef[] = [];
  for (const [component, card] of Object.entries(article.components ?? {})) {
    for (const [property, value] of Object.entries((card ?? {}) as Record<string, unknown>)) {
      if (vieleFelder(component, property)) {
        for (const e of entriesOf(value)) allFields.push(entryRef(component, property, e.id));
      } else {
        allFields.push(`${component}.${property}`);
      }
    }
  }
  const groups = knowledgeGroups(registry, entities, article, allFields, viewerId);
  const erlaubtF = new Set<FieldRef>();
  const beansprucht = new Set<FieldRef>();
  for (const g of groups) {
    if (!g.info) continue; /* die offene Restgruppe beansprucht nichts */
    g.fields.forEach((f) => beansprucht.add(f));
    if (!g.known) continue;
    g.fields.forEach((f) => erlaubtF.add(f));
  }
  /* Was keine Information beansprucht, ist offen — das ist die Restgruppe,
     und ihre Felder gelten ohne weiteres. Nur die Felder, die nie an einen
     Spieler gehen, gelten auch dann nicht: sonst wäre jeder unbeanspruchte
     `secret`-Eintrag offen, und das Feld hiesse gar nichts mehr. */
  const nurSL = (ref: FieldRef): boolean => {
    const ohne = ref.split('#')[0] as string;
    return gmFields.includes(ohne) || gmFields.includes(ohne.split('.')[1] ?? '');
  };
  const rest = groups.find((g) => !g.info);
  rest?.fields.forEach((f) => { if (!nurSL(f)) erlaubtF.add(f); });

  const components: Record<string, Record<string, unknown>> = {};
  for (const [component, card] of Object.entries(article.components ?? {})) {
    const behalten: Record<string, unknown> = {};
    for (const [property, value] of Object.entries((card ?? {}) as Record<string, unknown>)) {
      if (vieleFelder(component, property)) {
        const uebrig = entriesOf(value)
          .filter((e) => erlaubtF.has(entryRef(component, property, e.id)));
        if (uebrig.length) behalten[property] = uebrig;
        continue;
      }
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

  /* Auch der bequeme Name oben am Artikel. Ihn stehen zu lassen wäre die
     Art Lücke, die niemand sucht: die Karte ist gesiebt, und daneben steht
     der Name im Klartext. */
  const name = (components['Identity']?.['name'] as string | undefined) ?? article.name;

  return { ...article, name, components } as Entity;
}
