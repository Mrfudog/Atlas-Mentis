-- Was ohne Rang an einer Geschichte hängt, und was in einem Ort liegt,
-- zeigt eine Collection (T-425, Schnitt 3). Dieselben Zeilen wie in
-- `packages/registry/src/interfaces.ts` (Story `st-contains`, Place
-- `o-within` und `o-residents`).
--
-- Bis hierher stand an jeder Story-Art die feste Liste „Contains" (T-422),
-- die der Server neben den Teilen schickte (`/parts` › `contains`). Sie
-- fällt mit diesem Schnitt weg; an ihre Stelle tritt eine Anpassung der
-- Vollansicht an `Story`, die jede Unterart erbt, die nichts Eigenes sagt
-- (Arc, Szene, Kampagne — die Session hat seit Migration 144 ihre eigene).
-- Position 65 stellt sie zwischen die Teile (`l-parts`) und `l-c`.
--
-- Kein Artikel wird geändert, keine Kante fällt weg. Sagt `Story` für
-- `full` schon etwas Eigenes, bleibt es, wie es ist; ein Ort, der die
-- Elemente schon trägt, bekommt sie nicht zweimal.

update interface_def
   set views = coalesce(views, '{}'::jsonb) || jsonb_build_object(
         'full',
         '{"adjust":{"extra":[{"id":"st-contains","el":"collection","text":"Contains","path":[{"relation":"partOf","dir":"in"}],"types":["Story","Encounter"],"unranked":true,"show":"tiles","groupBy":"type","pos":65}]}}'::jsonb)
 where name = 'Story'
   and (views is null or views -> 'full' is null);

-- Der Ort: vor `o-r` (die Kanten), sonst ans Ende.
update interface_def
   set views = jsonb_set(
         views,
         '{full}',
         case
           when exists (select 1 from jsonb_array_elements(views -> 'full') as x where x ->> 'id' = 'o-r') then
             (select jsonb_agg(y order by n, k)
                from (
                  select x as y, n, 2 as k
                    from jsonb_array_elements(views -> 'full') with ordinality as t(x, n)
                  union all
                  select z, (select n from jsonb_array_elements(views -> 'full') with ordinality as t(x, n) where x ->> 'id' = 'o-r'), k
                    from (values
                      ('{"id":"o-within","el":"collection","text":"Places within","path":[{"relation":"partOf","dir":"in"}],"types":["Place"],"show":"list","sort":{"by":"name"}}'::jsonb, 0),
                      ('{"id":"o-residents","el":"collection","text":"Residents","path":[{"relation":"livesIn","dir":"in"}],"types":["Creature"],"show":"tiles","sort":{"by":"name"}}'::jsonb, 1)
                    ) as neu(z, k)
                ) as alle)
           else
             (views -> 'full') || '[{"id":"o-within","el":"collection","text":"Places within","path":[{"relation":"partOf","dir":"in"}],"types":["Place"],"show":"list","sort":{"by":"name"}},{"id":"o-residents","el":"collection","text":"Residents","path":[{"relation":"livesIn","dir":"in"}],"types":["Creature"],"show":"tiles","sort":{"by":"name"}}]'::jsonb
         end)
 where name = 'Place'
   and jsonb_typeof(views -> 'full') = 'array'
   and not exists (select 1 from jsonb_array_elements(views -> 'full') as x where x ->> 'id' in ('o-within', 'o-residents'));
