-- Die Kurzansicht eines Statblocks sind seine Kennzahlen (T-206).
--
-- Die Leitung (15.10.): die Kurzansicht eines Statblocks zeigte mehr als
-- die Übersicht — den ganzen Bogen. Jetzt:
--
-- 1. `Statblock` `quick`: Bild und das Element `stats` (AC, HP, Bewegung,
--    Initiative, passive Wahrnehmung, CR als eine Reihe Kacheln) statt des
--    Bogens.
-- 2. `Statblock` `overview`: Herausforderung, Grösse, Art — ohne
--    Gesinnung.
-- 3. `Creature` `quick`: dieselben Kennzahlen aus ihrem Statblock, mit
--    ihrem Stand und ihren Zuständen, unter dem Bild.
--
-- Ersetzt wird **nur, wo die Zeile noch genau so steht, wie Seed und
-- Migrationen sie anlegten** (052, 056) — was jemand im Register
-- eingestellt hat, bleibt. Nichts wird entfernt, kein Artikel geändert.

update interface_def
   set views = jsonb_set(views, '{quick}', '[{"id":"s-q-img","el":"image"},{"id":"s-q-stats","el":"stats"}]'::jsonb)
 where name = 'Statblock'
   and views -> 'quick' = '[{"id":"s-q-sb","el":"statblock"}]'::jsonb;

update interface_def
   set views = jsonb_set(views, '{overview}', '[{"id":"s-ov-img","el":"image"},{"id":"s-ov","el":"fields","fields":["Statblock.cr","Statblock.size","Statblock.creatureType"]}]'::jsonb)
 where name = 'Statblock'
   and views -> 'overview' = '[{"id":"s-ov-img","el":"image"},{"id":"s-ov","el":"fields","fields":["Statblock.cr","Statblock.size","Statblock.creatureType","Statblock.alignment"]}]'::jsonb;

update interface_def i
   set views = jsonb_set(i.views, '{quick}', v.wert)
  from (values
    ('Creature', 'quick', '{"adjust":{"add":{"q-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]},"extra":[{"id":"c-q-stats","el":"stats"}],"order":["q-img","c-q-stats"]}}'::jsonb)
  ) as v(art, ansicht, wert)
 where i.name = v.art
   and i.views -> 'quick' = '{"adjust":{"add":{"q-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]}}}'::jsonb;
