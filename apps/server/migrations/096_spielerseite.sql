-- Spielerseite (T-247, T-246): der Kopf und die Reiter der Kreatur.
--
--  1. `Vitals` bekommt, was die Statuszeile braucht: `concentration`
--     (der Zauber), `durations` (wie lange noch, je Zustand), `hidden`
--     und `turnUsed` (Action/Bonus/Reaction in diesem Zug).
--  2. `Creature` `full`: „Your turn" im Reiter Combat, die Reiter Spells
--     (nur mit `casts`) und Campaign (nur an der Spielerfigur), „Craft"
--     heisst „Crafting". Nur, wo die Anordnung noch dem Seed gleicht —
--     was jemand im Register umgebaut hat, bleibt.
--  3. `casts` und `hasProperty` verlieren `intended`: die Spielerseite
--     liest beide.
--
-- Wie 093 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- kein Artikel und keine Kante wird geändert oder entfernt.

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,concentration}', '{"type":"string","format":"link","title":"Concentrating on","target":{"interfaces":["Spell"]}}'::jsonb)::json
 where name = 'Vitals'
   and (schema::jsonb #> '{properties,concentration}') is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,durations}', '{"type":"object","title":"Durations"}'::jsonb)::json
 where name = 'Vitals'
   and (schema::jsonb #> '{properties,durations}') is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,hidden}', '{"type":"boolean","title":"Hidden"}'::jsonb)::json
 where name = 'Vitals'
   and (schema::jsonb #> '{properties,hidden}') is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,turnUsed}', '{"type":"array","title":"Used this turn","items":{"type":"string"},"enum":["action","bonus","reaction"]}'::jsonb)::json
 where name = 'Vitals'
   and (schema::jsonb #> '{properties,turnUsed}') is null;

update interface_def
   set views = jsonb_set(views, '{full}', '[{"id":"c-sheet","el":"sheet"},{"id":"c-tabs","el":"tabs","tabs":[{"id":"about","label":"Overview","layout":[{"id":"c-img","el":"image"},{"id":"c-desc","el":"description"},{"id":"c-linked","el":"linked","except":["Inventory"]},{"id":"c-f","el":"fields","fields":"all","except":["Vitals"]},{"id":"c-b","el":"prose","fields":"all"}]},{"id":"combat","label":"Combat","layout":[{"id":"c-turn","el":"turn"},{"id":"c-c","el":"composed"}]},{"id":"spells","label":"Spells","layout":[{"id":"c-spells","el":"spells","when":{"relation":"casts"}}]},{"id":"gear","label":"Gear","layout":[{"id":"c-inv","el":"inventory"}]},{"id":"craft","label":"Crafting","layout":[{"id":"c-craft","el":"crafting"}]},{"id":"campaign","label":"Campaign","layout":[{"id":"c-camp","el":"campaign","when":{"type":"PlayerCharacter"}}]},{"id":"ties","label":"Ties","layout":[{"id":"c-stand","el":"standing"},{"id":"c-r","el":"relations"}]}]}]'::jsonb)
 where name = 'Creature'
   and views -> 'full' = '[{"id":"c-sheet","el":"sheet"},{"id":"c-tabs","el":"tabs","tabs":[{"id":"about","label":"Overview","layout":[{"id":"c-img","el":"image"},{"id":"c-desc","el":"description"},{"id":"c-linked","el":"linked","except":["Inventory"]},{"id":"c-f","el":"fields","fields":"all","except":["Vitals"]},{"id":"c-b","el":"prose","fields":"all"}]},{"id":"combat","label":"Combat","layout":[{"id":"c-c","el":"composed"}]},{"id":"gear","label":"Gear","layout":[{"id":"c-inv","el":"inventory"}]},{"id":"craft","label":"Craft","layout":[{"id":"c-craft","el":"crafting"}]},{"id":"ties","label":"Ties","layout":[{"id":"c-stand","el":"standing"},{"id":"c-r","el":"relations"}]}]}]'::jsonb;

-- `casts` wird jetzt gelesen (Spielerseite): was die Kante bewirken
-- sollte, tut sie — der Hinweis darauf fällt weg, wo er noch so steht.
update relation_def
   set intended = null
 where type = 'casts'
   and intended = 'Feed the spell list and its uses: mode, uses, level and charges should appear on the sheet as castable, with slots and charges counted down in play.';

-- Ebenso `hasProperty`: die Hände lesen leicht und zweihändig.
update relation_def
   set intended = null
 where type = 'hasProperty'
   and intended = 'Use the property in numbers: finesse should let an attack use DEX, heavy and two-handed should show on the attack.';
