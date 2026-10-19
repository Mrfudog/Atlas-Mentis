-- Sicht und Licht (T-305, REQ-140).
--
-- 1. `Item.lightBright`, `Item.lightDim`: wie weit ein Gegenstand leuchtet,
--    in Fuss (hell, dämmrig darüber hinaus). Als Marker leuchtet er selbst,
--    in der Hand einer Figur ihr Token.
-- 2. `marker.props.lightOff`: ein Licht in Play aus- und wieder anmachen,
--    ohne seine Radien zu verlieren.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           schema::jsonb,
           '{properties,lightBright}',
           '{"type":"string","format":"measure","unit":"ft","title":"Bright light","description":"Radius of bright light it sheds — on the map as a marker, or in a figure''s hand."}'::jsonb
         ),
         '{properties,lightDim}',
         '{"type":"string","format":"measure","unit":"ft","title":"Dim light beyond","description":"Dim light for this much further beyond the bright radius (a torch: 20 ft bright, 20 ft more dim)."}'::jsonb
       )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'lightBright');

update relation_def
   set props = jsonb_set(
         props,
         '{properties,lightOff}',
         '{"type":"boolean","title":"Light switched off"}'::jsonb
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'lightOff');
