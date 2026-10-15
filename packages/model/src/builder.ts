/**
 * **Der Assistent für Figuren** (REQ-238, T-080): seine Schritte kommen aus
 * den Artikeln, nicht aus einer Liste im Code. Fest ist nur das Gerüst, das
 * das Modell selbst vorgibt (C2): Abstammung, Hintergrund, Klasse — drei
 * Kanten —, dann die Attribute, dann **je offene Wahl ein Schritt**
 * (`choicesAtCharacter`), zuletzt Name und Rest. Was eine Wahl öffnet (eine
 * Unterklasse, ein Talent mit eigener Wahl), wird eine Quelle und hängt
 * ihren Schritt dahinter an, sobald sie gewählt ist.
 *
 * Gearbeitet wird an einem **Entwurf**: einer Figur, die nur im Speicher
 * steht und dieselben Kanten trägt, die später gespeichert werden. Darum
 * rechnet dieselbe Funktion für die neue Figur und für den Stufenaufstieg —
 * dort ist der Entwurf die gespeicherte Figur mit einer Stufe mehr.
 */

import { ancestryLine, answerKey, answersOf, choiceSources, choicesAtCharacter, choicesOf, offeredOptions, type Choice, type ChoiceAtCharacter, type ChoiceRules } from './choices.js';
import { optionSlots } from './equipment.js';
import type { Entity, EntityId, Relation } from './types.js';

export type PickEdge = 'hasAncestry' | 'hasBackground' | 'hasClass';

export type BuilderStep =
  | {
      id: string;
      kind: 'pick';
      edge: PickEdge;
      type: 'Ancestry' | 'Background' | 'Class';
      /** Die Wahlen, die die gewählte Möglichkeit stellt — mit `nest` hier statt als eigene Schritte (T-193). */
      nested?: ChoiceAtCharacter[];
    }
  | { id: 'abilities'; kind: 'abilities' }
  | { id: 'level'; kind: 'level' }
  | { id: string; kind: 'choice'; at: ChoiceAtCharacter }
  | { id: 'equipment'; kind: 'equipment'; choices: ChoiceAtCharacter[] }
  | { id: 'details'; kind: 'details' };

/** Die Reihenfolge der Quellen: Abstammung, Hintergrund, Klasse, und was sie öffnen. */
const RANG: Record<string, number> = { hasAncestry: 0, hasBackground: 1, hasClass: 2, subclass: 3, grants: 4, chose: 5 };

/**
 * Der Schlüssel einer Wahl an einer Figur: `quelle#wahl`, bei einem
 * gewährten Merkmal mit der Gewährung (`quelle#wahl@von:stufe`, T-107).
 */
export const choiceKey = (c: ChoiceAtCharacter): string => answerKey(c.source.entity.id, c.choice.id, c.source.grant);

/**
 * **Was die gespeicherte Figur schon beantwortet hat** — als Schlüssel,
 * wie `choiceKey` sie bildet. Eine ältere Antwort ohne Gewährung zählt für
 * die Quelle, die sie liest. Eine Vorgabe (`assumed`) gilt als
 * beantwortet, sobald dieselbe Quelle eine gespeicherte Antwort hat — wer
 * auf Stufe 4 Attributspunkte genommen hat, hat die Steigerung gewählt.
 */
export function answeredKeys(character: Entity, byId: ReadonlyMap<EntityId, Entity>): Set<string> {
  const alle = choicesAtCharacter(character, byId);
  const quelle = (c: ChoiceAtCharacter) => answerKey(c.source.entity.id, '', c.source.grant);
  const mitAntwort = new Set(alle.filter((c) => c.relationId).map(quelle));
  return new Set(alle.filter((c) => c.relationId || (c.assumed && mitAntwort.has(quelle(c)))).map(choiceKey));
}

