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
 *   Knowledge    --includes-->  Information   (ein Bündel)
 *   Information | Knowledge --knownBy--> Creature | Party | Faction
 *
 * Ein **Bündel** ist ein Artikel wie die Information selbst und wird über
 * dieselbe Kante zugeteilt: wer „was ein Kanalgänger weiss" kennt, kennt
 * jede Information darin. Es gab hier einmal einen *Wissensstand*, dem
 * Figuren über `atLevel` angehörten — ein zweiter Weg zu „wer weiss das",
 * obwohl Party schon Empfänger sein konnte. In zwei Jahren hat
 * ihn niemand benutzt.
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

import { ancestryLine } from './choices.js';
import { PARTICIPATES, redactParticipants, type PlayerViewRules } from './initiative.js';
import type { Entity, EntityId, Registry, ViewApplies } from './types.js';
import { entityName, entriesOf, entryRef } from './entity.js';
import { appliesHolds } from './viewScope.js';

/** Die Kantenart, die einen Artikel mit seinen Informationen verbindet. */
export const KNOWLEDGE_RELATION = 'knowledge';
/** Die Kantenart, die eine Information einem Empfänger zuteilt. */
export const KNOWN_BY_RELATION = 'knownBy';
/** Die Kantenart, die ein Bündel mit den Informationen darin verbindet. */
export const INCLUDES_RELATION = 'includes';
/** Party-Mitgliedschaft — wer in der Gruppe ist, erbt deren Wissen. */
export const PARTY_RELATION = 'memberOfParty';
/** Party → Kampagne: zu welcher Runde eine Gruppe gehört (A8). */
export const PARTY_OF_RELATION = 'partyOf';

/**
 * **Die Gruppen einer Kampagne** (A8, T-100) — die Parties mit `partyOf`
 * auf sie, die älteste zuerst (nach Nummer, dann Id). Die erste ist die,
 * in die eine zugeteilte Spielerfigur von selbst kommt: jede Kampagne
 * bekommt beim Anlegen eine, und wer zwei Tische hat, legt die zweite an
 * und teilt von Hand zu.
 */
export function partiesOf(entities: Map<EntityId, Entity>, campaignId: EntityId): Entity[] {
  const nummer = (e: Entity) => String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? '');
  return [...entities.values()]
    .filter((e) => (e.relations ?? []).some((r) => r.type === PARTY_OF_RELATION && r.to === campaignId))
    .sort((a, b) => nummer(a).localeCompare(nummer(b)) || a.id.localeCompare(b.id));
}

/**
 * Fraktionsmitgliedschaft — **eine Fraktion weiss nichts, ihre Mitglieder
 * wissen** (Abgleich A7, REQ-203). Die Kante trägt den Rang
 * (`props.rank`, ein Wort aus `Faction.ranks`), und eine Zuteilung an die
 * Fraktion darf einen Mindestrang nennen.
 */
export const FACTION_RELATION = 'memberOf';
/** Die Art, deren Karte die Rangleiter einer Fraktion trägt. */
export const FACTION_COMPONENT = 'Faction';

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

/**
 * **Die Geltung einer Information** (T-285, REQ-350): für welche Artikel
 * sie gilt, in der Form der Ansichten (`ViewApplies`) — „jede Kreatur mit
 * Herkunft Orc". Ohne Geltung gilt sie nur dort, wo ein Artikel sie über
 * `knowledge` nennt, wie bisher.
 */
export function infoApplies(info: Entity): ViewApplies | null {
  const a = info.components?.[INFO_COMPONENT]?.['applies'];
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const v = a as ViewApplies;
  return v.types?.length || v.where?.length || v.article ? v : null;
}

/* Die Informationen mit Geltung, einmal je Bestand gesucht: es sind
   wenige, gefragt wird je Artikel — bei einer Liste 24 000 Mal (W7).
   Ein Bestand, der wächst oder schrumpft, wird neu durchsucht. */
const regelCache = new WeakMap<ReadonlyMap<EntityId, Entity>, { size: number; infos: Entity[] }>();
export function ruleInformations(entities: ReadonlyMap<EntityId, Entity>): Entity[] {
  const da = regelCache.get(entities);
  if (da && da.size === entities.size) return da.infos;
  const infos = [...entities.values()].filter((e) => (e.interfaces ?? []).includes(INFO_COMPONENT) && infoApplies(e));
  regelCache.set(entities, { size: entities.size, infos });
  return infos;
}

/**
 * Die Informationen, die an diesem Artikel hängen — in Reihenfolge der
 * Kanten —, und mit `registry` dazu die, deren Geltung ihn trifft (T-285).
 * Eine Unterart zählt für ihre Grundart: „Herkunft Orc" trifft auch
 * „Orc (Mountain)" (`ancestryLine`).
 */
