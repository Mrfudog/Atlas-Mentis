-- Die Sitzung auf einen Blick (T-151, REQ-282).
--
-- Die Vollansicht der Session zeigt gleich unter `se-live`, was an diesem
-- Abend zählt: die Szenen und Begegnungen (`se-contains`, Migration 144),
-- dazu vier Collections zwei Schritte vom Abend weg — wer in den Szenen
-- vorkommt (`← partOf › features`), wer in den Begegnungen kämpft
-- (`← partOf › participates`), wo sie spielen (`happensAt`, seit 165 auch
-- an der Begegnung) und auf welcher Karte (`onMap`). Dieselbe Zeile wie in
-- `packages/registry/src/interfaces.ts` (Session).
--
-- `se-contains` wandert dafür von unten nach oben, so wie es dasteht (eine
-- eigene Einstellung bleibt); fehlt es, kommt die Vorgabe. Fehlt `se-live`,
-- steht der Block am Anfang. Nur, wo die Anordnung ein Array ist und
-- `se-people` noch fehlt — zweimal laufen ändert nichts. Kein Artikel und
-- keine Kante wird geändert.
-- Nummer beim Anlegen nachgesehen: 166 (165 hat T-333 vergeben).

with alt as (
  select d.name, e.el, e.ord
    from interface_def d
    cross join jsonb_array_elements(d.views::jsonb -> 'full') with ordinality as e(el, ord)
   where d.name = 'Session'
     and jsonb_typeof(d.views::jsonb -> 'full') = 'array'
     and not exists (
       select 1 from jsonb_array_elements(d.views::jsonb -> 'full') as x where x ->> 'id' = 'se-people'
     )
),
enthaelt as (
  select coalesce(
           (select el from alt where el ->> 'id' = 'se-contains' limit 1),
           '{"id":"se-contains","el":"collection","text":"Scenes and encounters","path":[{"relation":"partOf","dir":"in"}],"types":["Scene","Encounter"],"show":"tiles","groupBy":"type"}'::jsonb
         ) as el
),
block as (
  select el, sub from (
    select (select el from enthaelt) as el, 1 as sub
    union all values
      ('{"id":"se-people","el":"collection","text":"People in the scenes","path":[{"relation":"partOf","dir":"in"},{"relation":"features"}],"types":["Creature"],"show":"tiles","sort":{"by":"name"}}'::jsonb, 2),
      ('{"id":"se-fight","el":"collection","text":"In the fights","path":[{"relation":"partOf","dir":"in"},{"relation":"participates"}],"types":["Creature"],"show":"list","sort":{"by":"name"}}'::jsonb, 3),
      ('{"id":"se-places","el":"collection","text":"Places","path":[{"relation":"partOf","dir":"in"},{"relation":"happensAt"}],"types":["Place"],"show":"list","sort":{"by":"name"}}'::jsonb, 4),
      ('{"id":"se-maps","el":"collection","text":"Maps","path":[{"relation":"partOf","dir":"in"},{"relation":"onMap"}],"types":["Map"],"show":"list","sort":{"by":"name"}}'::jsonb, 5)
  ) b
),
stelle as (
  select coalesce((select ord from alt where el ->> 'id' = 'se-live' limit 1), 0) as ord
),
neu as (
  select el, ord, 0 as sub from alt where el ->> 'id' is distinct from 'se-contains'
  union all
  select b.el, s.ord, b.sub from block b cross join stelle s
)
update interface_def d
   set views = jsonb_set(d.views::jsonb, '{full}', (select jsonb_agg(el order by ord, sub) from neu))
 where d.name = 'Session'
   and exists (select 1 from alt);
