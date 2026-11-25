/**
 * **Was die Figur schon hat, wählt sie nicht noch einmal** (T-299). Die
 * Leitung (19.10.): im Assistenten liess sich eine Fertigkeit oder Sprache
 * ein zweites Mal wählen, die ein früherer Schritt schon gab.
 *
 * „Früher" ist die Reihenfolge des Assistenten: Herkunft, Hintergrund,
 * Klasse (samt Unterklasse), dann was diese gewähren und gewählte Talente.
 * Was eine Quelle **fest** gibt (ihre Karte `Proficiencies`, ein gewährtes
 * Talent), ist für jede Wahl schon da — wer es wählt, wählt nichts.
 *
 * Gesperrt wird je Sorte:
 * - `proficiency`: Namen aus `Proficiencies.proficient` (Fertigkeiten,
 *   Werkzeuge, Sprachen, Waffen- und Rüstungsarten — eine Liste). Eine Wahl
 *   der Expertise sperrt nur gegen Expertise; sie verlangt die Übung ja.
 * - `feat`: Talente ohne `Feat.repeatable`.
 * - `spell` (T-309): Zauber nach Namen — was eine Quelle fest wirkt
 *   (`casts`) und was eine frühere Wahl nahm.
 *
 * Gespeichert wird davon nichts (D8). Ändert jemand eine frühere Wahl, wird
 * die spätere nicht still geleert, sondern als Doppelung gemeldet
 * (`choiceDuplicates`); der Server weist eine **neue** Doppelung ab
 * (`newChoiceDuplicates`), eine alte bleibt, wie sie war.
 *
 * Die Regel (2024, „choose another"): gibt eine Quelle fest, was schon
 * gewählt ist, darf die Wahl ersetzt werden — darum heisst die Meldung
 * dann nicht „schon gewählt", sondern „wähle eine andere" (`fixed`).
 *
 * **Expertise verlangt die Übung** (T-303): eine Wahl der Expertise bietet
 * nur an, worin die Figur bis zu diesem Schritt geübt ist — fest gegeben
 * (auch am Statblock oder durch eine Wirkung) oder in einer Wahl davor,
 * derselbe Schritt eingeschlossen (Skill Expert: erst die Übung, dann die
 * Expertise). Sagt die Wahl `needsProficiency: false`, ist sie frei.
 */

import { CHOICE_SOURCE_ORDER as RANG, choiceKey } from './builder.js';
import { choicesAtCharacter, type ChoiceAtCharacter } from './choices.js';
import { entityName } from './entity.js';
import { proficienciesOf } from './proficiency.js';
import { spellcastingOf } from './spellcasting.js';
import type { Entity, EntityId } from './types.js';

/** Was schon da ist, und woher. */
export interface HeldValue {
  /** Wie es dasteht: der Name, bei einem Talent die Id. */
  value: string;
  /** Für die Anzeige: „Background (Sage)". */
  from: string;
  /** Der Artikel, der es bringt. */
  source: EntityId;
  /** Fest gegeben (keine Wahl) — dann gilt „wähle eine andere". */
  fixed: boolean;
  /** Aus einer Wahl: deren Schlüssel (`choiceKey`). */
  choice?: string;
}

/** Eine Antwort, die schon Gehabtes noch einmal nimmt. */
export interface ChoiceDuplicate {
  /** Die Wahl mit der Doppelung (`choiceKey`). */
  choice: string;
  pick: string;
  held: HeldValue;
}

/** Die Sorten, in denen gesperrt wird. */
type Sorte = 'proficient' | 'expertise' | 'feat' | 'spell';

const WEG: Record<string, string> = {
  hasAncestry: 'Ancestry',
  hasBackground: 'Background',
  hasClass: 'Class',
  multiclass: 'Class',
  subclass: 'Subclass',
  grants: 'Feature',
  chose: 'Feat',
};

const norm = (s: string) => s.trim().toLowerCase();