/**
 * **Die Schritte für diesen Entwurf.** `levelUp` beginnt mit der Stufe und
 * lässt aus, was die gespeicherte Figur schon beantwortet hat (`done`).
 * Eine Wahl ohne Spielraum (`fixed`) ist kein Schritt.
 *
 * **Die Ausrüstung ist ein Schritt** (T-096, REQ-250): welche Varianten
 * (a)/(b) gelten, hängt am Verfahren der Kampagne — wer Startgold nimmt,
 * wählt keine. Darum stehen die Ausrüstungswahlen einer neuen Figur nicht
 * je als Schritt da, sondern gesammelt im Schritt `equipment` vor dem
 * Namen.
 *
 * **Beim Aufstieg gibt es keine Startausrüstung** (T-162): eine
 * Ausrüstungswahl der ersten Klasse, die mit Startgold offen blieb, ist
 * dort kein Schritt — sie stand als „: equipment" mit rohen Verweisen da.
 *
 * **Eine Möglichkeit allein ist kein Schritt** (T-107): erlaubt die
 * Kampagne keine Talente (`rules.feats`), bleibt von „Steigerung oder
 * Talent" die Steigerung, und es gilt die Vorgabe der Wahl.
 */
export function builderSteps(
  draft: Entity,
  byId: ReadonlyMap<EntityId, Entity>,
  opts: { levelUp?: boolean; done?: ReadonlySet<string>; rules?: ChoiceRules; nest?: boolean } = {},
): BuilderStep[] {
  const alle = choicesAtCharacter(draft, byId);
  const einzig = (c: ChoiceAtCharacter) =>
    c.choice.kind === 'option' && !!c.picks && offeredOptions(c.choice, choicesOf(c.source.entity), opts.rules).length <= 1;
  const wurzel = opts.nest && !opts.levelUp ? choiceRoots(draft, byId) : new Map<string, PickEdge>();
  const offen = alle
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.fixed && !einzig(c) && !opts.done?.has(choiceKey(c)) && c.choice.kind !== 'equipment')
    .sort((a, z) => (RANG[a.c.source.via] ?? 9) - (RANG[z.c.source.via] ?? 9) || a.i - z.i)
    .map(({ c }) => c);
  const unter = (edge: PickEdge) => offen.filter((c) => wurzel.get(c.source.entity.id) === edge);
  const wahlen = offen
    .filter((c) => !wurzel.has(c.source.entity.id))
    .map((c): BuilderStep => ({ id: `choice:${choiceKey(c)}`, kind: 'choice', at: c }));
  if (opts.levelUp) return [{ id: 'level', kind: 'level' }, ...wahlen];
  const pick = (id: string, edge: PickEdge, type: 'Ancestry' | 'Background' | 'Class'): BuilderStep => {
    const nested = unter(edge);
    return { id, kind: 'pick', edge, type, ...(opts.nest ? { nested } : {}) };
  };
  return [
    pick('ancestry', 'hasAncestry', 'Ancestry'),
    pick('background', 'hasBackground', 'Background'),
    pick('class', 'hasClass', 'Class'),
    { id: 'abilities', kind: 'abilities' },
    ...wahlen,
    /* Das Feste fragt nur, wenn es eine offene Stelle hat (T-162):
       „one artisan's tools of your choice" in der Ausrüstung des Hintergrunds. */
    {
      id: 'equipment',
      kind: 'equipment',
      choices: alle.filter((c) => c.choice.kind === 'equipment' && (!c.fixed || (c.choice.from?.options ?? []).some((o) => optionSlots(o).length))),
    },
    { id: 'details', kind: 'details' },
  ];
}

/**
 * **Zu welcher Grundwahl eine Quelle gehört** (T-193): Abstammung (samt
 * Grundart), Hintergrund, Klasse — die Unterklasse und was eine davon
 * gewährt, gehören mit. Was die Figur selbst gewählt hat (`chose`: ein
 * Talent, das wieder fragt), gehört keiner und bleibt ein eigener Schritt.
 */
