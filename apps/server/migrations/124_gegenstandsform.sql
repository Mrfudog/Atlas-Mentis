-- Gegenstandsformen (T-142): auf bestehenden Datenbanken nachziehen.
--
--  1. `Item.rows` heisst „Shape" und erklärt sich; dazu `Item.inventoryImage`
--     (das Bild im Kachelinventar, ohne eigenes das Bild des Gegenstands)
--     und `Item.inventoryFrame` (Ausschnitt, Zoom, Drehung, Einpassen oder
--     Füllen; nur in der Maske).
--  2. `holds.props.flip` — das Stück liegt gespiegelt, neben `rot`.
--  3. `Item` `full`: das Element `shape` nach dem Buch (`it-book`), sonst
--     ans Ende. Nur, wo die Anordnung noch kein `shape` hat; was jemand im
--     Register umgebaut hat, bleibt.
--
-- Wie 070 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
     jsonb_set(schema::jsonb, '{properties,rows,title}', '"Shape"'::jsonb),
     '{properties,rows,description}',
     '"The cells it takes in a grid inventory, one row per line: # taken, . free. Painted in the element Shape."'::jsonb
   )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb #> '{properties,rows}') = 'object'
   and (schema::jsonb #> '{properties,rows,description}') is null;

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,inventoryImage}',
     '{"type":"string","format":"asset","title":"Inventory image","target":{"where":{"component":"Asset","property":"kind","value":"image"}},"description":"The picture in the grid inventory; without one, the item’s image."}'::jsonb
   )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'inventoryImage';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,inventoryFrame}',
     '{"type":"object","title":"Inventory image frame","editOnly":true,"description":"How the picture lies in the shape: zoom, offset, quarter turns and fit or fill. Set with Adjust inventory image."}'::jsonb
   )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'inventoryFrame';

update relation_def
   set props = jsonb_set(props, '{properties,flip}', '{"type":"boolean","title":"Mirrored"}'::jsonb)
 where type = 'holds'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'flip';

-- Nach `it-book`, wenn es dasteht …
update interface_def i
   set views = jsonb_set(
         i.views,
         '{full}',
         (select jsonb_agg(x.el order by x.ord)
            from (
              select e.el, e.ord * 2 as ord from jsonb_array_elements(i.views -> 'full') with ordinality as e(el, ord)
              union all
              select '{"id":"it-shape","el":"shape"}'::jsonb,
                     (select u.ord * 2 + 1 from jsonb_array_elements(i.views -> 'full') with ordinality as u(el, ord) where u.el ->> 'id' = 'it-book' limit 1)
            ) as x)
       )
 where i.name = 'Item'
   and jsonb_typeof(i.views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'el' = 'shape')
   and exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'id' = 'it-book');

-- … sonst ans Ende.
update interface_def i
   set views = jsonb_set(i.views, '{full}', (i.views -> 'full') || '[{"id":"it-shape","el":"shape"}]'::jsonb)
 where i.name = 'Item'
   and jsonb_typeof(i.views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'el' = 'shape');
