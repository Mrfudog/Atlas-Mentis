import type { LayoutElementKind, Registry } from '@nw/model';

/** Ein Eintrag der Palette des Designers (T-268, T-276). */
export interface PaletteEintrag {
  el: LayoutElementKind | 'tab';
  name: string;
  icon: string;
  /** Was das Element zeichnet — steht dabei (CLAUDE.md: „Was eine Einstellung auslöst, steht dabei"). */
  tip: string;
  /** Nimmt Werte (Felder, auch über Kanten). */
  werte?: boolean;
  /** Neu mit dem Designer — die anderen gab es als Layout-Element schon. */
  neu?: boolean;
  /**
   * Zeichnet nur die Artikelseite (und der Druck), nicht eine gestaltete
   * Ansicht für sich — dort steht an seiner Stelle ein Hinweis, und die
   * Palette sagt „Article page only“ (T-310; ein Test prüft, dass alles
   * andere `nw-ansichtsbaum` zeichnet).
   */
  seite?: boolean;
  /** Darf stehen, aber noch kein Ort zeichnet es; was es trüge, steht im Rest. */
  ungezeichnet?: boolean;
}

/**
 * **Die Elemente, aus denen eine Ansicht besteht**, nach Sorte — alle, die
 * eine Anordnung kennt, seit T-276 auch die der alten Editoren (Reiter,
 * Bogen, Inventar …), denn der Designer ist der einzige Editor. Die Namen
 * stehen auch im Glossar (`APP_TERMS`), damit „Tile group" auf der Seite und
 * im Handbuch dasselbe heisst.
 */
export const PALETTE: { cat: string; items: PaletteEintrag[] }[] = [
  {
    cat: 'Structure',
    items: [
      { el: 'section', name: 'Section', icon: '▤', tip: 'A heading over the elements inside it.', neu: true },
      { el: 'columns', name: 'Columns', icon: '▥', tip: 'The elements inside side by side; one column on a phone.', neu: true },
      { el: 'tabs', name: 'Tabs', icon: '⊟', tip: 'Named tabs, one shown at a time; what stands above them always shows. Each tab holds elements.', seite: true },
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
      { el: 'fields', name: 'Field list', icon: '≡', tip: 'Fields as label and value — whole types (new fields come by themselves) or single fields.', werte: true },
      { el: 'tileGroup', name: 'Tile group', icon: '▦', tip: 'Fields as tiles: label above, value large.', werte: true, neu: true },
      { el: 'quote', name: 'Quote', icon: '❝', tip: 'A field as a quote — a voice, a motto.', werte: true, neu: true },
      { el: 'badges', name: 'Badges', icon: '◉', tip: 'Values as badges — tags, conditions, properties.', werte: true, neu: true },
      { el: 'edgeTable', name: 'Table from edges', icon: '⊞', tip: 'One row per edge: its target and the edge’s own values. For the rows of a table: Table.', werte: true, neu: true },
      { el: 'table', name: 'Table', icon: '⚄', tip: 'The rows of a table with its die column and Roll — the roll is saved in the rolls log and its row marked.', neu: true },
      { el: 'prose', name: 'Long text', icon: '☰', tip: 'Long texts (paragraphs, secrets, read-aloud), each under its title.', werte: true },
      { el: 'image', name: 'Image', icon: '▣', tip: 'The image of the article, with its caption.' },
      { el: 'relations', name: 'Relations', icon: '↔', tip: 'Its edges with their targets. The article page has them in its side column.', seite: true },
      { el: 'linked', name: 'Linked article', icon: '⛓', tip: 'The fields of what hangs on an asField edge (the statblock of a creature), editable in place; without one, Create and From a template.', seite: true },
      { el: 'composed', name: 'Sections', icon: '§', tip: 'What it is composed of (traits, actions …), per section.', seite: true },
      { el: 'parts', name: 'Parts', icon: '⋮', tip: 'The parts of a chapter or scene, in their order.', seite: true },
      { el: 'usedBy', name: 'Used by', icon: '⤺', tip: 'Who composes this article, by creature type.', seite: true, ungezeichnet: true },
      { el: 'standing', name: 'Standing', icon: '⚖', tip: 'Who thinks what of whom.', seite: true, ungezeichnet: true },
    ],
  },
  {
    cat: 'Game',
    items: [
      { el: 'stats', name: 'Key stats', icon: '♥', tip: 'AC, hit points, speed, initiative, passive Perception and CR as one row of tiles.' },
      { el: 'token', name: 'Token', icon: '◉', tip: 'The token as it stands on the map — of the statblock, or of the statblock of a creature —, with Adjust token for whoever may edit the image.' },
      { el: 'statblock', name: 'Statblock', icon: '⚔', tip: 'The statblock as in the book.' },
      { el: 'spell', name: 'Spell', icon: '✦', tip: 'A spell as in the book.' },
      { el: 'item', name: 'Item', icon: '⚱', tip: 'An item as in the book.' },
      { el: 'sheet', name: 'Character sheet', icon: '❤', tip: 'The header of a creature: hit points, vitals and spellcasting, hit dice, slots, gold, abilities and the status row. Stands above the tabs.', seite: true },
      { el: 'turn', name: 'Your turn', icon: '⏵', tip: 'Every action of the creature by action type, with Used and New turn; what the hands block stays visible with the reason.', seite: true },
      { el: 'spells', name: 'Spells', icon: '✧', tip: 'Spellcasting: ability, attack, save DC, slots; every spell by level with Cast.', seite: true },
      { el: 'inventory', name: 'Inventory', icon: '🎒', tip: 'The inventory it carries and what that holds.', seite: true },
      { el: 'knowledgeContents', name: 'Knowledge contents', icon: '🧠', tip: 'On a knowledge: every information it brings together, written out with the fields the viewer may read. Draws nothing elsewhere.', seite: true },
      { el: 'crafting', name: 'Crafting', icon: '⚒', tip: 'On a recipe the workbench, on a trade its tools and recipes, on a tool or character what it can craft. Draws nothing elsewhere.', seite: true },
      { el: 'initiative', name: 'Initiative tracker', icon: '⚔', tip: 'On an encounter: order, turn and round, hit points and effects with a duration — as much as the viewer may see. Draws nothing elsewhere.', seite: true },
      { el: 'campaign', name: 'Campaign', icon: '⚑', tip: 'What the campaign has shown this character: handouts, sessions, quests, people, maps — only what visibility and knowledge allow.', seite: true },
    ],
  },
  {
    cat: 'Pages',
    items: [
      { el: 'reader', name: 'Book reader', icon: '📖', tip: 'A layer as a book — contents left, on top or off; values at the margin.', werte: true },
      { el: 'contents', name: 'Contents', icon: '☷', tip: 'On a layer its articles by type, with ticks for what the campaign has in play; on a group its layers.', seite: true },
      { el: 'classOverview', name: 'Class overview', icon: '⚜', tip: 'Key data, the level table, subclasses to pick and compare, features by level.', seite: true },
      { el: 'originOverview', name: 'Ancestry/background overview', icon: '❦', tip: 'Key data, variants to switch and compare, traits.', seite: true },
      { el: 'rules', name: 'Rules & options', icon: '⚙', tip: 'Takes the fields it names out of the field table and points to the Rules & options tab (campaign).', werte: true, seite: true },
    ],
  },
];

