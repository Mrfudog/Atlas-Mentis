import type { ViewDef } from '@nw/model';

/**
 * Ansichten (REQ-164) — **drei, und der Ort wählt sie.**
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
    image: false,
    layout: [{ id: 'ov-desc', el: 'description' }],
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
    layout: [
      { id: 'l-img', el: 'image' },
      { id: 'l-desc', el: 'description' },
      { id: 'l-f', el: 'fields', fields: 'all' },
      { id: 'l-b', el: 'prose', fields: 'all' },
      { id: 'l-c', el: 'composed' },
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
};
