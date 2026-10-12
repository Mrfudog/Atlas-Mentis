/**
 * **Wer wen sieht** (REQ-209, D56).
 *
 * Dieselbe Prüfung für beides, was die Karte aufdeckt: ein Token, das von
 * Hand gefragt wird („sieht / wird gesehen von“), und der Weg, der beim
 * Bestätigen einer Bewegung Schritt für Schritt abgelaufen wird. Zwei
 * Prüfungen dafür wären zwei Antworten auf „sieht sie den Goblin?“, und am
 * Tisch gälte die, die gerade gezeichnet wurde.
 *
 * Gesehen wird, wenn
 * 1. die **Sichtlinie** frei ist — keine Wand, die den Blick hält
 *    (`blocksSight`), und kein Feld dazwischen, das ganz verdeckt ist
 *    (eine Zone mit `obscured: heavy`);
 * 2. es **hell genug** ist — im Dunkeln nur mit Dunkelsicht in Reichweite,
 *    und die zählt dann als Dämmerlicht;
 * 3. die **passive Wahrnehmung** reicht — gegen die Heimlichkeit des
 *    Versteckten (bzw. den SG einer Falle), mit **−5 im Dämmerlicht** und
 *    in leicht verdeckten Feldern (das ist der Nachteil der Regel als Zahl).
 *
 * Wer nicht versteckt ist, braucht nur 1 und 2.
 */

import { segmentsCross, type Seg } from './movement.js';

export type LightLevel = 'bright' | 'dim' | 'dark';
export type Obscured = 'none' | 'light' | 'heavy';

export interface Pt {
  x: number;
  y: number;
}

const RANK: Record<LightLevel, number> = { dark: 0, dim: 1, bright: 2 };

/** Ist die Strecke frei von Wänden, die den Blick halten? */
export function lineOfSight(a: Pt, b: Pt, walls: readonly Seg[]): boolean {
  for (const w of walls) if (segmentsCross(a.x, a.y, b.x, b.y, w)) return false;
  return true;
}

export interface LightSource {
  x: number;
  y: number;
  /** Radien in denselben Einheiten wie die Punkte. */
  bright: number;
  dim: number;
}

/**
 * Wie hell es an einer Stelle ist. Sagt eine **Zone** etwas (magische
 * Dunkelheit, ein erleuchteter Saal), gilt die Zone — sie ist die Regel,
 * die an diesem Ort steht. Sonst das Hellste aus der Karte und den Lichtern,
 * die die Stelle ohne Wand dazwischen erreichen.
 */
export function lightAt(
  p: Pt,
  mapLight: LightLevel,
  lights: readonly LightSource[],
  walls: readonly Seg[],
  zoneLight?: LightLevel | null,
): LightLevel {
  if (zoneLight) return zoneLight;
  let best: LightLevel = mapLight;
  for (const l of lights) {
    if (RANK[best] === 2) break;
    const d = Math.hypot(p.x - l.x, p.y - l.y);
    if (d > Math.max(l.bright, l.dim)) continue;
    if (!lineOfSight({ x: l.x, y: l.y }, p, walls)) continue;
    const here: LightLevel = d <= l.bright ? 'bright' : 'dim';
    if (RANK[here] > RANK[best]) best = here;
  }
  return best;
}

/** Die Dunkelsicht aus den Sinnen: „darkvision 60 ft., passive Perception 12“ → 60. */
export function darkvisionOf(senses: unknown): number {
  const m = /darkvision\s+(\d+)/i.exec(String(senses ?? ''));
  return m ? Number(m[1]) : 0;
}

export interface Observer {
  /** Passive Wahrnehmung. */
  pp: number;
  /** Dunkelsicht in Fuss. */
  darkvision?: number;
}

export interface NoticeResult {
  seen: boolean;
  /** Die Wahrnehmung, mit der gerechnet wurde (nach −5). */
  pp: number;
  /** Das Licht, das gezählt hat (Dunkelsicht macht aus dunkel dämmrig). */
  light: LightLevel;
  /** Warum nicht — für die Zeile am Token. */
  why?: 'wall' | 'obscured' | 'dark' | 'stealth';
}

/**
 * Bemerkt der Beobachter das Ziel? `dc` ist die Heimlichkeit des
 * Versteckten (oder der SG einer Falle); ohne `dc` ist das Ziel nicht
 * versteckt und braucht nur Sicht und Licht. `obscured` ist das Stärkste
 * auf der Linie, Endpunkte eingeschlossen.
 */
export function notices(
  obs: Observer,
  opts: {
    los: boolean;
    light: LightLevel;
    distanceFeet: number;
    dc?: number | null;
    obscured?: Obscured;
  },
): NoticeResult {
  let light = opts.light;
  if (light === 'dark' && (obs.darkvision ?? 0) >= opts.distanceFeet) light = 'dim';
  const ob = opts.obscured ?? 'none';
  const malus = light === 'dim' || ob === 'light' ? 5 : 0;
  const pp = obs.pp - malus;
  if (!opts.los) return { seen: false, pp, light, why: 'wall' };
  if (ob === 'heavy') return { seen: false, pp, light, why: 'obscured' };
  if (light === 'dark') return { seen: false, pp, light, why: 'dark' };
  if (opts.dc != null && Number.isFinite(opts.dc) && pp < opts.dc) return { seen: false, pp, light, why: 'stealth' };
  return { seen: true, pp, light };
}

/** Das Stärkere von zwei Verdeckungen. */
export function worseObscured(a: Obscured, b: Obscured): Obscured {
  const r = { none: 0, light: 1, heavy: 2 } as const;
  return r[a] >= r[b] ? a : b;
}
