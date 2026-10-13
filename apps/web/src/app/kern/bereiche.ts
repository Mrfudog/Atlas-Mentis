/**
 * Die vier Bereiche (CLAUDE.md: „Sechs Seiten, vier davon Bereiche").
 *
 * Hier steht nur, **welche** Bereiche es gibt und wie sie heissen — nicht,
 * welche Artikelart wohin gehört. Das sagt `area` am Typ (`areaOf`), sonst
 * bräuchte eine neue Artikelart eine Codeänderung, um auffindbar zu sein.
 */
export interface Bereich {
  /** So steht er an der Art (`area`) und in der Adresse. */
  weg: string;
  label: string;
}

export const BEREICHE: readonly Bereich[] = [
  { weg: 'world', label: 'World' },
  { weg: 'history', label: 'History' },
  { weg: 'rules', label: 'Rules' },
  { weg: 'play', label: 'Play' },
];

export function bereichLabel(weg: string | undefined): string | undefined {
  return BEREICHE.find((b) => b.weg === weg)?.label;
}
