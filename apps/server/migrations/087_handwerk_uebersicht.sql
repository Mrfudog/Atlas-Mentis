-- Die Handwerksübersicht (T-196): Berufe mit Rezepten und Material,
-- Werkzeuge zeigen, was man damit fertigt.
--
--  1. Art `Trade` — ein Beruf ist eine Regel (erbt von `Rule`) mit seinen
--     Werkzeugen (`Trade.tools`, beim Namen). Seine Seite zeichnet das
--     Element `crafting` unter Bild und Beschreibung: Rezepte und Material.
--  2. `Recipe.trade` nennt die Art (`enumRef: Trade`): die Maske schlägt
--     die Berufe vor; geprüft wird dagegen nicht (eine Art schlägt vor).
--  3. `Item` `full`: das Element `crafting` vor „Used by“ — an einem
--     Werkzeug, was man damit fertigt; an jedem anderen Gegenstand nichts.
--     Nur, wo die Anordnung noch kein `crafting` hat und `it-used` steht
--     (sonst ans Ende); was jemand im Register umgebaut hat, bleibt.
--
-- Wie 063 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'Trade', 'Trade', false, array['Rule'],
       '{"type":"object","properties":{"tools":{"type":"array","title":"Tools","items":{"type":"string"},"enumRef":"Item","enumWhere":{"Item":{"itemType":["tool","artisan tools","gaming set","instrument"]}},"description":"The tools this trade is practised with. A tool lists the recipes of its trades."}}}'::json,
       'rules',
       '{"quick":{"adjust":{"add":{"q-f":["Trade.tools"]}}},"full":{"adjust":{"extra":[{"id":"l-crafting","el":"crafting"}],"order":["l-img","l-desc","l-crafting"]}}}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,trade,enumRef}', '"Trade"'::jsonb)::json
 where name = 'Recipe'
   and jsonb_typeof(schema::jsonb #> '{properties,trade}') = 'object'
   and (schema::jsonb #> '{properties,trade,enumRef}') is null;

-- Vor `it-used`, wenn es dasteht …
update interface_def i
   set views = jsonb_set(
         i.views,
         '{full}',
         (select jsonb_agg(x.el order by x.ord)
            from (
              select e.el, e.ord * 2 as ord from jsonb_array_elements(i.views -> 'full') with ordinality as e(el, ord)
              union all
              select '{"id":"it-craft","el":"crafting"}'::jsonb,
                     (select u.ord * 2 - 1 from jsonb_array_elements(i.views -> 'full') with ordinality as u(el, ord) where u.el ->> 'id' = 'it-used' limit 1)
            ) as x)
       )
 where i.name = 'Item'
   and jsonb_typeof(i.views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'el' = 'crafting')
   and exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'id' = 'it-used');

-- … sonst ans Ende.
update interface_def i
   set views = jsonb_set(i.views, '{full}', (i.views -> 'full') || '[{"id":"it-craft","el":"crafting"}]'::jsonb)
 where i.name = 'Item'
   and jsonb_typeof(i.views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(i.views -> 'full') as e(el) where e.el ->> 'el' = 'crafting');
