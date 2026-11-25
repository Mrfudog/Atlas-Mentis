-- Begegnungen Teil 3 (T-215, REQ-085). Folge von 092.
--
-- Die Anordnung `full` der Begegnung bekommt nach `e-social` zwei
-- Elemente:
--  1. `e-stand` (`standing`, nur bei `social`): wer wo steht — die Haltung
--     der Beteiligten zur Gruppe, gerechnet am Server (`refs.encounter`).
--  2. `e-hazards` (`collection`, nur bei `trap`/`hazard`): die beteiligten
--     Gefahren (`features` → `Hazard`) in Kurzansicht.
--
-- Nur, wo die Anordnung ein Array mit `e-social` ist und `e-stand` noch
-- fehlt — eine eigene Anordnung ohne `e-social` bleibt, wie sie ist.
-- Kein Artikel wird geändert.

update interface_def d
   set views = jsonb_set(
         d.views::jsonb,
         '{full}',
         (
           select jsonb_agg(el order by ord, sub)
             from (
               select e.el, e.ord, 0 as sub
                 from jsonb_array_elements(d.views::jsonb -> 'full') with ordinality as e(el, ord)
               union all
               select n.el, s.ord, n.sub
                 from (
                   select e.ord
                     from jsonb_array_elements(d.views::jsonb -> 'full') with ordinality as e(el, ord)
                    where e.el ->> 'id' = 'e-social'
                    limit 1
                 ) s
                 cross join (values
                   (1, '{"id":"e-stand","el":"standing","text":"Who stands where","when":{"field":"Encounter.kind","has":["social"]}}'::jsonb),
                   (2, '{"id":"e-hazards","el":"collection","text":"Hazards","path":[{"relation":"features"}],"types":["Hazard"],"show":"tiles","view":"quick","when":{"field":"Encounter.kind","has":["trap","hazard"]}}'::jsonb)
                 ) as n(sub, el)
             ) alle
         )
       )
 where d.name = 'Encounter'
   and jsonb_typeof(d.views::jsonb -> 'full') = 'array'
   and exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'e-social')
   and not exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'e-stand');