export function informationsOf(entities: Map<EntityId, Entity>, article: Entity, registry?: Pick<Registry, 'interfaces'>): Entity[] {
  const out: Entity[] = [];
  for (const id of edges(article, KNOWLEDGE_RELATION)) {
    const info = entities.get(id);
    if (info) out.push(info);
  }
  if (registry) {
    const regeln = ruleInformations(entities);
    if (regeln.length && !(article.interfaces ?? []).includes(INFO_COMPONENT)) {
      const reihe = (id: string) => ancestryLine(id, entities);
      for (const info of regeln) {
        if (out.includes(info)) continue;
        if (appliesHolds(registry, infoApplies(info)!, article, [], reihe)) out.push(info);
      }
    }
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
    for (const partyId of edges(viewer, PARTY_RELATION)) holders.add(partyId);
    /* **Was die Figur ist, weiss sie** (T-285, REQ-351): ihre Herkunft
       samt Grundart, ihr Hintergrund, ihre Klassen und Unterklassen und
       was sie gewählt hat (ein Talent) — ein Schritt weit wie die Gruppe.
       Ein Wissen, das der Herkunft Orc zugeteilt ist, weiss jede Figur mit
       dieser Herkunft. */
    for (const r of viewer.relations ?? []) {
      if (r.type === 'hasAncestry') for (const id of ancestryLine(r.to, entities)) holders.add(id);
      else if (r.type === 'hasBackground') holders.add(r.to);
      else if (r.type === 'hasClass') {
        holders.add(r.to);
        const sub = r.props?.['subclass'];
        if (typeof sub === 'string' && sub) holders.add(sub);
      } else if (r.type === 'chose') {
        const picks = Array.isArray(r.props?.['picks']) ? (r.props['picks'] as unknown[]) : [];
        for (const p of picks) if (typeof p === 'string' && entities.has(p)) holders.add(p);
      }
    }
    /* Die Fraktion zählt auch einen Schritt weit — den Rang prüft `knows`
       an der Zuteilung, denn hier ist nur die Frage, wer gemeint ist. */
    for (const factionId of edges(viewer, FACTION_RELATION)) holders.add(factionId);
  }
  return holders;
}

/** Die Rangleiter einer Fraktion, der niedrigste zuerst; leer, wenn keine. */
export function factionRanks(faction: Entity | undefined): string[] {
  const raw = faction?.components?.[FACTION_COMPONENT]?.['ranks'];
  return Array.isArray(raw) ? raw.map(String) : [];
}

/**
 * Auf welcher Sprosse der Betrachter in dieser Fraktion steht: die höchste
 * über alle seine Figuren. `-1` heisst Mitglied ohne Rang, `null` kein
 * Mitglied. Ein Rang, der nicht in der Leiter steht, zählt wie keiner — ein
 * Tippfehler darf nichts aufschliessen.
 */
export function rankIndex(
  entities: Map<EntityId, Entity>,
  viewerId: EntityId | readonly EntityId[],
  factionId: EntityId,
): number | null {
  const leiter = factionRanks(entities.get(factionId));
  const viewers = typeof viewerId === 'string' ? [viewerId] : viewerId;
  let best: number | null = null;
  for (const one of viewers) {
    for (const r of entities.get(one)?.relations ?? []) {
      if (r.type !== FACTION_RELATION || r.to !== factionId) continue;
      const rank = typeof r.props?.['rank'] === 'string' ? (r.props['rank'] as string) : '';
      const idx = rank ? leiter.indexOf(rank) : -1;
      if (best === null || idx > best) best = idx;
    }
  }
  return best;
}

/**
 * Kennt dieser Betrachter die Information? Ohne Betrachter: ja
 * (Spielleitung).
 *
 * Gefragt wird zweimal: hat er sie **selbst** bekommen, oder ein **Bündel**,
 * in dem sie steckt. Ein Bündel ist ein Artikel wie sie und trägt dieselbe
 * `knownBy`-Kante — wer „was ein Kanalgänger weiss" kennt, kennt alles
 * darin, ohne dass jemand die Zuteilungen einzeln nachzieht.
 *
 * Ein Bündel in einem Bündel zählt nicht: ein Schritt weit, dieselbe Regel
 * wie bei den Haltern. Eine Hierarchie von Wissen hat niemand verlangt, und
 * sie wäre die Stelle, an der eine Freigabe weiter reicht, als jemand
 * gemeint hat.
 */