export function choiceRoots(draft: Entity, byId: ReadonlyMap<EntityId, Entity>): Map<EntityId, PickEdge> {
  const raus = new Map<EntityId, PickEdge>();
  for (const q of choiceSources(draft, byId)) {
    const w: PickEdge | undefined =
      q.via === 'hasAncestry' || q.via === 'hasBackground' || q.via === 'hasClass'
        ? q.via
        : q.via === 'subclass'
          ? 'hasClass'
          : q.via === 'grants' && q.grant
            ? raus.get(q.grant.by)
            : undefined;
    if (w && !raus.has(q.entity.id)) raus.set(q.entity.id, w);
  }
  return raus;
}

/**
 * **Was eine Möglichkeit bringt** (T-193): die Auswirkungen einer Herkunft,
 * eines Hintergrunds oder einer Klasse auf Stufe 1, so wie der Assistent
 * sie aufklappt und nebeneinanderstellt — gerechnet aus den Feldern und
 * Kanten, nicht aus dem Text. Eine Unterart liest ihre Grundart mit
 * (`ancestryLine`): Werte der Unterart gehen vor, Boni zählen zusammen,
 * Listen werden vereinigt. `features` sind die gewährten Merkmale bis
 * `level`, `choices` die Wahlen, die die Möglichkeit danach stellt (ohne
 * Ausrüstung und ohne den Mehrklassen-Einstieg).
 */
export interface OptionEffects {
  /** Die Möglichkeit, dann ihre Grundarten. */
  line: EntityId[];
  abilityBonus: Record<string, number>;
  abilityNote?: string;
  size: string[];
  speed?: string;
  darkvision?: number;
  creatureType?: string;
  resistances: string[];
  hitDie?: number;
  primaryAbility: string[];
  saves: string[];
  proficient: string[];
  expertise: string[];
  features: { id: EntityId; by: EntityId }[];
  choices: { by: EntityId; choice: Choice }[];
}

const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : []);

export function optionEffects(id: EntityId, byId: ReadonlyMap<EntityId, Entity>, level = 1): OptionEffects | null {
  if (!byId.has(id)) return null;
  const line = ancestryLine(id, byId);
  const raus: OptionEffects = {
    line,
    abilityBonus: {},
    size: [],
    resistances: [],
    primaryAbility: [],
    saves: [],
    proficient: [],
    expertise: [],
    features: [],
    choices: [],
  };
  const dazu = (ziel: string[], v: unknown) => {
    for (const x of liste(v)) if (!ziel.includes(x)) ziel.push(x);
  };
  for (const eid of line) {
    const e = byId.get(eid)!;
    const c = e.components ?? {};
    const a = c['Ancestry'] ?? {};
    const k = c['Class'] ?? {};
    const p = c['Proficiencies'] ?? {};
    const bonus = a['abilityBonus'];
    if (bonus && typeof bonus === 'object') {
      for (const [x, n] of Object.entries(bonus)) if (Number.isFinite(Number(n))) raus.abilityBonus[x] = (raus.abilityBonus[x] ?? 0) + Number(n);
    }
    if (typeof a['abilityNote'] === 'string' && a['abilityNote'] && !raus.abilityNote) raus.abilityNote = a['abilityNote'];
    if (!raus.size.length) dazu(raus.size, a['size']);
    if (raus.speed === undefined && typeof a['speed'] === 'string' && a['speed']) raus.speed = a['speed'];
    if (raus.darkvision === undefined && typeof a['darkvision'] === 'number') raus.darkvision = a['darkvision'];
    if (raus.creatureType === undefined && typeof a['creatureType'] === 'string' && a['creatureType']) raus.creatureType = a['creatureType'];
    dazu(raus.resistances, a['resistances']);
    if (raus.hitDie === undefined && typeof k['hitDie'] === 'number') raus.hitDie = k['hitDie'];
    dazu(raus.primaryAbility, k['primaryAbility']);
    dazu(raus.saves, p['saves']);
    dazu(raus.proficient, p['proficient']);
    dazu(raus.expertise, p['expertise']);
    for (const r of e.relations ?? []) {
      if (r.type !== 'grants' || (Number(r.props?.['level']) || 1) > level) continue;
      if (!raus.features.some((f) => f.id === r.to)) raus.features.push({ id: r.to, by: eid });
    }
    for (const ch of choicesOf(e)) {
      if ((ch.level ?? 1) > level || ch.when === 'multiclass' || ch.kind === 'equipment') continue;
      raus.choices.push({ by: eid, choice: ch });
    }
  }
  return raus;
}

