/**
 * **Der Nebel als Leinwand** (REQ-139, T-204).
 *
 * Bis T-204 war der Nebel ein SVG-Rechteck mit `mask="url(#nebel-…)"`. Die
 * Seite hat `<base href="/">`, und ein Verweis `url(#id)` wird nicht in
 * jedem Browser gegen das eigene Dokument aufgelöst (WebKit und ältere
 * Firefox lösen ihn gegen die Basisadresse auf, also gegen `/`, ein anderes
 * Dokument). Dann greift die Maske nicht, und das Rechteck liegt ganz über
 * der Karte: die Leitung sieht alles halb abgedunkelt und merkt nichts, die
 * Spielersicht sieht schwarz — auch das Aufgedeckte. Eine Leinwand braucht
 * keinen Verweis: erst deckt sie alles zu, dann schneidet sie die Formen
 * heraus (`destination-out`).
 */

/** Eine aufgedeckte Form, fertig zum Zeichnen in `0 0 1 ar` (y schon mal `ar`). */
export interface NebelForm {
  id: string;
  tag: 'rect' | 'circle' | 'polygon' | 'polyline';
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  pts: ReadonlyArray<readonly [number, number]>;
  /** Nur ein Polygon: es gilt nur, soweit es auch in diesem liegt (T-216, `within`). */
  clip?: ReadonlyArray<readonly [number, number]>;
}

/** Was vom 2D-Kontext gebraucht wird — so prüfbar ohne Browser. */
export interface NebelKontext {
  fillStyle: unknown;
  strokeStyle: unknown;
  globalAlpha: number;
  globalCompositeOperation: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, a: number, b: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  clip(): void;
}

type Pfad = ReadonlyArray<readonly [number, number]>;

function pfad(ctx: NebelKontext, pts: Pfad, s: number): void {
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
  ctx.closePath();
}

/** Ein Polygon füllen, nur innerhalb von `klammer` (die Schnittmenge, ohne sie auszurechnen). */
function geklammert(ctx: NebelKontext, pts: Pfad, klammer: Pfad, s: number): void {
  ctx.save();
  ctx.beginPath();
  pfad(ctx, klammer, s);
  ctx.clip();
  ctx.beginPath();
  pfad(ctx, pts, s);
  ctx.fill();
  ctx.restore();
}

/** Die Farbe des Nebels — dieselbe wie `.nebel.ganz` in karte.scss. */
export const NEBEL_FARBE = '#1d1a17';

/**
 * Wie breit die Leinwand in Bildpunkten ist: so breit wie das Kartenbild,
 * aber nicht unter 512 (sonst stuft ein kleines Bild die Ränder grob) und
 * nicht über 2048 (sonst kostet jedes Neuzeichnen beim Pinseln).
 */
export function nebelBreite(bildBreite: number): number {
  return Math.round(Math.min(2048, Math.max(512, bildBreite || 0)));
}

/**
 * Den Nebel zeichnen: `breite` Bildpunkte entsprechen 1 in Kartenanteilen,
 * in beiden Richtungen (die Höhe ist `breite * ar`). `deckt` ist die
 * Deckkraft — die Leitung sieht halb hindurch, Spielende nicht.
 */
export function nebelMalen(ctx: NebelKontext, breite: number, hoehe: number, formen: readonly NebelForm[], deckt: number): void {
  const s = breite;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, breite, hoehe);
  ctx.globalAlpha = deckt;
  ctx.fillStyle = NEBEL_FARBE;
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const f of formen) {
    if (f.tag === 'rect') {
      ctx.fillRect(f.x * s, f.y * s, f.w * s, f.h * s);
      continue;
    }
    if (f.tag === 'polygon' && f.clip && f.clip.length > 2) {
      geklammert(ctx, f.pts, f.clip, s);
      continue;
    }
    ctx.beginPath();
    if (f.tag === 'circle') {
      ctx.arc(f.x * s, f.y * s, f.r * s, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    /* Ein Strich aus einem Punkt ist ein Tupfer — eine Linie der Länge
       null zeichnet die Leinwand nicht, also ein Kreis. */
    if (f.tag === 'polyline' && f.pts.length === 1) {
      const [x, y] = f.pts[0]!;
      ctx.arc(x * s, y * s, f.r * s, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    f.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    if (f.tag === 'polygon') {
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.lineWidth = f.r * 2 * s;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Die Farbe der Dunkelheit (T-216) — kälter als der Nebel, damit man beides auseinanderhält. */
export const DUNKEL_FARBE = '#05070d';

/** Was aus einer Schicht herausgeschnitten wird: Polygone (`0 0 1 ar`, y schon mal `ar`) und wie viel. */
export interface Schnitt {
  formen: ReadonlyArray<Pfad>;
  /** Polygone, die nur innerhalb ihrer Klammer gelten (Licht, soweit die Figur hineinsieht). */
  geklammert?: ReadonlyArray<{ pts: Pfad; clip: Pfad }>;
  /** 1 schneidet ganz heraus, 0,5 lässt die Hälfte stehen. */
  staerke: number;
}

/**
 * **Eine Schicht aus Polygonen** (T-216): Dunkelheit, aus der die Lichter
 * schneiden, oder die gedämpfte laufende Sicht, aus der heraus geschnitten
 * wird, was die Figur gerade sieht. Alle Polygone eines Schnitts stehen in
 * **einem** Pfad und werden einmal gefüllt — zwei überlappende Dämmerlichter
 * sind zusammen Dämmerlicht und nicht hell.
 */
export function schichtMalen(ctx: NebelKontext, breite: number, hoehe: number, farbe: string, deckt: number, schnitte: readonly Schnitt[]): void {
  const s = breite;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, breite, hoehe);
  ctx.globalAlpha = deckt;
  ctx.fillStyle = farbe;
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const sn of schnitte) {
    const formen = sn.formen.filter((f) => f.length > 2);
    if (!(sn.staerke > 0)) continue;
    ctx.globalAlpha = Math.min(1, sn.staerke);
    if (formen.length) {
      ctx.beginPath();
      for (const f of formen) pfad(ctx, f, s);
      ctx.fill();
    }
    for (const g of sn.geklammert ?? []) if (g.pts.length > 2 && g.clip.length > 2) geklammert(ctx, g.pts, g.clip, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
