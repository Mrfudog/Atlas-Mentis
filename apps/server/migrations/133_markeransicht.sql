-- Markeransicht wählbar (T-214).
--
-- 1. `interface_def.marker_view`: wie Artikel einer Art als Marker stehen
--    (Symbol, Name, Bild, Kurzansicht-Karte), die `extends`-Kette hoch
--    geerbt. Leer: das Bild, sonst das Symbol — wie bisher.
-- 2. `Map.markerView`: dasselbe für alle Marker einer Karte.
-- 3. `Campaign.markerViews`: dasselbe je Kartenart.
-- 4. `marker.props.view`: dasselbe für einen einzelnen Marker.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen: 133.

alter table interface_def add column if not exists marker_view text;

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,markerView}',
         '{"type":"string","title":"Markers show as","enum":["symbol","name","image","card"],"description":"How markers stand on this map: symbol, symbol with name, image, or a quick card. A marker can say otherwise. Empty: the map kind’s setting in the campaign, else the article type’s."}'::jsonb
       )::json
 where name = 'Map'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'markerView');

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,markerViews}',
         '{"type":"object","title":"Marker view by map kind","description":"How markers stand on maps of each kind: symbol, name, image or quick card. A kind left out follows the article type; a map or a single marker can say otherwise."}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'markerViews');

update relation_def
   set props = jsonb_set(
         props,
         '{properties,view}',
         '{"type":"string","title":"Shows as","enum":["symbol","name","image","card"],"description":"How this marker stands on the map: symbol, symbol with name, image, or a quick card. Empty: what the map, its kind or the article type say."}'::jsonb
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'view');
