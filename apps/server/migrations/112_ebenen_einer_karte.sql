-- Ebenen einer Karte und Übergänge (T-307, E-108).
--
-- `Map.floors`: weitere Ebenen (Stockwerke, Keller, Turmgeschosse), je mit
-- eigenem Bild, Gitter, Massstab, Sperren und Blättern. `Map.floorReveal`
-- und `Map.floorReleased`: der Stand am Tisch je Ebene. An der Kante
-- `marker`: `floor` (auf welcher Ebene), die Art `passage` mit `passage`,
-- `toFloor`, `toX`, `toY`, `sight`, `oneWay`.
--
-- **Bestehende Karten werden eine Ebene „Ground"** — ohne Umschreiben: die
-- erste Ebene ist die Karte selbst (Bild, Gitter, Sperren bleiben, wo sie
-- sind), und ein Marker ohne `floor` steht auf ihr. Gezählt wird, wie viele
-- Karten es betrifft. Nichts wird entfernt, kein Artikel geändert.
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das Register
-- hier nach. Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           jsonb_set(
             schema::jsonb,
             '{properties,floors}',
             '{"type":"array","title":"Floors","items":{"type":"object"},"description":"Further floors of this map — each with its own image, grid, scale, walls and layers. The map itself is the first floor."}'::jsonb
           ),
           '{properties,floorReveal}',
           '{"type":"object","title":"Uncovered areas per floor"}'::jsonb
         ),
         '{properties,floorReleased}',
         '{"type":"object","title":"Floors held back","description":"Floors set to false here are not shown to players until released."}'::jsonb
       )::json
 where name = 'Map'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'floors');

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object(
                'kind', jsonb_set(coalesce(props #> '{properties,kind}', '{"type":"string","title":"Token kind","default":"static"}'::jsonb),
                                  '{enum}', '["static","scenery","party","quest","play","passage"]'::jsonb),
                'floor', '{"type":"string","title":"Floor"}'::jsonb,
                'passage', '{"type":"string","title":"Passage","enum":["stairs","ladder","bridge","portal"]}'::jsonb,
                'toFloor', '{"type":"string","title":"Leads to floor"}'::jsonb,
                'toX', '{"type":"number","title":"Leads to X (0–1)"}'::jsonb,
                'toY', '{"type":"number","title":"Leads to Y (0–1)"}'::jsonb,
                'sight', '{"type":"string","title":"Sight through it","enum":["through","none"],"default":"through"}'::jsonb,
                'oneWay', '{"type":"boolean","title":"One way"}'::jsonb
              )
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'passage');

do $$
declare
  karten int;
begin
  select count(*) into karten from component where type = 'Map';
  if karten > 0 then
    raise notice 'Ebenen einer Karte: % Karten haben jetzt eine Ebene „Ground" (die Karte selbst, nichts umgeschrieben).', karten;
  end if;
end $$;
