/**
 * **Woher eine Figur zaubert** (T-309): aus ihren Quellen, gerechnet beim
 * Lesen (D8). Die Leitung (19.10.): „casts sollte über die Klasse und deren
 * Features oder andere Features (Ancestry, Item etc.) hinzukommen" — nicht
 * von Hand an die Figur geschrieben werden.
 *
 * Bis T-309 lasen Kopf und Reiter „Spells“ (T-246) nur, was am Statblock
 * von Hand stand (`Statblock.spellAbility`, `spellSlots`) und die Kanten
 * `casts` an Figur und Statblock. Ein Magier aus dem Assistenten hatte
 * beides nicht und zauberte also nicht, obwohl seine Klasse
 * `spellAbility: int` und `casterProgression: full` trägt.
 *
 * Die Quellen, jede mit ihrem Attribut — **das Regelwerk sagt, welcher
 * Zauber über welches Attribut läuft** (D&D: je Quelle):
 * - je Klasse der Figur (`hasClass`) ihre Unterklasse und sie selbst:
 *   Attribut `spellAbility` (die Unterklasse vor der Klasse — der Eldritch
 *   Knight zaubert, der Kämpfer nicht), Plätze aus `casterProgression`
 *   und der Klassenstufe;
 * - Herkunft (samt Grundart), Hintergrund, gewählte und gewährte Talente
 *   und Merkmale (`grants` auf ihrer Stufe): ihre Kanten `casts`, ab
 *   `fromLevel` — das Attribut nennt die Kante (`props.ability`), sonst die
 *   Quelle;
 * - Wahlen der Sorte `spell` (`chose`): der gewählte Zauber mit der Quelle,
 *   die fragt, und deren Attribut (`Choice.ability` vor der Quelle);
 * - Gegenstände, die die Figur trägt (eingestimmt, wo sie es verlangen):
 *   ihre `casts` mit `mode: 'item'`, ohne Attribut — ein Zauberstab hat
 *   seinen eigenen SG;
 * - was von Hand an Figur und Statblock steht (`casts`), wie bisher.
 *
 * **Was am Statblock steht, geht vor**: `spellAbility` und `spellSlots`
 * dort sind eine Festlegung (eine NSC-Vorlage, eine Hausregel).
 *
 * Ein eigenes System (T-310, à la DC20: die Spielerin wählt ein Hauptattribut
 * für alles Zaubern und Angreifen) ersetzt später genau eine Stelle:
 * `abilityFor`. Die Plätze nach `casterProgression` sind die Tabelle des
 * Regelwerks (PHB, Multiclass Spellcaster) und stehen darum hier.
 */

import { characterLevel, choicesAtCharacter, ancestryLine } from './choices.js';
import { effectApplies, effectWhen, type Effect } from './effects.js';
import type { Entity, EntityId, Relation } from './types.js';

/** Plätze je Grad nach Zauberstufe 1–20 (PHB, „Multiclass Spellcaster"). */
export const CASTER_SLOTS: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Paktmagie nach Hexenmeisterstufe: wie viele Plätze, welcher Grad. */
const PAKT_ANZAHL = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PAKT_GRAD = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

/** Eine Quelle, aus der die Figur zaubert. */
export interface CastingSource {
  id: EntityId;
  /** `hasClass`, `subclass`, `hasAncestry`, `hasBackground`, `grants`, `chose`, `holds`, `statblock`, `character`. */
  via: string;
  /** Das Attribut, mit dem sie zaubert (`int`); fehlt bei Gegenständen. */
  ability?: string;
  /** Bei einer Klasse: ihre Stufe und wie sie Plätze bekommt. */
  classLevel?: number;
  progression?: string;
}

/** Ein Zauber, den die Figur wirken kann, mit seiner Quelle. */
export interface CastSpell {
  spell: EntityId;
  /** Der Artikel, der ihn bringt (Klasse, Herkunft, Talent, Gegenstand, Figur, Statblock). */
  source: EntityId;
  via: string;
  /** `prepared`, `known`, `innate`, `item`. */
  mode: string;
  ability?: string;
  uses?: string;
  /** Die Kante, aus der er kommt; eine Wahl hat keine eigene. */
  relationId?: string;
  /** Aus einer Wahl: ihr Schlüssel (`quelle#wahl`). */
  choice?: string;
}

