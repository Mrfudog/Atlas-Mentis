/** Wie die Liste einer Art heisst und wo sie steht (T-166). */
export const HERKUNFT_WEG: Record<string, { weg: string; liste: string }> = {
  Ancestry: { weg: '/ancestries', liste: 'Ancestries' },
  Background: { weg: '/backgrounds', liste: 'Backgrounds' },
};

/**
 * Wohin ein Artikel führt: auf die Artikelseite. Klasse (W6), Herkunft und
 * Hintergrund (T-166) hatten eigene Seiten; seit T-191 sind ihre
 * Übersichten Elemente der Artikelseite (`classOverview`,
 * `originOverview`), und die alten Wege leiten um. Die eine Stelle für
 * Liste, Suche und Vorschau bleibt, damit ein nächster Sonderweg wieder nur
 * hier entsteht — oder besser nirgends.
 */
export function ansichtWeg(_typ: string | undefined, id: string): string[] {
  return ['/artikel', id];
}
