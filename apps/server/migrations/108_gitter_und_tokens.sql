-- Gitter gestalten und Tokens am Gitter (T-314, T-317, REQ-130, REQ-133).
--
-- 1. `Map.gridColor`, `Map.gridOpacity`, `Map.gridHidden`: wie das Gitter
--    aussieht und ob es gezeichnet wird (gemessen wird weiter).
-- 2. `Map.snapTokens`: Tokens rasten beim Loslassen am Gitter (Vorgabe an).
-- 3. `Campaign.tokenSizes`: wie viele Felder ein Token nach der Grösse
--    seines Statblocks einnimmt (`rules`, `tinyHalf`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               schema::jsonb,
               '{properties,gridColor}',
               '{"type":"string","format":"color","title":"Grid colour","description":"Colour of the grid lines; empty is the default brown."}'::jsonb
             ),
             '{properties,gridOpacity}',
             '{"type":"number","title":"Grid opacity","min":0,"max":1,"default":0.5,"description":"How strongly the grid lines show, from 0 (invisible) to 1."}'::jsonb
           ),
           '{properties,gridHidden}',
           '{"type":"boolean","title":"Grid hidden","default":false,"description":"Draw no grid lines. Measuring and snapping still use the grid."}'::jsonb
         ),
         '{properties,snapTokens}',
         '{"type":"boolean","title":"Tokens snap to the grid","default":true,"description":"A dropped token lands so that its space covers whole (or half) squares."}'::jsonb
       )::json
 where name = 'Map'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'gridColor');

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,tokenSizes}',
         '{"type":"string","title":"Token sizes","description":"How many squares a token covers by the size of its statblock, unless the token says otherwise.","enum":["rules","tinyHalf"],"default":"rules"}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'tokenSizes');