export function knows(
  entities: Map<EntityId, Entity>,
  info: Entity,
  viewerId?: EntityId | readonly EntityId[],
): boolean {
  if (!viewerId) return true;
  const holders = knowledgeHolders(entities, viewerId);
  /* Eine Zuteilung an eine Fraktion darf einen Mindestrang nennen (A7):
     wer darunter steht, weiss es nicht — und wer gar keinen Rang hat, auch
     nicht, sobald einer verlangt ist. */
  const erreicht = (r: { to: EntityId; props?: Record<string, unknown> }): boolean => {
    if (!holders.has(r.to)) return false;
    const verlangt = typeof r.props?.['rank'] === 'string' ? (r.props['rank'] as string) : '';
    if (!verlangt) return true;
    const leiter = factionRanks(entities.get(r.to));
    if (!leiter.length) return true;
    const noetig = leiter.indexOf(verlangt);
    if (noetig < 0) return false;
    const hat = rankIndex(entities, viewerId, r.to);
    return hat !== null && hat >= noetig;
  };
  const direkt = (e: Entity): boolean =>
    (e.relations ?? []).some((r) => r.type === KNOWN_BY_RELATION && erreicht(r));
  if (direkt(info)) return true;
  for (const buendel of bundlesWith(entities, info.id)) if (direkt(buendel)) return true;
  return false;
}

/**
 * Die Bündel, die diese Information nennen — ein Rückbezug, weil `includes`
 * nur vorwärts gespeichert wird.
 */
export function bundlesWith(entities: Map<EntityId, Entity>, infoId: EntityId): Entity[] {
  const out: Entity[] = [];
  for (const e of entities.values())
    if (edges(e, INCLUDES_RELATION).includes(infoId)) out.push(e);
  return out;
}

