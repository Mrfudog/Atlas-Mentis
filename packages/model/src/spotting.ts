/**
 * **Was eine Figur unterwegs bemerkt** (T-350, REQ-209; aus dem Prototyp,
 * `confirmMove`).
 *
 * Geht eine Figur der Spielenden einen Weg, fragt die Karte an jedem Feld,
 * was sie von dort bemerkt: **versteckte Tokens** (`marker.props.hidden`,
 * gegen ihre Heimlichkeit) und **versteckte Zonen** (`ZoneKind.hiddenUntil`,
 * die Falle, die erst die passive Wahrnehmung findet). Gerechnet wird mit
 * derselben Prüfung wie überall (`notices`: Sichtlinie, Licht mit
 * Dunkelsicht, passive Wahrnehmung, −5 im Dämmerlicht), vom Feld auf dem
 * Weg zu jedem Feld des Versteckten — das erste, das reicht, gilt.
 *
 * Dazu **was sie betritt** (REQ-208): eine Zone, deren Art Schaden, einen
 * Rettungswurf, einen Zustand oder Bewegungskosten nennt, schreibt beim
 * Hineingehen eine Zeile ins Protokoll. Gewürfelt wird nicht — die Karte
 * nimmt der Leitung nicht ab, ob die Falle diesmal greift (ZoneInfo).
 *
 * Kein Framework, keine Kartenänderung: das Modell sagt, **was** bemerkt
 * wird; der Server deckt auf (`hidden` weg, `found: true`) und schreibt
 * die Zeilen. Ohne Gitter wird nichts geprüft — Feldmitten gibt es dann
 * nicht.
 */

import { checkBonus } from './calc.js';
import { feetToFraction, mapBlockers, mapLighting, mapLights } from './lighting.js';
import { cellCentre, inShape, markersOf, shapeOf, type GridGeometry, type RevealShape, type Size } from './map.js';
import { lineOfSight, lightAt, notices, worseObscured, darkvisionOf, type LightLevel, type Obscured, type Observer, type Pt } from './sight.js';
import type { CharacterStats } from './stats.js';
import type { Entity, EntityId } from './types.js';
import { wallSegs } from './walls.js';
import { tokenCells } from './zugplan.js';

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Etwas Verstecktes auf der Karte, das bemerkt werden kann. */
export interface SpotCandidate {
  /** Die Kante: Marker oder Zone. */
  rel: string;
  kind: 'marker' | 'zone';
  /** Wohin die Kante zeigt (die Kreatur, die Zonenart). */
  to: EntityId;
  /** Die Feldmitten, die man sehen muss — eine davon reicht. */
  pts: Pt[];
  /** Heimlichkeit des Versteckten bzw. `hiddenUntil` der Zone. */
  dc: number;
}

/** Bemerkt: was, an welchem Punkt des Wegs, mit welcher Wahrnehmung. */
export interface Spot {
  rel: string;
  kind: 'marker' | 'zone';
  to: EntityId;
  /** Index im Weg. */
  at: number;
  pp: number;
  dc: number;
}