/** Die Sorte einer Wahl, oder `null`, wenn dort nichts gesperrt wird. */
function sorteVon(at: ChoiceAtCharacter): Sorte | null {
  const k = at.choice.kind ?? 'proficiency';
  if (k === 'feat') return 'feat';
  /* Zauber nach Namen (T-309): derselbe Zauber aus einem anderen Buch ist derselbe. */
  if (k === 'spell') return 'spell';
  if (k !== 'proficiency') return null;
  return /expertise/i.test(`${at.choice.id} ${at.choice.note ?? ''}`) ? 'expertise' : 'proficient';
}

/** Darf dieses Talent mehrmals genommen werden? */
const wiederholbar = (e: Entity | undefined) => e?.components?.['Feat']?.['repeatable'] === true;

/** Ist der Artikel ein Talent? (Die Art oder ihr erster Obertyp heisst so.) */
const istTalent = (e: Entity | undefined) => !!e && (e.interfaces ?? []).includes('Feat');

/** Der Wert, unter dem eine Antwort zählt: bei Übungen der Name, bei Talenten die Id. */
function wertVon(pick: string, sorte: Sorte, byId: ReadonlyMap<EntityId, Entity>): string {
  if (sorte === 'feat') return pick;
  return byId.has(pick) ? entityName(byId.get(pick)) : pick;
}

