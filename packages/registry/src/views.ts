import type { ViewDef } from '@nw/model';

/**
 * Darstellungsstufen (REQ-164) — **drei, nicht einundzwanzig.**
 *
 * Es waren einundzwanzig, und vierzehn davon gab es für genau eine
 * Artikelart: `sheet` nur für Kreaturen, `craft` nur für Rezepte, `stack`
 * nur für die Kampagne. Das ist keine Auswahl, das ist eine Liste von
 * Sonderfällen mit einem Dropdown davor — und sie zwingt jeden, erst die
 * richtige Stufe zu finden, bevor er das sieht, was auf dieser Seite
 * ohnehin hingehört.
 *
 * Eine Stufe sagt jetzt nur noch **wie viel** und **für wen**:
 *
 * - `quick` — der Blick im Vorbeigehen. Beschreibung und die offenen Blöcke.
 * - `full` — alles, was diese Artikelart hat.
 * - `player` — dasselbe ohne das, was der Spielleitung gehört.
 *
 * **Was für eine Artikelart eigen ist, steht in `byInterface`** und nicht in
 * einer eigenen Stufe: eine Kreatur zeigt ihren Bogen, ein Rezept seine
 * Werkbank, eine Karte ihre Karte — ohne dass jemand etwas auswählt.
 * `layoutOf` läuft dafür die `extends`-Kette hoch, also deckt `Creature`
 * auch NSC, Spielerfigur, Begleiter und Gefolge ab.
 */

/* Die Reihenfolge, die fast jede Artikelart will. Einmal benannt, damit
   eine Abweichung davon sichtbar ist und nicht in zwanzig Kopien
   untergeht. */
const GEWOEHNLICH = [
  { id: 'l-desc', el: 'description' as const },
  { id: 'l-f', el: 'fields' as const, fields: 'all' as const },
  { id: 'l-b', el: 'blocks' as const, blocks: 'all' as const },
  { id: 'l-c', el: 'composed' as const },
  /* Wer wie zu wem steht, gehört auf die Seite und nicht hinter ein
     Dropdown. `elStanding` gibt nichts zurück, wo niemand eine Meinung
     hat — also steht es hier, ohne jede leere Seite zu belasten.

     Die **Wissensgruppen** stehen hier ausdrücklich NICHT: sie zeichnen
     dieselben Feldzellen wie die Feldtabelle, und zweimal dasselbe ist
     keine Gruppierung. Zugeteilt wird im Seitenpanel, und dort steht es
     auch. */
  { id: 'l-stand', el: 'standing' as const },
  { id: 'l-r', el: 'relations' as const },
];

