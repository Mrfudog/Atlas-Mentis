/**
 * **Das Gear erklärt sich** (T-365, E-153): wie gross das Tragraster ist
 * und warum (V1), wie lange etwas zu ziehen dauert und warum (V2), welche
 * Plätze der Körper hat und wie viele Stücke eingestimmt sind (V5).
 *
 * Gerechnet wird hier und nur hier — die Maske zeichnet. Die Ziehstufe
 * selbst kommt aus `drawStage` (inventory.ts); diese Datei sagt sie nur
 * in Worten, damit die Begründung nie eine zweite Rechnung wird.
 */

import type { AssembledCarry, CarrySheet } from './carrySheet.js';
import { HAND_SLOTS, type DrawStep } from './inventory.js';
import type { Relation } from './types.js';
import { stowProps, type StowSpot } from './wield.js';

// ------------------------------------------------------------ V1 Tragraster

export interface CarryPartExplained {
  id: string;
  /** „Small" für das Grundquadrat, „extra" für ein Zusatzquadrat, sonst das Label des Bausteins. */
  name: string;
  x: number;
  w: number;
  h: number;
}

const gross = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * **„Small 4×4 + extra 2×2 (STR 14 → +2)"** (E-153 V1): je Baustein, der
 * gilt, ein Name und seine Masse; dahinter, woher die Werte der
 * Bedingungen kommen (`reasonOf`, z. B. das gerechnete Zusatzquadrat aus
 * der Stärke). Ein Baustein, der nach der Grösse fragt, heisst wie die
 * Grösse; einer, der nach etwas anderem fragt, ist ein Zusatz; einer ohne
 * Bedingung heisst wie sein Label.
 */
export function explainCarry(
  sheet: CarrySheet,
  assembled: AssembledCarry,
  valueOf: (field: string) => unknown,
  reasonOf: (field: string) => string | null = () => null,
): { parts: CarryPartExplained[]; text: string } {
  const gruende: string[] = [];
  const parts = assembled.parts.map((p) => {
    const b = sheet.blocks.find((x) => x.id === p.id);
    const groesse = b?.when.find((c) => c.field.endsWith('.size'));
    let name = b?.label || p.label || p.id;
    if (groesse) name = gross(String(valueOf(groesse.field) ?? '')) || name;
    else if (b?.when.length) name = 'extra';
    for (const c of b?.when ?? []) {
      if (c === groesse) continue;
      const g = reasonOf(c.field);
      if (g && !gruende.includes(g)) gruende.push(g);
    }
    return { id: p.id, name, x: p.x, w: p.w, h: p.h };
  });
  const text = parts.map((p) => `${p.name} ${p.w}×${p.h}`).join(' + ') + (gruende.length ? ` (${gruende.join('; ')})` : '');
  return { parts, text };
}

/**
 * Woher ein gerechnetes Feld seinen Wert hat, so weit es Attributwerte
 * nennt: `mod(str)` bei STR 14 ergibt „STR 14 → +2". Ein Feld, das nicht
 * gerechnet ist oder keinen Attributwert liest, hat keine Begründung.
 */