let zaehler = 0;
const kantenId = (draft: Entity, type: string): string =>
  `${draft.id}~${type}-${Date.now().toString(36)}${(zaehler++).toString(36)}`;

/** Die eine Kante dieser Art setzen (Abstammung, Hintergrund, die erste Klasse). */
export function setPick(draft: Entity, edge: 'hasAncestry' | 'hasBackground' | 'hasClass', to: EntityId | null): Entity {
  const rel = [...(draft.relations ?? [])];
  const i = rel.findIndex((r) => r.type === edge);
  if (!to) {
    if (i >= 0) rel.splice(i, 1);
  } else if (i >= 0) {
    const alt = rel[i]!;
    /* Eine andere Klasse hat andere Unterklassen; die Stufe bleibt. */
    const props = edge === 'hasClass' ? { level: Number(alt.props?.['level']) || 1 } : {};
    rel[i] = { ...alt, to, props: alt.to === to ? (alt.props ?? {}) : props };
  } else {
    rel.push({ id: kantenId(draft, edge), type: edge, to, props: edge === 'hasClass' ? { level: 1 } : {} });
  }
  return { ...draft, relations: rel };
}

/** Die Stufe einer Klasse der Figur setzen; ohne Kante zu ihr kommt eine dazu (Mehrklassen). */
export function setClassLevel(draft: Entity, classId: EntityId, level: number): Entity {
  const rel = [...(draft.relations ?? [])];
  const i = rel.findIndex((r) => r.type === 'hasClass' && r.to === classId);
  if (i >= 0) rel[i] = { ...rel[i]!, props: { ...(rel[i]!.props ?? {}), level } };
  else rel.push({ id: kantenId(draft, 'hasClass'), type: 'hasClass', to: classId, props: { level } });
  return { ...draft, relations: rel };
}

/**
 * **Eine Wahl beantworten**: die Kante `chose` dieser Wahl setzen oder,
 * ohne Antwort, wegnehmen. Eine Unterklasse steht dazu an ihrer Klasse
 * (`hasClass.props.subclass`, C2) — dort liest sie jede andere Ansicht.
 * An einem gewährten Merkmal merkt sich die Antwort ihre Gewährung
 * (`props.by`, `props.level`, T-107).
 */
export function answerChoice(draft: Entity, at: ChoiceAtCharacter, picks: string[], items?: readonly string[]): Entity {
  const quelle = at.source.entity.id;
  const grant = at.source.grant;
  const schluessel = choiceKey(at);
  let rel: Relation[] = (draft.relations ?? []).filter((r) => {
    if (r.type !== 'chose') return true;
    if (r.id === at.relationId) return false;
    const a = answersOf({ ...draft, relations: [r] })[0];
    return !a || answerKey(a.source, a.choice, a.grant) !== schluessel;
  });
  if (picks.length) {
    rel.push({
      id: kantenId(draft, 'chose'),
      type: 'chose',
      to: quelle,
      props: {
        choice: at.choice.id,
        picks,
        ...(grant ? { by: grant.by, level: grant.level } : {}),
        /* Die Stücke der offenen Stellen (T-162); leer heisst keine. */
        ...(items?.some(Boolean) ? { items: [...items] } : {}),
      },
    });
  }
  if (at.choice.kind === 'subclass' && at.source.via === 'hasClass') {
    rel = rel.map((r) => {
      if (r.type !== 'hasClass' || r.to !== quelle) return r;
      const props = { ...(r.props ?? {}) };
      if (picks[0]) props['subclass'] = picks[0];
      else delete props['subclass'];
      return { ...r, props };
    });
  }
  return { ...draft, relations: rel };
}

