/** Welche Seite eine Art hat und wie ihre Liste heisst (T-166). */
export const HERKUNFT_WEG: Record<string, { weg: string; liste: string }> = {
  Ancestry: { weg: '/ancestries', liste: 'Ancestries' },
  Background: { weg: '/backgrounds', liste: 'Backgrounds' },
};

/**
 * Wohin ein Artikel führt: Klasse (W6), Herkunft und Hintergrund (T-166)
 * in ihre Ansicht, alles andere auf die Artikelseite. Eine Stelle für
 * Liste, Suche und Vorschau — drei Bedingungen wären drei, die man
 * nachziehen muss.
 */
export function ansichtWeg(typ: string | undefined, id: string): string[] {
  if (typ === 'Class') return ['/classes', id];
  const h = typ ? HERKUNFT_WEG[typ] : undefined;
  return h ? [h.weg, id] : ['/artikel', id];
}
