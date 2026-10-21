import { filled, type InventoryFrame, type Shape } from '@nw/model';

/**
 * **Das Bild in der Form** (T-142) — eine Rechnung für das Element Shape,
 * den Dialog „Adjust inventory image" und das Kachelinventar, damit alle
 * drei dasselbe zeigen.
 *
 * Das Bild liegt in einem Kasten von der Grösse der ungedrehten Form
 * (`w` × `h` Felder): mittig, gedreht um `frame.rot`, eingepasst oder
 * füllend (`fit`), vergrössert und verschoben. Prozent statt Pixel, damit
 * es in jeder Feldgrösse gleich liegt; die natürliche Grösse des Bildes
 * braucht es nicht, das erledigt `object-fit`.
 */
export function formBildStil(frame: InventoryFrame, w: number, h: number): Record<string, string> {
  const quer = frame.rot === 90 || frame.rot === 270;
  const bw = quer && w > 0 ? (h / w) * 100 : 100;
  const bh = quer && h > 0 ? (w / h) * 100 : 100;
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${bw.toFixed(3)}%`,
    height: `${bh.toFixed(3)}%`,
    'max-width': 'none',
    'object-fit': frame.fit,
    transform: `translate(-50%, -50%) translate(${frame.x}%, ${frame.y}%) rotate(${frame.rot}deg) scale(${frame.zoom})`,
  };
}

/**
 * **Nur in den belegten Feldern** (T-142): eine Maske aus der Form, damit
 * das Bild eines L-förmigen Stücks nicht über das freie Feld daneben ragt.
 * Ein SVG mit einem Rechteck je Feld, als `mask-image`.
 */
export function formMaske(form: Shape): string {
  const r: string[] = [];
  for (let y = 0; y < form.h; y++) for (let x = 0; x < form.w; x++) if (filled(form, x, y)) r.push(`<rect x='${x}' y='${y}' width='1' height='1'/>`);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${form.w} ${form.h}' preserveAspectRatio='none'>${r.join('')}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** Die Maske als Stil — mit und ohne Präfix, Safari kennt nur das eine. */
export function maskenStil(form: Shape): Record<string, string> {
  const m = formMaske(form);
  return { 'mask-image': m, '-webkit-mask-image': m, 'mask-size': '100% 100%', '-webkit-mask-size': '100% 100%' };
}
