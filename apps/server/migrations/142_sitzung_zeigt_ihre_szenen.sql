-- Die Sitzung zeigt, was zu ihr gehört (T-422, REQ-427).
--
-- Die Vollansicht der Sitzung bekommt das Element `parts`: darin stehen
-- unter „Contains" die Szenen und Begegnungen, die `partOf` ohne Rang auf
-- die Sitzung zeigen. Arc und Scene haben es schon (Grundanordnung).
-- Dieselbe Zeile wie in `packages/registry/src/interfaces.ts` (Session,
-- `se-parts`, am Ende).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo die Sitzung eine eigene Anordnung `full` als Liste hat und
-- `parts` darin noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set views = jsonb_set(views, '{full}', (views -> 'full') || '[{"id":"se-parts","el":"parts"}]'::jsonb)
 where name = 'Session'
   and jsonb_typeof(views -> 'full') = 'array'
   and not exists (
     select 1 from jsonb_array_elements(views -> 'full') as x where x ->> 'el' = 'parts'
   );
