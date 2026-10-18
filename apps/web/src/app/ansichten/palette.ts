import type { LayoutElementKind } from '@nw/model';

/** Ein Eintrag der Palette des Designers (T-268). */
export interface PaletteEintrag {
  el: LayoutElementKind;
  name: string;
  icon: string;
  tip: string;
  /** Nimmt Werte (Felder, auch über Kanten). */
  werte?: boolean;
  /** Neu mit dem Designer — die anderen gab es als Layout-Element schon. */
  neu?: boolean;
}

/**
 * **Die Elemente, aus denen eine Ansicht besteht**, nach Sorte. Die
 * Namen stehen auch im Glossar (`APP_TERMS`), damit „Tile group" auf der
 * Seite und im Handbuch dasselbe heisst.
 */
export const PALETTE: { cat: string; items: PaletteEintrag[] }[] = [
  {
    cat: 'Structure',
    items: [
      { el: 'section', name: 'Section', icon: '▤', tip: 'A heading over the elements inside it.', neu: true },
      { el: 'columns', name: 'Columns', icon: '▥', tip: 'The elements inside side by side; one column on a phone.', neu: true },
      { el: 'carousel', name: 'Carousel', icon: '⇆', tip: 'The elements inside one at a time, with ‹ ›.', neu: true },
      { el: 'collapsible', name: 'Collapsible', icon: '▸', tip: 'Opens and closes; the text is its header.', neu: true },
    ],
  },
  {
    cat: 'Values',
    items: [
      { el: 'heading', name: 'Heading', icon: 'H', tip: 'A heading — its text, or the name of the article.' },
      { el: 'text', name: 'Text', icon: '¶', tip: 'A fixed text, with [[links]] and {{dice}}.' },
      { el: 'description', name: 'Description', icon: '✎', tip: 'The description of the article.' },
      { el: 'fields', name: 'Field list', icon: '≡', tip: 'Fields as label and value.', werte: true },
      { el: 'tileGroup', name: 'Tile group', icon: '▦', tip: 'Fields as tiles: label above, value large.', werte: true, neu: true },
      { el: 'quote', name: 'Quote', icon: '❝', tip: 'A field as a quote — a voice, a motto.', werte: true, neu: true },
      { el: 'badges', name: 'Badges', icon: '◉', tip: 'Values as badges — tags, conditions, properties.', werte: true, neu: true },
      { el: 'edgeTable', name: 'Table from edges', icon: '⊞', tip: 'One row per edge: its target and the edge’s own values.', werte: true, neu: true },
      { el: 'prose', name: 'Long text', icon: '☰', tip: 'Long text fields as paragraphs.', werte: true },
    ],
  },
  {
    cat: 'Game',
    items: [
      { el: 'stats', name: 'Key stats', icon: '♥', tip: 'AC, hit points, speed … as tiles.' },
      { el: 'statblock', name: 'Statblock', icon: '⚔', tip: 'The statblock as in the book.' },
      { el: 'spell', name: 'Spell', icon: '✦', tip: 'A spell as in the book.' },
      { el: 'item', name: 'Item', icon: '⚱', tip: 'An item as in the book.' },
    ],
  },
  {
    cat: 'Pages',
    items: [{ el: 'reader', name: 'Book reader', icon: '📖', tip: 'A layer as a book — contents left, on top or off; values at the margin.', werte: true }],
  },
];

export function eintrag(el: string): PaletteEintrag | undefined {
  for (const g of PALETTE) for (const i of g.items) if (i.el === el) return i;
  return undefined;
}

/** Die Gruppen, die ein Ort wählt (`PLACE_VIEWS`); eine eigene ist ein freies Wort. */
export const GRUPPEN = ['overview', 'quick', 'full', 'print'] as const;
