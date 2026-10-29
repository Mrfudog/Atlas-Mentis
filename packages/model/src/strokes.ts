/**
 * **Zeichnen auf der Karte** (T-219, REQ-142, docs/Karten.md › Zeichnen):
 * Striche — und seit dem Stempel auch Text (`kind: 'text'`) — liegen auf einem eigenen Blatt (`Map.sheets[].strokes`) — die
 * Zeichenebene ist ein Blatt wie eines mit Bild: sie hat Deckkraft,
 * lässt sich ausblenden und der Leitung vorbehalten (`gmOnly`, dann hält
 * `redactMap` sie zurück). Ein eigenes Feld `Map.drawings` daneben wäre
 * eine zweite Sorte Ebene, die jede dieser Fragen noch einmal stellen
 * müsste.
 *
 * Alles in Anteilen der Karte; Abstände im Raum mit gleichen Achsen
 * (y mal `ar`). Kein Framework, kein DOM.
 */

import { MAP_COMPONENT, mapSheets, type MapStroke } from './map.js';
import type { Pt } from './sight.js';
import type { Entity } from './types.js';

type Roh = Record<string, unknown>;

function karteVon(e: Entity): Roh {
  return (e.components?.[MAP_COMPONENT] ?? {}) as Roh;
}
function rohBlaetter(e: Entity): Roh[] {
  const s = karteVon(e)['sheets'];
  return Array.isArray(s) ? (s.filter((x) => x && typeof x === 'object') as Roh[]) : [];
}
function mitBlaettern(e: Entity, sheets: Roh[]): Entity {
  return { ...e, components: { ...e.components, [MAP_COMPONENT]: { ...karteVon(e), sheets } } };
}
const r5 = (v: number): number => Math.round(v * 100000) / 100000;

/** Eine neue Zeichenebene obenauf — ohne Bild, für die Leitung und die Spielenden sichtbar. */
export function addDrawingSheet(e: Entity, name: string, id: string): { map: Entity; id: string } {
  return { map: mitBlaettern(e, [...rohBlaetter(e), { id, name, image: '', strokes: [] }]), id };
}

/** Einen Strich auf ein Blatt; die Punkte gerundet, damit ein langer Freihandstrich kurz bleibt. */
export function addStroke(e: Entity, sheet: string, s: MapStroke): Entity {
  const strich = { id: s.id, kind: s.kind, pts: s.pts.map(([x, y]) => [r5(x), r5(y)]), color: s.color, width: r5(s.width), ...(s.kind === 'text' && s.text ? { text: s.text } : {}) };
  return mitBlaettern(
    e,
    rohBlaetter(e).map((b) => (b['id'] === sheet ? { ...b, strokes: [...(Array.isArray(b['strokes']) ? b['strokes'] : []), strich] } : b)),
  );
}

export function removeStroke(e: Entity, sheet: string, stroke: string): Entity {
  return mitBlaettern(
    e,
    rohBlaetter(e).map((b) =>
      b['id'] === sheet && Array.isArray(b['strokes']) ? { ...b, strokes: b['strokes'].filter((s) => !(s && typeof s === 'object' && (s as Roh)['id'] === stroke)) } : b,
    ),
  );
}

/** Ein Blatt der Leitung vorbehalten oder freigeben. */
export function setSheetGmOnly(e: Entity, sheet: string, gmOnly: boolean): Entity {
  return mitBlaettern(
    e,
    rohBlaetter(e).map((b) => {
      if (b['id'] !== sheet) return b;
      const { gmOnly: _alt, ...rest } = b;
      return gmOnly ? { ...rest, gmOnly: true } : rest;
    }),
  );
}

/** Die Strecken, die ein Strich zeichnet (eine Ellipse als Vieleck aus 32 Ecken). */
function strecken(s: MapStroke): Array<[number, number]> {
  const [a, b] = s.pts;
  if (s.kind === 'path' || s.kind === 'line' || !a || !b) return s.pts;
  if (s.kind === 'rect') return [a, [b[0], a[1]], b, [a[0], b[1]], a];
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  const rx = Math.abs(b[0] - a[0]) / 2;
  const ry = Math.abs(b[1] - a[1]) / 2;
  return Array.from({ length: 33 }, (_, i) => {
    const w = (i / 32) * 2 * Math.PI;
    return [cx + rx * Math.cos(w), cy + ry * Math.sin(w)] as [number, number];
  });
}

/** Abstand eines Punktes zu einer Strecke (gleiche Achsen). */
function abstand(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * **Der Strich unter dem Finger** (zum Radieren): der oberste, dessen Linie
 * näher als `tol` (Anteile der Breite) plus seine halbe Breite liegt. Ein
 * Rechteck oder eine Ellipse trifft man am Rand — man radiert, was man
 * gezeichnet hat, nicht die Fläche darin.
 */
export function strokeAt(e: Entity, p: Pt, ar: number, tol: number): { sheet: string; stroke: string } | null {
  const blaetter = mapSheets(e).filter((s) => !s.base);
  for (let i = blaetter.length - 1; i >= 0; i--) {
    const b = blaetter[i]!;
    for (let j = b.strokes.length - 1; j >= 0; j--) {
      const s = b.strokes[j]!;
      if (s.kind === 'text') {
        /* Ein Text trifft man in seinem Kasten: so breit wie seine Zeichen, so hoch wie die Schrift. */
        const [m] = s.pts;
        const breit = (s.width * Math.max(1, [...(s.text ?? '')].length)) / 2 * 0.6 + tol;
        const hoch = s.width / 2 + tol;
        if (m && Math.abs(p.x - m[0]) <= breit && Math.abs((p.y - m[1]) * ar) <= hoch) return { sheet: b.id, stroke: s.id };
        continue;
      }
      const q = strecken(s);
      const grenze = tol + s.width / 2;
      const treffer =
        q.length === 1
          ? Math.hypot(p.x - q[0]![0], (p.y - q[0]![1]) * ar) <= grenze
          : q.slice(1).some((z, k) => abstand(p.x, p.y * ar, q[k]![0], q[k]![1] * ar, z[0], z[1] * ar) <= grenze);
      if (treffer) return { sheet: b.id, stroke: s.id };
    }
  }
  return null;
}

/** Der SVG-Pfad eines Strichs in einer `viewBox` 0 0 1 `ar` — dort sind die Achsen gleich, und die Breite bleibt rund. */
export function strokePath(s: MapStroke, ar: number): string {
  const q = strecken(s);
  const zu = s.kind === 'rect';
  const pkt = (x: number, y: number) => `${r5(x)} ${r5(y * ar)}`;
  const liste = zu ? q.slice(0, -1) : q;
  if (liste.length === 1) return `M${pkt(liste[0]![0], liste[0]![1])} l0 0`;
  return `M${liste.map(([x, y]) => pkt(x, y)).join(' L')}${zu || s.kind === 'ellipse' ? ' Z' : ''}`;
}
