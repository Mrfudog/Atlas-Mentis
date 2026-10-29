-- Ein Encounter trägt, was vorbereitet ist (T-333). Folge von 162.
--
-- 1. `happensAt` geht auch von der Begegnung aus: der Ort, an dem sie
--    vorbereitet ist — wie bei einer Szene. Unabhängig von E-118 (ob Szene
--    und Begegnung eins werden).
-- 2. Die Anordnung `full` der Begegnung bekommt nach `e-yield` drei
--    Gruppen: `e-place` (Ort, Kurzansicht), `e-map` (Karte, Liste) und
--    `e-loot` (Beute, Tabelle mit Menge und Chance).
--
-- Nur, wo die Anordnung ein Array mit `e-yield` ist und `e-place` noch
-- fehlt — eine eigene Anordnung ohne `e-yield` bleibt, wie sie ist.
-- Kein Artikel und keine Kante wird geändert.
-- Nummer beim Anlegen nachgesehen: 165 (164 hat T-219 inzwischen vergeben).

update relation_def
   set from_ifaces = array_append(from_ifaces, 'Encounter'),
       inverse_label = 'scenes and encounters here',
       means = 'A story or encounter happens at a place; the place lists the scenes and encounters there.'
 where type = 'happensAt'
   and not ('Encounter' = any(from_ifaces));

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
                    where e.el ->> 'id' = 'e-yield'
                    limit 1
                 ) s
                 cross join (values
                   (1, '{"id":"e-place","el":"collection","text":"Place","path":[{"relation":"happensAt"}],"show":"tiles","view":"quick"}'::jsonb),
                   (2, '{"id":"e-map","el":"collection","text":"Map","path":[{"relation":"onMap"}],"show":"list"}'::jsonb),
                   (3, '{"id":"e-loot","el":"collection","text":"Loot","path":[{"relation":"loot"}],"show":"table","props":["qty","chance"]}'::jsonb)
                 ) as n(sub, el)
             ) alle
         )
       )
 where d.name = 'Encounter'
   and jsonb_typeof(d.views::jsonb -> 'full') = 'array'
   and exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'e-yield')
   and not exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'e-place');
