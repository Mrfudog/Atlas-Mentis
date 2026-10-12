/**
 * **Angriffe der Statblöcke, einer für alle** (D51, Entscheidung
 * 12.10.2026).
 *
 * „Bite" stand 870-mal da, jedes Mal mit eigenen Zahlen im Satz — der Wolf
 * mit +4 und 2d4 + 2, der Hai mit +5 und 1d8 + 3. Die Zahlen gehören aber
 * dem, der beisst: Übung und Attribut stehen an seinem Statblock, und dort
 * rechnet das Modell sie (`attackNumbers`). Also gibt es **einen** Biss je
 * Sorte Angriff und Schadensart, und er sagt, worauf gerechnet wird und
 * was gewöhnlich gewürfelt wird. Was ein Statblock anders macht, steht an
 * seiner Kante `composedOf`:
 *
 *  - andere Würfel, Reichweite, Ziel, ein anderes Attribut;
 *  - die **Buchzahl** (`toHit`, `damageFlat`), wo sie nicht aus der
 *    Rechnung folgt — gezeigt wird das Buch;
 *  - ein Zusatzschaden („plus 7 (2d6) poison damage") als Feld, damit er
 *    mitgewürfelt wird;
 *  - der Rest des Satzes („and the target is grappled") als `note`.
 *
 * Gelesen wird der Satz so, wie 5e.tools ihn schreibt. Wo er anders
 * gebaut ist (kein Würfel, zwei Schadensarten, Shillelagh), bleibt der
 * Angriff Text wie bisher und wird gezählt.
 */

import type { Entity, Relation } from '@nw/model';
import { abilityMod, attackAbility } from '@nw/model';
import type { Werkbank } from '../werkbank.js';
import { zaehle } from '../werkbank.js';

const SORTE: Record<string, string[]> = {
  mw: ['melee weapon'], rw: ['ranged weapon'], ms: ['melee spell'], rs: ['ranged spell'],
  'mw,rw': ['melee weapon', 'ranged weapon'], 'ms,rs': ['melee spell', 'ranged spell'],
};

const SCHADENSARTEN = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic',
  'radiant', 'slashing', 'thunder',
]);

/** Ein Angriff, wie der Satz ihn nennt. */
export interface Zerlegt {
  sorten: string[];
  treffer: number;
  reach?: number;
  range?: string;
  ziel: string;
  wuerfel: string;
  flach: number;
  schadensart: string;
  zusatz?: { wuerfel: string; art: string };
  /** Was nach dem Schaden steht — roh, mit 5e.tools-Marken. */
  rest: unknown[];
}

const SATZ = /^\{@atkr? ([a-z,]+)\} \{@hit ([+-]?\d+)\} to hit, (.*?)\. \{@h\}(\d+) \(\{@damage ([^}]+)\}\) (\w+) damage(.*)$/;
const ZUSATZ = /^ plus \d+ \(\{@damage ([^}]+)\}\) (\w+) damage(.*)$/;

