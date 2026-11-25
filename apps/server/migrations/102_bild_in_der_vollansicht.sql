-- Das Bild steht in der Vollansicht von Statblock und Gruppe (T-211).
--
-- Beide nehmen `Image`, aber ihre eigene Anordnung von `full` hatte kein
-- Element `image`: das Bild eines Statblocks (seit dem Lauf der
-- 5e.tools-Bilder fast jeder) stand nur in Liste und Kurzansicht. Jetzt
-- steht es obenan; im Designer lässt es sich wie jedes Element
-- verschieben oder herausnehmen.
--
-- Vorangestellt wird **nur, wo die Anordnung noch kein Bild hat** — wer
-- es im Register schon eingefügt hat, behält seins. Nichts wird entfernt,
-- kein Artikel geändert.

update interface_def
   set views = jsonb_set(views, '{full}', '[{"id":"s-img","el":"image"}]'::jsonb || (views -> 'full'))
 where name = 'Statblock'
   and jsonb_typeof(views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(views -> 'full') x where x ->> 'el' = 'image');

update interface_def
   set views = jsonb_set(views, '{full}', '[{"id":"p-img","el":"image"}]'::jsonb || (views -> 'full'))
 where name = 'Party'
   and jsonb_typeof(views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(views -> 'full') x where x ->> 'el' = 'image');
