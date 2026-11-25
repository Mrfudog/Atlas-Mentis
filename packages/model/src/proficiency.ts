/**
 * **Woher eine Übung kommt** (T-239): „hat X Übung in Y, und woher?" —
 * eine Frage, eine Funktion. Handwerk, Bogen, Waffen in der Hand und
 * „usable by" (T-180) lesen nur sie.
 *
 * Bis T-239 las jede Stelle nur `Proficiencies` am Statblock. Was Klasse,
 * Hintergrund, Herkunft und Talent fest gewähren (ihre eigene Karte
 * `Proficiencies`) und was die Figur gewählt hat (`chose`, REQ-238), kam
 * nirgends an: der Test-Barbar wählte Smith's tools beim Hintergrund
 * „Artisan" und galt im Handwerk als ungeübt. Gespeichert wird davon
 * nichts (D8) — eine andere Wahl, eine andere Klasse ändert die Übungen
 * beim nächsten Lesen.
 *
 * Die Quellen, jede mit ihrer Herkunft:
 * - der Statblock selbst (von Hand eingetragen; eine Instanz mit ihrer
 *   Vorlage darunter, `resolveInstance` — das macht der Aufrufer);
 * - die **erste** Klasse mit ihrer ganzen Karte, jede weitere nur mit
 *   `Class.multiclassProficient` (PHB: beim Einstieg als Mehrklasse gibt es
 *   weniger, und keine Rettungswürfe);
 * - Unterklasse, Herkunft (samt Grundart, `ancestryLine`), Hintergrund;
 * - was diese auf ihrer Stufe gewähren (`grants`) und gewählte Talente,
 *   eine Stufe tief und weiter, bis nichts Neues kommt;
 * - Wahlen der Sorte `proficiency` (`choicesAtCharacter`);
 * - Wirkungen `grant` auf `proficiency`, `expertise` oder `save` (ein
 *   Gegenstand, der Übung gibt, solange er wirkt, `effectsAt`).
 */

import { ancestryLine, choicesAtCharacter, choicesOf } from './choices.js';
import { effectsAt } from './effects.js';
import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

/** Die drei Listen von `Proficiencies`. */
export type ProficiencyKind = 'proficient' | 'expertise' | 'saves';

/** Eine Herkunft: welcher Artikel, auf welchem Weg. */
export interface ProficiencySource {
  /** Der Artikel, der sie bringt — Statblock, Klasse, Talent, Gegenstand. */
  id: EntityId;
  /**
   * `statblock` (von Hand), `hasClass`, `multiclass`, `subclass`,
   * `hasAncestry`, `hasBackground`, `grants`, `chose` (gewähltes Talent),
   * `choice` (eine Wahl dieses Artikels) oder `effect` (eine Wirkung).
   */
  via: string;
  /** Bei `choice`: die Id der Wahl. */
  choice?: string;
}

export interface ProficiencyEntry {
  /** Wie es dasteht — Name oder Kürzel (`str`, `martial`, `Smith's Tools`). */
  name: string;
  kind: ProficiencyKind;
  sources: ProficiencySource[];
}

export interface ProficiencyList {
  entries: ProficiencyEntry[];
  /**
   * Artikel, die die Rechnung nennt und `byId` nicht hält — wer sie holt
   * und neu rechnet, bekommt die Übungen, die an ihnen hängen.
   */
  missing: EntityId[];
}

const liste = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === 'string' && v.trim() ? [v.trim()] : [];

/**
 * Alle Übungen einer Figur mit Herkunft. `statblock` ist ihr Statblock,
 * schon aufgelöst; ohne einen bleibt, was Klasse und Wahlen bringen.
 */
