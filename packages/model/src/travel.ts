/**
 * **Reise: Tag, Wache, Zehrung** (T-350, REQ-170; aus dem Prototyp,
 * `elCrawl`/`zeitVergeht`).
 *
 * Die Zähler stehen an der Gruppe (`Party.day`, `watch`, `sinceRation`,
 * `sinceLight`) und werden am Tisch gesetzt (`alwaysEdit`). Was sie
 * bedeuten, sagt die Kampagne mit drei Einstellungen: nach wie vielen
 * Knoten eine Ration und ein Licht aufgebraucht sind
 * (`travelRationEvery`, `travelLightEvery`) und wie viele Wachen ein Tag hat
 * (`travelWatchesPerDay`). Null schaltet die Zählung aus.
 *
 * Zwei Schritte gibt es: **eine Wache vergeht** (warten, rasten — die Zeit
 * läuft, die Zehrung nicht) und **ein Knoten weiter** (die Gruppe zieht:
 * eine Wache, und je ein Knoten auf Rationen und Licht; was die Figuren
 * an diesem Knoten taten, `Party.actions`, gehört zum Knoten und wird
 * geleert). Gerechnet wird hier; die Seite schreibt das Ergebnis.
 *
 * Ob am Ende eine Ration vom Inventar abgeht, entscheidet der Tisch — die
 * Rechnung sagt, **dass** sie fällig ist (`used`), und nimmt nichts weg.
 */

export interface TravelRules {
  /** Nach so vielen Knoten ist eine Ration fällig; 0: aus. */
  rationEvery: number;
  /** Nach so vielen Knoten ist ein Licht aufgebraucht; 0: aus. */
  lightEvery: number;
  /** Wachen je Tag, mindestens 1. */
  watchesPerDay: number;
}

export interface TravelCounters {
  day: number;
  watch: number;
  sinceRation: number;
  sinceLight: number;
}

const ganz = (v: unknown, vorgabe: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : vorgabe;
};

/** Die Reiseregeln aus den Einstellungen; was fehlt, gilt wie im Register (3, 4, 3). */
export function travelRulesOf(settings: Readonly<Record<string, unknown>> | null | undefined): TravelRules {
  const s = settings ?? {};
  return {
    rationEvery: ganz(s['travelRationEvery'], 3),
    lightEvery: ganz(s['travelLightEvery'], 4),
    watchesPerDay: Math.max(1, ganz(s['travelWatchesPerDay'], 3)),
  };
}

/** Die Zähler einer Gruppe (Karte `Party`), mit den Vorgaben des Registers. */
export function travelCounters(card: Readonly<Record<string, unknown>> | null | undefined): TravelCounters {
  const c = card ?? {};
  return {
    day: Math.max(1, ganz(c['day'], 1)),
    watch: Math.max(1, ganz(c['watch'], 1)),
    sinceRation: ganz(c['sinceRation'], 0),
    sinceLight: ganz(c['sinceLight'], 0),
  };
}

/** Wie viele Knoten bis zur nächsten Ration bzw. zum nächsten Licht; `null`, wenn die Zählung aus ist. */
export function travelDue(c: TravelCounters, rules: TravelRules): { rationsIn: number | null; lightIn: number | null } {
  const bis = (seit: number, je: number): number | null => (je > 0 ? je - (seit % je) : null);
  return { rationsIn: bis(c.sinceRation, rules.rationEvery), lightIn: bis(c.sinceLight, rules.lightEvery) };
}

export interface TravelStep {
  /** Was in die Karte `Party` geschrieben wird. */
  patch: Record<string, unknown>;
  /** Die Zähler danach. */
  after: TravelCounters;
  /** Ein neuer Tag hat begonnen. */
  newDay: boolean;
  /** Mit diesem Knoten fällig geworden. */
  used: { ration: boolean; light: boolean };
}

/**
 * **Ein Schritt der Reise**: `watch` lässt eine Wache vergehen, `node`
 * zieht einen Knoten weiter (eine Wache dazu, Zehrung zählt, Handlungen
 * des Knotens geleert). Nach der letzten Wache des Tages beginnt ein neuer
 * Tag mit Wache 1.
 */
export function travelStep(c: TravelCounters, rules: TravelRules, kind: 'watch' | 'node'): TravelStep {
  let watch = c.watch + 1;
  let day = c.day;
  const newDay = watch > rules.watchesPerDay;
  if (newDay) {
    watch = 1;
    day += 1;
  }
  const after: TravelCounters = { ...c, day, watch };
  const patch: Record<string, unknown> = { day, watch };
  const used = { ration: false, light: false };
  if (kind === 'node') {
    after.sinceRation = c.sinceRation + 1;
    after.sinceLight = c.sinceLight + 1;
    patch['sinceRation'] = after.sinceRation;
    patch['sinceLight'] = after.sinceLight;
    patch['actions'] = undefined;
    used.ration = rules.rationEvery > 0 && after.sinceRation % rules.rationEvery === 0;
    used.light = rules.lightEvery > 0 && after.sinceLight % rules.lightEvery === 0;
  }
  return { patch, after, newDay, used };
}

/** Die Zeile über der Reise: „Day 2, watch 3 · rations in 1 · light in 3". */
export function travelLine(c: TravelCounters, rules: TravelRules): string {
  const d = travelDue(c, rules);
  return [
    `Day ${c.day}, watch ${c.watch} of ${rules.watchesPerDay}`,
    d.rationsIn !== null ? `rations in ${d.rationsIn}` : '',
    d.lightIn !== null ? `light in ${d.lightIn}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