/** Den ersten Satz einer Angriffsaktion zerlegen, oder `null`. */
export function zerlegeAngriff(entries: unknown): Zerlegt | null {
  const liste = Array.isArray(entries) ? entries : [entries];
  const erster = liste[0];
  if (typeof erster !== 'string') return null;
  const m = SATZ.exec(erster.trim());
  if (!m) return null;
  const sorten = SORTE[m[1]!];
  const art = m[6]!.toLowerCase();
  if (!sorten || !SCHADENSARTEN.has(art)) return null;
  const w = /^(\d+d\d+)\s*(?:([+-])\s*(\d+))?$/.exec(m[5]!.trim());
  if (!w) return null;

  let ziel = m[3]!;
  const reach = /reach (\d+) ft\.?/.exec(ziel);
  const range = /range (\d+(?:\/\d+)?) ft\.?/.exec(ziel);
  ziel = ziel
    .replace(/reach \d+ ft\.?( or )?/, '')
    .replace(/range \d+(?:\/\d+)? ft\.?/, '')
    .replace(/^[\s,]+|[\s,]+$/g, '');

  let rest = m[7]!;
  let zusatz: Zerlegt['zusatz'];
  const z = ZUSATZ.exec(rest);
  if (z && SCHADENSARTEN.has(z[2]!.toLowerCase()) && /^\d+d\d+$/.test(z[1]!.trim())) {
    zusatz = { wuerfel: z[1]!.trim(), art: z[2]!.toLowerCase() };
    rest = z[3]!;
  }
  rest = rest.replace(/^\.\s*/, '').trim();

  return {
    sorten,
    treffer: Number(m[2]),
    reach: reach ? Number(reach[1]) : undefined,
    range: range ? range[1] : undefined,
    ziel,
    wuerfel: w[1]!,
    flach: w[2] ? (w[2] === '-' ? -1 : 1) * Number(w[3]) : 0,
    schadensart: art,
    zusatz,
    rest: [...(rest ? [rest] : []), ...liste.slice(1)],
  };
}

/** Eine Verwendung: dieser Statblock, diese Kante, dieser Satz. */
export interface Verwendung {
  sb: Entity;
  ziel: Entity;
  kante: Relation;
  z: Zerlegt;
  /** Der Rest des Satzes als Markdown — leer, wenn nichts mehr kommt. */
  satz: string;
}

/** Das häufigste, bei Gleichstand das zuerst gesehene. */
function meist<T>(werte: T[]): T {
  const n = new Map<string, { v: T; c: number }>();
  for (const v of werte) {
    const k = JSON.stringify(v ?? null);
    const e = n.get(k) ?? { v, c: 0 };
    e.c += 1;
    n.set(k, e);
  }
  return [...n.values()].sort((a, b) => b.c - a.c)[0]!.v;
}

/** Die Zahlen eines Statblocks, wie der Bogen sie liest: beide Karten als eine. */
function zahlen(sb: Entity): Record<string, unknown> {
  return { ...(sb.components['Abilities'] ?? {}), ...(sb.components['Statblock'] ?? {}) };
}

/**
 * Welches Attribut der Satz meint: das der Regel, wenn es die Buchzahl
 * ergibt, sonst das andere von STR und DEX, sonst das Zauberattribut.
 * Ergibt keines die Buchzahl, gilt die Regel und das Buch steht fest.
 */
function attributVon(v: Verwendung): string {
  const s = zahlen(v.sb);
  const prof = Number(s['prof']);
  const regel = attackAbility(undefined, v.z.sorten, s) ?? 'str';
  const passt = (a: string) => Number.isFinite(prof) && Number.isFinite(Number(s[a])) && prof + abilityMod(Number(s[a])) === v.z.treffer;
  for (const a of [regel, 'str', 'dex']) if (passt(a)) return a;
  if (typeof s['spellAbility'] === 'string' && passt(s['spellAbility'])) return 'spell';
  return regel;
}

/** Wie das Attribut am Artikel heisst: leer, wo die Regel es schon sagt. */
function etikett(v: Verwendung, a: string): string {
  if (a === 'spell') return v.z.sorten.some((k) => k.includes('spell')) ? '' : 'spell';
  const regel = attackAbility(undefined, v.z.sorten, zahlen(v.sb));
  return a === regel ? '' : a;
}

/**
 * Nach dem Füllen: je Angriff die Vorgaben aus dem häufigsten Fall, und
 * an jeder Kante, was davon abweicht.
 */