/**
 * **Was niemand mehr fragt, fällt aus dem Entwurf** — wer die Klasse
 * wechselt, hat die Fertigkeiten der alten nicht gewählt. An einer
 * gespeicherten Figur bleibt eine verwaiste Antwort stehen
 * (`orphanAnswers`); im Entwurf ist sie bloss ein Rest der letzten Minute.
 * Mit leerem `byId` wird nichts geprüft.
 */
export function pruneAnswers(draft: Entity, byId: ReadonlyMap<EntityId, Entity>): Entity {
  if (!byId.size) return draft;
  const gelesen = new Set(choicesAtCharacter(draft, byId).flatMap((c) => (c.relationId ? [c.relationId] : [])));
  const rel = (draft.relations ?? []).filter((r) => r.type !== 'chose' || gelesen.has(r.id) || !choicesOf(byId.get(r.to)).length);
  return rel.length === (draft.relations ?? []).length ? draft : pruneAnswers({ ...draft, relations: rel }, byId);
}

/** Ein Merkmal, das eine Stufe bringt: der Artikel und wer es gewährt. */
export interface GainedFeature {
  id: EntityId;
  /** Die Klasse oder Unterklasse, die es gewährt (`grants` mit `props.level`). */
  source: EntityId;
  level: number;
}

/**
 * **Was die neue Stufe einer Klasse bringt** (T-095): die Merkmale, die die
 * Klasse und ihre Unterklasse genau auf dieser Stufe gewähren (`grants` mit
 * `props.level`, D50). Gerechnet aus den Artikeln wie die Wahlen — ein
 * Merkmal, das die Leitung einer Klasse dazulegt, steht beim nächsten
 * Aufstieg hier. Was davon selbst fragt (Fighting Style), steht ohnehin als
 * Schritt da (`choiceSources`).
 */
export function gainedFeatures(draft: Entity, byId: ReadonlyMap<EntityId, Entity>, classId: EntityId): GainedFeature[] {
  const kante = (draft.relations ?? []).find((r) => r.type === 'hasClass' && r.to === classId);
  if (!kante) return [];
  const stufe = Number(kante.props?.['level']) || 1;
  const quellen = [classId, ...(typeof kante.props?.['subclass'] === 'string' ? [kante.props['subclass']] : [])];
  const raus: GainedFeature[] = [];
  for (const q of quellen) {
    for (const r of byId.get(q)?.relations ?? []) {
      if (r.type !== 'grants' || (Number(r.props?.['level']) || 1) !== stufe) continue;
      if (!raus.some((f) => f.id === r.to)) raus.push({ id: r.to, source: q, level: stufe });
    }
  }
  return raus;
}

/**
 * **Die Sprachen der Kampagne** (REQ-251, T-095): `Campaign.languages`
 * nennt, welche Sprachen an diesem Tisch sinnvoll oder möglich sind — die
 * Namen von `Language`-Artikeln, wie eine Übung sie hält. Eine Sprachwahl
 * im Assistenten bietet dann nur diese an. Leer heisst: jede Sprache, die
 * im Stapel liegt.
 */
export function campaignLanguages(campaign: Entity | undefined): string[] {
  const roh = campaign?.components?.['Campaign']?.['languages'];
  return Array.isArray(roh) ? [...new Set(roh.filter((x): x is string => typeof x === 'string' && !!x.trim()))] : [];
}

/**
 * **Erlaubt die Kampagne Talente?** (T-107) `Campaign.feats`; ohne Angabe
 * ja. Nein nimmt das Talent als Ausweg einer Wahl weg (`offeredOptions`) —
 * Talente, die eine Klasse oder Herkunft selbst gewährt, bleiben.
 */
export function campaignAllowsFeats(campaign: Entity | undefined): boolean {
  return campaign?.components?.['Campaign']?.['feats'] !== false;
}