/** Die Wahlen in der Reihenfolge des Assistenten (stabil innerhalb eines Rangs). */
function geordnet(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAtCharacter[] {
  return choicesAtCharacter(character, byId)
    .map((at, i) => ({ at, i }))
    .sort((a, b) => (RANG[a.at.source.via] ?? 9) - (RANG[b.at.source.via] ?? 9) || a.i - b.i)
    .map((x) => x.at);
}

/** Was fest da ist, je Sorte: Name (klein) → Herkunft. */
function festes(character: Entity, byId: ReadonlyMap<EntityId, Entity>): Record<Sorte, Map<string, HeldValue>> {
  const raus: Record<Sorte, Map<string, HeldValue>> = { proficient: new Map(), expertise: new Map(), feat: new Map(), spell: new Map() };
  const herkunft = (id: EntityId, via: string) => `${WEG[via] ?? 'Feature'} (${entityName(byId.get(id)) || id})`;
  for (const e of proficienciesOf(character, undefined, byId).entries) {
    if (e.kind === 'saves') continue;
    const s = e.sources.find((q) => q.via !== 'choice' && q.via !== 'effect' && q.via !== 'statblock');
    if (!s) continue;
    const ziel = raus[e.kind];
    if (!ziel.has(norm(e.name))) ziel.set(norm(e.name), { value: e.name, from: herkunft(s.id, s.via), source: s.id, fixed: true });
    /* Expertise schliesst die Übung ein. */
    if (e.kind === 'expertise' && !raus.proficient.has(norm(e.name))) {
      raus.proficient.set(norm(e.name), { value: e.name, from: herkunft(s.id, s.via), source: s.id, fixed: true });
    }
  }
  /* Zauber, die eine Quelle fest bringt (`casts`, T-309) — nicht, was gewählt ist. */
  for (const z of spellcastingOf(character, undefined, byId).spells) {
    if (z.choice || z.via === 'character' || z.via === 'statblock' || z.via === 'holds') continue;
    const name = entityName(byId.get(z.spell)) || z.spell;
    if (!raus.spell.has(norm(name))) raus.spell.set(norm(name), { value: name, from: herkunft(z.source, z.via), source: z.source, fixed: true });
  }
  /* Talente, die eine Quelle fest gewährt: dieselben Quellen wie die Wahlen. */
  const quellen = new Map<EntityId, string>();
  for (const at of choicesAtCharacter(character, byId)) quellen.set(at.source.entity.id, at.source.via);
  for (const r of character.relations ?? []) {
    if (r.type === 'hasClass' || r.type === 'hasBackground' || r.type === 'hasAncestry') quellen.set(r.to, r.type);
  }
  for (const [id, via] of quellen) {
    for (const r of byId.get(id)?.relations ?? []) {
      if (r.type !== 'grants') continue;
      const t = byId.get(r.to);
      if (istTalent(t) && !wiederholbar(t) && !raus.feat.has(norm(r.to))) {
        raus.feat.set(norm(r.to), { value: r.to, from: herkunft(id, via), source: id, fixed: true });
      }
    }
  }
  return raus;
}

/**
 * **Was für diese Wahl schon da ist**: alles fest Gegebene und die
 * Antworten der Wahlen davor, je Name (klein) — bei Talenten je Id. Leer
 * für eine Wahl, in der nicht gesperrt wird (Attribute, Ausrüstung …).
 */
export function heldBefore(character: Entity, byId: ReadonlyMap<EntityId, Entity>, at: ChoiceAtCharacter): Map<string, HeldValue> {
  const sorte = sorteVon(at);
  if (!sorte) return new Map();
  const raus = new Map(festes(character, byId)[sorte]);
  const eigen = choiceKey(at);
  for (const vor of geordnet(character, byId)) {
    const k = choiceKey(vor);
    if (k === eigen) break;
    if (!vor.picks?.length) continue;
    const s = sorteVon(vor);
    /* Eine Übung zählt für die Expertise nicht, Expertise für die Übung schon. */
    if (!s || (s !== sorte && !(sorte === 'proficient' && s === 'expertise'))) continue;
    for (const p of vor.picks.slice(0, vor.choice.count ?? 1)) {
      const wert = wertVon(p, sorte, byId);
      if (sorte === 'feat' && wiederholbar(byId.get(p))) continue;
      if (raus.has(norm(wert))) continue;
      raus.set(norm(wert), {
        value: wert,
        from: `${WEG[vor.source.via] ?? 'Feature'} (${entityName(vor.source.entity) || vor.source.entity.id})`,
        source: vor.source.entity.id,
        fixed: false,
        choice: k,
      });
    }
  }
  return raus;
}

/** Ist dieser Wert für diese Wahl schon da? Liefert die Herkunft. */
export function heldValue(held: ReadonlyMap<string, HeldValue>, pick: string, byId: ReadonlyMap<EntityId, Entity>): HeldValue | undefined {
  const name = byId.has(pick) && !istTalent(byId.get(pick)) ? entityName(byId.get(pick)) : pick;
  return held.get(norm(name));
}

/** **Jede Doppelung an der Figur** — Antworten, die Gehabtes noch einmal nehmen. */
export function choiceDuplicates(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceDuplicate[] {
  const raus: ChoiceDuplicate[] = [];
  for (const at of geordnet(character, byId)) {
    /* Was von selbst beantwortet ist, hat niemand gewählt. */
    if (!at.picks?.length || at.fixed || at.assumed || !sorteVon(at)) continue;
    const held = heldBefore(character, byId, at);
    for (const p of at.picks.slice(0, at.choice.count ?? 1)) {
      const h = heldValue(held, p, byId);
      if (h) raus.push({ choice: choiceKey(at), pick: p, held: h });
    }
  }
  return raus;
}

/**
 * **Die neuen Doppelungen** — was der Server beim Speichern abweist. Was
 * schon vorher doppelt stand, bleibt stehen: eine ältere Figur soll sich
 * weiter speichern lassen, und still geleert wird nichts.
 */
export function newChoiceDuplicates(before: Entity | undefined, after: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceDuplicate[] {
  if (!(after.relations ?? []).some((r) => r.type === 'chose')) return [];
  const alt = new Set(before ? choiceDuplicates(before, byId).map((d) => `${d.choice}|${norm(d.pick)}`) : []);
  return choiceDuplicates(after, byId).filter((d) => !alt.has(`${d.choice}|${norm(d.pick)}`));
}

/** Für Meldungen: „Athletics — already from Background (Sage)". */
export function duplicateText(d: ChoiceDuplicate, byId: ReadonlyMap<EntityId, Entity>): string {
  const name = byId.has(d.pick) ? entityName(byId.get(d.pick)) : d.pick;
  return d.held.fixed
    ? `${name} already comes from ${d.held.from} — by the rules, choose another one instead.`
    : `${name} is already chosen at ${d.held.from}.`;
}

/** Eine Expertise auf etwas, worin die Figur nicht geübt ist (T-303). */
export interface MissingProficiency {
  /** Die Wahl (`choiceKey`). */
  choice: string;
  pick: string;
}

/** Verlangt diese Wahl die Übung? Nur Expertise, und nur ohne `needsProficiency: false`. */
const verlangtUebung = (at: ChoiceAtCharacter) => sorteVon(at) === 'expertise' && at.choice.needsProficiency !== false;

/**
 * **Worin die Figur vor dieser Wahl geübt ist** (T-303) — `null`, wenn die
 * Wahl keine Übung verlangt. Fest Gegebenes zählt mit jeder Herkunft (auch
 * Statblock und Wirkung); dazu die Antworten der Wahlen davor, Übung wie
 * Expertise, derselbe Schritt eingeschlossen.
 */
export function proficientBefore(character: Entity, byId: ReadonlyMap<EntityId, Entity>, at: ChoiceAtCharacter): Map<string, HeldValue> | null {
  if (!verlangtUebung(at)) return null;
  const raus = new Map<string, HeldValue>();
  for (const e of proficienciesOf(character, undefined, byId).entries) {
    if (e.kind === 'saves') continue;
    const s = e.sources.find((q) => q.via !== 'choice');
    if (!s || raus.has(norm(e.name))) continue;
    raus.set(norm(e.name), { value: e.name, from: `${WEG[s.via] ?? (s.via === 'statblock' ? 'Statblock' : 'Feature')} (${entityName(byId.get(s.id)) || s.id})`, source: s.id, fixed: true });
  }
  const eigen = choiceKey(at);
  for (const vor of geordnet(character, byId)) {
    const k = choiceKey(vor);
    if (k === eigen) break;
    if (!vor.picks?.length) continue;
    const s = sorteVon(vor);
    if (s !== 'proficient' && s !== 'expertise') continue;
    for (const p of vor.picks.slice(0, vor.choice.count ?? 1)) {
      const wert = wertVon(p, s, byId);
      if (raus.has(norm(wert))) continue;
      raus.set(norm(wert), {
        value: wert,
        from: `${WEG[vor.source.via] ?? 'Feature'} (${entityName(vor.source.entity) || vor.source.entity.id})`,
        source: vor.source.entity.id,
        fixed: false,
        choice: k,
      });
    }
  }
  return raus;
}

/** **Jede Expertise ohne Übung an der Figur** (T-303). */
export function missingProficiencies(character: Entity, byId: ReadonlyMap<EntityId, Entity>): MissingProficiency[] {
  const raus: MissingProficiency[] = [];
  for (const at of geordnet(character, byId)) {
    if (!at.picks?.length || at.fixed || at.assumed) continue;
    const geuebt = proficientBefore(character, byId, at);
    if (!geuebt) continue;
    for (const p of at.picks.slice(0, at.choice.count ?? 1)) {
      if (!heldValue(geuebt, p, byId)) raus.push({ choice: choiceKey(at), pick: p });
    }
  }
  return raus;
}

/** **Die neuen** — was der Server abweist; was vorher schon so stand, bleibt (wie `newChoiceDuplicates`). */
export function newMissingProficiencies(before: Entity | undefined, after: Entity, byId: ReadonlyMap<EntityId, Entity>): MissingProficiency[] {
  if (!(after.relations ?? []).some((r) => r.type === 'chose')) return [];
  const alt = new Set(before ? missingProficiencies(before, byId).map((m) => `${m.choice}|${norm(m.pick)}`) : []);
  return missingProficiencies(after, byId).filter((m) => !alt.has(`${m.choice}|${norm(m.pick)}`));
}

/** Für Meldungen: „History — expertise needs proficiency, and the character is not proficient in it yet." */
export function missingText(m: MissingProficiency, byId: ReadonlyMap<EntityId, Entity>): string {
  const name = byId.has(m.pick) ? entityName(byId.get(m.pick)) : m.pick;
  return `${name}: expertise needs proficiency, and the character is not proficient in it yet — choose a skill or tool they are proficient in.`;
}
