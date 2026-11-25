/**
 * **Die Farbe einer Zone** (REQ-356): je Stufe der Leiter (`DrawTime`)
 * ein eigener Farbton, nicht eine Tönung derselben Farbe — fünf Stufen in
 * einem Farbton liegen zu nahe, als dass man „turn" von „round" auf einen
 * Blick unterschiede. Grün ist schnell, Rot ist langsam; was über die
 * Palette hinausgeht, wird violett. Inventar und Tragblatt nehmen dieselbe
 * Funktion, damit eine Zone überall gleich aussieht.
 */
const FARBTOENE = [145, 200, 48, 25, 355, 285];

export function zonenFarbe(stufe: string | null | undefined, leiter: readonly string[]): string | null {
  const i = stufe ? leiter.indexOf(stufe) : -1;
  if (i < 0) return null;
  const h = FARBTOENE[Math.min(i, FARBTOENE.length - 1)]!;
  return `hsl(${h} 62% 52% / 0.62)`;
}