export function proficienciesOf(character: Entity, statblock: Entity | undefined, byId: ReadonlyMap<EntityId, Entity>): ProficiencyList {
  const entries: ProficiencyEntry[] = [];
  const missing = new Set<EntityId>();
  const dazu = (name: string, kind: ProficiencyKind, source: ProficiencySource) => {
    const schluessel = name.toLowerCase();
    let e = entries.find((x) => x.kind === kind && x.name.toLowerCase() === schluessel);
    if (!e) entries.push((e = { name, kind, sources: [] }));
    if (!e.sources.some((s) => s.id === source.id && s.via === source.via && s.choice === source.choice)) e.sources.push(source);
  };
  const karte = (e: Entity, via: string, kinds: readonly ProficiencyKind[] = ['proficient', 'expertise', 'saves']) => {
    const p = e.components?.['Proficiencies'] ?? {};
    for (const k of kinds) for (const n of liste(p[k])) dazu(n, k, { id: e.id, via });
  };

  if (statblock) karte(statblock, 'statblock');

  /* Die Quellen mit ihrer Stufe, wie die Wahlen sie zählen. */
  const gesamt = (character.relations ?? []).reduce((n, r) => (r.type === 'hasClass' ? n + (Number(r.props?.['level']) || 1) : n), 0) || 1;
  const quellen: { e: Entity; level: number }[] = [];
  const gesehen = new Set<EntityId>();
  const hole = (id: unknown): Entity | undefined => {
    if (typeof id !== 'string' || !id) return undefined;
    const e = byId.get(id);
    if (!e) missing.add(id);
    return e;
  };
  const quelle = (id: unknown, level: number, via: string, kinds?: readonly ProficiencyKind[]) => {
    const e = hole(id);
    if (!e || gesehen.has(e.id)) return;
    gesehen.add(e.id);
    quellen.push({ e, level });
    karte(e, via, kinds);
  };
  let ersteKlasse = true;
  for (const r of character.relations ?? []) {
    if (r.type === 'hasClass') {
      const l = Number(r.props?.['level']) || 1;
      if (ersteKlasse) quelle(r.to, l, 'hasClass');
      else {
        const k = hole(r.to);
        if (k && !gesehen.has(k.id)) {
          gesehen.add(k.id);
          quellen.push({ e: k, level: l });
          for (const n of liste(k.components?.['Class']?.['multiclassProficient'])) dazu(n, 'proficient', { id: k.id, via: 'multiclass' });
        }
      }
      quelle(r.props?.['subclass'], l, 'subclass');
      ersteKlasse = false;
    } else if (r.type === 'hasAncestry') {
      if (!byId.has(r.to)) missing.add(r.to);
      for (const id of ancestryLine(r.to, byId)) quelle(id, gesamt, 'hasAncestry');
    } else if (r.type === 'hasBackground') quelle(r.to, gesamt, 'hasBackground');
  }
  /* Was sie gewähren, bis nichts Neues mehr kommt. Gewählte Talente
     kommen über ihre Antwort (`chose` mit einer Artikel-Id). */
  const antworten = (character.relations ?? []).filter((r) => r.type === 'chose');
  for (let i = 0; i < quellen.length; i++) {
    const q = quellen[i]!;
    for (const r of q.e.relations ?? []) {
      if (r.type === 'grants' && (Number(r.props?.['level']) || 1) <= q.level) quelle(r.to, gesamt, 'grants');
    }
    for (const a of antworten) {
      if (a.to !== q.e.id) continue;
      const picks = Array.isArray(a.props?.['picks']) ? (a.props['picks'] as unknown[]) : [];
      for (const p of picks) {
        /* Eine Antwort, die ein Name ist (Athletics), ist kein Artikel. */
        if (typeof p === 'string' && byId.has(p) && choicesOrCard(byId.get(p)!)) quelle(p, gesamt, 'chose');
      }
    }
  }

  /* Die Wahlen. Eine Wahl, deren Id oder Satz Expertise nennt, gibt
     Expertise — eine eigene Sorte gibt es dafür nicht. */
  for (const at of choicesAtCharacter(character, byId)) {
    if ((at.choice.kind ?? 'proficiency') !== 'proficiency' || !at.picks?.length) continue;
    const kind: ProficiencyKind = /expertise/i.test(`${at.choice.id} ${at.choice.note ?? ''}`) ? 'expertise' : 'proficient';
    for (const p of at.picks.slice(0, at.choice.count ?? 1)) {
      /* Eine Wahl aus Artikeln hält Ids: gezählt wird der Name. */
      const name = byId.has(p) ? entityName(byId.get(p)) : p;
      dazu(name, kind, { id: at.source.entity.id, via: 'choice', choice: at.choice.id });
    }
  }

  for (const { effect, source } of effectsAt(character, byId, statblock ? { statblock } : {})) {
    if (effect.op !== 'grant' || effect.value === undefined || effect.value === '') continue;
    const kind: ProficiencyKind | null = effect.target === 'proficiency' ? 'proficient' : effect.target === 'expertise' ? 'expertise' : effect.target === 'saveProficiency' ? 'saves' : null;
    if (kind) dazu(String(effect.value), kind, { id: source, via: 'effect' });
  }

  return { entries, missing: [...missing] };
}

