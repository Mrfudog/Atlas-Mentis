-- Die Struktur als Kachel und als Element (T-341).
--
-- 1. `placed.props.structure`: die Struktur-Kachel auf dem Board — eine
--    Kante des Boards auf sich selbst wie die Abfrage-Kachel (T-340), mit
--    Startartikel, Kanten, Tiefe und Baum oder Netz.
-- 2. `partOf` von und zu `Faction`: eine Unterfraktion hängt an ihrer
--    Fraktion (der Zirkel ist Teil der Wacht).
-- 3. Die Vollansicht der Fraktion bekommt das Element `structure` — nur,
--    wo an `Faction` noch keine eigene Anordnung für `full` steht. Dieselbe
--    Zeile wie in `packages/registry/src/ansichten.ts` (`ansichten.test.ts`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo es noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen: 137.

update relation_def
   set props = jsonb_set(
         props,
         '{properties,structure}',
         '{"type":"object","title":"Structure","description":"Structure card (T-341): an organisation chart or relationship web from a start article — which edges (members, parts, control, residents, regards), how deep, tree or web. Worked out on the server for each viewer."}'::jsonb
       )
 where type = 'placed'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'structure');

update relation_def
   set from_ifaces = from_ifaces || array['Faction'],
       means = 'An article is part of a larger one (a room of a house, a scene of an arc, a book of a group, a circle of a faction); the larger one lists what it contains, in rank order.'
 where type = 'partOf' and not ('Faction' = any(from_ifaces));

update relation_def
   set to_ifaces = to_ifaces || array['Faction']
 where type = 'partOf' and not ('Faction' = any(to_ifaces));

update interface_def i
   set views = z.neu || coalesce(i.views, '{}'::jsonb)
  from (
    select art, jsonb_object_agg(ansicht, wert) as neu
      from (values
        ('Faction', 'full', '{"adjust":{"extra":[{"id":"fac-structure","el":"structure"}]}}'::jsonb)
      ) as v(art, ansicht, wert)
     group by art
  ) z
 where i.name = z.art
   and not (coalesce(i.views, '{}'::jsonb) ? 'full');
