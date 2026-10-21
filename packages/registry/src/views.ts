import type { ViewDef } from '@nw/model';

/**
 * Ansichten (REQ-164) — **vier, und der Ort wählt sie** (seit T-110 mit
 * dem Druck; eigene kommen im Register dazu und werden dort gewählt, wo
 * gewählt wird: auf der Kachel und beim Drucken).
 *
 * Es waren einundzwanzig, und vierzehn davon gab es für genau eine
 * Artikelart: `sheet` nur für Kreaturen, `craft` nur für Rezepte, `stack`
 * nur für die Kampagne. Das ist keine Auswahl, das ist eine Liste von
 * Sonderfällen mit einem Dropdown davor.
 *
 * Eine Ansicht sagt jetzt nur noch **wie viel**:
 *
 * - `overview` — was in einem Verweis oder einer Listenzeile steht: der
 *   Name und die Beschreibung. Wie ein Hover.
 * - `quick` — eine Karte: das Nötigste, um zu wissen, was man vor sich hat.
 * - `full` — alles, was diese Artikelart trägt. Die Artikelseite.
 *
 * **Gewählt wird nicht.** Ein Verweis ist ein Verweis und eine Artikelseite
 * ist eine Artikelseite; der Ort weiss, wie viel dort hingehört. Ein Wähler
 * „welche Ansicht hätten Sie gern" stand oben rechts, und wer ihn jedes Mal
 * bedienen muss, bedient ihn irgendwann falsch. Nur auf dem Board wird
 * gewählt — dort liegen Kacheln nebeneinander, und wie gross eine davon
 * ist, ist eine Frage an die Kachel.
 *
 * **Es gibt keine Spieleransicht mehr.** Es gab eine, und sie war die
 * zweite Stelle, an der stand, was ein Spieler nicht sehen darf.
 * Zurückgehalten wird am Server (`redactEntity`): was bei einem Spieler
 * ankommt, darf er sehen — er sieht dieselbe Ansicht wie alle anderen, es
 * steht nur weniger darin.
 *
 * **Die Anordnung wohnt am Typ** (`InterfaceDef.views`) und nicht hier:
 * eine Kreatur zeigt ihren Bogen, ein Rezept seine Werkbank, ohne dass
 * jemand etwas auswählt. Was hier steht, ist der Rückfall — was gezeichnet
 * wird, solange keine Art in der `extends`-Kette etwas Eigenes sagt.
 */
