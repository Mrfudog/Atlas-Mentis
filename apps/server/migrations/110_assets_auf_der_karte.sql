-- Assets auf der Karte (T-306).
--
-- `marker.props.movable`: ein Asset (`scenery`) wandert in Play nur, wenn es
-- das sagt — Vorgabe fix. `marker.props.blocks`: was sein Umriss hält, als
-- Sperrart (`wall`, `window`, `chasm`, `invisible`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update relation_def
   set props = jsonb_set(
         jsonb_set(
           props,
           '{properties,movable}',
           '{"type":"boolean","title":"Movable in play"}'::jsonb
         ),
         '{properties,blocks}',
         '{"type":"string","title":"Blocks like","enum":["wall","window","chasm","invisible"]}'::jsonb
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'movable');
