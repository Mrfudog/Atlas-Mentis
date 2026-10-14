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

import { choicesAtCharacter, choicesOf, type ChoiceAtCharacter } from './choices.js';
import type { Entity, EntityId, Relation } from './types.js';

export type BuilderStep =
  | { id: string; kind: 'pick'; edge: 'hasAncestry' | 'hasBackground' | 'hasClass'; type: 'Ancestry' | 'Background' | 'Class' }
  | { id: 'abilities'; kind: 'abilities' }
  | { id: 'level'; kind: 'level' }
  | { id: string; kind: 'choice'; at: ChoiceAtCharacter }
  | { id: 'details'; kind: 'details' };

/** Die Reihenfolge der Quellen: Abstammung, Hintergrund, Klasse, und was sie öffnen. */
const RANG: Record<string, number> = { hasAncestry: 0, hasBackground: 1, hasClass: 2, subclass: 3, grants: 4, chose: 5 };

/** Der Schlüssel einer Wahl an einer Figur: `quelle#wahl`. */
export const choiceKey = (c: ChoiceAtCharacter): string => `${c.source.entity.id}#${c.choice.id}`;

/**
 * **Die Schritte für diesen Entwurf.** `levelUp` beginnt mit der Stufe und
 * lässt aus, was die gespeicherte Figur schon beantwortet hat (`done`).
 * Eine Wahl ohne Spielraum (`fixed`) ist kein Schritt.
 */
export function builderSteps(
  draft: Entity,
  byId: ReadonlyMap<EntityId, Entity>,
  opts: { levelUp?: boolean; done?: ReadonlySet<string> } = {},
): BuilderStep[] {
  const wahlen = choicesAtCharacter(draft, byId)
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.fixed && !opts.done?.has(choiceKey(c)))
    .sort((a, z) => (RANG[a.c.source.via] ?? 9) - (RANG[z.c.source.via] ?? 9) || a.i - z.i)
    .map(({ c }): BuilderStep => ({ id: `choice:${choiceKey(c)}`, kind: 'choice', at: c }));
  if (opts.levelUp) return [{ id: 'level', kind: 'level' }, ...wahlen];
  return [
    { id: 'ancestry', kind: 'pick', edge: 'hasAncestry', type: 'Ancestry' },
    { id: 'background', kind: 'pick', edge: 'hasBackground', type: 'Background' },
    { id: 'class', kind: 'pick', edge: 'hasClass', type: 'Class' },
    { id: 'abilities', kind: 'abilities' },
    ...wahlen,
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
 */
export function answerChoice(draft: Entity, at: ChoiceAtCharacter, picks: string[]): Entity {
  const quelle = at.source.entity.id;
  let rel: Relation[] = (draft.relations ?? []).filter(
    (r) => !(r.type === 'chose' && r.to === quelle && r.props?.['choice'] === at.choice.id),
  );
  if (picks.length) {
    rel.push({ id: kantenId(draft, 'chose'), type: 'chose', to: quelle, props: { choice: at.choice.id, picks } });
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
  const offen = new Set(choicesAtCharacter(draft, byId).map(choiceKey));
  const rel = (draft.relations ?? []).filter(
    (r) => r.type !== 'chose' || offen.has(`${r.to}#${String(r.props?.['choice'] ?? '')}`) || !choicesOf(byId.get(r.to)).length,
  );
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
