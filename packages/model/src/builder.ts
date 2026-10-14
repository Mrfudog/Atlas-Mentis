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

import { answerKey, answersOf, choicesAtCharacter, choicesOf, offeredOptions, type ChoiceAtCharacter, type ChoiceRules } from './choices.js';
import type { Entity, EntityId, Relation } from './types.js';

export type BuilderStep =
  | { id: string; kind: 'pick'; edge: 'hasAncestry' | 'hasBackground' | 'hasClass'; type: 'Ancestry' | 'Background' | 'Class' }
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
  opts: { levelUp?: boolean; done?: ReadonlySet<string>; rules?: ChoiceRules } = {},
): BuilderStep[] {
  const alle = choicesAtCharacter(draft, byId);
  const einzig = (c: ChoiceAtCharacter) =>
    c.choice.kind === 'option' && !!c.picks && offeredOptions(c.choice, choicesOf(c.source.entity), opts.rules).length <= 1;
  const wahlen = alle
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.fixed && !einzig(c) && !opts.done?.has(choiceKey(c)) && c.choice.kind !== 'equipment')
    .sort((a, z) => (RANG[a.c.source.via] ?? 9) - (RANG[z.c.source.via] ?? 9) || a.i - z.i)
    .map(({ c }): BuilderStep => ({ id: `choice:${choiceKey(c)}`, kind: 'choice', at: c }));
  if (opts.levelUp) return [{ id: 'level', kind: 'level' }, ...wahlen];
  return [
    { id: 'ancestry', kind: 'pick', edge: 'hasAncestry', type: 'Ancestry' },
    { id: 'background', kind: 'pick', edge: 'hasBackground', type: 'Background' },
    { id: 'class', kind: 'pick', edge: 'hasClass', type: 'Class' },
    { id: 'abilities', kind: 'abilities' },
    ...wahlen,
    { id: 'equipment', kind: 'equipment', choices: alle.filter((c) => c.choice.kind === 'equipment' && !c.fixed) },
    { id: 'details', kind: 'details' },
  ];
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
