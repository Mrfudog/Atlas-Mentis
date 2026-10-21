-- Werkzeuge auf dem Board (T-339).
--
-- `Board.backgroundColor`, `backgroundFit` und `backgroundMap`: der
-- Hintergrund ist ein Bild, eine Farbe oder eine Karte. An der Kante
-- `placed`: `hidden` (die Kachel geht an Spielende nicht hinaus). Text,
-- Bild und Zeichnung liegen in `Board.shapes`, das es schon gibt; `width`
-- und `height` bleiben und sind die Mindestgrösse der Leinwand, die beim
-- Lesen mit dem Inhalt wächst (D8).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         (schema::jsonb -> 'properties')
           || jsonb_build_object(
                'backgroundColor', '{"type":"string","title":"Background colour","description":"A colour under everything on the board, e.g. #2b2b2b. Empty: the page paper."}'::jsonb,
                'backgroundFit', '{"type":"string","title":"Background image","enum":["stretch","tile","fixed"],"default":"stretch","description":"How the background image lies: stretched over the canvas, tiled, or once at the top left at its own size."}'::jsonb,
                'backgroundMap', '{"type":"string","format":"link","title":"Background map","target":{"interfaces":["Map"]},"description":"A map that fills the canvas under the cards — players see it as in play, only what is uncovered."}'::jsonb
              )
       )::json
 where name = 'Board'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'backgroundMap');

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object('hidden', '{"type":"boolean","title":"GM only","description":"The card is not sent to players at all (T-339)."}'::jsonb)
       )
 where type = 'placed'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'hidden');