/** Die Informationen in einem Bündel, in der Reihenfolge seiner Kanten. */
export function informationsIn(entities: Map<EntityId, Entity>, bundle: Entity): Entity[] {
  const out: Entity[] = [];
  for (const id of edges(bundle, INCLUDES_RELATION)) {
    const info = entities.get(id);
    if (info) out.push(info);
  }
  return out;
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
  registry: Pick<Registry, 'interfaces'>,
  entities: Map<EntityId, Entity>,
  article: Entity,
  allFields: FieldRef[],
  viewerId?: EntityId | readonly EntityId[],
): KnowledgeGroup[] {
  const infos = informationsOf(entities, article, registry);
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
  gmFields: string[] = ['Secrets.secret', 'Tactics.tactics', 'Encounter.solution', 'Encounter.hint'],
  /** Was die Kampagne Spielenden von der Initiative zeigt (T-022, `initiativeRulesOf`). */
  participantView?: PlayerViewRules,
  /**
   * **Ein Deckname verdeckt** (REQ-178): trägt der Artikel einen
   * Decknamen, gilt sein Name als ungewusst, bis eine bekannte Information
   * ihn nennt. Der Server setzt es für alle ausser der Leitung — wer
   * einen Decknamen einträgt, meint, dass die Spielenden ihn sehen.
   */
  coverHides = false,
): Entity {
  if (!viewerId) return article;
  const gmSet = new Set(gmFields);

  /* Ein Feld mit `many` zählt je **Eintrag**: `Creature.secret#anchor`. Ein
     Geheimnis von dreien freizugeben heisst, genau dieses freizugeben. */
  const vieleFelder = (component: string, property: string): boolean =>
    registry.interfaces[component]?.schema?.properties?.[property]?.many === true;

  /* Was keine Information beansprucht, ist offen — das ist die Restgruppe,
     und ihre Felder gelten ohne weiteres. Nur die Felder, die nie an einen
     Spieler gehen, gelten auch dann nicht: sonst wäre jeder unbeanspruchte
     `secret`-Eintrag offen, und das Feld hiesse gar nichts mehr. */
  /* Je Feld gefragt, also über eine Menge und ohne zweimal zu teilen: bei
     den 24 000 Artikeln einer Liste war das ein Fünftel des Siebs (W7). */
  const nurSL = (ref: FieldRef): boolean => {
    const raute = ref.indexOf('#');
    const ohne = raute < 0 ? ref : ref.slice(0, raute);
    if (gmSet.has(ohne)) return true;
    const punkt = ohne.indexOf('.');
    return gmSet.has(punkt < 0 ? '' : ohne.slice(punkt + 1).split('.')[0] ?? '');
  };

  /* **Ohne Information ist alles die Restgruppe** — offen bis auf die
     Felder der Leitung. Das ist der häufige Fall (fast jeder der 24 000
     Artikel aus 5e.tools), und für ihn braucht es weder die Feldliste noch
     die Gruppen: dieselbe Antwort, ohne sie zu bauen (W7). */
  /* Im kurzen Weg ohne Zeichenkette je Feld: ein Eintrag der Liste mit
     Punkt meint genau ein Feld, einer ohne Punkt dieses Feld an jeder
     Karte — dasselbe, was `nurSL` aus `Typ.feld` liest. */
  const gmBlank = new Set(gmFields.filter((f) => !f.includes('.')));
  const gmJe = new Map<string, Set<string>>();
  for (const f of gmFields) {
    const punkt = f.indexOf('.');
    if (punkt > 0) (gmJe.get(f.slice(0, punkt)) ?? gmJe.set(f.slice(0, punkt), new Set()).get(f.slice(0, punkt))!).add(f.slice(punkt + 1));
  }
  let feldErlaubt = (component: string, property: string, _eintrag?: string): boolean =>
    !gmBlank.has(property) && !gmJe.get(component)?.has(property);
  let erlaubt: (ref: FieldRef) => boolean = (ref) => !nurSL(ref);
  /* Nennt eine **bekannte** Information den Namen? Die Restgruppe zählt
     dafür nicht: unbeansprucht heisst nicht gewusst. */
  let nameGewusst = false;
  if (informationsOf(entities, article, registry).length) {
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
    for (const g of groups) {
      if (!g.info) continue; /* die offene Restgruppe beansprucht nichts */
      if (!g.known) continue;
      g.fields.forEach((f) => erlaubtF.add(f));
      if (g.fields.includes('Identity.name')) nameGewusst = true;
    }
    const rest = groups.find((g) => !g.info);
    rest?.fields.forEach((f) => { if (!nurSL(f)) erlaubtF.add(f); });
    erlaubt = (ref) => erlaubtF.has(ref);
    feldErlaubt = (component, property, eintrag) =>
      erlaubtF.has(eintrag === undefined ? `${component}.${property}` : entryRef(component, property, eintrag));
  }

  const components: Record<string, Record<string, unknown>> = {};
  for (const [component, card] of Object.entries(article.components ?? {})) {
    const behalten: Record<string, unknown> = {};
    for (const [property, value] of Object.entries((card ?? {}) as Record<string, unknown>)) {
      if (vieleFelder(component, property)) {
        /* **Ein Eintrag mit Form bleibt ganz** (`entry`, `Choices.choices`):
           gesiebt wird je Id, hinaus geht der Eintrag, wie er steht. Bis
           T-080 ging `{id, value}` hinaus, und an einer Wahl stand für
           Spielende danach nichts mehr. */
        const roh = Array.isArray(value) ? value : [value];
        const uebrig = entriesOf(value)
          .map((e, i) => ({ e, x: roh[i] as unknown }))
          .filter(({ e }) => feldErlaubt(component, property, e.id))
          .map(({ e, x }) => (x && typeof x === 'object' ? x : e));
        if (uebrig.length) behalten[property] = uebrig;
        continue;
      }
      if (feldErlaubt(component, property)) behalten[property] = value;
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
  /* Ein Name, der gar nicht in der Karte steht, ist nicht gewusst — wie im
     langen Weg, wo er in keiner Feldliste vorkommt. */
  const hatName = 'name' in ((article.components ?? {})['Identity'] ?? {});
  const verdeckt = coverHides && !!wer?.cover && !nameGewusst;
  if (!hatName || verdeckt || !erlaubt('Identity.name')) {
    const cover = wer?.cover;
    const { aliases: _aliases, ...ohneAliasse } = components['Identity'] ?? {};
    /* Verdeckt der Deckname, gehen die Aliasse mit: ein anderer Name für
       dasselbe verriete den richtigen. */
    components['Identity'] = { ...(verdeckt ? ohneAliasse : (components['Identity'] ?? {})), name: cover || 'jemand' };
  }

  /* Auch der bequeme Name oben am Artikel. Ihn stehen zu lassen wäre die
     Art Lücke, die niemand sucht: die Karte ist gesiebt, und daneben steht
     der Name im Klartext. */
  const name = (components['Identity']?.['name'] as string | undefined) ?? article.name;

  /* Die Initiative an einer Begegnung (REQ-213, D53): was Spielende von
     den Teilnehmern nicht sehen, geht gar nicht erst hinaus. */
  const kampf = article.relations?.some((r) => r.type === PARTICIPATES);
  const karte = ((article.components ?? {})['Encounter'] ?? {}) as { round?: number; turn?: number };
  const relations = kampf
    ? redactParticipants(entities, article.relations!, { round: karte.round, turn: karte.turn }, participantView)
    : article.relations;
  /* REQ-226, D58: die Zugnummer zählt die ganze Reihe, auch was verborgen
     ist oder noch nicht erschien — sie geht nicht hinaus; wer dran ist,
     sagt die Marke `current` am Teilnehmer. */
  if (kampf && components['Encounter'] && 'turn' in components['Encounter']) {
    const { turn: _turn, ...ohne } = components['Encounter'];
    components['Encounter'] = ohne;
  }

  return { ...article, name, components, ...(relations ? { relations } : {}) } as Entity;
}