/** Was eine Zone an einer Stelle tut — die Zeile, die beim Betreten ins Protokoll geht. */
export interface ZoneEntry {
  rel: string;
  to: EntityId;
  at: number;
  /** „2d6 fire, DEX save DC 13, difficult terrain ×2" — leer, wenn die Art nichts nennt. */
  line: string;
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function zoneKarte(kinds: Lookup, to: EntityId): Record<string, unknown> {
  return (kinds.get(to)?.components?.['ZoneKind'] ?? {}) as Record<string, unknown>;
}

interface Zone {
  rel: string;
  to: EntityId;
  shape: RevealShape;
  card: Record<string, unknown>;
  found: boolean;
}

function zonenVon(map: Entity, kinds: Lookup): Zone[] {
  const out: Zone[] = [];
  for (const r of map.relations ?? []) {
    if (r.type !== 'zone') continue;
    const p = (r.props ?? {}) as Record<string, unknown>;
    const shape = shapeOf({ ...p, id: r.id });
    if (shape) out.push({ rel: r.id, to: r.to, shape, card: zoneKarte(kinds, r.to), found: p['found'] === true });
  }
  return out;
}

/** Eine versteckte Zone, die noch niemand gefunden hat. */
function versteckt(z: Zone): boolean {
  return (zahl(z.card['hiddenUntil']) ?? 0) > 0 && !z.found;
}

/**
 * **Die Sinneswerte einer Figur am Tisch**: passive Wahrnehmung (ein
 * „passive Perception 14" in den Sinnen schlägt die Rechnung), die
 * Heimlichkeit als SG (10 + Bonus, wie die Regel für den Passivwert) und
 * die Dunkelsicht. Gelesen aus dem gelesenen Statblock von
 * `creatureStats`, mit den Wirkungen `check` (T-355).
 */
export function senseNumbers(st: CharacterStats): { pp: number; stealth: number | null; darkvision: number } {
  const c = (st.statblock?.components ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const sb = c['Statblock'] ?? {};
  const pf = c['Proficiencies'] ?? {};
  const check = st.totals.add['check'] ?? 0;
  const probe = (skill: string, attr: keyof CharacterStats['abilities']): number | null => {
    const b = checkBonus({ proficient: pf['proficient'], expertise: pf['expertise'], prof: sb['prof'], bonuses: sb['bonuses'], score: st.abilities[attr]?.value }, skill);
    return b === null ? null : 10 + b + check;
  };
  const sinne = String(sb['senses'] ?? '');
  const fest = /passive\s+perception\s+(\d+)/i.exec(sinne);
  return {
    pp: fest ? Number(fest[1]) : probe('Perception', 'wis') ?? 10,
    stealth: probe('Stealth', 'dex'),
    darkvision: darkvisionOf(sinne),
  };
}

/**
 * **Was auf dieser Karte versteckt ist**: Marker mit `hidden` (ausser dem
 * eigenen) und Zonen mit `hiddenUntil`, die noch nicht gefunden sind. Die
 * Heimlichkeit eines Markers steht an ihm (`props.stealth`) oder kommt aus
 * `stealthOf` (die Kreatur dahinter); ohne beides kann ihn niemand
 * bemerken — dann deckt ihn die Leitung von Hand auf.
 */
export function hiddenOnMap(
  map: Entity,
  kinds: Lookup,
  geo: GridGeometry,
  self: string | null,
  stealthOf: (to: EntityId) => number | null,
): SpotCandidate[] {
  const out: SpotCandidate[] = [];
  for (const m of markersOf(map)) {
    if (!m.hidden || m.rel.id === self) continue;
    const eigen = zahl((m.rel.props ?? {})['stealth']);
    const dc = eigen ?? stealthOf(m.to);
    if (dc === null) continue;
    out.push({ rel: m.rel.id, kind: 'marker', to: m.to, dc, pts: tokenCells(geo, m, m.size).map((c) => cellCentre(geo, c)) });
  }
  const spalten = Math.ceil((geo.w - geo.ox) / geo.size);
  const zeilen = Math.ceil((geo.h - geo.oy) / geo.rowHeight);
  for (const z of zonenVon(map, kinds)) {
    if (!versteckt(z)) continue;
    const pts: Pt[] = [];
    for (let y = 0; y < zeilen && pts.length < 64; y++) {
      for (let x = 0; x < spalten && pts.length < 64; x++) {
        const m = cellCentre(geo, { x, y });
        if (inShape(z.shape, m)) pts.push(m);
      }
    }
    if (pts.length) out.push({ rel: z.rel, kind: 'zone', to: z.to, dc: zahl(z.card['hiddenUntil'])!, pts });
  }
  return out;
}

/** Licht und Verdeckung, die die Zonen an einer Stelle sagen (das Dunkelste, das Dichteste). */
function zonenAn(zonen: readonly Zone[], p: Pt, gm: boolean): { light: LightLevel | null; obscured: Obscured } {
  const rang = { dark: 0, dim: 1, bright: 2 } as const;
  let light: LightLevel | null = null;
  let obscured: Obscured = 'none';
  for (const z of zonen) {
    if (!gm && versteckt(z)) continue;
    if (!inShape(z.shape, p)) continue;
    const l = z.card['light'];
    if ((l === 'bright' || l === 'dim' || l === 'dark') && (light === null || rang[l] < rang[light])) light = l;
    const o = z.card['obscured'];
    if (o === 'light' || o === 'heavy') obscured = worseObscured(obscured, o);
  }
  return { light, obscured };
}

/**
 * **Was die Figur auf diesem Weg bemerkt** (T-350): je Versteck der erste
 * Punkt des Wegs, von dem aus es reicht. `path` sind Feldmitten in
 * Anteilen der Karte, der erste ist der Start (von dort sah sie schon
 * vorher — bemerkt wird erst ab dem ersten Schritt).
 */
export function spotsAlong(
  map: Entity,
  nat: Size,
  kinds: Lookup,
  path: readonly Pt[],
  observer: Observer,
  candidates: readonly SpotCandidate[],
  carried: Parameters<typeof mapLights>[2] = {},
): Spot[] {
  if (path.length < 2 || !candidates.length) return [];
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const sperren = mapBlockers(map, nat);
  const sicht = wallSegs(sperren, 'sight', ar);
  const lichtSperren = wallSegs(sperren, 'light', ar);
  const lichter = mapLights(map, nat, carried).map((l) => ({ x: l.x, y: l.y * ar, bright: l.bright, dim: l.dim }));
  const grund = mapLighting(map);
  const proFuss = feetToFraction(map, nat, 1);
  const zonen = zonenVon(map, kinds);
  const a = (p: Pt): Pt => ({ x: p.x, y: p.y * ar });
  const out: Spot[] = [];
  const offen = new Map(candidates.map((c) => [c.rel, c]));
  for (let i = 1; i < path.length && offen.size; i++) {
    const von = a(path[i]!);
    for (const c of [...offen.values()]) {
      for (const q of c.pts) {
        const nach = a(q);
        const z = zonenAn(zonen, q, false);
        const r = notices(observer, {
          los: lineOfSight(von, nach, sicht),
          light: lightAt(nach, grund, lichter, lichtSperren, z.light),
          distanceFeet: proFuss > 0 ? Math.hypot(nach.x - von.x, nach.y - von.y) / proFuss : 0,
          dc: c.dc,
          obscured: z.obscured,
        });
        if (!r.seen) continue;
        out.push({ rel: c.rel, kind: c.kind, to: c.to, at: i, pp: r.pp, dc: c.dc });
        offen.delete(c.rel);
        break;
      }
    }
  }
  return out;
}

/** Die Zeile einer Zonenart: was sie tut, wenn man hineingeht. */
export function zoneLine(card: Record<string, unknown>, saveLabel: (attr: string) => string = (s) => s.toUpperCase()): string {
  const teile: string[] = [];
  const schaden = String(card['damage'] ?? '').trim();
  if (schaden) teile.push(`${schaden}${card['damageType'] ? ` ${card['damageType']}` : ''}`);
  const save = String(card['save'] ?? '').trim();
  if (save) teile.push(`${saveLabel(save)} save${zahl(card['saveDC']) !== null ? ` DC ${zahl(card['saveDC'])}` : ''}`);
  if (card['condition']) teile.push('condition');
  const kosten = zahl(card['moveCost']);
  if (kosten !== null && kosten > 1) teile.push(kosten === 2 ? 'difficult terrain' : `movement ×${kosten}`);
  return teile.join(', ');
}

/**
 * **Welche Zonen der Weg betritt** (REQ-208): eine Zone, in der der
 * vorige Punkt nicht lag, und deren Art etwas tut (`zoneLine` nicht leer).
 * Eine versteckte, ungefundene Zone zählt nur für die Leitung (`gm`) — ihr
 * Name im Protokoll hätte sie verraten.
 */
export function zonesEntered(map: Entity, kinds: Lookup, path: readonly Pt[], opts: { gm?: boolean } = {}): ZoneEntry[] {
  const out: ZoneEntry[] = [];
  const zonen = zonenVon(map, kinds).filter((z) => opts.gm || !versteckt(z));
  zonen.forEach((z) => {
    const line = zoneLine(z.card);
    if (!line) return;
    let drin = path.length ? inShape(z.shape, path[0]!) : false;
    for (let i = 1; i < path.length; i++) {
      const jetzt = inShape(z.shape, path[i]!);
      if (jetzt && !drin) {
        out.push({ rel: z.rel, to: z.to, at: i, line });
        break;
      }
      drin = jetzt;
    }
  });
  return out.sort((x, y) => x.at - y.at);
}
