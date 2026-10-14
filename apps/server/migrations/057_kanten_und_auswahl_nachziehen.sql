-- Kantenarten und eine Auswahl auf bestehenden Datenbanken nachziehen
-- (T-090; wie 055 und 056).
--
-- Der Abgleich dev-Register ↔ Startzeilen (Sichtprüfung, 14.10.) fand nach
-- 055/056 noch drei Zeilen, die nur in `packages/registry` geändert worden
-- waren:
--
-- - `partOf` nahm auf dev weder `Board` noch `Encounter` als Ausgang — die
--   Maske bot die Kante an einem Board darum nicht an, obwohl ein Board
--   über `partOf` zu seiner Sitzung gehört (T-014).
-- - `activates` hiess auf dev noch „runs on" / „used by" und kannte als
--   Eigenschaft nur `order`; `mode` (`compare`, `off` — E-022 b, T-092)
--   und `areas`/`types` (teilweise aufschalten, T-105) fehlten.
-- - `Recipe.tool` hatte statt der Auswahl aus Werkzeug-Gegenständen
--   (T-099) noch den Vorschlag aus freiem Text.
--
-- Ergänzt wird nur, was fehlt; Beschriftungen nur, wo noch die alten
-- stehen. Kein Artikel und keine Kante wird geändert.

update relation_def
   set from_ifaces = from_ifaces || array(
         select x from unnest(array['Board', 'Encounter']) x where not (x = any(from_ifaces)))
 where type = 'partOf'
   and not (from_ifaces @> array['Board', 'Encounter']);

update relation_def
   set props = jsonb_set(
         coalesce(props, '{}'::jsonb),
         '{properties}',
         '{"mode":{"type":"string","title":"Mode","enum":["compare","off"]},
           "areas":{"type":"array","items":{"type":"string"},"title":"Areas"},
           "types":{"type":"array","items":{"type":"string"},"title":"Types"}}'::jsonb
           || coalesce(props -> 'properties', '{}'::jsonb))
 where type = 'activates'
   and not (coalesce(props -> 'properties', '{}'::jsonb) ?& array['mode', 'areas', 'types']);

update relation_def
   set label = 'Layers in play', inverse_label = 'In play in'
 where type = 'activates' and label = 'runs on' and inverse_label = 'used by';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,tool}',
     ((schema::jsonb #> '{properties,tool}') - 'suggest')
       || '{"enumRef":"Item","enumWhere":{"Item":{"itemType":["tool","artisan tools","gaming set","instrument"]}}}'::jsonb
   )::json
 where name = 'Recipe'
   and jsonb_typeof(schema::jsonb #> '{properties,tool}') = 'object'
   and not (schema::jsonb #> '{properties,tool}') ? 'enumRef';