/** Der Knoten eines Reiters (nur im Designer; gespeichert als `tabs`). */
export const REITER: PaletteEintrag = { el: 'tab', name: 'Tab', icon: '▭', tip: 'One tab of the tabs above; its elements show when it is open.' };

export function eintrag(el: string): PaletteEintrag | undefined {
  if (el === 'tab') return REITER;
  for (const g of PALETTE) for (const i of g.items) if (i.el === el) return i;
  return undefined;
}

/** Die Gruppen, die ein Ort wählt (`PLACE_VIEWS`); eine eigene ist ein freies Wort. */
export const GRUPPEN = ['overview', 'quick', 'full', 'print', 'search'] as const;

/** Wo eine Ansicht der Orte gezeichnet wird — der Ort wählt sie (CLAUDE.md, „Fünf Ansichten"). */
export const ORTE: Record<string, string> = {
  overview: 'A link, a list row in the compendium (its columns) and small board tiles.',
  quick: 'A card: the preview beside a list, the popup on every named article, board tiles.',
  full: 'The article page.',
  print: '“Print” on the article page: one A4 sheet.',
  search: 'Under the “+” of a hit in the search.',
};

/** Ein Eintrag lesbar: `Spell.level` → „Spell › Level", `Spell` → „Spell (all fields)". */
export function eintragText(r: Pick<Registry, 'interfaces'> | null, wert: string): string {
  const [typ = '', feld] = wert.split('.');
  const tl = r?.interfaces[typ]?.label ?? typ;
  if (!feld) return `${tl} (all fields)`;
  const fl = r?.interfaces[typ]?.schema?.properties[feld]?.title ?? feld;
  return `${tl} › ${fl}`;
}