/** Bringt ein gewählter Artikel etwas mit — eine Karte oder eigene Wahlen? */
function choicesOrCard(e: Entity): boolean {
  return !!e.components?.['Proficiencies'] || choicesOf(e).length > 0 || (e.relations ?? []).some((r) => r.type === 'grants');
}

/**
 * **Ist die Figur darin geübt?** Gross und klein egal, Expertise zählt als
 * Übung; die Mehrzahl auch (`shield` und `shields`). Rettungswürfe fragt
 * man mit `kind: 'saves'`.
 */
export function hasProficiency(list: ProficiencyList | readonly ProficiencyEntry[], name: string, kind: 'proficient' | 'saves' = 'proficient'): boolean {
  return !!proficiencyEntry(list, name, kind);
}

/** Der Eintrag zu einem Namen — mit seinen Herkünften. */
export function proficiencyEntry(
  list: ProficiencyList | readonly ProficiencyEntry[],
  name: string,
  kind: 'proficient' | 'saves' = 'proficient',
): ProficiencyEntry | undefined {
  const entries: readonly ProficiencyEntry[] = Array.isArray(list) ? list : (list as ProficiencyList).entries;
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const gleich = (x: string) => {
    const y = x.toLowerCase();
    return y === n || y === `${n}s` || `${y}s` === n;
  };
  const arten: ProficiencyKind[] = kind === 'saves' ? ['saves'] : ['expertise', 'proficient'];
  for (const k of arten) {
    const e = entries.find((x) => x.kind === k && gleich(x.name));
    if (e) return e;
  }
  return undefined;
}

/**
 * Die Namen einer Sorte; ohne Angabe Übung samt Expertise — was die alten
 * Leser aus `proficient` und `expertise` zusammenzogen.
 */
export function proficiencyNames(list: ProficiencyList | readonly ProficiencyEntry[], kind?: ProficiencyKind): string[] {
  const entries: readonly ProficiencyEntry[] = Array.isArray(list) ? list : (list as ProficiencyList).entries;
  const raus: string[] = [];
  for (const e of entries) {
    if (kind ? e.kind !== kind : e.kind === 'saves') continue;
    if (!raus.some((x) => x.toLowerCase() === e.name.toLowerCase())) raus.push(e.name);
  }
  return raus;
}

/** Die Herkunft in Worten, ohne den Namen des Artikels: „class", „chosen at". */
export function proficiencyVia(s: ProficiencySource): string {
  switch (s.via) {
    case 'statblock':
      return 'by hand';
    case 'hasClass':
      return 'class';
    case 'multiclass':
      return 'multiclass';
    case 'subclass':
      return 'subclass';
    case 'hasAncestry':
      return 'origin';
    case 'hasBackground':
      return 'background';
    case 'grants':
      return 'feature';
    case 'chose':
      return 'feat';
    case 'choice':
      return 'choice';
    case 'effect':
    case 'holds':
      return 'item';
    case 'equips':
      return 'equipped';
    case 'condition':
      return 'condition';
    default:
      return s.via;
  }
}
