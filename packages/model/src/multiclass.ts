/**
 * **Stufen je Klasse und Mehrklassen** (T-319). Die Leitung (20.10.): „Es
 * sollte je Klasse möglich sein, die Stufe zu erhöhen und daraus die
 * Entscheide zu treffen. Es benötigt kein separates Level-up, sondern nur
 * den Character Creator." Der Assistent stellt darum im Klassen-Schritt
 * jede Klasse der Figur mit ihrer Stufe dar; was eine neue Stufe fragt,
 * sind Schritte wie jede andere Wahl (`builderSteps`), und die Treffer-
 * punkte je Stufe ebenso (T-194).
 *
 * Mehrklassen nach D&D (PHB, „Multiclassing"): eine weitere Klasse nimmt
 * nur, wer die Mindestwerte **jeder** bisherigen Klasse **und** der neuen
 * erfüllt (`Class.multiclassRequirement`, „INT 13", „STR 13 or DEX 13",
 * „STR 13, CHA 13"). Was der Einstieg an Übungen bringt
 * (`Class.multiclassProficient`, T-239) und welche Wahlen nur für die erste
 * oder nur für eine weitere Klasse gelten (`when`, T-107), rechnen andere
 * Stellen schon. Gespeichert wird nur die Kante `hasClass` mit der Stufe.
 */

import { pruneAnswers, setClassLevel } from './builder.js';
import { characterLevel } from './choices.js';
import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

/** Eine Bedingung der Voraussetzung: ein Attribut mit Mindestwert. */
export interface AbilityMinimum {
  ability: string;
  min: number;
}

/**
 * **Die Voraussetzung als Bedingungen**: Kommas trennen, was alles gelten
 * muss, „or" was eines davon genügt. `[[STR 13], [CHA 13]]` heisst beides,
 * `[[STR 13, DEX 13]]` eines. Unlesbares fällt weg (dann gilt nichts).
 */
export function parseMulticlassRequirement(text: unknown): AbilityMinimum[][] {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text
    .split(/,|\band\b/i)
    .map((teil) =>
      teil
        .split(/\bor\b/i)
        .map((x) => /\b(str|dex|con|int|wis|cha)\w*\s*(\d+)/i.exec(x.trim()))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => ({ ability: m[1]!.toLowerCase(), min: Number(m[2]) })),
    )
    .filter((g) => g.length);
}

/** Ist die Voraussetzung mit diesen Werten erfüllt? Sonst der Satz, was fehlt. */
export function multiclassUnmet(text: unknown, scores: Readonly<Record<string, number | undefined>>): string | null {
  const offen = parseMulticlassRequirement(text).filter((g) => !g.some((b) => (scores[b.ability] ?? 0) >= b.min));
  return offen.length ? offen.map((g) => g.map((b) => `${b.ability.toUpperCase()} ${b.min}`).join(' or ')).join(', ') : null;
}

const voraussetzung = (e: Entity | undefined): unknown => e?.components?.['Class']?.['multiclassRequirement'];

/**
 * **Darf diese Klasse dazukommen?** `null`, wenn ja; sonst der Grund — die
 * eigene Voraussetzung oder die einer Klasse, die die Figur schon hat.
 * Die erste Klasse hat keine Voraussetzung.
 */
export function canAddClass(
  draft: Entity,
  classId: EntityId,
  byId: ReadonlyMap<EntityId, Entity>,
  scores: Readonly<Record<string, number | undefined>>,
): string | null {
  const klassen = (draft.relations ?? []).filter((r) => r.type === 'hasClass');
  if (klassen.some((r) => r.to === classId)) return 'already taken';
  if (!klassen.length) return null;
  if (characterLevel(draft) >= 20) return 'already level 20';
  const neu = multiclassUnmet(voraussetzung(byId.get(classId)), scores);
  if (neu) return `needs ${neu}`;
  for (const r of klassen) {
    const alt = multiclassUnmet(voraussetzung(byId.get(r.to)), scores);
    if (alt) return `${entityName(byId.get(r.to)) || 'your class'} needs ${alt}`;
  }
  return null;
}

/** Je Klasse der Figur: Stufe, ob sie steigen oder sinken darf. */
export interface ClassLevelRow {
  id: EntityId;
  level: number;
  /** Die erste Klasse — sie bleibt, mit mindestens Stufe 1. */
  first: boolean;
  canRaise: boolean;
  canLower: boolean;
}

export function classLevelRows(draft: Entity): ClassLevelRow[] {
  const gesamt = characterLevel(draft);
  const klassen = (draft.relations ?? []).filter((r) => r.type === 'hasClass');
  return klassen.map((r, i) => {
    const level = Number(r.props?.['level']) || 1;
    return { id: r.to, level, first: i === 0, canRaise: gesamt < 20, canLower: level > 1 || i > 0 };
  });
}

/**
 * **Eine Klasse um eine Stufe ändern**: `+1` oder `-1`; unter 1 geht eine
 * weitere Klasse ganz weg. Antworten auf Wahlen, die danach nicht mehr
 * gelten, gehen mit (`pruneAnswers`). Die erste Klasse bleibt.
 */
export function changeClassLevel(draft: Entity, classId: EntityId, delta: 1 | -1, byId: ReadonlyMap<EntityId, Entity>): Entity {
  const zeile = classLevelRows(draft).find((z) => z.id === classId);
  if (!zeile) return delta > 0 && characterLevel(draft) < 20 ? setClassLevel(draft, classId, 1) : draft;
  if (delta > 0) return zeile.canRaise ? setClassLevel(draft, classId, zeile.level + 1) : draft;
  if (!zeile.canLower) return draft;
  /* Was die weggenommene Stufe fragte, geht mit (der Entwurf, nicht die gespeicherte Figur). */
  if (zeile.level > 1) return pruneAnswers(setClassLevel(draft, classId, zeile.level - 1), byId);
  const ohne = { ...draft, relations: (draft.relations ?? []).filter((r) => !(r.type === 'hasClass' && r.to === classId)) };
  return pruneAnswers(ohne, byId);
}