export const views: Record<string, ViewDef> = {
  quick: {
    label: 'Quick',
    order: 1,
    fields: 'none',
    blocks: ['paragraph', 'readaloud'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'q-desc', el: 'description' },
      { id: 'q-b', el: 'blocks', blocks: ['paragraph', 'readaloud'] },
    ],
  },

  full: {
    label: 'Full',
    order: 2,
    fields: 'all',
    blocks: 'all',
    description: true,
    composed: true,
    relations: true,
    bindings: true,
    image: true,
    layout: [{ id: 'l-img', el: 'image' }, ...GEWOEHNLICH],
    byInterface: {
      /* Eine Kreatur ist ihr Bogen. Erst die Zahlen, die am Tisch zählen,
         dann der Text, dann wer wie zu ihr steht. */
      Creature: [
        { id: 'c-sheet', el: 'sheet' },
        { id: 'c-desc', el: 'description' },
        /* Alles, was der Bogen nicht schon zeigt. `except` statt einer
           Aufzählung: ein neues Feld an CreatureInfo steht sonst nirgends,
           bis es jemand von Hand nachträgt. */
        { id: 'c-f', el: 'fields', fields: 'all', except: ['StatblockInfo', 'Vitals', 'Skills'] },
        /* Was jemand trägt, gehört auf sein Blatt. Es hinter einer
           eigenen Stufe zu verstecken hiess: am Tisch erst umschalten,
           bevor man nachsieht, ob das Seil noch da ist. */
        { id: 'c-inv', el: 'inventory' },
        { id: 'c-b', el: 'blocks', blocks: 'all' },
        { id: 'c-c', el: 'composed' },
        { id: 'c-r', el: 'relations' },
      ],
      Statblock: [
        { id: 's-f', el: 'fields', fields: 'all' },
        { id: 's-c', el: 'composed' },
        { id: 's-b', el: 'blocks', blocks: 'all' },
        { id: 's-r', el: 'relations' },
      ],
      /* Eine Gruppe hat kein eigenes Blatt, aber denselben Beutel und
         dieselben Beziehungen wie eine Figur. */
      Party: [
        { id: 'p-desc', el: 'description' },
        { id: 'p-f', el: 'fields', fields: 'all' },
        { id: 'p-inv', el: 'inventory' },
        { id: 'p-craft', el: 'crafting' },
        { id: 'p-r', el: 'relations' },
      ],
      Inventory: [
        { id: 'i-inv', el: 'inventory' },
        { id: 'i-desc', el: 'description' },
        { id: 'i-f', el: 'fields', fields: 'all', except: ['InventoryInfo'] },
        { id: 'i-r', el: 'relations' },
      ],
      Recipe: [
        { id: 'rz-craft', el: 'crafting' },
        { id: 'rz-desc', el: 'description' },
        { id: 'rz-f', el: 'fields', fields: 'all' },
        { id: 'rz-b', el: 'blocks', blocks: 'all' },
        { id: 'rz-r', el: 'relations' },
      ],
      Table: [
        { id: 't-table', el: 'table' },
        { id: 't-desc', el: 'description' },
        { id: 't-f', el: 'fields', fields: 'all', except: ['TableInfo.rows'] },
        { id: 't-b', el: 'blocks', blocks: 'all' },
      ],
      /* Ein Ort trägt seine Punktreise selbst — sie ist kein eigener Ort,
         sondern wie dieser hier von innen aussieht. */
      Place: [
        { id: 'o-img', el: 'image' },
        { id: 'o-desc', el: 'description' },
        { id: 'o-f', el: 'fields', fields: 'all' },
        { id: 'o-b', el: 'blocks', blocks: 'all' },
        { id: 'o-crawl', el: 'crawl' },
        /* Worauf man hier würfelt. Die Tabelle gehört nicht dem Ort — sie
           gilt für ihn, und das steht an der Kante `tableFor`. */
        { id: 'o-table', el: 'table' },
        { id: 'o-r', el: 'relations' },
      ],
      /* Karte, Board und Begegnung gehören in den Bereich **Play** und
         werden dort gezeichnet. Landet jemand trotzdem auf dem Artikel,
         soll er nicht vor einer leeren Seite stehen — deshalb steht das
         Element auch hier. */
      Map: [
        { id: 'm-map', el: 'map' },
        { id: 'm-desc', el: 'description' },
        { id: 'm-f', el: 'fields', fields: 'all' },
      ],
      Board: [
        { id: 'b-board', el: 'board' },
        { id: 'b-f', el: 'fields', fields: 'all', except: ['BoardInfo.shapes', 'BoardInfo.anchors'] },
      ],
      Encounter: [
        { id: 'e-init', el: 'initiative' },
        { id: 'e-desc', el: 'description' },
        { id: 'e-f', el: 'fields', fields: 'all' },
        { id: 'e-b', el: 'blocks', blocks: 'all' },
      ],
      /* Die Kampagne trägt, was über ihr Ganzes geht: welche Ebenen laufen,
         was offen ist, was wann geschah. Das sind keine eigenen
         Artikelarten — es sind Fragen an die Kampagne. */
      Campaign: [
        { id: 'k-desc', el: 'description' },
        { id: 'k-f', el: 'fields', fields: 'all' },
        { id: 'k-stack', el: 'stack' },
        { id: 'k-q', el: 'quests' },
        { id: 'k-time', el: 'timeline' },
        { id: 'k-prep', el: 'prep' },
        { id: 'k-b', el: 'blocks', blocks: 'all' },
        { id: 'k-r', el: 'relations' },
      ],
      /* Ein Auftrag trägt seine Aufgaben selbst — sie sind Felder an ihm
         und keine eigene Artikelart. Das Element zeichnet auf dem Auftrag
         genau ihn; auf der Kampagne das ganze Brett. */
      Quest: [
        { id: 'qu-q', el: 'quests' },
        { id: 'qu-desc', el: 'description' },
        { id: 'qu-f', el: 'fields', fields: 'all', except: ['QuestInfo.tasks'] },
        { id: 'qu-b', el: 'blocks', blocks: 'all' },
        { id: 'qu-r', el: 'relations' },
      ],
      /* Eine Sitzung ist der Abend selbst: was läuft, und was noch zu tun
         war, bevor er anfing. */
      Session: [
        { id: 'se-live', el: 'live' },
        { id: 'se-prep', el: 'prep' },
        { id: 'se-desc', el: 'description' },
        { id: 'se-f', el: 'fields', fields: 'all' },
        { id: 'se-b', el: 'blocks', blocks: 'all' },
        { id: 'se-r', el: 'relations' },
      ],
    },
  },

  /**
   * Was ein Spieler sieht. Keine Zugangskontrolle — die sitzt am Server
   * (`redactEntity`); das hier ist die Lesestufe, die dazu passt.
   */
  player: {
    label: 'Player',
    order: 3,
    fields: 'all',
    blocks: ['paragraph', 'readaloud', 'lore', 'fact', 'appearance', 'personality'],
    description: true,
    composed: true,
    relations: true,
    bindings: false,
    image: true,
    layout: [
      { id: 'pl-img', el: 'image' },
      { id: 'pl-desc', el: 'description' },
      { id: 'pl-f', el: 'fields', fields: 'all' },
      { id: 'pl-b', el: 'blocks', blocks: ['paragraph', 'readaloud', 'lore', 'fact'] },
      { id: 'pl-c', el: 'composed' },
      { id: 'pl-r', el: 'relations' },
    ],
    byInterface: {
      Creature: [
        { id: 'pc-sheet', el: 'sheet' },
        { id: 'pc-desc', el: 'description' },
        { id: 'pc-f', el: 'fields', fields: 'all', except: ['StatblockInfo', 'Vitals', 'Skills'] },
        /* Was jemand trägt, gehört auf sein Blatt. Es hinter einer
           eigenen Stufe zu verstecken hiess: am Tisch erst umschalten,
           bevor man nachsieht, ob das Seil noch da ist. */
        { id: 'pc-inv', el: 'inventory' },
        { id: 'pc-b', el: 'blocks', blocks: ['paragraph', 'readaloud', 'lore', 'fact', 'appearance', 'personality', 'backstory'] },
        { id: 'pc-c', el: 'composed' },
        { id: 'pc-r', el: 'relations' },
      ],
      Party: [
        { id: 'pp-desc', el: 'description' },
        { id: 'pp-inv', el: 'inventory' },
        { id: 'pp-craft', el: 'crafting' },
      ],
      Inventory: [{ id: 'pi-inv', el: 'inventory' }],
      Recipe: [
        { id: 'pr-craft', el: 'crafting' },
        { id: 'pr-desc', el: 'description' },
      ],
      Map: [{ id: 'pm-map', el: 'map' }],
      Board: [{ id: 'pb-board', el: 'board' }],
      Encounter: [{ id: 'pe-init', el: 'initiative' }],
    },
  },
};