export function derivedReason(
  derived: string | undefined,
  abilities: Readonly<Record<string, unknown>> | undefined,
  value: unknown,
): string | null {
  if (!derived || !abilities || typeof value !== 'number') return null;
  const namen = [...new Set(derived.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter((t) => typeof abilities[t] === 'number');
  if (!namen.length) return null;
  return `${namen.map((t) => `${t.toUpperCase()} ${abilities[t]}`).join(', ')} → ${value >= 0 ? '+' : ''}${value}`;
}

// ------------------------------------------------------------ V2 Ziehzeit

/**
 * **Die Ziehstufe in Worten** (E-153 V2, REQ-216): „turn (zone action,
 * Bag of Holding +1)". Die Schritte kommen aus `drawStage`; jeder Behälter
 * weiter innen sagt, ob seine Stufe +1 oder seine eigene, langsamere Zone
 * zählte. Ohne Stufe ist alles leer — wie `drawStage`.
 */
export function drawReason(
  r: { stage: string | null; steps: readonly DrawStep[] },
  slotLabel: (slot: string) => string = (s) => s,
): { stage: string | null; why: string; text: string } {
  if (!r.stage) return { stage: null, why: '', text: '' };
  const teile: string[] = [];
  r.steps.forEach((s, i) => {
    if (i === 0) {
      teile.push(s.slot ? slotLabel(s.slot) : `zone ${s.zone}`);
      return;
    }
    const davor = r.steps[i - 1]!.stage;
    /* Hat die eigene Zone die Stufe bestimmt, nennt der Schritt sie; sonst +1. */
    teile.push(s.zone && s.zone === s.stage && s.stage !== davor ? `${s.via} zone ${s.zone}` : `${s.via} +1`);
  });
  const why = teile.join(', ');
  return { stage: r.stage, why, text: `${r.stage} (${why})` };
}

// ------------------------------------------------------------ V5 Körperplätze

/**
 * Der Gurt und seine Holster stehen bis T-367 nicht unter „Body": dort
 * kommt der Gurt als eigener Platz mit Verbund (E-153 V5). Bis dahin
 * bleiben sie in der Einstellung und am Bogen, wo sie heute sind.
 */
export const BELT_SLOTS: readonly string[] = ['belt', 'holster1', 'holster2'];

export interface BodyPlace {
  slot: string;
  /** Was das Ziehen von hier kostet (`slotDraw`); `null`, wenn die Einstellung nichts sagt. */
  draw: string | null;
}

export interface BodyGroup {
  /** `ringR` für `ringR1` … `ringR4`; ein Platz ohne Nummer ist seine eigene Gruppe. */
  key: string;
  label: string;
  places: BodyPlace[];
}

/** Die Wörter der Plätze nach Basils Blatt; ein unbekannter Platz heisst wie sein Name. */
const PLATZNAME: Record<string, string> = {
  armor: 'Armor', head: 'Head', shoulders: 'Shoulders', torso: 'Torso', hands: 'Gloves', legs: 'Legs', feet: 'Boots',
  ringR: 'Rings · right hand', ringL: 'Rings · left hand', neck: 'Necklaces',
};

function platzName(key: string): string {
  return PLATZNAME[key] ?? gross(key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
}

/** „Ring · right hand 2" — ein Platz mit seiner Nummer, für Tooltips und Begründungen. */
export function bodySlotLabel(slot: string): string {
  if (slot === 'mainHand') return 'Main hand';
  if (slot === 'offHand') return 'Off hand';
  const m = /^(.*?)(\d+)$/.exec(slot);
  return m ? `${platzName(m[1]!)} ${m[2]}` : platzName(slot);
}

/**
 * **Die Plätze am Körper** (E-153 V5, E-088): aus der Einstellung
 * `slotDraw` des Inventarmoduls, in ihrer Reihenfolge, und keine feste
 * Liste — ein neuer Platz ist ein neuer Eintrag dort. Nummerierte Plätze
 * (`ringR1` … `ringR4`, `neck1` …) werden eine Gruppe. Die Hände stehen
 * darüber (T-244), der Gurt kommt mit T-367.
 */
export function bodyPlaces(slotDraw: Readonly<Record<string, string>>): BodyGroup[] {
  const gruppen: BodyGroup[] = [];
  for (const [slot, draw] of Object.entries(slotDraw)) {
    if (HAND_SLOTS.includes(slot) || BELT_SLOTS.includes(slot)) continue;
    const key = /^(.*?)\d+$/.exec(slot)?.[1] || slot;
    let g = gruppen.find((x) => x.key === key);
    if (!g) gruppen.push((g = { key, label: platzName(key), places: [] }));
    g.places.push({ slot, draw: draw && draw !== '-' ? draw : null });
  }
  return gruppen;
}

/**
 * **Was an einen Platz darf** — die Gegenstandsart sagt es: an einen
 * Ringplatz ein Ring, an den Rüstungsplatz eine Rüstung (E-153: vorerst
 * ein Rüstungsplatz, die Kleidung einzeln kommt mit T-388), ein Schild in
 * die Nebenhand und nicht an den Körper. Alles andere darf an jeden Platz;
 * wer eine Halskette an den Beinen trägt, weiss warum.
 */
export function bodyPlaceCheck(slot: string, item: { itemType?: unknown }): { ok: boolean; why: string } {
  const art = String(item.itemType ?? '').toLowerCase();
  if (art === 'shield') return { ok: false, why: 'a shield goes in the off hand' };
  if (/^ring[RL]?\d*$/.test(slot) && art !== 'ring') return { ok: false, why: 'only a ring' };
  if (slot === 'armor' && !art.endsWith(' armor')) return { ok: false, why: 'only armor' };
  return { ok: true, why: '' };
}

/** Lage-Angaben, die am Körper nichts gelten: Raster, Drehung, Griff, unverstaut. */
const AUS_DEM_RASTER = ['gx', 'gy', 'rot', 'flip', 'grip', 'unstowed', 'slot', 'tier'];

/** **Anlegen**: an einen Platz, `worn`, aus dem Raster — die übrigen Angaben (Menge, Einstimmung) bleiben. */
export function wearProps(props: Readonly<Record<string, unknown>>, slot: string): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!AUS_DEM_RASTER.includes(k)) p[k] = v;
  return { ...p, slot, tier: 'worn' };
}

/**
 * **Die Kanten nach dem Anlegen.** Aus einem Stapel geht eines an den
 * Platz (neue Kante `newId`, ohne Reservierung), der Rest bleibt, wo er
 * lag — wie beim Griff in die Hand (`applyWield`). Wer den Platz hatte,
 * wird verstaut (`spot` im Raster, sonst unter „Not stowed").
 */
export function applyWear(
  relations: readonly Relation[],
  o: { edgeId: string; slot: string; newId: string; spot: StowSpot; grid: boolean },
): Relation[] {
  const raus: Relation[] = [];
  for (const r of relations) {
    const props = (r.props ?? {}) as Record<string, unknown>;
    if (r.id === o.edgeId) {
      const qty = Math.max(1, Number(props['qty']) || 1);
      if (qty > 1) {
        raus.push({ ...r, props: { ...props, qty: qty - 1 } });
        const { reservedFor: _r, forNeed: _f, ...rest } = props;
        raus.push({ id: o.newId, type: r.type, to: r.to, props: wearProps({ ...rest, qty: 1 }, o.slot) });
      } else {
        raus.push({ ...r, props: wearProps(props, o.slot) });
      }
    } else if (r.type === 'holds' && props['slot'] === o.slot && props['unstowed'] !== true) {
      raus.push({ ...r, props: stowProps(props, o.spot, o.grid) });
    } else {
      raus.push(r);
    }
  }
  return raus;
}

// ------------------------------------------------------------ V5 Einstimmung

/** Wie viele Stücke eingestimmt sind (`holds.props.attuned`). */
export function attunedCount(holds: readonly Pick<Relation, 'type' | 'props'>[]): number {
  return holds.filter((h) => h.type === 'holds' && h.props?.['attuned'] === true).length;
}

/** Die Grenze aus der Einstellung `attunementLimit`, sonst 3 wie in 5e. */
export function attunementLimit(settings: Readonly<Record<string, string>> | null | undefined): number {
  const n = Number(settings?.['attunementLimit']);
  return Number.isInteger(n) && n >= 0 ? n : 3;
}

/**
 * Darf dieses Stück eingestimmt werden? Nur, was es verlangt
 * (`Item.attunement`), und nur bis zur Grenze; die Einstimmung beenden
 * geht immer.
 */
export function attunementCheck(
  item: { attunement?: unknown },
  attuned: boolean,
  count: number,
  limit: number,
): { ok: boolean; why: string } {
  if (attuned) return { ok: true, why: '' };
  if (item.attunement !== true) return { ok: false, why: 'needs no attunement' };
  if (count >= limit) return { ok: false, why: `already attuned to ${count} of ${limit}` };
  return { ok: true, why: '' };
}