export function angriffeVereinen(wb: Werkbank, verwendungen: Verwendung[]): void {
  const A = 'Action';
  const nachZiel = new Map<string, Verwendung[]>();
  for (const v of verwendungen) nachZiel.set(v.ziel.id, [...(nachZiel.get(v.ziel.id) ?? []), v]);

  for (const gruppe of nachZiel.values()) {
    const ziel = gruppe[0]!.ziel;
    const attribute = gruppe.map((v) => {
      const a = attributVon(v);
      return { a, etikett: etikett(v, a) };
    });
    const vorgabe = {
      ability: meist(attribute.map((x) => x.etikett)),
      damageDice: meist(gruppe.map((v) => v.z.wuerfel)),
      reach: meist(gruppe.map((v) => v.z.reach)),
      range: meist(gruppe.map((v) => v.z.range)),
      target: meist(gruppe.map((v) => v.z.ziel)),
    };
    /* Ein Zusatzschaden und ein Satz gehören dem Artikel nur, wenn **jeder**
       sie hat — sonst hätte, wer keinen hat, ihn trotzdem. */
    const zusatz = gruppe.every((v) => JSON.stringify(v.z.zusatz) === JSON.stringify(gruppe[0]!.z.zusatz)) ? gruppe[0]!.z.zusatz : undefined;
    const satz = gruppe.every((v) => v.satz === gruppe[0]!.satz) ? gruppe[0]!.satz : '';

    if (vorgabe.ability) wb.feld(ziel, A, 'ability', vorgabe.ability);
    wb.feld(ziel, A, 'damageDice', vorgabe.damageDice);
    if (vorgabe.reach !== undefined) wb.feld(ziel, A, 'reach', vorgabe.reach);
    if (vorgabe.range !== undefined) wb.feld(ziel, A, 'range', vorgabe.range);
    if (vorgabe.target) wb.feld(ziel, A, 'target', vorgabe.target);
    if (zusatz) {
      wb.feld(ziel, A, 'extraDamageDice', zusatz.wuerfel);
      wb.feld(ziel, A, 'extraDamageType', zusatz.art);
    }
    if (satz) wb.prosa(ziel, satz);

    gruppe.forEach((v, i) => {
      const { a, etikett: e } = attribute[i]!;
      const props: Record<string, unknown> = { ...(v.kante.props ?? {}) };
      delete props['_angriff'];
      if (e !== vorgabe.ability) props['ability'] = e || (a === 'spell' ? 'spell' : a);
      if (v.z.wuerfel !== vorgabe.damageDice) props['damageDice'] = v.z.wuerfel;
      if (v.z.reach !== vorgabe.reach && v.z.reach !== undefined) props['reach'] = v.z.reach;
      if (v.z.range !== vorgabe.range && v.z.range !== undefined) props['range'] = v.z.range;
      if (v.z.ziel !== vorgabe.target) props['target'] = v.z.ziel;
      if (!zusatz && v.z.zusatz) {
        props['extraDamageDice'] = v.z.zusatz.wuerfel;
        props['extraDamageType'] = v.z.zusatz.art;
      }
      if (!satz && v.satz) props['note'] = v.satz;

      /* Die Buchzahl, wo die Rechnung etwas anderes ergäbe. */
      const s = zahlen(v.sb);
      const attr = a === 'spell' ? String(s['spellAbility'] ?? '') : a;
      const mod = Number.isFinite(Number(s[attr])) ? abilityMod(Number(s[attr])) : null;
      const prof = Number(s['prof']);
      const gerechnet = mod !== null && Number.isFinite(prof) ? prof + mod : null;
      if (gerechnet !== v.z.treffer) {
        props['toHit'] = v.z.treffer;
        wb.bericht.angriffe.buchTreffer += 1;
      }
      if (mod !== v.z.flach) {
        props['damageFlat'] = v.z.flach;
        wb.bericht.angriffe.buchSchaden += 1;
      }
      if (Object.keys(props).length) v.kante.props = props;
      else delete v.kante.props;
    });
    zaehle(wb.bericht.angriffe.jeName, ziel.name, gruppe.length);
  }
  wb.bericht.angriffe.artikel = nachZiel.size;
  wb.bericht.angriffe.verwendungen = verwendungen.length;
}