export interface Spellcasting {
  /** Das Attribut des Kopfs: am Statblock gesetzt, sonst die erste zaubernde Klasse, sonst die erste Quelle. */
  ability: string | null;
  /** Plätze je Grad (der erste ist der 1. Grad), Paktplätze eingerechnet. */
  slots: number[];
  /** Die Zauberstufe aus allen Klassen mit Fortschritt (ohne Pakt). */
  casterLevel: number;
  /** Paktmagie, falls eine Klasse sie bringt. */
  pact: { level: number; count: number } | null;
  sources: CastingSource[];
  spells: CastSpell[];
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Ein Feld der Zauberangaben einer Klasse oder Unterklasse (`ClassCasting` steckt in ihrer Karte). */
function castingField(e: Entity | undefined, feld: 'spellAbility' | 'casterProgression'): string | undefined {
  for (const k of ['Subclass', 'Class', 'ClassCasting']) {
    const v = (e?.components?.[k] as Record<string, unknown> | undefined)?.[feld];
    if (typeof v === 'string' && v) return v.toLowerCase();
  }
  return undefined;
}

/**
 * **Mit welchem Attribut diese Quelle zaubert** — die eine Stelle, die ein
 * eigenes System ersetzt (T-310). Nach D&D: was die Kante oder Wahl nennt,
 * sonst die Quelle, sonst das Hauptattribut der Figur.
 */
function abilityFor(genannt: unknown, quelle: string | undefined, haupt: string | null): string | undefined {
  if (typeof genannt === 'string' && genannt) return genannt.toLowerCase();
  return quelle ?? haupt ?? undefined;
}

/** Wie viele Zauberstufen eine Klasse beiträgt (PHB, Multiclass Spellcaster). */
function stufenBeitrag(progression: string, level: number, allein: boolean): number {
  switch (progression) {
    case 'full':
      return level;
    case 'half':
      /* Allein zählt ein Halbzauberer ab Stufe 2 aufgerundet (Paladin 3 hat drei Plätze). */
      return allein ? (level >= 2 ? Math.ceil(level / 2) : 0) : Math.floor(level / 2);
    case 'artificer':
      return Math.ceil(level / 2);
    case 'third':
      return allein ? (level >= 3 ? Math.ceil(level / 3) : 0) : Math.floor(level / 3);
    default:
      return 0;
  }
}

/**
 * **Das Zauberwirken einer Figur**, gerechnet. `statblock` ist ihr
 * Statblock (aufgelöst); `byId` hält die Quellen — was fehlt, zählt nicht,
 * und wer es holt, rechnet neu.
 */
export function spellcastingOf(character: Entity, statblock: Entity | undefined, byId: ReadonlyMap<EntityId, Entity>): Spellcasting {
  const sb = (statblock?.components?.['Statblock'] ?? {}) as Record<string, unknown>;
  const gesamt = characterLevel(character);
  const sources: CastingSource[] = [];
  const spells: CastSpell[] = [];

  /* ---- Die Klassen: Attribut und Plätze. */
  const klassen: { klasse: Entity; sub?: Entity; level: number; progression?: string; ability?: string }[] = [];
  for (const r of character.relations ?? []) {
    if (r.type !== 'hasClass') continue;
    const klasse = byId.get(r.to);
    if (!klasse) continue;
    const subId = r.props?.['subclass'];
    const sub = typeof subId === 'string' ? byId.get(subId) : undefined;
    const level = zahl(r.props?.['level']) ?? 1;
    const progression = castingField(sub, 'casterProgression') ?? castingField(klasse, 'casterProgression');
    const ability = castingField(sub, 'spellAbility') ?? castingField(klasse, 'spellAbility');
    klassen.push({ klasse, ...(sub ? { sub } : {}), level, ...(progression ? { progression } : {}), ...(ability ? { ability } : {}) });
  }
  const zaubernde = klassen.filter((k) => k.progression && k.progression !== 'pact');
  const allein = zaubernde.length === 1;
  const casterLevel = Math.min(20, zaubernde.reduce((n, k) => n + stufenBeitrag(k.progression!, k.level, allein), 0));
  const paktKlasse = klassen.find((k) => k.progression === 'pact');
  const pact = paktKlasse ? { level: PAKT_GRAD[Math.min(20, paktKlasse.level) - 1]!, count: PAKT_ANZAHL[Math.min(20, paktKlasse.level) - 1]! } : null;

  const amStatblock = typeof sb['spellAbility'] === 'string' && sb['spellAbility'] ? (sb['spellAbility'] as string).toLowerCase() : null;
  const ersteKlasse = klassen.find((k) => k.ability && k.progression)?.ability ?? klassen.find((k) => k.ability)?.ability ?? null;
  let haupt: string | null = amStatblock ?? ersteKlasse;

  let slots: number[];
  if (Array.isArray(sb['spellSlots']) && sb['spellSlots'].length) {
    slots = (sb['spellSlots'] as unknown[]).map((x) => zahl(x) ?? 0);
  } else {
    slots = casterLevel > 0 ? [...CASTER_SLOTS[casterLevel - 1]!] : [];
    if (pact) {
      while (slots.length < pact.level) slots.push(0);
      slots[pact.level - 1] = (slots[pact.level - 1] ?? 0) + pact.count;
    }
  }

  for (const k of klassen) {
    if (!k.progression && !k.ability) continue;
    sources.push({ id: k.klasse.id, via: 'hasClass', classLevel: k.level, ...(k.ability ? { ability: k.ability } : {}), ...(k.progression ? { progression: k.progression } : {}) });
  }

  /* ---- Was an Figur und Statblock von Hand steht. */
  const gesehen = new Set<string>();
  const zauber = (z: CastSpell) => {
    if (gesehen.has(z.spell)) return;
    gesehen.add(z.spell);
    spells.push(z);
  };
  const kanten = (e: Entity, via: string, ability: string | undefined, stufe: number) => {
    for (const r of e.relations ?? []) {
      if (r.type !== 'casts') continue;
      const ab = zahl(r.props?.['fromLevel']);
      if (ab !== null && ab > stufe) continue;
      const a = via === 'holds' ? undefined : abilityFor(r.props?.['ability'], ability, haupt);
      const uses = typeof r.props?.['uses'] === 'string' && r.props['uses'] ? (r.props['uses'] as string) : undefined;
      zauber({
        spell: r.to,
        source: e.id,
        via,
        mode: String(r.props?.['mode'] ?? (via === 'holds' ? 'item' : 'known')),
        ...(a ? { ability: a } : {}),
        ...(uses ? { uses } : {}),
        relationId: r.id,
      });
    }
  };
  kanten(character, 'character', haupt ?? undefined, gesamt);
  if (statblock) kanten(statblock, 'statblock', haupt ?? undefined, gesamt);

  /* ---- Die Quellen der Figur und was sie auf ihrer Stufe gewähren. */
  const quellen: { e: Entity; via: string; level: number; ability?: string }[] = [];
  const dabei = new Set<EntityId>();
  const quelle = (id: unknown, via: string, level: number, ability?: string) => {
    if (typeof id !== 'string' || dabei.has(id)) return;
    const e = byId.get(id);
    if (!e) return;
    dabei.add(id);
    quellen.push({ e, via, level, ...(ability ? { ability } : {}) });
  };
  for (const k of klassen) {
    if (k.sub) quelle(k.sub.id, 'subclass', k.level, k.ability);
    quelle(k.klasse.id, 'hasClass', k.level, k.ability);
  }
  for (const r of character.relations ?? []) {
    if (r.type === 'hasAncestry') for (const id of ancestryLine(r.to, byId)) quelle(id, 'hasAncestry', gesamt);
    else if (r.type === 'hasBackground') quelle(r.to, 'hasBackground', gesamt);
  }
  const ats = choicesAtCharacter(character, byId);
  for (const at of ats) {
    if (at.choice.kind !== 'feat' && at.choice.kind !== 'feature') continue;
    for (const p of at.picks ?? []) quelle(p, 'chose', gesamt);
  }
  for (let i = 0; i < quellen.length; i++) {
    const q = quellen[i]!;
    for (const r of q.e.relations ?? []) {
      /* Was die Quelle gewährt, zaubert mit ihrem Attribut (Domänenzauber, ein Merkmal der Klasse). */
      if (r.type === 'grants' && (zahl(r.props?.['level']) ?? 1) <= q.level) quelle(r.to, 'grants', q.level, q.ability);
    }
  }
  for (const q of quellen) {
    const ability = q.ability ?? castingField(q.e, 'spellAbility');
    const vorher = spells.length;
    kanten(q.e, q.via, ability, q.level);
    if (spells.length > vorher && !sources.some((s) => s.id === q.e.id)) {
      const a = abilityFor(undefined, ability, haupt);
      sources.push({ id: q.e.id, via: q.via, ...(a ? { ability: a } : {}) });
    }
  }

  /* ---- Gewählte Zauber: mit der Quelle, die fragt. */
  for (const at of ats) {
    if (at.choice.kind !== 'spell' || !at.picks?.length) continue;
    const q = quellen.find((x) => x.e.id === at.source.entity.id);
    const quellAttr = q?.ability ?? castingField(at.source.entity, 'spellAbility');
    const a = abilityFor(at.choice.ability, quellAttr, haupt);
    const mode = at.choice.mode ?? 'known';
    for (const p of at.picks.slice(0, at.choice.count ?? at.picks.length)) {
      zauber({
        spell: p,
        source: at.source.entity.id,
        via: at.source.via,
        mode,
        ...(a ? { ability: a } : {}),
        choice: `${at.source.entity.id}#${at.choice.id}`,
      });
    }
    if (!sources.some((s) => s.id === at.source.entity.id)) sources.push({ id: at.source.entity.id, via: at.source.via, ...(a ? { ability: a } : {}) });
  }

  /* ---- Gegenstände, die die Figur trägt. */
  const imInventar = new Set<EntityId>();
  const inventar = (traeger: Entity) => {
    for (const c of traeger.relations ?? []) {
      if (c.type !== 'carries') continue;
      const inv = byId.get(c.to);
      if (!inv || imInventar.has(inv.id)) continue;
      imInventar.add(inv.id);
      for (const h of inv.relations ?? []) {
        if (h.type !== 'holds') continue;
        const item = byId.get(h.to);
        if (!item || imInventar.has(item.id)) continue;
        imInventar.add(item.id);
        const tier = String(h.props?.['tier'] ?? 'pack');
        const getragen = tier === 'held' || tier === 'worn' || (tier !== 'ground' && tier !== 'stored' && typeof h.props?.['slot'] === 'string' && !!h.props['slot']);
        const zustand = { carried: tier !== 'ground' && tier !== 'stored', worn: getragen, attuned: h.props?.['attuned'] === true };
        /* Dieselbe Regel wie für Wirkungen ohne eigene Angabe: eingestimmt, wo verlangt, sonst getragen. */
        if (effectApplies(effectWhen({} as Effect, item), zustand)) {
          const vorher = spells.length;
          kanten(item, 'holds', undefined, gesamt);
          if (spells.length > vorher) sources.push({ id: item.id, via: 'holds' });
        }
      }
    }
  };
  inventar(character);

  if (!haupt) haupt = sources.find((s) => s.ability)?.ability ?? null;
  return { ability: haupt, slots, casterLevel, pact, sources, spells };
}

/**
 * **Die Zauber als Kanten `casts`**, wie der Reiter „Spells“ sie liest —
 * die eigenen, wie sie stehen, die gerechneten mit einer Id `~cast:…` und
 * Quelle, Weg und Attribut in `props`. Gespeichert wird keine davon.
 */
export function castRelations(sc: Spellcasting): Relation[] {
  return sc.spells.map((z) => ({
    id: z.relationId && (z.via === 'character' || z.via === 'statblock') ? z.relationId : `~cast:${z.source}:${z.spell}`,
    type: 'casts',
    to: z.spell,
    props: {
      mode: z.mode,
      ...(z.uses ? { uses: z.uses } : {}),
      ...(z.ability ? { ability: z.ability } : {}),
      source: z.source,
      via: z.via,
    },
  }));
}

/**
 * **Die Figur, wie sie gelesen wird**: mit den gerechneten Kanten `casts`,
 * damit eine Bedingung `when: {relation: 'casts'}` (der Reiter „Spells“)
 * auch für einen Magier gilt, der nichts von Hand trägt.
 */
export function withCastRelations(character: Entity, sc: Spellcasting): Entity {
  const eigene = new Set((character.relations ?? []).map((r) => r.id));
  const dazu = castRelations(sc).filter((r) => !eigene.has(r.id));
  if (!dazu.length && !sc.slots.some((n) => n > 0)) return character;
  /* Eine Klasse, die zaubert, aber noch keinen Zauber kennt, zeigt den Reiter trotzdem. */
  const platzhalter: Relation[] = !dazu.length && !(character.relations ?? []).some((r) => r.type === 'casts') ? [{ id: '~cast:slots', type: 'casts', to: '', props: {} }] : [];
  return { ...character, relations: [...(character.relations ?? []), ...dazu, ...platzhalter] };
}