export const views: Record<string, ViewDef> = {
  /**
   * Der Verweis. Er steht mitten im Satz oder in einer Listenzeile, und
   * dort hat nur eines Platz: wovon die Rede ist. Felder, Kanten und
   * Blöcke gehören nicht hinein — wer sie braucht, klickt.
   */
  overview: {
    label: 'Overview',
    order: 1,
    fields: 'none',
    description: true,
    composed: false,
    relations: false,
    bindings: false,
    image: true,
    /* **Eine Übersicht ist ein Satz.** Die Feldtabelle steht trotzdem hier,
       mit leerer Auswahl: so lässt sich je Artikelart **eine** Gruppe
       dazunehmen — die Art einer Kreatur, die Seltenheit eines
       Gegenstands —, ohne dass aus dem Verweis eine Tabelle wird. Leer
       heisst leer: solange niemand etwas ankreuzt, steht dort nur der Satz. */
    /* Das Bild ist hier eine **Vorschau** neben dem Namen (T-114) — in
       einer Listenzeile ein Daumennagel, im Satz nichts. Wer an einer Art
       keine will, nimmt das Element an ihr weg. */
    layout: [
      { id: 'ov-img', el: 'image' },
      { id: 'ov-desc', el: 'description' },
      { id: 'ov-f', el: 'fields', fields: [] },
    ],
  },

  /** Die Karte: ein Bild, ein Satz, das Wesentliche. */
  quick: {
    label: 'Quick',
    order: 2,
    fields: 'none',
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: true,
    layout: [
      { id: 'q-img', el: 'image' },
      { id: 'q-desc', el: 'description' },
      /* Wie bei der Übersicht: die Auswahl ist leer und wird je Art
         gefüllt. Eine Karte trägt zwei oder drei Werte, und **welche**
         weiss die Art und nicht die Ansicht. */
      { id: 'q-f', el: 'fields', fields: [] },
      { id: 'q-b', el: 'prose', fields: ['Prose.paragraph', 'ReadAloud.readaloud'] },
    ],
  },

  /**
   * Die Artikelseite. Was hier steht, ist der Rückfall für eine Art, die
   * nichts Eigenes sagt — die dreizehn Arten, die etwas Eigenes sagen,
   * sagen es an sich selbst.
   */
  full: {
    label: 'Full',
    order: 3,
    fields: 'all',
    description: true,
    composed: true,
    relations: true,
    bindings: true,
    image: true,
    /* Was kein Element nimmt, steht am Ende (T-110): die Seite kennt noch
       nicht jedes Element, und ein Feld, das nur der Bogen zeigt, wäre
       sonst nirgends zu lesen. */
    rest: true,
    layout: [
      { id: 'l-img', el: 'image' },
      { id: 'l-desc', el: 'description' },
      { id: 'l-f', el: 'fields', fields: 'all' },
      /* Was über eine `asField`-Kante hängt, steht hier mit seinen Feldern
         — bearbeitbar, ohne auf einen zweiten Artikel zu springen. Hat eine
         Art keine solche Kante, zeichnet das Element nichts. */
      { id: 'l-linked', el: 'linked' },
      { id: 'l-b', el: 'prose', fields: 'all' },
      /* Die Teile eines Kapitels oder einer Szene, wie im Buch (T-108). */
      { id: 'l-parts', el: 'parts' },
      { id: 'l-c', el: 'composed' },
      /* Wer diesen Artikel zusammensetzt, nach Kreaturentyp (D51): ein Biss
         zeigt Tiere und Drachen, ein Merkmal seine Völker. Wo niemand ihn
         nutzt, zeichnet das Element nichts. */
      { id: 'l-used', el: 'usedBy' },
      /* Wer wie zu wem steht, gehört auf die Seite und nicht hinter ein
         Dropdown. `elStanding` gibt nichts zurück, wo niemand eine Meinung
         hat — also steht es hier, ohne jede leere Seite zu belasten.

         Die **Wissensgruppen** stehen hier ausdrücklich NICHT: sie zeichnen
         dieselben Feldzellen wie die Feldtabelle, und zweimal dasselbe ist
         keine Gruppierung. Zugeteilt wird im Seitenpanel, und dort steht es
         auch. */
      { id: 'l-stand', el: 'standing' },
      { id: 'l-r', el: 'relations' },
    ],
  },

  /**
   * **Der Druck** (T-110, E-030 b): „Print" an der Artikelseite. Ein Blatt
   * A4 hat keine Seitenspalte und keine Knöpfe — also kein Bild, das eine
   * Seite füllt, keine Kantenliste, keine Meinungen, kein Vorbereitungsstand;
   * dafür alles, was man am Tisch nachliest. Eine Art passt es an wie jede
   * Ansicht (`InterfaceDef.views`).
   */
  print: {
    label: 'Print',
    order: 4,
    fields: 'all',
    description: true,
    composed: true,
    relations: false,
    bindings: true,
    image: false,
    /* Kein Rest: die Feldtabelle nimmt schon alles — ausser dem
       Vorbereitungsstand, der am Tisch nichts sagt (T-110 Schritt 7). Mit
       Rest stünde er doch wieder am Ende. */
    layout: [
      { id: 'p-desc', el: 'description' },
      { id: 'p-f', el: 'fields', fields: 'all', except: ['Status'] },
      { id: 'p-b', el: 'prose', fields: 'all' },
      { id: 'p-parts', el: 'parts' },
      { id: 'p-c', el: 'composed' },
    ],
  },

  /**
   * **Ein Handzettel** (T-110 Schritt 7) — die erste eigene Ansicht: was man
   * den Spielenden über einen Ort, eine Szene, eine Figur in die Hand gibt.
   * Beschreibung, Absatz und Vorlesetext, keine Werte und keine Geheimnisse.
   * Was eine Spielerin nicht sehen darf, hält der Server ohnehin zurück; der
   * Handzettel lässt auch weg, was die Leitung beim Drucken für sich sieht.
   * Gewählt beim Drucken und auf der Kachel.
   */
  handout: {
    label: 'Handout',
    order: 5,
    fields: 'none',
    description: true,
    composed: false,
    relations: false,
    bindings: true,
    image: true,
    layout: [
      { id: 'h-img', el: 'image' },
      { id: 'h-desc', el: 'description' },
      /* Leer wie bei `quick` (T-234): welche Werte auf den Zettel gehören,
         weiss die Art — die Seltenheit eines Gegenstands, die Art eines Orts. */
      { id: 'h-f', el: 'fields', fields: [] },
      { id: 'h-b', el: 'prose', fields: ['Prose.paragraph', 'ReadAloud.readaloud'] },
    ],
  },

  /**
   * **Das „+" der Suche** (T-138): die Leitung wollte Treffer mit wenig
   * Info und darunter, aufgeklappt, „Quelle, Art etc.". Art, Ebene und
   * Herausgeber stehen in der Trefferzeile selbst (sie sind keine Felder);
   * was der Artikel darüber hinaus sagt, sagt diese Ansicht — Bild,
   * Beschreibung und je Art die Felder, die sie dazunimmt. Ein Ort, der
   * nach ihr fragt, also bleibt sie stehen (`PLACE_VIEWS`).
   */
  search: {
    label: 'Search',
    order: 6,
    fields: 'none',
    description: true,
    composed: false,
    relations: false,
    bindings: false,
    image: true,
    layout: [
      { id: 's-img', el: 'image' },
      { id: 's-desc', el: 'description' },
      /* Leer wie bei `quick`: welche zwei, drei Werte, weiss die Art. */
      { id: 's-f', el: 'fields', fields: [] },
    ],
  },
};
