-- Die Sitzung zeigt, was zu ihr gehört, über eine Collection (T-425, REQ-430).
--
-- Bisher stand in der Vollansicht der Sitzung das Element `parts` (Migration
-- 142, T-422): darunter eine feste Liste „Contains" mit Name, Art und
-- Begegnungsart. Jetzt steht dort eine Collection: die Szenen und
-- Begegnungen, die `partOf` auf die Sitzung zeigen, jede in der Kurzansicht
-- ihrer eigenen Art, als Kacheln, nach Art gruppiert. Dieselbe Zeile wie in
-- `packages/registry/src/interfaces.ts` (Session, `se-contains`).
--
-- Ersetzt wird nur das Element `se-parts` (das Migration 142 anhängte) an
-- seiner Stelle; steht es nicht da und gibt es noch keine Collection, kommt
-- sie ans Ende. Kein Artikel wird geändert, keine Kante fällt weg — nur
-- die Anordnung der Sitzung zeichnet dieselben Artikel anders. Eine eigene
-- Anordnung, in der jemand `parts` anders benannt hat, bleibt, wie sie ist.

update interface_def
   set views = jsonb_set(
         views,
         '{full}',
         (select jsonb_agg(
                   case
                     when x ->> 'id' = 'se-parts' and x ->> 'el' = 'parts' then
                       '{"id":"se-contains","el":"collection","text":"Scenes and encounters","path":[{"relation":"partOf","dir":"in"}],"types":["Scene","Encounter"],"show":"tiles","groupBy":"type"}'::jsonb
                     else x
                   end
                   order by n)
            from jsonb_array_elements(views -> 'full') with ordinality as t(x, n)))
 where name = 'Session'
   and jsonb_typeof(views -> 'full') = 'array'
   and exists (
     select 1 from jsonb_array_elements(views -> 'full') as x where x ->> 'id' = 'se-parts' and x ->> 'el' = 'parts'
   );

update interface_def
   set views = jsonb_set(
         views,
         '{full}',
         (views -> 'full') || '[{"id":"se-contains","el":"collection","text":"Scenes and encounters","path":[{"relation":"partOf","dir":"in"}],"types":["Scene","Encounter"],"show":"tiles","groupBy":"type"}]'::jsonb)
 where name = 'Session'
   and jsonb_typeof(views -> 'full') = 'array'
   and not exists (
     select 1 from jsonb_array_elements(views -> 'full') as x where x ->> 'el' = 'collection'
   );
